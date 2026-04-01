import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* ─────────────────────────── SCROLL REVEAL HOOK ─────────────────────────── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ───────────────────────── ANIMATED COUNTER ────────────────────────── */

function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0;
        const step = Math.max(1, Math.floor(end / 40));
        const id = setInterval(() => {
          start += step;
          if (start >= end) { setVal(end); clearInterval(id); }
          else setVal(start);
        }, 30);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ─────────────────────── SVG ILLUSTRATIONS ──────────────────────── */

function SatelliteSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="45" y="45" width="30" height="30" rx="4" fill="#16a34a" opacity="0.9"/>
      <rect x="50" y="50" width="20" height="20" rx="2" fill="#22c55e"/>
      <rect x="10" y="52" width="32" height="16" rx="3" fill="#16a34a" opacity="0.7"/>
      <rect x="78" y="52" width="32" height="16" rx="3" fill="#16a34a" opacity="0.7"/>
      <rect x="14" y="55" width="10" height="10" rx="1" fill="#4ade80" opacity="0.5"/>
      <rect x="96" y="55" width="10" height="10" rx="1" fill="#4ade80" opacity="0.5"/>
      <line x1="60" y1="75" x2="60" y2="95" stroke="#16a34a" strokeWidth="2" opacity="0.5"/>
      <circle cx="60" cy="98" r="3" fill="#22c55e" opacity="0.4"/>
      {/* Scan beams */}
      <path d="M52 75 L40 110" stroke="#4ade80" strokeWidth="1" opacity="0.3" strokeDasharray="3 3"/>
      <path d="M68 75 L80 110" stroke="#4ade80" strokeWidth="1" opacity="0.3" strokeDasharray="3 3"/>
      <path d="M40 110 L80 110" stroke="#4ade80" strokeWidth="1" opacity="0.2"/>
    </svg>
  );
}

function DroneSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="45" y="50" width="30" height="20" rx="6" fill="#166534"/>
      <rect x="50" y="54" width="20" height="12" rx="3" fill="#22c55e"/>
      {/* Arms */}
      <line x1="45" y1="55" x2="20" y2="40" stroke="#166534" strokeWidth="3" strokeLinecap="round"/>
      <line x1="75" y1="55" x2="100" y2="40" stroke="#166534" strokeWidth="3" strokeLinecap="round"/>
      <line x1="45" y1="65" x2="20" y2="80" stroke="#166534" strokeWidth="3" strokeLinecap="round"/>
      <line x1="75" y1="65" x2="100" y2="80" stroke="#166534" strokeWidth="3" strokeLinecap="round"/>
      {/* Rotors */}
      <ellipse cx="20" cy="40" rx="14" ry="3" fill="#4ade80" opacity="0.4"/>
      <ellipse cx="100" cy="40" rx="14" ry="3" fill="#4ade80" opacity="0.4"/>
      <ellipse cx="20" cy="80" rx="14" ry="3" fill="#4ade80" opacity="0.4"/>
      <ellipse cx="100" cy="80" rx="14" ry="3" fill="#4ade80" opacity="0.4"/>
      <circle cx="20" cy="40" r="3" fill="#166534"/>
      <circle cx="100" cy="40" r="3" fill="#166534"/>
      <circle cx="20" cy="80" r="3" fill="#166534"/>
      <circle cx="100" cy="80" r="3" fill="#166534"/>
      {/* Camera */}
      <rect x="55" y="70" width="10" height="6" rx="2" fill="#14532d"/>
    </svg>
  );
}

function FieldPatternSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Terrain patches */}
      <path d="M0 180 Q100 120 200 150 Q300 180 400 140 L400 200 L0 200Z" fill="#16a34a" opacity="0.08"/>
      <path d="M0 190 Q150 160 250 175 Q350 190 400 170 L400 200 L0 200Z" fill="#16a34a" opacity="0.05"/>
      {/* Grid lines representing parcels */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <line key={`h${i}`} x1="0" y1={140 + i * 8} x2="400" y2={140 + i * 8} stroke="#22c55e" strokeWidth="0.5" opacity="0.1"/>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <line key={`v${i}`} x1={i * 40} y1="130" x2={i * 40} y2="200" stroke="#22c55e" strokeWidth="0.5" opacity="0.1"/>
      ))}
    </svg>
  );
}

