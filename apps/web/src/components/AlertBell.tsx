/**
 * Topbar bell with the farmer's active-alert count.
 *
 * Visual reinforcement of the value prop ("you'll know when something
 * happens") without going to real notifications yet — the dropdown shows
 * the 5 most recent active alerts so the user can click straight to them.
 *
 * Real push/email notifications come V2.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

interface Alert {
  _id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'notified' | 'acknowledged' | 'resolved';
  ndviValue: number;
  ndviDelta: number;
  detectedAt: string;
  parcelId?: { _id: string; name: string; cropType?: string };
}

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};
const SEV_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
const SEV_TEXT: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-700',
  low: 'text-blue-600',
};

export default function AlertBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['alerts', 'mine'],
    queryFn: async () => {
      const res = await api.get('/alerts/mine');
      return res.data.data as Alert[];
    },
    refetchInterval: 60_000,
  });

  const alerts = data ?? [];
  const active = alerts.filter((a) => a.status === 'new' || a.status === 'notified');
  const critical = active.filter((a) => a.severity === 'critical');
  const recent = [...active]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 5);

  const hasAlerts = active.length > 0;
  const hasCritical = critical.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        title={`${active.length} alerta${active.length !== 1 ? 's' : ''} activa${active.length !== 1 ? 's' : ''}`}
      >
        <svg
          className={`w-5 h-5 ${hasCritical ? 'text-red-600' : hasAlerts ? 'text-gray-700' : 'text-gray-400'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
        </svg>
        {hasAlerts && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
              hasCritical ? 'bg-red-500' : 'bg-brand-600'
            } ${hasCritical ? 'animate-pulse' : ''}`}
          >
            {active.length > 9 ? '9+' : active.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                Alertas activas
                {hasAlerts && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    {active.length} total{active.length !== 1 ? 'es' : ''}
                    {hasCritical && (
                      <span className="ml-1 text-red-600 font-semibold">· {critical.length} crítica{critical.length !== 1 ? 's' : ''}</span>
                    )}
                  </span>
                )}
              </p>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"/>
                  </svg>
                </div>
                <p className="text-sm text-gray-600 font-medium">Todo en orden</p>
                <p className="text-xs text-gray-400 mt-0.5">Sin alertas activas</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                {recent.map((alert) => (
                  <button
                    key={alert._id}
                    onClick={() => {
                      if (alert.parcelId?._id) {
                        navigate(`/dashboard/parcels/${alert.parcelId._id}`);
                      } else {
                        navigate('/dashboard/alerts');
                      }
                      setOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                  >
                    <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${SEV_DOT[alert.severity]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${SEV_TEXT[alert.severity]}`}>
                          {SEV_LABEL[alert.severity]}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatDate(alert.detectedAt)}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                        {alert.parcelId?.name || 'Parcela'}
                      </p>
                      <p className="text-xs text-gray-500">
                        NDVI <b className="tabular-nums">{alert.ndviValue.toFixed(2)}</b>
                        {alert.ndviDelta !== 0 && (
                          <> · Δ <span className={alert.ndviDelta < 0 ? 'text-red-600' : 'text-green-600'}>
                            {alert.ndviDelta > 0 ? '+' : ''}{alert.ndviDelta.toFixed(2)}
                          </span></>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {active.length > 0 && (
              <button
                onClick={() => {
                  navigate('/dashboard/alerts');
                  setOpen(false);
                }}
                className="w-full px-4 py-2.5 text-xs text-brand-600 hover:bg-brand-50 font-semibold border-t border-gray-100 transition-colors"
              >
                Ver todas las alertas →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
