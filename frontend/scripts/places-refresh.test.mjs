import test from 'node:test';
import assert from 'node:assert/strict';
import { watchPlaces, PLACES_REFRESH_MS } from '../src/lib/places-refresh.ts';

test('place refresh pauses hidden tabs, prevents overlapping requests, resumes online and cleans up', async () => {
  const page = new EventTarget();
  page.hidden = false;
  const events = new EventTarget();
  let interval;
  let cleared = false;
  let calls = 0;
  let finish;
  const stop = watchPlaces(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, page, events, {
    setInterval(callback, delay) { assert.equal(delay, PLACES_REFRESH_MS); interval = callback; return 1; },
    clearInterval(id) { assert.equal(id, 1); cleared = true; },
  });
  page.hidden = true;
  interval();
  assert.equal(calls, 0);
  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls, 1);
  interval();
  events.dispatchEvent(new Event('focus'));
  assert.equal(calls, 1);
  finish();
  await Promise.resolve();
  events.dispatchEvent(new Event('online'));
  assert.equal(calls, 2);
  finish();
  await Promise.resolve();
  stop();
  assert.ok(cleared);
  events.dispatchEvent(new Event('focus'));
  page.dispatchEvent(new Event('visibilitychange'));
  interval();
  assert.equal(calls, 2);
});
