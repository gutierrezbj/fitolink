import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

/**
 * Sprint FIRMS · B (UI card § FOCOS TÉRMICOS) · 04-jun-2026.
 *
 * Muestra los focos térmicos activos detectados por NASA FIRMS (VIIRS
 * 375m, casi-tiempo-real) dentro de un radio de la parcela. Crítico
 * en verano mediterráneo — el agricultor recibe aviso del fuego antes
 * de verlo en redes sociales o por una vecina.
 *
 * Armonizada con MpcContextWidget / SoilProfileCard: header bg-brand-600
 * + eyebrow font-mono "§ FOCOS TÉRMICOS · NASA FIRMS VIIRS".
 *
 * Estados:
 *  · 0 focos en 7 días → empty state suave "Sin focos activos en su zona"
 *  · 1+ focos → lista ordenada por distancia con info crítica de cada uno
 *  · Si hay 1+ foco < 5 km → highlight rojo arriba (proximidad crítica)
 */

interface FireDetection {
  latitude: number;
  longitude: number;
  brightness: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  confidence: string;
  frp: number;
  dayNight: 'D' | 'N';
  distanceKm: number;
}

interface Props {
  parcelId: string;
}

const RADIUS_KM = 25;
const DAYS = 7;
const CRITICAL_DISTANCE_KM = 5;

const CONFIDENCE_LABEL: Record<string, string> = {
  l: 'baja',
  n: 'nominal',
  h: 'alta',
};

const SATELLITE_LABEL: Record<string, string> = {
  N: 'Suomi-NPP',
  '1': 'NOAA-20',
};

function formatTime(acqTime: string): string {
  // FIRMS devuelve HHMM como string; 0930 → "09:30 UTC"
  if (acqTime.length !== 4) return acqTime;
  return `${acqTime.slice(0, 2)}:${acqTime.slice(2)} UTC`;
}

function relativeDateLabel(acqDate: string): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const fire = new Date(acqDate);
  fire.setUTCHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - fire.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 7) return `hace ${diff} días`;
  return acqDate;
}

export default function FireProximityCard({ parcelId }: Props) {
  const { data, isLoading } = useQuery<{ data: FireDetection[]; meta: { count: number } }>({
    queryKey: ['fires', parcelId, RADIUS_KM, DAYS],
    queryFn: async () => {
      const res = await api.get(`/parcels/${parcelId}/fires?radiusKm=${RADIUS_KM}&days=${DAYS}`);
      return { data: res.data.data as FireDetection[], meta: res.data.meta };
    },
    staleTime: 60 * 60 * 1000, // 1 hora — NASA FIRMS actualiza ~3h
    refetchOnWindowFocus: false,
  });

  const fires = data?.data ?? [];
  const nearestKm = fires[0]?.distanceKm ?? null;
  const criticalFires = fires.filter((f) => f.distanceKm <= CRITICAL_DISTANCE_KM);
  const hasCritical = criticalFires.length > 0;

  // ── Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-earth-300/30 overflow-hidden">
        <div className="bg-brand-600 px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
            § FOCOS TÉRMICOS · NASA FIRMS VIIRS
          </p>
        </div>
        <div className="p-6 text-center text-sm text-gray-500">Consultando NASA FIRMS…</div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-earth-300/30 overflow-hidden">
      {/* Header */}
      <div className="bg-brand-600 px-4 py-2.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
          § FOCOS TÉRMICOS · NASA FIRMS VIIRS
        </p>
        <p className="font-mono text-[9px] text-earth-50/60 tracking-wide">
          Gratis · 375 m
        </p>
      </div>

      {/* Banner crítico si hay foco < 5 km */}
      {hasCritical && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center font-bold">
            !
          </div>
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-700 mb-0.5">
              Proximidad crítica
            </p>
            <p className="text-sm font-semibold text-red-900 leading-snug">
              {criticalFires.length} foco{criticalFires.length === 1 ? '' : 's'} térmico{criticalFires.length === 1 ? '' : 's'} detectado{criticalFires.length === 1 ? '' : 's'} a menos de {CRITICAL_DISTANCE_KM} km de su parcela.
            </p>
            <p className="text-xs text-red-800 mt-1 leading-relaxed">
              El más cercano a <span className="font-semibold">{nearestKm} km</span>. Verifique con autoridades locales (112 / Plan INFOCA) si su finca está en riesgo.
            </p>
          </div>
        </div>
      )}

      {/* Contenido */}
      {fires.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="font-display text-lg text-brand-900 mb-1">
            Sin focos activos en su zona.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-gray-500">
            Últimos {DAYS} días · radio {RADIUS_KM} km
          </p>
        </div>
      ) : (
        <div>
          {!hasCritical && (
            <div className="px-5 py-3 bg-earth-50 border-b border-earth-300/30">
              <p className="text-sm text-brand-900">
                {fires.length} foco{fires.length === 1 ? '' : 's'} térmico{fires.length === 1 ? '' : 's'} detectado{fires.length === 1 ? '' : 's'} en su zona. El más cercano a {nearestKm} km — fuera del rango crítico ({CRITICAL_DISTANCE_KM} km).
              </p>
            </div>
          )}
          <ul className="divide-y divide-earth-300/30">
            {fires.slice(0, 10).map((f, i) => (
              <li key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className={`text-lg font-bold tabular-nums ${f.distanceKm <= CRITICAL_DISTANCE_KM ? 'text-red-700' : 'text-brand-900'}`}>
                      {f.distanceKm} km
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                      {relativeDateLabel(f.acqDate)} · {formatTime(f.acqTime)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {SATELLITE_LABEL[f.satellite] ?? f.satellite} ·
                    {' '}brillo {f.brightness.toFixed(0)} K ·
                    {' '}FRP {f.frp.toFixed(1)} MW ·
                    {' '}confianza {CONFIDENCE_LABEL[f.confidence] ?? f.confidence} ·
                    {' '}{f.dayNight === 'D' ? 'día' : 'noche'}
                  </p>
                </div>
                <div className="font-mono text-[10px] text-gray-400 tabular-nums flex-shrink-0 text-right">
                  {f.latitude.toFixed(3)}<br />
                  {f.longitude.toFixed(3)}
                </div>
              </li>
            ))}
          </ul>
          {fires.length > 10 && (
            <p className="px-5 py-2 text-xs text-gray-500 text-center border-t border-earth-300/30 bg-earth-50">
              Mostrando 10 de {fires.length} focos detectados.
            </p>
          )}
        </div>
      )}

      {/* Footer técnico */}
      <div className="px-4 py-2 border-t border-earth-300/30 bg-earth-50 flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">
          NASA FIRMS · VIIRS Suomi-NPP + NOAA-20 · 375 m · cuasi-tiempo-real
        </p>
        <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400">
          Actualización ~3 h
        </p>
      </div>
    </div>
  );
}
