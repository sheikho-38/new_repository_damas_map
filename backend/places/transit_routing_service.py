"""Candidate-based transit routing, preferring the longest useful bus ride."""

import math
import logging

from django.conf import settings

from .models import BusRoute
from .routing_service import RoutingError, calculate_walking_route


EARTH_RADIUS = 6371000
logger = logging.getLogger(__name__)


def _diagnostic(route_id, reason, **details):
    if settings.DEBUG:
        logger.warning('transit_candidate route_id=%s reason=%s details=%s', route_id, reason, details)


def _distance(a, b):
    lon1, lat1 = a
    lon2, lat2 = b
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    value = (math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) *
             math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * EARTH_RADIUS * math.asin(min(1, math.sqrt(value)))


def _project(point, a, b, segment, before):
    lat0 = math.radians(point[1])
    scale_x = math.cos(lat0) * 111320
    px, py = (point[0] - a[0]) * scale_x, (point[1] - a[1]) * 110540
    bx, by = (b[0] - a[0]) * scale_x, (b[1] - a[1]) * 110540
    denominator = bx * bx + by * by
    fraction = max(0, min(1, (px * bx + py * by) / denominator)) if denominator else 0
    coordinate = [a[0] + (b[0] - a[0]) * fraction,
                  a[1] + (b[1] - a[1]) * fraction]
    segment_length = _distance(a, b)
    return {'coordinate': coordinate, 'segment': segment, 'fraction': fraction,
            'measure': before + segment_length * fraction,
            'offset': _distance(point, coordinate)}


def _cumulative(coords):
    values = [0.0]
    for index in range(len(coords) - 1):
        values.append(values[-1] + _distance(coords[index], coords[index + 1]))
    return values


def _nearest_candidates(point, coords, cumulative, limit):
    candidates = [_project(point, coords[i], coords[i + 1], i, cumulative[i])
                  for i in range(len(coords) - 1)]
    candidates.sort(key=lambda item: item['offset'])
    selected = []
    for candidate in candidates:
        if all(abs(candidate['measure'] - item['measure']) >= 100 for item in selected):
            selected.append(candidate)
        if len(selected) == limit:
            break
    return selected


def _route_segment(coords, board, alight, circular):
    segment = [board['coordinate']]
    if not circular or alight['measure'] > board['measure']:
        segment.extend(coords[board['segment'] + 1:alight['segment'] + 1])
    else:
        segment.extend(coords[board['segment'] + 1:])
        segment.extend(coords[1:alight['segment'] + 1])
    segment.append(alight['coordinate'])
    return segment


def _feature(geometry, mode, color):
    return {'type': 'Feature', 'geometry': geometry,
            'properties': {'mode': mode, 'leg_type': mode, 'color': color}}


def _walk_leg(route):
    return {'mode': 'walk', 'distance_m': round(route['distance_m'], 1),
            'duration_seconds': round(route['duration_s'], 1),
            'geojson': _feature(route['geometry'], 'walk', '#2684C7')}


