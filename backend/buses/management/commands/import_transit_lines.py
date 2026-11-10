import json
import math
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max
from django.conf import settings
from buses.road_align import align_line, load_roads
from buses.views import calculate_geometry
from places.models import Bus, BusRoute

DIRECTIONS = {'ذهاب': 'outbound', 'إياب': 'inbound'}


def load_features(path):
    text = Path(path).read_text(encoding='utf-8-sig')
    start, end = text.find('{'), text.rfind('}')
    if start == -1 or end == -1:
        raise CommandError('الملف لا يحتوي على JSON صالح.')
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError as exc:
        raise CommandError(f'JSON غير صالح: {exc}')
    return data.get('features') or []


def haversine(a, b):
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp, dl = p2 - p1, math.radians(b[0] - a[0])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


def to_linestring(geometry, label):
    geometry = geometry or {}
    coords = geometry.get('coordinates') or []
    if geometry.get('type') == 'MultiLineString':
        if len(coords) != 1:
            raise CommandError(f'{label}: الخط مكوّن من {len(coords)} أجزاء منفصلة، ادمجها في QGIS أولاً.')
        coords = coords[0]
    elif geometry.get('type') != 'LineString':
        raise CommandError(f'{label}: نوع الهندسة غير مدعوم ({geometry.get("type")}).')
    line = [[float(p[0]), float(p[1])] for p in coords]  # حذف أي ارتفاع Z
    if len(line) < 2:
        raise CommandError(f'{label}: الخط يحتاج نقطتين على الأقل.')
    for lon, lat in line:
        if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
            raise CommandError(f'{label}: إحداثيات خارج النطاق.')
    return {'type': 'LineString', 'coordinates': line}

