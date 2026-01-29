import React from "react";
import { useAuth } from './contexts/AuthContext';
import { Landing } from './components/Landing';
import { Layout } from './components/Layout';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { ContractorDashboard } from './components/contractor/ContractorDashboard';

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
      <div>
        <Landing />
      </div>
    );
  }

  return (
    <Layout>
      {profile.role === 'property_owner' && <OwnerDashboard />}
      {profile.role === 'contractor' && <ContractorDashboard />}
      {profile.role === 'admin' && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Coming soon...</p>
        </div>
      )}
    </Layout>
  );
}

export default App;