/* ──────────────────────── BACKGROUND GRID ───────────────────────── */

function GridBG() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(22,163,74,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,163,74,1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.08) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ──────────────────────────── NAVBAR ─────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-[0_1px_0_rgba(22,163,74,0.1)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <span className="text-white text-sm font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>F</span>
          </div>
          <span className="text-lg font-semibold text-brand-800 tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            FitoLink
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          <a href="#como-funciona" className="text-gray-500 hover:text-brand-700 transition-colors">Proceso</a>
          <a href="#roles" className="text-gray-500 hover:text-brand-700 transition-colors">Roles</a>
          <a href="#stats" className="text-gray-500 hover:text-brand-700 transition-colors">Ventajas</a>
          <Link
            to="/login"
            className="px-5 py-2 bg-brand-600 text-white rounded-full text-sm font-medium hover:bg-brand-700 transition-all hover:shadow-lg hover:shadow-brand-500/25"
          >
            Acceder
          </Link>
        </div>
        <Link
          to="/login"
          className="md:hidden px-4 py-1.5 bg-brand-600 text-white rounded-full text-xs font-medium"
        >
          Acceder
        </Link>
      </div>
    </nav>
  );
}

/* ──────────────────────────── HERO ───────────────────────────────── */

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#fafdf7]">
      <GridBG />

      {/* Floating satellite */}
      <div className="absolute top-24 right-[8%] hidden lg:block animate-[float_8s_ease-in-out_infinite]">
        <SatelliteSVG className="w-32 h-32 opacity-50" />
      </div>

      {/* Floating drone */}
      <div className="absolute bottom-32 left-[6%] hidden lg:block animate-[float_6s_ease-in-out_infinite_1s]">
        <DroneSVG className="w-28 h-28 opacity-40" />
      </div>

      {/* Scan line effect */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent animate-[scanline_4s_ease-in-out_infinite]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-20">
        {/* Chip */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200/60 mb-8 animate-[fadeUp_0.8s_ease_both]"
        >
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs font-medium text-brand-700 tracking-wide uppercase" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Agricultura de precisi&oacute;n
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal leading-[0.95] tracking-tight text-gray-900 mb-6 animate-[fadeUp_0.8s_ease_0.1s_both]"
          style={{ fontFamily: 'Instrument Serif, serif' }}
        >
          Del pixel al<br />
          <span className="relative">
            <span className="text-brand-600">tratamiento</span>
            <svg className="absolute -bottom-2 left-0 w-full h-3 text-brand-300/50" viewBox="0 0 300 12" preserveAspectRatio="none">
              <path d="M0 8 Q75 0 150 6 Q225 12 300 4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
            </svg>
          </span>{' '}
          de precisi&oacute;n
        </h1>

        {/* Subtitle */}
        <p
          className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-500 leading-relaxed mb-10 animate-[fadeUp_0.8s_ease_0.2s_both]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Conectamos la detecci&oacute;n satelital Sentinel-2 con pilotos de drones certificados.
          Monitoriza, diagnostica y trata tus cultivos con trazabilidad completa.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-[fadeUp_0.8s_ease_0.35s_both]">
          <Link
            to="/login"
            className="group relative px-8 py-4 bg-brand-600 text-white rounded-2xl text-base font-semibold overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Empieza gratis
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <a
            href="#como-funciona"
            className="px-8 py-4 text-gray-600 rounded-2xl text-base font-medium border border-gray-200 hover:border-brand-300 hover:text-brand-700 transition-all"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Ver c&oacute;mo funciona
          </a>
        </div>

        {/* Trust bar */}
        <div
          className="mt-16 w-full max-w-3xl mx-auto animate-[fadeUp_0.8s_ease_0.5s_both]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center rounded-2xl bg-brand-50/80 border border-brand-100 backdrop-blur-sm px-4 py-4 sm:py-3 gap-4 sm:gap-0 sm:divide-x sm:divide-brand-200/50">
            {/* Sentinel-2 */}
            <div className="flex items-center gap-3 sm:px-6 first:sm:pl-2 last:sm:pr-2">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-brand-600">
                  <rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.9"/>
                  <rect x="1" y="10" width="6" height="4" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="17" y="10" width="6" height="4" rx="1" fill="currentColor" opacity="0.5"/>
                  <path d="M10 16L8 22M14 16L16 22M8 22H16" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800 leading-tight">Sentinel-2</div>
                <div className="text-xs text-gray-500">Datos sat&eacute;lite gratuitos</div>
              </div>
            </div>

            {/* NDVI */}
            <div className="flex items-center gap-3 sm:px-6">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-brand-600">
                  <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.6"/>
                  <rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" opacity="0.9"/>
                  <path d="M3 3L21 3" stroke="currentColor" strokeWidth="0.5" opacity="0.2"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800 leading-tight">NDVI</div>
                <div className="text-xs text-gray-500">An&aacute;lisis cada 5 d&iacute;as</div>
              </div>
            </div>

            {/* AESA + ROPO */}
            <div className="flex items-center gap-3 sm:px-6 first:sm:pl-2 last:sm:pr-2">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-brand-600">
                  <path d="M12 2L3 7V12C3 17.5 7 21.5 12 23C17 21.5 21 17.5 21 12V7L12 2Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.1"/>
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800 leading-tight">AESA + ROPO</div>
                <div className="text-xs text-gray-500">Pilotos certificados</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom terrain */}
      <div className="absolute bottom-0 left-0 right-0">
        <FieldPatternSVG className="w-full" />
      </div>
    </section>
  );
}

