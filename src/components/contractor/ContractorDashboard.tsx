import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, DollarSign, Briefcase, FileText, MapPin, ChevronRight, Clock, Phone, MessageCircle, CheckCircle, AlertTriangle, Upload, Image as ImageIcon, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BidBuilder } from './BidBuilder';
import { LocationSettings } from './LocationSettings';

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
    };
  };
}

interface AwaitingPaymentBid {
  id: string;
  total_price: number;
  project: {
    id: string;
    title: string;
    owner: { full_name: string };
  };
}

type MilestoneStatus = 'pending' | 'in_progress' | 'awaiting_approval' | 'approved' | 'paid' | 'disputed';

interface Milestone {
  id: string;
  description: string;
  amount: number;
  status: MilestoneStatus;
  order_index: number;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
  owner: {
    full_name: string;
    phone?: string;
  };
  milestones?: Milestone[];
  project_images?: Array<{ image_url: string }>;
  conversationId?: string; // resolved after fetch
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
  const [awaitingPaymentBids, setAwaitingPaymentBids] = useState<AwaitingPaymentBid[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null);
  const [invoiceSuccess, setInvoiceSuccess] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!profile?.id) {
      return;
    }

    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

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
            owner:profiles!projects_owner_id_fkey(full_name)
          )
        `)
        .eq('contractor_id', profile.id)
        .in('status', ['submitted', 'viewed'])
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: projectsData } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(full_name, phone),
          milestones(id, description, amount, status, order_index),
          project_images(image_url)
        `)
        .eq('selected_contractor_id', profile.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(10);

      // Enrich projects with their conversation ID
      const projectsWithConv = await Promise.all(
        (projectsData || []).map(async (p: any) => {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('project_id', p.id)
            .maybeSingle();
          return {
            ...p,
            milestones: (p.milestones || []).sort((a: Milestone, b: Milestone) => a.order_index - b.order_index),
            conversationId: conv?.id ?? null,
          };
        })
      );

      const { data: allBidsData } = await supabase
        .from('bids')
        .select('*')
        .eq('contractor_id', profile.id);

      // Accepted bids where project is still awaiting owner payment
      const { data: awaitingRaw } = await supabase
        .from('bids')
        .select(`
          id, total_price,
          project:projects!bids_project_id_fkey(
            id, title, status,
            owner:profiles!projects_owner_id_fkey(full_name)
          )
        `)
        .eq('contractor_id', profile.id)
        .eq('status', 'accepted');

      const awaitingList: AwaitingPaymentBid[] = (awaitingRaw ?? [])
        .filter((b: any) => b.project?.status === 'awaiting_deposit')
        .map((b: any) => ({
          id: b.id,
          total_price: b.total_price,
          project: { id: b.project.id, title: b.project.title, owner: b.project.owner },
        }));

      const acceptedBids = allBidsData?.filter(b => b.status === 'accepted') || [];

      setActiveBids(bidsData || []);
      setOngoingProjects(projectsWithConv);
      setAwaitingPaymentBids(awaitingList);
      setStats({
        totalRevenue: acceptedBids.reduce((sum, b) => sum + (b.total_amount || 0), 0),
        totalProjects: acceptedBids.length,
        totalBids: allBidsData?.length || 0,
      });
      loadingRef.current = false;
    } catch (error) {
      console.error('Error loading data:', error);
      loadingRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id && !loadingRef.current) {
      loadData();
    } else if (!profile?.id) {
      setLoading(false);
    }
  }, [profile?.id, loadData]);

  async function handleInvoiceUpload(projectId: string, file: File) {
    if (!profile?.id) return;
    setUploadingInvoice(projectId);
    try {
      const ext = file.name.split('.').pop();
      const path = `invoices/${profile.id}/${projectId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('chat-attachments').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);

      // Send invoice as a message in the project conversation
      const project = ongoingProjects.find(p => p.id === projectId);
      if (project?.conversationId) {
        await supabase.from('messages').insert({
          conversation_id: project.conversationId,
          sender_id: profile.id,
          content: `📄 Final Invoice — ${file.name}`,
          attachment_url: publicUrl,
          attachment_type: 'file',
          attachment_name: file.name,
        });
        await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', project.conversationId);
      }

      setInvoiceSuccess(projectId);
      setTimeout(() => setInvoiceSuccess(null), 4000);
    } catch (err) {
      console.error('Invoice upload error:', err);
      alert('Failed to upload invoice. Please try again.');
    } finally {
      setUploadingInvoice(null);
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
                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full ${
                  profile?.verification_status === 'verified' ? 'bg-green-500' : 'bg-amber-500'
                }`}>
                  {profile?.verification_status === 'verified' ? 'Verified' : 'Pending Verification'}
                </div>
              </div>
              {(profile?.rating ?? 0) > 0 && (
                <div className="flex items-center justify-center gap-2 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${star <= Math.round(profile?.rating ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`}
                    />
                  ))}
                  <span className="text-white font-semibold ml-1">
                    {profile?.rating?.toFixed(1)}/5.0
                  </span>
                </div>
              )}
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

        <div className="mb-8">
          <LocationSettings />
        </div>

        {/* ── Awaiting Owner Payment ───────────────────────────────────────── */}
        {awaitingPaymentBids.length > 0 && (
          <div className="mb-8">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl overflow-hidden">
              <div className="bg-blue-600 px-6 py-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-white" />
                <h3 className="text-white font-bold text-base">
                  Waiting for Owner Payment
                </h3>
                <span className="ml-auto bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {awaitingPaymentBids.length}
                </span>
              </div>

              <div className="p-6 space-y-4">
                {awaitingPaymentBids.map(bid => (
                  <div
                    key={bid.id}
                    className="bg-white rounded-xl border border-blue-200 p-5"
                  >
                    <p className="font-bold text-gray-900">{bid.project.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Owner: {bid.project.owner?.full_name}
                    </p>
                    <p className="text-sm text-blue-700 mt-2 font-medium">
                      Your bid was accepted! Waiting for the owner's first payment to activate the project.
                    </p>
                  </div>
                ))}
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

                    <div className="py-4 border-y border-gray-200">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-500">Owner:</span>
                        <p className="text-sm font-semibold text-gray-900">{bid.project.owner.full_name}</p>
                        <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Contact info available after deposit is paid
                        </span>
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
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-gray-900">Ongoing Projects</h3>
                <span className="bg-green-500 text-white text-sm font-bold px-3 py-0.5 rounded-full">
                  {ongoingProjects.length} Active
                </span>
              </div>
            </div>

            {/* Obligation banner */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 font-medium">
                You are contractually obligated to complete all active projects in full.
                Keep milestones updated, communicate proactively, and upload your final invoice upon completion.
              </p>
            </div>

            <div className="space-y-6">
              {ongoingProjects.map((project) => {
                const milestones = project.milestones || [];
                const total = milestones.length;
                const done = milestones.filter(m => m.status === 'paid' || m.status === 'approved').length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const isExpanded = expandedProjectId === project.id;
                const address = [project.address, project.city, project.state, project.zip_code].filter(Boolean).join(', ');
                const mapsUrl = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;
                const isLastMilestoneDone = total > 0 && (milestones[total - 1]?.status === 'approved' || milestones[total - 1]?.status === 'paid');
                const showInvoiceUpload = pct >= 75 || isLastMilestoneDone;
                const didUploadInvoice = invoiceSuccess === project.id;

                return (
                  <div key={project.id} className="bg-white rounded-2xl shadow-sm border-2 border-green-200 overflow-hidden">
                    {/* Top bar */}
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                          {project.title.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base leading-tight">{project.title}</h4>
                          <p className="text-green-100 text-xs">Owner: {project.owner.full_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-green-100 text-xs">Progress</p>
                          <p className="text-white font-bold text-lg">{pct}%</p>
                        </div>
                        <button
                          onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-green-100">
                      <div
                        className="h-2 bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="p-6">
                      {/* Project images */}
                      {project.project_images && project.project_images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                          {project.project_images.slice(0, 5).map((img, i) => (
                            <img
                              key={i}
                              src={img.image_url}
                              alt={`Project ${i + 1}`}
                              className="w-24 h-20 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                            />
                          ))}
                          {project.project_images.length > 5 && (
                            <div className="w-24 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <p className="text-xs font-semibold text-gray-500">+{project.project_images.length - 5}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Address + owner contact */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {address && (
                          <a
                            href={mapsUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 hover:bg-blue-100 transition-colors"
                          >
                            <Navigation className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-blue-500 font-medium">Project Address</p>
                              <p className="text-sm font-semibold text-blue-800 truncate">{address}</p>
                            </div>
                          </a>
                        )}
                        {project.owner.phone && (
                          <a
                            href={`tel:${project.owner.phone}`}
                            className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 hover:bg-green-100 transition-colors"
                          >
                            <Phone className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-green-500 font-medium">Owner Phone</p>
                              <p className="text-sm font-semibold text-green-800">{project.owner.phone}</p>
                            </div>
                          </a>
                        )}
                      </div>

                      {/* Milestone tracker */}
                      {milestones.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Milestone Progress</p>
                            <p className="text-xs font-semibold text-gray-700">{done}/{total} completed</p>
                          </div>

                          {/* Steps */}
                          <div className="space-y-2">
                            {(isExpanded ? milestones : milestones.slice(0, 3)).map((m, idx) => {
                              const statusConfig: Record<MilestoneStatus, { label: string; cls: string; dot: string }> = {
                                paid:               { label: 'Paid',              cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
                                approved:           { label: 'Approved',          cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
                                awaiting_approval:  { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500 animate-pulse' },
                                in_progress:        { label: 'In Progress',       cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500 animate-pulse' },
                                disputed:           { label: 'Disputed',          cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
                                pending:            { label: 'Pending',           cls: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300' },
                              };
                              const cfg = statusConfig[m.status] ?? statusConfig.pending;
                              const isDone = m.status === 'paid' || m.status === 'approved';

                              return (
                                <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDone ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-500' : 'bg-white border-2 border-gray-300'}`}>
                                    {isDone
                                      ? <CheckCircle className="w-4 h-4 text-white" />
                                      : <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                                    }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                      {m.description}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-bold text-gray-700">${m.amount.toLocaleString()}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {!isExpanded && milestones.length > 3 && (
                              <button
                                onClick={() => setExpandedProjectId(project.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
                              >
                                + {milestones.length - 3} more milestones
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Invoice upload */}
                      {showInvoiceUpload && (
                        <div className={`mb-4 rounded-xl border-2 border-dashed p-4 ${didUploadInvoice ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                          {didUploadInvoice ? (
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle className="w-5 h-5" />
                              <p className="text-sm font-semibold">Invoice uploaded and sent to owner!</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-gray-700 mb-1">📄 Final Invoice</p>
                              <p className="text-xs text-gray-500 mb-3">
                                Upload your final invoice. It will be sent directly to the owner via the project chat.
                              </p>
                              <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${uploadingInvoice === project.id ? 'bg-gray-200 text-gray-400' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}>
                                {uploadingInvoice === project.id ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    Uploading…
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    Upload Invoice
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                  className="hidden"
                                  disabled={uploadingInvoice === project.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleInvoiceUpload(project.id, f);
                                  }}
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-3">
                        {project.conversationId && (
                          <button
                            onClick={() => navigate('/messages', { state: { conversationId: project.conversationId } })}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Open Chat
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/project/${project.id}/payments`)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all text-sm"
                        >
                          <DollarSign className="w-4 h-4" />
                          Manage Payments
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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

    </div>
  );
}
