import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, AlertTriangle, RefreshCw, Eye,
  Users, Briefcase, DollarSign, Wrench, Phone, Mail,
  X, MapPin, Clock, Ruler, Layers, FileText, Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProjectRow {
  id: string; title: string; status: string;
  budget_min: number; created_at: string; city?: string;
  owner: { full_name: string; phone?: string; email?: string } | null;
  contractor: { full_name: string; phone?: string } | null;
  bid_count: number;
}

interface ProjectDetail extends ProjectRow {
  description?: string;
  budget_max?: number;
  address?: string;
  state?: string;
  zip_code?: string;
  work_types?: string[];
  timeline?: string;
  timeline_weeks?: number;
  room_length?: number;
  room_width?: number;
  room_dimensions?: string;
  finish_level?: string;
  apartment_unit?: string;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  seeking_quotes:   { label: 'Seeking Quotes',   color: 'text-blue-300',   bg: 'bg-blue-900/40'   },
  awaiting_deposit: { label: 'Awaiting Payment', color: 'text-amber-300',  bg: 'bg-amber-900/40'  },
  in_progress:      { label: 'In Progress',       color: 'text-green-300',  bg: 'bg-green-900/40'  },
  completed:        { label: 'Completed',         color: 'text-gray-400',   bg: 'bg-gray-800'      },
  cancelled:        { label: 'Cancelled',         color: 'text-red-400',    bg: 'bg-red-900/30'    },
};

