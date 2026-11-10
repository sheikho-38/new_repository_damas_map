"""Bounded bus-line search; every walking connection uses the PostgreSQL graph."""

import heapq
import json
import math

from django.conf import settings
from django.db import connection

from .database_routing_service import DatabaseRoutingError, calculate_database_route
from .models import BusRoute
from .transit_routing_service import _cumulative, _distance, _feature, _walk_leg


def _walk(start, end):
    try:
        route = calculate_database_route(
            {'lon': start[0], 'lat': start[1]},
            {'lon': end[0], 'lat': end[1]}, 'walk',
        )
    except DatabaseRoutingError as exc:
        if exc.code in ('no_nearby_edge', 'no_route', 'empty_route'):
            return None
        raise
    return route if route['start_snap_m'] <= 100 and route['end_snap_m'] <= 100 else None


def _routes():
    routes = {}
    for route in BusRoute.objects.filter(is_active=True, bus__is_active=True).select_related('bus')[:settings.TRANSIT_MAX_ROUTES_SCANNED]:
        geometry = route.geometry if isinstance(route.geometry, dict) else {}
        if geometry.get('type') != 'LineString':
            continue
        try:
            coords = [[float(p[0]), float(p[1])] for p in geometry['coordinates']]
            if len(coords) < 2 or any(not all(math.isfinite(v) for v in p) or
                                      not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90)
                                      for p in coords):
                continue
        except (KeyError, TypeError, ValueError, IndexError):
            continue
        measures = _cumulative(coords)
        if measures[-1] > 0:
            routes[route.id] = (route, coords, measures)
    return routes


def _boarding_candidates(routes):
    # A route vertex is only a proposed boarding site when it nearly coincides
    # with a walkable edge. It is not a verified stop or a street crossing.
    points = [{'route_id': rid, 'idx': i, 'lon': p[0], 'lat': p[1]}
              for rid, (_, coords, _) in routes.items() for i, p in enumerate(coords)]
    if not points:
        return {}
    with connection.cursor() as cursor:
        cursor.execute('''
            SELECT p.route_id, p.idx
            FROM jsonb_to_recordset(%s::jsonb)
                 AS p(route_id bigint, idx integer, lon float8, lat float8)
            CROSS JOIN LATERAL (SELECT ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326) AS geom) q
            JOIN LATERAL (
                SELECT ST_Distance(e.geom::geography, q.geom::geography) AS distance_m
                FROM routing_edges e
                WHERE e.edge_type = 'walk'
                  AND (e.cost >= 0 OR e.reverse_cost >= 0)
                  AND ST_DWithin(e.geom, q.geom, %s)
                ORDER BY e.geom <-> q.geom LIMIT 1
            ) nearest ON nearest.distance_m <= %s
        ''', (json.dumps(points), settings.TRANSIT_MAX_BOARDING_SNAP_METRES / 80000,
              settings.TRANSIT_MAX_BOARDING_SNAP_METRES))
        eligible = {}
        for rid, idx in cursor.fetchall():
            eligible.setdefault(rid, []).append(idx)
    candidates = {}
    for rid, indices in eligible.items():
        indices.sort()
        _, coords, measures = routes[rid]
        selected = []
        spacing = min(settings.TRANSIT_BOARDING_SPACING_METRES, 100)
        for idx in indices:
            if not selected or measures[idx] - measures[selected[-1]] >= spacing:
                selected.append(idx)
        if selected and indices[-1] != selected[-1] and measures[indices[-1]] - measures[selected[-1]] >= spacing / 2:
            selected.append(indices[-1])
        for idx in selected:
            candidates[(rid, idx)] = coords[idx]
    return candidates


def _ends(point, candidates, limit):
    nearby = sorted(((_distance(point, coord), key) for key, coord in candidates.items()
                     if _distance(point, coord) <= settings.TRANSIT_MAX_CROW_ACCESS_METRES),
                    key=lambda item: item[0])
    chosen, counts = [], {}
    for _, key in nearby:
        if key[0] not in counts:
            chosen.append(key)
            counts[key[0]] = 1
            if len(chosen) >= limit:
                return chosen
    for _, key in nearby:
        if key not in chosen and counts.get(key[0], 0) < settings.TRANSIT_CANDIDATES_PER_END:
            chosen.append(key)
            counts[key[0]] = counts.get(key[0], 0) + 1
            if len(chosen) >= limit:
                break
    return chosen


