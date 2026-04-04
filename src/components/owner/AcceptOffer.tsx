import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Briefcase, Calendar, Star, CheckCircle, MapPin, User, Mail, Phone, Maximize2, BarChart3 } from 'lucide-react';
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
    total_projects: number;
    rating: number;
    verification_status: string;
    license_verified: boolean;
  };
}

interface Project {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  room_length: number;
  room_width: number;
  finish_level: string;
  status: string;
}

export function AcceptOffer() {
  const { projectId, bidId } = useParams<{ projectId: string; bidId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [bid, setBid] = useState<Bid | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (projectId && bidId) {
      loadData();
    }
  }, [projectId, bidId]);

  async function loadData() {
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

      const { data: bidData, error: bidError } = await supabase
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
            total_projects,
            rating,
            verification_status,
            license_verified
          )
        `)
        .eq('id', bidId)
        .maybeSingle();

      if (bidError) throw bidError;
      if (!bidData) {
        navigate('/dashboard');
        return;
      }

      setBid(bidData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAndProceed() {
    if (!confirmed) {
      alert('Please confirm that you have reviewed the contractor\'s profile and agree to proceed.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Accept the selected bid
      await supabase
        .from('bids')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', bidId);

      // 2. Reject all other bids for this project
      await supabase
        .from('bids')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .neq('id', bidId);

      // 3. Move project to awaiting_deposit — contractor must pay 10% deposit
      //    before the project becomes fully active (in_progress).
      //    The DepositPaymentModal on the contractor side advances to in_progress.
      await supabase
        .from('projects')
        .update({
          status: 'awaiting_deposit',
          selected_contractor_id: bid?.contractor_id,
        })
        .eq('id', projectId);

      // 4. Send notification to contractor
      if (bid?.contractor_id) {
        await supabase.from('notifications').insert({
          user_id: bid.contractor_id,
          type: 'bid_accepted',
          title: 'Bid Accepted!',
          message: `Your bid of $${bid.total_price.toLocaleString()} for "${project?.title}" was accepted! Pay the deposit to start.`,
          metadata: {
            project_id: projectId,
            bid_id: bidId,
            deposit_amount: bid.total_price * 0.1,
            total_amount: bid.total_price
          }
        });
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Error accepting bid:', error);
      alert('Failed to accept offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function calculateEstimatedTime(): string {
    if (!bid) return '1 Month';
    const totalDuration = bid.milestones.reduce((sum, m) => sum + (m.duration || 0), 0);
    if (totalDuration === 0) {
      const monthsEstimate = Math.ceil(bid.milestones.length * 2);
      return monthsEstimate === 1 ? '1 Month' : `${monthsEstimate / 2} Months`;
    }
    const months = Math.ceil(totalDuration / 30);
    return months === 1 ? '1 Month' : `${months / 2} Months`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!project || !bid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Project or bid not found</p>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Confirm Your Selection
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h2>
              <p className="text-gray-600">{project.description}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Project Location</h3>
              <p className="text-gray-600">
                {project.address}, {project.city}, {project.state} {project.zip_code}, {project.country || 'USA'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Full Name</p>
                <p className="text-sm font-semibold text-gray-900">{profile?.full_name || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Your Mail</p>
                <p className="text-sm font-semibold text-gray-900">{profile?.email || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Phone Number</p>
                <p className="text-sm font-semibold text-gray-900">{profile?.phone || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Maximize2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Room Dimensions</p>
                <p className="text-sm font-semibold text-gray-900">
                  {project.room_length && project.room_width
                    ? `${project.room_length}X${project.room_width}`
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Finish Level</p>
                <p className="text-sm font-semibold text-gray-900">{project.finish_level || 'Standard'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200"></div>
            <div className="relative flex justify-between">
              {bid.milestones.map((milestone, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center mb-2">
                    <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                  </div>
                  <p className="text-xs font-medium text-gray-900 text-center">
                    Step #{index + 1} Renovation
                  </p>
                  <p className="text-xs font-bold text-gray-900">
                    ${milestone.price.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <img
                src={bid.contractor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(bid.contractor?.full_name || 'Contractor')}&background=random`}
                alt={bid.contractor?.full_name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900">{bid.contractor?.full_name}</h3>
                <p className="text-gray-600 mb-2">
                  {bid.contractor?.company_name || 'Licensed General Contractor'}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  {bid.contractor?.verification_status === 'verified' || bid.contractor?.license_verified ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Verification Pending
                    </span>
                  )}
                </div>
                {(bid.contractor?.rating ?? 0) > 0 ? (
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < Math.round(bid.contractor?.rating ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                    <span className="text-xs text-gray-600 ml-1">({bid.contractor?.rating?.toFixed(1)} Stars)</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">No ratings yet</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Bid Amount:</p>
              <p className="text-3xl font-bold text-gray-900">
                ${bid.total_price.toLocaleString()}
              </p>
              <button
                onClick={() => navigate(`/contractor-matching/${projectId}`)}
                className="text-sm text-blue-600 hover:underline mt-2"
              >
                View Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Finished Projects</p>
                <p className="text-sm text-gray-600">
                  {(bid.contractor?.total_projects ?? 0) > 0
                    ? `${bid.contractor?.total_projects} Projects`
                    : 'New contractor'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Estimated Completion Time</p>
                <p className="text-sm text-gray-600">{calculateEstimatedTime()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 text-orange-500 focus:ring-orange-500 rounded"
            />
            <span className="text-gray-700">
              I confirm that I have reviewed this contractor's profile and agree to proceed with this selection.
            </span>
          </label>
        </div>

        <div className="text-center">
          <button
            onClick={handleConfirmAndProceed}
            disabled={!confirmed || submitting}
            className="px-12 py-4 bg-orange-500 text-white text-lg font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Processing...' : 'Confirm & Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
