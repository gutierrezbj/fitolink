import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from './authStore.js';
import { api } from '@/lib/api.js';
import type { UserRole } from '@fitolink/shared';

/**
 * RegisterPage — paso final del alta tras OAuth Google.
 *
 * Identidad visual AgroM (paleta + Fraunces + Plex Sans/Mono). Flujo:
 * el usuario clicó "Iniciar sesión con Google" en LoginPage, no existe
 * en nuestra BD, /auth/login/google falló → redirige aquí con la
 * credential. Aquí elige rol, acepta T&C+privacidad y se crea cuenta.
 *
 * El rol 'cooperative' está habilitado pero requerirá verificación
 * manual antes de operar comercialmente (ver § 03 T&C).
 */

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon: string;
  /** True = sólo perfil técnico, no auto-verificado */
  needsVerification?: boolean;
}

const ROLES: RoleOption[] = [
  {
    value: 'farmer',
    label: 'Agricultor',
    description: 'Registra tus parcelas y recibe el informe diario sobre tu cultivo.',
    icon: '/farmer.svg',
  },
  {
    value: 'cooperative',
    label: 'Cooperativa',
    description: 'Agrega las parcelas de tus socios y monitoriza la cartera completa.',
    icon: '/provider-cooperative.svg',
    needsVerification: true,
  },
  {
    value: 'pilot',
    label: 'Piloto de drones',
    description: 'Ofrece servicios de aplicación e inspección con dron a agricultores y cooperativas.',
    icon: '/drone-pilot.svg',
    needsVerification: true,
  },
  {
    value: 'insurer',
    label: 'Aseguradora',
    description: 'Monitoriza parcelas aseguradas, gestiona alertas y coordina inspecciones drone.',
    icon: '/insurance2.svg',
    needsVerification: true,
  },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const credential = (location.state as { credential?: string })?.credential;

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!credential) {
    navigate('/login');
    return null;
  }

  const handleRegister = async () => {
    if (!selectedRole) return;
    if (!acceptedTerms) {
      setError('Debes aceptar los términos y la política de privacidad para continuar.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/register', {
        credential,
        role: selectedRole,
        phone: phone || undefined,
        acceptedTerms: true,
        acceptedTermsAt: new Date().toISOString(),
      });
      login(res.data.data.token, res.data.data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Error al registrarse';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const selected = ROLES.find((r) => r.value === selectedRole);

  return (
    <div className="min-h-screen flex items-center justify-center bg-agrom-paper p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-agrom-rule/30 p-10 max-w-lg w-full">
        {/* Brand header — same wordmark/eyebrow pattern as LoginPage */}
        <div className="text-center mb-6">
          <img
            src="/brand/agrom-wordmark.svg"
            alt="AgroM"
            className="h-10 w-auto mx-auto"
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-agrom-muted mt-3">
            FitoLink · alta de cuenta
          </p>
        </div>

        <div className="mb-7 text-center">
          <p className="font-display text-xl text-agrom-ink leading-snug">
            Completa tu registro
          </p>
          <p className="text-agrom-muted text-sm mt-1.5">
            Selecciona el perfil que mejor te describa.
          </p>
        </div>

        {/* Role picker */}
        <div className="space-y-2.5 mb-6">
          {ROLES.map((role) => {
            const isActive = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`w-full text-left p-4 rounded-lg border transition-all flex items-start gap-3 ${
                  isActive
                    ? 'border-agrom-deep bg-agrom-parch/40'
                    : 'border-agrom-rule/40 hover:border-agrom-rule hover:bg-agrom-paper'
                }`}
              >
                <img src={role.icon} alt="" className="w-7 h-7 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-agrom-ink flex items-center gap-2">
                    {role.label}
                    {role.needsVerification && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-agrom-terra bg-agrom-terra/10 px-1.5 py-0.5 rounded">
                        Requiere verificación
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-agrom-muted mt-0.5 leading-snug">
                    {role.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Phone (opt) */}
        <div className="mb-6">
          <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-agrom-muted mb-2">
            Teléfono · opcional
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 612 345 678"
            className="w-full px-3 py-2 border border-agrom-rule/40 rounded-lg text-sm focus:ring-2 focus:ring-agrom-deep focus:border-agrom-deep outline-none"
          />
          <p className="text-[10px] text-agrom-muted mt-1.5 leading-relaxed">
            Sólo se usa para avisos críticos de campo. Nunca para marketing.
          </p>
        </div>

        {/* T&C acceptance — required for sign-up */}
        <div className="mb-6 p-4 bg-agrom-paper rounded-lg border border-agrom-rule/30">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) setError('');
              }}
              className="mt-1 w-4 h-4 text-agrom-deep border-agrom-rule/60 rounded focus:ring-agrom-deep accent-agrom-deep cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-agrom-ink leading-snug">
              He leído y acepto los{' '}
              <Link to="/terms" target="_blank" rel="noopener" className="text-agrom-deep underline font-medium">
                Términos de Uso
              </Link>{' '}
              y la{' '}
              <Link to="/privacy" target="_blank" rel="noopener" className="text-agrom-deep underline font-medium">
                Política de Privacidad
              </Link>{' '}
              de AgroM FitoLink.
            </span>
          </label>
        </div>

        {/* Heads-up for verification roles */}
        {selected?.needsVerification && (
          <div className="mb-6 p-3 bg-agrom-terra/10 border-l-2 border-agrom-terra rounded-r">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-agrom-terra mb-1">
              § Verificación pendiente
            </p>
            <p className="text-xs text-agrom-ink leading-relaxed">
              El perfil de {selected.label.toLowerCase()} requiere verificación
              manual por nuestro equipo antes de operar comercialmente. Recibirás
              un email en 24-48 h.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-agrom-alert/10 border-l-2 border-agrom-alert rounded-r">
            <p className="text-sm text-agrom-alert">{error}</p>
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={!selectedRole || !acceptedTerms || loading}
          className="w-full bg-agrom-deep text-white py-3 rounded-lg font-semibold hover:bg-agrom-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <p className="text-[10px] text-agrom-muted mt-6 text-center font-mono uppercase tracking-[0.18em]">
          AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN
        </p>
      </div>
    </div>
  );
}
