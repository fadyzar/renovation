import { X, Send, CheckCircle, Users, Zap } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  description: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
}

interface PublishProjectModalProps {
  project: Project;
  loading: boolean;
  onPublish: () => void;
  onClose: () => void;
}

export function PublishProjectModal({
  project,
  loading,
  onPublish,
  onClose,
}: PublishProjectModalProps) {
  const minBudget = project.budget_min.toLocaleString();
  const maxBudget = project.budget_max.toLocaleString();
  
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-900">Publish Project</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.title}</h3>
            <p className="text-gray-600 text-sm line-clamp-3 mb-4">{project.description}</p>

            <div className="space-y-2">
              {project.work_types.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Services Required:</p>
                  <div className="flex flex-wrap gap-2">
                    {project.work_types.map(type => (
                      <span key={type} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-600">Budget Range:</span>
                <span className="font-semibold text-gray-900">
                  {minBudget} - {maxBudget}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 text-sm">Visible to Contractors</p>
                <p className="text-xs text-blue-700">Your project will be listed for verified contractors to view and quote</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 text-sm">Receive Quotes</p>
                <p className="text-xs text-green-700">Contractors will submit their pricing and timeline proposals</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
              <Zap className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900 text-sm">AI Matching</p>
                <p className="text-xs text-orange-700">Our AI will highlight the best-matched contractors for your needs</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-600 mb-4">
              Once published, you'll be able to review quotes from contractors, compare their experience and pricing, and select the best fit for your project.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onPublish}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
