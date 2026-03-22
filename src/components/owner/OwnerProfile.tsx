import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Edit2, Check, X, Upload, Phone, MapPin, User,
  Home, AlertCircle, BadgeCheck, ChevronDown, ChevronUp, CheckCircle2,
  Camera, Star, TrendingUp, DollarSign, Calendar,
} from 'lucide-react';

// ─── Property types ───────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { id: 'Single Family', label: 'Single Family Home', icon: '🏠' },
  { id: 'Condo', label: 'Condo / Apartment', icon: '🏢' },
  { id: 'Multi Family', label: 'Multi-Family', icon: '🏘️' },
  { id: 'Commercial', label: 'Commercial', icon: '🏪' },
  { id: 'Townhouse', label: 'Townhouse', icon: '🏡' },
  { id: 'Vacation', label: 'Vacation Property', icon: '🌴' },
];

const BUDGET_RANGES = [
  { id: 'under_10k', label: 'Under ₪10,000' },
  { id: '10k_50k', label: '₪10,000 – ₪50,000' },
  { id: '50k_150k', label: '₪50,000 – ₪150,000' },
  { id: '150k_500k', label: '₪150,000 – ₪500,000' },
  { id: 'over_500k', label: 'Over ₪500,000' },
];

// ─── Profile completeness ─────────────────────────────────────────────────────

