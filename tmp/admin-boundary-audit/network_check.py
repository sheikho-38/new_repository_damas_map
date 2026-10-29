exec(open('tmp/admin-boundary-audit/inspect_current.py',encoding='utf-8').read().split('for area in db:')[0])
all_lines = [line for e in osm if e['type']=='relation' for line in lines(e)]
network = unary_union(all_lines)
faces = list(polygonize_full(network)[0].geoms)
print('Planar faces:',len(faces))
for e in osm:
    if e['type']!='relation' or e['tags'].get('admin_level')!='10':continue
    ls=lines(e)
    ps,_,ds,iv=polygonize_full(ls)
    if len(ps.geoms) and not len(ds.geoms) and not len(iv.geoms):continue
    linework=unary_union(ls)
    ranked=sorted(((linework.intersection(face.boundary.buffer(1e-9)).length/linework.length,face) for face in faces),key=lambda t:-t[0])
    print(e['id'],e['tags']['name'],'coverage',[(round(v,5),round(g.area,8)) for v,g in ranked[:3]])
