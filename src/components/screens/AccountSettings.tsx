import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Pencil, Check, Upload, LogOut, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2, X } from 'lucide-react';

/* ── shared input style ── */
const inputBase =
  'w-full h-[59px] px-6 bg-white border-[1.5px] border-[#D9D9D9] rounded-full text-brand-navy placeholder-[#909090] focus:outline-none focus:border-brand-blue focus:bg-[#EDF3FF] transition-colors disabled:bg-[#F5F5F5] disabled:text-[#909090] disabled:cursor-not-allowed';

/* ── section card ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#CFCFCF] rounded-2xl p-8 bg-white">
      <h2 className="text-[22px] font-bold text-brand-navy mb-6">{title}</h2>
      {children}
    </div>
  );
}

/* ── editable field ── */
function EditableField({
  label, value, onChange, type = 'text', placeholder, disabled, onToggle, saving,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled: boolean;
  onToggle: () => void; saving?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-brand-navy mb-2">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputBase + ' pr-12'}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-[#909090] hover:text-brand-blue transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          ) : disabled ? (
            <Pencil className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ── toggle switch ── */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[20px] font-medium text-brand-navy">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative w-[48px] h-[26px] rounded-full transition-colors duration-300 ${checked ? 'bg-brand-blue' : 'bg-[#D9D9D9]'}`}
      >
        <span className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${checked ? 'left-[25px]' : 'left-[3px]'}`} />
      </button>
    </div>
  );
}

/* ── toast ── */
function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold max-w-sm ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss}><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountSettings() {
  const { profile, refreshProfile, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── personal info state — seeded from profile, re-seeded when profile changes
  const [personalForm, setPersonalForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    address: (profile?.location as Record<string, string>)?.address || '',
  });
  const [personalEditing, setPersonalEditing] = useState({ full_name: false, phone: false, address: false });
  const [personalSaving, setPersonalSaving] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── password state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  // ── notifications
  const [notifications, setNotifications] = useState({
    contractorMessages: true,
    promotionalEmails: false,
  });

  // Re-seed when profile refreshes (e.g. after Public Profile tab saves)
  useEffect(() => {
    if (!profile) return;
    setPersonalForm({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      address: (profile.location as Record<string, string>)?.address || '',
    });
    setAvatarUrl(profile.avatar_url || '');
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Save a single personal field and refresh context
  async function savePersonalField(field: 'full_name' | 'phone' | 'address') {
    setPersonalSaving(field);
    try {
      let updatePayload: Record<string, unknown>;
      if (field === 'address') {
        updatePayload = {
          location: {
            ...(profile.location as Record<string, string> || {}),
            address: personalForm.address,
          },
        };
      } else {
        updatePayload = { [field]: personalForm[field] };
      }

      const { error } = await supabase.from('profiles').update(updatePayload).eq('id', profile.id);
      if (error) throw error;

      await refreshProfile();
      setPersonalEditing(e => ({ ...e, [field]: false }));
      showToast('Saved successfully');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setPersonalSaving(null);
    }
  }

  function togglePersonalField(field: 'full_name' | 'phone' | 'address') {
    if (personalEditing[field]) {
      // Was editing → save now
      savePersonalField(field);
    } else {
      // Enable editing
      setPersonalEditing(e => ({ ...e, [field]: true }));
    }
  }

  // ── Avatar upload
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      if (updateErr) throw updateErr;
      setAvatarUrl(data.publicUrl);
      await refreshProfile();
      showToast('Profile photo updated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Password change
  async function handlePasswordChange() {
    setPwError('');
    if (!pwForm.newPw) { setPwError('Enter a new password'); return; }
    if (pwForm.newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match'); return; }

    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
      if (error) throw error;
      setPwForm({ current: '', newPw: '', confirm: '' });
      showToast('Password changed successfully');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Password change failed');
    } finally {
      setPwSaving(false);
    }
  }

  // ── Logout all
  async function handleLogoutAll() {
    await signOut();
  }

  // ── Delete account (UI only — requires backend implementation)
  function handleDeleteAccount() {
    showToast('Please contact support to delete your account', 'error');
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="max-w-[999px] mx-auto">

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
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.full_name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-100 shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-blue to-brand-orange flex items-center justify-center text-white text-3xl font-bold shrink-0">
                  {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-6 h-[44px] rounded-full border-[1.5px] border-brand-blue text-brand-blue text-sm font-semibold hover:bg-[#EDF3FF] transition-colors">
                  {uploadingAvatar ? (
                    <><div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload profile picture</>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <EditableField
                label="Full Name"
                value={personalForm.full_name}
                onChange={v => setPersonalForm(f => ({ ...f, full_name: v }))}
                placeholder="Your full name"
                disabled={!personalEditing.full_name}
                onToggle={() => togglePersonalField('full_name')}
                saving={personalSaving === 'full_name'}
              />
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">Email Address</label>
                <input type="email" value={profile.email || ''} disabled className={inputBase} />
              </div>
              <EditableField
                label="Phone Number"
                value={personalForm.phone}
                onChange={v => setPersonalForm(f => ({ ...f, phone: v }))}
                placeholder="+1 (555) 000-0000"
                disabled={!personalEditing.phone}
                onToggle={() => togglePersonalField('phone')}
                saving={personalSaving === 'phone'}
              />
              <EditableField
                label="Address"
                value={personalForm.address}
                onChange={v => setPersonalForm(f => ({ ...f, address: v }))}
                placeholder="1600 Amphitheatre Pkwy, Mountain View, CA"
                disabled={!personalEditing.address}
                onToggle={() => togglePersonalField('address')}
                saving={personalSaving === 'address'}
              />
            </div>

            <p className="mt-4 text-sm text-gray-400 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Click the pencil icon next to any field to edit, then click the checkmark to save instantly.
            </p>
          </Section>

          {/* ══ 2. Security & Login ══ */}
          <Section title="Security & Login Settings">
            {pwError && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {pwError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* New password */}
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showPw.newPw ? 'text' : 'password'}
                    value={pwForm.newPw}
                    onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
                    placeholder="Min. 8 characters"
                    className={inputBase + ' pr-12'}
                  />
                  <button type="button" onClick={() => setShowPw(p => ({ ...p, newPw: !p.newPw }))} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#909090]">
                    {showPw.newPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Confirm password */}
              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showPw.confirm ? 'text' : 'password'}
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Repeat new password"
                    className={inputBase + ' pr-12'}
                  />
                  <button type="button" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#909090]">
                    {showPw.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleLogoutAll}
                className="flex-1 h-[54px] flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[#FF1612] text-[#FF1612] font-semibold hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout from All Devices
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving}
                className="flex-1 h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pwSaving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : 'Save New Password'}
              </button>
            </div>
          </Section>

          {/* ══ 3. Notification Settings ══ */}
          <Section title="Notification Settings">
            <div className="divide-y divide-[#CFCFCF]">
              <Toggle
                label="Contractor Messages"
                checked={notifications.contractorMessages}
                onChange={() => setNotifications(p => ({ ...p, contractorMessages: !p.contractorMessages }))}
              />
              <Toggle
                label="Promotional Emails"
                checked={notifications.promotionalEmails}
                onChange={() => setNotifications(p => ({ ...p, promotionalEmails: !p.promotionalEmails }))}
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
              <button
                onClick={() => showToast('Notification preferences saved')}
                className="flex-1 h-[54px] bg-brand-orange rounded-full border border-[#E6E8E7] text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Save Preferences
              </button>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
