import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { Landing } from "./components/Landing";
import { Layout } from "./components/Layout";
import { OwnerDashboard } from "./components/owner/OwnerDashboard";
import { ContractorDashboard } from "./components/contractor/ContractorDashboard";
import { ProjectFeed } from "./components/contractor/ProjectFeed";
import { SubmitBid } from "./components/contractor/SubmitBid";
import { CreateProjectPage } from "./screens/CreateProjectPage";
import { ContractorMatching } from "./components/owner/ContractorMatching";
import { AcceptOffer } from "./components/owner/AcceptOffer";
import Settings from "./components/screens/Settings";
import Support from "./components/screens/Support";
import { Messages } from "./components/screens/Messages";

import { LoginPage } from "./components/auth/LoginPage";
import { SignUpPage } from "./components/auth/SignUpPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";

function SubmitBidPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <SubmitBid
      projectId={projectId}
      onSuccess={() => navigate("/dashboard")}
      onCancel={() => navigate(-1)}
    />
  );
}

function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/signup" element={<Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            profile.role === "property_owner" ? (
              <OwnerDashboard />
            ) : profile.role === "contractor" ? (
              <ContractorDashboard />
            ) : (
              <div className="max-w-7xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-gray-600 mt-2">Coming soon...</p>
              </div>
            )
          }
        />
        <Route
          path="/projects"
          element={
            profile.role === "contractor" ? (
              <ProjectFeed />
            ) : (
              <div className="max-w-7xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold">Projects</h1>
                <p className="text-gray-600 mt-2">Coming soon...</p>
              </div>
            )
          }
        />
        <Route path="/create-project" element={<CreateProjectPage />} />
        <Route path="/contractor-matching/:projectId" element={<ContractorMatching />} />
        <Route path="/accept-offer/:projectId/:bidId" element={<AcceptOffer />} />
        <Route path="/submit-bid/:projectId" element={<SubmitBidPage />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
