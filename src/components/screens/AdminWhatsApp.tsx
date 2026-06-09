import { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle, Send, CheckCircle2, AlertTriangle, Loader2, Search, Link2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsapp, APP_URL } from '../../lib/whatsapp';

interface Person { id: string; full_name: string; phone?: string; role: string; email?: string }

const ROLE_LABEL: Record<string, string> = {
  property_owner: 'Owner',
  contractor: 'Contractor',
  admin: 'Admin',
};

export function AdminWhatsApp() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [appendLink, setAppendLink] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, email')
        .order('full_name');
      setPeople(data ?? []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return people;
    return people.filter(p =>
      p.full_name?.toLowerCase().includes(s) ||
      (p.phone ?? '').includes(s) ||
      (p.email ?? '').toLowerCase().includes(s));
  }, [people, search]);

  function pick(p: Person) {
    setSelectedId(p.id);
    setPhone(p.phone ?? '');
    setResult(null);
  }

  const finalMessage = appendLink && message.trim()
    ? `${message.trim()}\n\n👉 Log in to the platform:\n${APP_URL}`
    : message.trim();

  async function send() {
    setResult(null);
    if (!phone.trim()) { setResult({ ok: false, text: 'Enter a phone number or pick a recipient.' }); return; }
    if (!message.trim()) { setResult({ ok: false, text: 'Write a message first.' }); return; }
    setSending(true);
    try {
      await whatsapp.custom(phone.trim(), finalMessage);
      setResult({ ok: true, text: `Message sent to ${phone.trim()}.` });
      setMessage('');
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-400" /> Send WhatsApp
        </h2>
        <p className="text-gray-500 text-xs mt-0.5">Send a WhatsApp message to any user, or to a number you type in.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Recipients */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email…"
                className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
            </div>
          </div>
          <div className="divide-y divide-gray-800 max-h-[420px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No users match.</div>
            ) : filtered.map(p => (
              <button key={p.id} onClick={() => pick(p)}
                className={`w-full text-left px-4 py-3 transition-colors ${selectedId === p.id ? 'bg-blue-600/20' : 'hover:bg-gray-800/50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white truncate">{p.full_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 flex-shrink-0">{ROLE_LABEL[p.role] ?? p.role}</span>
                </div>
                <p className={`text-xs mt-0.5 ${p.phone ? 'text-gray-400' : 'text-red-400'}`}>
                  {p.phone ? p.phone : 'no phone on file'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</label>
            <input value={phone} onChange={e => { setPhone(e.target.value); setSelectedId(''); }} placeholder="+1 818 385 5609"
              className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} placeholder="Type your message…"
              className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={appendLink} onChange={e => setAppendLink(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500" />
            <Link2 className="w-4 h-4 text-blue-400" />
            Append login link ({APP_URL})
          </label>

          {appendLink && message.trim() && (
            <div className="text-xs text-gray-500 bg-gray-800/60 rounded-lg px-3 py-2 whitespace-pre-wrap border border-gray-800">
              {finalMessage}
            </div>
          )}

          {result && (
            <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
              result.ok ? 'text-emerald-300 bg-emerald-900/20 border-emerald-800/40'
                        : 'text-red-300 bg-red-900/20 border-red-800/40'}`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {result.text}
            </div>
          )}

          <button onClick={send} disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
