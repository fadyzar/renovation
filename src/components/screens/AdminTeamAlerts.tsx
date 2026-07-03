import { useState, useEffect, useCallback } from 'react';
import {
  Users, Send, CheckCircle2, AlertTriangle, Loader2, Plus, Power, Save, X, Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsapp } from '../../lib/whatsapp';

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  title: string | null;
  is_active: boolean;
  receive_project_alerts: boolean;
  receive_quote_alerts: boolean;
  receive_status_alerts: boolean;
  receive_admin_messages: boolean;
}

interface TeamLog {
  created_at: string;
  recipient_name: string | null;
  phone: string;
  event_type: string | null;
  status: string;
  error: string | null;
}

const FLAGS: { key: keyof TeamMember; label: string }[] = [
  { key: 'receive_project_alerts', label: 'Projects' },
  { key: 'receive_quote_alerts',   label: 'Quotes' },
  { key: 'receive_status_alerts',  label: 'Accepted/Rejected/Status' },
  { key: 'receive_admin_messages', label: 'Admin messages' },
];

const ACTIVATION_MSG = `🚀 MGbit Team Alerts

Hi team,

The MGbit internal WhatsApp alert system is being activated.

From now on, you may receive real-time updates about important activity in the platform, including:
• New projects
• New contractor quotes
• Quote approvals or rejections
• Important project status updates

This alert is only for the MGbit team.

Great work, champions.
We are building the best MGbit team. 🔥

— MGbit`;

const TEMPLATES: Record<string, string> = {
  custom: '',
  activation: ACTIVATION_MSG,
};

