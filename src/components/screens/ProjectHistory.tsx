import { useState, useEffect } from 'react';
import { MapPin, Clock, DollarSign, CheckCircle, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  description: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  budget_min: number;
  budget_max: number;
  status: string;
  created_at: string;
  completed_at?: string;
  selected_contractor_id?: string;
  contractor?: {
    full_name: string;
    company_name?: string;
  };
}

const statusConfig = {
  draft: { label: 'Draft', icon: AlertCircle, color: 'text-gray-500 bg-gray-100' },
  seeking_quotes: { label: 'Seeking Quotes', icon: Clock, color: 'text-blue-500 bg-blue-100' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-orange-500 bg-orange-100' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-500 bg-green-100' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500 bg-red-100' },
};

export default function ProjectHistory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'active'>('all');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          contractor:profiles!projects_selected_contractor_id_fkey(full_name, company_name)
        `)
        .eq('owner_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter((p) => {
    if (filter === 'completed') return p.status === 'completed';
    if (filter === 'active') return p.status !== 'completed' && p.status !== 'cancelled';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Project History</h1>
          <p className="text-gray-600">View all your renovation projects and their status</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-3 mb-6">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-full font-medium transition-all ${
                filter === f
                  ? 'bg-brand-blue text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {f === 'all' ? 'All Projects' : f === 'active' ? 'Active' : 'Completed'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'completed'
                ? "You don't have any completed projects yet"
                : filter === 'active'
                ? "You don't have any active projects"
                : "You haven't created any projects yet"}
            </p>
            <button
              onClick={() => navigate('/create-project')}
              className="px-8 py-3 bg-brand-orange hover:opacity-90 text-white font-semibold rounded-full transition-opacity"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredProjects.map((project) => {
              const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.draft;
              const StatusIcon = status.icon;

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/contractor-matching/${project.id}`)}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{project.title}</h3>
                      <p className="text-gray-600 line-clamp-2">{project.description}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full flex items-center gap-2 font-medium ${status.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {project.address && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {project.city}, {project.state}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        ${project.budget_min?.toLocaleString()} - ${project.budget_max?.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {project.completed_at && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">
                          Completed {new Date(project.completed_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {project.contractor && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        Contractor:{' '}
                        <span className="font-semibold text-gray-900">
                          {project.contractor.company_name || project.contractor.full_name}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
