import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore.js';
import ToastContainer from '@/components/ToastContainer.js';
import AlertBell from '@/components/AlertBell.js';

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
    // "Inspecciones" was a placeholder. The real flow is: insurer sees a
    // critical alert → solicits drone inspection → it shows up under
    // Operaciones (V2 nav addition when there's volume). For demo we
    // surface the loop from the Alertas page directly.
    { to: '/dashboard', label: 'Inicio', icon: '/insurance2.svg' },
    { to: '/dashboard/b2b/parcels', label: 'Parcelas Aseguradas', icon: '/location.svg' },
    { to: '/dashboard/b2b/alerts', label: 'Alertas', icon: '/siren.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/drone-pilot.svg' },
  ],
  admin: [
    { to: '/dashboard', label: 'Inicio', icon: '/system-administration.svg' },
    { to: '/dashboard/admin/dispatch', label: 'Despacho', icon: '/drone-pilot.svg' },
    { to: '/dashboard/admin/users', label: 'Usuarios', icon: '/user.svg' },
    { to: '/dashboard/admin/parcels', label: 'Parcelas', icon: '/location.svg' },
    { to: '/dashboard/admin/alerts', label: 'Alertas', icon: '/siren.svg' },
  ],
  cooperative: [
    // The cooperative dashboard already aggregates parcels + alerts per
    // socio. A separate "Parcelas" or "Alertas" tab would either show
    // nothing (user owns no parcels) or duplicate info. V2 brings:
    //  · /dashboard/cooperative/socios — full member admin
    //  · /dashboard/cooperative/reports — exportable reports
    { to: '/dashboard', label: 'Inicio', icon: '/provider-cooperative.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/drone-pilot.svg' },
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
    // h-screen + overflow-hidden contain the layout so inner pages can use
    // `h-full`. With min-h-screen the sidebar grew past the viewport when an
    // inner page asked for more height (cut off "Cerrar sesion" + body scroll).
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
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

      {/* Main content — flex column so the topbar is a fixed-height row and
          the outlet wrapper handles its own scroll. */}
      <main className="flex-1 bg-gray-50 flex flex-col min-w-0 overflow-hidden">
        {/* Minimal topbar — only renders meaningful chrome where it adds value.
            Farmer (and future cooperative) get the alert bell because their
            primary value prop is "we tell you when something happens". */}
        {(user.role === 'farmer' || user.role === 'cooperative') && (
          <div className="flex-shrink-0 flex items-center justify-end px-8 pt-5 pb-1">
            <AlertBell />
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-auto ${
          user.role === 'farmer' || user.role === 'cooperative' ? 'px-8 pb-8 pt-2' : 'p-8'
        }`}>
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
