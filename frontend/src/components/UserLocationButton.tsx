'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Loader2 } from 'lucide-react';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

export default function UserLocationButton({ map }: { map: MapLibreMap | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'stale'>('idle');
  const [message, setMessage] = useState('');
  const marker = useRef<Marker | null>(null);
  const watch = useRef<number | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);

  function stopWatch() {
    generation.current += 1;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    if (expiry.current) clearTimeout(expiry.current);
    expiry.current = null;
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  }

  function markUnavailable(text: string) {
    if (marker.current) {
      const dot = marker.current.getElement();
      dot.style.backgroundColor = '#9ca3af';
      dot.style.boxShadow = '0 0 0 5px rgba(156, 163, 175, 0.15), 0 2px 8px rgba(0, 0, 0, 0.25)';
      dot.title = 'آخر موقع معروف — الموقع الحالي غير متاح';
      dot.setAttribute('aria-label', dot.title);
    }
    setStatus(marker.current ? 'stale' : 'idle');
    setMessage(text);
  }

  useEffect(() => {
    let disposed = false;
    let permission: PermissionStatus | null = null;
    const onPermissionChange = () => {
      if (permission?.state !== 'granted') {
        stopWatch();
        markUnavailable('فعّل خدمة الموقع وإذن الوصول من إعدادات الجهاز والمتصفح، ثم اضغط «تحديد موقعي».');
      }
    };
    navigator.permissions?.query({ name: 'geolocation' }).then(result => {
      if (disposed) return;
      permission = result;
      permission.addEventListener('change', onPermissionChange);
    }).catch(() => { /* Some browsers do not expose geolocation permission state. */ });
    return () => {
      disposed = true;
      permission?.removeEventListener('change', onPermissionChange);
      stopWatch();
      marker.current?.remove();
      marker.current = null;
    };
  }, [map]);

  function locate() {
    if (!map) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      markUnavailable('تحديد الموقع يحتاج متصفحاً يدعم الموقع واتصالاً آمناً HTTPS.');
      return;
    }
    stopWatch();
    const request = generation.current;
    let centered = false;
    setStatus('loading');
    setMessage('اسمح بالوصول إلى موقعك، وفعّل خدمة الموقع على جهازك.');
    const onPosition = (position: GeolocationPosition) => {
      if (request !== generation.current) return;
      const { longitude, latitude } = position.coords;
      if (!marker.current) {
        const dot = document.createElement('div');
        dot.className = 'user-location-dot';
        dot.setAttribute('role', 'img');
        marker.current = new Marker({ element: dot }).setLngLat([longitude, latitude]).addTo(map);
      }
      const dot = marker.current.getElement();
      dot.style.backgroundColor = '#2563eb';
      dot.style.boxShadow = '';
      dot.title = 'موقعك الحالي';
      dot.setAttribute('aria-label', dot.title);
      marker.current.setLngLat([longitude, latitude]);
      setStatus('live');
      setMessage('');
      if (!centered) {
        centered = true;
        const bounds = map.getMaxBounds();
        if (!bounds || bounds.contains([longitude, latitude])) {
          map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 15) });
        } else {
          setMessage('موقعك خارج نطاق خريطة دمشق.');
        }
      }
      if (expiry.current) clearTimeout(expiry.current);
      expiry.current = setTimeout(() => {
        markUnavailable('تعذّر تحديث الموقع؛ الدائرة الرمادية تشير إلى آخر موقع معروف.');
      }, 60000);
    };
    const onError = (error: GeolocationPositionError) => {
      if (request !== generation.current) return;
      if (error.code === 1) stopWatch();
      markUnavailable(error.code === 1
        ? 'اسمح للموقع بالوصول إلى موقعك من إعدادات المتصفح وفعّل خدمة الموقع، ثم أعد المحاولة.'
        : 'تعذّر تحديد الموقع. تأكد من تفعيل خدمة الموقع ثم أعد المحاولة.');
    };
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
    watch.current = navigator.geolocation.watchPosition(onPosition, onError, options);
    // A stationary device may not emit watch updates. Check the service periodically
    // so disabling OS location also turns the last known position grey.
    poll.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPosition, onError, options);
    }, 20000);
  }

  return <div className="pointer-events-auto relative">
    {message && <div role="status" className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-[#064239]/15 bg-[#fdfbf7] p-3 text-xs leading-6 text-[#064239] shadow-lg">{message}</div>}
    <button type="button" onClick={locate} disabled={!map || status === 'loading'}
      aria-label="تحديد موقعي" aria-busy={status === 'loading'}
      className="flex items-center gap-2 rounded-2xl border border-[#064239]/20 bg-[#fdfbf7] px-3 py-2 text-xs font-bold text-[#064239] shadow-xl cursor-pointer disabled:opacity-60">
      {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
      <span>{status === 'loading' ? 'جارٍ تحديد الموقع…' : 'تحديد موقعي'}</span>
    </button>
  </div>;
}
