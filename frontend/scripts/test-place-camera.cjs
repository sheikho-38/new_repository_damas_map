const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');

const source = ts.createSourceFile('MapViewer.tsx', fs.readFileSync('src/components/MapViewer.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect, close;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('const circleLayer')) effect = node.arguments[0].getText(source);
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'closePlace') close = node.initializer.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(effect && close);
let camera = { center: [36.28, 33.51], zoom: 12.25, bearing: 23, pitch: 30, padding: {left: 12, right: 8, top: 20, bottom: 4} };
const original = structuredClone(camera);
let flights = 0;
const map = {
  isStyleLoaded: () => true, getLayer: () => null, getSource: () => null,
  stop() {}, getCenter: () => ({toArray: () => [...camera.center]}), getZoom: () => camera.zoom,
  getBearing: () => camera.bearing, getPitch: () => camera.pitch, getPadding: () => camera.padding,
  flyTo(options) { flights++; for (const key of Object.keys(camera)) if (key in options) camera[key] = options[key]; },
};
const scope = {
  mapInstanceRef: {current: map}, placeCameraRef: {current: null}, focusedPlaceRef: {current: null},
  selectedPlace: {id: 1, location: {longitude:36.30, latitude:33.52}}, window: {innerWidth:1280},
  setSelectedPlace(value) { scope.selectedPlace = value; },
};
vm.createContext(scope);
const compile = code => ts.transpileModule(`(${code})`, {compilerOptions: {target: ts.ScriptTarget.ES2020}}).outputText;
const runEffect = vm.runInContext(compile(effect), scope);
const closePlace = vm.runInContext(compile(close), scope);
runEffect();
assert.equal(camera.zoom,17.5);
assert.equal(flights,1);
runEffect();
assert.equal(flights,1,'Detail API hydration must not restart the zoom');
scope.selectedPlace = {id:2,location:{longitude:36.31,latitude:33.53}};
runEffect();
assert.equal(flights,2);
closePlace();
assert.equal(JSON.stringify(camera),JSON.stringify(original),'Restore full camera before the first place selection');
assert.equal(scope.selectedPlace,null);
runEffect();
assert.equal(scope.placeCameraRef.current,null);
console.log('PASS: selection without POI layers, no duplicate zoom, switching places, full camera restoration.');
