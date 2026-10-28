import json
import math
import subprocess
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union

root = Path(__file__).resolve().parents[2]
work = root / 'tmp/osm-landmarks'
target = root / 'frontend/public/data/damascus_permanent_landmarks.geojson'
data = json.loads(target.read_text(encoding='utf-8'))
original = json.loads(subprocess.check_output(['git', 'show', 'HEAD:frontend/public/data/damascus_permanent_landmarks.geojson'], cwd=root))
matches = json.loads((work / 'matches.json').read_text())
response = json.loads((work / 'matched-elements.json').read_text(encoding='utf-8'))
elements = {(e['type'], e['id']): e for e in response['elements']}
center_response = json.loads((work / 'candidates.json').read_text(encoding='utf-8'))
centers = {(e['type'], e['id']): e for e in center_response['elements']}
response['osm3s']['timestamp_osm_base'] = center_response['osm3s']['timestamp_osm_base']

def polygon(geometry):
    coords = [(p['lon'], p['lat']) for p in geometry]
    assert coords[0] == coords[-1], 'An open way cannot be treated as a polygon'
    shape = Polygon(coords)
    assert shape.is_valid and not shape.is_empty
    return shape

def point_for(element):
    source = centers[(element['type'], element['id'])]
    if element['type'] == 'node':
        assert source['lon'] == element['lon'] and source['lat'] == element['lat']
        return [source['lon'], source['lat']], 'osm_node'
    center = source['center']
    bounds = element['bounds']
    assert abs(center['lon'] - (bounds['minlon'] + bounds['maxlon']) / 2) < 1e-7
    assert abs(center['lat'] - (bounds['minlat'] + bounds['maxlat']) / 2) < 1e-7
    return [center['lon'], center['lat']], 'osm_overpass_center'

def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, [*a, *b])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return round(6371000 * 2 * math.asin(math.sqrt(h)), 1)

notes = {
    14733: 'مطابقة جبل قاسيون مع عقدة القمة؛ ليست نقطة إطلالة سياحية محددة. تتضمن عقدة OSM ملاحظة حول تسمية القمة.',
    10809: 'اختير مبنى رئاسة جامعة دمشق بحسب بند «مبنى جامعة دمشق». الموقع القديم كان مجمع الطب والآداب وليس البرامكة.',
    14742: 'مطابقة المدينة الرياضية كاملة، وليس صالة الفيحاء وحدها.',
    14746: 'لم توجد مطابقة مستقلة للساحة؛ يوجد باب شرقي التاريخي لكن لم يُستخدم بديلاً عن الساحة.',
    14747: 'لم توجد مطابقة مؤكدة لساحة الجلاء؛ لم تُستبدل بشارع الجلاء أو الحديقة.',
    14748: 'بقيت دون تغيير بطلب المستخدم؛ الحديقة البيئية قرب القلعة ليست الحديقة المقصودة في المزة.',
}
rows = []
for feature in data['features']:
    props = feature['properties']
    local_id = props['id']
    before = next(f['geometry']['coordinates'][:] for f in original['features'] if f['properties']['id'] == local_id)
    match = matches.get(str(local_id))
    if match:
        element = elements[tuple(match)]
        coords, method = point_for(element)
        feature['geometry']['coordinates'] = coords
        props.update({
            'coordinate_source': 'OpenStreetMap',
            'osm_type': element['type'],
            'osm_id': element['id'],
            'osm_url': f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
            'osm_version': element['version'],
            'osm_timestamp': element['timestamp'],
            'coordinate_method': method,
            'coordinate_status': 'osm_matched',
            'source_checked_at': response['osm3s']['timestamp_osm_base'],
        })
        if local_id == 10809:
            props['title'] = 'مبنى رئاسة جامعة دمشق'
            props['title_en'] = 'Damascus University Head Office'
            props['description'] = 'مبنى رئاسة جامعة دمشق، وفق الموقع الموثق في OpenStreetMap.'
        elif local_id == 14733:
            props['title'] = 'جبل قاسيون'
            props['title_en'] = 'Mount Qasioun'
            props['description'] = 'جبل قاسيون المطل على دمشق؛ تمثل النقطة موقع القمة المسجلة في OpenStreetMap.'
        source = f"[{element['type']}/{element['id']}]({props['osm_url']})"
    else:
        props['coordinate_status'] = 'unverified_unchanged'
        source = 'غير مؤكد — بقيت الإحداثيات السابقة'
    after = feature['geometry']['coordinates']
    assert 36.15 < after[0] < 36.45 and 33.40 < after[1] < 33.60
    rows.append(f"| {props['title']} | {local_id} | `{before}` | `{[round(v, 7) for v in after]}` | {distance(before, after)} | {source} |")

data['source'] = 'OpenStreetMap contributors; see per-feature coordinate_status for unmatched legacy points'
data['license'] = 'https://opendatacommons.org/licenses/odbl/1-0/'
data['attribution'] = '© OpenStreetMap contributors'
data['osm_data_timestamp'] = response['osm3s']['timestamp_osm_base']
assert len(data['features']) == 42
assert [f['properties']['id'] for f in data['features']] == [f['properties']['id'] for f in original['features']]
for old, new in zip(original['features'], data['features']):
    for key in ['tier', 'type', 'category_slug', 'icon', 'color']:
        assert old['properties'][key] == new['properties'][key]
    if new['properties']['coordinate_status'] == 'unverified_unchanged':
        assert old['geometry'] == new['geometry']
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

report = [
    '# تدقيق إحداثيات معالم دمشق — OpenStreetMap', '',
    '- تاريخ الجلب: 2026-10-28. لقطة OSM: `' + response['osm3s']['timestamp_osm_base'] + '`.',
    '- النتيجة: تحديث 39 معلماً من أصل 42، والإبقاء على 3 معالم غير مؤكدة دون تعديل إحداثياتها.',
    '- الملف المستخدم فعلياً: `frontend/public/data/damascus_permanent_landmarks.geojson`.',
    '- حُفظت المعرّفات الداخلية وخصائص الأيقونات والفئات ومستويات العرض. معرّفات OSM منفصلة عن معرّفات قاعدة البيانات.',
    '- استُخدمت إحداثيات عقد OSM مباشرة، وللمساحات نُسخت قيمة `center` من استجابة Overpass دون حساب مركز بديل أو إضافة إزاحة. هذه القيمة مركز مستطيل إحاطة العنصر وليست بالضرورة نقطة داخل المبنى أو مدخله.',
    '- هذه نقاط تمثيلية للعرض، وليست مواقع مداخل أو إحداثيات مساحية معتمدة. الإحداثيات بترتيب `[longitude, latitude]`.',
    '- المصدر والترخيص: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright)، ODbL.',
    '', '## حالات تحتاج الانتباه', '',
] + [f'- `{key}`: {value}' for key, value in notes.items()] + [
    '', '## المطابقات والتغييرات', '',
    '| المعلم | المعرّف الداخلي | الإحداثيات السابقة | الإحداثيات الجديدة | المسافة بالمتر | مصدر OSM |',
    '|---|---|---|---|---|---|',
] + rows
(root / 'تقرير_مطابقة_معالم_دمشق.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
print('Updated 39 matched landmarks with exact OSM node/Overpass center coordinates; preserved 3 unresolved points. Validated IDs, styles and source coordinates.')
