import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/features/auth/authStore.js';
import ParcelMap from '@/features/parcels/ParcelMap.js';

/**
 * RegantesDashboardHome — vista inicial del rol `regantes`.
 *
 * Comunidad de Regantes: asociación gestora de riego colectivo + reparto
 * de agua entre socios. ~700 en España. Decisor: junta + gerente técnico.
 *
 * Dolor 2026 (alta urgencia):
 *   · Sequía 2024-2026 → menor agua disponible → conflictos reparto
 *   · RD 950/2024 → reducción obligatoria consumo agua agraria
 *   · Justificar reparto con datos objetivos a socios + administración
 *
 * Stack FitoLink alineado:
 *   · NDVI Sentinel-2 → cuánto necesita cada cultivo
 *   · LST Landsat thermal → estrés térmico cuasi-tiempo-real
 *   · ERA5 drought → señal hídrica agregada zona
 *   · Open-Meteo → previsión 7 días (decidir reparto semanal)
 *   · SoilGrids → cap. campo (cuánta agua retiene cada suelo)
 *
 * Sprint Comunidad de Regantes · 05-jun-2026. Reusa endpoint
 * `/cooperative/overview` (mismo shape estructural). Diferenciación:
 *   · Copy editorial "§ ESTADO HÍDRICO · CARTERA REGABLE"
 *   · KPIs específicos: % parcelas en estrés, hectáreas regables,
 *     parcelas críticas (NDVI<0.40), próxima ventana riego
 *   · Lista de socios por urgencia de riego (no por NDVI absoluto)
 *
 * V2 (post-piloto regantes):
 *   · Reparto sugerido semanal con cupos por socio (m³/ha)
 *   · Comparativa consumo histórico vs RD 950/2024
 *   · Cuaderno digital de riegos por socio
 *   · Match alertas FitoLink ↔ tabla aforos comunidad
 */

interface RegantesOverview {
  members: Array<{
    _id: string;
    name: string;
    parcelCount: number;
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
    // Shape REAL del endpoint /cooperative/overview (cooperativeService.ts).
    // Fix 05-jun-2026: ParcelMap soporta el shape agregado nativo y colorea
    // por NDVI directo. Antes con cast `as any` salía todo gris fallback.
    ndvi: number | null;
    hasActiveAlert: boolean;
    ownerName: string;
    // 05-jun-2026: añadido para mapear socio→parcela y poder hacer focus
    // mapa al clickear card de socio en la lista lateral.
    ownerId: string;
  }>;
  kpis: {
    memberCount: number;
    areaHa: number;
    ndviAvg: number | null;
    activeAlerts: number;
    criticalAlerts: number;
    parcelsBelowCritical: number; // NDVI < 0.3
  };
}

