import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Briefcase, DollarSign, Users,
  Clock, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BarChart, LineChart, DonutChart, Sparkline } from '../admin/charts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthBucket { label: string; revenue: number; fees: number; projects: number }
interface RecentActivity { id: string; type: string; title: string; subtitle: string; time: string; color: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
}

function last6Months(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return keys;
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, sparkData, color, icon: Icon }: {
  label: string; value: string; sub?: string; trend?: number; sparkData?: number[];
  color: string; icon: React.ElementType;
}) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {sparkData && <Sparkline data={sparkData} color={trendUp ? '#22c55e' : '#ef4444'} />}
      </div>
      <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {(trend !== undefined || sub) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
              {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="text-xs text-gray-500">{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0, totalFees: 0,
    totalProjects: 0, activeProjects: 0,
    totalUsers: 0, openTickets: 0,
    timeoutCount: 0,
  });
  const [monthBuckets, setMonthBuckets] = useState<MonthBucket[]>([]);
  const [projectStatus, setProjectStatus] = useState<{ label: string; value: number; color: string }[]>([]);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [revenueGrowth, setRevenueGrowth] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);

    const keys = last6Months();
    const bucketMap: Record<string, MonthBucket> = {};
    keys.forEach(k => {
      const [y, m] = k.split('-');
      bucketMap[k] = { label: MONTH_LABELS[parseInt(m)-1], revenue: 0, fees: 0, projects: 0 };
    });

    // Transactions (Stripe revenue)
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, platform_fee, created_at, status')
      .order('created_at', { ascending: false });

    let totalRevenue = 0, totalFees = 0;
    for (const t of txns ?? []) {
      totalRevenue += t.amount ?? 0;
      totalFees += t.platform_fee ?? 0;
      const k = monthKey(t.created_at);
      if (bucketMap[k]) {
        bucketMap[k].revenue += t.amount ?? 0;
        bucketMap[k].fees    += t.platform_fee ?? 0;
      }
    }

    // Projects
    const { data: projects } = await supabase
      .from('projects')
      .select('status, created_at');

    for (const p of projects ?? []) {
      const k = monthKey(p.created_at);
      if (bucketMap[k]) bucketMap[k].projects++;
    }

    const statusCounts: Record<string,number> = {};
    for (const p of projects ?? []) {
      statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    }

    const timeoutThreshold = new Date(Date.now() - 72 * 3_600_000).toISOString();
    const timeoutCount = (projects ?? []).filter(p =>
      p.status === 'seeking_quotes' && p.created_at < timeoutThreshold
    ).length;

    // Revenue growth (this month vs last)
    const thisM = keys[5], lastM = keys[4];
    const thisRev = bucketMap[thisM]?.revenue ?? 0;
    const lastRev = bucketMap[lastM]?.revenue ?? 0;
    const growth = lastRev > 0 ? Math.round(((thisRev - lastRev) / lastRev) * 100) : 0;

    // Users
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      .neq('role', 'admin');

    // Open tickets
    const { count: ticketCount } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    // Recent activity
    const { data: recentBids } = await supabase.from('bids')
      .select('id, total_price, created_at, project:projects(title)')
      .order('created_at', { ascending: false }).limit(3);

    const { data: recentTxns } = await supabase.from('transactions')
      .select('id, amount, platform_fee, created_at, project:projects(title)')
      .order('created_at', { ascending: false }).limit(3);

    const { data: recentTickets } = await supabase.from('support_tickets')
      .select('id, subject, created_at, status')
      .order('created_at', { ascending: false }).limit(2);

    const acts: RecentActivity[] = [
      ...(recentBids ?? []).map(b => ({
        id: b.id, type: 'bid',
        title: `New Bid — $${(b.total_price ?? 0).toLocaleString()}`,
        subtitle: (b.project as any)?.title ?? 'Project',
        time: b.created_at, color: 'bg-blue-500',
      })),
      ...(recentTxns ?? []).map(t => ({
        id: t.id, type: 'payment',
        title: `Payment — $${(t.amount ?? 0).toLocaleString()} (fee: $${(t.platform_fee ?? 0).toLocaleString()})`,
        subtitle: (t.project as any)?.title ?? 'Project',
        time: t.created_at, color: 'bg-green-500',
      })),
      ...(recentTickets ?? []).map(t => ({
        id: t.id, type: 'ticket',
        title: `Support: "${t.subject}"`,
        subtitle: t.status,
        time: t.created_at, color: 'bg-orange-500',
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

    setStats({
      totalRevenue, totalFees,
      totalProjects: projects?.length ?? 0,
      activeProjects: statusCounts['in_progress'] ?? 0,
      totalUsers: userCount ?? 0,
      openTickets: ticketCount ?? 0,
      timeoutCount,
    });

    setMonthBuckets(keys.map(k => bucketMap[k]));
    setRevenueGrowth(growth);

    setProjectStatus([
      { label: 'Seeking Quotes', value: statusCounts['seeking_quotes'] ?? 0,   color: '#3b82f6' },
      { label: 'Awaiting Pay',   value: statusCounts['awaiting_deposit'] ?? 0, color: '#f59e0b' },
      { label: 'In Progress',    value: statusCounts['in_progress'] ?? 0,      color: '#22c55e' },
      { label: 'Completed',      value: statusCounts['completed'] ?? 0,        color: '#6b7280' },
    ]);

    setActivity(acts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const revenueData  = monthBuckets.map(b => ({ label: b.label, value: b.revenue }));
  const feeData      = monthBuckets.map(b => ({ label: b.label, value: b.fees }));
  const projectsData = monthBuckets.map(b => ({ label: b.label, value: b.projects }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Alert banner */}
      {stats.timeoutCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/40 border border-red-700/50 rounded-2xl px-5 py-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm font-semibold">
            {stats.timeoutCount} project{stats.timeoutCount > 1 ? 's' : ''} open 72h+ with no bids — needs attention
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue (Stripe)"
          value={formatMoney(stats.totalRevenue)}
          trend={revenueGrowth}
          sub="vs last month"
          sparkData={revenueData.map(d => d.value)}
          color="bg-blue-600"
          icon={TrendingUp}
        />
        <StatCard
          label="Platform Fees Earned"
          value={formatMoney(stats.totalFees)}
          sub="10% of project total"
          sparkData={feeData.map(d => d.value)}
          color="bg-emerald-600"
          icon={DollarSign}
        />
        <StatCard
          label="Active Projects"
          value={String(stats.activeProjects)}
          sub={`${stats.totalProjects} total`}
          sparkData={projectsData.map(d => d.value)}
          color="bg-violet-600"
          icon={Briefcase}
        />
        <StatCard
          label="Platform Users"
          value={String(stats.totalUsers)}
          sub={`${stats.openTickets} open tickets`}
          color="bg-amber-600"
          icon={Users}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue bar chart */}
        <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Revenue — Last 6 Months</h3>
              <p className="text-gray-400 text-xs mt-0.5">Stripe collected amounts</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Fees
              </span>
            </div>
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="relative">
              <BarChart data={revenueData} height={160} color="#3b82f6" />
              <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.5 }}>
                <BarChart data={feeData} height={160} color="#22c55e" />
              </div>
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-sm mb-4">Project Status</h3>
          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <DonutChart segments={projectStatus} size={140} />
              <div className="w-full space-y-2">
                {projectStatus.map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                    <p className="text-xs font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projects over time + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Projects line chart */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-sm mb-1">New Projects — Last 6 Months</h3>
          <p className="text-gray-400 text-xs mb-4">Projects created per month</p>
          {loading ? (
            <div className="h-28 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <LineChart data={projectsData} height={128} color="#8b5cf6" />
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-white font-bold text-sm mb-4">Recent Activity</h3>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-gray-700 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-gray-800 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-48">
              {activity.map(a => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${a.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{a.title}</p>
                    <p className="text-xs text-gray-500 truncate">{a.subtitle} · {timeAgo(a.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avg Fee / Project', value: stats.totalProjects > 0 ? formatMoney(stats.totalFees / stats.totalProjects) : '$0', icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Active Projects', value: `${stats.activeProjects}`, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Timeout Alerts', value: `${stats.timeoutCount}`, icon: AlertTriangle, color: stats.timeoutCount > 0 ? 'text-red-400' : 'text-gray-500' },
          { label: 'Open Tickets', value: `${stats.openTickets}`, icon: Clock, color: stats.openTickets > 0 ? 'text-amber-400' : 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center gap-3">
            <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
            <div>
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
