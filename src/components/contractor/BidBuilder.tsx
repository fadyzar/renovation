import { useState, useEffect } from 'react';
import { X, Plus, DollarSign, Calendar, FileText, Trash2, AlertCircle, CheckCircle, Ruler, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScanDataPanel, type ScanData } from '../shared/ScanDataPanel';
import { estimateCost, checkBidDeviation, type CostEstimate } from '../../lib/costEstimator';

interface Project {
  id: string;
  title: string;
  description: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
}

interface Milestone {
  id: string;
  description: string;
  price: string;
  duration: string;
}

interface BidBuilderProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

export function BidBuilder({ project, onClose, onSuccess }: BidBuilderProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [alreadyBid, setAlreadyBid] = useState(false);
  const [message, setMessage] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: '1', description: '', price: '', duration: '' }
  ]);
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [messageWarning, setMessageWarning] = useState<string | null>(null);

  // Check for duplicate bid on mount — contractor can only bid once per project
  useEffect(() => {
    async function checkExistingBid() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('bids')
        .select('id')
        .eq('project_id', project.id)
        .eq('contractor_id', profile.id)
        .maybeSingle();
      if (data) setAlreadyBid(true);
    }
    checkExistingBid();
  }, [project.id, profile?.id]);

  // Load scan data and compute estimate on mount
  useEffect(() => {
    async function loadScan() {
      const { data } = await supabase
        .from('project_scans')
        .select('*')
        .eq('project_id', project.id)
        .maybeSingle();
      if (data) {
        setScanData(data as ScanData);
        const estimate = estimateCost(
          {
            measured_area_sqft: data.measured_area_sqft,
            wall_area_sqft: data.wall_area_sqft,
            room_height_ft: data.room_height_ft,
            detected_room_type: data.detected_room_type,
            estimated_complexity: data.estimated_complexity,
            detected_features: data.detected_features ?? [],
            scan_confidence: data.scan_confidence,
          },
          { work_types: project.work_types, budget_min: project.budget_min, budget_max: project.budget_max }
        );
        setCostEstimate(estimate);
      }
    }
    loadScan();
  }, [project.id, project.work_types, project.budget_min, project.budget_max]);

  // Detect contact info in bid messages to prevent platform bypass
  const CONTACT_PATTERNS = [
    { re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'email address' },
    { re: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, label: 'phone number' },
    { re: /whatsapp|wa\.me|telegram|t\.me|signal/i, label: 'messaging app link' },
    { re: /instagram\.com|facebook\.com|linkedin\.com\/in\//i, label: 'social media link' },
  ];

  function checkMessageForContactInfo(text: string): string | null {
    for (const { re, label } of CONTACT_PATTERNS) {
      if (re.test(text)) {
        return `Your message appears to contain a ${label}. Contact details are shared through the platform after the deposit is paid to protect both parties.`;
      }
    }
    return null;
  }

  function handleMessageChange(value: string) {
    setMessage(value);
    setMessageWarning(checkMessageForContactInfo(value));
  }

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      { id: Date.now().toString(), description: '', price: '', duration: '' }
    ]);
  };

  const removeMilestone = (id: string) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter(m => m.id !== id));
    }
  };

  const updateMilestone = (id: string, field: keyof Milestone, value: string) => {
    setMilestones(milestones.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const calculateTotal = () => {
    return milestones.reduce((sum, m) => {
      const price = parseFloat(m.price) || 0;
      return sum + price;
    }, 0);
  };

  // Populate milestones from AI cost estimate suggestions
  const applyEstimateMilestones = () => {
    if (!costEstimate) return;
    const totalCost = (costEstimate.estimated_min + costEstimate.estimated_max) / 2;
    const suggested = costEstimate.suggested_milestones.map((sm, i) => ({
      id: `est_${i}`,
      description: sm.description,
      price: String(Math.round((sm.pct / 100) * totalCost / 100) * 100 || 0),
      duration: String(sm.duration_days),
    }));
    setMilestones(suggested);
  };

  const validateBid = () => {
    if (message.trim() === '') {
      return 'Please add a message to the property owner';
    }

    if (checkMessageForContactInfo(message)) {
      return 'Please remove contact details from your message. Contact info is shared through the platform after the deposit is paid.';
    }

    if (milestones.some(m => !m.description.trim() || !m.price || !m.duration)) {
      return 'Please complete all milestone fields';
    }

    const total = calculateTotal();
    if (total <= 0) {
      return 'Total price must be greater than 0';
    }

    // NOTE: Budget range is a RECOMMENDATION signal, not a hard gate.
    // Contractors can bid any amount — the budget warning below is advisory only.
    // Do NOT block submission based on budget here.

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateBid();
    if (error) {
      alert(error);
      return;
    }

    setLoading(true);

    try {
      const milestonesData = milestones.map(m => ({
        description: m.description,
        price: parseFloat(m.price),
        duration: parseInt(m.duration)
      }));

      // status: 'submitted' — canonical status for a newly placed bid
      // ContractorMatching queries this status to show owner all received bids
      const { error: insertError } = await supabase
        .from('bids')
        .insert({
          project_id: project.id,
          contractor_id: profile?.id,
          total_price: calculateTotal(),
          milestones: milestonesData,
          message: message,
          status: 'submitted'
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting bid:', error);
      alert('Failed to submit bid. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = calculateTotal();
  const isOutsideBudget = totalPrice < project.budget_min || totalPrice > project.budget_max;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Submit Bid</h2>
            <p className="text-gray-600 mt-1">{project.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {alreadyBid ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bid Already Submitted</h3>
            <p className="text-gray-600 mb-6">
              You've already submitted a bid on this project. The owner will review all bids and contact you if selected.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">Project Budget Range</p>
            <p className="text-2xl font-bold text-blue-700">
              ${(project.budget_min / 1000).toFixed(0)}k - ${(project.budget_max / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-blue-700 mt-1">
              You may bid above or below this range — it is a guideline, not a hard limit.
            </p>
          </div>

          {/* ── Space scan data ── */}
          {scanData && (
            <ScanDataPanel scan={scanData} variant="inline" expanded />
          )}

          {/* ── AI cost estimate ── */}
          {costEstimate && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-gray-900">AI Cost Estimate</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    costEstimate.confidence === 'high'     ? 'bg-green-100 text-green-700' :
                    costEstimate.confidence === 'medium'   ? 'bg-blue-100 text-blue-700' :
                    costEstimate.confidence === 'low'      ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {costEstimate.confidence === 'fallback' ? 'no scan — estimate only' : `${costEstimate.confidence} confidence`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={applyEstimateMilestones}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Use suggested milestones →
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-gray-900">
                    ${costEstimate.estimated_min.toLocaleString()} – ${costEstimate.estimated_max.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500">estimated range</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>~{costEstimate.estimated_duration_days} days</span>
                  <span>·</span>
                  <span className="capitalize">complexity {costEstimate.complexity_score}/10</span>
                </div>
                <p className="text-xs text-gray-400">{costEstimate.basis}</p>

                {/* Suggested milestone list */}
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggested Milestones</p>
                  {costEstimate.suggested_milestones.map((sm, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-700">{sm.description}</span>
                      <span className="text-gray-500 ml-2 whitespace-nowrap">{sm.pct}% · {sm.duration_days}d</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Property Owner
            </label>
            <textarea
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              placeholder="Introduce yourself and explain your approach to this project..."
              rows={4}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all resize-none ${
                messageWarning
                  ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
              required
            />
            {messageWarning && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{messageWarning}</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Project Milestones</h3>
                <p className="text-sm text-gray-600">Break down your work into phases</p>
              </div>
              <button
                type="button"
                onClick={addMilestone}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Milestone
              </button>
            </div>

            <div className="space-y-4">
              {milestones.map((milestone, index) => (
                <div key={milestone.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Milestone {index + 1}</h4>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(milestone.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={milestone.description}
                          onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                          placeholder="e.g., Demolition and prep work"
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price ($)
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="number"
                            value={milestone.price}
                            onChange={(e) => updateMilestone(milestone.id, 'price', e.target.value)}
                            placeholder="0"
                            step="0.01"
                            min="0"
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (days)
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="number"
                            value={milestone.duration}
                            onChange={(e) => updateMilestone(milestone.id, 'duration', e.target.value)}
                            placeholder="0"
                            min="1"
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold text-gray-900">Total Bid Amount</span>
              <span className="text-3xl font-bold text-gray-900">
                ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {isOutsideBudget && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Your bid is outside the owner's budget range. You can still submit — the owner will review all bids.
                </p>
              </div>
            )}

            {/* AI estimate deviation — only when estimate exists and bid is non-zero */}
            {costEstimate && totalPrice > 0 && (() => {
              const dev = checkBidDeviation(totalPrice, costEstimate);
              if (dev.level === 'on_target') return null;
              return (
                <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg border ${
                  dev.level === 'significantly_off'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <Ruler className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    dev.level === 'significantly_off' ? 'text-orange-600' : 'text-blue-600'
                  }`} />
                  <p className={`text-sm ${
                    dev.level === 'significantly_off' ? 'text-orange-800' : 'text-blue-800'
                  }`}>
                    <span className="font-semibold">AI estimate check: </span>
                    {dev.message}
                  </p>
                </div>
              );
            })()}

            <div className="mt-3 text-sm text-gray-600">
              Total duration: {milestones.reduce((sum, m) => sum + (parseInt(m.duration) || 0), 0)} days
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Bid'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
