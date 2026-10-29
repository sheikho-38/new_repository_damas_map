import json
import re
import sys
from pathlib import Path
from shapely.geometry import LineString, shape
from shapely.ops import polygonize_full, unary_union

sys.stdout.reconfigure(encoding='utf-8')
work=Path(__file__).parent
db=json.loads((work/'database-current.json').read_text(encoding='utf-8'))
current=json.loads((work/'osm-current.json').read_text(encoding='utf-8'))
history=json.loads((work/'osm-history.json').read_text(encoding='utf-8'))
relations={e['id']:e for e in current['elements'] if e['type']=='relation'}
historic={e['id']:e for e in history['elements']}

def geometry(e):
    groups={}
    for role in ['outer','inner']:
        lines=[LineString([(p['lon'],p['lat']) for p in m['geometry']]) for m in e['members'] if m['type']=='way' and m['role']==role]
        polys,cuts,dangles,invalid=polygonize_full(lines)
        if cuts or dangles or invalid:raise ValueError('Open OSM relation')
        groups[role]=unary_union(list(polys.geoms))
    result=groups['outer'].difference(groups['inner'])
    if result.is_empty or not result.is_valid:raise ValueError('Invalid OSM polygon')
    return result

def norm(name):
    name=name.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ة','ه').replace('ى','ي')
    return re.sub(r'\s+', '',name.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')))

aliases={398:13338933,432:13384308,439:14043003,448:13298994,454:14041924,457:13359473,461:13338934,462:13360833,464:13433880}
geometries={}; matches={}; fallback=[]
for area in db:
    if area['level']!=10:continue
    match=relations.get(aliases.get(area['id']))
    if match is None:
        found=[e for e in relations.values() if e['tags']['admin_level']=='10' and norm(area['name_ar'])==norm(e['tags']['name'])]
        assert len(found)==1,(area['id'],area['name_ar'],len(found))
        match=found[0]
    try:g=geometry(match)
    except ValueError:
        g=geometry(historic[match['id']]);fallback.append(area['id'])
    matches[area['id']]=match['id'];geometries[area['id']]=g
print('matched',len(matches),'historical',fallback)
for area in db:
    if area['level']!=9:continue
    children=[a for a in db if a['parent_id']==area['id']]
    union=unary_union([geometries[c['id']] for c in children])
    old=shape(area['boundary'])
    print(area['id'],area['name_ar'],'old/new area',old.area,union.area,'ratio',round(union.area/old.area,4))
    if area['id'] in [362,360]:
        exact=geometry(relations[{362:13442508,360:13438168}[area['id']]])
        print('  vs current OSM municipality IoU',union.intersection(exact).area/union.union(exact).area)
    geometries[area['id']]=union

neighborhoods=[a for a in db if a['level']==10]
overlaps=[]
for i,a in enumerate(neighborhoods):
    for b in neighborhoods[i+1:]:
        overlap=geometries[a['id']].intersection(geometries[b['id']]).area
        if overlap>1e-10:overlaps.append((a['id'],b['id'],round(overlap*1e10)))
print('Overlap approx m2:',overlaps)
