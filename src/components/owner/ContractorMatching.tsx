import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Calendar,
  Briefcase,
  Star,
  X,
  Shield,
  Award,
  Crown,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MatchScoreDisplay, computeMatchBreakdown, type MatchBreakdown } from '../shared/MatchScoreDisplay';
import { ScanDataPanel, type ScanData } from '../shared/ScanDataPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bid {
  id: string;
  project_id: string;
  contractor_id: string;
  total_price: number;
  milestones: Array<{ description: string; price: number; duration?: number }>;
  message: string;
  status: string;
  created_at: string;
  contractor?: {
    id: string;
    full_name: string;
    company_name: string;
    bio: string;
    avatar_url: string;
    rating: number | null;
  } | null;
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
}

interface RankedBid extends Bid {
  breakdown: MatchBreakdown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimatedTime(bid: Bid): string {
  const total = bid.milestones.reduce((s, m) => s + (m.duration || 0), 0);
  if (total === 0) {
    const mo = Math.max(1, Math.ceil(bid.milestones.length * 1.5));
    return `${mo} Month${mo !== 1 ? 's' : ''}`;
  }
  const mo = Math.ceil(total / 30);
  return `${mo} Month${mo !== 1 ? 's' : ''}`;
}

function avatarUrl(name?: string, url?: string | null): string {
  if (url && !url.includes('ui-avatars.com')) return url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'C')}&background=random`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractorMatching() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [rankedBids, setRankedBids] = useState<RankedBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBid, setSelectedBid] = useState<RankedBid | null>(null);
  const [scanData, setScanData] = useState<ScanData | null>(null);

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const { data: proj, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projErr) throw projErr;
      if (!proj) { navigate('/dashboard'); return; }
      setProject(proj);

      // Load scan data in parallel with bids
      const { data: scan } = await supabase
        .from('project_images')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      setScanData(scan ?? null);

      const scanForScoring = scan ? {
        measured_area_sqft: scan.measured_area_sqft,
        estimated_complexity: scan.estimated_complexity,
        detected_room_type: scan.detected_room_type,
        scan_confidence: scan.scan_confidence,
      } : null;

      const { data: bidsData, error: bidsErr } = await supabase
        .from('bids')
        .select(`
          *,
          contractor:profiles!bids_contractor_id_fkey (
            id,
            full_name,
            company_name,
            bio,
            avatar_url,
            rating
          )
        `)
        .eq('project_id', projectId)
        .in('status', ['submitted', 'viewed', 'accepted', 'rejected'])
        .order('created_at', { ascending: false });

      if (bidsErr) throw bidsErr;

      const scored: RankedBid[] = (bidsData || []).map(bid => ({
        ...bid,
        breakdown: computeMatchBreakdown(bid, { ...proj, scan: scanForScoring }),
      }));
      // Sort: highest score first
      scored.sort((a, b) => b.breakdown.score - a.breakdown.score);
      setRankedBids(scored);
    } catch (err) {
      console.error('Error loading contractor matching data:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Analyzing contractor matches…</p>
        </div>
      </div>
    );
  }

  if (rankedBids.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No bids yet</h2>
          <p className="text-gray-600 mb-6">
            We're still matching contractors to your project. Check back soon.
          </p>
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

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Award className="w-3.5 h-3.5" />
            AI-Powered Matching — {rankedBids.length} contractor{rankedBids.length !== 1 ? 's' : ''} scored
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
            Your Matched Contractors
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base px-2">
            Each contractor is scored across 7 signals — license, experience, budget, proposal
            quality, specialty match, service area, and profile. Ranked from best to lowest fit.
          </p>
        </div>

        {/* Scan panel — shown when scan exists */}
        {scanData && (
          <div className="max-w-2xl mx-auto mb-8">
            <ScanDataPanel scan={scanData} variant="card" />
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {rankedBids.map((bid, index) => {
            const isBestMatch = index === 0 && bid.status === 'submitted';
            const isAccepted = bid.status === 'accepted';
            const isRejected = bid.status === 'rejected';
            const isAwaitingDeposit = isAccepted && project?.status === 'awaiting_deposit';
            const isActive = isAccepted && project?.status === 'in_progress';
            const c = bid.contractor;
            return (
              <div
                key={bid.id}
                className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-lg relative overflow-hidden flex flex-col ${
                  isAccepted
                    ? 'border-green-300 ring-2 ring-green-200'
                    : isRejected
                    ? 'border-gray-300 opacity-75'
                    : isBestMatch
                    ? 'border-orange-300 ring-2 ring-orange-200'
                    : 'border-gray-200'
                }`}
              >
                {/* Status banner */}
                {isActive ? (
                  <div className="bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold px-4 py-1.5 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accepted — Project In Progress
                  </div>
                ) : isAwaitingDeposit ? (
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accepted — Payment Required
                  </div>
                ) : isRejected ? (
                  <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold px-4 py-1.5 flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" />
                    Not Selected
                  </div>
                ) : isBestMatch ? (
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold px-4 py-1.5 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Best Match — Highest Score
                  </div>
                ) : null}

                <div className="p-6 flex flex-col flex-1">
                  {/* Contractor identity */}
                  <div className="flex items-start gap-3 mb-5">
                    <div className="relative flex-shrink-0">
                      <img
                        src={avatarUrl(c?.full_name, c?.avatar_url)}
                        alt={c?.full_name}
                        className="w-14 h-14 rounded-full object-cover shadow"
                      />
                      {c?.license_verified && c?.license_status === 'approved' && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                          <Shield className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">
                        {c?.full_name ?? 'Contractor'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {c?.company_name || c?.specialties?.[0] || 'General Contractor'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {c?.license_verified && c?.license_status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Shield className="w-3 h-3" />
                            Licensed
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                      {/* Stars */}
                      <div className="flex items-center mt-1.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="text-xs text-gray-500 ml-1">
                          {c?.rating?.toFixed(1) ?? '5.0'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Match score (compact ring + top 2 highlights) */}
                  <div className="mb-5">
                    <MatchScoreDisplay
                      breakdown={bid.breakdown}
                      size="compact"
                      animationDelay={index * 150}
                    />
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <div className="bg-purple-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Award className="w-3.5 h-3.5 text-purple-600" />
                        <p className="text-xs text-purple-700 font-medium">Experience</p>
                      </div>
                      <p className="text-base font-bold text-purple-900">
                        {c?.years_experience ?? '?'} yrs
                      </p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Calendar className="w-3.5 h-3.5 text-orange-600" />
                        <p className="text-xs text-orange-700 font-medium">Timeline</p>
                      </div>
                      <p className="text-sm font-bold text-orange-900">
                        {estimatedTime(bid)}
                      </p>
                    </div>
                  </div>

                  {/* Specialties */}
                  {c?.specialties && c.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {c.specialties.slice(0, 3).map((s) => {
                        const projectTypes = (project?.work_types ?? []).map(w => w.toLowerCase());
                        const isMatch = projectTypes.some(t =>
                          s.toLowerCase().includes(t) || t.includes(s.toLowerCase())
                        );
                        return (
                          <span
                            key={s}
                            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                              isMatch
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            {isMatch && '✓ '}{s}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Bid amount */}
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    <p className="text-xs text-gray-500 mb-0.5">Bid Amount</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                      ${bid.total_price.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {bid.milestones.length} milestone{bid.milestones.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto space-y-2">
                    <button
                      onClick={() => setSelectedBid(bid)}
                      className="w-full px-4 py-2.5 text-sm text-blue-600 font-semibold border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      View Full Profile & Score
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {!isAccepted && !isRejected && (
                      <button
                        onClick={() => navigate(`/accept-offer/${projectId}/${bid.id}`)}
                        className={`w-full px-4 py-3 font-bold rounded-lg transition-all shadow hover:shadow-md ${
                          isBestMatch
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                            : 'bg-gray-900 hover:bg-gray-800 text-white'
                        }`}
                      >
                        Accept Offer
                      </button>
                    )}
                    {isActive && (
                      <div className="w-full px-4 py-3 text-center bg-green-50 border-2 border-green-200 text-green-700 font-bold rounded-lg">
                        ✓ Project Active
                      </div>
                    )}
                    {isAwaitingDeposit && (
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg transition-all"
                      >
                        Pay First Milestone →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Profile + full score modal */}
      {selectedBid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">Contractor Profile & Match Score</h2>
              <button
                onClick={() => setSelectedBid(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Identity */}
              <div className="flex items-start gap-5">
                <img
                  src={avatarUrl(selectedBid.contractor?.full_name, selectedBid.contractor?.avatar_url)}
                  alt={selectedBid.contractor?.full_name}
                  className="w-20 h-20 rounded-full object-cover shadow"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedBid.contractor?.full_name}</h3>
                  <p className="text-gray-600 mb-2">
                    {selectedBid.contractor?.company_name || 'Independent Contractor'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {selectedBid.contractor?.license_verified && selectedBid.contractor?.license_status === 'approved' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        <Shield className="w-3.5 h-3.5" />
                        Licensed
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Verified
                    </span>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      <span className="text-sm text-gray-500 ml-1">
                        ({selectedBid.contractor?.rating?.toFixed(1) ?? '5.0'})
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {selectedBid.contractor?.years_experience ?? 0}+ years of experience
                  </p>
                </div>
              </div>

              {/* Full match score breakdown */}
              <MatchScoreDisplay
                breakdown={selectedBid.breakdown}
                size="full"
                animationDelay={100}
              />

              {/* About */}
              {selectedBid.contractor?.bio && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">About</h4>
                  <p className="text-sm text-gray-700">{selectedBid.contractor.bio}</p>
                </div>
              )}

              {/* Specialties */}
              {(selectedBid.contractor?.specialties?.length ?? 0) > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Specialties</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedBid.contractor!.specialties.map((s, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bid details */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">Bid Details</h4>
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600">Total Bid Amount</span>
                    <span className="text-2xl font-bold text-gray-900">
                      ${selectedBid.total_price.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {selectedBid.milestones.length} milestone{selectedBid.milestones.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-2">
                  {selectedBid.milestones.map((m, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Milestone {i + 1}</p>
                        <p className="text-xs text-gray-500">{m.description}</p>
                        {m.duration && (
                          <p className="text-xs text-gray-400 mt-0.5">{m.duration} days</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-gray-900 ml-4 whitespace-nowrap">
                        ${m.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message */}
              {selectedBid.message && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Message from Contractor</h4>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-gray-700">{selectedBid.message}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate(`/accept-offer/${projectId}/${selectedBid.id}`)}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
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
