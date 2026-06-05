import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api.js';
import DownloadReportButtons from './DownloadReportButtons.js';

/**
 * CooperativeMembersPage — segunda pestaña del rol `cooperative`.
 *
 * Sprint Onboarding Cooperativa básico · 05-jun-2026.
 *
 * Antes el rol cooperative solo tenía "Inicio" (dashboard agregado) en el
 * nav. Eso transmitía "demasiado simple" a un prospect porque parecía que
 * la herramienta es solo un panel. Esta página le da un segundo entry
 * point editorial — Socios — donde el responsable de la cooperativa ve
 * con detalle cada agricultor de su cartera: parcelas, hectáreas, NDVI
 * medio, alertas activas, contacto.
 *
 * Endpoint: reusa `/cooperative/overview` (ya existe) — el shape devuelto
 * incluye `members[]` con todos los datos que necesitamos por socio.
 *
 * V2 (cuando hay deal cerrado con cooperativa real):
 *   · Alta/baja de socios (PATCH user.cooperativeId)
 *   · Export PDF/CSV cartera para junta directiva
 *   · Contacto directo socio (WhatsApp / email un-click)
 *   · Filtros por estado NDVI / con alertas / por superficie
 *   · Ordenamiento configurable
 */

interface SocioRow {
  _id: string;
  name: string;
  parcelCount: number;
  areaHa: number;
  ndviAvg: number | null;
  alertCount: number;
}

interface OverviewResponse {
  members: SocioRow[];
  kpis: {
    memberCount: number;
    areaHa: number;
    ndviAvg: number | null;
    activeAlerts: number;
    criticalAlerts: number;
  };
}

type SortKey = 'urgency' | 'name' | 'totalHa' | 'avgNdvi';

function ndviColor(ndvi: number | null): string {
  if (ndvi === null) return 'text-gray-400';
  if (ndvi < 0.30) return 'text-red-600';
  if (ndvi < 0.45) return 'text-terra-500';
  if (ndvi < 0.55) return 'text-yellow-600';
  return 'text-green-600';
}

function ndviLabel(ndvi: number | null): string {
  if (ndvi === null) return 'sin datos';
  if (ndvi < 0.30) return 'crítico';
  if (ndvi < 0.45) return 'bajo';
  if (ndvi < 0.55) return 'medio';
  return 'sano';
}