function computeCompleteness(p: {
  full_name?: string; phone?: string; bio?: string;
  avatar_url?: string; city?: string; property_type?: string; budget_range?: string;
}) {
  const checks = [
    { label: 'Full name', ok: !!(p.full_name?.trim()) },
    { label: 'Phone number', ok: !!(p.phone?.trim()) },
    { label: 'City / location', ok: !!(p.city?.trim()) },
    { label: 'About yourself', ok: (p.bio?.trim().length ?? 0) > 10 },
    { label: 'Profile photo', ok: !!(p.avatar_url) },
    { label: 'Property type', ok: !!(p.property_type) },
    { label: 'Budget range', ok: !!(p.budget_range) },
  ];
  return {
    score: Math.round((checks.filter(c => c.ok).length / checks.length) * 100),
    checks,
  };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-semibold max-w-sm ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss}><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OwnerProfile() {
  const { profile, refreshProfile } = useAuth();

  const [editingMain, setEditingMain] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [backgroundUrl, setBackgroundUrl] = useState((profile as Record<string, unknown>)?.background_url as string || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [propertyType, setPropertyType] = useState<string>(
    (profile as Record<string, unknown>)?.property_type as string || ''
  );
  const [budgetRange, setBudgetRange] = useState<string>(
    (profile as Record<string, unknown>)?.budget_range as string || ''
  );
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    city: (profile?.location as Record<string, string>)?.city || '',
    state: (profile?.location as Record<string, string>)?.state || '',
  });

  const avatarRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Re-seed when profile changes
  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      city: (profile.location as Record<string, string>)?.city || '',
      state: (profile.location as Record<string, string>)?.state || '',
    });
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url || '');
    setBackgroundUrl((profile as Record<string, unknown>)?.background_url as string || '');
    setPropertyType((profile as Record<string, unknown>)?.property_type as string || '');
    setBudgetRange((profile as Record<string, unknown>)?.budget_range as string || '');
  }, [profile]);

  const { score, checks } = computeCompleteness({
    ...form, bio, avatar_url: avatarUrl, property_type: propertyType, budget_range: budgetRange,
  });
  const missing = checks.filter(c => !c.ok);

  async function saveMain() {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone,
        location: { city: form.city, state: form.state },
      }).eq('id', profile.id);
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

  async function savePropertyType(type: string) {
    if (!profile?.id) return;
    const next = type === propertyType ? '' : type;
    setPropertyType(next);
    await supabase.from('profiles').update({ property_type: next || null } as Record<string, unknown>).eq('id', profile.id);
    await refreshProfile();
  }

  async function saveBudgetRange(range: string) {
    if (!profile?.id) return;
    const next = range === budgetRange ? '' : range;
    setBudgetRange(next);
    await supabase.from('profiles').update({ budget_range: next || null } as Record<string, unknown>).eq('id', profile.id);
    await refreshProfile();
    showToast('Budget preference saved');
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

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setUploadingBg(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/background.${ext}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ background_url: data.publicUrl } as Record<string, unknown>).eq('id', profile.id);
      setBackgroundUrl(data.publicUrl);
      await refreshProfile();
    } catch { /* ignore */ } finally {
      setUploadingBg(false);
    }
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear();

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-gray-500';
  const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* ── Profile Strength ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${score >= 80 ? 'bg-green-100' : score >= 50 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <BadgeCheck className={`w-5 h-5 ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-500' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Profile Strength</p>
                <p className="text-xs text-gray-500">
                  {score >= 80 ? 'Great! Your profile attracts quality contractors' : score >= 50 ? 'Almost there' : 'Complete your profile for better matches'}
                </p>
              </div>
            </div>
            <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
          </div>

          <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
          </div>

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

        {/* ── Hero Card ────────────────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden shadow-sm border border-gray-200 bg-white">
          {/* Cover */}
          <div className="h-52 relative group">
            {backgroundUrl
              ? <img src={backgroundUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-orange-400 via-rose-400 to-pink-500" />
            }
            <div className="absolute inset-0 bg-black/20" />
            <button
              onClick={() => bgRef.current?.click()}
              disabled={uploadingBg}
              className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingBg ? 'Uploading…' : 'Change Cover'}
            </button>
            <input ref={bgRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          </div>

          <div className="px-8 pb-8 -mt-14 relative">
            {/* Avatar */}
            <div className="relative inline-block mb-4">
              <img
                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.full_name || 'Owner')}&size=200&background=f97316&color=fff`}
                alt={form.full_name}
                className="w-28 h-28 rounded-2xl border-4 border-white shadow-xl object-cover"
              />
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center border-2 border-white shadow-lg hover:bg-orange-600 transition-colors"
              >
                {uploadingAvatar
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-3.5 h-3.5 text-white" />
                }
              </button>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editingMain ? (
                  <div className="space-y-2 mb-3">
                    <input
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="Full name"
                      className="w-full text-2xl font-bold border-b-2 border-orange-500 focus:outline-none bg-transparent text-gray-900 pb-1"
                    />
                  </div>
                ) : (
                  <div className="mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {form.full_name || <span className="text-gray-400">Your Name</span>}
                    </h2>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full border border-orange-200">
                    <Home className="w-3.5 h-3.5" />
                    Property Owner
                  </span>
                  {propertyType && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full border border-gray-200">
                      {PROPERTY_TYPES.find(t => t.id === propertyType)?.icon} {propertyType}
                    </span>
                  )}
                </div>

                {!editingMain && (form.phone || form.city) && (
                  <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                    {form.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{form.phone}</span>}
                    {form.city && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" />{form.city}{form.state ? `, ${form.state}` : ''}</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {editingMain ? (
                  <>
                    <button onClick={saveMain} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50">
                      <Check className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingMain(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditingMain(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                    <Edit2 className="w-3.5 h-3.5" />Edit
                  </button>
                )}
              </div>
            </div>

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
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">City</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Los Angeles" className="flex-1 text-sm focus:outline-none bg-transparent" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">State</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input type="text" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="CA" className="flex-1 text-sm focus:outline-none bg-transparent" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Projects Posted', value: String(profile?.total_projects ?? 0), icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: 'Owner Rating', value: profile?.rating ? `${profile.rating.toFixed(1)} ★` : '—', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Member Since', value: String(memberSince), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* ── About ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">About</h3>
                <p className="text-xs text-gray-500">Helps contractors understand your expectations</p>
              </div>
            </div>
            <button
              onClick={() => editingBio ? saveBio() : setEditingBio(true)}
              disabled={saving && editingBio}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium"
            >
              {editingBio ? <><Check className="w-3.5 h-3.5 text-green-600" />{saving ? 'Saving…' : 'Save'}</> : <><Edit2 className="w-3.5 h-3.5" />Edit</>}
            </button>
          </div>
          <div className="p-6">
            {editingBio ? (
              <div>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell contractors about your property, renovation goals, your expectations, and anything else that's important to know…"
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-orange-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/20 text-sm resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{bio.length} characters</span>
                  <button onClick={() => setEditingBio(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            ) : bio ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{bio}</p>
            ) : (
              <button onClick={() => setEditingBio(true)} className="w-full text-left p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all group">
                <p className="text-sm text-gray-400 group-hover:text-orange-600 italic">Click to add a description of your property and what you're looking for…</p>
              </button>
            )}
          </div>
        </div>

        {/* ── Property Type ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Home className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Property Type</h3>
                <p className="text-xs text-gray-500">Saved automatically</p>
              </div>
            </div>
            {propertyType && (
              <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                {PROPERTY_TYPES.find(t => t.id === propertyType)?.label}
              </span>
            )}
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PROPERTY_TYPES.map(opt => {
                const active = propertyType === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => savePropertyType(opt.id)}
                    className={`relative flex items-center gap-2.5 px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      active
                        ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-left leading-tight flex-1">{opt.label}</span>
                    {active && (
                      <span className="absolute top-2 right-2 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Budget Range ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Typical Renovation Budget</h3>
                <p className="text-xs text-gray-500">Helps contractors tailor their proposals</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2.5">
              {BUDGET_RANGES.map(opt => {
                const active = budgetRange === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => saveBudgetRange(opt.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      active
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">Changes are saved automatically</p>
          </div>
        </div>

      </div>
    </div>
  );
}
