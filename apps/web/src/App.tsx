import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore.js';
import LandingPage from '@/pages/LandingPage.js';
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
import B2BParcelsPage from '@/features/insurer/B2BParcelsPage.js';
import B2BAlertsPage from '@/features/insurer/B2BAlertsPage.js';
import AdminUsersPage from '@/features/admin/AdminUsersPage.js';

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
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="operations/:id" element={<OperationDetailPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="b2b/parcels" element={<B2BParcelsPage />} />
        <Route path="b2b/alerts" element={<B2BAlertsPage />} />
        <Route path="b2b/inspections" element={<PlaceholderPage title="Inspecciones" />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/parcels" element={<ParcelsPage />} />
        <Route path="admin/alerts" element={<PlaceholderPage title="Todas las Alertas" />} />
      </Route>

      {/* Public landing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-400">Proximamente</p>
    </div>
  );
}
