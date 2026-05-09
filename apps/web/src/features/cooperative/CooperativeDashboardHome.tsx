/**
 * Cooperative dashboard home — aggregated view of N socios.
 *
 * The cooperative user owns no parcels itself. This screen rolls up:
 *   - KPI strip (members, parcels, hectares, NDVI avg, alerts)
 *   - Map of all socios' parcels coloured by NDVI
 *   - Member list ranked by who needs attention first
 *   - At-a-glance "story": you can see immediately if the cooperative
 *     is healthy or has hot spots
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import 'leaflet/dist/leaflet.css';

interface MemberSummary {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  parcelCount: number;
  areaHa: number;
  ndviAvg: number | null;
  alertCount: number;
  criticalAlertCount: number;
  worstParcel: { _id: string; name: string; ndvi: number } | null;
}

interface ParcelGeo {
  _id: string;
  name: string;
  cropType: string;
  areaHa: number;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  ndvi: number | null;
  hasActiveAlert: boolean;
  ownerName: string;
}

interface CooperativeOverview {
  cooperative: { _id: string; name: string; company?: string };
  kpis: {
    memberCount: number;
    parcelCount: number;
    areaHa: number;
    ndviAvg: number | null;
    activeAlerts: number;
    criticalAlerts: number;
    parcelsBelowCritical: number;
  };
  members: MemberSummary[];
  parcels: ParcelGeo[];
}

function ndviColor(ndvi: number | null): string {
  if (ndvi === null) return '#94a3b8';
  if (ndvi < 0.30) return '#ef4444';
  if (ndvi < 0.40) return '#f97316';
  if (ndvi < 0.55) return '#eab308';
  return '#22c55e';
}

function ndviLabel(ndvi: number | null): string {
  if (ndvi === null) return 'sin datos';
  if (ndvi < 0.30) return 'crítico';
  if (ndvi < 0.40) return 'atención';
  if (ndvi < 0.55) return 'medio';
  return 'sano';
}

export default function CooperativeDashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'overview'],
    queryFn: async () => {
      const res = await api.get('/cooperative/overview');
      return res.data.data as CooperativeOverview;
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-gray-100 rounded animate-pulse w-2/3" />
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const { kpis, members, parcels } = data;
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: parcels.map((p) => ({
      type: 'Feature',
      geometry: p.geometry,
      properties: { _id: p._id, name: p.name, ndvi: p.ndvi, hasAlert: p.hasActiveAlert, owner: p.ownerName, areaHa: p.areaHa },
    })),
  };

  const healthRatio = kpis.parcelCount > 0
    ? Math.round(((kpis.parcelCount - kpis.parcelsBelowCritical) / kpis.parcelCount) * 100)
    : null;

  return (
    <div className="space-y-5">
      {/* Hero header — gold band reinforces "cooperative" visual identity */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-500 rounded-2xl px-6 py-5 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <img src="/provider-cooperative.svg" alt="" className="w-14 h-14 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-100">Cooperativa</p>
            <h1 className="text-2xl font-bold leading-tight">{user?.name}</h1>
            <p className="text-amber-100 text-sm mt-0.5">
              {kpis.memberCount} socios · {kpis.parcelCount} parcelas · {kpis.areaHa.toLocaleString('es-ES')} ha agregadas
            </p>
          </div>
          {kpis.criticalAlerts > 0 && (
            <div className="bg-red-100 border border-red-200 text-red-800 text-sm font-semibold px-4 py-2 rounded-xl flex-shrink-0 animate-pulse">
              ⚠ {kpis.criticalAlerts} alerta{kpis.criticalAlerts !== 1 ? 's' : ''} crítica{kpis.criticalAlerts !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard label="Socios" value={kpis.memberCount} />
        <KpiCard label="Hectáreas" value={kpis.areaHa.toLocaleString('es-ES')} unit="ha" />
        <KpiCard
          label="NDVI medio"
          value={kpis.ndviAvg !== null ? kpis.ndviAvg.toFixed(2) : '—'}
          accent={kpis.ndviAvg === null ? 'text-gray-400' : kpis.ndviAvg < 0.30 ? 'text-red-600' : kpis.ndviAvg < 0.45 ? 'text-yellow-600' : 'text-green-600'}
        />
        <KpiCard
          label="Alertas activas"
          value={kpis.activeAlerts}
          sub={kpis.criticalAlerts > 0 ? `${kpis.criticalAlerts} crítica${kpis.criticalAlerts !== 1 ? 's' : ''}` : 'sin críticas'}
          accent={kpis.criticalAlerts > 0 ? 'text-red-600' : kpis.activeAlerts > 0 ? 'text-orange-600' : 'text-green-600'}
        />
        <KpiCard
          label="Salud cartera"
          value={healthRatio !== null ? `${healthRatio}%` : '—'}
          sub={`${kpis.parcelCount - kpis.parcelsBelowCritical} de ${kpis.parcelCount} sanas`}
          accent={healthRatio === null ? 'text-gray-400' : healthRatio >= 80 ? 'text-green-600' : healthRatio >= 60 ? 'text-yellow-600' : 'text-red-600'}
        />
      </div>

      {/* Map + member list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Mapa de parcelas de socios</h2>
              <p className="text-[11px] text-gray-400">Coloreado por NDVI · click parcela para detalle</p>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <Legend color="#22c55e" label="Sano ≥0.55" />
              <Legend color="#eab308" label="Medio" />
              <Legend color="#f97316" label="Atención" />
              <Legend color="#ef4444" label="Crítico" />
            </div>
          </div>
          <div className="flex-1 min-h-[420px] relative rounded-xl overflow-hidden border border-gray-100">
            <div className="absolute inset-0">
              {parcels.length > 0 ? (
                <CoopMap fc={fc} parcels={parcels} onClick={(id) => navigate(`/dashboard/parcels/${id}`)} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  Sin parcelas registradas en la cooperativa
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Member list — 1/3 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">Socios</h2>
            <span className="text-[10px] text-gray-400">ordenados por urgencia</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {members.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">Sin socios todavía</p>
              </div>
            ) : (
              members.map((m) => (
                <div
                  key={m._id}
                  className={`p-3 rounded-xl border transition-all ${
                    m.criticalAlertCount > 0
                      ? 'border-red-200 bg-red-50'
                      : m.alertCount > 0
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                      style={{ background: ndviColor(m.ndviAvg) }}
                      title={`NDVI medio ${ndviLabel(m.ndviAvg)}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span>{m.parcelCount} parc.</span>
                    <span>·</span>
                    <span>{m.areaHa.toFixed(1)} ha</span>
                    <span>·</span>
                    <span className="font-semibold tabular-nums" style={{ color: ndviColor(m.ndviAvg) }}>
                      {m.ndviAvg !== null ? m.ndviAvg.toFixed(2) : '—'}
                    </span>
                  </div>
                  {m.alertCount > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.criticalAlertCount > 0 && (
                        <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase">
                          {m.criticalAlertCount} crítica{m.criticalAlertCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {m.alertCount - m.criticalAlertCount > 0 && (
                        <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full uppercase">
                          {m.alertCount - m.criticalAlertCount} otras
                        </span>
                      )}
                    </div>
                  )}
                  {m.worstParcel && (
                    <button
                      onClick={() => navigate(`/dashboard/parcels/${m.worstParcel!._id}`)}
                      className="mt-2 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Ver {m.worstParcel.name} →
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit, sub, accent }: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? 'text-gray-900'}`}>
        {value}
        {unit && <span className="text-sm font-medium text-gray-500 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-gray-600">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Map subcomponent isolated so the colour-by-NDVI styling stays clean. */
function CoopMap({ fc, parcels, onClick }: {
  fc: GeoJSON.FeatureCollection;
  parcels: ParcelGeo[];
  onClick: (parcelId: string) => void;
}) {
  // Centre the map on the bounding box of all parcels
  const allCoords = parcels.flatMap((p) => p.geometry.coordinates[0]);
  const lngs = allCoords.map((c) => c[0]);
  const lats = allCoords.map((c) => c[1]);
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
  ];

  return (
    <MapContainer center={center} zoom={11} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles © Esri"
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        opacity={0.6}
        maxZoom={19}
      />
      <GeoJSON
        key={parcels.map((p) => `${p._id}-${p.ndvi}`).join('|')}
        data={fc}
        style={(feature) => {
          const ndvi = (feature?.properties?.ndvi as number | null) ?? null;
          const color = ndviColor(ndvi);
          return {
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.45,
          };
        }}
        onEachFeature={(feature, layer) => {
          const props = feature.properties as { _id: string; name: string; ndvi: number | null; hasAlert: boolean; owner: string; areaHa: number };
          const ndviStr = props.ndvi !== null ? props.ndvi.toFixed(3) : '—';
          layer.bindTooltip(
            `<b>${props.name}</b><br>${props.owner} · ${props.areaHa} ha<br>NDVI ${ndviStr}${props.hasAlert ? ' · ⚠ alerta' : ''}`,
            { sticky: true },
          );
          layer.on('click', () => onClick(props._id));
        }}
      />
    </MapContainer>
  );
}
