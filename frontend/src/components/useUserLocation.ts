'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

export type UserLocation = { lat: number; lon: number; accuracy: number; timestamp: number };
export type LocationStatus = 'idle' | 'loading' | 'live' | 'stale' | 'denied' | 'unavailable';
const OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 };
const FRESH_MS = 15000;
const MAX_ACCURACY = 150;
type WaitingLocation = { resolve: (value: UserLocation) => void; reject: (error: Error) => void; timer: number };

function errorMessage(error: GeolocationPositionError) {
  if (error.code === 1) return 'تم رفض إذن الموقع. فعّله من إعدادات المتصفح ثم أعد المحاولة.';
  if (error.code === 2) return 'الموقع غير متاح حاليًا. تأكد من تفعيل خدمة الموقع وإشارة GPS.';
  return 'انتهت مهلة تحديد الموقع. انتقل إلى مكان ذي إشارة أفضل ثم أعد المحاولة.';
}

export function useUserLocation(map: MapLibreMap | null) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [message, setMessage] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [cameraFollowing, setCameraFollowing] = useState(false);
  const watchId = useRef<number | null>(null);
  const latest = useRef<UserLocation | null>(null);
  const marker = useRef<Marker | null>(null);
  const following = useRef(false);
  const waiting = useRef(new Set<WaitingLocation>());

  const updateMarker = useCallback((value: UserLocation, stale = false) => {
    if (!map) return;
    if (!marker.current) {
      const dot = document.createElement('div');
      dot.className = 'user-location-dot';
      dot.setAttribute('role', 'img');
      marker.current = new Marker({ element: dot }).setLngLat([value.lon, value.lat]).addTo(map);
    }
    const dot = marker.current.getElement();
    dot.style.backgroundColor = stale ? '#9ca3af' : '#2563eb';
    dot.style.boxShadow = stale ? '0 0 0 5px rgba(156,163,175,.15)' : '';
    dot.title = stale ? 'آخر موقع معروف — قد لا يكون حديثًا' : 'موقعك الحالي';
    dot.setAttribute('aria-label', dot.title);
    marker.current.setLngLat([value.lon, value.lat]);
  }, [map]);

  const acceptPosition = useCallback((position: GeolocationPosition) => {
    const value = { lat: position.coords.latitude, lon: position.coords.longitude,
      accuracy: position.coords.accuracy, timestamp: position.timestamp || Date.now() };
    latest.current = value; setLocation(value);
    if (value.accuracy > MAX_ACCURACY) {
      setStatus('stale'); setMessage('دقة الموقع الحالية غير كافية؛ ننتظر تحديثًا أدق.');
      updateMarker(value, true);
      return;
    }
    setStatus('live'); setMessage(''); updateMarker(value);
    for (const request of waiting.current) {
      window.clearTimeout(request.timer);
      request.resolve(value);
    }
    waiting.current.clear();
    if (following.current && map) map.easeTo({ center: [value.lon, value.lat] });
  }, [map, updateMarker]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    setMessage(errorMessage(error));
    if (error.code === 1) {
      setStatus('denied'); setTrackingEnabled(false);
      following.current = false; setCameraFollowing(false);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      for (const request of waiting.current) {
        window.clearTimeout(request.timer);
        request.reject(new Error(errorMessage(error)));
      }
      waiting.current.clear();
    } else {
      setStatus(latest.current ? 'stale' : 'unavailable');
      if (latest.current) updateMarker(latest.current, true);
    }
  }, [updateMarker]);

  const startWatch = useCallback(() => {
    if (watchId.current !== null || !navigator.geolocation) return;
    setTrackingEnabled(true);
    watchId.current = navigator.geolocation.watchPosition(acceptPosition, handleError, OPTIONS);
  }, [acceptPosition, handleError]);

  useEffect(() => {
    if (!map) return;
    if (!window.isSecureContext || !navigator.geolocation) return;
    startWatch();
  }, [map, startWatch]);

  const requestFreshPosition = useCallback(() => new Promise<UserLocation>((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      const error = new Error('تحديد الموقع يحتاج اتصال HTTPS ومتصفحًا يدعم GPS.');
      setMessage(error.message); setStatus('unavailable'); reject(error); return;
    }
    startWatch();
    const current = latest.current;
    if (current && Date.now() - current.timestamp <= FRESH_MS && current.accuracy <= MAX_ACCURACY) {
      resolve(current); return;
    }
    setStatus('loading');
    const request: WaitingLocation = { resolve, reject, timer: 0 };
    request.timer = window.setTimeout(() => {
      waiting.current.delete(request);
      const error = new Error('لم يصل تحديث دقيق للموقع خلال 30 ثانية. ستستمر متابعة الموقع تلقائيًا.');
      setStatus(latest.current ? 'stale' : 'unavailable');
      setMessage(error.message);
      reject(error);
    }, 30000);
    waiting.current.add(request);
    // The watch may stay silent while the device is stationary.
    navigator.geolocation.getCurrentPosition(acceptPosition, error => {
      if (error.code === 1) handleError(error);
    }, OPTIONS);
  }), [acceptPosition, handleError, startWatch]);

  const locateAndFollow = useCallback(async () => {
    following.current = true; setCameraFollowing(true);
    const value = await requestFreshPosition();
    map?.flyTo({ center: [value.lon, value.lat], zoom: Math.max(map.getZoom(), 15) });
  }, [map, requestFreshPosition]);
  const stopFollowing = useCallback(() => { following.current = false; setCameraFollowing(false); }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const value = latest.current;
      if (value && Date.now() - value.timestamp > FRESH_MS) { setStatus('stale'); updateMarker(value, true); }
    }, 5000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && watchId.current !== null && latest.current &&
          Date.now() - latest.current.timestamp > FRESH_MS) {
        void requestFreshPosition().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [requestFreshPosition, updateMarker]);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    for (const request of waiting.current) {
      window.clearTimeout(request.timer);
      request.reject(new Error('تم إيقاف متابعة الموقع.'));
    }
    waiting.current.clear();
    marker.current?.remove();
    marker.current = null;
  }, []);

  return { location, status, message, trackingEnabled, cameraFollowing,
    locateAndFollow, requestFreshPosition, stopFollowing };
}
