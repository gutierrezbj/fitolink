import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore.js';
import LandingPage from '@/pages/LandingPage.js';
import TermsPage from '@/pages/TermsPage.js';
import PrivacyPage from '@/pages/PrivacyPage.js';
import PricingPage from '@/pages/PricingPage.js';
import SigpacViewerPage from '@/pages/SigpacViewerPage.js';
import AvisosPage from '@/pages/AvisosPage.js';
import CalcLgpPage from '@/pages/CalcLgpPage.js';
import LoginPage from '@/features/auth/LoginPage.js';
import RegisterPage from '@/features/auth/RegisterPage.js';
import DashboardLayout from '@/layouts/DashboardLayout.js';
import DashboardHome from '@/features/admin/DashboardHome.js';
import ParcelsPage from '@/features/parcels/ParcelsPage.js';
import AlertsPage from '@/features/alerts/AlertsPage.js';
import OperationsPage from '@/features/operations/OperationsPage.js';
import CreateParcelPage from '@/features/parcels/CreateParcelPage.js';
import AssignmentsPage from '@/features/pilot/AssignmentsPage.js';
import OperationDetailPage from '@/features/operations/OperationDetailPage.js';
import ParcelDetailPage from '@/features/parcels/ParcelDetailPage.js';
import MarketplacePage from '@/features/marketplace/MarketplacePage.js';
import ServicesPage from '@/features/services/ServicesPage.js';
import B2BParcelsPage from '@/features/insurer/B2BParcelsPage.js';
import B2BAlertsPage from '@/features/insurer/B2BAlertsPage.js';
import AdminUsersPage from '@/features/admin/AdminUsersPage.js';
import DispatchPage from '@/features/admin/DispatchPage.js';
import CooperativeMembersPage from '@/features/cooperative/CooperativeMembersPage.js';
import PredictionPage from '@/features/prediction/PredictionPage.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      {/* Sprint Visor SIGPAC público · 04-jun-2026. URL parametrizada para
          enlaces compartibles: /sigpac/23/74/0/0/3/1/1 carga directamente
          la parcela. /sigpac sin params muestra formulario vacío. */}
      <Route path="/sigpac" element={<SigpacViewerPage />} />
      <Route path="/sigpac/:prov/:muni/:agre/:zona/:poligono/:parcela/:recinto" element={<SigpacViewerPage />} />
      {/* Tablón de avisos fitosanitarios oficiales · 2º lead magnet · 11-jun-2026 */}
      <Route path="/avisos" element={<AvisosPage />} />
      {/* Calc LGP · calculadora Love Green (dron) · 3er lead magnet · 11-jul-2026 */}
      <Route path="/calc-lgp" element={<CalcLgpPage />} />

      {/* Protected Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="parcels/new" element={<CreateParcelPage />} />
        <Route path="parcels/:id" element={<ParcelDetailPage />} />
        <Route path="parcels" element={<ParcelsPage />} />
        <Route path="prediction" element={<PredictionPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="operations/:id" element={<OperationDetailPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="b2b/parcels" element={<B2BParcelsPage />} />
        <Route path="b2b/alerts" element={<B2BAlertsPage />} />
        {/* Sprint Onboarding Cooperativa · 05-jun-2026 · admin de socios */}
        <Route path="cooperative/socios" element={<CooperativeMembersPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/parcels" element={<ParcelsPage />} />
        <Route path="admin/dispatch" element={<DispatchPage />} />
      </Route>

      {/* Public landing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
