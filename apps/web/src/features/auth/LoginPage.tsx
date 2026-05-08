import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-brand-800 mb-2">FitoLink</h1>
          <p className="text-gray-500 text-sm">
            Del pixel al tratamiento de precision
          </p>
        </div>

        <div className="mb-8">
          <p className="text-gray-700 mb-1">
            Conectamos agricultores con pilotos de drones
          </p>
          <p className="text-gray-500 text-sm">
            Deteccion satelital + Aplicacion fitosanitaria de precision
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <div id="google-signin-btn" />
        </div>

        <p className="text-xs text-gray-400 mb-6">
          Al acceder, aceptas los terminos de uso de FitoLink
        </p>

        {SHOW_DEMO && (
          <div className="border-t pt-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
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
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  disabled={loading !== null}
                />
                <button
                  type="submit"
                  disabled={!demoEmail.trim() || loading !== null}
                  className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'email' ? '...' : 'Entrar'}
                </button>
              </form>
              {demoEmailError && (
                <p className="text-xs text-red-600 mt-2">{demoEmailError}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-2 text-left leading-relaxed">
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
