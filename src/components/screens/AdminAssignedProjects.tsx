import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Eye, Users, Wrench, DollarSign, Clock, MapPin,
  UserPlus, X, CheckCircle2, AlertTriangle, MessageCircle, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsapp } from '../../lib/whatsapp';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface AssignedRow {
  id: string;
  title: string;
  status: string;
  city?: string;
  created_at: string;
  owner: { full_name: string; phone?: string; email?: string } | null;
  contractor: { id: string; full_name: string; phone?: string } | null;
  agreed_amount: number | null;
}

interface ContractorOpt { id: string; full_name: string; phone?: string }
interface ProjectOpt { id: string; title: string; status: string; owner_name: string }

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_deposit: { label: 'Awaiting Payment', color: 'text-amber-300',   bg: 'bg-amber-900/40'   },
  in_progress:      { label: 'In Progress',      color: 'text-green-300',   bg: 'bg-green-900/40'   },
  completed:        { label: 'Completed',        color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
  cancelled:        { label: 'Cancelled',        color: 'text-red-400',     bg: 'bg-red-900/30'     },
  disputed:         { label: 'Disputed',         color: 'text-red-300',     bg: 'bg-red-900/40'     },
};

const STAGE: Record<string, { step: number; label: string }> = {
  awaiting_deposit: { step: 1, label: 'Waiting for deposit' },
  in_progress:      { step: 2, label: 'Work in progress' },
  completed:        { step: 3, label: 'Completed' },
};
const STAGE_LABELS = ['Assigned', 'Deposit', 'In Progress', 'Done'];

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StageBar({ status }: { status: string }) {
  const step = STAGE[status]?.step ?? 0;
  const pct = Math.round(((step + 1) / STAGE_LABELS.length) * 100);
  const color = status === 'completed' ? 'bg-emerald-500'
    : status === 'cancelled' || status === 'disputed' ? 'bg-red-500'
    : status === 'in_progress' ? 'bg-green-500' : 'bg-amber-500';
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500">{STAGE[status]?.label ?? status}</span>
        <span className="text-[10px] text-gray-500">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Manual assignment modal ────────────────────────────────────────────────
function AssignModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [contractors, setContractors] = useState<ContractorOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [amount, setAmount] = useState('');
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: projs } = await supabase
        .from('projects')
        .select('id, title, status, owner:profiles!owner_id(full_name)')
        .order('created_at', { ascending: false });
      setProjects((projs ?? []).map((p: any) => ({
        id: p.id, title: p.title, status: p.status,
        owner_name: Array.isArray(p.owner) ? p.owner[0]?.full_name ?? '—' : p.owner?.full_name ?? '—',
      })));

      const { data: cons } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'contractor')
        .order('full_name');
      setContractors(cons ?? []);
    })();
  }, []);

  async function submit() {
    setError(null); setSuccess(null);
    if (!projectId || !contractorId || !amount) { setError('Select a project, a contractor and an amount.'); return; }
    const price = Number(amount);
    if (!price || price <= 0) { setError('Amount must be a positive number.'); return; }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-assign-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, contractorId, amount: price }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Optionally notify the contractor on WhatsApp
      if (notify && data.contractor?.phone) {
        try { await whatsapp.projectAssigned(data.contractor.phone, data.project.title, data.amount); }
        catch { /* non-blocking */ }
      }
      setSuccess(
        `Assigned "${data.project.title}" to ${data.contractor.full_name} for $${data.amount.toLocaleString()}.` +
        (notify ? data.contractor?.phone ? ' WhatsApp sent.' : ' (No phone on file — WhatsApp skipped.)' : '')
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-base">Manual Assignment</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-400 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            Admin override — assigns the contractor directly and rejects any other bids. The project moves to “Awaiting Payment”.
          </p>

          {/* Project */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Select a project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title} — {p.owner_name} ({p.status})</option>
              ))}
            </select>
          </div>

          {/* Contractor */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contractor</label>
            <select value={contractorId} onChange={e => setContractorId(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Select a contractor…</option>
              {contractors.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` — ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Agreed Amount (USD)</label>
            <div className="mt-1 relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="6300"
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          {/* Notify */}
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500" />
            <MessageCircle className="w-4 h-4 text-green-400" />
            Notify contractor on WhatsApp
          </label>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white">
            {success ? 'Close' : 'Cancel'}
          </button>
          {!success && (
            <button onClick={submit} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Assign Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export function AdminAssignedProjects() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AssignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: raw } = await supabase
      .from('projects')
      .select(`id, title, status, city, created_at,
        owner:profiles!owner_id(full_name, phone, email),
        contractor:profiles!selected_contractor_id(id, full_name, phone)`)
      .not('selected_contractor_id', 'is', null)
      .order('created_at', { ascending: false });

    // Agreed amount = the accepted bid for each project
    const { data: bids } = await supabase
      .from('bids')
      .select('project_id, total_price, status')
      .eq('status', 'accepted');
    const amountMap: Record<string, number> = {};
    for (const b of bids ?? []) amountMap[b.project_id] = b.total_price;

    setRows((raw ?? []).map((p: any) => ({
      id: p.id, title: p.title, status: p.status, city: p.city, created_at: p.created_at,
      owner: Array.isArray(p.owner) ? p.owner[0] ?? null : p.owner ?? null,
      contractor: Array.isArray(p.contractor) ? p.contractor[0] ?? null : p.contractor ?? null,
      agreed_amount: amountMap[p.id] ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalValue = rows.reduce((sum, r) => sum + (r.agreed_amount ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Assigned Projects</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {rows.length} assigned · ${totalValue.toLocaleString()} total value
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Manual Assign
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No projects have been assigned yet.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {rows.map(p => {
              const cfg = STATUS_CFG[p.status] ?? { label: p.status, color: 'text-gray-400', bg: 'bg-gray-800' };
              return (
                <div key={p.id} className="px-5 py-4 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-white truncate max-w-xs">{p.title}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {p.agreed_amount != null && (
                          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                            <DollarSign className="w-3 h-3" />{p.agreed_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.owner?.full_name ?? '—'}</span>
                        <span className="flex items-center gap-1 text-green-400"><Wrench className="w-3 h-3" />{p.contractor?.full_name ?? '—'}</span>
                        {p.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(p.created_at)}</span>
                      </div>
                      <StageBar status={p.status} />
                    </div>
                    <button onClick={() => navigate(`/project/${p.id}/payments`)}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold rounded-lg transition-colors border border-blue-600/30">
                      <Eye className="w-3.5 h-3.5" />View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAssign && <AssignModal onClose={() => setShowAssign(false)} onDone={load} />}
    </div>
  );
}
