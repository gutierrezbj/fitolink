import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

/**
 * Sprint SoilGrids · B (UI card § SUELO) · 22-may-2026.
 *
 * Card editorial que muestra el perfil edáfico estático de la parcela,
 * descargado de ISRIC SoilGrids 250m al crear la parcela (fire-and-forget)
 * o vía botón manual si la auto-descarga falló.
 *
 * Armonizada con MpcContextWidget y los demás bloques de la parcela:
 * header bg-brand-600 + eyebrow font-mono "§ SUELO · SOILGRIDS 250M".
 *
 * Diseño:
 *  · Banner principal con textura dominante (arcilla / franco / etc) que
 *    es el dato más legible para un agricultor no-técnico.
 *  · Triángulo textural simplificado: 3 barras horizontales con %arcilla,
 *    %arena, %limo. Suman 100. Visualmente claro.
 *  · 3 cifras agronómicas en grilla: capacidad agua disponible (fracción),
 *    carbono orgánico (g/kg), densidad aparente (g/cm³).
 *  · Footer técnico citando ISRIC + capa 0-30 cm + punto muestreado.
 *
 * Empty state: si la parcela no tiene perfil aún, muestra CTA "Calcular
 * perfil de suelo" que dispara POST /parcels/:id/soil/refresh.
 */

interface SoilProfile {
  source: string; // 'soilgrids-v2' | 'lab-measured'
  fetchedAt: string;
  clayPct: number;
  sandPct: number;
  siltPct: number;
  organicCarbonGkg: number;
  organicMatterPct?: number;
  bulkDensityGcm3?: number;
  fieldCapacityVol: number;
  dominantTexture: string;
  measuredOn?: string;
  sampleLabel?: string;
  sampledAt: { lat: number; lng: number };
}

interface Props {
  parcelId: string;
  soil?: SoilProfile | null;
}

export default function SoilProfileCard({ parcelId, soil }: Props) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/parcels/${parcelId}/soil/refresh`);
      return res.data.data as SoilProfile;
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['parcel', parcelId] });
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      setErrorMsg(e.response?.data?.error?.message ?? e.message ?? 'No se pudo descargar el perfil de suelo.');
    },
  });

  // ── Empty state ──────────────────────────────────────────────────────
  if (!soil) {
    return (
      <div className="bg-white rounded-xl border border-earth-300/30 overflow-hidden">
        <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
            § SUELO · SOILGRIDS 250M
          </p>
          <p className="font-mono text-[9px] text-earth-50/60 tracking-wide">
            Gratis · Global
          </p>
        </div>
        <div className="px-5 py-6 text-center">
          <p className="font-display text-base text-brand-900 mb-1">
            Perfil edáfico no calculado todavía.
          </p>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto leading-relaxed">
            Una vez calculado, sabremos la textura del suelo, su capacidad de
            retención hídrica y el carbono orgánico — info estructural que NO
            cambia y que matiza la interpretación de cada lectura satelital.
          </p>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
          >
            {refreshMutation.isPending ? 'Calculando…' : 'Calcular perfil de suelo'}
          </button>
          {errorMsg && (
            <p className="text-xs text-red-600 mt-3">{errorMsg}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Cargado: render del perfil ───────────────────────────────────────
  const isMeasured = soil.source === 'lab-measured';
  return (
    <div className="bg-white rounded-xl border border-earth-300/30 overflow-hidden">
      {/* Brand strip header */}
      <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
          {isMeasured ? '§ SUELO · ANÁLISIS DE LABORATORIO' : '§ SUELO · SOILGRIDS 250M'}
        </p>
        {isMeasured ? (
          <span className="font-mono text-[9px] uppercase tracking-wider bg-emerald-400/90 text-emerald-950 rounded px-1.5 py-0.5">
            Medido en campo
          </span>
        ) : (
          <p className="font-mono text-[9px] text-earth-50/60 tracking-wide">Gratis · Global</p>
        )}
      </div>

      <div className="p-4">
        {/* Textura dominante — protagonista */}
        <div className="flex items-baseline gap-3 mb-4">
          <p className="font-display text-2xl text-brand-900 capitalize leading-tight">
            {soil.dominantTexture}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
            textura USDA
          </p>
        </div>

        {/* Composición textural — 3 barras */}
        <div className="space-y-2 mb-5">
          <TextureBar label="Arcilla" pct={soil.clayPct} color="bg-earth-400" />
          <TextureBar label="Arena" pct={soil.sandPct} color="bg-earth-300" />
          <TextureBar label="Limo" pct={soil.siltPct} color="bg-earth-200" />
        </div>

        {/* Métricas agronómicas: 2 si es medido (M.O. real, sin densidad que el
            laboratorio no mide), 3 si es estimación satelital */}
        <div className={`grid ${isMeasured ? 'grid-cols-2' : 'grid-cols-3'} gap-px bg-earth-300/30 border-t border-earth-300/30 -mx-4 -mb-4 mt-2`}>
          <Metric
            label="Cap. agua disponible"
            value={`${Math.round(soil.fieldCapacityVol * 100)}%`}
            sub={isMeasured ? 'derivada de la textura' : 'vol. campo capacity'}
          />
          {isMeasured && soil.organicMatterPct != null ? (
            <Metric
              label="Materia orgánica"
              value={`${soil.organicMatterPct.toFixed(2)}%`}
              sub={`${soil.organicCarbonGkg.toFixed(1)} g/kg C orgánico`}
            />
          ) : (
            <Metric
              label="Carbono orgánico"
              value={`${soil.organicCarbonGkg.toFixed(1)}`}
              sub="g/kg C orgánico"
            />
          )}
          {!isMeasured && (
            <Metric
              label="Densidad aparente"
              value={soil.bulkDensityGcm3 != null ? soil.bulkDensityGcm3.toFixed(2) : '—'}
              sub="g/cm³"
            />
          )}
        </div>
      </div>

      {/* Footer técnico */}
      <div className="px-4 py-2 border-t border-earth-300/30 bg-earth-50 flex items-center justify-between gap-3">
        {isMeasured ? (
          <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 truncate">
            Análisis de laboratorio
            {soil.measuredOn ? ` · ${new Date(soil.measuredOn).toLocaleDateString('es-ES')}` : ''}
            {soil.sampleLabel ? ` · muestra «${soil.sampleLabel}»` : ''}
          </p>
        ) : (
          <>
            <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">
              ISRIC SoilGrids v2.0 · capa 0–30 cm · {soil.sampledAt.lat.toFixed(4)}, {soil.sampledAt.lng.toFixed(4)}
            </p>
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="font-mono text-[9px] uppercase tracking-wider text-brand-600 hover:text-brand-700 disabled:opacity-50 flex-shrink-0"
            >
              {refreshMutation.isPending ? 'Actualizando…' : 'Refrescar'}
            </button>
          </>
        )}
      </div>
      {errorMsg && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-700">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function TextureBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-500 tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-brand-900 tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
