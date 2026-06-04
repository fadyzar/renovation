import { useState } from 'react';
import { X, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WORK_TYPES = [
  'Electrical',
  'Plumbing',
  'Painting',
  'Flooring',
  'Roofing',
  'Kitchen Remodel',
  'Bathroom Remodel',
  'HVAC',
  'Landscaping',
  'Carpentry',
  'Drywall',
  'Windows & Doors',
];

export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    work_types: [] as string[],
    budget_min: '',
    budget_max: '',
    urgency: 'medium' as 'low' | 'medium' | 'high',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
  });

  const [aiAnalysis, setAiAnalysis] = useState<{
    complexity: string;
    estimated_cost: number;
    timeline_weeks: number;
    detected_work_types: string[];
    risk_factors: string[];
    recommendations?: string[];
    confidence_score?: number;
  } | null>(null);

  if (!isOpen) return null;

  async function analyzeWithAI() {
    setAnalyzing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-project`;

      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: formData.description,
          work_types: formData.work_types,
          budget_min: parseFloat(formData.budget_min) || undefined,
          budget_max: parseFloat(formData.budget_max) || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze project');
      }

      const analysis = await response.json();
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing project:', error);
      alert('Failed to analyze project. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);

    try {
      if (formData.phone) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone: formData.phone })
          .eq('id', user?.id);

        if (profileError) throw profileError;
      }

      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .insert({
          owner_id: user?.id,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
        })
        .select()
        .single();

      if (propertyError) throw propertyError;

      const { error } = await supabase
        .from('projects')
        .insert({
          owner_id: user?.id,
          property_id: propertyData.id,
          title: formData.title,
          description: formData.description,
          work_types: formData.work_types,
          budget_min: parseFloat(formData.budget_min) || null,
          budget_max: parseFloat(formData.budget_max) || null,
          timeline_weeks: aiAnalysis?.timeline_weeks || null,
          urgency: formData.urgency,
          status: 'draft',
          ai_analysis: aiAnalysis || {},
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Create New Project</h2>
            <p className="text-sm text-gray-600 mt-1">Step {step} of 2</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Kitchen Renovation"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what you want to accomplish..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Type of Work Needed
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {WORK_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const newTypes = formData.work_types.includes(type)
                          ? formData.work_types.filter(t => t !== type)
                          : [...formData.work_types, type];
                        setFormData({ ...formData, work_types: newTypes });
                      }}
                      className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        formData.work_types.includes(type)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={formData.budget_min}
                      onChange={(e) => setFormData({ ...formData, budget_min: e.target.value })}
                      placeholder="10000"
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={formData.budget_max}
                      onChange={(e) => setFormData({ ...formData, budget_max: e.target.value })}
                      placeholder="50000"
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Urgency
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['low', 'medium', 'high'] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: level })}
                      className={`px-4 py-3 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                        formData.urgency === level
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Details</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="123 Main Street"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="New York"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="NY"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      placeholder="10001"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {!aiAnalysis ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Analysis</h3>
                  <p className="text-gray-600 mb-6">Let AI analyze your project and provide insights</p>
                  <button
                    onClick={analyzeWithAI}
                    disabled={analyzing}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {analyzing ? 'Analyzing...' : 'Analyze Project'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">AI Analysis Results</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Complexity</p>
                        <p className="text-lg font-semibold text-gray-900">{aiAnalysis.complexity}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Estimated Cost</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${aiAnalysis.estimated_cost.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Timeline</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {aiAnalysis.timeline_weeks} weeks
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Work Types</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {aiAnalysis.detected_work_types.length}
                        </p>
                      </div>
                    </div>

                    {aiAnalysis.risk_factors.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-orange-900 mb-2">Risk Factors</p>
                        <ul className="space-y-1">
                          {aiAnalysis.risk_factors.map((risk, i) => (
                            <li key={i} className="text-sm text-orange-700">• {risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-900 mb-2">Recommendations</p>
                        <ul className="space-y-1">
                          {aiAnalysis.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-blue-700">• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step === 1) {
                setStep(2);
              } else {
                handleSubmit();
              }
            }}
            disabled={loading || (step === 1 && !formData.title)}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : step === 1 ? 'Continue' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
