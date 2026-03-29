import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const ROLE_BADGE: Record<string, string> = {
  farmer: 'bg-green-100 text-green-700',
  pilot: 'bg-purple-100 text-purple-700',
  insurer: 'bg-blue-100 text-blue-700',
  admin: 'bg-gray-200 text-gray-700',
  agronomist: 'bg-yellow-100 text-yellow-700',
};

const ROLE_LABELS: Record<string, string> = {
  farmer: 'Agricultor',
  pilot: 'Piloto',
  insurer: 'Aseguradora',
  admin: 'Admin',
  agronomist: 'Agrónomo',
};

const ROLE_ICON: Record<string, string> = {
  farmer: '🌾', pilot: '🚁', insurer: '🛡️', admin: '⚙️', agronomist: '🔬',
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  company?: string;
  isVerified: boolean;
  rating?: number;
  ratingCount?: number;
  certifications?: { type: string }[];
  equipment?: { model: string }[];
  createdAt: string;
};

export default function AdminUsersPage() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => { const res = await api.get('/admin/users'); return res.data.data ?? []; },
    refetchInterval: 120_000,
  });

  const farmers = users.filter((u: User) => u.role === 'farmer');
  const pilots = users.filter((u: User) => u.role === 'pilot');
  const insurers = users.filter((u: User) => u.role === 'insurer');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-500">{users.length} usuarios registrados en la plataforma</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        {(['farmer', 'pilot', 'insurer', 'admin'] as const).map((role) => {
          const count = users.filter((u: User) => u.role === role).length;
          return (
            <span key={role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ROLE_BADGE[role]}`}>
              {ROLE_ICON[role]} {ROLE_LABELS[role]} ({count})
            </span>
          );
        })}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Pilots section */}
      {pilots.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">🚁 Pilotos de Drones ({pilots.length})</h2>
          <div className="space-y-2">
            {pilots.map((user: User) => (
              <UserRow key={user._id} user={user} />
            ))}
          </div>
        </section>
      )}

      {/* Farmers section */}
      {farmers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">🌾 Agricultores ({farmers.length})</h2>
          <div className="space-y-2">
            {farmers.map((user: User) => (
              <UserRow key={user._id} user={user} />
            ))}
          </div>
        </section>
      )}

      {/* Insurers section */}
      {insurers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">🛡️ Aseguradoras ({insurers.length})</h2>
          <div className="space-y-2">
            {insurers.map((user: User) => (
              <UserRow key={user._id} user={user} />
            ))}
          </div>
        </section>
      )}

      {/* Other users */}
      {users.filter((u: User) => !['farmer', 'pilot', 'insurer'].includes(u.role)).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">⚙️ Otros ({users.filter((u: User) => !['farmer', 'pilot', 'insurer'].includes(u.role)).length})</h2>
          <div className="space-y-2">
            {users
              .filter((u: User) => !['farmer', 'pilot', 'insurer'].includes(u.role))
              .map((user: User) => <UserRow key={user._id} user={user} />)}
          </div>
        </section>
      )}

      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl mb-4">👥</p>
          <p className="text-lg font-semibold text-gray-700">No hay usuarios</p>
        </div>
      )}
    </div>
  );
}

function UserRow({ user }: { user: User }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
        {ROLE_ICON[user.role] ?? '👤'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{user.name}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          {user.isVerified && (
            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
              ✓ Verificado
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
        {user.company && <p className="text-[11px] text-gray-500">{user.company}</p>}
        {user.certifications && user.certifications.length > 0 && (
          <p className="text-[11px] text-purple-600">{user.certifications.map((c) => c.type).join(' · ')}</p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        {user.rating !== undefined && user.rating > 0 && (
          <p className="text-sm font-bold text-gray-800">★ {user.rating.toFixed(1)}</p>
        )}
        {user.equipment && user.equipment.length > 0 && (
          <p className="text-[11px] text-gray-400">{user.equipment.length} equipo{user.equipment.length > 1 ? 's' : ''}</p>
        )}
        <p className="text-[11px] text-gray-400">{formatDate(user.createdAt)}</p>
      </div>
    </div>
  );
}
