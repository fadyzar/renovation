import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Briefcase, CheckCircle, XCircle, MessageCircle,
  RefreshCw, DollarSign, Lock, AlertCircle, ChevronRight,
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

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  new_bid:             { icon: Briefcase,     color: 'text-blue-600',   bg: 'bg-blue-100'   },
  bid_accepted:        { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-100'  },
  bid_rejected:        { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-100'    },
  new_message:         { icon: MessageCircle, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  project_update:      { icon: RefreshCw,     color: 'text-amber-600',  bg: 'bg-amber-100'  },
  payment_received:    { icon: DollarSign,    color: 'text-emerald-600',bg: 'bg-emerald-100'},
  milestone_submitted: { icon: AlertCircle,   color: 'text-orange-600', bg: 'bg-orange-100' },
  project_activated:   { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-100'  },
  deposit_paid:        { icon: Lock,          color: 'text-purple-600', bg: 'bg-purple-100' },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100' };
}

function getNavTarget(n: Notification): string | null {
  const m = n.metadata ?? {};
  switch (n.type) {
    case 'new_bid':
      return m.project_id ? `/contractor-matching/${m.project_id}` : null;
    case 'bid_accepted':
      return m.project_id ? `/project/${m.project_id}/payments` : '/dashboard';
    case 'bid_rejected':
      return '/dashboard';
    case 'new_message':
      return '/messages';
    case 'milestone_submitted':
      return m.project_id ? `/project/${m.project_id}/payments` : null;
    case 'payment_received':
      return m.project_id ? `/project/${m.project_id}/payments` : '/dashboard';
    case 'project_activated':
      return m.conversation_id ? '/messages' : '/dashboard';
    case 'deposit_paid':
      return m.conversation_id ? '/messages' : '/dashboard';
    case 'project_update':
      return m.project_id ? `/project/${m.project_id}/payments` : '/dashboard';
    default:
      return '/dashboard';
  }
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800)return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export function NotificationDropdown() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newPing, setNewPing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadNotifications();

    const channel = supabase
      .channel(`notif-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        loadNotifications();
        setNewPing(true);
        setTimeout(() => setNewPing(false), 2000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function loadNotifications() {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(15);

    setNotifications(data ?? []);
    setUnreadCount(data?.filter(n => !n.is_read).length ?? 0);
  }

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
    markRead(n.id);
    setIsOpen(false);
    const target = getNavTarget(n);
    if (target) {
      if (n.type === 'new_message' || n.type === 'deposit_paid' || n.type === 'project_activated') {
        const convId = n.metadata?.conversation_id;
        navigate(convId ? `/messages?conversationId=${convId}` : '/messages');
      } else {
        navigate(target);
      }
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
      >
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-blue-600' : 'text-gray-700'}`} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 ${newPing ? 'animate-bounce' : ''}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-20 flex flex-col overflow-hidden max-h-[80vh] sm:max-h-[560px]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-white" />
                <span className="font-bold text-white text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-100 hover:text-white transition-colors">
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : notifications.map(n => {
                const { icon: Icon, color, bg } = getConfig(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left ${!n.is_read ? 'bg-blue-50/60' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm font-semibold truncate ${!n.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                className="w-full flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold py-1 transition-colors"
              >
                View all notifications
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
