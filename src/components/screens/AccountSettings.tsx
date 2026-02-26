import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Pencil, Upload, LogOut, Trash2 } from 'lucide-react';

/* ── shared input style matching Figma ── */
const inputBase =
  'w-full h-[59px] px-6 bg-white border-[1.5px] border-[#D9D9D9] rounded-full text-brand-navy placeholder-[#909090] focus:outline-none focus:border-brand-blue focus:bg-[#EDF3FF] transition-colors disabled:bg-[#F5F5F5] disabled:text-[#909090] disabled:cursor-not-allowed';

/* ── section card wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#CFCFCF] rounded-2xl p-8 bg-white">
      <h2 className="text-[22px] font-bold text-brand-navy mb-6">{title}</h2>
      {children}
    </div>
  );
}

/* ── labelled editable input row ── */
function EditableField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-brand-navy mb-2">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputBase + ' pr-12'}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-[#909090] hover:text-brand-blue transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── toggle switch ── */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[20px] font-medium text-brand-navy">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative w-[48px] h-[26px] rounded-full transition-colors duration-300 ${
          checked ? 'bg-brand-blue' : 'bg-[#D9D9D9]'
        }`}
      >
        <span
          className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
            checked ? 'left-[25px]' : 'left-[3px]'
          }`}
        />
      </button>
    </div>
  );
}

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
    swiftCode: false,
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
    swiftCode: '',
  });

  const [notifications, setNotifications] = useState({
    contractorMessages: true,
    promotionalEmails: false,
  });

  const toggle = (field: keyof typeof editing) =>
    setEditing((prev) => ({ ...prev, [field]: !prev[field] }));

  const set = (field: keyof typeof formData) => (v: string) =>
    setFormData((prev) => ({ ...prev, [field]: v }));

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: formData.full_name, phone: formData.phone })
        .eq('id', profile?.id);
      if (error) throw error;
      setEditing((p) => ({ ...p, fullName: false, phone: false, address: false }));
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const handleLogoutAll = async () => {
    if (confirm('Are you sure you want to logout from all devices?')) await signOut();
  };

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.'))
      console.log('Delete account');
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-[999px] mx-auto">

        {/* ── Page heading ── */}
        <div className="mb-10">
          <h1 className="text-[40px] leading-[1.2] font-extrabold text-brand-navy max-w-[771px]">
            Manage Your Account – Update Your Information & Preferences
          </h1>
          <p className="text-[20px] text-[#909090] mt-3">
            Edit your profile details, adjust security settings, and manage notifications.
          </p>
        </div>

        <div className="space-y-6">

          {/* ══ 1. Personal Information ══ */}
          <Section title="Personal Information">

            {/* Avatar */}
            <div className="flex items-center gap-5 mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-blue to-brand-orange flex items-center justify-center text-white text-3xl font-bold shrink-0">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-6 h-[44px] rounded-full border-[1.5px] border-brand-blue text-brand-blue text-sm font-semibold hover:bg-[#EDF3FF] transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload profile picture
                </div>
                <input type="file" accept="image/*" className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <EditableField
                label="Full Name"
                value={formData.full_name}
                onChange={set('full_name')}
                placeholder="Your full name"
                disabled={!editing.fullName}
                onToggle={() => toggle('fullName')}
              />
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">Email Address</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  disabled
                  className={inputBase}
                />
              </div>
              <EditableField
                label="Phone Number"
                value={formData.phone}
                onChange={set('phone')}
                placeholder="+1 (555) 000-0000"
                disabled={!editing.phone}
                onToggle={() => toggle('phone')}
              />
              <EditableField
                label="Address"
                value={formData.address}
                onChange={set('address')}
                placeholder="1600 Amphitheatre Pkwy, Mountain View, CA"
                disabled={!editing.address}
                onToggle={() => toggle('address')}
              />
            </div>

            <button
              onClick={handleUpdateProfile}
              className="mt-6 w-full h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
          </Section>

          {/* ══ 2. Security & Login ══ */}
          <Section title="Security & Login Settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <EditableField
                label="Current Password"
                value={formData.currentPassword}
                onChange={set('currentPassword')}
                type="password"
                placeholder="••••••••••••"
                disabled={!editing.currentPassword}
                onToggle={() => toggle('currentPassword')}
              />
              <EditableField
                label="New Password"
                value={formData.confirmPassword}
                onChange={set('confirmPassword')}
                type="password"
                placeholder="••••••••••••"
                disabled={!editing.confirmPassword}
                onToggle={() => toggle('confirmPassword')}
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleLogoutAll}
                className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[#FF1612] text-[#FF1612] font-semibold hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout from All Devices
              </button>
              <button className="flex-1 h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity">
                Save New Password
              </button>
            </div>
          </Section>

          {/* ══ 3. Bank Details ══ */}
          <Section title="Bank Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <EditableField
                label="Account Holder Name"
                value={formData.accountHolder}
                onChange={set('accountHolder')}
                placeholder="Full name as on bank account"
                disabled={!editing.accountHolder}
                onToggle={() => toggle('accountHolder')}
              />
              <EditableField
                label="Bank Name"
                value={formData.bankName}
                onChange={set('bankName')}
                placeholder="Bank of America"
                disabled={!editing.bankName}
                onToggle={() => toggle('bankName')}
              />
              <EditableField
                label="Bank Account Number"
                value={formData.accountNumber}
                onChange={set('accountNumber')}
                placeholder="78527735612"
                disabled={!editing.accountNumber}
                onToggle={() => toggle('accountNumber')}
              />
              <EditableField
                label="Routing Number (ABA)"
                value={formData.routingNumber}
                onChange={set('routingNumber')}
                placeholder="10791"
                disabled={!editing.routingNumber}
                onToggle={() => toggle('routingNumber')}
              />
              <EditableField
                label="Bank Address (Optional)"
                value={formData.bankAddress}
                onChange={set('bankAddress')}
                placeholder="Address ABCD"
                disabled={!editing.bankAddress}
                onToggle={() => toggle('bankAddress')}
              />
              <EditableField
                label="SWIFT Code"
                value={formData.swiftCode}
                onChange={set('swiftCode')}
                placeholder="10930"
                disabled={!editing.swiftCode}
                onToggle={() => toggle('swiftCode')}
              />
            </div>

            <button className="mt-6 w-full h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity">
              Save Changes
            </button>
          </Section>

          {/* ══ 4. Notification Settings ══ */}
          <Section title="Notification Settings">
            <div className="divide-y divide-[#CFCFCF]">
              <Toggle
                label="Contractor Messages"
                checked={notifications.contractorMessages}
                onChange={() =>
                  setNotifications((p) => ({ ...p, contractorMessages: !p.contractorMessages }))
                }
              />
              <Toggle
                label="Promotional Emails"
                checked={notifications.promotionalEmails}
                onChange={() =>
                  setNotifications((p) => ({ ...p, promotionalEmails: !p.promotionalEmails }))
                }
              />
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleDeleteAccount}
                className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[#CFCFCF] text-brand-navy font-semibold hover:bg-gray-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete My Account
              </button>
              <button className="flex-1 h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity">
                Save Preferences
              </button>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
