import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Send, CheckCircle2, AlertTriangle, Loader2, Search, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Person { id: string; full_name: string; phone?: string; role: string; email?: string }
interface Template { id: string; label: string }
interface EmailLog {
  id: string; recipient_id: string | null; email: string | null; subject: string | null;
  type: string | null; status: string; error: string | null; provider_id: string | null;
  project_id: string | null; bid_id: string | null; created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  property_owner: 'Owner',
  contractor: 'Contractor',
  admin: 'Admin',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const FALLBACK_TEMPLATES: Template[] = [
  { id: 'welcome',          label: 'Welcome' },
  { id: 'account_approved', label: 'Account approved' },
  { id: 'complete_profile', label: 'Reminder: complete profile' },
  { id: 'custom',           label: 'Custom message' },
];

export function AdminEmail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'compose' | 'logs'>('compose');

  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<Template[]>(FALLBACK_TEMPLATES);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);
  const [template, setTemplate] = useState('welcome');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, email')
        .order('full_name');
      setPeople(data ?? []);

      // Pre-select a user from the URL (?user=<id>) — used by "Send Email"
      // actions elsewhere in the admin.
      const uid = searchParams.get('user');
      if (uid) {
        const match = (data ?? []).find(p => p.id === uid);
        if (match) { setSelected(match); setTab('compose'); }
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-send-email`, { method: 'GET' });
        const json = await res.json().catch(() => null);
        if (json?.templates?.length) setTemplates(json.templates);
      } catch { /* keep fallback */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return people;
    return people.filter(p =>
      p.full_name?.toLowerCase().includes(s) ||
      (p.email ?? '').toLowerCase().includes(s));
  }, [people, search]);

  const isCustom = template === 'custom';

  function pick(p: Person) {
    setSelected(p);
    setResult(null);
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('user', p.id); return n; }, { replace: true });
  }

  async function send() {
    setResult(null);
    if (!selected) { setResult({ ok: false, text: 'Pick a recipient first.' }); return; }
    if (!selected.email) { setResult({ ok: false, text: 'This user has no email on file.' }); return; }
    if (isCustom && !message.trim()) { setResult({ ok: false, text: 'Write a message for the custom email.' }); return; }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: selected.id,
          template,
          vars: isCustom ? { subject: subject.trim(), message: message.trim() } : {},
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setResult({ ok: false, text: json?.error ?? `HTTP ${res.status}` });
      } else {
        setResult({ ok: true, text: `Email sent to ${selected.email} (Resend id: ${json.provider_id ?? '—'}).` });
        setMessage(''); setSubject('');
      }
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" /> Email
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">Send branded M.G.BIT emails and review the delivery log.</p>
        </div>
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
          {(['compose', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t === 'compose' ? 'Compose' : 'Logs'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'compose' ? (
        <ComposeTab
          people={filtered} search={search} setSearch={setSearch}
          selected={selected} pick={pick}
          templates={templates} template={template} setTemplate={setTemplate}
          isCustom={isCustom} subject={subject} setSubject={setSubject}
          message={message} setMessage={setMessage}
          result={result} sending={sending} send={send}
        />
      ) : (
        <LogsTab />
      )}
    </div>
  );
}

// ─── Compose tab ──────────────────────────────────────────────────────────────
function ComposeTab(p: any) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Recipients */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input value={p.search} onChange={(e: any) => p.setSearch(e.target.value)} placeholder="Search name or email…"
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
          </div>
        </div>
        <div className="divide-y divide-gray-800 max-h-[440px] overflow-y-auto">
          {p.people.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No users match.</div>
          ) : p.people.map((person: Person) => (
            <div key={person.id}
              className={`flex items-center justify-between gap-2 px-4 py-3 transition-colors ${p.selected?.id === person.id ? 'bg-blue-600/20' : 'hover:bg-gray-800/50'}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{person.full_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 flex-shrink-0">{ROLE_LABEL[person.role] ?? person.role}</span>
                </div>
                <p className={`text-xs mt-0.5 truncate ${person.email ? 'text-gray-400' : 'text-red-400'}`}>
                  {person.email ? person.email : 'no email on file'}
                </p>
              </div>
              <button onClick={() => p.pick(person)} disabled={!person.email}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/80 hover:bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                <Mail className="w-3 h-3" /> Send Email
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recipient</label>
          <div className="mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white">
            {p.selected ? `${p.selected.full_name} · ${p.selected.email ?? 'no email'}` : <span className="text-gray-600">Pick a user from the list</span>}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Template</label>
          <select value={p.template} onChange={(e: any) => p.setTemplate(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            {p.templates.map((t: Template) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {p.isCustom && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Subject</label>
              <input value={p.subject} onChange={(e: any) => p.setSubject(e.target.value)} placeholder="A message from M.G.BIT"
                className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</label>
              <textarea value={p.message} onChange={(e: any) => p.setMessage(e.target.value)} rows={5} placeholder="Type your message…"
                className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none" />
            </div>
          </>
        )}

        {p.result && (
          <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
            p.result.ok ? 'text-emerald-300 bg-emerald-900/20 border-emerald-800/40'
                        : 'text-red-300 bg-red-900/20 border-red-800/40'}`}>
            {p.result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            {p.result.text}
          </div>
        )}

        <button onClick={p.send} disabled={p.sending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
          {p.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Email
        </button>
      </div>
    </div>
  );
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data as EmailLog[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const types = useMemo(() => Array.from(new Set(logs.map(l => l.type).filter(Boolean))) as string[], [logs]);
  const shown = useMemo(() => logs.filter(l =>
    (statusFilter === 'all' || l.status === statusFilter) &&
    (typeFilter === 'all' || l.type === typeFilter)), [logs, statusFilter, typeFilter]);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none">
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none">
          <option value="all">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-gray-500">{shown.length} of {logs.length}</span>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Recipient</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Resend ID</th>
              <th className="px-4 py-2.5 font-medium">Related</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500"><FileText className="w-5 h-5 inline mr-1" /> No email logs.</td></tr>
            ) : shown.map(l => (
              <tr key={l.id} className="hover:bg-gray-800/40">
                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-gray-200">{l.email ?? '—'}</td>
                <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-xs">{l.type ?? '—'}</span></td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    l.status === 'sent' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>
                    {l.status === 'sent' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {l.status}
                  </span>
                  {l.error && <p className="text-[11px] text-red-400/80 mt-1 max-w-[260px] truncate" title={l.error}>{l.error}</p>}
                </td>
                <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{l.provider_id ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {l.project_id ? <div>proj: {l.project_id.slice(0, 8)}…</div> : null}
                  {l.bid_id ? <div>bid: {l.bid_id.slice(0, 8)}…</div> : null}
                  {!l.project_id && !l.bid_id ? '—' : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
