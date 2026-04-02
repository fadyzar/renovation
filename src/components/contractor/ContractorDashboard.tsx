import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, DollarSign, Briefcase, FileText, MapPin, Mail, Phone, Home, Calendar, ChevronRight, AlertCircle, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BidBuilder } from './BidBuilder';
import { LocationSettings } from './LocationSettings';
import { DepositPaymentModal } from '../shared/DepositPaymentModal';

interface Bid {
  id: string;
  total_price: number;
  status: string;
  created_at: string;
  project: {
    id: string;
    title: string;
    description: string;
    status?: string;
    owner_id?: string;
    properties?: {
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    };
    owner: {
      full_name: string;
      email: string;
      phone?: string;
    };
  };
}

interface DepositPendingBid {
  id: string;
  total_price: number;
  project: {
    id: string;
    title: string;
    description: string;
    owner_id: string;
    owner: { full_name: string };
  };
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
  properties?: {
    address?: string;
    city?: string;
    state?: string;
  };
  owner: {
    full_name: string;
    email: string;
  };
}

export function ContractorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProjects: 0,
    totalBids: 0,
  });
  const [activeBids, setActiveBids] = useState<Bid[]>([]);
  const [ongoingProjects, setOngoingProjects] = useState<Project[]>([]);
  const [depositPendingBids, setDepositPendingBids] = useState<DepositPendingBid[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [depositModalBid, setDepositModalBid] = useState<DepositPendingBid | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          *,
          project:projects(
            id,
            title,
            description,
            properties(address, city, state, zip_code),
            owner:profiles!projects_owner_id_fkey(full_name, email, phone)
          )
        `)
        .eq('contractor_id', profile?.id)
        .in('status', ['submitted', 'viewed'])
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: projectsData } = await supabase
        .from('projects')
        .select(`
          *,
          properties(address, city, state),
          owner:profiles!projects_owner_id_fkey(full_name, email)
        `)
        .eq('selected_contractor_id', profile?.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: allBidsData } = await supabase
        .from('bids')
        .select('*')
        .eq('contractor_id', profile?.id);

      // Fetch accepted bids where project is awaiting deposit payment from this contractor
      const { data: acceptedBidsWithProject } = await supabase
        .from('bids')
        .select(`
          id,
          total_price,
          project:projects!bids_project_id_fkey(
            id,
            title,
            description,
            status,
            owner_id,
            owner:profiles!projects_owner_id_fkey(full_name)
          )
        `)
        .eq('contractor_id', profile?.id)
        .eq('status', 'accepted');

      const pendingDeposit = (acceptedBidsWithProject || []).filter(
        (b: any) => b.project?.status === 'awaiting_deposit'
      ) as DepositPendingBid[];

      const acceptedBids = allBidsData?.filter(b => b.status === 'accepted') || [];

      setActiveBids(bidsData || []);
      setOngoingProjects(projectsData || []);
      setDepositPendingBids(pendingDeposit);
      setStats({
        totalRevenue: acceptedBids.reduce((sum, b) => sum + (b.total_price || 0), 0),
        totalProjects: acceptedBids.length,
        totalBids: allBidsData?.length || 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleBrowseProjects = () => {
    navigate('/projects');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome Back, {profile?.full_name?.split(' ')[0] || 'Contractor'}!
          </h1>
          <p className="text-gray-600">
            Manage your bids, track ongoing projects, and stay updated—all in one place.
          </p>
        </div>

        <div className="relative bg-gradient-to-r from-blue-500 to-teal-500 rounded-3xl overflow-hidden mb-8 h-64">
          <img
            src="https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Construction site"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-32 h-32 rounded-full bg-white p-1">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-4xl font-bold">
                    {profile?.full_name?.charAt(0) || 'C'}
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Verified
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
                <span className="text-white font-semibold ml-1">
                  {profile?.rating?.toFixed(1) || '5.0'}/5.0
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{profile?.full_name}</h2>
            <p className="text-gray-600">{profile?.company_name || 'Licensed General Contractor'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-700 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-900">
                    ${stats.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-700 font-medium">Total Projects</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-orange-700 font-medium">Total Bids</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.totalBids}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleBrowseProjects}
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Browse New Projects
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <LocationSettings />

        {/* ── Deposit Required Alert ───────────────────────────────────────── */}
        {depositPendingBids.length > 0 && (
          <div className="mb-8">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl overflow-hidden">
              <div className="bg-amber-500 px-6 py-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-white" />
                <h3 className="text-white font-bold text-base">
                  Action Required — Deposit Payment
                </h3>
                <span className="ml-auto bg-white text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {depositPendingBids.length} pending
                </span>
              </div>

              <div className="p-6 space-y-4">
                {depositPendingBids.map(bid => {
                  const depositAmount = Math.round(bid.total_price * 0.1);
                  return (
                    <div
                      key={bid.id}
                      className="bg-white rounded-xl border border-amber-200 p-5 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{bid.project.title}</p>
                        <p className="text-sm text-gray-500 truncate">{bid.project.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            Total bid:{' '}
                            <span className="font-semibold text-gray-900">
                              ${bid.total_price.toLocaleString()}
                            </span>
                          </span>
                          <span className="text-amber-700 font-bold">
                            Deposit required: ${depositAmount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Owner: {bid.project.owner?.full_name} · Deposit held in escrow
                        </p>
                      </div>
                      <button
                        onClick={() => setDepositModalBid(bid)}
                        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                      >
                        <Lock className="w-4 h-4" />
                        Pay ${depositAmount.toLocaleString()} Deposit
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeBids.length > 0 && (
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Your Active Bids</h3>
            <div className="space-y-4">
              {activeBids.map((bid) => (
                <div key={bid.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-gray-900 mb-2">
                          {bid.project.title}
                        </h4>
                        <p className="text-gray-600 text-sm mb-3">
                          {bid.project.description}
                        </p>
                        {bid.project.properties && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>
                              {bid.project.properties.address}, {bid.project.properties.city}, {bid.project.properties.state} {bid.project.properties.zip_code}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-200">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-gray-500">Full Name</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{bid.project.owner.full_name}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-gray-500">Your Mail</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{bid.project.owner.email}</p>
                      </div>

                      {bid.project.owner.phone && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Phone className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-gray-500">Phone Number</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{bid.project.owner.phone}</p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Home className="w-4 h-4 text-blue-500" />
                          <span className="text-xs text-gray-500">Finish Level</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">Standard</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://ui-avatars.com/api/?name=${bid.project.owner.full_name}&background=random`}
                          alt={bid.project.owner.full_name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{bid.project.owner.full_name}</p>
                          <p className="text-xs text-gray-500">First-Time Renovator</p>
                        </div>
                      </div>

                      <button className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200">
                        Bid Amount: ${bid.total_price.toLocaleString()}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-6">
              <button className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors">
                Show More
              </button>
            </div>
          </div>
        )}

        {ongoingProjects.length > 0 && (
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ongoing Projects</h3>
            <div className="space-y-4">
              {ongoingProjects.map((project) => (
                <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-gray-900 mb-2">
                          {project.title}
                        </h4>
                        <p className="text-gray-600 text-sm mb-3">
                          {project.description}
                        </p>
                        {project.properties && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>
                              {project.properties.address}, {project.properties.city}, {project.properties.state}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://ui-avatars.com/api/?name=${project.owner.full_name}&background=random`}
                          alt={project.owner.full_name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{project.owner.full_name}</p>
                          <p className="text-xs text-gray-500">Property Investor</p>
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded mt-1">
                            In Progress
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => navigate(`/project/${project.id}/payments`)}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all duration-200"
                      >
                        <DollarSign className="w-4 h-4" />
                        Manage Payments
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-6">
              <button className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors">
                Show More
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProject && (
        <BidBuilder
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={loadData}
        />
      )}

      {depositModalBid && profile && (
        <DepositPaymentModal
          projectId={depositModalBid.project.id}
          bidId={depositModalBid.id}
          ownerId={depositModalBid.project.owner_id}
          contractorId={profile.id}
          projectTitle={depositModalBid.project.title}
          totalBidAmount={depositModalBid.total_price}
          onSuccess={() => {
            setDepositModalBid(null);
            loadData();
            navigate('/messages');
          }}
          onClose={() => setDepositModalBid(null)}
        />
      )}
    </div>
  );
}
