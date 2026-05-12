import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, CreditCard, ArrowUpRight, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BarChart, LineChart } from '../admin/charts';

interface TxnRow {
  id: string; amount: number; platform_fee: number;
  stripe_payment_id: string; status: string; created_at: string;
  project: { title: string } | null;
  owner: { full_name: string } | null;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMoney(n: number, decimals = 0) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function last12Months() {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return keys;
}

export function AdminRevenue() {
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'3' | '6' | '12'>('6');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select(`id, amount, platform_fee, stripe_payment_id, status, created_at,
        project:projects(title),
        owner:profiles!owner_id(full_name)`)
      .order('created_at', { ascending: false });

    setTxns((data ?? []).map(t => ({
      ...t,
      project: Array.isArray(t.project) ? t.project[0] ?? null : (t.project ?? null),
      owner:   Array.isArray(t.owner)   ? t.owner[0]   ?? null : (t.owner   ?? null),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = txns.reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalFees    = txns.reduce((s, t) => s + (t.platform_fee ?? 0), 0);
  const avgFee       = txns.length > 0 ? totalFees / txns.length : 0;

  // Monthly buckets
  const n = parseInt(period);
  const keys = last12Months().slice(12 - n);
  const bucketMap: Record<string, { revenue: number; fees: number; count: number }> = {};
  keys.forEach(k => { bucketMap[k] = { revenue: 0, fees: 0, count: 0 }; });

  for (const t of txns) {
    const d = new Date(t.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (bucketMap[k]) {
      bucketMap[k].revenue += t.amount ?? 0;
      bucketMap[k].fees    += t.platform_fee ?? 0;
      bucketMap[k].count++;
    }
  }

  const chartData   = keys.map(k => ({ label: MONTH_LABELS[parseInt(k.split('-')[1])-1], value: bucketMap[k].revenue }));
  const feeData     = keys.map(k => ({ label: MONTH_LABELS[parseInt(k.split('-')[1])-1], value: bucketMap[k].fees   }));
  const countData   = keys.map(k => ({ label: MONTH_LABELS[parseInt(k.split('-')[1])-1], value: bucketMap[k].count  }));

  // Growth
  const lastRev  = bucketMap[keys[keys.length - 2]]?.revenue ?? 0;
  const thisRev  = bucketMap[keys[keys.length - 1]]?.revenue ?? 0;
  const growth   = lastRev > 0 ? Math.round(((thisRev - lastRev) / lastRev) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Revenue Analytics</h2>
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 border border-gray-700">
          {(['3','6','12'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {p}M
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected (Stripe)', value: formatMoney(totalRevenue), icon: CreditCard, color: 'bg-blue-600', sub: 'all time' },
          { label: 'Platform Fees Earned',     value: formatMoney(totalFees),    icon: DollarSign, color: 'bg-emerald-600', sub: '10% of projects' },
          { label: 'Avg Fee / Transaction',    value: formatMoney(avgFee, 2),    icon: TrendingUp, color: 'bg-violet-600', sub: `${txns.length} txns` },
          { label: 'Month-over-Month Growth',  value: `${growth > 0 ? '+' : ''}${growth}%`, icon: ArrowUpRight, color: growth >= 0 ? 'bg-green-600' : 'bg-red-600', sub: 'vs last month' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-600 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-sm mb-1">Revenue Collected (Stripe)</h3>
          <p className="text-gray-400 text-xs mb-4">Monthly transaction totals</p>
          {loading ? <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            : <BarChart data={chartData} height={160} color="#3b82f6" />}
        </div>
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-sm mb-1">Platform Fees Earned</h3>
          <p className="text-gray-400 text-xs mb-4">10% taken from each project</p>
          {loading ? <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
            : <BarChart data={feeData} height={160} color="#22c55e" />}
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h3 className="text-white font-bold text-sm mb-1">Transactions / Month</h3>
        <p className="text-gray-400 text-xs mb-4">Number of payments processed</p>
        {loading ? <div className="h-28 flex items-center justify-center"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          : <LineChart data={countData} height={120} color="#8b5cf6" />}
      </div>

      {/* Transactions table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">All Transactions</h3>
          <span className="text-xs text-gray-500">{txns.length} records</span>
        </div>
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No transactions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Project','Client','Amount','Platform Fee','Stripe ID','Status','Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {txns.slice(0, 50).map(t => (
                  <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-white text-xs max-w-[160px] truncate">{t.project?.title ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{t.owner?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-white text-xs font-semibold">${(t.amount ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-400 text-xs font-semibold">${(t.platform_fee ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {t.stripe_payment_id ? (
                        <span className="text-xs text-blue-400 font-mono truncate max-w-[100px] block">{t.stripe_payment_id.slice(0, 16)}…</span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.status === 'escrowed' ? 'bg-blue-900/40 text-blue-300' :
                        t.status === 'released' ? 'bg-green-900/40 text-green-300' :
                        'bg-gray-800 text-gray-400'}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