def calculate_transit_route(start, end):
    """Prefer the longest valid bus segment reaching the destination.

    A candidate still must satisfy the existing direction, boarding/alighting
    access distance and detour checks. Walking routes are verified by BRouter.
    Do not rank by the *entire* bus line's length: only the usable segment
    between the selected boarding and alighting points matters.
    """
    direct = calculate_walking_route([{'lon': start[0], 'lat': start[1]},
                                      {'lon': end[0], 'lat': end[1]}])
    max_access = settings.TRANSIT_MAX_CROW_ACCESS_METRES
    per_end = settings.TRANSIT_CANDIDATES_PER_END
    ranked = []
    routes = BusRoute.objects.filter(is_active=True, bus__is_active=True).select_related('bus')
    for route in routes[:settings.TRANSIT_MAX_ROUTES_SCANNED]:
        geometry = route.geometry if isinstance(route.geometry, dict) else {}
        raw_coords = geometry.get('coordinates', [])

        if geometry.get('type') != 'LineString':
            _diagnostic(route.id, 'unsupported_geometry_type', geometry_type=geometry.get('type'))
            continue

        try:
            coords = []

            for point in raw_coords:
                if not isinstance(point, (list, tuple)) or len(point) < 2:
                    raise ValueError("Invalid route coordinate")

                lon = float(point[0])
                lat = float(point[1])

                if not (math.isfinite(lon) and math.isfinite(lat)
                        and -180 <= lon <= 180 and -90 <= lat <= 90):
                    raise ValueError("Invalid coordinates")

                coords.append([lon, lat])

        except (ValueError, TypeError):
            _diagnostic(route.id, 'invalid_geometry')
            continue

        if len(coords) < 2:
            _diagnostic(route.id, 'geometry_too_short', points=len(coords))
            continue

        cumulative = _cumulative(coords)
        total = cumulative[-1]
        if total < settings.TRANSIT_MIN_RIDE_METRES:
            _diagnostic(route.id, 'route_too_short', route_metres=round(total))
            continue
        boards = _nearest_candidates(start, coords, cumulative, per_end)
        alights = _nearest_candidates(end, coords, cumulative, per_end)
        circular = _distance(coords[0], coords[-1]) <= settings.TRANSIT_CIRCULAR_GAP_METRES
        rejection_counts = {'ride_too_short_or_wrong_order': 0, 'access_too_far': 0, 'excessive_detour': 0}
        accepted = 0
        for board in boards:
            for alight in alights:
                ride = alight['measure'] - board['measure']
                if circular and ride <= 0:
                    ride += total
                if ride < settings.TRANSIT_MIN_RIDE_METRES:
                    rejection_counts['ride_too_short_or_wrong_order'] += 1
                    continue
                if board['offset'] > max_access or alight['offset'] > max_access:
                    rejection_counts['access_too_far'] += 1
                    continue
                detour = ride / max(_distance(board['coordinate'], alight['coordinate']), 1)
                if detour > settings.TRANSIT_MAX_RIDE_DETOUR_RATIO:
                    rejection_counts['excessive_detour'] += 1
                    continue
                accepted += 1
                # The longest usable onboard distance gets first priority.
                # Walking access and unnecessary detours break close ties.
                # This is not the length of the complete bus line.
                ranked.append(((-ride, board['offset'] + alight['offset'], detour),
                               route, coords, circular, board, alight, ride))
        _diagnostic(route.id, 'projected_candidates', accepted=accepted, rejected=rejection_counts,
                    direction=route.direction, circular=circular)

    best = None
    # Shortlist long, useful bus journeys first. Retain route diversity so one
    # long line with many candidate pairs cannot crowd out all other lines.
    ordered = sorted(ranked, key=lambda item: item[0])
    diverse, seen_routes = [], set()
    for candidate in ordered:
        if candidate[1].id not in seen_routes:
            diverse.append(candidate)
            seen_routes.add(candidate[1].id)
    shortlisted = (diverse + [item for item in ordered if item not in diverse])[:settings.TRANSIT_MAX_WALKING_PAIRS]
    for _, route, coords, circular, board, alight, ride in shortlisted:
        try:
            access = calculate_walking_route([{'lon': start[0], 'lat': start[1]},
                                               {'lon': board['coordinate'][0], 'lat': board['coordinate'][1]}])
            egress = calculate_walking_route([{'lon': alight['coordinate'][0], 'lat': alight['coordinate'][1]},
                                               {'lon': end[0], 'lat': end[1]}])
        except RoutingError as exc:
            _diagnostic(route.id, 'walking_access_failed', code=exc.code)
            continue
        bus_seconds = ((route.trip_time * 60 * ride / route.distance)
                       if route.trip_time and route.distance else
                       ride / (settings.TRANSIT_DEFAULT_BUS_SPEED_KMH / 3.6))
        walking_distance = access['distance_m'] + egress['distance_m']
        generalized = access['duration_s'] + egress['duration_s'] + bus_seconds + settings.TRANSIT_TRANSFER_PENALTY_SECONDS
        # Prefer the longest valid bus portion, even when a shorter ride is
        # marginally faster. For equal bus distances, prefer less walking,
        # then a shorter estimated overall journey time.
        priority = (-ride, walking_distance, generalized)
        candidate = (priority, generalized, walking_distance, bus_seconds,
                     route, board, alight, ride, access, egress,
                     _route_segment(coords, board, alight, circular))
        if best is None or candidate[0] < best[0]:
            best = candidate

    direct_leg = _walk_leg(direct)
    if best is None:
        _diagnostic(None, 'no_viable_transit', ranked=len(ranked), shortlisted=len(shortlisted))
        return {'recommended_mode': 'walk', 'summary': 'المشي هو الخيار الأنسب لهذه الرحلة',
                'distance_m': direct['distance_m'], 'duration_s': direct['duration_s'],
                'walking_distance_m': direct['distance_m'], 'walking_duration_s': direct['duration_s'],
                'cost': 0, 'legs': [direct_leg], 'route_geojson': direct_leg['geojson']}

    _, generalized, walking_distance, bus_seconds, route, board, alight, ride, access, egress, bus_coords = best
    legs = [_walk_leg(access),
            {'mode': 'bus', 'distance_m': round(ride, 1), 'duration_seconds': round(bus_seconds, 1),
             'geojson': _feature({'type': 'LineString', 'coordinates': bus_coords}, 'bus', '#D99432')},
            _walk_leg(egress)]
    duration = access['duration_s'] + bus_seconds + egress['duration_s']
    _diagnostic(route.id, 'selected', direction=route.direction,
                walking_metres=round(walking_distance), riding_metres=round(ride))
    return {'recommended_mode': 'transit', 'summary': f'باص / سرفيس {route.bus.name}',
            'line_name': route.bus.name, 'direction': route.direction,
            'cost': float(route.cost), 'distance_m': walking_distance + ride, 'duration_s': duration,
            'walking_distance_m': walking_distance,
            'walking_duration_s': access['duration_s'] + egress['duration_s'],
            'bus_distance_m': ride, 'bus_duration_s': bus_seconds,
            'boarding': board['coordinate'], 'alighting': alight['coordinate'],
            'boarding_safety_verified': False, 'waiting_time_minutes': None,
            'legs': legs, 'route_geojson': legs[1]['geojson'],
            'alternatives': [{'mode': 'walk', 'summary': 'المشي المباشر',
                              'distance_m': direct['distance_m'], 'duration_s': direct['duration_s'],
                              'legs': [direct_leg]}]}
