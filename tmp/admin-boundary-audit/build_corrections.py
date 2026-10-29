exec(open('tmp/admin-boundary-audit/plan_geometry.py', encoding='utf-8').read().split("print('matched'")[0])
import hashlib
from shapely.geometry import mapping
from shapely.geometry.polygon import orient

root=Path(__file__).resolve().parents[2]
data=json.loads((root/'backend/data/damascus_admin_areas.geojson').read_text(encoding='utf-8'))
original_data=json.loads((root/'backend/data/damascus_admin_areas.geojson').read_text(encoding='utf-8'))
features={f['properties']['id']:f for f in data['features']}
old_features={f['properties']['id']:f for f in original_data['features']}
assert set(features)=={a['id'] for a in db}

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

# Current complete OSM relations take priority over archived closed rings.
# Trimming only removes overlap; it does not invent or shift any boundary vertex.
current_union=unary_union([g for aid,g in geometries.items() if aid not in fallback])
trimmed={}
for aid in fallback:
    before=geometries[aid]
    after=before.difference(current_union)
    assert after.is_valid and not after.is_empty and after.geom_type in ['Polygon','MultiPolygon']
    assert after.area/before.area > .99, (aid,'Unexpectedly large historical/current conflict')
    trimmed[aid]=before.area-after.area
    geometries[aid]=after

for area in db:
    if area['level']==9:
        children=[a for a in db if a['parent_id']==area['id']]
        assert children,area['id']
        geometries[area['id']]=unary_union([geometries[c['id']] for c in children])

neighborhoods=[a for a in db if a['level']==10]
for i,a in enumerate(neighborhoods):
    for b in neighborhoods[i+1:]:
        assert geometries[a['id']].intersection(geometries[b['id']]).area < 1e-14, (a['id'],b['id'],'overlap')
for area in db:
    g=geometries[area['id']]
    assert g.is_valid and not g.is_empty
    if area['level']==10:
        assert g.difference(geometries[area['parent_id']]).area < 1e-14

manifest={'created_at':'2026-10-29','source':'OpenStreetMap','osm_snapshot':current['osm3s']['timestamp_osm_base'],
          'historical_snapshot':'2025-01-01T00:00:00Z','changes':[]}
for area in db:
    aid=area['id'];g=geometries[aid];f=features[aid]
    parts=list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
    assert all(p.geom_type=='Polygon' for p in parts)
    new_geometry={'type':'MultiPolygon','coordinates':[mapping(orient(p,sign=1))['coordinates'] for p in parts]}
    new_geometry=json.loads(json.dumps(new_geometry))
    f['geometry']=new_geometry
    if area['level']==10:
        source={'type':'osm_relation','relation_id':matches[aid],
                'url':f'https://www.openstreetmap.org/relation/{matches[aid]}',
                'snapshot':manifest['historical_snapshot'] if aid in fallback else manifest['osm_snapshot'],
                'trimmed_to_current_neighbors':trimmed.get(aid,0)>1e-14}
    else:
        source={'type':'union_of_osm_neighborhoods','child_ids':[a['id'] for a in db if a['parent_id']==aid],
                'note':'Existing service-district membership retained; OSM municipality levels/names are not substituted.'}
    f['properties']['boundary_source']=source
    manifest['changes'].append({'id':aid,'name_ar':area['name_ar'],'level':area['level'],'parent_id':area['parent_id'],
                                'before_sha256':digest(area['boundary']),'after_sha256':digest(new_geometry),
                                'area_change_percent':round((g.area/shape(area['boundary']).area-1)*100,4),
                                'source':source})

data['attribution']='© OpenStreetMap contributors'
data['license']='https://opendatacommons.org/licenses/odbl/1-0/'
data['boundary_revision']='2026-10-29-osm'
(root/'backend/data/damascus_admin_areas.geojson').write_text(json.dumps(data,ensure_ascii=False,indent=4)+'\n',encoding='utf-8')
(root/'frontend/public/data/damascus_admin_areas.geojson').write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
(root/'backend/data/admin_boundary_corrections.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

report=[
    '# تصحيح حدود دمشق وفق OSM — 2026-10-29','',
    '- تصحيح 98 حياً، وإعادة تجميع دوائر الخدمات الـ16 من أحيائها الحالية؛ المعرّفات والأسماء وعلاقات الأبوة لم تتغير.',
    '- 90 حياً من لقطة OSM الحالية: `'+manifest['osm_snapshot']+'`.',
    '- 8 أحياء من لقطة OSM بتاريخ 2025-01-01، لأن علاقاتها الحالية غير مغلقة. أزيلت التداخلات الصغيرة مع الحدود الحالية لصالح المصدر الحالي (أقل من 1% من كل حي). لم تطبق إزاحة ثابتة أو توصيلات مستقيمة تخمينية.',
    '- حدود دوائر الخدمات مشتقة من تجميع أحيائها؛ لا تُعرض باعتبارها نسخة رسمية من بلديات OSM، لأن تقسيمات الخدمة في المشروع تختلف عن تقسيمات البلديات في OSM.',
    '- اجتازت المضلعات فحص الصلاحية وعدم التداخل بين الأحياء واحتواء كل دائرة لجميع أحيائها. مصدر الواجهة يبقى PostgreSQL عبر API؛ ملفات GeoJSON هنا بذور استيراد ونسخة مرجعية فقط.',
    '- [المصدر والترخيص: © OpenStreetMap contributors — ODbL](https://www.openstreetmap.org/copyright).','',
    '## المثالان المطلوبان','',
    '- دمشق القديمة: الحدود الجديدة تطابق اتحاد أحياء OSM وبلدية دمشق القديمة الحالية، وتُظهر المقارنة توافق الحد الغربي مع شارع سعد زغلول والشرقي مع شارع ابن عساكر. [علاقة البلدية](https://www.openstreetmap.org/relation/13442508).',
    '- جوبر: تغير في الشكل والمساحة، وليس نقل مضلع كامل؛ تقل المساحة بنحو 3.46%. اتحاد الأحياء يطابق بلدية OSM الحالية بنسبة تداخل تقارب 99.99%. [علاقة البلدية](https://www.openstreetmap.org/relation/13438168).',
    '- [صورة مقارنة الحدود القديمة والجديدة مع الشوارع](tmp/admin-boundary-audit/boundary-comparison.png).','',
    '## الأحياء التي استخدمت نسخة تاريخية','',
]
for aid in fallback:
    area=next(a for a in db if a['id']==aid)
    report.append(f"- {area['name_ar']} (`{aid}`): [OSM {matches[aid]}](https://www.openstreetmap.org/relation/{matches[aid]}).")
report+=['','## تطبيق التغيير والتراجع','',
         'الأمر `python manage.py apply_admin_boundary_corrections --dry-run` يتحقق من بصمة الحدود الحالية ومن ثبات الهوية قبل التحديث. للتطبيق يلزم `--backup PATH`؛ يكتب نسخة من الحدود القديمة ثم يحدث حقل boundary فقط داخل معاملة واحدة. إعادة تشغيله بعد النجاح لا تعدل شيئاً.',
         'الملف `backend/data/admin_boundary_corrections.json` يسجل مصدر كل حي وبصمتي الهندسة قبل التصحيح وبعده. نسخة قاعدة البيانات قبل التعديل محفوظة في `backend/data/backups/admin_boundaries_before_osm_2026-10-29.json` بعد التطبيق.']
(root/'تقرير_تصحيح_الحدود_وفق_OSM.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
print('Built 114 corrected boundaries. 98 valid, disjoint neighborhoods; 16 exact child unions. Historical sources:',fallback)
