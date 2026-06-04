import { useState } from 'react';
import {
  User, Phone, Mail, MapPin, Briefcase,
  ChevronRight, ChevronLeft, CheckCircle, Upload, Camera,
  Shield, Star, Wrench, Building2, AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkTypePicker } from '../shared/WorkTypePicker';
import logo from '../../assets/logo.svg';

interface FormData {
  full_name: string;
  company_name: string;
  phone: string;
  phone_code: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  service_area: string;
  bio: string;
  years_experience: number | '';
  license_number: string;
  specialties: string[];
  avatar_url: string;
}

const STEPS = [
  { id: 1, label: 'Personal',    icon: User       },
  { id: 2, label: 'Location',    icon: MapPin      },
  { id: 3, label: 'Specialties', icon: Wrench      },
  { id: 4, label: 'Business',    icon: Briefcase   },
  { id: 5, label: 'Review',      icon: CheckCircle },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const PHONE_CODES = [
  { code: '+1',   flag: '🇺🇸', label: '+1' },
  { code: '+44',  flag: '🇬🇧', label: '+44' },
  { code: '+61',  flag: '🇦🇺', label: '+61' },
  { code: '+52',  flag: '🇲🇽', label: '+52' },
  { code: '+972', flag: '🇮🇱', label: '+972' },
];

export function ContractorOnboarding({ onComplete }: { onComplete: () => void }) {
  const { profile, refreshProfile } = useAuth();

  const [step, setStep]       = useState(1);
  const [saving, setSaving]   = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormData | 'phone_full', string>>>({});

  const [form, setForm] = useState<FormData>({
    full_name:        profile?.full_name    || '',
    company_name:     profile?.company_name || '',
    phone:            '',
    phone_code:       '+1',
    email:            profile?.email        || '',
    address:          '',
    city:             '',
    state:            'CA',
    zip_code:         '',
    service_area:     profile?.service_area || '',
    bio:              profile?.bio          || '',
    years_experience: profile?.years_experience || '',
    license_number:   profile?.license_number   || '',
    specialties:      profile?.specialties       || [],
    avatar_url:       profile?.avatar_url        || '',
  });

  function set(field: keyof FormData, value: any) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined, phone_full: undefined }));
  }

  const fullPhone = `${form.phone_code} ${form.phone}`.trim();

  function validateStep(): boolean {
    const errs: Partial<Record<keyof FormData | 'phone_full', string>> = {};
    if (step === 1) {
      if (!form.full_name.trim())  errs.full_name  = 'Full name is required';
      if (!form.phone.trim())      errs.phone_full = 'Phone number is required';
      if (!form.email.trim())      errs.email      = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    }
    if (step === 2) {
      if (!form.city.trim())         errs.city         = 'City is required';
      if (!form.service_area.trim()) errs.service_area = 'Service area is required';
    }
    if (step === 3) {
      if (!form.specialties.length)  errs.specialties  = 'Select at least one specialty';
    }
    if (step === 4) {
      if (form.bio.trim().length < 20)       errs.bio            = 'Write at least 20 characters';
      if (!form.license_number.trim())       errs.license_number = 'License number is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length)); }
  function back() { setStep(s => Math.max(s - 1, 1)); }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    setAvatarUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `avatars/${profile.id}.${ext}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      set('avatar_url', data.publicUrl);
    } catch { /* ignore */ }
    finally { setAvatarUploading(false); }
  }

  async function handleSubmit() {
    if (!validateStep() || !profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name:            form.full_name.trim(),
        company_name:         form.company_name.trim(),
        phone:                fullPhone,
        bio:                  form.bio.trim(),
        years_experience:     form.years_experience === '' ? null : Number(form.years_experience),
        license_number:       form.license_number.trim(),
        verification_status:  'pending',
        license_verified:     false,
        specialties:          form.specialties,
        service_area:         form.service_area.trim(),
        avatar_url:           form.avatar_url || null,
        onboarding_completed: true,
      }).eq('id', profile.id);

      // Create verification request for admin review
      if (form.license_number.trim()) {
        await supabase.from('verification_requests').upsert({
          contractor_id:  profile.id,
          license_number: form.license_number.trim(),
          status:         'pending',
          submitted_at:   new Date().toISOString(),
        }, { onConflict: 'contractor_id' });
      }
      if (error) throw error;
      await refreshProfile();
      onComplete();
    } catch (err) {
      console.error('Onboarding save error:', err);
    } finally {
      setSaving(false);
    }
  }

  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top nav ── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <img src={logo} alt="MGBiT" className="h-8 w-auto" />
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-[#1e3a5f]">Step {step}</span> of {STEPS.length}
        </span>
      </div>

      {/* ── Progress ── */}
      <div className="bg-white px-4 sm:px-8 pb-4 border-b border-gray-100">
        <div className="max-w-lg mx-auto">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2 mb-4">
            <div
              className="h-full bg-gradient-to-r from-[#1e3a5f] to-[#e85d04] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Step pills */}
          <div className="flex items-center justify-between">
            {STEPS.map(s => {
              const Icon = s.icon;
              const done    = step > s.id;
              const current = step === s.id;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    done    ? 'bg-emerald-500 text-white shadow-sm' :
                    current ? 'bg-[#1e3a5f] text-white shadow-md ring-4 ring-[#1e3a5f]/20' :
                              'bg-gray-100 text-gray-400'
                  }`}>
                    {done
                      ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    }
                  </div>
                  <span className={`text-[10px] sm:text-xs font-medium hidden sm:block ${
                    current ? 'text-[#1e3a5f]' : done ? 'text-emerald-600' : 'text-gray-400'
                  }`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Card header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f]">
              <h2 className="text-white font-bold text-lg">{STEPS[step-1].label}</h2>
              <p className="text-blue-200 text-sm mt-0.5">
                {step === 1 && 'Your basic info — property owners will see this'}
                {step === 2 && 'Where do you work? Help owners find you nearby'}
                {step === 3 && 'Select your trade(s) — you can pick multiple'}
                {step === 4 && 'Business credentials and a short bio'}
                {step === 5 && 'Review your profile before going live'}
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-4">

              {/* ── STEP 1: Personal ── */}
              {step === 1 && (
                <>
                  {/* Avatar */}
                  <div className="flex flex-col items-center pb-2">
                    <div className="relative mb-2">
                      <div className="w-20 h-20 rounded-full bg-gray-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                        {form.avatar_url
                          ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          : <Camera className="w-8 h-8 text-gray-300" />
                        }
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#e85d04] hover:bg-orange-600 rounded-full flex items-center justify-center cursor-pointer shadow transition-colors">
                        <Upload className="w-3.5 h-3.5 text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </label>
                    </div>
                    <span className="text-xs text-gray-400">{avatarUploading ? 'Uploading…' : 'Profile photo (optional)'}</span>
                  </div>

                  <Field label="Full Name *" error={errors.full_name}>
                    <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                      placeholder="John Smith" className={inp(errors.full_name)} />
                  </Field>

                  <Field label="Phone Number *" error={errors.phone_full}>
                    <div className="flex gap-2">
                      <select
                        value={form.phone_code}
                        onChange={e => set('phone_code', e.target.value)}
                        className="px-2 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                        style={{ minWidth: 88 }}
                      >
                        {PHONE_CODES.map(p => (
                          <option key={p.code} value={p.code}>{p.flag} {p.label}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                        placeholder="(213) 555-0000"
                        className={`flex-1 ${inp(errors.phone_full)}`}
                      />
                    </div>
                  </Field>

                  <Field label="Email Address *" error={errors.email}>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@example.com" className={inp(errors.email)} />
                  </Field>

                  <Field label="Company / Business Name">
                    <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                      placeholder="Smith Electric LLC" className={inp()} />
                  </Field>
                </>
              )}

              {/* ── STEP 2: Location ── */}
              {step === 2 && (
                <>
                  <Field label="Street Address">
                    <input value={form.address} onChange={e => set('address', e.target.value)}
                      placeholder="123 Main St" className={inp()} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City *" error={errors.city}>
                      <input value={form.city} onChange={e => set('city', e.target.value)}
                        placeholder="Los Angeles" className={inp(errors.city)} />
                    </Field>
                    <Field label="ZIP Code">
                      <input value={form.zip_code} onChange={e => set('zip_code', e.target.value)}
                        placeholder="90001" className={inp()} />
                    </Field>
                  </div>

                  <Field label="State">
                    <select value={form.state} onChange={e => set('state', e.target.value)} className={inp()}>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>

                  <Field label="Service Area *" error={errors.service_area}>
                    <input value={form.service_area} onChange={e => set('service_area', e.target.value)}
                      placeholder="e.g. Los Angeles, CA · San Fernando Valley · Orange County"
                      className={inp(errors.service_area)} />
                    <p className="text-xs text-gray-400 mt-1.5">Describe the cities/regions where you take jobs</p>
                  </Field>
                </>
              )}

              {/* ── STEP 3: Specialties ── */}
              {step === 3 && (
                <>
                  {errors.specialties && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600">{errors.specialties}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Select all that apply — you can pick multiple</p>
                    {form.specialties.length > 0 && (
                      <span className="text-xs bg-[#1e3a5f] text-white font-bold px-2.5 py-1 rounded-full">
                        {form.specialties.length} selected
                      </span>
                    )}
                  </div>
                  <WorkTypePicker selected={form.specialties} onChange={v => set('specialties', v)} />
                </>
              )}

              {/* ── STEP 4: Business ── */}
              {step === 4 && (
                <>
                  <Field label="About You *" error={errors.bio}>
                    <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                      placeholder="Describe your experience, certifications, and what sets you apart from other contractors…"
                      rows={4} className={`resize-none ${inp(errors.bio)}`} />
                    <p className="text-xs text-gray-400 mt-1">{form.bio.length} / 20 min characters</p>
                  </Field>

                  <Field label="Years of Experience">
                    <input type="number" min={0} max={60}
                      value={form.years_experience}
                      onChange={e => set('years_experience', e.target.value === '' ? '' : parseInt(e.target.value))}
                      placeholder="e.g. 8" className={inp()} />
                  </Field>

                  <Field label="Contractor License Number *" error={errors.license_number}>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={form.license_number}
                        onChange={e => set('license_number', e.target.value)}
                        placeholder="e.g. C-10 123456"
                        className={`pl-10 ${inp(errors.license_number)}`}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Required to receive and submit bids on MGBiT
                    </p>
                  </Field>
                </>
              )}

              {/* ── STEP 5: Review ── */}
              {step === 5 && (
                <div className="space-y-3">
                  {/* Profile card */}
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    {form.avatar_url
                      ? <img src={form.avatar_url} alt="avatar" className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-white shadow" />
                      : <div className="w-14 h-14 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-[#1e3a5f]" />
                        </div>
                    }
                    <div>
                      <p className="font-bold text-gray-900">{form.full_name || '—'}</p>
                      <p className="text-sm text-gray-500">{form.company_name || 'Independent Contractor'}</p>
                      {form.years_experience !== '' && (
                        <p className="text-xs text-gray-400">{form.years_experience} years experience</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { icon: Phone,    label: 'Phone',    value: fullPhone },
                      { icon: Mail,     label: 'Email',    value: form.email },
                      { icon: MapPin,   label: 'Location', value: [form.city, form.state].filter(Boolean).join(', ') || '—' },
                      { icon: Building2,label: 'Service',  value: form.service_area || '—' },
                      { icon: Shield,   label: 'License',  value: form.license_number || '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <Icon className="w-4 h-4 text-[#1e3a5f] flex-shrink-0" />
                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
                        <span className="text-sm text-gray-800 font-medium truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  {form.specialties.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="w-4 h-4 text-[#1e3a5f]" />
                        <span className="text-sm font-semibold text-gray-700">Specialties ({form.specialties.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {form.specialties.map(s => (
                          <span key={s} className="text-xs bg-[#1e3a5f]/10 text-[#1e3a5f] px-2.5 py-1 rounded-full font-medium border border-[#1e3a5f]/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.bio && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">About</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{form.bio}</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Navigation ── */}
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex gap-3 border-t border-gray-100 pt-4">
              {step > 1 && (
                <button onClick={back}
                  className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" />Back
                </button>
              )}
              <button
                onClick={step === STEPS.length ? handleSubmit : next}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 shadow-sm"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : step === STEPS.length ? (
                  <><CheckCircle className="w-4 h-4" />Complete Setup & Go Live</>
                ) : (
                  <>Continue<ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>

          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            MGBiT · 855-826-4248 · office@mgbit.com
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inp(err?: string) {
  return `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors bg-white ${
    err
      ? 'border-red-300 focus:ring-red-300/50 focus:border-red-400'
      : 'border-gray-200 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]/50'
  }`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}
