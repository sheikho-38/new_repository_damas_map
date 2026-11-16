const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');

// Exercise the actual marker-rendering block, including replacement cleanup.
const source = fs.readFileSync('src/components/MapViewer.tsx', 'utf8');
const start = source.indexOf('routingMarkersRef.current.forEach', source.indexOf('const handleApplyRouteGeoJSON'));
const end = source.indexOf('// ملاءمة حدود الخريطة', start);
assert.ok(start >= 0 && end > start);
const markers = { current: [] };
class Marker {
  constructor({ element, anchor, offset }) { Object.assign(this, { element, anchor, offset }); }
  setLngLat(value) { this.coordinates = value; return this; }
  addTo() { return this; }
  remove() { this.removed = true; }
}
const scope = {
  map: {}, routingMarkersRef: markers, maplibreglRef: { current: { Marker } },
  document: { createElement: () => ({
    style: {}, children: [], setAttribute() {}, append(...children) { this.children.push(...children); },
  }) },
};
const render = vm.runInNewContext(ts.transpileModule(`(result => {${source.slice(start, end)}})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const transfer = [36.276, 33.513];
const result = {
  start: { longitude: 36.27, latitude: 33.51 }, end: { longitude: 36.29, latitude: 33.52 },
  recommended_mode: 'transit',
  route_legs: [
    { mode: 'bus', line_name: 'الخط الأول', boarding: [36.271, 33.51], alighting: transfer },
    { mode: 'walk' },
    { mode: 'bus', line_name: 'الخط الثاني', boarding: transfer, alighting: [36.289, 33.52] },
  ],
};
render(result);
assert.equal(markers.current.length, 6, 'both ends and every bus boarding/alighting must be drawn');
const atTransfer = markers.current.filter(marker => marker.coordinates === transfer);
assert.equal(atTransfer.length, 2, 'coincident transfer points must both remain visible');
const labels = atTransfer.map(marker => marker.element);
assert.equal(labels[0].textContent, 'نزول');
assert.equal(labels[1].textContent, 'صعود');
assert.ok(labels.every(label => label.children.length === 0), 'compact badges without stems or extra dots');
assert.equal(atTransfer[0].anchor, 'top');
assert.equal(atTransfer[1].anchor, 'bottom');
assert.equal(atTransfer[0].offset[1] - atTransfer[1].offset[1], 8, 'small 8px gap at coincident stops');
assert.match(atTransfer[1].element.title, /الخط الثاني/);
const previous = [...markers.current];
render({ ...result, recommended_mode: 'walk' });
assert.equal(markers.current.length, 2, 'walking alternative must remove bus markers');
assert.ok(previous.every(marker => marker.removed));
render({ ...result, route_legs: [], boarding: transfer, alighting: [36.28, 33.52] });
assert.equal(markers.current.length, 4, 'older single-bus responses remain supported');
console.log('PASS: intermediate transfers, coincident labels, replacement cleanup, walking and legacy responses.');
