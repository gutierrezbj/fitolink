import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore.js';
import ToastContainer from '@/components/ToastContainer.js';
import AlertBell from '@/components/AlertBell.js';

// Sidebar icon set — set unificado `nav-*.svg` con el mismo lenguaje
// visual que `service-*.svg` (círculo brand-600 #46632e + trazo blanco
// mínimo). Sustituyó el set Flaticon multicolor 13-may-2026 para
// armonizar el sidebar con las cards de servicios y el resto del
// producto (paleta FitoLink + Instrument Serif + DM Sans).
const NAV_ITEMS: Record<string, Array<{ to: string; label: string; icon: string }>> = {
  farmer: [
    { to: '/dashboard', label: 'Inicio', icon: '/nav-home.svg' },
    { to: '/dashboard/parcels', label: 'Mis Parcelas', icon: '/nav-parcels.svg' },
    { to: '/dashboard/alerts', label: 'Alertas', icon: '/nav-alerts.svg' },
    { to: '/dashboard/operations', label: 'Operaciones', icon: '/nav-operations.svg' },
    { to: '/dashboard/services', label: 'Servicios', icon: '/nav-services.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/nav-marketplace.svg' },
  ],
  pilot: [
    { to: '/dashboard', label: 'Inicio', icon: '/nav-home.svg' },
    { to: '/dashboard/assignments', label: 'Asignaciones', icon: '/nav-assignments.svg' },
    { to: '/dashboard/operations', label: 'Historial', icon: '/nav-operations.svg' },
    { to: '/dashboard/marketplace', label: 'Red de Pilotos', icon: '/nav-pilot.svg' },
  ],
  insurer: [
    // "Inspecciones" was a placeholder. The real flow is: insurer sees a
    // critical alert → solicits drone inspection → it shows up under
    // Operaciones (V2 nav addition when there's volume). For demo we
    // surface the loop from the Alertas page directly.
    { to: '/dashboard', label: 'Inicio', icon: '/nav-insurance.svg' },
    { to: '/dashboard/b2b/parcels', label: 'Parcelas Aseguradas', icon: '/nav-parcels.svg' },
    { to: '/dashboard/b2b/alerts', label: 'Alertas', icon: '/nav-alerts.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/nav-marketplace.svg' },
  ],
  admin: [
    { to: '/dashboard', label: 'Inicio', icon: '/nav-admin.svg' },
    { to: '/dashboard/admin/dispatch', label: 'Despacho', icon: '/nav-pilot.svg' },
    { to: '/dashboard/admin/users', label: 'Usuarios', icon: '/nav-users.svg' },
    { to: '/dashboard/admin/parcels', label: 'Parcelas', icon: '/nav-parcels.svg' },
    { to: '/dashboard/admin/alerts', label: 'Alertas', icon: '/nav-alerts.svg' },
  ],
  cooperative: [
    // Sprint Onboarding Cooperativa básico · 05-jun-2026 · añadido "Socios"
    // como segundo entry point. Antes solo "Inicio" + "Proveedores" daba
    // sensación de "demasiado simple" para un prospect cooperativa.
    // V2: añadir "Reportes" cuando llegue el primer cliente real.
    { to: '/dashboard', label: 'Inicio', icon: '/nav-cooperative.svg' },
    { to: '/dashboard/cooperative/socios', label: 'Socios', icon: '/nav-users.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/nav-marketplace.svg' },
  ],
  // ADV (Agrupación de Defensa Vegetal) · vigilancia comarcal +
  // avisos preventivos a socios + reporte RAIF. Sprint Rol ADV
  // 05-jun-2026. Estructura inicial mínima viable — el dashboard
  // agrega alertas de la comarca y vigila las parcelas de socios.
  // V2 traerá: /dashboard/adv/socios + /dashboard/adv/raif (reporte
  // oficial cuatrimestral) + /dashboard/adv/visitas-campo.
  adv: [
    { to: '/dashboard', label: 'Inicio', icon: '/nav-cooperative.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/nav-marketplace.svg' },
  ],
  // Comunidad de Regantes · gestión hídrica colectiva + reparto agua +
  // cumplimiento RD 950/2024. Sprint Regantes · 05-jun-2026. Mismo
  // patrón que cooperative/adv pero con foco en riego.
  // V2 traerá: /dashboard/regantes/reparto (sugerencia semanal m³/ha
  // por socio) + /dashboard/regantes/cuaderno (cuaderno digital de
  // riegos) + /dashboard/regantes/aforos (match con tabla aforos).
  regantes: [
    { to: '/dashboard', label: 'Inicio', icon: '/nav-cooperative.svg' },
    { to: '/dashboard/marketplace', label: 'Proveedores', icon: '/nav-marketplace.svg' },
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
      <aside className="w-64 bg-white border-r border-earth-300/30 flex flex-col h-full">
        {/* AgroM wordmark + FitoLink product label.
            Wordmark image keeps brand identity consistent with the email
            sender ("Agro•M"). The product label sits below as the route
            into the dashboard product — same family, two voices. */}
        <div className="px-5 py-5 border-b border-earth-300/30">
          <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-7 w-auto" />
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 mt-2.5">
            FitoLink · del pixel al tratamiento
          </p>
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
                    ? 'bg-brand-50 text-brand-600'
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
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm">
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
        {(user.role === 'farmer' || user.role === 'cooperative' || user.role === 'adv' || user.role === 'regantes') && (
          <div className="flex-shrink-0 flex items-center justify-end px-8 pt-5 pb-1">
            <AlertBell />
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-auto ${
          user.role === 'farmer' || user.role === 'cooperative' || user.role === 'adv' || user.role === 'regantes' ? 'px-8 pb-8 pt-2' : 'p-8'
        }`}>
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
