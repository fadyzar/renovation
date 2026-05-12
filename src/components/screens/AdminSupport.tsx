import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Clock, CheckCircle, AlertCircle, Send, X, User, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Ticket {
  id: string; subject: string; message: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: string; category: string; created_at: string;
  user: { full_name: string; email?: string; phone?: string } | null;
  reply_count: number;
}

interface Reply {
  id: string; message: string; is_admin: boolean; created_at: string;
  sender: { full_name: string } | null;
}

const STATUS_CFG = {
  open:        { label: 'Open',        color: 'text-amber-300',  bg: 'bg-amber-900/30',  icon: Clock        },
  in_progress: { label: 'In Progress', color: 'text-blue-300',   bg: 'bg-blue-900/30',   icon: MessageCircle},
  closed:      { label: 'Closed',      color: 'text-gray-400',   bg: 'bg-gray-800',      icon: CheckCircle  },
};

const PRIORITY_CFG = {
  urgent: 'text-red-400 bg-red-900/30',
  high:   'text-orange-400 bg-orange-900/30',
  normal: 'text-blue-400 bg-blue-900/20',
  low:    'text-gray-400 bg-gray-800',
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export function AdminSupport() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('open');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('support_tickets')
      .select(`id, subject, message, status, priority, category, created_at,
        user:profiles!user_id(full_name, email, phone)`)
      .order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;

    // Count replies per ticket
    const ids = (data ?? []).map(t => t.id);
    const { data: replyCounts } = ids.length
      ? await supabase.from('support_replies').select('ticket_id').in('ticket_id', ids)
      : { data: [] };

    const countMap: Record<string,number> = {};
    for (const r of replyCounts ?? []) countMap[r.ticket_id] = (countMap[r.ticket_id] ?? 0) + 1;

    setTickets((data ?? []).map(t => ({
      ...t,
      user: Array.isArray(t.user) ? t.user[0] ?? null : (t.user ?? null),
      reply_count: countMap[t.id] ?? 0,
    })));
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function openTicket(ticket: Ticket) {
    setSelected(ticket);
    const { data } = await supabase
      .from('support_replies')
      .select(`id, message, is_admin, created_at, sender:profiles!sender_id(full_name)`)
      .eq('ticket_id', ticket.id)
      .order('created_at');
    setReplies((data ?? []).map(r => ({
      ...r,
      sender: Array.isArray(r.sender) ? r.sender[0] ?? null : (r.sender ?? null),
    })));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    // Mark in_progress if open
    if (ticket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticket.id);
      setSelected(prev => prev ? { ...prev, status: 'in_progress' } : prev);
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'in_progress' } : t));
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selected || !profile) return;
    setSending(true);
    const { data } = await supabase.from('support_replies')
      .insert({ ticket_id: selected.id, sender_id: profile.id, message: replyText.trim(), is_admin: true })
      .select(`id, message, is_admin, created_at, sender:profiles!sender_id(full_name)`)
      .single();
    if (data) {
      setReplies(prev => [...prev, {
        ...data,
        sender: Array.isArray(data.sender) ? data.sender[0] ?? null : (data.sender ?? null),
      }]);
      setReplyText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    setSending(false);
  }

  async function setStatus(status: 'open' | 'in_progress' | 'closed') {
    if (!selected) return;
    await supabase.from('support_tickets').update({ status }).eq('id', selected.id);
    setSelected(prev => prev ? { ...prev, status } : prev);
    setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status } : t));
  }

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Left: Ticket list */}
      <div className="w-80 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-sm">Support Inbox</h2>
            <div className="flex gap-1.5">
              {openCount > 0 && <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full">{openCount} open</span>}
              {inProgCount > 0 && <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{inProgCount} active</span>}
            </div>
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
            {(['open','in_progress','closed','all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f === 'in_progress' ? 'Active' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No tickets</div>
          ) : tickets.map(t => {
            const cfg = STATUS_CFG[t.status];
            const isSelected = selected?.id === t.id;
            return (
              <button key={t.id} onClick={() => openTicket(t)}
                className={`w-full p-4 text-left border-b border-gray-800 hover:bg-gray-800/60 transition-colors ${isSelected ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-white text-xs font-semibold truncate">{t.subject}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium ${PRIORITY_CFG[t.priority as keyof typeof PRIORITY_CFG] ?? PRIORITY_CFG.normal}`}>
                    {t.priority}
                  </span>
                </div>
                <p className="text-gray-500 text-xs truncate mb-1.5">{t.user?.full_name ?? 'Unknown'}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-gray-600">{timeAgo(t.created_at)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Ticket detail */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 py-4 bg-gray-900 border-b border-gray-800 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-white font-bold text-sm truncate">{selected.subject}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[selected.status].bg} ${STATUS_CFG[selected.status].color}`}>
                  {STATUS_CFG[selected.status].label}
                </span>
                <span className="text-xs text-gray-500 capitalize">{selected.category}</span>
              </div>
              <p className="text-xs text-gray-400">
                From: <span className="text-white">{selected.user?.full_name ?? '—'}</span>
                {selected.user?.email && <> · <a href={`mailto:${selected.user.email}`} className="text-blue-400 hover:underline">{selected.user.email}</a></>}
                {selected.user?.phone && <> · <a href={`tel:${selected.user.phone}`} className="text-blue-400 hover:underline">{selected.user.phone}</a></>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={selected.status}
                onChange={e => setStatus(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Original message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-300" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-white text-xs font-semibold">{selected.user?.full_name ?? 'User'}</p>
                  <p className="text-gray-500 text-xs">{timeAgo(selected.created_at)}</p>
                </div>
                <div className="bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>
            </div>

            {/* Replies */}
            {replies.map(r => (
              <div key={r.id} className={`flex gap-3 ${r.is_admin ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.is_admin ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {r.is_admin
                    ? <AlertCircle className="w-4 h-4 text-white" />
                    : <User className="w-4 h-4 text-gray-300" />}
                </div>
                <div className={`flex-1 ${r.is_admin ? 'items-end' : ''} flex flex-col`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${r.is_admin ? 'flex-row-reverse' : ''}`}>
                    <p className="text-white text-xs font-semibold">{r.sender?.full_name ?? (r.is_admin ? 'Admin' : 'User')}</p>
                    <p className="text-gray-500 text-xs">{timeAgo(r.created_at)}</p>
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap max-w-[80%] ${
                    r.is_admin ? 'bg-blue-600/30 text-blue-100 rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'
                  }`}>
                    {r.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          {selected.status !== 'closed' && (
            <div className="px-6 py-4 bg-gray-900 border-t border-gray-800">
              <div className="flex gap-3">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Type your reply… (Enter to send)"
                  rows={2}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 placeholder-gray-600"
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors self-end"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <MessageCircle className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Select a ticket to view the conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
