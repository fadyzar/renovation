import { useState, useEffect } from 'react';
import { Briefcase, TrendingUp, Star, DollarSign, Search, MapPin, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
  urgency: string;
  created_at: string;
  ai_analysis?: {
    complexity?: string;
    timeline_weeks?: number;
  };
  owner: {
    full_name: string;
    location?: {
      city?: string;
      state?: string;
    };
  };
}

export function ContractorDashboard() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myQuotes, setMyQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(full_name, location)
        `)
        .eq('status', 'seeking_quotes')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          *,
          project:projects(title, status)
        `)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;

      setProjects(projectsData || []);
      setMyQuotes(quotesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter(project =>
    searchQuery === '' ||
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.work_types.some(type => type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    totalQuotes: myQuotes.length,
    pending: myQuotes.filter(q => q.status === 'pending').length,
    accepted: myQuotes.filter(q => q.status === 'accepted').length,
    totalValue: myQuotes.reduce((sum, q) => sum + (q.amount || 0), 0),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Available Projects</h1>
        <p className="text-gray-600">Find and bid on renovation projects</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Quotes</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalQuotes}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.accepted}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${Math.round(stats.totalValue / 1000)}k
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, description, or work type..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-600">Check back later for new opportunities</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
                    {project.urgency === 'high' && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-3">{project.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    {project.owner?.location?.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{project.owner.location.city}, {project.owner.location.state}</span>
                      </div>
                    )}

                    {project.ai_analysis?.timeline_weeks && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{project.ai_analysis.timeline_weeks} weeks</span>
                      </div>
                    )}

                    {project.ai_analysis?.complexity && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs">
                        {project.ai_analysis.complexity} Complexity
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right ml-4">
                  <p className="text-sm text-gray-600 mb-1">Budget Range</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${project.budget_min?.toLocaleString()} - ${project.budget_max?.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {project.work_types.slice(0, 4).map(type => (
                    <span key={type} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                      {type}
                    </span>
                  ))}
                  {project.work_types.length > 4 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                      +{project.work_types.length - 4} more
                    </span>
                  )}
                </div>

                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  Submit Quote
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
