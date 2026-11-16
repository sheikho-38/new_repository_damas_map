'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';

export type UserLocation = { lat: number; lon: number; accuracy: number; timestamp: number };
export type LocationStatus = 'idle' | 'loading' | 'live' | 'stale' | 'denied' | 'unavailable';
const OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 };
const MAX_ACCURACY = 150;
type WaitingLocation = { resolve: (value: UserLocation) => void; reject: (error: Error) => void; timer: number };

export function useUserLocation(map: MapLibreMap | null) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [message, setMessage] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [cameraFollowing, setCameraFollowing] = useState(false);
  const watchId = useRef<number | null>(null);
  const generation = useRef(0);
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
    if (value.accuracy > MAX_ACCURACY) {
      if (!latest.current) setMessage('دقة الموقع الحالية غير كافية؛ ننتظر تحديثًا أدق.');
      return;
    }
    latest.current = value; setLocation(value);
    setStatus('live'); setMessage(''); updateMarker(value);
    for (const request of waiting.current) {
      window.clearTimeout(request.timer);
      request.resolve(value);
    }
    waiting.current.clear();
    if (following.current && map) map.easeTo({ center: [value.lon, value.lat] });
  }, [map, updateMarker]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === 3 && latest.current) return;
    generation.current++;
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTrackingEnabled(false);
    const lastPosition = latest.current;
    latest.current = null;
    const detail = error.code === 1
      ? 'إذن الموقع مرفوض. فعّله من إعدادات المتصفح ثم اضغط تحديد موقعي.'
      : 'خدمة الموقع غير متاحة. فعّلها على الجهاز ثم اضغط تحديد موقعي.';
    setMessage(detail);
    if (error.code === 1) {
      setStatus('denied');
      following.current = false; setCameraFollowing(false);
    } else {
      setStatus('unavailable');
    }
    if (lastPosition) updateMarker(lastPosition, true);
    for (const request of waiting.current) {
      window.clearTimeout(request.timer);
      request.reject(new Error(detail));
    }
    waiting.current.clear();
  }, [updateMarker]);

  const startWatch = useCallback((restart = false) => {
    if (restart && watchId.current !== null) {
      generation.current++;
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (watchId.current !== null || !navigator.geolocation) return;
    const currentGeneration = ++generation.current;
    setTrackingEnabled(true);
    setStatus('loading');
    setMessage('');
    watchId.current = navigator.geolocation.watchPosition(
      position => { if (generation.current === currentGeneration) acceptPosition(position); },
      error => { if (generation.current === currentGeneration) handleError(error); },
      OPTIONS,
    );
  }, [acceptPosition, handleError]);

  useEffect(() => {
    if (!map) return;
    if (!window.isSecureContext || !navigator.geolocation) return;
    startWatch();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !latest.current) return;
      const currentGeneration = generation.current;
      navigator.geolocation.getCurrentPosition(
        position => { if (generation.current === currentGeneration) acceptPosition(position); },
        error => {
          if (generation.current === currentGeneration && error.code !== 3) handleError(error);
        },
        { ...OPTIONS, maximumAge: 0, timeout: 10000 },
      );
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [acceptPosition, handleError, map, startWatch]);

  const requestFreshPosition = useCallback((retry = false) => new Promise<UserLocation>((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      const error = new Error('تحديد الموقع يحتاج اتصال HTTPS ومتصفحًا يدعم GPS.');
      setMessage(error.message); setStatus('unavailable'); reject(error); return;
    }
    const current = latest.current;
    if (current) {
      resolve(current); return;
    }
    if (!retry && (status === 'denied' || status === 'unavailable')) {
      reject(new Error(message || 'فعّل خدمة الموقع ثم اضغط تحديد موقعي.'));
      return;
    }
    startWatch();
    const request: WaitingLocation = { resolve, reject, timer: 0 };
    request.timer = window.setTimeout(() => {
      waiting.current.delete(request);
      const error = new Error('تعذر تحديد الموقع. فعّل خدمة الموقع ثم اضغط تحديد موقعي.');
      reject(error);
    }, 30000);
    waiting.current.add(request);
  }), [message, startWatch, status]);

  const locateAndFollow = useCallback(async () => {
    following.current = true; setCameraFollowing(true);
    const retry = !latest.current;
    if (retry) startWatch(true);
    const value = await requestFreshPosition(retry);
    map?.flyTo({ center: [value.lon, value.lat], zoom: Math.max(map.getZoom(), 15) });
  }, [map, requestFreshPosition, startWatch]);
  const stopFollowing = useCallback(() => { following.current = false; setCameraFollowing(false); }, []);

  useEffect(() => () => {
    generation.current++;
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
