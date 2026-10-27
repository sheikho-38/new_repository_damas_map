/**
 * Configuration helper for API and asset URLs.
 * Supports both local development (http://127.0.0.1:8000) and production subpaths (/developer/dalil).
 */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    // If running in browser and on local dev
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000/api';
    }
    // Production: relative to domain and base path
    return `${BASE_PATH}/api`;
  }
  return 'http://127.0.0.1:8000/api';
}

/**
 * Returns a root-relative path for static assets, respecting BASE_PATH.
 * Isomorphic & SSR-safe: returns the exact same string on both server and client.
 * Use this for JSX elements (like <img src={getAssetPath(...) />) to prevent hydration mismatches.
 */
export function getAssetPath(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${cleanPath}`;
}

/**
 * Returns a fully qualified absolute URL in browser environments.
 * Required by MapLibre GL for style specifications, sprites, glyphs, and Web Workers.
 */
export function getAssetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${BASE_PATH}${cleanPath}`;
  }
  return `${BASE_PATH}${cleanPath}`;
}
