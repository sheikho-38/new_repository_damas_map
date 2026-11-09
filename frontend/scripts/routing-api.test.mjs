import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRoutingResult } from '../src/lib/routing-api.ts';

const origin = { lat: 33.5132, lon: 36.2954, title: 'البداية' };
const destination = { lat: 33.5138, lon: 36.3127, title: 'الوجهة' };

test('routing request sends lon/lat correctly and keeps actual geometry', async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url, options) => {
    requested = { url, options };
    return { ok: true, json: async () => ({
      mode: 'car', steps: [], distance_m: 3445, duration_seconds: 450,
      route_geojson: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[36.2954, 33.5132], [36.3127, 33.5138]] } },
    }) };
  };
  try {
    const controller = new AbortController();
    const result = await fetchRoutingResult('http://localhost:8000/api', origin, destination, 'car', controller.signal);
    const url = new URL(requested.url);
    assert.equal(url.searchParams.get('start_lon'), '36.2954');
    assert.equal(url.searchParams.get('end_lat'), '33.5138');
    assert.equal(requested.options.signal, controller.signal);
    assert.equal(result.distance_m, 3445);
    assert.deepEqual(result.route_geojson.geometry.coordinates[0], [36.2954, 33.5132]);
  } finally { globalThis.fetch = originalFetch; }
});

test('routing failure does not return a fabricated line', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'لا يوجد طريق' }) });
  try {
    await assert.rejects(fetchRoutingResult('/api', origin, destination, 'car', new AbortController().signal), /لا يوجد طريق/);
  } finally { globalThis.fetch = originalFetch; }
});

test('route request propagates cancellation when destination changes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  try {
    const controller = new AbortController();
    const result = fetchRoutingResult('/api', origin, destination, 'car', controller.signal);
    controller.abort();
    await assert.rejects(result, { name: 'AbortError' });
  } finally { globalThis.fetch = originalFetch; }
});
