/** Poll only while visible; retry immediately on focus, visibility and reconnect. */
export const PLACES_REFRESH_MS = 15_000;

export function watchPlaces(
  refresh: () => Promise<void>,
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> = document,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  timers: Pick<typeof globalThis, 'setInterval' | 'clearInterval'> = globalThis,
) {
  let busy = false;
  let stopped = false;
  const tick = async () => {
    if (page.hidden || busy || stopped) return;
    busy = true;
    try { await refresh(); } finally { busy = false; }
  };
  const interval = timers.setInterval(() => { void tick(); }, PLACES_REFRESH_MS);
  page.addEventListener('visibilitychange', tick);
  events.addEventListener('focus', tick);
  events.addEventListener('online', tick);
  return () => {
    stopped = true;
    timers.clearInterval(interval);
    page.removeEventListener('visibilitychange', tick);
    events.removeEventListener('focus', tick);
    events.removeEventListener('online', tick);
  };
}
