import { useState } from 'react';
import { X, Plus, DollarSign, Calendar, FileText, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  const [message, setMessage] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: '1', description: '', price: '', duration: '' }
  ]);

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

  const validateBid = () => {
    if (message.trim() === '') {
      return 'Please add a message to the property owner';
    }

    if (milestones.some(m => !m.description.trim() || !m.price || !m.duration)) {
      return 'Please complete all milestone fields';
    }

    const total = calculateTotal();
    if (total <= 0) {
      return 'Total price must be greater than 0';
    }

    if (total < project.budget_min * 0.5 || total > project.budget_max * 2) {
      return 'Your bid is significantly outside the budget range. Please review.';
    }

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

      const { error: insertError } = await supabase
        .from('bids')
        .insert({
          project_id: project.id,
          contractor_id: profile?.id,
          total_price: calculateTotal(),
          milestones: milestonesData,
          message: message,
          status: 'sent'
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">Project Budget Range</p>
            <p className="text-2xl font-bold text-blue-700">
              ${(project.budget_min / 1000).toFixed(0)}k - ${(project.budget_max / 1000).toFixed(0)}k
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Property Owner
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce yourself and explain your approach to this project..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
              required
            />
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
                  Your bid is outside the project budget range. Consider adjusting your pricing.
                </p>
              </div>
            )}

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
      </div>
    </div>
  );
}
