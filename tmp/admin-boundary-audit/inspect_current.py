import json
import sys
from pathlib import Path
from shapely.geometry import LineString, shape
from shapely.ops import polygonize_full, unary_union

sys.stdout.reconfigure(encoding='utf-8')
work = Path(__file__).parent
db = json.loads((work/'database-current.json').read_text(encoding='utf-8'))
osm = json.loads((work/'osm-current.json').read_text(encoding='utf-8'))['elements']
def lines(e):
    return [LineString([(p['lon'],p['lat']) for p in m['geometry']]) for m in e['members'] if m['type']=='way' and m['role']=='outer']
parents = [(e,unary_union(list(polygonize_full(lines(e))[0].geoms))) for e in osm if e['type']=='relation' and e['tags'].get('admin_level')=='8']
for area in db:
    if area['level'] == 9:
        print('PARENT',area['id'],area['name_ar'],[(a['id'],a['name_ar']) for a in db if a['parent_id']==area['id']])
for e in osm:
    if e['type']!='relation' or e['tags'].get('admin_level')!='10':continue
    ls=lines(e)
    ps,_,ds,iv=polygonize_full(ls)
    if len(ps.geoms) and not len(ds.geoms) and not len(iv.geoms):continue
    area=next((a for a in db if a['name_ar']==e['tags']['name']),None)
    if not area:continue
    old=shape(area['boundary'])
    parent,pg=max(parents,key=lambda p: old.intersection(p[1]).area)
    pieces=list(polygonize_full(unary_union([pg.boundary,*ls]))[0].geoms)
    print('OPEN',e['id'],e['tags']['name'],'PARENT',parent['tags']['name'],'pieces',len(pieces))
    for p in pieces:
        if p.intersection(old).area > old.area*.1:
            covered=unary_union(ls).difference(p.boundary.buffer(1e-9)).length
            print('  area ratio',p.area/old.area,'old fraction',p.intersection(old).area/old.area,'missing input lines',covered)
