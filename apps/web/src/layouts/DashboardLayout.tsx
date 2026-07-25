import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/authStore.js';
import { api } from '@/lib/api.js';
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
    { to: '/dashboard/prediction', label: 'Predicción', icon: '/nav-prediction.svg' },
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
    { to: '/dashboard/admin/import-parcels', label: 'Importar KMZ', icon: '/import-parcel.svg' },
    // "Alertas" quitado: /dashboard/admin/alerts no tiene ruta real (era un
    // placeholder "Próximamente"). El loop de alertas se ve desde el Inicio.
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
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ¿Tiene esta cuenta la parcela elegible para Predicción? La sección está
  // ligada a ENCINEÑO (la parcela del fondo, identificada por nombre, con
  // histórico satelital). Si no la tiene, ocultamos el item de nav: el resto
  // de farmers (pistacho/cereal/olivar sin calibrar) no verían más que el
  // estado honesto. Misma condición que PredictionPage → nav y página
  // coherentes. Reusa la caché de ['parcels','mine'] (ya la piden otras
  // vistas), así que no añade carga real.
  const { data: parcels } = useQuery({
    queryKey: ['parcels', 'mine'],
    queryFn: async () => {
      const res = await api.get('/parcels/mine');
      return res.data.data as Array<{ name?: string; ndviHistory?: unknown[] }>;
    },
    enabled: user?.role === 'farmer',
  });
  const hasPrediction =
    (parcels ?? []).some(
      (p) => /encine[ñn]o/i.test(p.name ?? '') && (p.ndviHistory?.length ?? 0) > 0,
    );

  if (!user) {
    navigate('/login');
    return null;
  }

  const baseNav = NAV_ITEMS[user.role] || NAV_ITEMS.farmer;
  const navItems = baseNav.filter(
    (item) => item.to !== '/dashboard/prediction' || hasPrediction,
  );

  return (
    // h-screen + overflow-hidden contain the layout so inner pages can use
    // `h-full`. With min-h-screen the sidebar grew past the viewport when an
    // inner page asked for more height (cut off "Cerrar sesion" + body scroll).
    <div className="h-screen flex overflow-hidden">
      {/* Backdrop — solo móvil, cuando el drawer está abierto. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      {/* Sidebar — drawer deslizante en móvil, fijo en lg+. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-earth-300/30 flex flex-col h-full transform transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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
              onClick={() => setSidebarOpen(false)}
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
            onClick={() => { logout(); queryClient.clear(); navigate('/login'); }}
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
        {/* Barra superior MÓVIL (< lg): hamburguesa + logo + campana. Sin esto
            el sidebar tapaba el contenido en móvil (drawer + botón para abrirlo). */}
        <div className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-earth-300/30">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/brand/agrom-wordmark.svg" alt="AgroM" className="h-6 w-auto" />
          {user.role === 'farmer' || user.role === 'cooperative' || user.role === 'adv' || user.role === 'regantes' ? (
            <AlertBell />
          ) : (
            <span className="w-8" />
          )}
        </div>
        {/* Barra superior ESCRITORIO (lg+): solo la campana a la derecha.
            Farmer/cooperativa/adv/regantes la tienen porque su valor es
            "te avisamos cuando pasa algo". */}
        {(user.role === 'farmer' || user.role === 'cooperative' || user.role === 'adv' || user.role === 'regantes') && (
          <div className="hidden lg:flex flex-shrink-0 items-center justify-end px-8 pt-5 pb-1">
            <AlertBell />
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-auto ${
          user.role === 'farmer' || user.role === 'cooperative' || user.role === 'adv' || user.role === 'regantes' ? 'px-4 lg:px-8 pb-8 pt-4 lg:pt-2' : 'p-4 lg:p-8'
        }`}>
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
