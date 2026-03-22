import { useState } from 'react';
import { X, ExternalLink, AlertCircle, Upload, CheckCircle, Shield, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialLicenseNumber?: string;
}

export function LicenseVerificationModal({ onClose, onSuccess, initialLicenseNumber = '' }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState<'instructions' | 'form' | 'success'>('instructions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    licenseNumber: initialLicenseNumber,
    businessName: profile?.business_name || profile?.company_name || '',
    expirationDate: '',
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setScreenshotFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!screenshotFile) { setError('Please upload a screenshot of the CSLB page'); return; }
    if (!form.licenseNumber.trim()) { setError('License number is required'); return; }
    if (!profile?.id) return;

    setLoading(true);
    setError('');

    try {
      const ext = screenshotFile.name.split('.').pop();
      const fileName = `${profile.id}/license-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('license-documents')
        .upload(fileName, screenshotFile);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('license-documents')
        .getPublicUrl(fileName);

      const { error: updateErr } = await supabase.from('profiles').update({
        license_number: form.licenseNumber.trim(),
        business_name: form.businessName.trim() || null,
        license_expiration_date: form.expirationDate || null,
        license_screenshot_url: urlData.publicUrl,
        verification_status: 'pending',
        license_verified: false,
      }).eq('id', profile.id);
      if (updateErr) throw updateErr;

      await supabase.from('verification_logs').insert({
        profile_id: profile.id,
        action: 'verification_requested',
        old_status: profile.verification_status || 'not_verified',
        new_status: 'pending',
        notes: `License: ${form.licenseNumber.trim()}, Business: ${form.businessName.trim()}`,
      });

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">
                {step === 'instructions' && 'License Verification'}
                {step === 'form' && 'Submit Your Details'}
                {step === 'success' && 'Submitted Successfully'}
              </h2>
              <p className="text-xs text-gray-400">CSLB · California Contractors State License Board</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">

          {/* ── Step 1: Instructions ──────────────────────────── */}
          {step === 'instructions' && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    We verify your license directly via the official California CSLB database.
                    Verified contractors appear first in owner searches and can bid on all projects.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">How it works</h4>
                <ol className="space-y-3">
                  {[
                    'Click "Open CSLB Website" to visit the official California license lookup',
                    'Search your license number and confirm status shows ACTIVE',
                    'Take a screenshot clearly showing your license number, name, and status',
                    'Come back here and submit the screenshot along with your license details',
                    'Our team reviews your submission within 24–48 hours',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {initialLicenseNumber && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">License on file: </span>
                  <span className="text-sm font-mono font-semibold text-gray-900">{initialLicenseNumber}</span>
                </div>
              )}

              <div className="flex gap-3">
                <a
                  href="https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(() => setStep('form'), 500)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Open CSLB Website
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setStep('form')}
                  className="px-5 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  I have the screenshot
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Form ───────────────────────────────────── */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-sm text-green-800">
                  Fill in your license details exactly as shown on the CSLB results page, then upload your screenshot.
                </p>
              </div>

              {/* License number */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.licenseNumber}
                  onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                  placeholder="e.g. 1098765"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                />
              </div>

              {/* Business name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  Business Name on License
                </label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  placeholder="As shown on CSLB results"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* Expiration date */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  License Expiration Date
                </label>
                <input
                  type="date"
                  value={form.expirationDate}
                  onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* Screenshot upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                  CSLB Screenshot <span className="text-red-500">*</span>
                </label>
                <label
                  htmlFor="screenshot-upload"
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
                    screenshotFile
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <input id="screenshot-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" required />
                  {screenshotFile ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <p className="text-sm font-semibold text-green-700">{screenshotFile.name}</p>
                      <p className="text-xs text-green-600">Click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700">Click to upload screenshot</p>
                      <p className="text-xs text-gray-400">PNG, JPG — max 10 MB</p>
                    </>
                  )}
                </label>
                <p className="text-xs text-gray-400 mt-1.5">
                  Screenshot must clearly show: license number, licensee name, and ACTIVE status
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                  ) : (
                    <><Shield className="w-4 h-4" /> Submit for Verification</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('instructions')}
                  className="px-5 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: Success ────────────────────────────────── */}
          {step === 'success' && (
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-11 h-11 text-blue-600" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Verification Submitted</h3>
                <p className="text-gray-600 text-sm max-w-xs mx-auto">
                  Our team will review your license details and confirm your status via the CSLB database.
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 text-left">
                <h4 className="font-bold text-gray-900 mb-3 text-sm">What happens next</h4>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Under review', body: 'Our team cross-checks your submission with the official CSLB database.' },
                    { step: '2', title: 'Profile updated', body: 'Once confirmed, your profile gets a verified badge and your match score improves.' },
                    { step: '3', title: 'You\'re notified', body: 'You\'ll receive an email notification when the review is complete.' },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-amber-800 text-xs">
                  Typically takes <strong>24–48 hours</strong>. You can browse projects in the meantime.
                </p>
              </div>

              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Done — Back to Profile
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
