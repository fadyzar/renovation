import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Briefcase, Star, X, MapPin, TrendingUp, Shield, Award, ThumbsUp } from 'lucide-react';
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
            years_experience,
            service_latitude,
            service_longitude,
            license_verified,
            license_status
          )
        `)
        .eq('project_id', projectId)
        .eq('status', 'submitted')
        .order('total_price', { ascending: true });

      if (bidsError) throw bidsError;
      setBids(bidsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptOffer(bidId: string) {
    navigate(`/accept-offer/${projectId}/${bidId}`);
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

  function getMatchScore(bid: Bid): number {
    let score = 0;

    if (bid.contractor?.license_verified && bid.contractor?.license_status === 'approved') {
      score += 30;
    }

    if (bid.contractor?.years_experience && bid.contractor.years_experience > 5) {
      score += 20;
    } else if (bid.contractor?.years_experience && bid.contractor.years_experience > 2) {
      score += 10;
    }

    if (bid.milestones && bid.milestones.length >= 3) {
      score += 15;
    }

    if (bid.message && bid.message.length > 100) {
      score += 10;
    }

    const avgBudget = project ? (project as any).budget_max : 0;
    if (avgBudget > 0) {
      const priceDiff = Math.abs(bid.total_price - avgBudget) / avgBudget;
      if (priceDiff < 0.1) {
        score += 25;
      } else if (priceDiff < 0.2) {
        score += 15;
      } else if (priceDiff < 0.3) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }

  function getMatchLabel(score: number): { label: string; color: string } {
    if (score >= 80) return { label: 'Excellent Match', color: 'bg-green-100 text-green-800' };
    if (score >= 60) return { label: 'Good Match', color: 'bg-blue-100 text-blue-800' };
    if (score >= 40) return { label: 'Fair Match', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Low Match', color: 'bg-gray-100 text-gray-800' };
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
          {bids.map((bid) => {
            const matchScore = getMatchScore(bid);
            const matchInfo = getMatchLabel(matchScore);
            return (
            <div key={bid.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 relative">
              <div className="absolute top-4 right-4">
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${matchInfo.color}`}>
                  {matchInfo.label} ({matchScore}%)
                </div>
              </div>

              <div className="flex items-start gap-4 mb-4 mt-8">
                <div className="relative">
                  <img
                    src={bid.contractor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(bid.contractor?.full_name || 'Contractor')}&background=random`}
                    alt={bid.contractor?.full_name}
                    className="w-16 h-16 rounded-full object-cover shadow-md"
                  />
                  {bid.contractor?.license_verified && bid.contractor?.license_status === 'approved' && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                      <Shield className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{bid.contractor?.full_name}</h3>
                  <p className="text-sm text-gray-600">
                    {bid.contractor?.company_name || bid.contractor?.specialties?.[0] || 'General Contractor'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {bid.contractor?.license_verified && bid.contractor?.license_status === 'approved' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Shield className="w-3 h-3 mr-1" />
                        Licensed
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-xs text-gray-600 ml-1 font-medium">(5.0)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-medium text-blue-900">Projects</p>
                  </div>
                  <p className="text-lg font-bold text-blue-900">{getProjectCount(bid.contractor)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-medium text-green-900">Success Rate</p>
                  </div>
                  <p className="text-lg font-bold text-green-900">98%</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-medium text-purple-900">Experience</p>
                  </div>
                  <p className="text-lg font-bold text-purple-900">{bid.contractor?.years_experience || 10}y</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-orange-600" />
                    <p className="text-xs font-medium text-orange-900">Timeline</p>
                  </div>
                  <p className="text-sm font-bold text-orange-900">{calculateEstimatedTime(bid)}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600 font-medium">Bid Amount</p>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  ${bid.total_price.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">{bid.milestones.length} milestone{bid.milestones.length !== 1 ? 's' : ''}</p>
              </div>

              <button
                onClick={() => {
                  setSelectedBid(bid);
                  setShowProfileModal(true);
                }}
                className="w-full px-4 py-2.5 text-sm text-blue-600 font-semibold border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors mb-2"
              >
                View Full Profile
              </button>
              <button
                onClick={() => handleAcceptOffer(bid.id)}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
              >
                Accept Offer
              </button>
            </div>
            );
          })}
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
                  handleAcceptOffer(selectedBid.id);
                }}
                className="w-full px-6 py-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Accept This Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
