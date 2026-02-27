import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, X, ExternalLink, Check, AlertCircle, Clock } from 'lucide-react';

interface VerificationRequest {
  id: string;
  full_name: string;
  company_name: string;
  license_number: string;
  business_name: string;
  license_expiration_date: string;
  license_screenshot_url: string;
  verification_status: string;
  created_at: string;
  avatar_url: string;
}

export function AdminVerificationReview() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading verification requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationAction = async (
    profileId: string,
    newStatus: 'verified' | 'rejected' | 'expired' | 'suspended',
    notes: string = ''
  ) => {
    setProcessingId(profileId);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          verification_status: newStatus,
          license_verified: newStatus === 'verified',
          verification_date: newStatus === 'verified' ? new Date().toISOString() : null
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      await supabase
        .from('verification_logs')
        .insert({
          profile_id: profileId,
          action: 'admin_review',
          old_status: 'pending',
          new_status: newStatus,
          notes: notes || `Admin ${newStatus} the verification request`
        });

      setRequests(prev => prev.filter(req => req.id !== profileId));
      setSelectedRequest(null);
      alert(`Verification ${newStatus} successfully!`);
    } catch (error) {
      console.error('Error updating verification:', error);
      alert('Failed to update verification. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading verification requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-600" />
            License Verification Review
          </h1>
          <p className="text-gray-600">
            Review and approve contractor license verification requests
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 text-center">
            <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Pending Requests</h3>
            <p className="text-gray-600">All verification requests have been processed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6"
              >
                <div className="flex items-start gap-6">
                  <img
                    src={request.avatar_url || `https://ui-avatars.com/api/?name=${request.full_name}&size=100&background=random`}
                    alt={request.full_name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{request.full_name}</h3>
                        <p className="text-gray-600">{request.company_name || request.business_name}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Review Details
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">License Number</p>
                        <p className="font-bold text-gray-900">{request.license_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Business Name</p>
                        <p className="font-bold text-gray-900">{request.business_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Expiration Date</p>
                        <p className="font-bold text-gray-900">
                          {request.license_expiration_date
                            ? new Date(request.license_expiration_date).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">Review License Verification</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-start gap-6">
                <img
                  src={selectedRequest.avatar_url || `https://ui-avatars.com/api/?name=${selectedRequest.full_name}&size=120&background=random`}
                  alt={selectedRequest.full_name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                />
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{selectedRequest.full_name}</h3>
                  <p className="text-gray-600 mb-3">{selectedRequest.company_name || selectedRequest.business_name}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">License Number</p>
                      <p className="font-bold text-gray-900">{selectedRequest.license_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expiration Date</p>
                      <p className="font-bold text-gray-900">
                        {selectedRequest.license_expiration_date
                          ? new Date(selectedRequest.license_expiration_date).toLocaleDateString()
                          : 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <h4 className="font-bold text-blue-900">Verification Steps</h4>
                </div>
                <ol className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Review the screenshot provided by the contractor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Verify license number matches the CSLB records</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Confirm license status is ACTIVE</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Check expiration date is valid</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">5.</span>
                    <span>Cross-reference with official CSLB website if needed</span>
                  </li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-900">CSLB Screenshot</h4>
                  <a
                    href="https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2"
                  >
                    Verify on CSLB
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="border-2 border-gray-300 rounded-xl overflow-hidden">
                  <img
                    src={selectedRequest.license_screenshot_url}
                    alt="License screenshot"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleVerificationAction(selectedRequest.id, 'verified')}
                  disabled={processingId === selectedRequest.id}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Approve & Verify
                </button>
                <button
                  onClick={() => handleVerificationAction(selectedRequest.id, 'rejected')}
                  disabled={processingId === selectedRequest.id}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Reject
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVerificationAction(selectedRequest.id, 'expired', 'License has expired')}
                  disabled={processingId === selectedRequest.id}
                  className="px-4 py-2 border-2 border-orange-500 text-orange-700 rounded-lg font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  Mark as Expired
                </button>
                <button
                  onClick={() => handleVerificationAction(selectedRequest.id, 'suspended', 'License is suspended')}
                  disabled={processingId === selectedRequest.id}
                  className="px-4 py-2 border-2 border-red-500 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Mark as Suspended
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
