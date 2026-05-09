import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

/**
 * Admin dashboard — single-screen control panel for the platform.
 *
 * Hits a single `/admin/kpis` endpoint that returns a snapshot of every
 * dimension we care about (health, activity, ops, commercial, satellite).
 * Auxiliary queries (parcels for the map, alert list) stay separate so the
 * KPI tile renders fast even when those collections are large.
 */

interface AdminKpis {
  health: {
    lastPipelineRun: string | null;
    parcelsTotal: number;
    parcelsFreshLt7d: number;
    parcelsFreshLt30d: number;
    mpcCoverage: { withModis: number; withClimate: number; withThermal: number; withAll: number };
  };
  activity: {
    usersTotal: number;
    usersByRole: Record<string, number>;
    hectaresMonitored: number;
    parcelsActive: number;
    parcelsInsured: number;
  };
  operations: {
    alertsActive: number;
    alertsCritical: number;
    opsByStatus: Record<string, number>;
    opsLast30d: number;
    avgAlertToCompletedHours: number | null;
  };
  commercial: {
    leadsPending: number;
    leadsByType: Record<string, number>;
    providersTotal: number;
    providersByCategory: Record<string, number>;
  };
  satellite: {
    ndviReadingsTotal: number;
    snapshotsTotal: number;
    parcelsWithThermal: number;
  };
}

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
};
const SEV_LABEL: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
};

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function daysAgo(date: string | null): string {
  if (!date) return '—';
  const d = (Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000);
  if (d < 1) return 'hoy';
  if (d < 2) return 'ayer';
  return `hace ${Math.floor(d)} días`;
}