export default function RegantesDashboardHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  // 05-jun-2026: state para hacer focus en mapa al clickear socio.
  // Click en card de socio → busca primera parcela de ese socio → mapa
  // hace flyToBounds. Click otra vez en el mismo socio = des-selecciona.
  const [focusedParcelId, setFocusedParcelId] = useState<string | undefined>();

  const { data, isLoading } = useQuery<RegantesOverview>({
    queryKey: ['regantes', 'overview'],
    queryFn: async () => {
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
    return <RegantesEmptyState userName={user?.name} />;
  }

  const { kpis, parcels, members } = data;
  const totalParcels = parcels.length;
  // % parcelas en estrés hídrico (NDVI<0.40 — proxy de necesidad de riego).
  // Más conservador que el "critical<0.30" porque el gerente quiere
  // ver TODAS las que pueden necesitar más agua, no solo las críticas.
  const stressedParcels = parcels.filter((p) => {
    // Endpoint agregado devuelve `ndvi: number | null` directo, no array.
    const ndvi = p.ndvi ?? 1;
    return ndvi < 0.40;
  }).length;
  const stressPct = totalParcels > 0 ? Math.round((stressedParcels / totalParcels) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header editorial */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-1">
              § ESTADO HÍDRICO · CARTERA REGABLE
            </p>
            <h1 className="font-display text-2xl text-brand-900">
              {user?.name?.split(' ')[0] ? `Hola, ${user?.name?.split(' ')[0]}` : 'Gestión hídrica colectiva'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {kpis.memberCount} socios &middot; {kpis.areaHa.toFixed(0)} ha regables &middot; {totalParcels} parcelas vigiladas
            </p>
          </div>
          {stressPct > 30 && (
            <div className="flex items-center gap-2 bg-terra-500/10 border border-terra-500/30 text-terra-500 text-sm font-medium px-4 py-2 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-terra-500 animate-pulse" />
              {stressPct}% cartera en estrés hídrico
            </div>
          )}
        </div>
      </div>

      {/* KPI strip · 4 métricas críticas Regantes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            Hectáreas regables
          </p>
          <p className="font-display text-3xl text-brand-900 leading-none">
            {kpis.areaHa.toFixed(0)}
            <span className="text-base text-gray-500"> ha</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-2">{kpis.memberCount} socios &middot; {totalParcels} parcelas</p>
        </div>
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            Parcelas en estrés
          </p>
          <p className={`font-display text-3xl leading-none ${stressPct > 30 ? 'text-terra-500' : stressPct > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
            {stressPct}<span className="text-base text-gray-500">%</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-2">
            {stressedParcels} de {totalParcels} con NDVI &lt; 0.40
          </p>
        </div>
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            Críticas (riego urgente)
          </p>
          <p className={`font-display text-3xl leading-none ${kpis.parcelsBelowCritical > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {kpis.parcelsBelowCritical}
          </p>
          <p className="text-[10px] text-gray-400 mt-2">NDVI &lt; 0.30 &middot; reparto inmediato</p>
        </div>
        <div className="bg-white rounded-xl border border-earth-300/30 p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
            NDVI medio cartera
          </p>
          <p className={`font-display text-3xl leading-none ${
            kpis.ndviAvg === null
              ? 'text-gray-400'
              : kpis.ndviAvg < 0.40
              ? 'text-terra-500'
              : kpis.ndviAvg < 0.55
              ? 'text-yellow-600'
              : 'text-green-600'
          }`}>
            {kpis.ndviAvg !== null ? kpis.ndviAvg.toFixed(2) : '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-2">Sentinel-2 &middot; revisión 5 días</p>
        </div>
      </div>

      {/* Mapa + Lista socios por urgencia riego */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Mapa */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-earth-300/30 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500">
              § MAPA DE LA COMUNIDAD
            </p>
            <p className="text-[10px] text-gray-400">{totalParcels} parcelas regables</p>
          </div>
          {parcels.length > 0 ? (
            <div className="flex-1 min-h-[320px] relative">
              <div className="absolute inset-0">
                <ParcelMap
                  parcels={parcels}
                  height="100%"
                  showDetailLink
                  showLegend
                  focusParcelId={focusedParcelId}
                  onParcelClick={(id) => navigate(`/dashboard/parcels/${id}`)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Aún no hay parcelas de socios vinculadas a la comunidad.
            </div>
          )}
        </div>

        {/* Lista socios — por urgencia (más NDVI bajo = más riego necesario) */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-earth-300/30 p-4 flex flex-col min-h-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500 mb-3 flex-shrink-0">
            § PRIORIDAD DE RIEGO
          </p>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {[...members]
              .sort((a, b) => {
                // Urgencia riego: primero los que tienen alertas, luego los
                // de NDVI más bajo (más sediento = más prioritario).
                if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
                const aN = a.ndviAvg ?? 1;
                const bN = b.ndviAvg ?? 1;
                return aN - bN;
              })
              .map((m, idx) => {
                const isTopPriority = idx < 3;
                const ndviColor =
                  m.ndviAvg === null ? 'text-gray-400' : m.ndviAvg < 0.40 ? 'text-terra-500' : m.ndviAvg < 0.55 ? 'text-yellow-600' : 'text-green-600';
                // Para hacer focus en el mapa al clickear la card, busco
                // la primera parcela del socio. Si tiene varias, el mapa
                // hace zoom a esa una (la primera). V2: cycle por las N
                // parcelas del socio en clicks sucesivos.
                const socioParcels = parcels.filter((p) => p.ownerId === m._id);
                const focusTarget = socioParcels[0]?._id;
                const isFocused = focusTarget !== undefined && focusedParcelId === focusTarget;
                return (
                  <button
                    type="button"
                    key={m._id}
                    onClick={() => {
                      if (!focusTarget) return;
                      // Toggle: si ya está focused → des-seleccionar (vuelve al fitBounds general)
                      setFocusedParcelId(isFocused ? undefined : focusTarget);
                    }}
                    className={`w-full text-left border rounded-lg p-3 transition-all ${
                      isFocused
                        ? 'border-brand-600 bg-brand-50 shadow-sm'
                        : isTopPriority
                        ? 'border-terra-500/40 bg-terra-500/5 hover:border-terra-500'
                        : 'border-earth-300/30 hover:border-brand-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="font-mono text-[9px] tracking-wider text-gray-400 flex-shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <p className="text-sm font-semibold text-brand-900 truncate">{m.name}</p>
                      </div>
                      {m.alertCount > 0 && (
                        <span className="font-mono text-[9px] bg-terra-500/10 text-terra-500 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                          {m.alertCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-gray-500">{m.parcelCount} parc &middot; {m.areaHa.toFixed(1)} ha</span>
                      {m.ndviAvg !== null && (
                        <span className={`font-mono tabular-nums font-semibold ${ndviColor}`}>
                          NDVI {m.ndviAvg.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {isFocused && (
                      <p className="text-[10px] text-brand-600 mt-1.5 font-mono uppercase tracking-wider">
                        → Enfocado en mapa · click para volver
                      </p>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegantesEmptyState({ userName }: { userName?: string }) {
  const firstName = userName?.split(' ')[0];
  return (
    <div className="h-full flex items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="max-w-xl w-full text-center">
        <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-9 w-auto mx-auto mb-4" />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500">
          § FITOLINK · COMUNIDAD DE REGANTES
        </p>
        <div className="w-12 h-[2px] bg-terra-500 mx-auto mt-3 mb-6" />
        <h1 className="font-display text-4xl text-brand-600 leading-tight">
          {firstName ? `Bienvenido, ${firstName}.` : 'Bienvenido a AgroM.'}
        </h1>
        <p className="text-gray-500 mt-2 text-base">
          Aún no hay socios vinculados a su Comunidad de Regantes.
        </p>
        <div className="mt-10 mb-10 text-left bg-white border border-earth-300/40 rounded-xl p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-4">
            § CÓMO EMPEZAR
          </p>
          <ol className="space-y-4 text-brand-900 text-sm leading-relaxed">
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">01</span>
              <span>
                <b className="text-brand-600 font-semibold">Comparta con sus socios</b> el enlace de
                alta. Cada agricultor crea cuenta gratis con Google y sube sus parcelas regables.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">02</span>
              <span>
                <b className="text-brand-600 font-semibold">Nuestro equipo los vincula</b> a su
                comunidad en 24h. A partir de ese momento, sus parcelas aparecen aquí agregadas
                para gestión hídrica colectiva.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs text-terra-500 leading-none w-6 pt-1 tracking-wider">03</span>
              <span>
                <b className="text-brand-600 font-semibold">Cada mañana</b> a las 7h recibirá el
                informe consolidado con estado hídrico cartera, parcelas en estrés, previsión de
                lluvia 7 días y prioridad de riego por socio.
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
