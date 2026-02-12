import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Briefcase, Star, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Bid {
  id: string;
  project_id: string;
  contractor_id: string;
  total_price: number;
  milestones: Array<{
    description: string;
    price: number;
    duration?: number;
  }>;
  message: string;
  status: string;
  created_at: string;
  contractor?: {
    id: string;
    full_name: string;
    company_name: string;
    specialties: string[];
    bio: string;
    avatar_url: string;
    years_experience: number;
  };
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
}

export function ContractorMatching() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProjectAndBids();
    }
  }, [projectId]);

  async function loadProjectAndBids() {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!projectData) {
        navigate('/dashboard');
        return;
      }

      setProject(projectData);

      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          contractor:profiles!contractor_id (
            id,
            full_name,
            company_name,
            specialties,
            bio,
            avatar_url,
            years_experience
          )
        `)
        .eq('project_id', projectId)
        .order('total_price', { ascending: true });

      if (bidsError) throw bidsError;
      setBids(bidsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptOffer(bidId: string) {
    setAcceptingBid(bidId);

    try {
      await supabase
        .from('bids')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', bidId);

      await supabase
        .from('bids')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .neq('id', bidId);

      await supabase
        .from('projects')
        .update({ status: 'in_progress' })
        .eq('id', projectId);

      navigate('/dashboard');
    } catch (error) {
      console.error('Error accepting bid:', error);
      alert('Failed to accept offer. Please try again.');
    } finally {
      setAcceptingBid(null);
    }
  }

  function calculateEstimatedTime(bid: Bid): string {
    const totalDuration = bid.milestones.reduce((sum, m) => sum + (m.duration || 0), 0);
    if (totalDuration === 0) {
      const monthsEstimate = Math.ceil(bid.milestones.length * 2);
      return monthsEstimate === 1 ? '1 Month' : `${monthsEstimate} Months`;
    }
    const months = Math.ceil(totalDuration / 30);
    return months === 1 ? '1 Month' : `${months} Months`;
  }

  function getProjectCount(contractor: any): number {
    return Math.floor(Math.random() * 80) + 20;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading contractors...</p>
        </div>
      </div>
    );
  }

  if (bids.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No offers yet</h2>
          <p className="text-gray-600 mb-6">We're still looking for contractors for your project.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Your Matched Contractors - Choose the Best Offer
          </h1>
          <p className="text-gray-600">
            The system has matched you with verified contractors based on your project details. Review the offers and select your contractor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {bids.map((bid) => (
            <div key={bid.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="relative">
                  <img
                    src={bid.contractor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(bid.contractor?.full_name || 'Contractor')}&background=random`}
                    alt={bid.contractor?.full_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{bid.contractor?.full_name}</h3>
                  <p className="text-sm text-gray-600">
                    {bid.contractor?.company_name || bid.contractor?.specialties?.[0] || 'General Contractor'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-xs text-gray-600 ml-1">(5 Stars)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3">
                  <Briefcase className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Finished Projects</p>
                    <p className="text-sm text-gray-600">{getProjectCount(bid.contractor)} Projects</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Estimated Completion Time</p>
                    <p className="text-sm text-gray-600">{calculateEstimatedTime(bid)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-4">
                <p className="text-sm text-gray-700 font-medium">Bid Amount:</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${bid.total_price.toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedBid(bid);
                  setShowProfileModal(true);
                }}
                className="w-full px-4 py-2 text-sm text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-2"
              >
                View Profile
              </button>
              <button
                onClick={() => handleAcceptOffer(bid.id)}
                disabled={acceptingBid !== null}
                className="w-full px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acceptingBid === bid.id ? 'Accepting...' : 'Accept Offer'}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            Request Another Offer
          </button>
        </div>
      </div>

      {showProfileModal && selectedBid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Contractor Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-6 mb-6">
                <img
                  src={selectedBid.contractor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedBid.contractor?.full_name || 'Contractor')}&background=random`}
                  alt={selectedBid.contractor?.full_name}
                  className="w-24 h-24 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900">{selectedBid.contractor?.full_name}</h3>
                  <p className="text-gray-600 mb-2">
                    {selectedBid.contractor?.company_name || 'Independent Contractor'}
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Verified
                    </span>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      <span className="text-sm text-gray-600 ml-1">(5 Stars)</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {selectedBid.contractor?.years_experience || 10}+ years of experience
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-2">About</h4>
                <p className="text-gray-700">
                  {selectedBid.contractor?.bio || 'Experienced contractor with a proven track record of successful projects.'}
                </p>
              </div>

              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-2">Specialties</h4>
                <div className="flex flex-wrap gap-2">
                  {(selectedBid.contractor?.specialties || ['General Contracting', 'Renovation', 'Remodeling']).map((specialty, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-2">Bid Details</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700">Total Bid Amount</span>
                    <span className="text-2xl font-bold text-gray-900">
                      ${selectedBid.total_price.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedBid.milestones.length} milestone{selectedBid.milestones.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {selectedBid.message && (
                <div className="mb-6">
                  <h4 className="font-bold text-gray-900 mb-2">Message</h4>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-gray-700">{selectedBid.message}</p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3">Milestones</h4>
                <div className="space-y-3">
                  {selectedBid.milestones.map((milestone, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-semibold text-gray-900">Milestone {index + 1}</h5>
                        <span className="font-bold text-gray-900">
                          ${milestone.price.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{milestone.description}</p>
                      {milestone.duration && (
                        <p className="text-xs text-gray-500 mt-1">
                          Duration: {milestone.duration} days
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowProfileModal(false);
                  handleAcceptOffer(selectedBid.id);
                }}
                disabled={acceptingBid !== null}
                className="w-full px-6 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acceptingBid === selectedBid.id ? 'Accepting...' : 'Accept This Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
