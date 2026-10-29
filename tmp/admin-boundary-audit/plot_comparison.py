exec(open('tmp/admin-boundary-audit/plan_geometry.py',encoding='utf-8').read().split("print('matched'")[0])
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

fig, axes=plt.subplots(1,2,figsize=(15,7),layout='constrained')
for ax,aid,title in zip(axes,[362,360],['Old Damascus service district','Jobar service district']):
    area=next(a for a in db if a['id']==aid)
    old=shape(area['boundary'])
    new=unary_union([geometries[a['id']] for a in db if a['parent_id']==aid])
    for geometry,color,style,label in [(old,'#dc2626','--','Before'),(new,'#064239','-','OSM')]:
        polygons=list(geometry.geoms) if geometry.geom_type=='MultiPolygon' else [geometry]
        for i,p in enumerate(polygons):
            x,y=p.exterior.xy;ax.plot(x,y,color=color,linestyle=style,linewidth=1.8,label=label if i==0 else None)
    if aid==362:
        used=set()
        for road in current['elements']:
            if road['type']!='way':continue
            name='Ibn Asakir' if 'عساكر' in road['tags']['name'] else 'Saad Zaghloul'
            color='#2563eb' if name=='Ibn Asakir' else '#ca8a04'
            xy=[(p['lon'],p['lat']) for p in road['geometry']]
            ax.plot(*zip(*xy),color=color,linewidth=2,label=name if name not in used else None);used.add(name)
        ax.set_xlim(36.298,36.320);ax.set_ylim(33.503,33.516)
    ax.set_aspect(1/0.834);ax.grid(alpha=.15);ax.legend();ax.set_title(title)
    ax.set_xlabel('Longitude');ax.set_ylabel('Latitude')
fig.savefig(work/'boundary-comparison.png',dpi=160)
print('Saved boundary-comparison.png')
