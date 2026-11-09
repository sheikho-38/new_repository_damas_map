'use client';

import { LocateFixed, Loader2 } from 'lucide-react';
import type { LocationStatus } from './useUserLocation';

export default function UserLocationButton({ status, message, onLocate }: {
  status: LocationStatus;
  message: string;
  onLocate: () => void;
}) {
  const loading = status === 'loading';
  return <div className="pointer-events-auto relative">
    {message && <div role="status" className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-[#064239]/15 bg-[#fdfbf7] p-3 text-xs leading-6 text-[#064239] shadow-lg">{message}</div>}
    <button type="button" onClick={onLocate} disabled={loading}
      aria-label="تحديد موقعي" aria-busy={loading}
      className="flex items-center gap-2 rounded-2xl border border-[#064239]/20 bg-[#fdfbf7] px-3 py-2 text-xs font-bold text-[#064239] shadow-xl cursor-pointer disabled:opacity-60">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
      <span>{loading ? 'جارٍ تحديد الموقع…' : 'تحديد موقعي'}</span>
    </button>
  </div>;
}
