import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Edit2, Upload, LogOut } from 'lucide-react';

export function AccountSettings() {
  const { profile, signOut } = useAuth();
  const [editing, setEditing] = useState({
    fullName: false,
    phone: false,
    address: false,
    currentPassword: false,
    confirmPassword: false,
    accountHolder: false,
    bankName: false,
    accountNumber: false,
    routingNumber: false,
    bankAddress: false,
    swiftCode: false
  });

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    address: '',
    currentPassword: '',
    confirmPassword: '',
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    bankAddress: '',
    swiftCode: ''
  });

  const [notifications, setNotifications] = useState({
    projectUpdates: true,
    paymentReminders: false,
    promotionalEmails: false
  });

  const toggleEdit = (field: keyof typeof editing) => {
    setEditing(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone
        })
        .eq('id', profile?.id);

      if (error) throw error;
      setEditing(prev => ({ ...prev, fullName: false, phone: false, address: false }));
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleLogoutAll = async () => {
    if (confirm('Are you sure you want to logout from all devices?')) {
      await signOut();
    }
  };

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      console.log('Delete account');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Manage Your Account - Update Your Information & Preferences
          </h1>
          <p className="text-gray-600">
            Edit your profile details, adjust security settings, and manage notifications
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      disabled={!editing.fullName}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('fullName')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={!editing.phone}
                      placeholder="+1 12345789"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('phone')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      disabled={!editing.address}
                      placeholder="1600 Amphitheatre Parkway, Mountain View, CA 94043, USA"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('address')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <button className="w-full px-6 py-3 bg-white border-2 border-blue-500 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <Upload className="w-5 h-5" />
                Upload my profile picture
              </button>

              <button
                onClick={handleUpdateProfile}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Security & Login Settings</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      disabled={!editing.currentPassword}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('currentPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      disabled={!editing.confirmPassword}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('confirmPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogoutAll}
                className="w-full px-6 py-3 bg-white border-2 border-red-500 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Logout from All Devices
              </button>

              <button className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                Save New Password
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bank Details</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Holder Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.accountHolder}
                      onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                      disabled={!editing.accountHolder}
                      placeholder="Gilad Ben Arush"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('accountHolder')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      disabled={!editing.bankName}
                      placeholder="Bank of America"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('bankName')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Account Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      disabled={!editing.accountNumber}
                      placeholder="78527735612"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('accountNumber')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Routing Number (ABA)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.routingNumber}
                      onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
                      disabled={!editing.routingNumber}
                      placeholder="10791"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('routingNumber')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Address (optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.bankAddress}
                      onChange={(e) => setFormData({ ...formData, bankAddress: e.target.value })}
                      disabled={!editing.bankAddress}
                      placeholder="Address ABCD"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('bankAddress')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SWIFT Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.swiftCode}
                      onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                      disabled={!editing.swiftCode}
                      placeholder="10930"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => toggleEdit('swiftCode')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <button className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                Save Changes
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Settings</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="notifications"
                  checked={notifications.projectUpdates}
                  onChange={() => setNotifications({ projectUpdates: true, paymentReminders: false, promotionalEmails: false })}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-gray-700">Project Updates</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="notifications"
                  checked={notifications.paymentReminders}
                  onChange={() => setNotifications({ projectUpdates: false, paymentReminders: true, promotionalEmails: false })}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-gray-700">Payment Reminders</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="notifications"
                  checked={notifications.promotionalEmails}
                  onChange={() => setNotifications({ projectUpdates: false, paymentReminders: false, promotionalEmails: true })}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-gray-700">Promotional Emails</span>
              </label>

              <button
                onClick={handleDeleteAccount}
                className="w-full px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-xl">🗑️</span>
                Delete My Account
              </button>

              <button className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
                Save Notification Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
