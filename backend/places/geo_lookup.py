import math

from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import AdminArea, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX


class AdminAreaLookupThrottle(AnonRateThrottle):
    scope = 'admin-area-lookup'
    rate = '120/min'


def _in_ring(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_polygon(lon, lat, polygon):
    # polygon = [outer_ring, hole_1, hole_2, ...]
    if not polygon or not _in_ring(lon, lat, polygon[0]):
        return False
    return not any(_in_ring(lon, lat, hole) for hole in polygon[1:])


def point_in_geometry(lon, lat, geometry):
    if not isinstance(geometry, dict):
        return False
    coords = geometry.get('coordinates') or []
    if geometry.get('type') == 'Polygon':
        return _in_polygon(lon, lat, coords)
    if geometry.get('type') == 'MultiPolygon':
        return any(_in_polygon(lon, lat, polygon) for polygon in coords)
    return False


def find_admin_area(lon, lat):
    # الحي (مستوى 10) أولاً، وإذا لم يوجد نرجع للبلدية (مستوى 9)
    for level in (10, 9):
        for area in AdminArea.objects.filter(level=level).only('id', 'name_ar', 'boundary'):
            if point_in_geometry(lon, lat, area.boundary):
                return area
    return None


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([AdminAreaLookupThrottle])
def lookup_admin_area(request):
    try:
        lat = float(request.query_params['lat'])
        lon = float(request.query_params['lon'])
    except (KeyError, ValueError):
        raise serializers.ValidationError({'detail': 'lat و lon مطلوبان ويجب أن يكونا أرقامًا.'})
    if not (math.isfinite(lat) and math.isfinite(lon) and LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
        return Response({'admin_area': None})
    area = find_admin_area(lon, lat)
    return Response({'admin_area': {'id': area.id, 'name_ar': area.name_ar} if area else None})