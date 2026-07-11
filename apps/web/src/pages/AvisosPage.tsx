import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';

/**
 * Tablón de avisos fitosanitarios oficiales · página PÚBLICA (sin login).
 *
 * 2º lead magnet de AgroM (idea PM 6-jun, construido 11-jun-2026). Muestra
 * los avisos oficiales de plagas que FitoLink agrega desde los boletines de
 * varias comunidades (RAIF Andalucía, DARP Cataluña, SAIF/IVIA C. Valenciana,
 * SIAM/IMIDA Murcia, ITACYL Castilla y León). Cada aviso enlaza a su fuente
 * oficial — el valor es el CANAL: ver de un vistazo qué se mueve en el campo
 * español, con el dato real de cada organismo. Conversion path: crear cuenta
 * y monitorizar tus parcelas para recibir solo los avisos de TU comarca.
 *
 * Ruta: /avisos (standalone, sin DashboardLayout).
 */

type Severity = 'low' | 'medium' | 'high';

interface PublicAdvisory {
  id: string;
  pestName: string;
  cropTypes: string[];
  severity: Severity;
  source: string;
  sourceRef: string;
  sourceUrl?: string;
  regions: string[];
  detectedAt: string;
  notes?: string;
}

const SEVERITY_META: Record<Severity, { label: string; dot: string; chip: string }> = {
  high: { label: 'Alta', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: 'Media', dot: 'bg-terra-500', chip: 'bg-orange-50 text-terra-600 border-terra-500/30' },
  low: { label: 'Baja', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const SOURCE_LABEL: Record<string, string> = {
  RAIF: 'RAIF · Andalucía',
  DARP: 'DARP · Cataluña',
  SAIF: 'SAIF / IVIA · C. Valenciana',
  SIAM: 'SIAM / IMIDA · Murcia',
  ITACYL: 'ITACYL · Castilla y León',
  MAPA: 'MAPA · Nacional',
  CSCV: 'CSCV',
  otros: 'Boletín oficial',
};

// Comunidad autónoma por fuente — para el filtro "ir al grano".
const SOURCE_REGION: Record<string, string> = {
  RAIF: 'Andalucía',
  DARP: 'Cataluña',
  SAIF: 'C. Valenciana',
  SIAM: 'Murcia',
  ITACYL: 'Castilla y León',
  MAPA: 'Nacional',
};

const CROP_LABEL: Record<string, string> = {
  olivo: 'Olivar', citrico: 'Cítrico', vinedo: 'Viñedo', frutal: 'Frutal',
  almendro: 'Almendro', pistacho: 'Pistacho', cereal: 'Cereal', patata: 'Patata',
  remolacha: 'Remolacha', maiz: 'Maíz', hortaliza: 'Hortaliza',
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function AvisosPage() {
  const { data, isLoading, isError } = useQuery<PublicAdvisory[]>({
    queryKey: ['pest-advisories-public'],
    queryFn: async () => {
      const res = await api.get('/pest-advisories/public');
      return res.data.data;
    },
    staleTime: 30 * 60 * 1000,
  });

  const advisories = data ?? [];
  const [region, setRegion] = useState<string | null>(null);

  const stats = useMemo(() => {
    const sources = new Set(advisories.map((a) => a.source));
    const high = advisories.filter((a) => a.severity === 'high').length;
    return { total: advisories.length, sources: sources.size, high };
  }, [advisories]);

  // Comunidades presentes (para los chips de filtro) + lista filtrada.
  const regions = useMemo(
    () => Array.from(new Set(advisories.map((a) => SOURCE_REGION[a.source] ?? a.source))).sort(),
    [advisories],
  );
  const filtered = region ? advisories.filter((a) => SOURCE_REGION[a.source] === region) : advisories;

  return (
    <div className="min-h-screen bg-earth-50 text-brand-900">
      {/* Header */}
      <header className="border-b border-earth-300/40 bg-white">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Volver a la página principal" className="inline-flex items-center gap-1.5 rounded-full border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-sm transition-colors hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Volver
            </Link>
            <Link to="/" className="font-display text-xl font-bold text-brand-700">
              Agro<span className="text-terra-500">M</span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-earth-400 align-middle">FitoLink</span>
            </Link>
          </div>
          <Link
            to="/login"
            className="px-5 py-2 bg-brand-600 text-white rounded-full text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Acceder
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-12 pb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-earth-400 mb-3">
          § Servicio público · España
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-brand-800 leading-[1.05]">
          Avisos fitosanitarios oficiales
        </h1>
        <p className="mt-3 font-display text-xl md:text-2xl text-brand-900/55 italic max-w-2xl">
          Lo que se mueve en el campo español, en un solo sitio.
        </p>
        <p className="mt-4 text-base text-brand-900/70 max-w-2xl leading-relaxed">
          FitoLink reúne los boletines oficiales de plagas de las comunidades
          autónomas y los pone en un mapa común. Cada aviso enlaza a su fuente
          oficial — el dato es de cada organismo, nosotros abrimos el canal.
          La fecha de cada aviso es la de su publicación oficial o la de su
          última verificación por nuestro equipo.
        </p>

        {/* Stats */}
        <div className="mt-7 flex flex-wrap gap-6">
          <Stat n={stats.total} label="avisos oficiales" />
          <Stat n={stats.sources} label="fuentes oficiales" />
          <Stat n={stats.high} label="severidad alta" accent />
        </div>
        {advisories.length > 0 && (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-earth-400">
            Última revisión del tablón:{' '}
            {fmtDate(advisories.reduce((m, a) => (a.detectedAt > m ? a.detectedAt : m), advisories[0].detectedAt))}
          </p>
        )}
      </section>

      {/* Lista */}
      <section className="max-w-5xl mx-auto px-5 pb-16">
        {isLoading && (
          <p className="text-sm text-earth-400 py-10 text-center font-mono uppercase tracking-wider">Cargando avisos…</p>
        )}
        {isError && (
          <p className="text-sm text-red-600 py-10 text-center">No se pudieron cargar los avisos. Intente recargar.</p>
        )}
        {!isLoading && !isError && advisories.length === 0 && (
          <p className="text-sm text-earth-400 py-10 text-center">
            Ahora mismo no hay avisos vigentes en el tablón. Consulte el portal oficial de su comunidad.
          </p>
        )}

        {/* Filtro por comunidad — ir al grano */}
        {regions.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="font-mono text-[10px] uppercase tracking-wider text-earth-400 mr-1">Comunidad:</span>
            <FilterChip label={`Todas (${advisories.length})`} active={region === null} onClick={() => setRegion(null)} />
            {regions.map((r) => (
              <FilterChip
                key={r}
                label={`${r} (${advisories.filter((a) => SOURCE_REGION[a.source] === r).length})`}
                active={region === r}
                onClick={() => setRegion(r)}
              />
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => {
            const sev = SEVERITY_META[a.severity] ?? SEVERITY_META.medium;
            return (
              <article key={a.id} className="bg-white rounded-xl border border-earth-300/40 overflow-hidden flex flex-col">
                {/* Franja fuente */}
                <div className="bg-brand-700 px-4 py-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-earth-50/80">
                    {SOURCE_LABEL[a.source] ?? a.source}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sev.chip}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="font-display text-lg font-bold text-brand-800 leading-snug">{a.pestName}</h2>

                  {/* Cultivos + regiones */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.cropTypes.map((c) => (
                      <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                        {CROP_LABEL[c] ?? c}
                      </span>
                    ))}
                    {a.regions.map((r) => (
                      <span key={r} className="text-[10px] px-2 py-0.5 rounded bg-earth-100 text-earth-500">{r}</span>
                    ))}
                  </div>

                  {a.notes && (
                    <p className="mt-3 text-[13px] text-brand-900/70 leading-relaxed line-clamp-4">{a.notes}</p>
                  )}

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-earth-300/30 mt-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-earth-400">
                      {fmtDate(a.detectedAt)}
                    </span>
                    {a.sourceUrl && (
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-terra-600 hover:text-terra-700"
                      >
                        Boletín oficial ↗
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-earth-400">
          Avisos curados por el equipo técnico AgroM desde boletines oficiales
        </p>
      </section>

      {/* Nota de servicio público (no anuncio): el tablón es abierto y gratuito;
          la cuenta solo se ofrece como opción para filtrar por comarca. */}
      <section className="border-t border-earth-300/40 bg-white">
        <div className="max-w-5xl mx-auto px-5 py-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-earth-400 mb-2">
            § Servicio abierto de AgroM
          </p>
          <h2 className="font-display text-xl font-bold text-brand-800">
            Este tablón es público y gratuito.
          </h2>
          <p className="mt-3 text-brand-900/65 max-w-xl mx-auto leading-relaxed text-sm">
            Consúltalo siempre que quieras, sin cuenta. Si además te interesa recibir
            solo los avisos de tu comarca y tu cultivo —cruzados con el estado de tus
            parcelas por satélite— puedes crear una cuenta en FitoLink.
          </p>
          <Link
            to="/login"
            className="inline-block mt-5 text-sm font-semibold text-terra-600 hover:text-terra-700"
          >
            Crear cuenta en FitoLink →
          </Link>
        </div>
      </section>

      <footer className="bg-brand-900 text-earth-50/50 py-6">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em]">
          AgroM · Inteligencia agraria de precisión · fitolink.agrom.es
        </p>
      </footer>
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`font-display text-3xl font-bold ${accent ? 'text-terra-500' : 'text-brand-700'}`}>{n}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-earth-400 mt-0.5">{label}</p>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-brand-700 text-earth-50 border-brand-700'
          : 'bg-white text-brand-700 border-earth-300/60 hover:border-brand-700/40'
      }`}
    >
      {label}
    </button>
  );
}
