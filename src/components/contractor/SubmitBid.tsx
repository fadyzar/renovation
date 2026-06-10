import { useState } from 'react';
import { Plus, ArrowRight, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { validateMessage, getViolationMessage } from '../../utils/contactDetection';

interface Milestone {
  id: string;
  name: string;
  cost: string;
}

interface SubmitBidProps {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SubmitBid({ projectId, onSuccess, onCancel }: SubmitBidProps) {
  const { profile } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: '1', name: '', cost: '' },
    { id: '2', name: '', cost: '' },
    { id: '3', name: '', cost: '' },
    { id: '4', name: '', cost: '' }
  ]);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addMilestone = () => {
    const newId = (Math.max(...milestones.map(m => parseInt(m.id))) + 1).toString();
    setMilestones([...milestones, { id: newId, name: '', cost: '' }]);
  };

  const updateMilestone = (id: string, field: 'name' | 'cost', value: string) => {
    setMilestones(milestones.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const removeMilestone = (id: string) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter(m => m.id !== id));
    }
  };

  const calculateTotal = () => {
    return milestones.reduce((sum, m) => {
      const cost = parseFloat(m.cost.replace(/[^0-9.]/g, '')) || 0;
      return sum + cost;
    }, 0);
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/[^0-9.]/g, '');
    const parts = numbers.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return numbers;
  };

  const handleCostChange = (id: string, value: string) => {
    const formatted = formatCurrency(value);
    updateMilestone(id, 'cost', formatted);
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);

    if (value.trim()) {
      const validation = validateMessage(value);
      if (!validation.isValid) {
        setMessageError(getViolationMessage(validation));
      } else {
        setMessageError('');
      }
    } else {
      setMessageError('');
    }
  };

  const handleSubmit = async () => {
    if (!profile) return;

    const validMilestones = milestones.filter(m => m.name.trim() && m.cost.trim());

    if (validMilestones.length === 0) {
      alert('Please add at least one milestone with name and cost');
      return;
    }

    const totalPrice = calculateTotal();
    if (totalPrice <= 0) {
      alert('Total price must be greater than 0');
      return;
    }

    if (message.trim()) {
      const validation = validateMessage(message);
      if (!validation.isValid && (validation.severity === 'critical' || validation.severity === 'high')) {
        setMessageError(getViolationMessage(validation));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const milestonesData = validMilestones.map(m => ({
        description: m.name,
        price: parseFloat(m.cost.replace(/[^0-9.]/g, ''))
      }));

      const { error } = await supabase
        .from('bids')
        .insert({
          project_id: projectId,
          contractor_id: profile.id,
          total_price: totalPrice,
          milestones: milestonesData,
          message: message
        });

      if (error) throw error;

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting bid:', error);
      alert('Failed to submit bid. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Submit Your Bid
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Choose Your MileStones
          </h2>

          <div className="space-y-4 mb-6">
            {milestones.map((milestone, index) => (
              <div key={milestone.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Milestone {index + 1}
                  </label>
                  <input
                    type="text"
                    value={milestone.name}
                    onChange={(e) => updateMilestone(milestone.id, 'name', e.target.value)}
                    placeholder="Type Milestone Name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Cost
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <input
                      type="text"
                      value={milestone.cost}
                      onChange={(e) => handleCostChange(milestone.id, e.target.value)}
                      placeholder="4,715"
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                    />
                    {milestones.length > 1 && (
                      <button
                        onClick={() => removeMilestone(milestone.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200 gap-3">
            <button
              onClick={addMilestone}
              className="px-4 sm:px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add New Milestone</span>
              <span className="sm:hidden">Add Milestone</span>
            </button>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Price</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                ${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Platform commission notice — shown only to the contractor */}
          {calculateTotal() > 0 && (
            <div className="mb-6 flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <Info className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800 space-y-1">
                <p>
                  <span className="font-semibold">M.G.BIT collects a 10% commission</span> on the total payment.
                  You'll receive <span className="font-semibold">${(calculateTotal() * 0.9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> after commission.
                </p>
                <p>
                  To take home your full asking price, we recommend adding 10% to your bid
                  {' '}(≈ <span className="font-semibold">${(calculateTotal() * 1.1).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>).
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Owner (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              placeholder="Add any additional information or questions for the project owner..."
              rows={4}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-gray-700 placeholder-gray-400 resize-none ${
                messageError
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-orange-500 focus:border-transparent'
              }`}
            />
            {messageError && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{messageError}</p>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Contact information can only be shared after the security deposit is paid.
            </p>
          </div>

          <div className="flex gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  Submit a Bid
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
