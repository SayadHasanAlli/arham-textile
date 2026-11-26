import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ProductionEntryPage from "./pages/ProductionEntryPage";
import AllRecordsPage from "./pages/AllRecordsPage";
import WorkersPage from "./pages/WorkersPage";
import WorkerProfilePage from "./pages/WorkerProfilePage";
import VendorsPage from "./pages/VendorsPage";
import PricingPage from "./pages/PricingPage";
import SettingsPage from "./pages/SettingsPage";
import PayoutsPage from './pages/PayoutsPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="production-entry" element={<ProductionEntryPage />} />
              <Route path="records" element={<AllRecordsPage />} />
              <Route path="workers" element={<WorkersPage />} />
              <Route path="workers/:workerId" element={<WorkerProfilePage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="payouts" element={<PayoutsPage/>} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route
              path="/worker"
              element={
                <ProtectedRoute allowedRoles={["worker"]}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<WorkerProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
