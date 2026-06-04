import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Upload, Edit2, Check, X, Camera, ShieldCheck, AlertCircle,
  Clock, Phone, Briefcase, FileText, User, Tag, ChevronDown,
  ChevronUp, BadgeCheck, CheckCircle2, Star, MapPin, Globe,
  Award, TrendingUp,
} from 'lucide-react';
import { LicenseVerificationModal } from './LicenseVerificationModal';
import { WorkTypePicker } from '../shared/WorkTypePicker';

// ─── Profile completeness ─────────────────────────────────────────────────────

function computeCompleteness(p: {
  full_name?: string; company_name?: string; phone?: string; bio?: string;
  license_number?: string; years_experience?: number; specialties?: string[];
  avatar_url?: string; verification_status?: string; service_area?: string;
}): { score: number; checks: { label: string; ok: boolean }[] } {
  const checks = [
    { label: 'Full name', ok: !!(p.full_name?.trim()) },
    { label: 'Company name', ok: !!(p.company_name?.trim()) },
    { label: 'Phone number', ok: !!(p.phone?.trim()) },
    { label: 'Service area', ok: !!(p.service_area?.trim()) },
    { label: 'About / bio', ok: (p.bio?.trim().length ?? 0) > 20 },
    { label: 'License number', ok: !!(p.license_number?.trim()) },
    { label: 'License verified', ok: p.verification_status === 'verified' },
    { label: 'Years of experience', ok: (p.years_experience ?? 0) > 0 },
    { label: 'Specialties (min 1)', ok: (p.specialties?.length ?? 0) > 0 },
    { label: 'Profile photo', ok: !!(p.avatar_url) },
  ];
  return {
    score: Math.round((checks.filter(c => c.ok).length / checks.length) * 100),
    checks,
  };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold animate-slide-up ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss}><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractorProfile() {
  const { profile, refreshProfile } = useAuth();

  const [editingMain, setEditingMain] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [editingLicense, setEditingLicense] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [backgroundUrl, setBackgroundUrl] = useState(profile?.background_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(profile?.verification_status || 'not_verified');

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    company_name: profile?.company_name || '',
    phone: profile?.phone || '',
    years_experience: profile?.years_experience ?? 0,
    service_area: (profile as Record<string, unknown>)?.service_area as string || '',
  });
  const [bio, setBio] = useState(profile?.bio || '');
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number || '');
  const [licenseNumberEdit, setLicenseNumberEdit] = useState(profile?.license_number || '');
  const [specialties, setSpecialties] = useState<string[]>(profile?.specialties ?? []);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Re-seed local state when profile changes in context
  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || '',
      company_name: profile.company_name || '',
      phone: profile.phone || '',
      years_experience: profile.years_experience ?? 0,
      service_area: (profile as Record<string, unknown>)?.service_area as string || '',
    });
    setBio(profile.bio || '');
    setLicenseNumber(profile.license_number || '');
    setLicenseNumberEdit(profile.license_number || '');
    setSpecialties(profile.specialties ?? []);
    setAvatarUrl(profile.avatar_url || '');
    setBackgroundUrl(profile.background_url || '');
    setVerificationStatus(profile.verification_status || 'not_verified');
  }, [profile]);

  // Realtime: watch for admin verification updates
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel(`profile-${profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          if (payload.new.verification_status) setVerificationStatus(payload.new.verification_status);
          if (payload.new.license_number) setLicenseNumber(payload.new.license_number);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  const { score, checks } = computeCompleteness({
    ...form,
    service_area: form.service_area,
    bio, license_number: licenseNumber,
    specialties, avatar_url: avatarUrl, verification_status: verificationStatus,
  });
  const missing = checks.filter(c => !c.ok);

  async function saveMainInfo() {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name,
        company_name: form.company_name,
        phone: form.phone,
        years_experience: form.years_experience || null,
        service_area: form.service_area || null,
      } as Record<string, unknown>).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditingMain(false);
      showToast('Profile updated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveBio() {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ bio }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditingBio(false);
      showToast('Bio saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveLicenseNumber() {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ license_number: licenseNumberEdit }).eq('id', profile.id);
      if (error) throw error;
      setLicenseNumber(licenseNumberEdit);
      await refreshProfile();
      setEditingLicense(false);
      showToast('License number saved');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveSpecialties(updated: string[]) {
    if (!profile?.id) return;
    setSpecialties(updated);
    await supabase.from('profiles').update({ specialties: updated }).eq('id', profile.id);
    await refreshProfile();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      setAvatarUrl(data.publicUrl);
      await refreshProfile();
      showToast('Photo updated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setUploadingBackground(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/background.${ext}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ background_url: data.publicUrl }).eq('id', profile.id);
      setBackgroundUrl(data.publicUrl);
      await refreshProfile();
    } catch { /* ignore */ } finally {
      setUploadingBackground(false);
    }
  }

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-gray-500';
  const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  const verifiedBadge = (
    <span className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 cursor-help">
      <ShieldCheck className="w-3.5 h-3.5" />
      License Verified
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
        Confirmed active via CSLB database
      </span>
    </span>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* ── Profile Strength ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${score >= 80 ? 'bg-green-100' : score >= 50 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <BadgeCheck className={`w-5 h-5 ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-500' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Profile Strength</p>
                <p className="text-xs text-gray-500">{score >= 80 ? 'Great — you appear higher in search' : score >= 50 ? 'Getting there' : 'Complete your profile to get more bids'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
            </div>
          </div>

          {/* Progress bar with segments */}
          <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
          </div>

          {/* Checklist */}
          <button
            onClick={() => setShowChecklist(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showChecklist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {missing.length > 0 ? `${missing.length} item${missing.length !== 1 ? 's' : ''} remaining` : 'Profile complete!'}
          </button>

          {showChecklist && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {checks.map(c => (
                <div key={c.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${c.ok ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                  {c.ok
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  }
                  {c.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Hero Card ─────────────────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden shadow-sm border border-gray-200 bg-white">
          {/* Cover */}
          <div className="h-52 relative group">
            {backgroundUrl
              ? <img src={backgroundUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
            }
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/20" />
            <button
              onClick={() => backgroundInputRef.current?.click()}
              disabled={uploadingBackground}
              className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingBackground ? 'Uploading…' : 'Change Cover'}
            </button>
            <input ref={backgroundInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
          </div>

          <div className="px-8 pb-8 -mt-14 relative">
            {/* Avatar */}
            <div className="relative inline-block mb-4">
              <img
                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.full_name || 'Pro')}&size=200&background=3b82f6&color=fff`}
                alt={form.full_name}
                className="w-28 h-28 rounded-2xl border-4 border-white shadow-xl object-cover"
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center border-2 border-white shadow-lg hover:bg-blue-700 transition-colors"
              >
                {uploadingAvatar
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-3.5 h-3.5 text-white" />
                }
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editingMain ? (
                  <div className="space-y-2 mb-3">
                    <input
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="Full name"
                      className="w-full text-2xl font-bold border-b-2 border-blue-500 focus:outline-none bg-transparent text-gray-900 pb-1"
                    />
                    <input
                      value={form.company_name}
                      onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                      placeholder="Company / business name"
                      className="w-full text-base text-gray-600 border-b border-gray-300 focus:outline-none bg-transparent pb-1"
                    />
                  </div>
                ) : (
                  <div className="mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {form.full_name || <span className="text-gray-400">Your Name</span>}
                    </h2>
                    <p className="text-gray-500 text-sm mt-0.5">
                      {form.company_name || <span className="italic text-gray-400">Add company name</span>}
                    </p>
                  </div>
                )}

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {verificationStatus === 'verified' && verifiedBadge}
                  {verificationStatus === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                      <Clock className="w-3.5 h-3.5" />Verification Pending
                    </span>
                  )}
                  {verificationStatus === 'rejected' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5" />Verification Failed
                    </span>
                  )}
                  {(form.years_experience ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
                      <Briefcase className="w-3 h-3" />
                      {form.years_experience} yrs experience
                    </span>
                  )}
                </div>

                {/* Info pills (display mode) */}
                {!editingMain && (
                  <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                    {form.phone && (
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{form.phone}</span>
                    )}
                    {form.service_area && (
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{form.service_area}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {editingMain ? (
                  <>
                    <button
                      onClick={saveMainInfo}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingMain(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingMain(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />Edit
                  </button>
                )}
              </div>
            </div>

            {/* Edit form expanded */}
            {editingMain && (
              <div className="mt-4 grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl">
                    <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" className="flex-1 text-sm focus:outline-none bg-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Years of Experience</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl">
                    <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input type="number" min="0" max="60" value={form.years_experience || ''} onChange={e => setForm(f => ({ ...f, years_experience: parseInt(e.target.value) || 0 }))} placeholder="0" className="flex-1 text-sm focus:outline-none bg-transparent" />
                    <span className="text-xs text-gray-400">yrs</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Service Area</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl">
                    <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input type="text" value={form.service_area} onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))} placeholder="e.g. Los Angeles, CA · Orange County" className="flex-1 text-sm focus:outline-none bg-transparent" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Cities or regions where you accept projects</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Row ────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Rating', value: profile?.rating ? `${profile.rating.toFixed(1)}` : '—', sub: '/ 5.0', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Projects', value: String(profile?.total_projects ?? 0), sub: 'completed', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Experience', value: (form.years_experience ?? 0) > 0 ? String(form.years_experience) : '—', sub: 'years', icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Specialties', value: String(specialties.length), sub: 'selected', icon: Tag, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              <p className="text-xs font-medium text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── License & Verification ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">License & Verification</h3>
              <p className="text-xs text-gray-500">Verified contractors get priority placement in search results</p>
            </div>
          </div>

          {verificationStatus === 'verified' ? (
            /* ── Verified state ─── */
            <div className="p-6">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-emerald-800 text-lg">Verified Contractor</p>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-sm text-emerald-700">License confirmed active via California CSLB database</p>
                  {licenseNumber && (
                    <p className="text-xs text-emerald-600 mt-1 font-mono">License #{licenseNumber}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* License number field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CSLB License Number</label>
                {editingLicense ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={licenseNumberEdit}
                      onChange={e => setLicenseNumberEdit(e.target.value)}
                      placeholder="e.g. 1098765"
                      className="flex-1 px-4 py-3 border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-mono"
                      autoFocus
                    />
                    <button onClick={saveLicenseNumber} disabled={saving} className="flex items-center gap-1.5 px-4 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                      <Check className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => { setLicenseNumberEdit(licenseNumber); setEditingLicense(false); }} className="p-3 hover:bg-gray-100 rounded-xl">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-mono ${licenseNumber ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      <FileText className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      {licenseNumber || 'No license number on file'}
                    </div>
                    <button onClick={() => { setLicenseNumberEdit(licenseNumber); setEditingLicense(true); }} className="flex items-center gap-1.5 px-4 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 whitespace-nowrap font-medium">
                      <Edit2 className="w-3.5 h-3.5" />{licenseNumber ? 'Edit' : 'Add'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1.5">Your California Contractors State License Board (CSLB) number</p>
              </div>

              {/* Verification CTA */}
              <div className={`rounded-xl p-5 border ${verificationStatus === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">
                      {verificationStatus === 'pending' ? 'Verification in Progress' : 'Get Your License Verified'}
                    </p>
                    {verificationStatus === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <p className="text-sm text-amber-700">Under review — typically 24–48 hours</p>
                      </div>
                    )}
                    {!['verified', 'pending'].includes(verificationStatus) && (
                      <p className="text-sm text-blue-700">Appear first in search results and unlock all project bids</p>
                    )}
                    {verificationStatus === 'rejected' && (
                      <p className="text-sm text-red-600">Your previous submission was rejected. Please resubmit with correct details.</p>
                    )}
                  </div>

                  {!['verified', 'pending'].includes(verificationStatus) && (
                    <button
                      onClick={() => setShowVerificationModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {verificationStatus === 'rejected' || verificationStatus === 'expired' ? 'Resubmit' : 'Verify Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── About / Bio ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">About</h3>
                <p className="text-xs text-gray-500">Shown to property owners reviewing your profile</p>
              </div>
            </div>
            <button
              onClick={() => editingBio ? saveBio() : setEditingBio(true)}
              disabled={saving && editingBio}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium"
            >
              {editingBio
                ? <><Check className="w-3.5 h-3.5 text-green-600" />{saving ? 'Saving…' : 'Save'}</>
                : <><Edit2 className="w-3.5 h-3.5" />Edit</>}
            </button>
          </div>
          <div className="p-6">
            {editingBio ? (
              <div>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Describe your experience, specialties, and what makes your work stand out. Property owners read this before deciding who to contact."
                  rows={5}
                  className="w-full px-4 py-3 border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-800 resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{bio.length} characters {bio.length < 100 ? '· aim for 100+' : '✓'}</span>
                  <button onClick={() => setEditingBio(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            ) : bio ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{bio}</p>
            ) : (
              <button onClick={() => setEditingBio(true)} className="w-full text-left p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
                <p className="text-sm text-gray-400 group-hover:text-blue-600 italic">Click to add a bio — tell owners about your experience and what makes your work stand out…</p>
              </button>
            )}
          </div>
        </div>

        {/* ── Specialties ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Tag className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Specialties</h3>
                <p className="text-xs text-gray-500">Select all that apply — used for matching you to relevant projects</p>
              </div>
            </div>
            {specialties.length > 0 && (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {specialties.length} selected
              </span>
            )}
          </div>
          <div className="p-6">
            <WorkTypePicker selected={specialties} onChange={saveSpecialties} />
            <p className="text-xs text-gray-400 mt-3">Changes are saved automatically</p>
          </div>
        </div>

      </div>

      {showVerificationModal && (
        <LicenseVerificationModal
          initialLicenseNumber={licenseNumber}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => { setVerificationStatus('pending'); refreshProfile(); }}
        />
      )}
    </div>
  );
}
