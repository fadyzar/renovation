import { useState } from 'react';
import { ArrowLeft, Send, CheckCircle, MessageCircle, AlertCircle, HelpCircle, CreditCard, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIES = [
  { value: 'general',    label: 'General Question',   icon: HelpCircle    },
  { value: 'payment',    label: 'Payment Issue',       icon: CreditCard    },
  { value: 'contractor', label: 'Contractor Problem',  icon: Briefcase     },
  { value: 'project',    label: 'Project Issue',       icon: AlertCircle   },
  { value: 'technical',  label: 'Technical Problem',   icon: MessageCircle },
  { value: 'other',      label: 'Other',               icon: HelpCircle    },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low — not urgent'        },
  { value: 'normal', label: 'Normal — within 24h'     },
  { value: 'high',   label: 'High — needs attention'  },
  { value: 'urgent', label: 'Urgent — critical issue' },
];

export default function Support() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !profile) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await supabase.from('support_tickets').insert({
      user_id: profile.id, subject: subject.trim(), message: message.trim(), category, priority,
    });
    setSubmitting(false);
    if (err) { setError('Failed to submit. Please try again.'); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ticket Submitted!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Our team will review your request and respond as soon as possible.
          </p>
          <button onClick={() => navigate('/dashboard')} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contact Support</h1>
            <p className="text-sm text-gray-500">We typically respond within a few hours</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">What is this about?</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left ${
                    category === c.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                  <c.icon className="w-4 h-4 flex-shrink-0" />{c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map(p => (
                <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors text-left ${
                    priority === p.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Brief summary of your issue" required
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue in detail — include project names, dates, or amounts." required rows={5}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting || !subject.trim() || !message.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>

          <p className="text-center text-xs text-gray-400">
            We'll reply to: {profile?.email ?? profile?.phone ?? 'your registered contact'}
          </p>
        </form>
      </div>
    </div>
  );
}
