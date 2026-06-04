import { useState } from 'react';
import {
  User, Phone, Mail, MapPin, Briefcase, FileText,
  ChevronRight, ChevronLeft, CheckCircle, Upload, Camera,
  Shield, Star, Wrench, Building2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkTypePicker } from '../shared/WorkTypePicker';
import logo from '../../assets/logo.svg';

interface FormData {
  full_name: string;
  company_name: string;
  phone: string;
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
  { id: 1, label: 'Personal Info',  icon: User      },
  { id: 2, label: 'Location',       icon: MapPin     },
  { id: 3, label: 'Specialties',    icon: Wrench     },
  { id: 4, label: 'Business',       icon: Briefcase  },
  { id: 5, label: 'Review',         icon: CheckCircle},
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export function ContractorOnboarding({ onComplete }: { onComplete: () => void }) {
  const { profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [form, setForm] = useState<FormData>({
    full_name:       profile?.full_name       || '',
    company_name:    profile?.company_name    || '',
    phone:           profile?.phone           || '',
    email:           profile?.email           || '',
    address:         '',
    city:            '',
    state:           'CA',
    zip_code:        '',
    service_area:    profile?.service_area    || '',
    bio:             profile?.bio             || '',
    years_experience: profile?.years_experience || '',
    license_number:  profile?.license_number  || '',
    specialties:     profile?.specialties     || [],
    avatar_url:      profile?.avatar_url      || '',
  });

  function set(field: keyof FormData, value: any) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  function validateStep(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!form.full_name.trim())    errs.full_name    = 'Full name is required';
      if (!form.phone.trim())        errs.phone        = 'Phone number is required';
      if (!form.email.trim())        errs.email        = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    }
    if (step === 2) {
      if (!form.city.trim())         errs.city         = 'City is required';
      if (!form.state.trim())        errs.state        = 'State is required';
      if (!form.service_area.trim()) errs.service_area = 'Service area is required';
    }
    if (step === 3) {
      if (form.specialties.length === 0) errs.specialties = 'Select at least one specialty';
    }
    if (step === 4) {
      if (!form.bio.trim() || form.bio.trim().length < 20)
        errs.bio = 'Please write at least 20 characters about yourself';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length));
  }

  function back() {
    setStep(s => Math.max(s - 1, 1));
  }

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
    } catch (err) {
      console.error('Avatar upload error:', err);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSubmit() {
    if (!validateStep() || !profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name:         form.full_name.trim(),
        company_name:      form.company_name.trim(),
        phone:             form.phone.trim(),
        bio:               form.bio.trim(),
        years_experience:  form.years_experience === '' ? null : Number(form.years_experience),
        license_number:    form.license_number.trim(),
        specialties:       form.specialties,
        service_area:      form.service_area.trim(),
        avatar_url:        form.avatar_url || null,
        onboarding_completed: true,
      }).eq('id', profile.id);

      if (error) throw error;
      await refreshProfile();
      onComplete();
    } catch (err) {
      console.error('Onboarding save error:', err);
    } finally {
      setSaving(false);
    }
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <img src={logo} alt="MGBiT" className="h-8 w-auto brightness-0 invert" />
        <span className="text-blue-300 text-sm font-medium">Step {step} of {STEPS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="px-4 sm:px-8 mb-2">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-1 sm:gap-3 px-4 py-3 mb-2">
        {STEPS.map(s => {
          const Icon = s.icon;
          const done    = step > s.id;
          const current = step === s.id;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                done    ? 'bg-emerald-500 text-white' :
                current ? 'bg-blue-500 text-white ring-4 ring-blue-400/30' :
                          'bg-white/10 text-white/40'
              }`}>
                {done ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <span className={`text-[10px] sm:text-xs hidden sm:block ${current ? 'text-white font-semibold' : 'text-white/40'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pb-8">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Step header */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] px-6 py-5">
              <h2 className="text-white font-bold text-lg">{STEPS[step-1].label}</h2>
              <p className="text-blue-200 text-sm mt-0.5">
                {step === 1 && 'Tell us about yourself — this builds trust with property owners'}
                {step === 2 && 'Where do you work? Help owners find you nearby'}
                {step === 3 && 'What work do you do? You can select multiple specialties'}
                {step === 4 && 'Your business details and a short bio'}
                {step === 5 && "Review your profile before going live"}
              </p>
            </div>

            <div className="p-6 space-y-4">

              {/* ── STEP 1: Personal Info ── */}
              {step === 1 && (
                <>
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-3 pb-2">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                        {form.avatar_url
                          ? <img src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          : <Camera className="w-8 h-8 text-gray-400" />
                        }
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 shadow">
                        <Upload className="w-3.5 h-3.5 text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </label>
                    </div>
                    {avatarUploading && <span className="text-xs text-gray-400">Uploading…</span>}
                    <span className="text-xs text-gray-500">Profile photo (optional)</span>
                  </div>

                  <Field label="Full Name *" error={errors.full_name}>
                    <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                      placeholder="John Smith" className={input(errors.full_name)} />
                  </Field>

                  <Field label="Phone Number *" error={errors.phone}>
                    <div className="flex gap-2">
                      <select className="px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white" style={{minWidth:90}}
                        value={form.phone.startsWith('+') ? form.phone.split(' ')[0] : '+1'}
                        onChange={e => {
                          const num = form.phone.startsWith('+') ? form.phone.split(' ').slice(1).join(' ') : form.phone;
                          set('phone', `${e.target.value} ${num}`);
                        }}>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+61">🇦🇺 +61</option>
                        <option value="+52">🇲🇽 +52</option>
                        <option value="+972">🇮🇱 +972</option>
                      </select>
                      <input type="tel"
                        value={form.phone.startsWith('+') ? form.phone.split(' ').slice(1).join(' ') : form.phone}
                        onChange={e => {
                          const code = form.phone.startsWith('+') ? form.phone.split(' ')[0] : '+1';
                          set('phone', `${code} ${e.target.value}`);
                        }}
                        placeholder="(213) 555-0000" className={`flex-1 ${input(errors.phone)}`} />
                    </div>
                  </Field>

                  <Field label="Email Address *" error={errors.email}>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@example.com" className={input(errors.email)} />
                  </Field>

                  <Field label="Company Name">
                    <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
                      placeholder="Smith Contracting LLC" className={input()} />
                  </Field>
                </>
              )}

              {/* ── STEP 2: Location ── */}
              {step === 2 && (
                <>
                  <Field label="Street Address">
                    <input value={form.address} onChange={e => set('address', e.target.value)}
                      placeholder="123 Main St" className={input()} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City *" error={errors.city}>
                      <input value={form.city} onChange={e => set('city', e.target.value)}
                        placeholder="Los Angeles" className={input(errors.city)} />
                    </Field>
                    <Field label="ZIP Code">
                      <input value={form.zip_code} onChange={e => set('zip_code', e.target.value)}
                        placeholder="90001" className={input()} />
                    </Field>
                  </div>

                  <Field label="State *" error={errors.state}>
                    <select value={form.state} onChange={e => set('state', e.target.value)} className={input(errors.state)}>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>

                  <Field label="Service Area *" error={errors.service_area}>
                    <input value={form.service_area} onChange={e => set('service_area', e.target.value)}
                      placeholder="e.g. Los Angeles, CA · Orange County · San Fernando Valley"
                      className={input(errors.service_area)} />
                    <p className="text-xs text-gray-400 mt-1">Describe the areas where you take projects</p>
                  </Field>
                </>
              )}

              {/* ── STEP 3: Specialties ── */}
              {step === 3 && (
                <>
                  {errors.specialties && (
                    <p className="text-sm text-red-500 font-medium bg-red-50 px-3 py-2 rounded-lg">
                      {errors.specialties}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-600">Select everything that applies — you can pick multiple</p>
                    {form.specialties.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
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
                      placeholder="Describe your experience, what makes your work stand out, and why homeowners should choose you…"
                      rows={4} className={`resize-none ${input(errors.bio)}`} />
                    <p className="text-xs text-gray-400 mt-1">{form.bio.length} chars (min 20)</p>
                  </Field>

                  <Field label="Years of Experience">
                    <input type="number" min={0} max={60}
                      value={form.years_experience}
                      onChange={e => set('years_experience', e.target.value === '' ? '' : parseInt(e.target.value))}
                      placeholder="5" className={input()} />
                  </Field>

                  <Field label="Contractor License Number">
                    <input value={form.license_number} onChange={e => set('license_number', e.target.value)}
                      placeholder="e.g. C-10 123456" className={input()} />
                    <p className="text-xs text-gray-400 mt-1">Optional — verified license builds more trust</p>
                  </Field>
                </>
              )}

              {/* ── STEP 5: Review ── */}
              {step === 5 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    {form.avatar_url
                      ? <img src={form.avatar_url} alt="avatar" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                      : <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><User className="w-7 h-7 text-blue-600" /></div>
                    }
                    <div>
                      <p className="font-bold text-gray-900">{form.full_name || '—'}</p>
                      <p className="text-sm text-gray-500">{form.company_name || 'Independent Contractor'}</p>
                    </div>
                  </div>

                  {[
                    { icon: Phone,    label: 'Phone',        value: form.phone },
                    { icon: Mail,     label: 'Email',        value: form.email },
                    { icon: MapPin,   label: 'Location',     value: [form.city, form.state].filter(Boolean).join(', ') },
                    { icon: Building2,label: 'Service Area', value: form.service_area },
                    { icon: Star,     label: 'Experience',   value: form.years_experience ? `${form.years_experience} years` : '—' },
                    { icon: Shield,   label: 'License',      value: form.license_number || 'Not provided' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500 w-24 flex-shrink-0">{label}</span>
                      <span className="text-gray-800 font-medium truncate">{value || '—'}</span>
                    </div>
                  ))}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Specialties ({form.specialties.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {form.specialties.map(s => (
                        <span key={s} className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>

                  {form.bio && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">About</p>
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{form.bio}</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Navigation */}
            <div className="px-6 pb-6 flex gap-3">
              {step > 1 && (
                <button onClick={back}
                  className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" />Back
                </button>
              )}
              <button
                onClick={step === STEPS.length ? handleSubmit : next}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] hover:opacity-90 text-white font-bold rounded-xl transition-all disabled:opacity-60 shadow-lg"
              >
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : step === STEPS.length ? (
                  <><CheckCircle className="w-5 h-5" />Complete Setup & Go Live</>
                ) : (
                  <>Continue<ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function input(err?: string) {
  return `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${
    err ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400 focus:border-blue-400'
  }`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
