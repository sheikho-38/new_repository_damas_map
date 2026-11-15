const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

let cursor = 0;
const slots = [];
const effects = [];
const watches = [];
const cleared = [];
const timers = new Map();
let nextTimer = 0;
let marker;
let flown;
let onVisibility;
let probe;

const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = value; }];
  },
  useRef(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  },
  useCallback(fn) { return fn; },
  useEffect(fn) { effects.push(fn); },
};
class Marker {
  constructor({ element }) { marker = this; this.element = element; }
  getElement() { return this.element; }
  setLngLat(value) { this.coords = value; return this; }
  addTo() { return this; }
  remove() { this.removed = true; }
}
const scope = {
  exports: {},
  require: name => name === 'react' ? react : name === 'maplibre-gl' ? { Marker } : require(name),
  navigator: { geolocation: {
    watchPosition(ok, fail) { watches.push({ ok, fail }); return watches.length; },
    getCurrentPosition(ok, fail) { probe = { ok, fail }; },
    clearWatch(id) { cleared.push(id); },
  } },
  window: {
    isSecureContext: true,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  },
  document: {
    createElement: () => ({ style: {}, setAttribute() {} }),
    visibilityState: 'visible',
    addEventListener(_, callback) { onVisibility = callback; },
    removeEventListener() { onVisibility = null; },
  },
  Date, Error, Set,
};
const source = fs.readFileSync('src/components/useUserLocation.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const map = { getZoom: () => 12, flyTo(value) { flown = value; }, easeTo() {} };
function render() { cursor = 0; effects.length = 0; return scope.exports.useUserLocation(map); }
function position(lat, accuracy = 20) {
  return { coords: { latitude: lat, longitude: 36.3, accuracy }, timestamp: Date.now() };
}

(async () => {
  let hook = render();
  effects[0]();
  const dispose = effects[1]();
  assert.equal(watches.length, 1, 'one automatic location watch at startup');
  watches[0].ok(position(33.51));
  hook = render();
  watches[0].ok(position(33.52, 500));
  assert.equal((await hook.requestFreshPosition()).lat, 33.51, 'weak fix must not replace good fix');
  assert.equal(marker.element.style.backgroundColor, '#2563eb');
  assert.equal(watches.length, 1, 'routing must reuse the location without asking again');
  watches[0].fail({ code: 3 });
  assert.equal(marker.element.style.backgroundColor, '#2563eb', 'stationary timeout keeps the fix');
  watches[0].fail({ code: 2 });
  hook = render();
  assert.equal(marker.element.style.backgroundColor, '#9ca3af');
  await assert.rejects(hook.requestFreshPosition(), /فعّلها على الجهاز/);
  const recovery = hook.locateAndFollow();
  assert.equal(watches.length, 2, 'manual retry starts a new watch');
  watches[0].ok(position(33.60));
  watches[1].ok(position(33.53));
  await recovery;
  hook = render();
  assert.equal((await hook.requestFreshPosition()).lat, 33.53);
  assert.equal(watches.length, 2);
  assert.equal(flown.center[1], 33.53);
  assert.equal(marker.element.style.backgroundColor, '#2563eb');
  onVisibility();
  probe.fail({ code: 2 });
  hook = render();
  await assert.rejects(hook.requestFreshPosition(), /فعّلها على الجهاز/);
  assert.equal(marker.element.style.backgroundColor, '#9ca3af');
  dispose();
  assert.ok(cleared.includes(1) && cleared.includes(2));
  console.log('PASS: one fix, routing reuse, weak fix, timeout, service recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });
