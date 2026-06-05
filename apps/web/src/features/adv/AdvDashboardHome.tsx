import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

/**
 * AdvDashboardHome — vista inicial del rol ADV (Agrupación de Defensa Vegetal).
 *
 * ADV es una entidad institucional que vigila colectivamente plagas y
 * enfermedades en una comarca, emite avisos preventivos a sus socios
 * agricultores, y reporta cuatrimestralmente al RAIF (Red de Alerta e
 * Información Fitosanitaria). El presupuesto típico de una ADV viene
 * de cuotas anuales de socios + subvenciones autonómicas → tiene que
 * justificar el valor con datos.
 *
 * Sprint Rol ADV · 05-jun-2026. Versión inicial mínima viable:
 *
 *   · KPI strip · socios vigilados / Ha bajo vigilancia /
 *     avisos comarca activos / próxima cuatrimestral RAIF
 *   · Mapa agregado · todas las parcelas de socios coloreadas por
 *     estado de salud (NDVI)
 *   · Lista de avisos recientes · qué se ha detectado en la comarca
 *     en los últimos 7 días
 *
 * V2 (post-primer-piloto ADV):
 *   · Generador automático de informe RAIF cuatrimestral PDF
 *   · Gestor de socios (alta/baja con cuota anual)
 *   · Calendario de visitas de campo planificadas
 *   · Match alertas FitoLink ↔ tabla plagas RAIF (mapa formal)
 *
 * El rol reusa el endpoint /cooperative/overview porque
 * estructuralmente ADV y cooperativa son ambas entidades que agregan
 * farmers (socios). La diferencia es semántica (commercial vs sanitaria)
 * — el copy del dashboard cambia para hablar el idioma del técnico ADV.
 */

interface AdvOverview {
  members: Array<{
    _id: string;
    name: string;
    parcelCount: number;
    // Campo real del endpoint /cooperative/overview es `areaHa`/`ndviAvg`
    // (no `totalHa`/`avgNdvi`). Fix 05-jun-2026 — antes los KPIs renderizaban "—".
    areaHa: number;
    ndviAvg: number | null;
    alertCount: number;
  }>;
  parcels: Array<{
    _id: string;
    name: string;
    geometry: GeoJSON.Polygon;
    areaHa: number;
    cropType: string;
    // Shape REAL del endpoint /cooperative/overview (cooperativeService.ts
    // ParcelGeo interface): solo última lectura NDVI + flag de alerta.
    // ParcelMap soporta este shape nativamente desde el fix 05-jun-2026.
    ndvi: number | null;
    hasActiveAlert: boolean;
    ownerName: string;
  }>;
  kpis: {
    memberCount: number;
    areaHa: number;
    ndviAvg: number | null;
    activeAlerts: number;
    criticalAlerts: number;
  };
}

export default function AdvDashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<AdvOverview>({
    queryKey: ['adv', 'overview'],
    queryFn: async () => {
      // Reusamos endpoint /cooperative/overview — el shape de datos es
      // idéntico (entidad que agrega farmers con sus parcelas).
      const res = await api.get('/cooperative/overview');
      return res.data.data;
    },
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-96 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data || data.kpis.memberCount === 0) {
    return <AdvEmptyState userName={user?.name} />;
  }

  const { kpis, parcels, members } = data;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header editorial */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-1">
              § VIGILANCIA COMARCAL · ADV
            </p>
            <h1 className="font-display text-2xl text-brand-900">
              {user?.name?.split(' ')[0] ? `Hola, ${user?.name?.split(' ')[0]}` : 'Vigilancia colectiva'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {kpis.memberCount} socio{kpis.memberCount > 1 ? 's' : ''} · {kpis.areaHa.toFixed(0)} ha bajo vigilancia
            </p>
          </div>
          {kpis.criticalAlerts > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-xl animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {kpis.criticalAlerts} aviso{kpis.criticalAlerts > 1 ? 's' : ''} crítico{kpis.criticalAlerts > 1 ? 's' : ''} comarca
            </div>
          )}
        </div>
      </div>

      {/* KPI strip · 4 métricas críticas ADV */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">Socios vigilados</p>
          <p className="font-display text-3xl text-brand-900 leading-none">{kpis.memberCount}</p>
          <p className="text-[10px] text-gray-400 mt-2">agricultores en la comarca</p>
        </div>
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">Hectáreas vigiladas</p>
          <p className="font-display text-3xl text-brand-900 leading-none">{kpis.areaHa.toFixed(0)}<span className="text-base text-gray-500"> ha</span></p>
          <p className="text-[10px] text-gray-400 mt-2">cobertura comarcal total</p>
        </div>
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">Avisos activos</p>
          <p className={`font-display text-3xl leading-none ${kpis.activeAlerts > 0 ? 'text-terra-500' : 'text-green-600'}`}>
            {kpis.activeAlerts}
          </p>
          <p className="text-[10px] text-gray-400 mt-2">
            {kpis.criticalAlerts > 0 ? `${kpis.criticalAlerts} críticos` : 'sin avisos críticos'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">NDVI medio comarca</p>
          <p className={`font-display text-3xl leading-none ${kpis.ndviAvg === null ? 'text-gray-400' : kpis.ndviAvg < 0.3 ? 'text-red-600' : kpis.ndviAvg < 0.5 ? 'text-terra-500' : 'text-green-600'}`}>
            {kpis.ndviAvg !== null ? kpis.ndviAvg.toFixed(2) : '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-2">Sentinel-2 · revisión 5 días</p>
        </div>
      </div>

      {/* Mapa + Lista socios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Mapa */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-earth-300/30 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500">
              § MAPA DE LA COMARCA
            </p>
            <p className="text-[10px] text-gray-400">{parcels.length} parcelas socios</p>
          </div>
          {parcels.length > 0 ? (
            <div className="flex-1 min-h-[320px] relative">
              <div className="absolute inset-0">
                <ParcelMap
                  parcels={parcels}
                  height="100%"
                  showDetailLink
                  showLegend
                  onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Aún no hay parcelas de socios vinculadas.
            </div>
          )}
        </div>

        {/* Lista socios */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-earth-300/30 p-4 flex flex-col min-h-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500 mb-3 flex-shrink-0">
            § SOCIOS VIGILADOS
          </p>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {members.map((m) => (
              <div
                key={m._id}
                className="border border-earth-300/30 rounded-lg p-3 hover:border-brand-200 transition-colors"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <p className="text-sm font-semibold text-brand-900 truncate flex-1">{m.name}</p>
                  {m.alertCount > 0 && (
                    <span className="font-mono text-[9px] bg-terra-500/10 text-terra-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {m.alertCount} avisos
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span>{m.parcelCount} parc · {m.areaHa.toFixed(1)} ha</span>
                  {m.ndviAvg !== null && (
                    <span className={`font-mono tabular-nums ${m.ndviAvg < 0.3 ? 'text-red-600' : m.ndviAvg < 0.5 ? 'text-terra-500' : 'text-green-600'}`}>
                      NDVI {m.ndviAvg.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state · ADV sin socios todavía vinculados. Editorial AgroM con
 * mensaje específico del rol — los socios se enlazan vía cooperativeId
 * en el modelo User (alta manual por equipo de soporte mientras V2 trae
 * el self-onboarding).
 */
function AdvEmptyState({ userName }: { userName?: string }) {
  const firstName = userName?.split(' ')[0];
  return (
    <div className="h-full flex items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="max-w-xl w-full text-center">
        <img
          src="/brand/agrom-wordmark.svg"
          alt="AgroM"
          className="h-9 w-auto mx-auto mb-4"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
          § FITOLINK · VIGILANCIA COMARCAL ADV
        </p>
        <div className="w-12 h-[2px] bg-terra-500 mx-auto mt-3 mb-6" />
        <h1 className="font-display text-4xl text-brand-600 leading-tight">
          {firstName ? `Bienvenido, ${firstName}.` : 'Bienvenido a AgroM.'}
        </h1>
        <p className="text-gray-500 mt-2 text-base">
          Aún no hay socios vinculados a su Agrupación de Defensa Vegetal.
        </p>
        <div className="mt-10 mb-10 text-left bg-white border border-earth-300/40 rounded-xl p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-4">
            § PRÓXIMOS PASOS
          </p>
          <ol className="space-y-4 text-brand-900 text-sm leading-relaxed">
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">01</span>
              <span>
                <b className="text-brand-600 font-semibold">Comparta con sus socios</b> el
                enlace de alta. Cada agricultor crea cuenta gratis con su Google
                y sube sus parcelas.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">02</span>
              <span>
                <b className="text-brand-600 font-semibold">Nuestro equipo los vincula</b>{' '}
                a su ADV en 24h. A partir de ese momento, sus parcelas aparecen
                aquí agregadas para vigilancia colectiva.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">03</span>
              <span>
                <b className="text-brand-600 font-semibold">Recibe cada mañana</b> a las 7h
                el informe consolidado de la comarca con focos térmicos,
                anomalías de cultivo y avisos preventivos para sus socios.
              </span>
            </li>
          </ol>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mt-10">
          AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN
        </p>
      </div>
    </div>
  );
}
