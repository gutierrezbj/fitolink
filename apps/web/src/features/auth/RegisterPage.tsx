import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore.js';
import { api } from '@/lib/api.js';
import type { UserRole } from '@fitolink/shared';

const ROLES: Array<{ value: UserRole; label: string; description: string }> = [
  { value: 'farmer', label: 'Agricultor', description: 'Registra parcelas y solicita servicios fitosanitarios' },
  { value: 'pilot', label: 'Piloto de Drones', description: 'Ofrece servicios de aplicacion e inspeccion con drones' },
  { value: 'insurer', label: 'Aseguradora', description: 'Monitoriza parcelas aseguradas y solicita inspecciones' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const credential = (location.state as { credential?: string })?.credential;

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!credential) {
    navigate('/login');
    return null;
  }

  const handleRegister = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/register', {
        credential,
        role: selectedRole,
        phone: phone || undefined,
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-brand-800 mb-2">Completa tu registro</h2>
        <p className="text-gray-500 mb-6">Selecciona tu perfil para empezar</p>

        <div className="space-y-3 mb-6">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedRole === role.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{role.label}</div>
              <div className="text-sm text-gray-500">{role.description}</div>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefono (opcional)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 612 345 678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={!selectedRole || loading}
          className="w-full bg-brand-600 text-white py-3 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Registrando...' : 'Crear cuenta'}
        </button>
      </div>
    </div>
  );
}
