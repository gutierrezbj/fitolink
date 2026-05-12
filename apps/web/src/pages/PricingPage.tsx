/**
 * Pricing — AgroM · FitoLink.
 *
 * Modelo C (híbrido): monitorización satelital + alertas + digest matutino
 * GRATIS durante validación. La aplicación drone se cobra por hectárea
 * efectivamente tratada, con presupuesto previo aceptado por el cliente.
 *
 * Sin precio público de drone — depende del cultivo, producto y zona.
 * El formulario es sales-led: dispara email a JuanCho + Jonh con los
 * datos del prospect y desde ahí coordina.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api.js';

interface FormState {
  name: string;
  email: string;
  phone: string;
  organization: string;
  hectares: string;
  cropType: string;
  message: string;
  acceptedTerms: boolean;
}

const CROPS = [
  '— Selecciona cultivo —',
  'Olivar',
  'Pistacho',
  'Almendro',
  'Viñedo',
  'Cereal',
  'Cítrico',
  'Frutal',
  'Hortaliza',
  'Otro',
];

const HECTARES = [
  '— Selecciona superficie —',
  'Menos de 10 ha',
  '10 - 50 ha',
  '50 - 200 ha',
  '200 - 1000 ha',
  'Más de 1000 ha',
];

export default function PricingPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    hectares: '',
    cropType: '',
    message: '',
    acceptedTerms: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.acceptedTerms) {
      setError('Debes aceptar los términos y la política de privacidad.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/contact/demo-request', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        organization: form.organization.trim() || undefined,
        hectares: form.hectares && form.hectares !== HECTARES[0] ? form.hectares : undefined,
        cropType: form.cropType && form.cropType !== CROPS[0] ? form.cropType : undefined,
        message: form.message.trim() || undefined,
        acceptedTerms: true,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'No se ha podido enviar. Inténtalo de nuevo o escríbenos directamente.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-agrom-paper">
      <header className="border-b border-agrom-rule/40 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-5 text-sm text-agrom-muted">
            <Link to="/" className="hover:text-agrom-deep">Inicio</Link>
            <Link to="/login" className="bg-agrom-deep text-white px-4 py-1.5 rounded-lg hover:bg-agrom-ink transition-colors">Acceder</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted">
            § AGROM · MODELO COMERCIAL
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-agrom-deep mt-3 leading-tight">
            Primero le demostramos el valor.
          </h1>
          <p className="font-display italic text-xl text-agrom-muted mt-3">
            Después hablamos de números.
          </p>
          <div className="w-12 h-[2px] bg-agrom-terra mx-auto mt-6" />
        </div>

        {/* Two pricing tiers */}
        <div className="grid md:grid-cols-2 gap-6 mb-14">
          {/* Monitor — free */}
          <div className="bg-white rounded-2xl border border-agrom-rule/40 p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted">
              § 01 · MONITORIZACIÓN
            </p>
            <h2 className="font-display text-3xl text-agrom-deep mt-3">Gratis</h2>
            <p className="font-display italic text-agrom-muted text-sm">durante la fase de validación</p>
            <div className="w-10 h-[2px] bg-agrom-terra my-5" />

            <ul className="space-y-3 text-sm text-agrom-ink leading-relaxed">
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">✓</span>
                <span>Imagen satelital Sentinel-2 cada 5 días</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">✓</span>
                <span>5 índices de vegetación calculados por parcela (NDVI, NDRE, SAVI, MSI, EVI)</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">✓</span>
                <span>Alertas automáticas con detección IA por parcela individual</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">✓</span>
                <span>Informe matutino diario por email a las 7</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">✓</span>
                <span>Histórico de 5 años por parcela</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">✓</span>
                <span>Sin tarjeta · sin permanencia</span>
              </li>
            </ul>
          </div>

          {/* Drone — sales-led */}
          <div className="bg-agrom-deep text-white rounded-2xl p-8 relative overflow-hidden">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              § 02 · APLICACIÓN FITOSANITARIA
            </p>
            <h2 className="font-display text-3xl mt-3">Por hectárea aplicada</h2>
            <p className="font-display italic text-white/70 text-sm">presupuesto previo cerrado contigo</p>
            <div className="w-10 h-[2px] bg-agrom-terra my-5" />

            <ul className="space-y-3 text-sm leading-relaxed">
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">·</span>
                <span>Piloto certificado AESA · dron DJI T50/T30</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">·</span>
                <span>Tasa variable basada en los datos satelitales reales — no a ojo</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">·</span>
                <span>Hasta 30% menos producto que aplicación uniforme</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">·</span>
                <span>Reporte PDF firmado tras cada vuelo · cuaderno PAC automático</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">·</span>
                <span>Trazabilidad blockchain · firma eIDAS</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-agrom-terra font-bold">·</span>
                <span>Sólo cobramos las hectáreas efectivamente tratadas</span>
              </li>
            </ul>

            <p className="text-xs text-white/70 mt-6 leading-relaxed">
              El precio por hectárea depende del cultivo, producto y zona.
              Cerramos presupuesto contigo antes de cualquier vuelo.
            </p>
          </div>
        </div>

        {/* Contact form */}
        <div id="contact" className="bg-white rounded-2xl border border-agrom-rule/40 p-8 md:p-10 max-w-3xl mx-auto">
          {submitted ? (
            <div className="text-center py-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-terra">
                § MENSAJE RECIBIDO
              </p>
              <h2 className="font-display text-3xl text-agrom-deep mt-3">Gracias.</h2>
              <p className="font-display italic text-agrom-muted mt-2 text-lg">
                Te contactamos en menos de 24 horas.
              </p>
              <div className="w-10 h-[2px] bg-agrom-terra mx-auto mt-6" />
              <p className="text-sm text-agrom-ink mt-6 leading-relaxed max-w-md mx-auto">
                Mientras tanto, si quieres ver el producto en marcha sobre datos
                reales, puedes acceder al panel demo desde el botón de arriba.
              </p>
              <Link
                to="/login"
                className="inline-block mt-6 bg-agrom-deep text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-agrom-ink transition-colors"
              >
                Ver demo público →
              </Link>
            </div>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted">
                § HABLAMOS ANTES
              </p>
              <h2 className="font-display text-2xl md:text-3xl text-agrom-deep mt-3">
                Cuéntanos sobre tu explotación.
              </h2>
              <p className="text-agrom-muted text-sm mt-2">
                En menos de 24 horas te llamamos para ver si AgroM encaja para ti.
              </p>
              <div className="w-10 h-[2px] bg-agrom-terra mt-5 mb-8" />

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <Field label="Nombre completo *" required>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="agrom-input"
                    />
                  </Field>
                  <Field label="Email *" required>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="agrom-input"
                    />
                  </Field>
                  <Field label="Teléfono · opcional">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+34 612 345 678"
                      className="agrom-input"
                    />
                  </Field>
                  <Field label="Cooperativa / empresa · opcional">
                    <input
                      type="text"
                      value={form.organization}
                      onChange={(e) => setForm({ ...form, organization: e.target.value })}
                      className="agrom-input"
                    />
                  </Field>
                  <Field label="Cultivo principal">
                    <select
                      value={form.cropType}
                      onChange={(e) => setForm({ ...form, cropType: e.target.value })}
                      className="agrom-input"
                    >
                      {CROPS.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </Field>
                  <Field label="Superficie">
                    <select
                      value={form.hectares}
                      onChange={(e) => setForm({ ...form, hectares: e.target.value })}
                      className="agrom-input"
                    >
                      {HECTARES.map((h) => (<option key={h} value={h}>{h}</option>))}
                    </select>
                  </Field>
                </div>

                <Field label="¿Qué te gustaría conseguir? · opcional">
                  <textarea
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Ej: tengo problemas con el seguro PAC, quiero reducir el coste de fitosanitario, busco trazabilidad..."
                    className="agrom-input resize-none"
                  />
                </Field>

                <div className="p-4 bg-agrom-paper rounded-lg border border-agrom-rule/30">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.acceptedTerms}
                      onChange={(e) => {
                        setForm({ ...form, acceptedTerms: e.target.checked });
                        if (e.target.checked) setError('');
                      }}
                      className="mt-1 w-4 h-4 accent-agrom-deep cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm text-agrom-ink leading-snug">
                      He leído y acepto los{' '}
                      <Link to="/terms" target="_blank" rel="noopener" className="text-agrom-deep underline">Términos de Uso</Link>{' y la '}
                      <Link to="/privacy" target="_blank" rel="noopener" className="text-agrom-deep underline">Política de Privacidad</Link>.
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="p-3 bg-agrom-alert/10 border-l-2 border-agrom-alert rounded-r">
                    <p className="text-sm text-agrom-alert">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !form.acceptedTerms || !form.name || !form.email}
                  className="w-full bg-agrom-deep text-white font-semibold py-3 rounded-lg hover:bg-agrom-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Enviando…' : 'Solicitar demo →'}
                </button>

                <p className="text-[11px] text-agrom-muted text-center">
                  O escríbenos directamente a{' '}
                  <a href="mailto:juang@systemrapid.io" className="text-agrom-deep underline">
                    juang@systemrapid.io
                  </a>
                </p>
              </form>
            </>
          )}
        </div>

        <div className="mt-12 text-center text-sm">
          <Link to="/" className="text-agrom-deep hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </main>

      <footer className="border-t border-agrom-rule/40 bg-white mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted">
            AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN · 2026
          </p>
          <p className="text-xs text-agrom-muted mt-2">
            <Link to="/terms" className="hover:text-agrom-deep mx-2">Términos</Link>
            ·
            <Link to="/privacy" className="hover:text-agrom-deep mx-2">Privacidad</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-agrom-muted mb-1.5">
        {label}{required && <span className="text-agrom-terra ml-1">·</span>}
      </span>
      {children}
    </label>
  );
}
