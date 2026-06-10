import { useState } from 'react';
import {
  Landmark, User, Hash, Mail, Phone, Shield, AlertCircle,
  CheckCircle, Lock, Building2, CreditCard,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.svg';

type HolderType = 'individual' | 'business';

interface Form {
  full_name: string;
  bank_name: string;
  account_number: string;
  confirm_account_number: string;
  routing_number: string;
  account_type: 'checking' | 'savings';
  email: string;
  phone: string;
  holder_type: HolderType;
  tax_id_value: string;
}

export function ContractorPayoutSetup({ onComplete }: { onComplete: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [serverError, setServerError] = useState('');

  const [form, setForm] = useState<Form>({
    full_name:      profile?.full_name ?? '',
    bank_name:      '',
    account_number: '',
    confirm_account_number: '',
    routing_number: '',
    account_type:   'checking',
    email:          profile?.email ?? '',
    phone:          profile?.phone ?? '',
    holder_type:    'individual',
    tax_id_value:   '',
  });

  function set<K extends keyof Form>(field: K, value: Form[K]) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  const isBusiness = form.holder_type === 'business';
  const taxLabel = isBusiness ? 'EIN (Employer ID Number) *' : 'SSN *';
  const taxPlaceholder = isBusiness ? '12-3456789' : '123-45-6789';

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.full_name.trim())     e.full_name = 'Required';
    if (!form.bank_name.trim())     e.bank_name = 'Required';
    if (!/^\d{4,17}$/.test(form.account_number.replace(/\s/g, '')))
      e.account_number = 'Enter a valid account number';
    if (form.confirm_account_number.replace(/\s/g, '') !== form.account_number.replace(/\s/g, ''))
      e.confirm_account_number = 'Account numbers do not match';
    if (!/^\d{9}$/.test(form.routing_number.replace(/\s/g, '')))
      e.routing_number = 'Routing number must be 9 digits';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.tax_id_value.trim())  e.tax_id_value = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    setServerError('');
    if (!validate() || !profile?.id) return;
    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from('contractor_payout_details')
        .upsert({
          contractor_id:  profile.id,
          full_name:      form.full_name.trim(),
          bank_name:      form.bank_name.trim(),
          account_number: form.account_number.replace(/\s/g, ''),
          routing_number: form.routing_number.replace(/\s/g, ''),
          account_type:   form.account_type,
          email:          form.email.trim() || null,
          phone:          form.phone.trim() || null,
          tax_id_type:    isBusiness ? 'ein' : 'ssn',
          tax_id_value:   form.tax_id_value.trim(),
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'contractor_id' });
      if (upErr) throw upErr;

      const { error: flagErr } = await supabase
        .from('profiles')
        .update({ payout_details_completed: true })
        .eq('id', profile.id);
      if (flagErr) throw flagErr;

      await refreshProfile();
      onComplete();
    } catch (err: any) {
      console.error('Payout setup error:', err);
      setServerError(err?.message ?? 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 flex items-center justify-between">
        <img src={logo} alt="MGBiT" className="h-8 w-auto" />
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <Lock className="w-3.5 h-3.5" /> Encrypted & private
        </span>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Payout details</h2>
                  <p className="text-blue-200 text-sm">Where should we send your payments?</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <p className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                Payments are released by bank transfer. We keep a 10% platform commission
                from each project's total — you receive the rest. This info is required before you can bid.
              </p>

              <Field label="Account holder name *" error={errors.full_name}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                    placeholder="As it appears on the bank account" className={inp(errors.full_name, true)} />
                </div>
              </Field>

              <Field label="Bank name *" error={errors.bank_name}>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
                    placeholder="e.g. Chase, Bank of America" className={inp(errors.bank_name, true)} />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Account number *" error={errors.account_number}>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input inputMode="numeric" value={form.account_number}
                      onChange={e => set('account_number', e.target.value)}
                      placeholder="000123456789" className={inp(errors.account_number, true)} />
                  </div>
                </Field>
                <Field label="Routing (ABA) *" error={errors.routing_number}>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input inputMode="numeric" maxLength={9} value={form.routing_number}
                      onChange={e => set('routing_number', e.target.value)}
                      placeholder="9 digits" className={inp(errors.routing_number, true)} />
                  </div>
                </Field>
              </div>

              <Field label="Confirm account number *" error={errors.confirm_account_number}>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input inputMode="numeric" value={form.confirm_account_number}
                    onChange={e => set('confirm_account_number', e.target.value)}
                    onPaste={e => e.preventDefault()}
                    placeholder="Re-enter the account number" className={inp(errors.confirm_account_number, true)} />
                </div>
                {!errors.confirm_account_number && form.confirm_account_number.length > 0 &&
                  form.confirm_account_number.replace(/\s/g, '') === form.account_number.replace(/\s/g, '') && (
                  <p className="flex items-center gap-1 text-xs text-emerald-600 mt-1.5">
                    <CheckCircle className="w-3 h-3 flex-shrink-0" />Account numbers match
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1.5">Type it again — no room for mistakes. Pasting is disabled here.</p>
              </Field>

              <Field label="Account type *">
                <div className="grid grid-cols-2 gap-2">
                  {(['checking', 'savings'] as const).map(t => (
                    <button key={t} type="button" onClick={() => set('account_type', t)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border capitalize transition-colors ${
                        form.account_type === t
                          ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" error={errors.email}>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="you@example.com" className={inp(errors.email, true)} />
                  </div>
                </Field>
                <Field label="Phone">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={form.phone} onChange={e => set('phone', e.target.value)}
                      placeholder="(213) 555-0000" className={inp(undefined, true)} />
                  </div>
                </Field>
              </div>

              <div className="pt-1 border-t border-gray-100">
                <Field label="Tax classification *">
                  <div className="grid grid-cols-2 gap-2">
                    {([['individual', 'Individual (SSN)'], ['business', 'Business (EIN)']] as const).map(([t, label]) => (
                      <button key={t} type="button" onClick={() => set('holder_type', t)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          form.holder_type === t
                            ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label={taxLabel} error={errors.tax_id_value}>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={form.tax_id_value} onChange={e => set('tax_id_value', e.target.value)}
                    placeholder={taxPlaceholder} className={inp(errors.tax_id_value, true)} />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Used for tax reporting (1099). Kept private and secure.</p>
              </Field>

              {serverError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 border-t border-gray-100">
              <button onClick={handleSubmit} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 shadow-sm">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  : <><CheckCircle className="w-4 h-4" />Save & Continue</>}
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function inp(err?: string, hasIcon?: boolean) {
  return `w-full ${hasIcon ? 'pl-10' : 'px-4'} pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors bg-white ${
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