def sample_waypoints(coords, step_m, max_points=120):
    # عيّنة نقاط موزعة على طول الخط (بالأمتار)، مع الإبقاء على أول وآخر نقطة
    total = sum(haversine(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
    step = max(step_m, total / (max_points - 1))
    out = [{'lon': coords[0][0], 'lat': coords[0][1]}]
    acc = 0
    for i in range(1, len(coords) - 1):
        acc += haversine(coords[i - 1], coords[i])
        if acc >= step:
            out.append({'lon': coords[i][0], 'lat': coords[i][1]})
            acc = 0
    out.append({'lon': coords[-1][0], 'lat': coords[-1][1]})
    return out

class Command(BaseCommand):
    help = 'Import transit lines (qgis2web/GeoJSON export) as Bus + BusRoute rows, like the dashboard route editor.'

    def add_arguments(self, parser):
        parser.add_argument('--file', required=True, help='مسار ملف _1.js أو GeoJSON')
        parser.add_argument('--color', default='#3a6962', help='لون الخط بصيغة #RRGGBB')
        parser.add_argument('--price', default=None, help='سعر الأجرة الحالي (اختياري)')
        parser.add_argument('--minutes', type=int, default=0, help='مدة الرحلة بالدقائق (0 = غير محددة)')
        parser.add_argument('--start', default='', help='نقطة بداية الذهاب (تُعكس للإياب)')
        parser.add_argument('--end', default='', help='نقطة نهاية الذهاب (تُعكس للإياب)')
        parser.add_argument('--align', action='store_true',
                            help='محاذاة الخط مع طرق خريطة المشروع (mbtiles) بدون BRouter')
        parser.add_argument('--align-max-dev', type=int, default=35,
                            help='أقصى مسافة (بالأمتار) تتحرك فيها النقطة نحو الطريق (الافتراضي 35)')
        parser.add_argument('--snap', action='store_true',
                            help='إلصاق الخط على طرق OSM عبر BRouter (يحتاج BRouter شغّال)')
        parser.add_argument('--snap-step', type=int, default=200,
                            help='المسافة بين نقاط الإلصاق بالأمتار (الافتراضي 200)')
        parser.add_argument('--dry-run', action='store_true', help='تجربة بدون حفظ')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['minutes'] < 0:
            raise CommandError('المدة لا يمكن أن تكون سالبة.')
        try:
            price = None if options['price'] in (None, '') else Decimal(str(options['price']))
        except InvalidOperation:
            raise CommandError('السعر غير صالح.')

        groups = {}
        for feature in load_features(options['file']):
            props = feature.get('properties') or {}
            name = str(props.get('اسم_الخط') or '').strip()
            direction = DIRECTIONS.get(str(props.get('اتجاه_الخط') or '').strip())
            if not name or not direction:
                raise CommandError(f'اسم الخط أو الاتجاه ناقص/غير معروف: {props}')
            if direction in groups.setdefault(name, {}):
                raise CommandError(f'الخط «{name}» فيه اتجاه مكرر ({direction}).')
            groups[name][direction] = feature
        if not groups:
            raise CommandError('لا توجد خطوط في الملف.')

        roads = None
        if options['align']:
            if options['snap']:
                raise CommandError('استعمل --align أو --snap وليس الاثنين معاً.')
            if not settings.MBTILES_PATH.is_file():
                raise CommandError(f'ملف الخريطة غير موجود: {settings.MBTILES_PATH}')
            all_pts = [p for dirs in groups.values() for feat in dirs.values()
                       for p in to_linestring(feat.get('geometry'), 'bbox')['coordinates']]
            bbox = (min(p[0] for p in all_pts), min(p[1] for p in all_pts),
                    max(p[0] for p in all_pts), max(p[1] for p in all_pts))
            roads, tiles_found = load_roads(settings.MBTILES_PATH, bbox)
            if not roads:
                raise CommandError('ما لقيت طرق بالخريطة ضمن منطقة الخطوط.')
            self.stdout.write(f'تم تحميل {len(roads)} مقطع طريق من {tiles_found} tile.')

        for name, directions in groups.items():
            bus = Bus.objects.select_for_update().filter(name=name).first()
            if bus is None:
                bus = Bus(name=name, color=options['color'], new_price=price, is_active=True)
                bus.full_clean()
                bus.save()
                self.stdout.write(f'+ باص جديد: {name}')
            elif not bus.is_active:
                raise CommandError(f'الباص «{name}» موجود لكنه غير نشط.')
            else:
                self.stdout.write(f'= الباص موجود مسبقاً: {name}')

            for direction, feature in directions.items():
                if BusRoute.objects.filter(bus=bus, direction=direction, is_active=True).exists():
                    self.stdout.write(self.style.WARNING(f'  تخطي {direction}: يوجد مسار نشط لهذا الاتجاه.'))
                    continue
                label = f'{name} ({direction})'
                geometry = to_linestring(feature.get('geometry'), label)
                props = feature.get('properties') or {}
                minutes = options['minutes']
                if options['snap']:
                    waypoints = sample_waypoints(geometry['coordinates'], options['snap_step'])
                    try:
                        snapped, distance, duration_s = calculate_geometry(waypoints)
                    except (RuntimeError, ValueError) as exc:
                        raise CommandError(f'{label}: فشل الإلصاق عبر BRouter: {exc}')
                    geometry = to_linestring(snapped, label)
                    minutes = minutes or max(0, round(duration_s / 60))
                elif options['align']:
                    try:
                        aligned, st = align_line(geometry['coordinates'], roads, max_dev=options['align_max_dev'])
                    except ValueError as exc:
                        raise CommandError(f'{label}: {exc}')
                    geometry = {'type': 'LineString', 'coordinates': aligned}
                    distance = sum(haversine(aligned[i], aligned[i + 1]) for i in range(len(aligned) - 1))
                    self.stdout.write(
                        f"  {direction}: طابقنا {st['matched_pct']}% من النقاط على الطرق، "
                        f"متوسط الإزاحة {st['mean_shift_m']} م، أقصاها {st['max_shift_m']} م")
                else:
                    try:
                        distance = float(props.get('SHAPE_Length'))
                    except (TypeError, ValueError):
                        distance = 0
                    if not distance > 0:
                        pts = geometry['coordinates']
                        distance = sum(haversine(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

                start, end = options['start'], options['end']
                if direction == 'inbound':
                    start, end = end, start
                version = (BusRoute.objects.filter(bus=bus, direction=direction)
                           .aggregate(m=Max('version'))['m'] or 0) + 1
                route = BusRoute(bus=bus, version=version, geometry=geometry, distance=distance,
                                 trip_time=minutes, direction=direction,
                                 start_point=start, end_point=end, is_active=True)
                route.full_clean()
                route.save()
                self.stdout.write(f'  + {direction}: {len(geometry["coordinates"])} نقطة، {distance / 1000:.2f} كم')

        if options['dry_run']:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING('تجربة فقط: لم يتم حفظ أي شيء.'))
        else:
            self.stdout.write(self.style.SUCCESS('تم الاستيراد.'))