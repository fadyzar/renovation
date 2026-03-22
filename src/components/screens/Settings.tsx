import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ContractorProfile } from '../contractor/ContractorProfile';
import { OwnerProfile } from '../owner/OwnerProfile';
import { AccountSettings } from './AccountSettings';

function Settings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'profile'>('account');

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: 'account' as const, label: 'Account Settings' },
    { key: 'profile' as const, label: profile.role === 'contractor' ? 'Public Profile' : 'My Profile' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-4 font-semibold border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'account' ? (
        <AccountSettings />
      ) : profile.role === 'contractor' ? (
        <ContractorProfile />
      ) : (
        <OwnerProfile />
      )}
    </div>
  );
}

export default Settings;