export default function AdminDashboardHome() {
  const navigate = useNavigate();

  const { data: kpis, isLoading: kpisLoading } = useQuery<AdminKpis>({
    queryKey: ['admin', 'kpis'],
    queryFn: async () => { const res = await api.get('/admin/kpis'); return res.data.data; },
    refetchInterval: 60_000,
  });

  const { data: parcels = [] } = useQuery({
    queryKey: ['admin', 'parcels'],
    queryFn: async () => { const res = await api.get('/parcels'); return res.data.data ?? []; },
    refetchInterval: 120_000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['admin', 'alerts'],
    queryFn: async () => { const res = await api.get('/alerts/active'); return res.data.data ?? []; },
    refetchInterval: 60_000,
  });

  type Alert = { _id: string; severity: string; ndviValue: number; detectedAt: string; parcelId?: { name: string } };

  const pending = kpis?.operations.opsByStatus.requested ?? 0;
  const critCount = kpis?.operations.alertsCritical ?? 0;
  const totalParcels = kpis?.activity.parcelsActive ?? 0;
  const mpcCov = kpis?.health.mpcCoverage;
  const fresh7Pct = kpis ? pct(kpis.health.parcelsFreshLt7d, kpis.health.parcelsTotal) : '—';
  const mpcAllPct = kpis && mpcCov ? pct(mpcCov.withAll, totalParcels) : '—';
  const insuredPct = kpis ? pct(kpis.activity.parcelsInsured, totalParcels) : '—';

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel Administrador</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vista global de la plataforma FitoLink</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <button onClick={() => navigate('/dashboard/admin/dispatch')}
              className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-yellow-100 transition-colors">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              {pending} operacion{pending > 1 ? 'es' : ''} pendiente{pending > 1 ? 's' : ''}
            </button>
          )}
          <span className="px-3 py-1.5 rounded-full bg-gray-900 text-xs font-semibold text-white">Admin</span>
        </div>
      </div>

      {kpisLoading || !kpis ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Cargando KPIs…
        </div>
      ) : (
        <>
          {/* ── Bloque 1 · Salud plataforma ───────────────────────────── */}
          <SectionTitle icon="/operational-system.svg" title="Salud de la plataforma" subtitle="Pipeline geo y cobertura MPC" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiTile
              label="Última corrida pipeline"
              value={daysAgo(kpis.health.lastPipelineRun)}
              hint={kpis.health.lastPipelineRun ? formatDate(kpis.health.lastPipelineRun) : 'sin lecturas'}
              tone={kpis.health.lastPipelineRun && Date.now() - new Date(kpis.health.lastPipelineRun).getTime() < 7 * 86400000 ? 'green' : 'amber'}
            />
            <KpiTile
              label="Parcelas con datos < 7d"
              value={`${kpis.health.parcelsFreshLt7d}`}
              hint={`${fresh7Pct} de ${kpis.health.parcelsTotal}`}
            />
            <KpiTile
              label="Cobertura MPC completa"
              value={`${mpcCov?.withAll ?? 0}`}
              hint={`${mpcAllPct} con MODIS+ERA5+Landsat`}
            />
            <KpiTile
              label="Solo Landsat thermal"
              value={`${mpcCov?.withThermal ?? 0}`}
              hint={`${mpcCov?.withModis ?? 0} MODIS · ${mpcCov?.withClimate ?? 0} ERA5`}
            />
          </div>

          {/* ── Bloque 2 · Actividad ──────────────────────────────────── */}
          <SectionTitle icon="/farmer.svg" title="Actividad" subtitle="Usuarios, hectáreas y parcelas" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <KpiTile
              label="Usuarios totales"
              value={`${kpis.activity.usersTotal}`}
              hint={`${kpis.activity.usersByRole.farmer ?? 0} agric · ${kpis.activity.usersByRole.pilot ?? 0} pilotos`}
              clickable
              onClick={() => navigate('/dashboard/admin/users')}
            />
            <KpiTile
              label="Cooperativas"
              value={`${kpis.activity.usersByRole.cooperative ?? 0}`}
              hint={`${kpis.activity.usersByRole.insurer ?? 0} aseguradoras`}
            />
            <KpiTile
              label="Parcelas activas"
              value={`${kpis.activity.parcelsActive}`}
              hint="monitoreadas"
              clickable
              onClick={() => navigate('/dashboard/admin/parcels')}
            />
            <KpiTile
              label="Hectáreas"
              value={`${kpis.activity.hectaresMonitored}`}
              hint="ha en plataforma"
            />
            <KpiTile
              label="Parcelas aseguradas"
              value={`${kpis.activity.parcelsInsured}`}
              hint={`${insuredPct} cartera B2B`}
            />
          </div>

          {/* ── Bloque 3 · Operaciones ────────────────────────────────── */}
          <SectionTitle icon="/drone-pilot.svg" title="Operaciones y alertas" subtitle="Flujo dispatcher y SLA" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <KpiTile
              label="Alertas activas"
              value={`${kpis.operations.alertsActive}`}
              hint={`${critCount} crítica${critCount === 1 ? '' : 's'}`}
              tone={critCount > 0 ? 'red' : kpis.operations.alertsActive > 0 ? 'amber' : 'green'}
              clickable
              onClick={() => navigate('/dashboard/admin/alerts')}
            />
            <KpiTile
              label="Solicitadas"
              value={`${kpis.operations.opsByStatus.requested ?? 0}`}
              hint="pendientes de asignar"
              tone={pending > 0 ? 'amber' : undefined}
              clickable
              onClick={() => navigate('/dashboard/admin/dispatch')}
            />
            <KpiTile
              label="En curso"
              value={`${(kpis.operations.opsByStatus.assigned ?? 0) + (kpis.operations.opsByStatus.scheduled ?? 0) + (kpis.operations.opsByStatus['in-progress'] ?? 0)}`}
              hint={`${kpis.operations.opsByStatus.assigned ?? 0} asign · ${kpis.operations.opsByStatus.scheduled ?? 0} prog`}
            />
            <KpiTile
              label="Completadas"
              value={`${kpis.operations.opsByStatus.completed ?? 0}`}
              hint={`${kpis.operations.opsLast30d} últimos 30d`}
            />
            <KpiTile
              label="SLA alerta → cierre"
              value={kpis.operations.avgAlertToCompletedHours !== null ? `${kpis.operations.avgAlertToCompletedHours}h` : '—'}
              hint="tiempo medio"
            />
          </div>

          {/* ── Main: map + sidebar ───────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 flex-1 min-h-0 lg:items-stretch">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-700">Mapa global de parcelas</h2>
                <button onClick={() => navigate('/dashboard/admin/parcels')} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  Ver todas →
                </button>
              </div>
              <div className="flex-1 min-h-[320px] relative">
                <div className="absolute inset-0">
                  <ParcelMap
                    parcels={parcels}
                    height="100%"
                    showDetailLink
                    onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-700">
                  Alertas recientes
                  {critCount > 0 && (
                    <span className="ml-2 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{critCount}</span>
                  )}
                </h2>
                <button onClick={() => navigate('/dashboard/admin/alerts')} className="text-xs text-brand-600 font-medium">Ver todas →</button>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {(alerts as Alert[]).slice(0, 8).map(alert => (
                  <div key={alert._id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEV_BADGE[alert.severity] ?? ''}`}>
                          {SEV_LABEL[alert.severity] ?? alert.severity}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-800 truncate">{alert.parcelId?.name ?? 'Parcela'}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(alert.detectedAt)}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700 flex-shrink-0 ml-2">{alert.ndviValue?.toFixed(2)}</span>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-1">
                      <span className="text-green-600 text-base">✓</span>
                    </div>
                    <p className="text-sm text-gray-400">Sin alertas activas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bloque 4 · Comercial ──────────────────────────────────── */}
          <SectionTitle icon="/provider-cooperative.svg" title="Comercial" subtitle="Leads y directorio de proveedores" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Leads pendientes</p>
                <span className={`text-2xl font-bold ${kpis.commercial.leadsPending > 0 ? 'text-brand-700' : 'text-gray-300'}`}>
                  {kpis.commercial.leadsPending}
                </span>
              </div>
              {kpis.commercial.leadsPending > 0 ? (
                <ul className="text-xs text-gray-600 space-y-1">
                  {Object.entries(kpis.commercial.leadsByType).map(([type, n]) => (
                    <li key={type} className="flex justify-between">
                      <span className="capitalize">{type.replace('-', ' ')}</span>
                      <span className="font-semibold tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">Sin leads abiertos</p>
              )}
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Directorio de proveedores</p>
                <span className="text-2xl font-bold text-gray-700">{kpis.commercial.providersTotal}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(kpis.commercial.providersByCategory).map(([cat, n]) => (
                  <div key={cat} className="bg-gray-50 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-gray-600 capitalize truncate">{cat.replace('-', ' ')}</span>
                    <span className="text-sm font-bold text-gray-800 tabular-nums ml-2">{n}</span>
                  </div>
                ))}
                {Object.keys(kpis.commercial.providersByCategory).length === 0 && (
                  <p className="text-xs text-gray-400 col-span-full">Directorio vacío</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Bloque 5 · Datos satelitales ──────────────────────────── */}
          <SectionTitle icon="/service-multispectral.svg" title="Datos satelitales" subtitle="Histórico de lecturas y snapshots" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiTile
              label="Lecturas NDVI almacenadas"
              value={kpis.satellite.ndviReadingsTotal.toLocaleString('es-ES')}
              hint="Sentinel-2 + MODIS"
            />
            <KpiTile
              label="Snapshots intra-parcela"
              value={kpis.satellite.snapshotsTotal.toLocaleString('es-ES')}
              hint="píxeles para mapa de calor"
            />
            <KpiTile
              label="Parcelas con thermal"
              value={`${kpis.satellite.parcelsWithThermal}`}
              hint="Landsat C2 L2 LST"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'green' | 'amber' | 'red';
  clickable?: boolean;
  onClick?: () => void;
}

function KpiTile({ label, value, hint, tone, clickable, onClick }: KpiTileProps) {
  const toneCls =
    tone === 'red' ? 'text-red-600'
    : tone === 'amber' ? 'text-amber-600'
    : tone === 'green' ? 'text-green-600'
    : 'text-gray-900';
  const Cls = `bg-white rounded-xl border border-gray-200 p-4 text-left ${clickable ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`;
  const inner = (
    <>
      <p className="text-[11px] text-gray-500 mb-1 leading-snug">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-1 truncate">{hint}</p>}
    </>
  );
  if (clickable && onClick) {
    return <button onClick={onClick} className={Cls}>{inner}</button>;
  }
  return <div className={Cls}>{inner}</div>;
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <img src={icon} alt="" className="w-5 h-5" />
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-400 -mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
