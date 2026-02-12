import { useAuth } from '../../contexts/AuthContext';
import { ContractorProfile } from '../contractor/ContractorProfile';

function Settings() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile.role === 'contractor') {
    return <ContractorProfile />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p>Manage your account and preferences here.</p>
    </div>
  );
}

export default Settings;
