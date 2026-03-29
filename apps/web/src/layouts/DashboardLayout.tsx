import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore.js';
import ToastContainer from '@/components/ToastContainer.js';

const NAV_ITEMS: Record<string, Array<{ to: string; label: string; icon: string }>> = {
  farmer: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/parcels', label: 'Mis Parcelas', icon: '🌾' },
    { to: '/dashboard/alerts', label: 'Alertas', icon: '🔔' },
    { to: '/dashboard/operations', label: 'Operaciones', icon: '📋' },
  ],
  pilot: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/assignments', label: 'Asignaciones', icon: '🚁' },
    { to: '/dashboard/operations', label: 'Historial', icon: '📋' },
  ],
  insurer: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/b2b/parcels', label: 'Parcelas Aseguradas', icon: '🛡️' },
    { to: '/dashboard/b2b/alerts', label: 'Alertas', icon: '🔔' },
    { to: '/dashboard/b2b/inspections', label: 'Inspecciones', icon: '🔍' },
  ],
  admin: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/admin/users', label: 'Usuarios', icon: '👥' },
    { to: '/dashboard/admin/parcels', label: 'Parcelas', icon: '🌾' },
    { to: '/dashboard/admin/alerts', label: 'Alertas', icon: '🔔' },
  ],
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  if (!user) {
    navigate('/login');
    return null;
  }

  const navItems = NAV_ITEMS[user.role] || NAV_ITEMS.farmer;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-brand-700">FitoLink</h1>
          <p className="text-xs text-gray-400 mt-1">Del pixel al tratamiento</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
                {user.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-left text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5"
          >
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
