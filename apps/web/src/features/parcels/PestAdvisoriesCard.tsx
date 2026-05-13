import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

/**
 * Ola 1.5 · Pieza 3 — Pest advisories card.
 *
 * Shows the curated phytosanitary advisories whose comarca radius covers
 * this parcel and whose crop matches. The agronomist enters each
 * advisory from the official RAIF / MAPA / SAIF bulletin in the admin
 * panel; this widget reads them via the parcel-scoped endpoint.
 *
 * Empty state is intentionally non-alarming — most of the year no
 * advisory is active on a given parcel, and that is good news.
 */

type Severity = 'low' | 'medium' | 'high';
type Source = 'RAIF' | 'MAPA' | 'SAIF' | 'SIAM' | 'CSCV' | 'otros';

interface PestAdvisory {
  advisoryId: string;
  pestName: string;
  scientificName?: string;
  severity: Severity;
  source: Source;
  sourceRef?: string;
  detectedAt: string;
  expiresAt: string;
  comarca?: string;
  province: string;
  distanceKm: number;
  recommendation?: string;
  sourceUrl?: string;
  message: string;
}

interface Props {
  parcelId: string;
}

const SEV_TONE: Record<Severity, { strip: string; pill: string; dot: string; label: string }> = {
  high:   { strip: 'bg-red-700',   pill: 'bg-red-700/10 text-red-700',     dot: 'bg-red-700',   label: 'severidad alta'  },
  medium: { strip: 'bg-earth-400', pill: 'bg-earth-400/15 text-earth-400', dot: 'bg-earth-400', label: 'severidad media' },
  low:    { strip: 'bg-slate-500',    pill: 'bg-slate-500/15 text-slate-500',       dot: 'bg-slate-500',    label: 'severidad baja'  },
};

export default function PestAdvisoriesCard({ parcelId }: Props) {
  const { data, isLoading } = useQuery<PestAdvisory[]>({
    queryKey: ['pest-advisories', parcelId],
    queryFn: async () => {
      const res = await api.get(`/parcels/${parcelId}/insights/pest-advisories`);
      return res.data.data;
    },
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="bg-white rounded-xl border border-earth-300/30 overflow-hidden">
      {/* Brand strip header */}
      <div className="bg-brand-700 px-4 py-2.5 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-earth-50/70">
          § AVISOS FITOSANITARIOS EN SU COMARCA
        </p>
        {data && (
          <p className="font-mono text-[9px] text-earth-50/60 tracking-wide">
            {data.length} activo{data.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {isLoading || !data ? (
        <div className="p-6 text-center text-sm text-gray-500">Consultando avisos…</div>
      ) : data.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="font-display text-lg text-brand-900 mb-1">Sin avisos activos en su zona.</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-gray-500">
            Los boletines oficiales no reportan actividad relevante para su cultivo
          </p>
        </div>
      ) : (
        <ul>
          {data.map((adv) => {
            const tone = SEV_TONE[adv.severity];
            return (
              <li key={adv.advisoryId} className="flex border-t border-earth-300/20 first:border-t-0">
                <span className={`w-1 flex-shrink-0 ${tone.strip}`} />
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-700">
                      <span className="text-terra-500">§</span>{' '}
                      {adv.pestName}
                      {adv.scientificName && (
                        <span className="text-gray-500 italic ml-1 normal-case tracking-normal">
                          ({adv.scientificName})
                        </span>
                      )}
                      <span className="text-gray-500 mx-2">·</span>
                      <span className="text-gray-500">
                        {adv.comarca ? `comarca ${adv.comarca}` : adv.province}
                      </span>
                      <span className="text-gray-500 mx-2">·</span>
                      <span className="text-gray-500">a {adv.distanceKm} km</span>
                    </p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider ${tone.pill}`}>
                      <span className={`w-1 h-1 rounded-full ${tone.dot}`} />
                      {tone.label}
                    </span>
                  </div>
                  <p className="text-sm text-brand-900 leading-relaxed">
                    {adv.message}
                  </p>
                  {(adv.sourceRef || adv.sourceUrl) && (
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mt-2">
                      {adv.sourceUrl ? (
                        <a href={adv.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-700 transition-colors underline-offset-2 hover:underline">
                          {adv.source}{adv.sourceRef ? ` · ${adv.sourceRef}` : ''} ↗
                        </a>
                      ) : (
                        `${adv.source}${adv.sourceRef ? ` · ${adv.sourceRef}` : ''}`
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer attribution */}
      <div className="px-4 py-2 border-t border-earth-300/30 bg-earth-50/60">
        <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500 text-center">
          AVISOS CURADOS POR EL EQUIPO TÉCNICO AGROM DESDE BOLETINES OFICIALES
        </p>
      </div>
    </div>
  );
}
