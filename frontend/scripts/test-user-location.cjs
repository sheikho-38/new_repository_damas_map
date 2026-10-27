const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function run() {
  const slots = [];
  let cursor = 0;
  const effects = [];
  const markers = [];
  const requests = [];
  const cleared = [];
  const intervals = new Map();
  const timeouts = new Map();
  let timer = 0;
  let permissionChange;
  const permission = {
    state: 'prompt',
    addEventListener: (_, callback) => { permissionChange = callback; },
    removeEventListener: () => { permissionChange = null; },
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ||= { current: initial };
    },
    useEffect(effect) { if (!effects.length) effects.push(effect); },
  };
  class Marker {
    constructor({ element }) { this.element = element; markers.push(this); }
    getElement() { return this.element; }
    setLngLat(coords) { this.coords = coords; return this; }
    addTo() { return this; }
    remove() { this.removed = true; }
  }
  const scope = {
    exports: {},
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'maplibre-gl') return { Marker };
      return require(name);
    },
    navigator: {
      permissions: { query: async () => permission },
      geolocation: {
        watchPosition(ok, fail) { requests.push({ ok, fail }); return requests.length; },
        getCurrentPosition(ok, fail) { requests.push({ ok, fail }); },
        clearWatch(id) { cleared.push(id); },
      },
    },
    window: { isSecureContext: true },
    document: { createElement: () => ({ style: {}, setAttribute() {} }) },
    setTimeout(fn) { timeouts.set(++timer, fn); return timer; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn) { intervals.set(++timer, fn); return timer; },
    clearInterval(id) { intervals.delete(id); },
  };
  const source = fs.readFileSync('src/components/UserLocationButton.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, scope);
  const map = { getMaxBounds: () => null, getZoom: () => 12, flyTo() {} };
  function render() { cursor = 0; return scope.exports.default({ map }); }
  function click() { render().props.children.find(child => child?.type === 'button').props.onClick(); }
  render();
  const dispose = effects[0]();
  await Promise.resolve();
  assert.equal(requests.length, 0, 'No location request before user clicks');
  assert.equal(markers.length, 0, 'No fabricated initial location');
  click();
  requests[0].fail({ code: 1 });
  assert.equal(markers.length, 0, 'Denied initial permission leaves map empty');
  click();
  const position = { coords: { latitude: 33.51, longitude: 36.30 } };
  requests[1].ok(position);
  assert.equal(markers[0].element.style.backgroundColor, '#2563eb');
  assert.equal(markers[0].coords[0], 36.30);
  // OS service failure is detected by a fresh periodic position request.
  [...intervals.values()][0]();
  requests[2].fail({ code: 2 });
  assert.equal(markers[0].element.style.backgroundColor, '#9ca3af');
  requests[2].ok(position);
  assert.equal(markers[0].element.style.backgroundColor, '#2563eb');
  permission.state = 'denied';
  permissionChange();
  assert.equal(markers[0].element.style.backgroundColor, '#9ca3af');
  requests[1].ok(position);
  assert.equal(markers[0].element.style.backgroundColor, '#9ca3af', 'Late callback cannot revive revoked location');
  assert.equal(intervals.size, 0);
  permission.state = 'granted';
  click();
  requests.at(-1).ok(position);
  assert.equal(markers.length, 1, 'Reuse the existing location marker');
  assert.equal(markers[0].element.style.backgroundColor, '#2563eb');
  dispose();
  assert.ok(markers[0].removed);
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  assert.ok(cleared.length >= 2);
  console.log('PASS: opt-in, denied permission, live position, OS failure, revoked permission, recovery, cleanup.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
