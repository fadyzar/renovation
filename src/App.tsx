import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { useAuth } from "./contexts/AuthContext";
import { Landing } from "./components/Landing";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/admin/AdminLayout";
import { OwnerDashboard } from "./components/owner/OwnerDashboard";
import { ContractorDashboard } from "./components/contractor/ContractorDashboard";
import { ProjectFeed } from "./components/contractor/ProjectFeed";
import { SubmitBid } from "./components/contractor/SubmitBid";
import { CreateProjectPage } from "./screens/CreateProjectPage";
import { ContractorMatching } from "./components/owner/ContractorMatching";
import { AcceptOffer } from "./components/owner/AcceptOffer";
import Settings from "./components/screens/Settings";
import Profile from "./components/screens/Profile";
import AccountSettingsPage from "./components/screens/AccountSettingsPage";
import ProjectHistory from "./components/screens/ProjectHistory";
import Support from "./components/screens/Support";
import { Messages } from "./components/screens/Messages";
import { ProjectPayments } from "./components/screens/ProjectPayments";
import { PaymentSuccess } from "./components/screens/PaymentSuccess";
import { NotificationsPage } from "./components/screens/NotificationsPage";
import { AdminDashboard } from "./components/screens/AdminDashboard";
import { AdminProjects } from "./components/screens/AdminProjects";
import { AdminRevenue } from "./components/screens/AdminRevenue";
import { AdminSupport } from "./components/screens/AdminSupport";

import { LoginPage } from "./components/auth/LoginPage";
import { SignUpPage } from "./components/auth/SignUpPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { ForceRefreshModal } from "./components/shared/ForceRefreshModal";
import { ContractorOnboarding } from "./components/contractor/ContractorOnboarding";

function SubmitBidPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  if (!projectId) return <Navigate to="/projects" replace />;
  return <SubmitBid projectId={projectId} onSuccess={() => navigate("/dashboard")} onCancel={() => navigate(-1)} />;
}

function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <ForceRefreshModal />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    );
  }

  // ─── Admin routes — dedicated sidebar layout ─────────────────────────────
  if (profile.role === "admin") {
    return (
      <AdminLayout>
        <ForceRefreshModal />
        <ScrollToTop />
        <Routes>
          <Route path="/admin"          element={<AdminDashboard />} />
          <Route path="/admin/projects" element={<AdminProjects />} />
          <Route path="/admin/revenue"  element={<AdminRevenue />} />
          <Route path="/admin/support"  element={<AdminSupport />} />
          {/* Allow admin to view any project page */}
          <Route path="/project/:projectId/payments"       element={<ProjectPayments />} />
          <Route path="/contractor-matching/:projectId"    element={<ContractorMatching />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminLayout>
    );
  }

  // ─── Contractor onboarding gate ─────────────────────────────────────────
  const needsOnboarding =
    profile.role === 'contractor' &&
    !profile.onboarding_completed &&
    (!profile.phone || !profile.specialties?.length);

  if (needsOnboarding) {
    return <ContractorOnboarding onComplete={() => {}} />;
  }

  // ─── Regular user routes ──────────────────────────────────────────────────
  return (
    <Layout>
      <ForceRefreshModal />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/signup" element={<Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            profile.role === "property_owner" ? <OwnerDashboard /> :
            profile.role === "contractor"     ? <ContractorDashboard /> :
            <Navigate to="/admin" replace />
          }
        />
        <Route
          path="/projects"
          element={profile.role === "contractor" ? <ProjectFeed /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="/create-project"                    element={<CreateProjectPage />} />
        <Route path="/contractor-matching/:projectId"    element={<ContractorMatching />} />
        <Route path="/accept-offer/:projectId/:bidId"    element={<AcceptOffer />} />
        <Route path="/submit-bid/:projectId"             element={<SubmitBidPage />} />
        <Route path="/project/:projectId/payments"       element={<ProjectPayments />} />
        <Route path="/payment-success"                   element={<PaymentSuccess />} />
        <Route path="/messages"                          element={<Messages />} />
        <Route path="/profile"                           element={<Profile />} />
        <Route path="/account-settings"                  element={<AccountSettingsPage />} />
        <Route path="/project-history"                   element={<ProjectHistory />} />
        <Route path="/settings"                          element={<Settings />} />
        <Route path="/support"                           element={<Support />} />
        <Route path="/notifications"                     element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
