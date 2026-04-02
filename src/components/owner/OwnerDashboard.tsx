import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Home, Clock, CheckCircle, AlertCircle, Send, Eye, Hourglass, Users, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PublishProjectModal } from './PublishProjectModal';
import { ProjectTimeline } from '../shared/ProjectTimeline';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget_min: number;
  budget_max: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  work_types: string[];
  selected_contractor_id?: string | null;
  selected_contractor?: {
    full_name: string;
  };
  transactions?: Array<{
    initial_deposit_paid: boolean;
  }>;
  ai_analysis?: {
    estimated_cost?: number;
    complexity?: string;
    timeline_weeks?: number;
  };
}

export function OwnerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingProject, setPublishingProject] = useState<Project | null>(null);
  const [publishingLoading, setPublishingLoading] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          selected_contractor:profiles!projects_selected_contractor_id_fkey(full_name),
          transactions(initial_deposit_paid)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleProjectExpanded(projectId: string) {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  }

  async function publishProject(project: Project) {
    setPublishingLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'seeking_quotes' })
        .eq('id', project.id);

      if (error) throw error;

      setPublishingProject(null);
      loadProjects();
    } catch (error) {
      console.error('Error publishing project:', error);
      alert('Failed to publish project');
    } finally {
      setPublishingLoading(false);
    }
  }

  const statusConfig = {
    draft: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Draft' },
    seeking_quotes: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Seeking Quotes' },
    awaiting_deposit: { icon: Hourglass, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Awaiting Contractor Deposit' },
    in_progress: { icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100', label: 'In Progress' },
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
    cancelled: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Cancelled' },
    disputed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Disputed' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
            <p className="text-gray-600 mt-1">Manage your renovation projects</p>
          </div>
          <button
            onClick={() => navigate('/create-project')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/30"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {projects.filter(p => p.status === 'in_progress').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {projects.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Seeking Quotes</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {projects.filter(p => p.status === 'seeking_quotes').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-6">Create your first renovation project to get started</p>
          <button
            onClick={() => navigate('/create-project')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {projects.map(project => {
            const config = statusConfig[project.status as keyof typeof statusConfig];
            const StatusIcon = config.icon;

            return (
              <div
                key={project.id}
                className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {project.status === 'seeking_quotes' && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full">
                        <Eye className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Published</span>
                      </div>
                    )}
                    <div className={`flex items-center gap-2 px-3 py-1.5 ${config.bg} rounded-full`}>
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {project.work_types.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Services:</span>
                      <div className="flex gap-2">
                        {project.work_types.slice(0, 3).map(type => (
                          <span key={type} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs">
                            {type}
                          </span>
                        ))}
                        {project.work_types.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs">
                            +{project.work_types.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {project.budget_min && project.budget_max && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Budget:</span>
                      <span className="font-medium text-gray-900">
                        ${project.budget_min.toLocaleString()} - ${project.budget_max.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {project.ai_analysis?.timeline_weeks && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Timeline:</span>
                      <span className="font-medium text-gray-900">
                        {project.ai_analysis.timeline_weeks} weeks
                      </span>
                    </div>
                  )}
                </div>

                {project.status === 'draft' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => setPublishingProject(project)}
                      className="flex items-center gap-2 flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Publish Project
                    </button>
                  </div>
                )}

                {project.status === 'seeking_quotes' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/contractor-matching/${project.id}`)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      View Bids &amp; Select Contractor
                    </button>
                  </div>
                )}

                {project.status === 'in_progress' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/project/${project.id}/payments`)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                    >
                      <DollarSign className="w-4 h-4" />
                      View &amp; Approve Payments
                    </button>
                  </div>
                )}

                {project.status === 'awaiting_deposit' && (
                  <div className="mt-4 pt-4 border-t border-amber-100">
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <Hourglass className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Waiting for contractor deposit
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Your selected contractor must pay a 10% security deposit before the
                          project becomes active. They have been notified.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => toggleProjectExpanded(project.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 font-medium bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span>View Project Timeline</span>
                    {expandedProjects.has(project.id) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {expandedProjects.has(project.id) && (
                    <div className="mt-4">
                      <ProjectTimeline
                        projectStatus={project.status}
                        selectedContractorName={project.selected_contractor?.full_name}
                        depositPaid={project.transactions?.[0]?.initial_deposit_paid || false}
                        startedAt={project.started_at}
                        completedAt={project.completed_at}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {publishingProject && (
        <PublishProjectModal
          project={publishingProject}
          loading={publishingLoading}
          onPublish={() => publishProject(publishingProject)}
          onClose={() => setPublishingProject(null)}
        />
      )}
    </div>
  );
}
