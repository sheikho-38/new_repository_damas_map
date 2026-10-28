exec(open('tmp/admin-boundary-audit/compare.py', encoding='utf-8').read().split('results = []')[0])
from shapely.affinity import translate
import statistics
offsets = []
for area in db:
    for relation, geometry in candidates:
        if area['name_ar'] != relation['tags']['name']:
            continue
        original = shape(area['boundary'])
        dx = geometry.centroid.x - original.centroid.x
        dy = geometry.centroid.y - original.centroid.y
        moved = translate(original, dx, dy)
        iou = moved.intersection(geometry).area / moved.union(geometry).area
        offsets.append((dx, dy, iou))
        print(area['id'], area['name_ar'], 'dx/dy degrees',round(dx,7),round(dy,7),'shifted IoU',round(iou,4))
print('MEDIAN',*[statistics.median(x[i] for x in offsets) for i in range(3)])
