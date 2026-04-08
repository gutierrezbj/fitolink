import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore.js';
import ToastContainer from '@/components/ToastContainer.js';

const NAV_ITEMS: Record<string, Array<{ to: string; label: string; icon: string }>> = {
  farmer: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/parcels', label: 'Mis Parcelas', icon: '/location.svg' },
    { to: '/dashboard/alerts', label: 'Alertas', icon: '/siren.svg' },
    { to: '/dashboard/operations', label: 'Operaciones', icon: '/operational-system.svg' },
    { to: '/dashboard/services', label: 'Servicios', icon: '/operational-system.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/drone-pilot.svg' },
  ],
  pilot: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/assignments', label: 'Asignaciones', icon: '/drone-pilot.svg' },
    { to: '/dashboard/operations', label: 'Historial', icon: '/operational-system.svg' },
    { to: '/dashboard/marketplace', label: 'Red de Pilotos', icon: '/location.svg' },
  ],
  insurer: [
    { to: '/dashboard', label: 'Inicio', icon: '🏠' },
    { to: '/dashboard/b2b/parcels', label: 'Parcelas Aseguradas', icon: '/insurance2.svg' },
    { to: '/dashboard/b2b/alerts', label: 'Alertas', icon: '/siren.svg' },
    { to: '/dashboard/b2b/inspections', label: 'Inspecciones', icon: '🔍' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/drone-pilot.svg' },
  ],
  admin: [
    { to: '/dashboard', label: 'Inicio', icon: '/system-administration.svg' },
    { to: '/dashboard/admin/dispatch', label: 'Despacho', icon: '/drone-pilot.svg' },
    { to: '/dashboard/admin/users', label: 'Usuarios', icon: '/user.svg' },
    { to: '/dashboard/admin/parcels', label: 'Parcelas', icon: '/location.svg' },
    { to: '/dashboard/admin/alerts', label: 'Alertas', icon: '/siren.svg' },
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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold font-serif">F</span>
            </div>
            <h1 className="text-lg font-semibold text-brand-800 tracking-tight">FitoLink</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 pl-9">Del pixel al tratamiento</p>
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
              {item.icon.startsWith('/') ? (
                <img src={item.icon} alt="" className="w-5 h-5" />
              ) : (
                <span>{item.icon}</span>
              )}
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
            className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors px-3 py-2 rounded-lg border border-transparent hover:border-red-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
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
