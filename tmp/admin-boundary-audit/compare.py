import json
import sys
from pathlib import Path
from shapely.geometry import LineString, shape
from shapely.ops import polygonize, unary_union

sys.stdout.reconfigure(encoding='utf-8')
work = Path(__file__).parent
db = json.loads((work / 'database-before.json').read_text(encoding='utf-8'))
osm = json.loads((work / 'osm-boundaries.json').read_text(encoding='utf-8'))
candidates = []
for relation in osm['elements']:
    try:
        rings = {}
        for role in ['outer', 'inner']:
            lines = [LineString([(p['lon'], p['lat']) for p in member['geometry']])
                     for member in relation['members']
                     if member['type'] == 'way' and member.get('role', 'outer') == role]
            rings[role] = unary_union(list(polygonize(lines)))
        geometry = rings['outer'].difference(rings['inner'])
        if geometry.is_empty or not geometry.is_valid:
            continue
        candidates.append((relation, geometry))
    except (KeyError, ValueError):
        pass
results = []
for area in db:
    original = shape(area['boundary'])
    ranked = []
    for relation, geometry in candidates:
        if int(relation['tags']['admin_level']) != area['level'] or not original.intersects(geometry):
            continue
        iou = original.intersection(geometry).area / original.union(geometry).area
        ranked.append((iou, relation, geometry))
    if not ranked:
        print('NO MATCH', area['id'], area['name_ar'])
        continue
    iou, relation, geometry = max(ranked, key=lambda x: x[0])
    result = {'id':area['id'], 'name':area['name_ar'], 'osm_id':relation['id'],
              'osm_name':relation['tags']['name'], 'iou':round(iou, 5),
              'max_boundary_distance_approx_m':round(original.hausdorff_distance(geometry)*100000, 1)}
    results.append(result)
    print(json.dumps(result, ensure_ascii=False))
(work / 'comparison.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
