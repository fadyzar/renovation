import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Eye, Users, Wrench, DollarSign, Clock, MapPin, Search,
  UserPlus, X, CheckCircle2, AlertTriangle, MessageCircle, Loader2,
  ChevronDown, ChevronRight, RotateCcw, Settings2, Calendar,
  Plus, Trash2, Receipt, Pencil, Wand2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsapp } from '../../lib/whatsapp';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Milestone { description?: string; price?: number }
interface Bid {
  id: string;
  contractor_id: string;
  contractor_name?: string;
  total_price: number;
  status: string;
  message?: string;
  milestones?: Milestone[];
  created_at: string;
  responded_at?: string;
}
interface Project {
  id: string;
  title: string;
  status: string;
  city?: string;
  work_types?: string[];
  budget_min?: number;
  budget_max?: number;
  created_at: string;
  owner: { id: string; full_name: string; phone?: string; email?: string } | null;
  contractor: { id: string; full_name: string; phone?: string } | null;
  agreed_amount: number | null;
  agreed_milestones?: Milestone[];
  bids: Bid[];
}
interface ContractorOpt { id: string; full_name: string; phone?: string }

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:            { label: 'Draft',            color: 'text-gray-400',    bg: 'bg-gray-800'      },
  seeking_quotes:   { label: 'Seeking Quotes',   color: 'text-blue-300',    bg: 'bg-blue-900/40'   },
  awaiting_deposit: { label: 'Awaiting Payment', color: 'text-amber-300',   bg: 'bg-amber-900/40'  },
  in_progress:      { label: 'In Progress',      color: 'text-green-300',   bg: 'bg-green-900/40'  },
  completed:        { label: 'Completed',        color: 'text-emerald-400', bg: 'bg-emerald-900/30'},
  cancelled:        { label: 'Cancelled',        color: 'text-red-400',     bg: 'bg-red-900/30'    },
  disputed:         { label: 'Disputed',         color: 'text-red-300',     bg: 'bg-red-900/40'    },
};
const ALL_STATUSES = Object.keys(STATUS_CFG);
const BID_CFG: Record<string, { label: string; cls: string }> = {
  sent:      { label: 'Sent',      cls: 'bg-gray-700 text-gray-300' },
  submitted: { label: 'Submitted', cls: 'bg-gray-700 text-gray-300' },
  viewed:    { label: 'Viewed',    cls: 'bg-blue-900/40 text-blue-300' },
  accepted:  { label: 'Accepted',  cls: 'bg-emerald-900/40 text-emerald-300' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-900/30 text-red-400' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function callFn(name: string, body: unknown) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Payment schedule editor ────────────────────────────────────────────────
interface SchedRow { description: string; amount: string }

function milestonesToRows(ms?: Milestone[]): SchedRow[] {
  if (!ms?.length) return [{ description: 'Payment 1', amount: '' }];
  return ms.map((m, i) => ({
    description: m.description || `Payment ${i + 1}`,
    amount: m.price != null ? String(m.price) : '',
  }));
}
function rowsToMilestones(rows: SchedRow[]): Milestone[] {
  return rows
    .map((r, i) => ({
      description: r.description.trim() || `Payment ${i + 1}`,
      price: Math.round((parseFloat(r.amount) || 0) * 100) / 100,
    }))
    .filter(m => m.price > 0);
}
function rowsTotal(rows: SchedRow[]) {
  return rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
}

/** Big, plain-language editor: choose how many payments and how much each. */
function PaymentScheduleEditor({ rows, setRows }: { rows: SchedRow[]; setRows: (r: SchedRow[]) => void }) {
  const [quickTotal, setQuickTotal] = useState('');
  const total = rowsTotal(rows);

  function generate(count: number) {
    const n = Math.max(1, count);
    const t = parseFloat(quickTotal) || 0;
    if (t <= 0) {
      setRows(Array.from({ length: n }, (_, i) => ({ description: `Payment ${i + 1}`, amount: '' })));
      return;
    }
    const base = Math.floor((t / n) * 100) / 100;
    setRows(Array.from({ length: n }, (_, i) => ({
      description: `Payment ${i + 1}`,
      amount: String(i === n - 1 ? Math.round((t - base * (n - 1)) * 100) / 100 : base),
    })));
  }
  function update(i: number, field: keyof SchedRow, val: string) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  function addRow() {
    setRows([...rows, { description: `Payment ${rows.length + 1}`, amount: '' }]);
  }
  function removeRow(i: number) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {/* Quick setup — total + how many payments */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-blue-400" /> Quick setup — split a total evenly
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="number" min="0" value={quickTotal} onChange={e => setQuickTotal(e.target.value)}
              placeholder="Total amount"
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map(n => (
              <button key={n} type="button" onClick={() => generate(n)} title={`Split into ${n} payment${n > 1 ? 's' : ''}`}
                className="w-9 h-9 rounded-lg bg-gray-900 border border-gray-700 text-sm font-semibold text-gray-200 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-colors">
                {n}
              </button>
            ))}
            <span className="text-[11px] text-gray-500 ml-1">payments</span>
          </div>
        </div>
      </div>

      {/* Editable rows */}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-900/40 text-blue-300 text-xs font-bold">{i + 1}</span>
            <input value={r.description} onChange={e => update(i, 'description', e.target.value)}
              placeholder={`Payment ${i + 1}`}
              className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <div className="relative w-28 flex-shrink-0">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input type="number" min="0" value={r.amount} onChange={e => update(i, 'amount', e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-2 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1}
              title="Remove payment"
              className="p-2 text-gray-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-300 hover:text-blue-200 font-semibold">
          <Plus className="w-4 h-4" /> Add payment
        </button>
        <div className="text-sm">
          <span className="text-gray-500">Total: </span>
          <span className="font-bold text-emerald-300">${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span className="text-gray-500"> · {rows.length} payment{rows.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Manual assignment modal ────────────────────────────────────────────────
function AssignModal({
  projects, contractors, presetProjectId, onClose, onDone,
}: {
  projects: Project[]; contractors: ContractorOpt[]; presetProjectId?: string;
  onClose: () => void; onDone: () => void;
}) {
  const [projectId, setProjectId] = useState(presetProjectId ?? '');
  const [contractorId, setContractorId] = useState('');
  const [rows, setRows] = useState<SchedRow[]>([{ description: 'Payment 1', amount: '' }]);
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    setError(null); setSuccess(null);
    const milestones = rowsToMilestones(rows);
    const price = milestones.reduce((s, m) => s + (m.price ?? 0), 0);
    if (!projectId || !contractorId) {
      setError('Select a project and a contractor.'); return;
    }
    if (!milestones.length || price <= 0) {
      setError('Add at least one payment with a positive amount.'); return;
    }
    setSubmitting(true);
    try {
      const data = await callFn('admin-assign-project', { projectId, contractorId, amount: price, milestones });
      if (notify && data.contractor?.phone) {
        try { await whatsapp.projectAssigned(data.contractor.phone, data.project.title, data.amount); }
        catch { /* non-blocking */ }
      }
      setSuccess(
        `Assigned "${data.project.title}" to ${data.contractor.full_name} for $${data.amount.toLocaleString()} ` +
        `across ${milestones.length} payment${milestones.length !== 1 ? 's' : ''}.` +
        (notify ? (data.contractor?.phone ? ' WhatsApp sent.' : ' (No phone — WhatsApp skipped.)') : '')
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
          <div className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-base">Manual Assignment</h3></div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-400 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            Admin override — assigns the contractor directly, rejects other bids, and moves the project to “Awaiting Payment”.
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Project</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Select a project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title} — {p.owner?.full_name ?? '—'} ({p.status})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contractor</label>
            <select value={contractorId} onChange={e => setContractorId(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Select a contractor…</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Payment schedule — how many payments & how much each
            </label>
            <div className="mt-2">
              <PaymentScheduleEditor rows={rows} setRows={setRows} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500" />
            <MessageCircle className="w-4 h-4 text-green-400" />Notify contractor on WhatsApp
          </label>
          {error && <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}
          {success && <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}</div>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white">{success ? 'Close' : 'Cancel'}</button>
          {!success && (
            <button onClick={submit} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Assign Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit payment schedule (assigned projects) ──────────────────────────────
function EditScheduleModal({
  project, onClose, onDone,
}: {
  project: Project; onClose: () => void; onDone: () => void;
}) {
  const [rows, setRows] = useState<SchedRow[]>(milestonesToRows(project.agreed_milestones));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    setError(null); setSuccess(null);
    const milestones = rowsToMilestones(rows);
    if (!milestones.length) { setError('Add at least one payment with a positive amount.'); return; }
    setSubmitting(true);
    try {
      const data = await callFn('admin-project-action', { action: 'set_schedule', projectId: project.id, milestones });
      setSuccess(`Schedule saved: ${milestones.length} payment${milestones.length !== 1 ? 's' : ''}, $${Number(data.total).toLocaleString()} total. The contractor was notified.`);
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
          <div className="flex items-center gap-2"><Receipt className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-base">Payment Schedule</h3></div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="text-xs text-gray-400">
            <span className="text-gray-300 font-semibold">{project.title}</span>
            {project.contractor && <> · assigned to <span className="text-green-400">{project.contractor.full_name}</span></>}
          </div>
          <PaymentScheduleEditor rows={rows} setRows={setRows} />
          <p className="text-[11px] text-gray-500 bg-gray-800/60 border border-gray-700/60 rounded-lg px-3 py-2">
            Changes apply to the owner's payment plan. If the owner has already paid the first
            payment, only the not-yet-paid payments are affected.
          </p>
          {error && <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}
          {success && <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}</div>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white">{success ? 'Close' : 'Cancel'}</button>
          {!success && (
            <button onClick={submit} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Save Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Schedule summary (read-only, inside expanded row) ──────────────────────
function ScheduleSummary({ milestones }: { milestones?: Milestone[] }) {
  if (!milestones?.length) {
    return <p className="text-xs text-gray-500 py-1">No payment schedule set yet.</p>;
  }
  const total = milestones.reduce((s, m) => s + (m.price ?? 0), 0);
  return (
    <div className="space-y-1 py-1">
      {milestones.map((m, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-xs bg-gray-800/60 rounded-lg px-3 py-1.5">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-900/40 text-blue-300 text-[10px] font-bold flex-shrink-0">{i + 1}</span>
            <span className="text-gray-200 truncate">{m.description || `Payment ${i + 1}`}</span>
          </span>
          <span className="font-semibold text-emerald-300 flex-shrink-0">${Number(m.price ?? 0).toLocaleString()}</span>
        </div>
      ))}
      <div className="flex items-center justify-between text-xs px-3 pt-1">
        <span className="text-gray-500">{milestones.length} payment{milestones.length !== 1 ? 's' : ''}</span>
        <span className="text-gray-400">Total <span className="font-bold text-emerald-300">${total.toLocaleString()}</span></span>
      </div>
    </div>
  );
}

// ─── Bid history (expandable) ───────────────────────────────────────────────
function BidHistory({ bids }: { bids: Bid[] }) {
  if (!bids.length) return <p className="text-xs text-gray-500 py-2">No bids submitted on this project.</p>;
  return (
    <div className="space-y-1.5 py-1">
      {bids.map(b => {
        const cfg = BID_CFG[b.status] ?? { label: b.status, cls: 'bg-gray-700 text-gray-300' };
        return (
          <div key={b.id} className="flex items-center justify-between gap-3 text-xs bg-gray-800/60 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Wrench className="w-3 h-3 text-gray-500 flex-shrink-0" />
              <span className="text-gray-200 truncate">{b.contractor_name ?? 'Contractor'}</span>
              <span className={`px-1.5 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-gray-400">
              <span className="font-semibold text-emerald-300">${Number(b.total_price).toLocaleString()}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(b.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main control center ────────────────────────────────────────────────────
type Tab = 'assigned' | 'all' | 'unassigned';

export function AdminAssignedProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<ContractorOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('assigned');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ open: boolean; presetProjectId?: string }>({ open: false });
  const [editSched, setEditSched] = useState<Project | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await callFn('admin-data', {});
      setProjects(data.projects ?? []);
      setContractors(data.contractors ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function unassign(p: Project) {
    if (!confirm(`Remove ${p.contractor?.full_name ?? 'the contractor'} from "${p.title}" and reopen it for bids?`)) return;
    setBusyId(p.id);
    try { await callFn('admin-project-action', { action: 'unassign', projectId: p.id }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  }
  async function setStatus(p: Project, status: string) {
    if (status === p.status) return;
    setBusyId(p.id);
    try { await callFn('admin-project-action', { action: 'set_status', projectId: p.id, status }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  }

  const assigned = projects.filter(p => p.contractor);
  const totalValue = assigned.reduce((s, p) => s + (p.agreed_amount ?? 0), 0);

  const tabbed = projects.filter(p =>
    tab === 'assigned' ? !!p.contractor :
    tab === 'unassigned' ? !p.contractor : true);

  const filtered = tabbed.filter(p => {
    const s = search.toLowerCase().trim();
    return !s || p.title.toLowerCase().includes(s)
      || (p.owner?.full_name ?? '').toLowerCase().includes(s)
      || (p.contractor?.full_name ?? '').toLowerCase().includes(s)
      || (p.city ?? '').toLowerCase().includes(s);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Projects — Full Control</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {assigned.length} assigned · ${totalValue.toLocaleString()} total value · {projects.length} projects total
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAssign({ open: true })}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Manual Assign
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/40 rounded-2xl px-5 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-800">
          <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
            {([['assigned', `Assigned (${assigned.length})`], ['unassigned', `Unassigned (${projects.length - assigned.length})`], ['all', `All (${projects.length})`]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t as Tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No projects match this filter.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtered.map(p => {
              const cfg = STATUS_CFG[p.status] ?? { label: p.status, color: 'text-gray-400', bg: 'bg-gray-800' };
              const isOpen = expanded === p.id;
              const busy = busyId === p.id;
              return (
                <div key={p.id} className="px-5 py-4 hover:bg-gray-800/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setExpanded(isOpen ? null : p.id)} className="mt-0.5 text-gray-500 hover:text-white flex-shrink-0">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-white truncate max-w-xs">{p.title}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {p.agreed_amount != null && (
                          <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                            <DollarSign className="w-3 h-3" />{p.agreed_amount.toLocaleString()}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{p.bids.length} bid{p.bids.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1" title="Opened by">
                          <Users className="w-3 h-3" />{p.owner?.full_name ?? '—'} · {fmtDate(p.created_at)}
                        </span>
                        <span className={`flex items-center gap-1 ${p.contractor ? 'text-green-400' : 'text-gray-600'}`} title="Assigned to">
                          <Wrench className="w-3 h-3" />{p.contractor?.full_name ?? 'Unassigned'}
                        </span>
                        {p.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(p.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                      {busy && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                      <div className="relative">
                        <select value={p.status} disabled={busy} onChange={e => setStatus(p, e.target.value)}
                          title="Change status"
                          className="appearance-none pl-7 pr-6 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50">
                          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                        </select>
                        <Settings2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                      </div>
                      {p.contractor ? (
                        <>
                          <button onClick={() => setEditSched(p)} disabled={busy} title="Edit payment schedule"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-600/30 disabled:opacity-50">
                            <Receipt className="w-3.5 h-3.5" />Schedule
                          </button>
                          <button onClick={() => unassign(p)} disabled={busy} title="Un-assign / restore to bidding"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 text-xs font-semibold rounded-lg border border-amber-600/30 disabled:opacity-50">
                            <RotateCcw className="w-3.5 h-3.5" />Un-assign
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setAssign({ open: true, presetProjectId: p.id })} disabled={busy} title="Assign a contractor"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-semibold rounded-lg border border-blue-600/30 disabled:opacity-50">
                          <UserPlus className="w-3.5 h-3.5" />Assign
                        </button>
                      )}
                      <button onClick={() => navigate(`/project/${p.id}/payments`)} title="Open project"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700">
                        <Eye className="w-3.5 h-3.5" />View
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 ml-7 border-l-2 border-gray-800 pl-4">
                      {p.contractor && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                              <Receipt className="w-3 h-3" />Payment schedule
                            </p>
                            <button onClick={() => setEditSched(p)}
                              className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 font-semibold">
                              <Pencil className="w-3 h-3" />Edit
                            </button>
                          </div>
                          <ScheduleSummary milestones={p.agreed_milestones} />
                        </div>
                      )}
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Bid history</p>
                      <BidHistory bids={p.bids} />
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-500">
                        {p.owner?.phone && <span>Owner: <a href={`tel:${p.owner.phone}`} className="text-blue-400">{p.owner.phone}</a></span>}
                        {p.owner?.email && <span>{p.owner.email}</span>}
                        {p.contractor?.phone && <span>Contractor: <a href={`tel:${p.contractor.phone}`} className="text-green-400">{p.contractor.phone}</a></span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {assign.open && (
        <AssignModal
          projects={projects}
          contractors={contractors}
          presetProjectId={assign.presetProjectId}
          onClose={() => setAssign({ open: false })}
          onDone={load}
        />
      )}

      {editSched && (
        <EditScheduleModal
          project={editSched}
          onClose={() => setEditSched(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
