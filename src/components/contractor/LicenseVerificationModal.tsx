import { useState } from 'react';
import { X, ExternalLink, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LicenseVerificationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function LicenseVerificationModal({ onClose, onSuccess }: LicenseVerificationModalProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<'instructions' | 'form' | 'success'>('instructions');
  const [loading, setLoading] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    licenseNumber: '',
    businessName: '',
    expirationDate: ''
  });

  const handleOpenCSLB = () => {
    window.open('https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx', '_blank');
    setStep('form');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!screenshotFile || !profile?.id) {
      alert('Please upload a screenshot of the CSLB verification page');
      return;
    }

    setLoading(true);

    try {
      const fileExt = screenshotFile.name.split('.').pop();
      const fileName = `${profile.id}/license-screenshot-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('license-documents')
        .upload(fileName, screenshotFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('license-documents')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          license_number: formData.licenseNumber,
          business_name: formData.businessName,
          license_expiration_date: formData.expirationDate || null,
          license_screenshot_url: urlData.publicUrl,
          verification_status: 'pending',
          license_verified: false
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await supabase
        .from('verification_logs')
        .insert({
          profile_id: profile.id,
          action: 'verification_requested',
          old_status: 'not_verified',
          new_status: 'pending',
          notes: `License number: ${formData.licenseNumber}, Business: ${formData.businessName}`
        });

      setStep('success');
    } catch (error) {
      console.error('Error submitting verification:', error);
      alert('Failed to submit verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 'instructions' && 'Verify Your CSLB License'}
            {step === 'form' && 'Submit Verification Details'}
            {step === 'success' && 'Verification Submitted'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          {step === 'instructions' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-2">Official CSLB Verification Required</h3>
                    <p className="text-blue-800 text-sm leading-relaxed">
                      You will be redirected to the official California Contractors State License Board (CSLB) website.
                      Please search your license number and confirm that your license status is <strong>ACTIVE</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-gray-900">Follow these steps:</h4>
                <ol className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                    <span>Click <strong>"Continue to CSLB"</strong> below to open the official verification website</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                    <span>Search for your license number on the CSLB website</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                    <span>Verify that your license status shows as <strong>ACTIVE</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                    <span>Take a screenshot of the CSLB results page showing your license details</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                    <span>Return here and submit your license information with the screenshot</span>
                  </li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-yellow-800 text-sm">
                  <strong>Important:</strong> Your verification will be reviewed by our admin team within 24-48 hours.
                  You will be notified once your license is verified.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleOpenCSLB}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  Continue to CSLB
                  <ExternalLink className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-green-800 text-sm">
                  Great! Now please fill in your license details and upload the screenshot from the CSLB website.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  placeholder="e.g., 123456"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Your business name as shown on CSLB"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  License Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Upload CSLB Screenshot <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="screenshot-upload"
                    required
                  />
                  <label htmlFor="screenshot-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    {screenshotFile ? (
                      <p className="text-green-600 font-semibold">{screenshotFile.name}</p>
                    ) : (
                      <>
                        <p className="text-gray-700 font-semibold mb-1">Click to upload screenshot</p>
                        <p className="text-gray-500 text-sm">PNG, JPG up to 10MB</p>
                      </>
                    )}
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  The screenshot must clearly show your license number, status, and business name
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit for Verification'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('instructions')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="space-y-6 text-center py-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-12 h-12 text-blue-600" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Thank You for Submitting</h3>
                <p className="text-gray-700 text-lg leading-relaxed max-w-xl mx-auto">
                  Your license verification is currently under review by our administrative team.
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-left max-w-xl mx-auto">
                <h4 className="font-bold text-gray-900 mb-4 text-center">What's Next?</h4>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                    <div>
                      <p className="font-semibold text-gray-900">Under Review</p>
                      <p className="text-sm text-gray-600">Our team is currently reviewing your submission and verifying your credentials with the CSLB database.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                    <div>
                      <p className="font-semibold text-gray-900">Verification Process</p>
                      <p className="text-sm text-gray-600">Once verified, your profile will be updated with a verified badge, and you'll gain full access to bid on projects.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                    <div>
                      <p className="font-semibold text-gray-900">You'll Be Notified</p>
                      <p className="text-sm text-gray-600">We'll send you an email notification as soon as your license has been verified.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 max-w-xl mx-auto">
                <p className="text-yellow-900 text-sm font-medium">
                  Please note: Verification typically takes 24-48 hours. You will be able to browse projects but cannot submit bids until verified.
                </p>
              </div>

              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
