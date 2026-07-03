import { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle, Send, CheckCircle2, AlertTriangle, Loader2, Search, FlaskConical,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsapp, WA_TEMPLATES, getWaTemplate } from '../../lib/whatsapp';

interface Person { id: string; full_name: string; phone?: string; role: string; email?: string }

const ROLE_LABEL: Record<string, string> = {
  property_owner: 'Owner',
  contractor: 'Contractor',
  admin: 'Admin',
};

type RecipientType = 'property_owner' | 'contractor' | 'manual';

export function AdminWhatsApp() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [templateId, setTemplateId] = useState('custom');
  const [recipientType, setRecipientType] = useState<RecipientType>('manual');
  const [selectedId, setSelectedId] = useState('');
  const [phone, setPhone] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
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

  const template = getWaTemplate(templateId)!;

  // When a template is picked, default the recipient type to its audience.
  useEffect(() => {
    if (template.audience !== 'any') setRecipientType(template.audience);
    setFields({});
    setResult(null);
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recipient list filtered by the chosen recipient type + search text.
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return people.filter((p) => {
      if (recipientType !== 'manual' && p.role !== recipientType) return false;
      if (!s) return true;
      return (
        p.full_name?.toLowerCase().includes(s) ||
        (p.phone ?? '').includes(s) ||
        (p.email ?? '').toLowerCase().includes(s)
      );
    });
  }, [people, search, recipientType]);

  function pick(p: Person) {
    setSelectedId(p.id);
    setPhone(p.phone ?? '');
    // Prefill a name field if the template has one.
    const nameKey = template.fields.find((f) => /name$/i.test(f.key))?.key;
    if (nameKey) setFields((prev) => ({ ...prev, [nameKey]: p.full_name }));
    setResult(null);
  }

  const preview = useMemo(() => template.build(fields), [template, fields]);

  async function sendMessage() {
    setResult(null);
    if (!phone.trim()) { setResult({ ok: false, text: 'Enter a phone number or pick a recipient.' }); return; }
    if (!preview.trim()) { setResult({ ok: false, text: 'Fill in the template fields first.' }); return; }
    setSending(true);
    try {
      await whatsapp.custom(phone.trim(), preview, {
        recipient_id: recipientType !== 'manual' ? selectedId || undefined : undefined,
        recipient_type: recipientType === 'manual' ? 'manual' : recipientType,
        event_type: `admin_manual:${templateId}`,
      });
      setResult({ ok: true, text: `Message sent to ${phone.trim()}.` });
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
        <p className="text-gray-500 text-xs mt-0.5">Pick a template, choose a recipient, preview, and send.</p>
      </div>

      {/* Test-mode reminder */}
      <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 border text-amber-300 bg-amber-900/15 border-amber-800/40">
        <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
        If <code className="px-1">WHATSAPP_TEST_MODE</code> is enabled on the server, every message here is rerouted to the test number regardless of the recipient shown.
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: template + recipient */}
        <div className="space-y-4">
          {/* Template */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Template</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              {WA_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            {/* Recipient type */}
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block pt-1">Recipient</label>
            <div className="flex gap-2">
              {(['property_owner', 'contractor', 'manual'] as RecipientType[]).map((rt) => (
                <button key={rt} onClick={() => { setRecipientType(rt); setSelectedId(''); }}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                    recipientType === rt ? 'bg-blue-600/20 border-blue-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-800/70'}`}>
                  {rt === 'manual' ? 'Manual #' : ROLE_LABEL[rt]}
                </button>
              ))}
            </div>

            {/* Template fields */}
            {template.fields.filter((f) => f.key !== 'message').length > 0 && (
              <div className="space-y-2 pt-1">
                {template.fields.filter((f) => f.key !== 'message').map((f) => (
                  <div key={f.key}>
                    <label className="text-[11px] text-gray-500">{f.label}</label>
                    <input value={fields[f.key] ?? ''} onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-0.5 w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
                  </div>
                ))}
              </div>
            )}
            {template.fields.some((f) => f.key === 'message') && (
              <div>
                <label className="text-[11px] text-gray-500">Message</label>
                <textarea value={fields.message ?? ''} onChange={(e) => setFields((p) => ({ ...p, message: e.target.value }))}
                  rows={5} placeholder="Type your message…"
                  className="mt-0.5 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none" />
              </div>
            )}
          </div>

          {/* Recipient picker (manual = free phone; else pick a person) */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-800 space-y-2">
              <div>
                <label className="text-[11px] text-gray-500">Phone</label>
                <input value={phone} onChange={(e) => { setPhone(e.target.value); setSelectedId(''); }} placeholder="+972 54 208 6830"
                  className="mt-0.5 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
              </div>
              {recipientType !== 'manual' && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${ROLE_LABEL[recipientType]}s…`}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
                </div>
              )}
            </div>
            {recipientType !== 'manual' && (
              <div className="divide-y divide-gray-800 max-h-[220px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No {ROLE_LABEL[recipientType]}s match.</div>
                ) : filtered.map((p) => (
                  <button key={p.id} onClick={() => pick(p)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${selectedId === p.id ? 'bg-blue-600/20' : 'hover:bg-gray-800/50'}`}>
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
            )}
          </div>
        </div>

        {/* Right: preview + send */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-4 flex flex-col">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview</label>
          <div className="flex-1 text-sm text-gray-200 bg-gray-800/60 rounded-lg px-3 py-3 whitespace-pre-wrap border border-gray-800 min-h-[220px]">
            {preview.trim() || <span className="text-gray-600">Fill the fields to preview the message…</span>}
          </div>

          {result && (
            <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
              result.ok ? 'text-emerald-300 bg-emerald-900/20 border-emerald-800/40'
                        : 'text-red-300 bg-red-900/20 border-red-800/40'}`}>
              {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {result.text}
            </div>
          )}

          <button onClick={sendMessage} disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