export default function CooperativeMembersPage() {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [filter, setFilter] = useState<'all' | 'alerts' | 'critical'>('all');

  const { data, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['cooperative', 'overview'],
    queryFn: async () => {
      const res = await api.get('/cooperative/overview');
      return res.data.data;
    },
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const members = data?.members ?? [];
  const kpis = data?.kpis;

  // Aplica filtro primero
  const filtered = members.filter((m) => {
    if (filter === 'alerts') return m.alertCount > 0;
    if (filter === 'critical') return (m.ndviAvg ?? 0) < 0.30 || m.alertCount > 2;
    return true;
  });

  // Sort según selección
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'urgency') {
      // Urgencia: más alertas → NDVI más bajo → orden alfabético como tie-break
      if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
      const aN = a.ndviAvg ?? 1;
      const bN = b.ndviAvg ?? 1;
      if (aN !== bN) return aN - bN;
      return a.name.localeCompare(b.name);
    }
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'totalHa') return b.areaHa - a.areaHa;
    if (sortKey === 'avgNdvi') {
      const aN = a.ndviAvg ?? 1;
      const bN = b.ndviAvg ?? 1;
      return aN - bN; // peor primero
    }
    return 0;
  });

  return (
    <div className="space-y-5">
      {/* Header editorial */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mb-1">
            § CARTERA · SOCIOS DE LA COOPERATIVA
          </p>
          <h1 className="font-display text-2xl text-brand-900">
            Sus socios, vistos en detalle.
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {kpis?.memberCount ?? 0} socios · {(kpis?.areaHa ?? 0).toFixed(0)} ha bajo seguimiento · NDVI medio cartera {kpis?.ndviAvg !== null && kpis?.ndviAvg !== undefined ? kpis.ndviAvg.toFixed(2) : '—'}
          </p>
        </div>
        <DownloadReportButtons />
      </div>

      {/* Filtros + Sort */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-earth-300/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mr-1">Filtrar:</span>
          {(['all', 'alerts', 'critical'] as const).map((f) => {
            const isActive = filter === f;
            const label = f === 'all' ? `Todos (${members.length})` : f === 'alerts' ? `Con avisos (${members.filter((m) => m.alertCount > 0).length})` : `Críticos (${members.filter((m) => (m.ndviAvg ?? 1) < 0.30 || m.alertCount > 2).length})`;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mr-1">Ordenar:</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-brand-500 outline-none"
          >
            <option value="urgency">Urgencia (avisos + NDVI bajo)</option>
            <option value="name">Nombre A-Z</option>
            <option value="totalHa">Hectáreas (mayor primero)</option>
            <option value="avgNdvi">NDVI (peor primero)</option>
          </select>
        </div>
      </div>

      {/* Lista de socios */}
      {sorted.length === 0 ? (
        <div className="bg-white border border-earth-300/30 rounded-xl p-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-3">§ SIN SOCIOS</p>
          <p className="text-brand-900 font-display text-lg mb-1">
            No hay socios que coincidan con el filtro.
          </p>
          <p className="text-sm text-gray-500">
            {filter !== 'all' && 'Prueba con "Todos" para ver la cartera completa.'}
            {filter === 'all' && members.length === 0 && 'Aún no hay socios vinculados a esta cooperativa.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((m, idx) => {
            const ndviC = ndviColor(m.ndviAvg);
            const ndviL = ndviLabel(m.ndviAvg);
            const hasAlerts = m.alertCount > 0;
            return (
              <div
                key={m._id}
                className={`bg-white border rounded-xl px-5 py-4 flex items-center gap-4 hover:shadow-sm transition-all ${
                  hasAlerts ? 'border-terra-500/40' : 'border-earth-300/30'
                }`}
              >
                {/* Rank index — apoya el sentido de orden por urgencia */}
                <div className="font-mono text-[10px] tracking-wider text-gray-400 w-6 flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* Avatar inicial */}
                <div className="w-10 h-10 rounded-full bg-earth-100 flex items-center justify-center font-bold text-brand-900 text-sm flex-shrink-0">
                  {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Datos socio */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-brand-900 text-sm truncate">{m.name}</p>
                    {hasAlerts && (
                      <span className="font-mono text-[9px] bg-terra-500/10 text-terra-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {m.alertCount} aviso{m.alertCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {m.parcelCount} parcela{m.parcelCount > 1 ? 's' : ''} · {m.areaHa.toFixed(1)} ha
                  </p>
                </div>

                {/* NDVI */}
                <div className="text-right flex-shrink-0">
                  <p className={`font-display text-2xl tabular-nums leading-none ${ndviC}`}>
                    {m.ndviAvg !== null ? m.ndviAvg.toFixed(2) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{ndviL}</p>
                </div>

                {/* CTA "Ver parcelas" — V2 navegará a vista parcelas-del-socio */}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex-shrink-0 ml-2"
                  title="Volver al mapa agregado (V2: vista parcelas del socio)"
                >
                  Ver →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Banner V2 — qué viene */}
      <div className="bg-earth-50 border border-earth-300/30 rounded-xl p-5 mt-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-gray-500 mb-2">
          § PRÓXIMAS MEJORAS · CARTERA
        </p>
        <ul className="text-sm text-gray-600 space-y-1.5 leading-relaxed">
          <li>· Alta/baja de socios desde el panel (vincular agricultor con un click)</li>
          <li>· Exportar cartera en PDF/CSV para junta directiva</li>
          <li>· Contacto directo socio · WhatsApp y email un-click</li>
          <li>· Vista detalle por socio · todas sus parcelas + histórico</li>
        </ul>
        <p className="text-[10px] text-gray-400 mt-3">
          Lo construimos según vayan llegando los primeros clientes cooperativa. ¿Falta algo crítico para usted? — escríbanos.
        </p>
      </div>
    </div>
  );
}
