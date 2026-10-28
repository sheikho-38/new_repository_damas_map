import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
elements = json.load(open('tmp/osm-landmarks/candidates.json', encoding='utf-8'))['elements']
for e in elements:
    tags = e['tags']
    names = ' '.join(v for k, v in tags.items() if 'name' in k).lower()
    if any(word in names for word in ['بانوراما', 'panorama', 'البيئة', 'البيئه', 'environment', 'ecolog', 'الجلاء', 'jala', 'باب شرقي', 'sharqi', 'برامكة', 'baram', 'قاسيون', 'kassioun']):
        print(e['type'], e['id'], e.get('center', {k:e.get(k) for k in ['lon','lat']}), json.dumps(tags, ensure_ascii=False))
