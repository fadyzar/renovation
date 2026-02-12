import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ContractorProfile } from '../contractor/ContractorProfile';
import { AccountSettings } from './AccountSettings';

function Settings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'profile'>('account');

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile.role === 'contractor') {
    return (
      <div>
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('account')}
                className={`px-4 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === 'account'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Account Settings
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Public Profile
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'account' ? <AccountSettings /> : <ContractorProfile />}
      </div>
    );
  }

  return <AccountSettings />;
}

export default Settings;
