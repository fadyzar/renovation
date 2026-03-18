import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, MapPin, Navigation, AlertCircle, Clock, TrendingUp, MessageCircle, Sparkles, Star, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BidBuilder } from './BidBuilder';
import { useAuth } from '../../contexts/AuthContext';
import { LocationPermissionRequest } from '../shared/LocationPermissionRequest';
import { MatchScoreDisplay, computeContractorFit } from '../shared/MatchScoreDisplay';
import { calculateDistance, formatDistance } from '../../utils/geolocation';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
  timeline_weeks: number;
  urgency: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  search_radius_km?: number;
  distance?: number;
  properties?: {
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  owner: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
}

interface ScoredProject extends Project {
  matchScore: number;
  matchTier: 'excellent' | 'good' | 'fair' | 'low';
  matchHighlights: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_BADGE = {
  excellent: { label: 'Excellent Match', cls: 'bg-green-100 text-green-800 border border-green-200' },
  good:      { label: 'Good Match',      cls: 'bg-blue-100 text-blue-800 border border-blue-200' },
  fair:      { label: 'Fair Match',      cls: 'bg-amber-100 text-amber-800 border border-amber-200' },
  low:       { label: 'Low Match',       cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
} as const;

function isNewProject(createdAt: string) {
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 3;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectFeed() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ScoredProject | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(
    profile?.service_latitude && profile?.service_longitude
      ? { lat: profile.service_latitude, lon: profile.service_longitude }
      : null
  );
  const [distanceFilter, setDistanceFilter] = useState(profile?.service_radius_km || 50);
  const [filters, setFilters] = useState({
    renovationType: 'all',
    budgetRange: 'all',
    urgency: 'all',
    sortBy: 'match', // default: match score
    workTypes: [] as string[],
  });

  useEffect(() => {
    loadProjects();
  }, [distanceFilter, userLocation, filters.renovationType, filters.urgency]);

  async function loadProjects() {
    try {
      let query = supabase
        .from('projects')
        .select(`
          *,
          properties(address, city, state, zip_code),
          owner:profiles!projects_owner_id_fkey(id, full_name, email, phone)
        `)
        .eq('status', 'seeking_quotes');

      if (filters.renovationType !== 'all') {
        query = query.ilike('title', `%${filters.renovationType}%`);
      }
      if (filters.urgency !== 'all') {
        query = query.eq('urgency', filters.urgency);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRawProjects(data || []);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Compute match scores + apply remaining filters ─────────────────────────

  const scoredProjects = useMemo<ScoredProject[]>(() => {
    if (!rawProjects.length) return [];

    let projects = rawProjects.map(p => {
      const distanceKm =
        userLocation && p.latitude && p.longitude
          ? calculateDistance(userLocation.lat, userLocation.lon, p.latitude, p.longitude)
          : undefined;

      const bd = computeContractorFit(
        {
          license_verified: profile?.license_verified,
          license_status: profile?.license_status,
          years_experience: profile?.years_experience,
          service_latitude: profile?.service_latitude,
          service_longitude: profile?.service_longitude,
          company_name: profile?.company_name,
          bio: profile?.bio,
          specialties: profile?.specialties,
        },
        { budget_min: p.budget_min, budget_max: p.budget_max, work_types: p.work_types },
        distanceKm
      );

      return {
        ...p,
        distance: distanceKm,
        matchScore: bd.score,
        matchTier: bd.tier,
        matchHighlights: bd.highlights,
      } as ScoredProject;
    });

    // Distance filter
    if (userLocation) {
      projects = projects.filter(p => {
        if (!p.latitude || !p.longitude || p.distance === undefined) return true;
        const withinContractor = p.distance <= distanceFilter;
        const withinProject = !p.search_radius_km || p.distance <= p.search_radius_km;
        return withinContractor && withinProject;
      });
    }

    // Budget filter
    if (filters.budgetRange !== 'all') {
      projects = projects.filter(p => {
        const avg = (p.budget_min + p.budget_max) / 2;
        if (filters.budgetRange === 'low') return avg < 25000;
        if (filters.budgetRange === 'medium') return avg >= 25000 && avg <= 75000;
        if (filters.budgetRange === 'high') return avg > 75000;
        return true;
      });
    }

    // Work type filter
    if (filters.workTypes.length > 0) {
      projects = projects.filter(p =>
        p.work_types?.some(t => filters.workTypes.includes(t))
      );
    }

    // Sort
    const urgencyOrder: Record<string, number> = { urgent: 0, moderate: 1, flexible: 2 };
    switch (filters.sortBy) {
      case 'match':
        projects.sort((a, b) => b.matchScore - a.matchScore);
        break;
      case 'distance':
        projects.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
        break;
      case 'urgent':
        projects.sort(
          (a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3)
        );
        break;
      case 'newest':
        projects.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'budget_high':
        projects.sort((a, b) => b.budget_max - a.budget_max);
        break;
      case 'budget_low':
        projects.sort((a, b) => a.budget_min - b.budget_min);
        break;
    }

    return projects;
  }, [rawProjects, userLocation, distanceFilter, filters, profile]);

  // ── Sections ───────────────────────────────────────────────────────────────

  const bestMatches = scoredProjects.filter(p => p.matchScore >= 70).slice(0, 5);
  const nearbyProjects = userLocation
    ? scoredProjects.filter(p => p.distance !== undefined && p.distance <= 20).slice(0, 5)
    : [];
  const newProjects = scoredProjects.filter(p => isNewProject(p.created_at)).slice(0, 5);
  const hasSections = bestMatches.length > 0 || nearbyProjects.length > 0 || newProjects.length > 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleContactOwner(project: ScoredProject) {
    if (!profile?.id) return;
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', project.id)
        .eq('contractor_id', profile.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('conversations').insert({
          project_id: project.id,
          contractor_id: profile.id,
          owner_id: project.owner.id,
        });
      }
      navigate('/messages');
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  }

  async function handleLocationGranted(lat: number, lon: number) {
    setUserLocation({ lat, lon });
    if (profile?.id) {
      await supabase
        .from('profiles')
        .update({ service_latitude: lat, service_longitude: lon, location_enabled: true })
        .eq('id', profile.id);
    }
    setShowLocationModal(false);
  }

  // ── Card render ─────────────────────────────────────────────────────────────

  function ProjectCard({
    project,
    rank,
    showMatchScore = true,
  }: {
    project: ScoredProject;
    rank?: number;
    showMatchScore?: boolean;
  }) {
    const tierBadge = TIER_BADGE[project.matchTier];
    const isExpanded = expandedProjectId === project.id;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200 hover:border-blue-200">
        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xl font-bold shadow">
              {project.title.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900 leading-snug">{project.title}</h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isNewProject(project.created_at) && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200 whitespace-nowrap">
                      New
                    </span>
                  )}
                  {project.urgency === 'urgent' && (
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                      <AlertCircle className="w-3 h-3" />
                      Urgent
                    </span>
                  )}
                  {project.urgency === 'moderate' && (
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                      <Clock className="w-3 h-3" />
                      Moderate
                    </span>
                  )}
                </div>
              </div>

              {/* Distance + Budget chips */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {project.distance !== undefined && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    <Navigation className="w-3 h-3" />
                    {formatDistance(project.distance)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <TrendingUp className="w-3 h-3" />
                  ${project.budget_min.toLocaleString()} – ${project.budget_max.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">
            {project.description}
          </p>

          {/* Work types */}
          {project.work_types?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {project.work_types.slice(0, 5).map((t, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                  {t}
                </span>
              ))}
              {project.work_types.length > 5 && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                  +{project.work_types.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {project.properties?.city && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              {[project.properties.address, project.properties.city, project.properties.state]
                .filter(Boolean)
                .join(', ')}
            </div>
          )}

          {/* ── Match Score ──────────────────────────────────────────────── */}
          {showMatchScore && (
            <div className="border-t border-gray-100 pt-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Your Match Score
                </p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierBadge.cls}`}>
                  {tierBadge.label}
                </span>
              </div>
              <MatchScoreDisplay
                breakdown={{
                  score: project.matchScore,
                  tier: project.matchTier,
                  factors: [],
                  highlights: project.matchHighlights,
                }}
                size="compact"
              />
              {project.matchTier === 'low' && (
                <p className="text-xs text-gray-400 mt-2 italic">
                  Lower fit — you can still submit a bid. The owner reviews all proposals.
                </p>
              )}
            </div>
          )}

          {/* ── Expandable details ──────────────────────────────────────── */}
          <button
            onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mb-3"
          >
            {isExpanded ? 'Less details' : 'View details'}
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>

          {isExpanded && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Owner</span>
                <span className="font-medium">{project.owner.full_name}</span>
              </div>
              {project.timeline_weeks && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Timeline</span>
                  <span className="font-medium">{project.timeline_weeks} weeks</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Posted</span>
                <span className="font-medium">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
              {project.distance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance</span>
                  <span className="font-medium">{formatDistance(project.distance)}</span>
                </div>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-2">
            <button
              onClick={() => handleContactOwner(project)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
            <button
              onClick={() => setSelectedProject(project)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all shadow hover:shadow-md text-sm"
            >
              Submit Bid
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Section strip (horizontal scroll for highlights) ───────────────────────

  function SectionStrip({
    title,
    icon,
    projects,
  }: {
    title: string;
    icon: React.ReactNode;
    projects: ScoredProject[];
  }) {
    if (!projects.length) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {projects.length}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} showMatchScore />
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-gray-900 text-white py-6 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Available Projects</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Each project is scored against your profile — match ≠ selection. You can always bid.
            </p>
          </div>
          {scoredProjects.length > 0 && (
            <span className="text-gray-400 text-sm">
              {scoredProjects.length} project{scoredProjects.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

        {/* Location prompt */}
        {!userLocation && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-0.5">Enable Location for Better Matching</h3>
                <p className="text-sm text-gray-600">
                  See your distance to each project and get a more accurate match score.
                </p>
              </div>
              <button
                onClick={() => setShowLocationModal(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
              >
                Enable Location
              </button>
            </div>
          </div>
        )}

        {/* Distance filter */}
        {userLocation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-gray-900 text-sm">
                  Showing projects within {distanceFilter}km
                </span>
              </div>
              <span className="text-blue-600 font-bold text-sm">{scoredProjects.length} results</span>
            </div>
            <input
              type="range" min="5" max="200" step="5"
              value={distanceFilter}
              onChange={e => setDistanceFilter(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(distanceFilter / 200) * 100}%, #DBEAFE ${(distanceFilter / 200) * 100}%, #DBEAFE 100%)`,
              }}
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Filters &amp; Sort</h3>
            <button
              onClick={() =>
                setFilters({ renovationType: 'all', budgetRange: 'all', urgency: 'all', sortBy: 'match', workTypes: [] })
              }
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              {
                label: 'Sort By',
                value: filters.sortBy,
                onChange: (v: string) => setFilters(f => ({ ...f, sortBy: v })),
                options: [
                  { value: 'match', label: 'Best Match' },
                  { value: 'distance', label: 'Nearest First' },
                  { value: 'newest', label: 'Newest' },
                  { value: 'urgent', label: 'Most Urgent' },
                  { value: 'budget_high', label: 'Highest Budget' },
                  { value: 'budget_low', label: 'Lowest Budget' },
                ],
              },
              {
                label: 'Budget Range',
                value: filters.budgetRange,
                onChange: (v: string) => setFilters(f => ({ ...f, budgetRange: v })),
                options: [
                  { value: 'all', label: 'Any Budget' },
                  { value: 'low', label: 'Under $25k' },
                  { value: 'medium', label: '$25k–$75k' },
                  { value: 'high', label: 'Over $75k' },
                ],
              },
              {
                label: 'Urgency',
                value: filters.urgency,
                onChange: (v: string) => setFilters(f => ({ ...f, urgency: v })),
                options: [
                  { value: 'all', label: 'Any Urgency' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'flexible', label: 'Flexible' },
                ],
              },
              {
                label: 'Project Type',
                value: filters.renovationType,
                onChange: (v: string) => setFilters(f => ({ ...f, renovationType: v })),
                options: [
                  { value: 'all', label: 'All Types' },
                  { value: 'kitchen', label: 'Kitchen' },
                  { value: 'bathroom', label: 'Bathroom' },
                  { value: 'basement', label: 'Basement' },
                  { value: 'roof', label: 'Roof' },
                  { value: 'flooring', label: 'Flooring' },
                  { value: 'painting', label: 'Painting' },
                ],
              },
            ].map(({ label, value, onChange, options }) => (
              <div key={label} className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                <select
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="w-full px-3 py-2.5 pr-8 bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
                >
                  {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 bottom-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {['Demolition', 'Electrical', 'Plumbing', 'Carpentry', 'Painting', 'Flooring', 'HVAC', 'Drywall'].map(type => {
              const val = type.toLowerCase();
              const active = filters.workTypes.includes(val);
              return (
                <button
                  key={val}
                  onClick={() =>
                    setFilters(f => ({
                      ...f,
                      workTypes: active ? f.workTypes.filter(t => t !== val) : [...f.workTypes, val],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Scoring projects for you…</p>
          </div>
        ) : scoredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500 text-sm">
              {distanceFilter < 50
                ? 'Try increasing your distance filter'
                : 'Check back soon for new opportunities'}
            </p>
          </div>
        ) : filters.sortBy === 'match' && hasSections ? (
          // ── Smart sections when sorted by match ──────────────────────────
          <>
            <SectionStrip
              title="Best Matches for You"
              icon={<Sparkles className="w-5 h-5 text-orange-500" />}
              projects={bestMatches}
            />
            {nearbyProjects.length > 0 && (
              <SectionStrip
                title="Nearby Projects"
                icon={<Navigation className="w-5 h-5 text-green-600" />}
                projects={nearbyProjects}
              />
            )}
            {newProjects.length > 0 && (
              <SectionStrip
                title="New This Week"
                icon={<Star className="w-5 h-5 text-purple-500" />}
                projects={newProjects}
              />
            )}
            {scoredProjects.filter(p => p.matchScore < 70).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">All Open Projects</h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {scoredProjects.length}
                  </span>
                  <span className="text-xs text-gray-400">— match score is a guide, not a gate</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scoredProjects.map(p => (
                    <ProjectCard key={p.id} project={p} showMatchScore />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          // ── Flat list for other sort modes ────────────────────────────────
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scoredProjects.map(p => (
              <ProjectCard key={p.id} project={p} showMatchScore />
            ))}
          </div>
        )}
      </div>

      {/* Bid modal */}
      {selectedProject && (
        <BidBuilder
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={() => {
            setSelectedProject(null);
            loadProjects();
          }}
        />
      )}

      {/* Location modal */}
      {showLocationModal && (
        <LocationPermissionRequest
          onLocationGranted={handleLocationGranted}
          onClose={() => setShowLocationModal(false)}
          title="Enable Location for Project Discovery"
          description="See exact distances and get a more accurate match score for each project."
        />
      )}
    </div>
  );
}
