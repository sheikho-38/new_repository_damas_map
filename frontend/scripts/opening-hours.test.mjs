import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openingHoursForDay, subscribeToLocalDay } from '../src/lib/opening-hours.ts';

test('shows only the selected weekday and distinguishes closed from unknown', () => {
  const hours = { الأحد: '09:00–17:00', الإثنين: '24/7', الجمعة: 'مغلق' };
  assert.equal(openingHoursForDay(hours, 0), 'من 9 صباحًا إلى 5 مساءً');
  assert.equal(openingHoursForDay(hours, 1), 'مفتوح 24 ساعة');
  assert.equal(openingHoursForDay(hours, 5), 'مغلق');
  assert.equal(openingHoursForDay(hours, 6), 'دوام اليوم غير محدد');
});

test('handles legacy schedules and overnight hours', () => {
  assert.equal(openingHoursForDay({ hours: 'Sa-Th 09:00-17:00' }, 0), 'من 9 صباحًا إلى 5 مساءً');
  assert.equal(openingHoursForDay({ hours: 'Sa-Th 09:00-17:00' }, 5), 'دوام اليوم غير محدد');
  assert.match(openingHoursForDay({ الأحد: '20:00–02:00' }, 0), /اليوم التالي/);
});

test('the same instant selects different days according to the device timezone', () => {
  const original = process.env.TZ;
  try {
    const hours = { الأحد: 'مغلق', الاثنين: '24/7' };
    process.env.TZ = 'Pacific/Kiritimati';
    assert.equal(openingHoursForDay(hours, new Date('2026-11-01T12:00:00Z').getDay()), 'مفتوح 24 ساعة');
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(openingHoursForDay(hours, new Date('2026-11-01T12:00:00Z').getDay()), 'مغلق');
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test('refreshes after local midnight and cleans up its subscription', (t) => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(2026, 10, 1, 23, 59, 59).getTime() });
  let unsubscribe;
  try {
    const days = [];
    unsubscribe = subscribeToLocalDay(() => days.push(new Date().getDay()));
    t.mock.timers.tick(1100);
    assert.deepEqual(days, [0, 1]);
    window.dispatchEvent(new Event('focus'));
    assert.equal(days.length, 3);
    unsubscribe();
    window.dispatchEvent(new Event('focus'));
    t.mock.timers.tick(86400000);
    assert.equal(days.length, 3);
  } finally {
    unsubscribe?.();
    t.mock.timers.reset();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