export function AdminTeamAlerts() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<TeamLog[]>([]);
  const [loading, setLoading] = useState(true);

  // composer
  const [target, setTarget] = useState<'all' | string>('all');
  const [templateId, setTemplateId] = useState('custom');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // add-member form
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', title: '' });

  const load = useCallback(async () => {
    const [{ data: mem }, { data: lg }] = await Promise.all([
      supabase.from('team_whatsapp_recipients').select('*').order('created_at'),
      supabase.from('whatsapp_logs').select('created_at, recipient_name, phone, event_type, status, error')
        .eq('recipient_type', 'team').order('created_at', { ascending: false }).limit(20),
    ]);
    setMembers(mem ?? []);
    setLogs(lg ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(m: TeamMember, key: keyof TeamMember) {
    const next = !m[key];
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, [key]: next } : x)));
    const { error } = await supabase.from('team_whatsapp_recipients').update({ [key]: next }).eq('id', m.id);
    if (error) { setResult({ ok: false, text: `Failed to update ${m.name}: ${error.message}` }); load(); }
  }

  async function addMember() {
    if (!form.name.trim() || !form.phone.trim()) { setResult({ ok: false, text: 'Name and phone are required.' }); return; }
    const { error } = await supabase.from('team_whatsapp_recipients').insert({
      name: form.name.trim(), phone: form.phone.trim(), title: form.title.trim() || null,
    });
    if (error) { setResult({ ok: false, text: error.message }); return; }
    setForm({ name: '', phone: '', title: '' });
    setAdding(false);
    setResult({ ok: true, text: 'Team member added.' });
    load();
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    if (TEMPLATES[id] !== undefined && id !== 'custom') setMessage(TEMPLATES[id]);
  }

  async function send() {
    setResult(null);
    const text = message.trim();
    if (!text) { setResult({ ok: false, text: 'Write a message or pick a template.' }); return; }

    const recipients = target === 'all'
      ? members.filter((m) => m.is_active && m.receive_admin_messages)
      : members.filter((m) => m.id === target);
    if (recipients.length === 0) { setResult({ ok: false, text: 'No matching active recipients.' }); return; }

    setSending(true);
    let ok = 0, fail = 0;
    for (const m of recipients) {
      try {
        await whatsapp.custom(m.phone, text, {
          recipient_id: m.id, recipient_type: 'team', recipient_name: m.name, event_type: 'team_admin_manual',
        });
        ok++;
      } catch { fail++; }
    }
    setSending(false);
    setResult({ ok: fail === 0, text: `Sent to ${ok} member(s)${fail ? `, ${fail} failed` : ''}.` });
    load();
  }

  const previewRecipients = target === 'all'
    ? members.filter((m) => m.is_active && m.receive_admin_messages).map((m) => m.name)
    : members.filter((m) => m.id === target).map((m) => m.name);

  if (loading) return <div className="p-6 text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400" /> Team WhatsApp Alerts
        </h2>
        <p className="text-gray-500 text-xs mt-0.5">Internal MGbit team alerts — separate from owner/contractor notifications.</p>
      </div>

      {result && (
        <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
          result.ok ? 'text-emerald-300 bg-emerald-900/20 border-emerald-800/40' : 'text-red-300 bg-red-900/20 border-red-800/40'}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
          {result.text}
        </div>
      )}

      {/* Roster */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-semibold text-white flex items-center gap-2"><Bell className="w-4 h-4 text-blue-400" /> Team members ({members.length})</span>
          <button onClick={() => setAdding((v) => !v)} className="text-xs flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {adding ? 'Cancel' : 'Add member'}
          </button>
        </div>

        {adding && (
          <div className="p-4 border-b border-gray-800 grid sm:grid-cols-4 gap-2 bg-gray-900/60">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+972…"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600" />
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (optional)"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600" />
            <button onClick={addMember} className="flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-gray-500 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2">Member</th>
                <th className="text-left px-4 py-2">Active</th>
                {FLAGS.map((f) => <th key={f.key} className="text-left px-3 py-2">{f.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {members.map((m) => (
                <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{m.name}</div>
                    <div className="text-gray-500 text-xs">{m.phone}{m.title ? ` · ${m.title}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(m, 'is_active')} title="Toggle active"
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${m.is_active ? 'bg-emerald-600/20 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}>
                      <Power className="w-3.5 h-3.5" /> {m.is_active ? 'On' : 'Off'}
                    </button>
                  </td>
                  {FLAGS.map((f) => (
                    <td key={f.key} className="px-3 py-3">
                      <input type="checkbox" checked={!!m[f.key]} onChange={() => toggle(m, f.key)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Composer */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
          <span className="text-sm font-semibold text-white">Send WhatsApp to team</span>

          <div>
            <label className="text-[11px] text-gray-500">Recipient</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              className="mt-0.5 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="all">All active members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-gray-500">Template</label>
            <select value={templateId} onChange={(e) => pickTemplate(e.target.value)}
              className="mt-0.5 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="custom">Custom message</option>
              <option value="activation">Team activation announcement</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-gray-500">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} placeholder="Type your message…"
              className="mt-0.5 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 resize-none" />
          </div>

          <button onClick={send} disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to team
          </button>
        </div>

        {/* Preview + log */}
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <span className="text-[11px] text-gray-500 uppercase">Preview → {previewRecipients.length} recipient(s): {previewRecipients.join(', ') || '—'}</span>
            <div className="mt-2 text-sm text-gray-200 bg-gray-800/60 rounded-lg px-3 py-3 whitespace-pre-wrap border border-gray-800 min-h-[120px]">
              {message.trim() || <span className="text-gray-600">Nothing to preview yet…</span>}
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 text-[11px] uppercase text-gray-500">Recent team sends</div>
            <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-800">
              {logs.length === 0 ? <div className="p-4 text-gray-600 text-sm">No team messages yet.</div> :
                logs.map((l, i) => (
                  <div key={i} className="px-4 py-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-gray-300 truncate">{l.recipient_name ?? l.phone} · <span className="text-gray-500">{l.event_type}</span></span>
                    <span className={l.status === 'sent' ? 'text-emerald-400' : 'text-red-400'}>{l.status}{l.error ? ' ⚠︎' : ''}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