/* ──────────────────────────── PAC PAIN ──────────────────────────── */

function PacPain() {
  const reveal = useReveal(0.1);
  return (
    <section className="relative py-24 sm:py-32 bg-gray-950 text-white overflow-hidden">
      {/* Subtle red glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-900/20 rounded-full blur-[100px]" />

      <div className="relative max-w-6xl mx-auto px-6" ref={reveal.ref}>

        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-red-400 mb-5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            El problema real
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-6" style={{ fontFamily: 'Instrument Serif, serif' }}>
            Sin evidencia t&eacute;cnica,<br />
            <span className="text-red-400">pierdes tus ayudas PAC</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-gray-400 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            La PAC exige documentaci&oacute;n t&eacute;cnica de cada tratamiento. Sin ella, la inspecci&oacute;n te deniega la subvenci&oacute;n. Cada a&ntilde;o.
          </p>
        </div>

        {/* Pain cards */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 mb-16 transition-all duration-700 delay-150 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Pain 1 */}
          <div className="group rounded-2xl border border-red-900/40 bg-red-950/30 p-7 hover:border-red-700/60 transition-all duration-300">
            <div className="text-5xl font-bold text-red-400 mb-3 leading-none" style={{ fontFamily: 'Instrument Serif, serif' }}>
              315<span className="text-2xl">M€</span>
            </div>
            <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Subvenciones PAC en juego
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              El Estado subvenciona 315M&euro;/a&ntilde;o en seguros agrarios. Sin cuaderno de campo digital actualizado, tu expediente queda bloqueado en inspecci&oacute;n.
            </p>
          </div>

          {/* Pain 2 */}
          <div className="group rounded-2xl border border-red-900/40 bg-red-950/30 p-7 hover:border-red-700/60 transition-all duration-300">
            <div className="text-5xl font-bold text-red-400 mb-3 leading-none" style={{ fontFamily: 'Instrument Serif, serif' }}>
              0<span className="text-2xl"> pruebas</span>
            </div>
            <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Cuando llega el siniestro
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Granizo, sequ&iacute;a, DANA. El perito llega despu&eacute;s del da&ntilde;o. Sin historial NDVI previo, no puedes demostrar el estado del cultivo antes del evento.
            </p>
          </div>

          {/* Pain 3 */}
          <div className="group rounded-2xl border border-red-900/40 bg-red-950/30 p-7 hover:border-red-700/60 transition-all duration-300">
            <div className="text-5xl font-bold text-red-400 mb-3 leading-none" style={{ fontFamily: 'Instrument Serif, serif' }}>
              100<span className="text-2xl">%</span>
            </div>
            <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Trazabilidad obligatoria
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              La normativa fitosanitaria exige registrar cada aplicaci&oacute;n: producto, dosis, operador ROPO, condiciones meteo. Manual es inviable. El margen de error es cero.
            </p>
          </div>
        </div>

        {/* Resolution */}
        <div className={`flex flex-col items-center transition-all duration-700 delay-300 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-brand-900/60 border border-brand-700/40">
            <svg className="w-5 h-5 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <p className="text-base font-semibold text-brand-200" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              FitoLink es tu proveedor de evidencia t&eacute;cnica para cumplimiento PAC
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-500 text-center max-w-xl" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Cada vuelo genera autom&aacute;ticamente el registro PAC: fecha, parcela, producto, piloto ROPO, condiciones, firma del agr&oacute;nomo. Cuaderno de campo digital integrado.
          </p>
        </div>

      </div>
    </section>
  );
}

/* ─────────────────────── HOW IT WORKS ────────────────────────────── */

const STEPS = [
  {
    num: '01',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
        <circle cx="24" cy="24" r="20" stroke="#22c55e" strokeWidth="1.5" opacity="0.3"/>
        <circle cx="24" cy="24" r="12" stroke="#22c55e" strokeWidth="1.5" opacity="0.5"/>
        <circle cx="24" cy="24" r="4" fill="#16a34a"/>
        <path d="M24 4V10M24 38V44M4 24H10M38 24H44" stroke="#22c55e" strokeWidth="1" opacity="0.3"/>
      </svg>
    ),
    title: 'Detecta',
    desc: 'El sat\u00e9lite Sentinel-2 monitoriza tus parcelas cada 5 d\u00edas, calculando el \u00edndice NDVI de vegetaci\u00f3n de forma completamente gratuita.',
    accent: 'from-brand-400/20 to-brand-500/5',
  },
  {
    num: '02',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
        <rect x="8" y="12" width="32" height="24" rx="4" stroke="#22c55e" strokeWidth="1.5" opacity="0.5"/>
        <path d="M16 22L22 28L34 16" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="12" y="8" width="8" height="4" rx="1" fill="#22c55e" opacity="0.3"/>
      </svg>
    ),
    title: 'Diagnostica',
    desc: 'Nuestra IA identifica anomal\u00edas, patrones de estr\u00e9s h\u00eddrico y ca\u00eddas de NDVI. Recibe alertas autom\u00e1ticas con nivel de confianza.',
    accent: 'from-emerald-400/20 to-emerald-500/5',
  },
  {
    num: '03',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
        <circle cx="16" cy="24" r="8" stroke="#22c55e" strokeWidth="1.5" opacity="0.5"/>
        <circle cx="32" cy="24" r="8" stroke="#22c55e" strokeWidth="1.5" opacity="0.5"/>
        <path d="M22 20L26 24L22 28" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="24" r="2" fill="#16a34a" opacity="0.6"/>
        <circle cx="32" cy="24" r="2" fill="#16a34a" opacity="0.6"/>
      </svg>
    ),
    title: 'Conecta',
    desc: 'Te emparejamos con un piloto de drones certificado AESA y ROPO en tu zona, con el equipo adecuado para tu cultivo.',
    accent: 'from-teal-400/20 to-teal-500/5',
  },
  {
    num: '04',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
        <circle cx="24" cy="24" r="16" stroke="#22c55e" strokeWidth="1.5" opacity="0.3"/>
        <circle cx="24" cy="24" r="8" stroke="#22c55e" strokeWidth="1.5" opacity="0.5"/>
        <circle cx="24" cy="24" r="3" fill="#16a34a"/>
        <path d="M24 8V12M24 36V40M8 24H12M36 24H40" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    title: 'Aplica',
    desc: 'Tratamiento fitosanitario de precisi\u00f3n con drones, con trazabilidad completa desde la detecci\u00f3n hasta la aplicaci\u00f3n.',
    accent: 'from-green-400/20 to-green-500/5',
  },
];

function HowItWorks() {
  const reveal = useReveal(0.1);
  return (
    <section id="como-funciona" className="relative py-28 sm:py-36 bg-white">
      <div className="max-w-6xl mx-auto px-6" ref={reveal.ref}>
        {/* Header */}
        <div className={`text-center mb-20 transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span
            className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-600 mb-4 block"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Proceso
          </span>
          <h2
            className="text-4xl sm:text-5xl md:text-6xl text-gray-900 leading-[1.05]"
            style={{ fontFamily: 'Instrument Serif, serif' }}
          >
            Del sat&eacute;lite a tu parcela<br />
            <span className="text-brand-600">en cuatro pasos</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`group relative p-7 rounded-3xl border border-gray-100 bg-gradient-to-b ${step.accent} hover:border-brand-200 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/5 ${
                reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: reveal.visible ? `${i * 120}ms` : '0ms' }}
            >
              {/* Step number */}
              <span className="text-[80px] font-bold leading-none text-brand-500/[0.06] absolute top-4 right-6 select-none" style={{ fontFamily: 'Instrument Serif, serif' }}>
                {step.num}
              </span>

              <div className="relative z-10">
                <div className="mb-5">{step.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {step.desc}
                </p>
              </div>

              {/* Connector arrow (between cards on lg) */}
              {i < 3 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                  <svg width="12" height="12" viewBox="0 0 12 12" className="text-brand-300">
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────── ROLES ─────────────────────────────── */

const ROLES = [
  {
    icon: <img src="/farmer.svg" alt="Agricultor" className="w-14 h-14" />,
    title: 'Agricultor',
    subtitle: 'Monitoriza y protege',
    features: [
      'Parcelas monitorizadas con Sentinel-2',
      'Alertas NDVI autom\u00e1ticas',
      'Solicita tratamientos con un click',
      'Historial y trazabilidad completa',
    ],
    gradient: 'from-brand-50 to-white',
    border: 'hover:border-brand-300',
  },
  {
    icon: <img src="/drone-pilot.svg" alt="Piloto de drones" className="w-14 h-14" />,
    title: 'Piloto de drones',
    subtitle: 'Opera y crece',
    features: [
      'Recibe asignaciones de tu zona',
      'Gestiona equipos y certificaciones',
      'Construye tu reputaci\u00f3n con ratings',
      'Amplia tu cartera de clientes',
    ],
    gradient: 'from-blue-50 to-white',
    border: 'hover:border-blue-300',
  },
  {
    icon: <img src="/insurance2.svg" alt="Aseguradora" className="w-14 h-14" />,
    title: 'Aseguradora',
    subtitle: 'Verifica y optimiza',
    features: [
      'Monitorizaci\u00f3n de parcelas en tiempo real',
      'Inspecciones automatizadas con drones',
      'Reducci\u00f3n de fraude con datos verificables',
      'API para integraci\u00f3n con tus sistemas',
    ],
    gradient: 'from-amber-50 to-white',
    border: 'hover:border-amber-300',
  },
];

function Roles() {
  const reveal = useReveal(0.1);
  return (
    <section id="roles" className="relative py-28 sm:py-36 bg-[#fafdf7] overflow-hidden">
      {/* Decorative corner */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-brand-100/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative max-w-6xl mx-auto px-6" ref={reveal.ref}>
        <div className={`text-center mb-20 transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-600 mb-4 block" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Para cada rol
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl text-gray-900 leading-[1.05]" style={{ fontFamily: 'Instrument Serif, serif' }}>
            Una plataforma,<br />
            <span className="text-brand-600">tres perspectivas</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ROLES.map((role, i) => (
            <div
              key={role.title}
              className={`group relative rounded-3xl border border-gray-100 ${role.border} bg-gradient-to-b ${role.gradient} p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 ${
                reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: reveal.visible ? `${i * 150}ms` : '0ms' }}
            >
              <div className="mb-6">{role.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                {role.title}
              </h3>
              <p className="text-sm text-gray-400 mb-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                {role.subtitle}
              </p>
              <ul className="space-y-3">
                {role.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-600" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    <svg className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────── STATS ─────────────────────────────── */

function Stats() {
  const reveal = useReveal(0.2);
  return (
    <section id="stats" className="relative py-28 sm:py-36 bg-brand-900 text-white overflow-hidden">
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/10 rounded-full blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-6" ref={reveal.ref}>
        <div className={`text-center mb-20 transition-all duration-700 ${reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-300 mb-4 block" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Ventajas
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl leading-[1.05]" style={{ fontFamily: 'Instrument Serif, serif' }}>
            Por qu&eacute; FitoLink
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            { value: 100, suffix: '%', label: 'Gratuito', sub: 'Datos Sentinel-2 sin coste' },
            { value: 5, suffix: ' d\u00edas', label: 'Frecuencia', sub: 'Revisi\u00f3n satelital peri\u00f3dica' },
            { value: 50, suffix: ' prov.', label: 'Cobertura', sub: 'Toda Espa\u00f1a peninsular' },
            { value: 100, suffix: '%', label: 'Trazable', sub: 'De la detecci\u00f3n al tratamiento' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center p-6 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm transition-all duration-700 ${
                reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: reveal.visible ? `${200 + i * 100}ms` : '0ms' }}
            >
              <div className="text-4xl sm:text-5xl font-bold text-brand-400 mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                <Counter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-base font-semibold text-white mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>{stat.label}</div>
              <div className="text-sm text-brand-200/60" style={{ fontFamily: 'DM Sans, sans-serif' }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Certifications bar */}
        <div className={`mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-brand-300/80 transition-all duration-700 delay-500 ${
          reveal.visible ? 'opacity-100' : 'opacity-0'
        }`} style={{ fontFamily: 'DM Sans, sans-serif' }}>
          {['Certificaci\u00f3n AESA', 'Licencia ROPO', 'Datos Copernicus', 'RGPD Compliant'].map((cert) => (
            <div key={cert} className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {cert}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────── CTA ───────────────────────────────── */

function FinalCTA() {
  const reveal = useReveal(0.2);
  return (
    <section className="relative py-28 sm:py-36 bg-white overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 to-white" />
      {/* Decorative orbs */}
      <div className="absolute top-20 left-[10%] w-72 h-72 bg-brand-200/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-20 right-[10%] w-96 h-96 bg-brand-100/30 rounded-full blur-[120px]" />

      <div
        className={`relative max-w-3xl mx-auto px-6 text-center transition-all duration-700 ${
          reveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        ref={reveal.ref}
      >
        <h2 className="text-4xl sm:text-5xl md:text-6xl text-gray-900 leading-[1.05] mb-6" style={{ fontFamily: 'Instrument Serif, serif' }}>
          Empieza a monitorizar<br />
          <span className="text-brand-600">tus parcelas hoy</span>
        </h2>
        <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          Reg&iacute;strate gratis y conecta tus parcelas con la monitorizaci&oacute;n satelital Sentinel-2 en minutos.
        </p>
        <Link
          to="/login"
          className="group inline-flex items-center gap-2 px-10 py-5 bg-brand-600 text-white rounded-2xl text-lg font-semibold transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Crear cuenta gratuita
          <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        </Link>
        <p className="mt-4 text-sm text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          Sin tarjeta de cr&eacute;dito &middot; Setup en 2 minutos
        </p>
      </div>
    </section>
  );
}

/* ────────────────────────── FOOTER ──────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>F</span>
            </div>
            <span className="text-sm text-gray-500">
              &copy; 2026 FitoLink &mdash; <span className="text-gray-400">SystemRapid</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#como-funciona" className="hover:text-white transition-colors">Proceso</a>
            <a href="#roles" className="hover:text-white transition-colors">Roles</a>
            <Link to="/login" className="hover:text-white transition-colors">Acceder</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────── KEYFRAMES (injected) ───────────────────── */

function GlobalStyles() {
  return (
    <style>{`
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-14px) rotate(2deg); }
      }
      @keyframes scanline {
        0%, 100% { transform: translateY(0); opacity: 0; }
        50% { transform: translateY(100vh); opacity: 1; }
      }
      html { scroll-behavior: smooth; }
    `}</style>
  );
}

/* ──────────────────────── MAIN EXPORT ───────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <GlobalStyles />
      <Navbar />
      <Hero />
      <PacPain />
      <HowItWorks />
      <Roles />
      <Stats />
      <FinalCTA />
      <Footer />
    </div>
  );
}
