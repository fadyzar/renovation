import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Briefcase, CheckCircle, XCircle, MessageCircle,
  RefreshCw, DollarSign, Lock, AlertCircle, ArrowLeft, Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  new_bid:             { icon: Briefcase,     color: 'text-blue-600',   bg: 'bg-blue-100',   label: 'New Bid'         },
  bid_accepted:        { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-100',  label: 'Bid Accepted'    },
  bid_rejected:        { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-100',    label: 'Bid Rejected'    },
  new_message:         { icon: MessageCircle, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Message'         },
  project_update:      { icon: RefreshCw,     color: 'text-amber-600',  bg: 'bg-amber-100',  label: 'Project Update'  },
  payment_received:    { icon: DollarSign,    color: 'text-emerald-600',bg: 'bg-emerald-100',label: 'Payment'         },
  milestone_submitted: { icon: AlertCircle,   color: 'text-orange-600', bg: 'bg-orange-100', label: 'Milestone'       },
  project_activated:   { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-100',  label: 'Activated'       },
  deposit_paid:        { icon: Lock,          color: 'text-purple-600', bg: 'bg-purple-100', label: 'Deposit'         },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Notification' };
}

function getNavTarget(n: Notification): string {
  const m = n.metadata ?? {};
  switch (n.type) {
    case 'new_bid':
      return m.project_id ? `/contractor-matching/${m.project_id}` : '/dashboard';
    case 'bid_accepted':
      return m.project_id ? `/project/${m.project_id}/payments` : '/dashboard';
    case 'bid_rejected':
      return '/dashboard';
    case 'new_message':
      return m.conversation_id ? `/messages?conversationId=${m.conversation_id}` : '/messages';
    case 'milestone_submitted':
      return m.project_id ? `/project/${m.project_id}/payments` : '/dashboard';
    case 'payment_received':
      return m.project_id ? `/project/${m.project_id}/payments` : '/dashboard';
    case 'project_activated':
      return m.conversation_id ? `/messages?conversationId=${m.conversation_id}` : '/dashboard';
    case 'deposit_paid':
      return m.conversation_id ? `/messages?conversationId=${m.conversation_id}` : '/dashboard';
    default:
      return '/dashboard';
  }
}

function formatDate(date: string) {
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60)     return 'Just now';
  if (seconds < 3600)   return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (pg: number, f: 'all' | 'unread') => {
    if (!profile) return;
    setLoading(true);
    let q = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE - 1);

    if (f === 'unread') q = q.eq('is_read', false);

    const { data } = await q;
    const rows = data ?? [];

    setNotifications(prev => pg === 0 ? rows : [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [profile?.id]);

  async function loadUnreadCount() {
    if (!profile) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }

  useEffect(() => {
    setPage(0);
    load(0, filter);
    loadUnreadCount();
  }, [filter, load]);

  // Realtime
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`notif-page-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        load(0, filter);
        loadUnreadCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, filter]);

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', profile.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markRead(n.id);
    navigate(getNavTarget(n));
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    load(next, filter);
  }

  // Group by date
  const grouped: { label: string; items: Notification[] }[] = [];
  let lastLabel = '';
  for (const n of notifications) {
    const d = new Date(n.created_at);
    const now = new Date();
    let label: string;
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) label = 'Today';
    else if (diffDays === 1) label = 'Yesterday';
    else if (diffDays < 7) label = 'This Week';
    else label = 'Older';

    if (label !== lastLabel) {
      grouped.push({ label, items: [] });
      lastLabel = label;
    }
    grouped[grouped.length - 1].items.push(n);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-blue-600 hover:text-blue-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 bg-white rounded-xl p-1 border border-gray-200 w-fit">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'unread' && <Filter className="w-3.5 h-3.5" />}
              {f}
              {f === 'unread' && unreadCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === 'unread' ? 'bg-white/20' : 'bg-red-100 text-red-600'}`}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        {loading && notifications.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 flex gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-500">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'unread' ? "You're all caught up!" : "Activity will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.label}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50 shadow-sm">
                  {group.items.map(n => {
                    const { icon: Icon, color, bg } = getConfig(n.type);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`w-full px-4 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-semibold ${!n.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {n.title}
                            </p>
                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                              {formatDate(n.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                        {!n.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
