"""BRouter HTTP adapter shared by public car routing and bus route editing."""

import json
import math
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


class RoutingError(Exception):
    def __init__(self, code, message, status=502):
        super().__init__(message)
        self.code = code
        self.status = status


def _point(point):
    if not isinstance(point, dict):
        raise RoutingError('invalid_coordinates', 'صيغة نقطة المسار غير صحيحة', 400)
    try:
        lon, lat = float(point['lon']), float(point['lat'])
    except (KeyError, TypeError, ValueError):
        raise RoutingError('invalid_coordinates', 'كل نقطة تحتاج lon وlat', 400)
    if not all(map(math.isfinite, (lon, lat))) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise RoutingError('invalid_coordinates', 'إحداثيات النقطة غير صالحة', 400)
    return lon, lat


def _metres(a, b):
    lon1, lat1 = a
    lon2, lat2 = b
    radius = 6371000
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    value = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2*radius*math.asin(min(1, math.sqrt(value)))


def _calculate_route(waypoints, *, profile, bounds=None, max_snap_metres=None,
                     no_route_message, no_nearby_road_code, no_nearby_road_message):
    if not isinstance(waypoints, list) or len(waypoints) < 2:
        raise RoutingError('invalid_coordinates', 'يلزم تحديد نقطتي بداية ونهاية', 400)
    points = [_point(point) for point in waypoints]
    if bounds:
        west, south, east, north = bounds
        if any(not (west <= lon <= east and south <= lat <= north) for lon, lat in points):
            raise RoutingError('outside_coverage', 'النقطة خارج نطاق توجيه دمشق', 422)
        if _metres(points[0], points[-1]) < 2:
            raise RoutingError('same_point', 'نقطتا البداية والوجهة متطابقتان', 400)
    query = urlencode({
        'lonlats': '|'.join(f'{lon},{lat}' for lon, lat in points),
        'profile': profile, 'alternativeidx': 0, 'format': 'geojson',
    })
    url = f"{settings.BROUTER_URL.rstrip('/')}/brouter?{query}"
    try:
        with urlopen(Request(url, headers={'Accept': 'application/json'}), timeout=settings.BROUTER_TIMEOUT_SECONDS) as response:
            payload = json.load(response)
    except HTTPError as exc:
        if exc.code in (400, 404):
            raise RoutingError('no_route', no_route_message, 422) from exc
        raise RoutingError('engine_error', 'تعذّر حساب المسار', 502) from exc
    except TimeoutError as exc:
        raise RoutingError('timeout', 'انتهت مهلة حساب المسار', 504) from exc
    except (URLError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise RoutingError('engine_unavailable', 'خدمة التوجيه غير متاحة', 503) from exc

    if not isinstance(payload, dict) or not payload.get('features'):
        raise RoutingError('no_route', no_route_message, 422)
    try:
        feature = payload['features'][0]
        geometry = feature['geometry']
        coordinates = geometry['coordinates']
        props = feature['properties']
        distance_m = float(props['track-length'])
        duration_s = float(props['total-time'])
        valid = (geometry['type'] == 'LineString' and len(coordinates) >= 2
                 and all(isinstance(p, list) and len(p) >= 2 and
                         all(isinstance(v, (int, float)) and math.isfinite(v) for v in p[:2]) for p in coordinates)
                 and all(math.isfinite(v) and v >= 0 for v in (distance_m, duration_s)))
        if not valid:
            raise ValueError('invalid BRouter result')
    except (KeyError, IndexError, TypeError, ValueError):
        raise RoutingError('invalid_engine_response', 'استجابة محرك التوجيه غير صالحة', 502)
    if max_snap_metres and (_metres(points[0], coordinates[0][:2]) > max_snap_metres or
                            _metres(points[-1], coordinates[-1][:2]) > max_snap_metres):
        raise RoutingError(no_nearby_road_code, no_nearby_road_message, 422)
    return {'geometry': {'type': 'LineString', 'coordinates': [p[:2] for p in coordinates]},
            'distance_m': distance_m, 'duration_s': duration_s,
            'snapped_start': coordinates[0][:2], 'snapped_end': coordinates[-1][:2],
            'instructions': []}  # BRouter's messages are road tags, not reliable turn instructions.


def calculate_car_route(waypoints, *, enforce_damascus=False):
    return _calculate_route(
        waypoints,
        profile='car-eco',
        bounds=settings.CAR_ROUTING_BOUNDS if enforce_damascus else None,
        max_snap_metres=settings.CAR_ROUTING_MAX_SNAP_METRES if enforce_damascus else None,
        no_route_message='لم يُعثر على مسار قابل للقيادة',
        no_nearby_road_code='no_drivable_road',
        no_nearby_road_message='لا يوجد شارع قابل للقيادة قريب من إحدى النقطتين',
    )


def calculate_walking_route(waypoints):
    return _calculate_route(
        waypoints,
        profile=settings.WALK_ROUTING_PROFILE,
        bounds=settings.WALK_ROUTING_BOUNDS,
        max_snap_metres=settings.WALK_ROUTING_MAX_SNAP_METRES,
        no_route_message='لم يُعثر على مسار صالح للمشي',
        no_nearby_road_code='no_walkable_road',
        no_nearby_road_message='لا يوجد مسار مشاة قريب من إحدى النقطتين',
    )
