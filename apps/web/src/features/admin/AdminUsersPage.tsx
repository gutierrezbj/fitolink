import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';

const ROLE_BADGE: Record<string, string> = {
  farmer: 'bg-green-100 text-green-700',
  pilot: 'bg-purple-100 text-purple-700',
  insurer: 'bg-blue-100 text-blue-700',
  admin: 'bg-gray-200 text-gray-700',
  agronomist: 'bg-yellow-100 text-yellow-700',
  cooperative: 'bg-amber-100 text-amber-800',
  // ADV · institucional · color terra (naranja brand AgroM) para
  // diferenciar visualmente del verde-agricultor y del amber-coop.
  adv: 'bg-terra-100 text-terra-700',
  // Regantes · color sky (azul agua) — coherente con el dominio hídrico.
  regantes: 'bg-sky-100 text-sky-700',
};

const ROLE_LABELS: Record<string, string> = {
  farmer: 'Agricultor',
  pilot: 'Piloto',
  insurer: 'Aseguradora',
  admin: 'Admin',
  agronomist: 'Agrónomo',
  cooperative: 'Cooperativa',
  adv: 'ADV',
  regantes: 'C. Regantes',
};

const ROLE_ICON: Record<string, string> = {
  farmer: '/farmer.svg',
  pilot: '/drone-pilot.svg',
  insurer: '/insurance2.svg',
  admin: '/system-administration.svg',
  agronomist: '/user.svg',
  cooperative: '/provider-cooperative.svg',
  adv: '/provider-cooperative.svg',
  regantes: '/provider-cooperative.svg',
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
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => { const res = await api.get('/admin/users'); return res.data.data ?? []; },
    refetchInterval: 120_000,
  });

  const farmers = users.filter((u: User) => u.role === 'farmer');
  const pilots  = users.filter((u: User) => u.role === 'pilot');
  const insurers = users.filter((u: User) => u.role === 'insurer');
  const others  = users.filter((u: User) => !['farmer', 'pilot', 'insurer'].includes(u.role));

  const sections = [
    { role: 'pilot',   label: 'Pilotos de Drones', icon: '/drone-pilot.svg',           list: pilots },
    { role: 'farmer',  label: 'Agricultores',       icon: '/farmer.svg',                list: farmers },
    { role: 'insurer', label: 'Aseguradoras',       icon: '/insurance2.svg',            list: insurers },
    { role: 'admin',   label: 'Otros',              icon: '/system-administration.svg', list: others },
  ].filter(s => s.list.length > 0);

  const visibleSections = activeRole
    ? sections.filter(s => s.role === activeRole)
    : sections;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-500">{users.length} usuarios registrados en la plataforma</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveRole(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            activeRole === null
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          Todos ({users.length})
        </button>
        {(['farmer', 'pilot', 'insurer', 'cooperative', 'adv', 'regantes', 'admin'] as const).map((role) => {
          const count = users.filter((u: User) => u.role === role).length;
          if (count === 0) return null;
          const isActive = activeRole === role;
          return (
            <button
              key={role}
              onClick={() => setActiveRole(isActive ? null : role)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? `${ROLE_BADGE[role]} border-transparent shadow-sm scale-105`
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              <img src={ROLE_ICON[role]} alt="" className="w-4 h-4" />
              {ROLE_LABELS[role]} ({count})
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {visibleSections.map(section => (
        <section key={section.role}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <img src={section.icon} alt="" className="w-5 h-5" />
            {section.label} ({section.list.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {section.list.map((user: User) => <UserCard key={user._id} user={user} />)}
          </div>
        </section>
      ))}

      {!isLoading && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <img src="/user.svg" alt="" className="w-12 h-12 mb-4 opacity-40" />
          <p className="text-lg font-semibold text-gray-700">No hay usuarios</p>
        </div>
      )}
    </div>
  );
}

function UserCard({ user }: { user: User }) {
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Top row: avatar + name + badge */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 leading-tight">{user.name}</p>
            {user.isVerified && (
              <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                ✓ Verificado
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
        </div>
        <img src={ROLE_ICON[user.role] ?? '/user.svg'} alt="" className="w-8 h-8 flex-shrink-0 opacity-80" />
      </div>

      {/* Role badge + company */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
        {user.company && (
          <span className="text-[11px] text-gray-500">{user.company}</span>
        )}
      </div>

      {/* Certs */}
      {user.certifications && user.certifications.length > 0 && (
        <p className="text-[11px] text-purple-600 font-medium">
          {user.certifications.map((c) => c.type).join(' · ')}
        </p>
      )}

      {/* Footer: rating + equipment + date */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
        <div className="flex items-center gap-3">
          {user.rating !== undefined && user.rating > 0 && (
            <span className="text-xs font-bold text-amber-500">★ {user.rating.toFixed(1)}</span>
          )}
          {user.equipment && user.equipment.length > 0 && (
            <span className="text-[11px] text-gray-400">{user.equipment.length} equipo{user.equipment.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <span className="text-[11px] text-gray-400">{formatDate(user.createdAt)}</span>
      </div>
    </div>
  );
}