function hoursAgo(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000); }
function timeAgo(d: string) {
  const h = hoursAgo(d);
  if (h < 1)   return 'just now';
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function DetailModal({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const cfg = STATUS_CFG[project.status] ?? { label: project.status, color: 'text-gray-400', bg: 'bg-gray-800' };
  const hrs = hoursAgo(project.created_at);
  const isTimeout = project.status === 'seeking_quotes' && hrs >= 72;

  const address = [
    project.address,
    project.apartment_unit ? `Unit ${project.apartment_unit}` : null,
    project.city,
    project.state,
    project.zip_code,
  ].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-white font-bold text-base truncate">{project.title}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              {isTimeout && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 flex items-center gap-1 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3" />{hrs}h open
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs">Created {new Date(project.created_at).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Owner contact — most important for admin */}
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Owner Contact</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-white font-semibold text-sm">{project.owner?.full_name ?? '—'}</p>
                {project.owner?.email && <p className="text-gray-400 text-xs mt-0.5">{project.owner.email}</p>}
              </div>
              <div className="flex gap-2">
                {project.owner?.phone && (
                  <a href={`tel:${project.owner.phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    <Phone className="w-3.5 h-3.5" />Call {project.owner.phone}
                  </a>
                )}
                {project.owner?.email && (
                  <a href={`mailto:${project.owner.email}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold rounded-lg transition-colors">
                    <Mail className="w-3.5 h-3.5" />Email
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</p>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </div>
          )}

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Budget</p>
              </div>
              <p className="text-white font-bold text-lg">
                ${(project.budget_min ?? 0).toLocaleString()}
                {project.budget_max && project.budget_max !== project.budget_min
                  ? ` – $${project.budget_max.toLocaleString()}`
                  : ''}
              </p>
            </div>
            <div className="bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bids Received</p>
              </div>
              <p className={`font-bold text-lg ${project.bid_count === 0 ? 'text-red-400' : 'text-white'}`}>
                {project.bid_count} bid{project.bid_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Work Types */}
          {project.work_types && project.work_types.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Work Types</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.work_types.map(w => (
                  <span key={w} className="text-xs px-2.5 py-1 bg-blue-900/30 text-blue-300 rounded-lg border border-blue-800/40 font-medium">{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {address && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</p>
              </div>
              <p className="text-gray-300 text-sm">{address}</p>
            </div>
          )}

          {/* Timeline & Dimensions row */}
          <div className="grid grid-cols-2 gap-3">
            {(project.timeline || project.timeline_weeks) && (
              <div className="bg-gray-800/60 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Timeline</p>
                </div>
                <p className="text-gray-200 text-sm font-medium capitalize">
                  {project.timeline_weeks ? `${project.timeline_weeks} week${project.timeline_weeks !== 1 ? 's' : ''}` : project.timeline}
                </p>
              </div>
            )}
            {(project.room_length || project.room_width || project.room_dimensions) && (
              <div className="bg-gray-800/60 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Ruler className="w-3.5 h-3.5 text-orange-400" />
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Room Size</p>
                </div>
                <p className="text-gray-200 text-sm font-medium">
                  {project.room_length && project.room_width
                    ? `${project.room_length} × ${project.room_width} ft`
                    : project.room_dimensions ?? '—'}
                </p>
              </div>
            )}
          </div>

          {/* Finish level */}
          {project.finish_level && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Finish Level</span>
              <span className="text-gray-200 capitalize">{project.finish_level}</span>
            </div>
          )}

          {/* Contractor if assigned */}
          {project.contractor && (
            <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assigned Contractor</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-green-400" />
                  <span className="text-white text-sm font-medium">{project.contractor.full_name}</span>
                </div>
                {project.contractor.phone && (
                  <a href={`tel:${project.contractor.phone}`}
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300">
                    <Phone className="w-3 h-3" />{project.contractor.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState<'all' | 'timeout'>('all');
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: raw } = await supabase
      .from('projects')
      .select(`id, title, status, budget_min, created_at, city,
        owner:profiles!owner_id(full_name, phone, email),
        contractor:profiles!selected_contractor_id(full_name, phone)`)
      .order('created_at', { ascending: false });

    const { data: bids } = await supabase.from('bids').select('project_id');
    const bidMap: Record<string,number> = {};
    for (const b of bids ?? []) bidMap[b.project_id] = (bidMap[b.project_id] ?? 0) + 1;

    setProjects((raw ?? []).map(p => ({
      ...p,
      owner:      Array.isArray(p.owner)      ? p.owner[0] ?? null      : (p.owner ?? null),
      contractor: Array.isArray(p.contractor) ? p.contractor[0] ?? null : (p.contractor ?? null),
      bid_count: bidMap[p.id] ?? 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDetail(row: ProjectRow) {
    setDetailLoading(true);
    setDetail({ ...row });
    const { data } = await supabase
      .from('projects')
      .select(`description, budget_max, address, state, zip_code, work_types,
               timeline, timeline_weeks, room_length, room_width,
               room_dimensions, finish_level, apartment_unit`)
      .eq('id', row.id)
      .single();
    if (data) setDetail(prev => prev ? { ...prev, ...data } : prev);
    setDetailLoading(false);
  }

  function handleView(p: ProjectRow) {
    if (p.status === 'in_progress' || p.status === 'awaiting_deposit' || p.status === 'completed') {
      navigate(`/project/${p.id}/payments`);
    } else {
      openDetail(p);
    }
  }

  const timeout = projects.filter(p => p.status === 'seeking_quotes' && hoursAgo(p.created_at) >= 72);

  const filtered = projects.filter(p => {
    const s = search.toLowerCase();
    const matchS = !s || p.title.toLowerCase().includes(s) || (p.owner?.full_name ?? '').toLowerCase().includes(s) || (p.city ?? '').toLowerCase().includes(s);
    const matchSt = statusFilter === 'all' || p.status === statusFilter;
    const matchTab = tab === 'all' ? true : (p.status === 'seeking_quotes' && hoursAgo(p.created_at) >= 72);
    return matchS && matchSt && matchTab;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">All Projects</h2>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {timeout.length > 0 && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/40 rounded-2xl px-5 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{timeout.length} project{timeout.length > 1 ? 's' : ''} open 72h+ with no contractor</p>
          <button onClick={() => setTab('timeout')} className="ml-auto text-xs font-bold text-red-400 hover:text-red-200">View</button>
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-800">
          <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
            {(['all','timeout'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {t === 'timeout' ? `⚠️ Timeout (${timeout.length})` : `All (${projects.length})`}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
            </div>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none">
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No projects match this filter</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtered.map(p => {
              const cfg = STATUS_CFG[p.status] ?? { label: p.status, color: 'text-gray-400', bg: 'bg-gray-800' };
              const hrs = hoursAgo(p.created_at);
              const isTimeout = p.status === 'seeking_quotes' && hrs >= 72;

              return (
                <div key={p.id} className={`px-5 py-4 hover:bg-gray-800/50 transition-colors ${isTimeout ? 'border-l-2 border-red-500' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-white truncate max-w-xs">{p.title}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {isTimeout && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{hrs}h — No Bids
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.owner?.full_name ?? '—'}</span>
                        {p.contractor && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{p.contractor.full_name}</span>}
                        <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{p.bid_count} bid{p.bid_count !== 1 ? 's' : ''}</span>
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${(p.budget_min ?? 0).toLocaleString()}</span>
                        {p.city && <span>{p.city}</span>}
                        <span>{timeAgo(p.created_at)}</span>
                      </div>
                      <div className="flex gap-3 mt-1.5">
                        {p.owner?.phone && <a href={`tel:${p.owner.phone}`} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Phone className="w-3 h-3" />Owner</a>}
                        {p.contractor?.phone && <a href={`tel:${p.contractor.phone}`} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300"><Phone className="w-3 h-3" />Contractor</a>}
                        {p.owner?.email && <a href={`mailto:${p.owner.email}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"><Mail className="w-3 h-3" />Email</a>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleView(p)}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold rounded-lg transition-colors border border-blue-600/30"
                    >
                      <Eye className="w-3.5 h-3.5" />View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <DetailModal
          project={detailLoading ? detail : detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
