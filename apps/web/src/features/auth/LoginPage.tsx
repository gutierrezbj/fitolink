import { useEffect, useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from './authStore.js';
import { api } from '@/lib/api.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SHOW_DEMO = import.meta.env.DEV
  || import.meta.env.VITE_SHOW_DEMO === 'true'
  || new URLSearchParams(window.location.search).has('demo');

// Demo accounts shown publicly on the login page. Kept to the 4 archetypes
// the product covers — pilots are intentionally not surfaced here (they
// log in with their corporate account in real life). Outreach-specific
// users (Sergio, John) still exist in MongoDB and can be entered via the
// email field below — just removed from the chip row to reduce noise.
const DEMO_ACCOUNTS = [
  { label: 'Agricultor',  googleId: 'demo-farmer-001',      icon: '/farmer.svg',                 color: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' },
  { label: 'Aseguradora', googleId: 'demo-insurer-001',     icon: '/insurance2.svg',             color: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' },
  { label: 'Cooperativa', googleId: 'demo-cooperative-001', icon: '/provider-cooperative.svg',   color: 'bg-yellow-50 border-yellow-300 text-yellow-900 hover:bg-yellow-100' },
  // Comunidad de Regantes · Sprint Regantes 05-jun-2026.
  // Demo sintética: cooperativa demo reusada como entidad agregadora con
  // role=regantes. Seed: seedRegantesSocios.ts (4 socios + 8 parcelas
  // zona Levante regable). Botón color azul-agua para diferenciar
  // visualmente de cooperativa (amarillo) y agricultor (verde).
  { label: 'Comunidad Regantes', googleId: 'demo-regantes-001', icon: '/provider-cooperative.svg', color: 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100' },
  // OCULTO 05-jun-2026 · El "Pistachar (Cliente)" abría la cuenta REAL
  // de Jonh con sus 6 parcelas reales (348 ha pistacho Toledo). Mientras
  // estuvo público cualquier visitante podía verle sus datos. Se mueve
  // a acceso por email (campo de abajo) para que solo entre quien tenga
  // el googleId. La cuenta sigue activa en MongoDB y funcionando — solo
  // se ha quitado del chip-row visible. Si en futuro AgroM quiere
  // demostrarla en una llamada comercial, descomentar esta línea
  // temporalmente y volver a ocultar tras el deploy.
  // { label: 'Pistachar (Cliente)', googleId: 'john-pistacho-real', icon: '/vegetables.svg',        color: 'bg-orange-50 border-terra-500/40 text-terra-500 hover:bg-orange-100' },
  // Aula Jaén Jesús — cuenta pedagógica del profesor Jesús Vivar
  // (UPM Agricultura Precisión). 6 parcelas sintéticas Jaén que ilustran
  // escenarios canónicos: olivar sano, intensivo seto, pistachar calibrando,
  // almendro establecimiento, olivar estrés hídrico (alerta crítica activa),
  // olivar heterogéneo. Seed: seedProfessorDemo.ts. Flag isSyntheticDemo
  // hace que el pipeline las ignore.
  { label: 'Aula Jaén Jesús', googleId: 'jesus-vivar-edu', icon: '/smart-farming.svg',           color: 'bg-earth-50 border-earth-300/50 text-earth-700 hover:bg-earth-100' },
  // Encineño · cliente fondo de inversión (10-jun-2026 · Garage1 + Mac).
  // CASO DISTINTO al Pistachar de Jonh: los datos del KMZ vienen
  // DIRECTAMENTE del cliente con autorización explícita para mostrar en
  // demo (Guillermo Morales Sánchez · vía Jorge Leccia · sector evaluación
  // pre-demo Microsoft viernes 12-jun de cartera total 2.300 ha). 407 ha
  // olivar Subbética Córdoba · parcela REAL `isSyntheticDemo:false` · datos
  // Sentinel-2/Landsat reales tras pipeline manual 10-jun · advisory
  // matching Prays oleae Córdoba MEDIUM a 19.7 km con cifras LITERALES
  // portal RAIF. JuanCho lo llama "Jorge" mentalmente para click rápido
  // en demos comerciales. Color terra (premium) para destacar como cuenta
  // cliente B2B real.
  { label: 'Jorge',       googleId: 'demo-encineno-fondo',  icon: '/vegetables.svg',             color: 'bg-orange-50 border-terra-500/40 text-terra-500 hover:bg-orange-100' },
  { label: 'Admin',       googleId: 'demo-admin-001',       icon: '/system-administration.svg',  color: 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleCallback = useCallback(
    async (response: { credential: string }) => {
      try {
        const res = await api.post('/auth/login/google', {
          credential: response.credential,
        });
        login(res.data.data.token, res.data.data.user);
        navigate('/dashboard');
      } catch {
        navigate('/register', { state: { credential: response.credential } });
      }
    },
    [login, navigate],
  );

  const handleDevLogin = async (googleId: string) => {
    setLoading(googleId);
    try {
      const res = await api.post('/auth/login/dev', { googleId });
      login(res.data.data.token, res.data.data.user);
      navigate('/dashboard');
    } catch {
      setLoading(null);
    }
  };

  const [demoEmail, setDemoEmail] = useState('');
  const [demoEmailError, setDemoEmailError] = useState<string | null>(null);

  const handleDevLoginByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEmail.trim()) return;
    setDemoEmailError(null);
    setLoading('email');
    try {
      const res = await api.post('/auth/login/dev/email', { email: demoEmail.trim() });
      login(res.data.data.token, res.data.data.user);
      navigate('/dashboard');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? 'No se ha podido entrar';
      setDemoEmailError(msg);
      setLoading(null);
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      window.google?.accounts.id.renderButton(
        document.getElementById('google-signin-btn')!,
        { theme: 'outline', size: 'large', width: 300, text: 'signin_with' },
      );
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [handleGoogleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-earth-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-earth-300/30 p-10 max-w-md w-full text-center">
        {/* AgroM wordmark — brand of record. FitoLink labelled below as the product. */}
        <div className="mb-6">
          <img
            src="/brand/agrom-wordmark.svg"
            alt="AgroM"
            className="h-10 w-auto mx-auto"
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-500 mt-3">
            FitoLink · del pixel al tratamiento
          </p>
        </div>

        <div className="mb-8">
          <p className="font-display text-xl text-brand-900 leading-snug">
            Inteligencia agraria de precisión
          </p>
          <p className="text-gray-500 text-sm mt-1.5">
            Detección satelital + aplicación fitosanitaria con drone
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div id="google-signin-btn" />
        </div>

        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          Al acceder, aceptas los{' '}
          <Link to="/terms" className="text-brand-600 hover:underline">términos de uso</Link>
          {' y la '}
          <Link to="/privacy" className="text-brand-600 hover:underline">política de privacidad</Link>
          {' de AgroM FitoLink.'}
        </p>

        {SHOW_DEMO && (
          <div className="border-t border-earth-300/30 pt-5">
            <p className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.22em] mb-3">
              Cuentas Demo
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.googleId}
                  onClick={() => handleDevLogin(account.googleId)}
                  disabled={loading !== null}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer ${account.color} ${loading === account.googleId ? 'opacity-50' : ''}`}
                >
                  {loading === account.googleId ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    <>
                      <img src={account.icon} alt="" className="w-5 h-5 mr-1.5 inline-block" />
                      {account.label}
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Email-based demo entry — for prospects bringing their own KMZ */}
            <div className="mt-5 pt-5 border-t border-earth-300/30">
              <p className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.22em] mb-2">
                O entra con tu email
              </p>
              <form onSubmit={handleDevLoginByEmail} className="flex gap-2">
                <input
                  type="email"
                  value={demoEmail}
                  onChange={(e) => {
                    setDemoEmail(e.target.value);
                    setDemoEmailError(null);
                  }}
                  placeholder="tu@email.com"
                  className="flex-1 px-3 py-2 border border-earth-300/40 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none"
                  disabled={loading !== null}
                />
                <button
                  type="submit"
                  disabled={!demoEmail.trim() || loading !== null}
                  className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'email' ? '...' : 'Entrar'}
                </button>
              </form>
              {demoEmailError && (
                <p className="text-xs text-red-700 mt-2">{demoEmailError}</p>
              )}
              <p className="text-[10px] text-gray-500 mt-2 text-left leading-relaxed">
                Si es la primera vez, se crea una cuenta demo de agricultor. Modo validación, sin contraseña.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Google Identity Services type declaration
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}
