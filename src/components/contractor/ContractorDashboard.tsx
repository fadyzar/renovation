import { useState, useEffect } from 'react';
import { Briefcase, TrendingUp, Star, DollarSign, Search, MapPin, Calendar, Filter, Clock, AlertCircle } from 'lucide-react';
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
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

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

  let filteredProjects = projects.filter(project =>
    (searchQuery === '' ||
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.work_types.some(type => type.toLowerCase().includes(searchQuery.toLowerCase()))) &&
    (filterUrgency === 'all' || project.urgency === filterUrgency)
  );

  if (sortBy === 'recent') {
    filteredProjects = filteredProjects.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else if (sortBy === 'budget-high') {
    filteredProjects = filteredProjects.sort((a, b) => b.budget_max - a.budget_max);
  } else if (sortBy === 'budget-low') {
    filteredProjects = filteredProjects.sort((a, b) => a.budget_min - b.budget_min);
  }

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

      <div className="bg-white rounded-xl border border-gray-100 mb-6 p-4 space-y-4">
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="all">All Urgencies</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="recent">Most Recent</option>
              <option value="budget-high">Budget: High to Low</option>
              <option value="budget-low">Budget: Low to High</option>
            </select>
          </div>
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
        <div className="space-y-4">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                      {project.urgency === 'high' && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-red-50 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="text-red-700 text-xs font-semibold">URGENT</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium mb-1">Budget Range</p>
                    <p className="text-2xl font-bold text-teal-600">
                      ${(project.budget_min / 1000).toFixed(0)}k - ${(project.budget_max / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>

                <p className="text-gray-700 text-base leading-relaxed mb-4">{project.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-gray-100">
                  {project.owner?.location?.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="text-sm font-medium text-gray-900">{project.owner.location.city}</p>
                      </div>
                    </div>
                  )}

                  {project.ai_analysis?.timeline_weeks && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Timeline</p>
                        <p className="text-sm font-medium text-gray-900">{project.ai_analysis.timeline_weeks} weeks</p>
                      </div>
                    </div>
                  )}

                  {project.ai_analysis?.complexity && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Complexity</p>
                        <p className="text-sm font-medium text-gray-900">{project.ai_analysis.complexity}</p>
                      </div>
                    </div>
                  )}

                  {project.owner?.full_name && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Owner</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{project.owner.full_name}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 mb-4">
                  {project.work_types.slice(0, 5).map(type => (
                    <span key={type} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {type}
                    </span>
                  ))}
                  {project.work_types.length > 5 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      +{project.work_types.length - 5} more
                    </span>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md">
                    Submit Quote
                  </button>
                  <button className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
