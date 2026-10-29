import json
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

query = '''[out:json][timeout:90];(
relation["boundary"="administrative"]["admin_level"~"^(8|9|10)$"](33.43,36.17,33.58,36.38);
way["highway"]["name"~"ابن عساكر|سعد زغلول"](33.48,36.28,33.53,36.34);
);out meta geom;'''
historical = len(sys.argv) > 1 and sys.argv[1] == '--history'
if historical:
    ids = [13333332,13338690,13338691,13438164,13438166,13438167,14041956,14041957]
    query = '[out:json][timeout:90][date:"2025-01-01T00:00:00Z"];relation(id:' + ','.join(map(str,ids)) + ');out meta geom;'
request = Request('https://overpass-api.de/api/interpreter',
                  data=urlencode({'data': query}).encode(),
                  headers={'User-Agent': 'DamascusEvidence/1.0 boundary reconciliation'})
with urlopen(request, timeout=100) as response:
    data = json.load(response)
if data.get('remark'):
    raise RuntimeError(data['remark'])
path = Path(__file__).parent / ('osm-history.json' if historical else 'osm-current.json')
path.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
print('Saved', len(data['elements']), 'elements', data['osm3s']['timestamp_osm_base'])
