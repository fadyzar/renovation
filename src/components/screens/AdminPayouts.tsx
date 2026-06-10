import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Landmark, AlertTriangle, Loader2, CheckCircle2, Copy, Check,
  DollarSign, Wrench, Building2, Hash, CreditCard, Shield, Clock, Undo2, Banknote,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Bank {
  full_name: string; bank_name: string; account_number: string; routing_number: string;
  account_type: string; email?: string; phone?: string; tax_id_type: string; tax_id_value: string;
}
interface Row {
  id: string;
  project_id: string;
  project_title: string;
  contractor_id: string;
  contractor_name: string;
  contractor_phone?: string | null;
  gross: number;
  platform_fee: number;
  net: number;
  status: string;
  payout_status: 'paid' | 'unpaid';
  payout_at?: string | null;
  created_at: string;
  bank: Bank | null;
}
interface Summary { total_net: number; total_fees: number; unpaid_net: number; unpaid_count: number; count: number }

async function callFn(body: unknown) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-payouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function fmt(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
function mask(acct: string) { return acct.length > 4 ? '•••• ' + acct.slice(-4) : acct; }

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      title="Copy" className="text-gray-500 hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function BankField({ icon: Icon, label, value, copy }: { icon: React.ElementType; label: string; value: string; copy?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
      <span className="text-gray-500 w-20 flex-shrink-0">{label}</span>
      <span className="text-gray-200 font-medium truncate">{value}</span>
      {copy && <CopyBtn value={copy} />}
    </div>
  );
}

type Tab = 'unpaid' | 'paid' | 'all';

export function AdminPayouts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('unpaid');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await callFn({ action: 'list' });
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function mark(row: Row, status: 'paid' | 'unpaid') {
    setBusyId(row.id);
    try { await callFn({ action: 'mark', txId: row.id, status }); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  }

  const filtered = rows.filter(r =>
    tab === 'all' ? true : tab === 'paid' ? r.payout_status === 'paid' : r.payout_status !== 'paid');

  // Group filtered rows by contractor
  const groups = Object.values(
    filtered.reduce((acc, r) => {
      (acc[r.contractor_id] ??= { contractor_id: r.contractor_id, name: r.contractor_name, bank: r.bank, rows: [] }).rows.push(r);
      return acc;
    }, {} as Record<string, { contractor_id: string; name: string; bank: Bank | null; rows: Row[] }>)
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-400" />Manual Payouts</h2>
          <p className="text-gray-500 text-xs mt-0.5">Transfer the <span className="text-emerald-400 font-semibold">net</span> amount to each contractor — we keep 10% of every project's total.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'To pay now', value: fmt(summary.unpaid_net), sub: `${summary.unpaid_count} payment${summary.unpaid_count !== 1 ? 's' : ''}`, accent: 'text-amber-300' },
            { label: 'Fees collected', value: fmt(summary.total_fees), sub: '10% commission', accent: 'text-emerald-300' },
            { label: 'Total net (all)', value: fmt(summary.total_net), sub: `${summary.count} payments`, accent: 'text-blue-300' },
            { label: 'Payments', value: String(summary.count), sub: 'received from owners', accent: 'text-gray-200' },
          ].map(c => (
            <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.accent}`}>{c.value}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/40 rounded-2xl px-5 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1 w-fit">
        {([['unpaid', 'To Pay'], ['paid', 'Paid'], ['all', 'All']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : groups.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm bg-gray-900 border border-gray-800 rounded-2xl">Nothing here.</div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => {
            const groupNet = g.rows.reduce((s, r) => s + (r.payout_status !== 'paid' ? r.net : 0), 0);
            return (
              <div key={g.contractor_id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Contractor header + bank details */}
                <div className="px-5 py-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-bold">{g.name}</span>
                    </div>
                    {g.bank ? (
                      <div className="space-y-1">
                        <BankField icon={Landmark}   label="Bank"    value={g.bank.bank_name} />
                        <BankField icon={CreditCard} label="Account" value={mask(g.bank.account_number)} copy={g.bank.account_number} />
                        <BankField icon={Hash}       label="Routing" value={g.bank.routing_number} copy={g.bank.routing_number} />
                        <BankField icon={Building2}  label="Type"    value={g.bank.account_type} />
                        <BankField icon={Shield}     label={g.bank.tax_id_type === 'ein' ? 'EIN' : 'SSN'} value={g.bank.tax_id_value} copy={g.bank.tax_id_value} />
                        <BankField icon={Banknote}   label="Holder"  value={g.bank.full_name} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />No banking details on file yet.
                      </div>
                    )}
                  </div>
                  {groupNet > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">Owe now</p>
                      <p className="text-2xl font-bold text-amber-300">{fmt(groupNet)}</p>
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div className="divide-y divide-gray-800">
                  {g.rows.map(r => {
                    const busy = busyId === r.id;
                    const paid = r.payout_status === 'paid';
                    return (
                      <div key={r.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 font-medium truncate">{r.project_title}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(r.created_at)}{paid && r.payout_at ? ` · paid ${fmtDate(r.payout_at)}` : ''}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="text-gray-500">Gross {fmt(r.gross)} · fee {fmt(r.platform_fee)}</p>
                          <p className="text-emerald-300 font-bold text-sm flex items-center gap-1 justify-end"><DollarSign className="w-3.5 h-3.5" />Net {fmt(r.net)}</p>
                        </div>
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        ) : paid ? (
                          <button onClick={() => mark(r, 'unpaid')} title="Mark as unpaid"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700">
                            <Undo2 className="w-3.5 h-3.5" />Paid
                          </button>
                        ) : (
                          <button onClick={() => mark(r, 'paid')} title="Mark transfer completed"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-600/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />Mark Paid
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
