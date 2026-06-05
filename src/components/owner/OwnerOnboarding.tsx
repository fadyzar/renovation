import { useState } from 'react';
import { User, Phone, Mail, MapPin, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.svg';

interface FormData {
  full_name:  string;
  phone:      string;
  phone_code: string;
  email:      string;
  city:       string;
  state:      string;
}

const PHONE_CODES = [
  { code: '+1',   flag: '🇺🇸' },
  { code: '+44',  flag: '🇬🇧' },
  { code: '+61',  flag: '🇦🇺' },
  { code: '+52',  flag: '🇲🇽' },
  { code: '+972', flag: '🇮🇱' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export function OwnerOnboarding({ onComplete }: { onComplete: () => void }) {
  const { profile, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'phone_full', string>>>({});

  const [form, setForm] = useState<FormData>({
    full_name:  profile?.full_name || '',
    phone:      '',
    phone_code: '+1',
    email:      profile?.email    || '',
    city:       '',
    state:      'CA',
  });

  function set(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined, phone_full: undefined }));
  }

  const fullPhone = `${form.phone_code} ${form.phone}`.trim();

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData | 'phone_full', string>> = {};
    if (!form.full_name.trim())  errs.full_name  = 'Full name is required';
    if (!form.phone.trim())      errs.phone_full = 'Phone number is required';
    if (!form.email.trim())      errs.email      = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.city.trim())       errs.city       = 'City is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name:            form.full_name.trim(),
        phone:                fullPhone,
        onboarding_completed: true,
      }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      onComplete();
    } catch (err) {
      console.error('Owner onboarding error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top nav */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <img src={logo} alt="MGBiT" className="h-8 w-auto" />
        <span className="text-sm text-gray-400">Quick setup — takes 1 minute</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">

          {/* Welcome card */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-[#1e3a5f]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome to MGBiT!</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Complete your profile so contractors can reach you and you receive project updates.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f]">
              <h2 className="text-white font-bold text-base">Your Contact Info</h2>
              <p className="text-blue-200 text-sm mt-0.5">Required for notifications and contractor communication</p>
            </div>

            <div className="p-5 sm:p-6 space-y-4">

              <Field label="Full Name *" error={errors.full_name}>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                  placeholder="Jane Smith" className={inp(errors.full_name)} />
              </Field>

              <Field label="Phone Number *" error={errors.phone_full}>
                <div className="flex gap-2">
                  <select
                    value={form.phone_code}
                    onChange={e => set('phone_code', e.target.value)}
                    className="px-2 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                    style={{ minWidth: 80 }}
                  >
                    {PHONE_CODES.map(p => (
                      <option key={p.code} value={p.code}>{p.flag} {p.code}</option>
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="City *" error={errors.city}>
                  <input value={form.city} onChange={e => set('city', e.target.value)}
                    placeholder="Los Angeles" className={inp(errors.city)} />
                </Field>
                <Field label="State">
                  <select value={form.state} onChange={e => set('state', e.target.value)} className={inp()}>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {/* What you unlock */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Why we need this</p>
                {[
                  'Receive WhatsApp alerts when contractors bid on your project',
                  'Contractors can contact you once you activate a project',
                  'Get notified when milestones are completed',
                ].map(t => (
                  <div key={t} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-orange-800">{t}</span>
                  </div>
                ))}
              </div>

            </div>

            <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-gray-100 pt-4">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#e85d04] hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 shadow-sm"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" />Complete Setup & Start<ChevronRight className="w-4 h-4" /></>
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

function inp(err?: string) {
  return `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors bg-white ${
    err ? 'border-red-300 focus:ring-red-300/50' : 'border-gray-200 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]/50'
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