def _transfers(candidates, routes):
    # Only short, plausible line pairs are sent to pgRouting; walking is never
    # inferred from geometric proximity alone.
    keys = list(candidates)
    pairs = []
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            if routes[a[0]][0].bus_id == routes[b[0]][0].bus_id:
                continue
            gap = _distance(candidates[a], candidates[b])
            if gap <= settings.TRANSIT_TRANSFER_CROW_METRES:
                pairs.append((gap, a, b))
    pairs.sort(key=lambda item: item[0])
    chosen, per_route_pair = [], {}
    for _, a, b in pairs:
        pair = tuple(sorted((a[0], b[0])))
        existing = per_route_pair.get(pair, [])
        measures_a, measures_b = routes[a[0]][2], routes[b[0]][2]
        if len(existing) >= 4 or any(
            abs(measures_a[a[1]] - measures_a[x[1]]) < 200 and
            abs(measures_b[b[1]] - measures_b[y[1]]) < 200 for x, y in existing
        ):
            continue
        chosen.append((a, b))
        existing.append((a, b))
        per_route_pair[pair] = existing
        if len(chosen) >= settings.TRANSIT_MAX_TRANSFER_PAIRS:
            break
    return chosen


def calculate_database_transit_route(start, end):
    """Find a timed journey across proposed boarding points and real walk legs."""
    if start == end:
        raise DatabaseRoutingError('empty_route', 'نقطتا البداية والنهاية متطابقتان')
    direct = _walk(start, end)
    if direct and direct['distance_m'] <= 100:
        direct_leg = _walk_leg(direct)
        return {'recommended_mode': 'walk', 'summary': 'المشي هو الخيار الأنسب لهذه الرحلة',
                'distance_m': direct['distance_m'], 'duration_s': direct['duration_s'],
                'walking_distance_m': direct['distance_m'],
                'walking_duration_s': direct['duration_s'], 'cost': 0,
                'steps': [{'instruction': 'امشِ إلى الوجهة', 'icon': 'walk',
                           'duration_mins': round(direct['duration_s'] / 60)}],
                'legs': [direct_leg], 'route_geojson': direct_leg['geojson']}
    routes = _routes()
    candidates = _boarding_candidates(routes)
    if not candidates:
        raise DatabaseRoutingError('no_route', 'لا يتوفر مسار مواصلات مناسب بين النقطتين')

    # Nodes are proposed boarding sites; ride arcs follow the stored line order.
    source, target = ('source',), ('target',)
    graph = {source: []}

    def arc(a, b, weight, kind, data):
        graph.setdefault(a, []).append((b, weight, kind, data))

    for rid, (route, coords, measures) in routes.items():
        indices = sorted(idx for route_id, idx in candidates if route_id == rid)
        speed = (measures[-1] / (route.trip_time * 60)
                 if route.trip_time else settings.TRANSIT_DEFAULT_BUS_SPEED_KMH / 3.6)
        for pos, i in enumerate(indices):
            for j in indices[pos + 1:]:
                ride = measures[j] - measures[i]
                if ride <= 0:
                    continue
                if ride / max(_distance(coords[i], coords[j]), 1) > settings.TRANSIT_MAX_RIDE_DETOUR_RATIO:
                    continue
                seconds = ride / speed
                arc((rid, i), (rid, j), seconds + settings.TRANSIT_TRANSFER_PENALTY_SECONDS,
                    'bus', (route, coords[i:j + 1], ride, seconds))

    for key in _ends(start, candidates, settings.TRANSIT_MAX_WALKING_PAIRS):
        if _distance(start, candidates[key]) < 1:
            arc(source, key, 0, 'noop', None)
            continue
        walk = _walk(start, candidates[key])
        if (walk and walk['start_snap_m'] <= settings.TRANSIT_MAX_USER_SNAP_METRES
                and walk['end_snap_m'] <= settings.TRANSIT_MAX_BOARDING_SNAP_METRES
                and walk['distance_m'] <= settings.TRANSIT_MAX_ACCESS_WALK_METRES):
            arc(source, key, walk['duration_s'], 'walk', walk)
    for key in _ends(end, candidates, settings.TRANSIT_MAX_WALKING_PAIRS):
        if _distance(candidates[key], end) < 1:
            arc(key, target, 0, 'noop', None)
            continue
        walk = _walk(candidates[key], end)
        if (walk and walk['start_snap_m'] <= settings.TRANSIT_MAX_BOARDING_SNAP_METRES
                and walk['end_snap_m'] <= settings.TRANSIT_MAX_USER_SNAP_METRES
                and walk['distance_m'] <= settings.TRANSIT_MAX_ACCESS_WALK_METRES):
            arc(key, target, walk['duration_s'], 'walk', walk)
    for a, b in _transfers(candidates, routes):
        walk = _walk(candidates[a], candidates[b])
        if (walk and walk['start_snap_m'] <= settings.TRANSIT_MAX_BOARDING_SNAP_METRES
                and walk['end_snap_m'] <= settings.TRANSIT_MAX_BOARDING_SNAP_METRES
                and walk['distance_m'] <= settings.TRANSIT_MAX_TRANSFER_WALK_METRES):
            arc(a, b, walk['duration_s'], 'walk', walk)
        # Walking permissions and geometry can differ by direction.
        reverse = _walk(candidates[b], candidates[a])
        if (reverse and reverse['start_snap_m'] <= settings.TRANSIT_MAX_BOARDING_SNAP_METRES
                and reverse['end_snap_m'] <= settings.TRANSIT_MAX_BOARDING_SNAP_METRES
                and reverse['distance_m'] <= settings.TRANSIT_MAX_TRANSFER_WALK_METRES):
            arc(b, a, reverse['duration_s'], 'walk', reverse)

    first_state = (source, False, False)
    distances, previous, queue = {first_state: 0}, {}, [(0, 0, first_state)]
    counter = 0
    finish = None
    while queue:
        cost, _, state = heapq.heappop(queue)
        if cost != distances[state]:
            continue
        node, just_rode, has_bus = state
        if node == target:
            if has_bus:
                finish = state
                break
            continue
        for next_node, weight, kind, data in graph.get(node, []):
            if just_rode and kind == 'bus':
                continue
            next_state = (next_node, kind == 'bus', has_bus or kind == 'bus')
            new_cost = cost + weight
            if new_cost < distances.get(next_state, math.inf):
                distances[next_state] = new_cost
                previous[next_state] = (state, kind, data)
                counter += 1
                heapq.heappush(queue, (new_cost, counter, next_state))
    if finish is None:
        raise DatabaseRoutingError('no_route', 'لا يتوفر مسار مواصلات مناسب بين النقطتين')
    path, state = [], finish
    while state != first_state:
        parent, kind, data = previous[state]
        path.append((parent[0], state[0], kind, data))
        state = parent
    path.reverse()

    legs, walking_m = [], 0.0
    walking_s = bus_m = bus_s = fare = 0.0
    for a, b, kind, data in path:
        if kind == 'noop':
            continue
        if kind == 'walk':
            walking_m += data['distance_m']
            walking_s += data['duration_s']
            legs.append(_walk_leg(data))
        else:
            route, coords, metres, seconds = data
            bus_m += metres
            bus_s += seconds
            fare += float(route.cost)
            legs.append({'mode': 'bus', 'distance_m': round(metres, 1),
                         'duration_seconds': round(seconds, 1),
                         'line_name': route.bus.name, 'bus_route_id': route.id,
                         'direction': route.direction, 'boarding': coords[0],
                         'alighting': coords[-1], 'boarding_safety_verified': False,
                         'geojson': _feature({'type': 'LineString', 'coordinates': coords},
                                             'bus', route.bus.color or '#D99432')})
    buses = [leg for leg in legs if leg['mode'] == 'bus']
    if not buses:
        raise DatabaseRoutingError('no_route', 'لا يتوفر مسار مواصلات مناسب بين النقطتين')

    steps = []
    for index, leg in enumerate(legs):
        if leg['mode'] == 'bus':
            label = 'بدّل إلى' if any(item['mode'] == 'bus' for item in legs[:index]) else 'اركب'
            instruction = f"{label} خط {leg['line_name']}، ثم انزل عند نقطة النزول المقترحة"
        elif index == len(legs) - 1:
            instruction = 'تابع مشيًا إلى الوجهة'
        else:
            instruction = 'امشِ إلى نقطة الصعود المقترحة'
        steps.append({'instruction': instruction, 'icon': leg['mode'],
                      'duration_mins': round(leg['duration_seconds'] / 60)})
    overhead = len(buses) * settings.TRANSIT_TRANSFER_PENALTY_SECONDS
    direct_leg = _walk_leg(direct) if direct else None
    result = {'recommended_mode': 'transit', 'summary': ' ← '.join(leg['line_name'] for leg in buses),
              'line_name': buses[0]['line_name'], 'direction': buses[0]['direction'],
              'cost': fare, 'distance_m': walking_m + bus_m,
              'duration_s': walking_s + bus_s + overhead,
              'walking_distance_m': walking_m, 'walking_duration_s': walking_s,
              'bus_distance_m': bus_m, 'bus_duration_s': bus_s,
              'boarding': buses[0]['boarding'], 'alighting': buses[-1]['alighting'],
              'boarding_safety_verified': False, 'waiting_time_minutes': None,
              'planning_buffer_minutes': overhead / 60, 'duration_estimated': True,
              'transfers_count': len(buses) - 1, 'steps': steps,
              'legs': legs, 'route_geojson': {'type': 'FeatureCollection',
                                            'features': [leg['geojson'] for leg in legs]}}
    if direct_leg:
        result['alternatives'] = [{'mode': 'walk', 'summary': 'المشي المباشر',
                                   'distance_m': direct['distance_m'],
                                   'duration_s': direct['duration_s'], 'legs': [direct_leg]}]
    return result
