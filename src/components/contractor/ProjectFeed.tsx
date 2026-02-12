import { useState, useEffect } from 'react';
import { Search, MapPin, DollarSign, AlertCircle, Clock, Briefcase, Filter, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  properties?: {
    city?: string;
    state?: string;
  };
  owner: {
    full_name: string;
    location?: {
      city?: string;
      state?: string;
    };
  };
}

interface ProjectFeedProps {
  onSelectProject: (project: Project) => void;
}

export function ProjectFeed({ onSelectProject }: ProjectFeedProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    location: '',
    categories: [] as string[],
    budgetMin: '',
    budgetMax: '',
    urgency: 'all'
  });

  const allCategories = [
    'Electrical', 'Plumbing', 'Painting', 'Flooring',
    'Carpentry', 'Roofing', 'HVAC', 'Kitchen',
    'Bathroom', 'Foundation', 'Drywall', 'Tiling'
  ];

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          properties(city, state),
          owner:profiles!projects_owner_id_fkey(full_name, location)
        `)
        .eq('status', 'seeking_quotes')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const clearFilters = () => {
    setFilters({
      location: '',
      categories: [],
      budgetMin: '',
      budgetMax: '',
      urgency: 'all'
    });
  };

  let filteredProjects = projects.filter(project => {
    const matchesSearch = searchQuery === '' ||
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.work_types.some(type => type.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLocation = filters.location === '' ||
      project.properties?.city?.toLowerCase().includes(filters.location.toLowerCase()) ||
      project.properties?.state?.toLowerCase().includes(filters.location.toLowerCase()) ||
      project.owner?.location?.city?.toLowerCase().includes(filters.location.toLowerCase()) ||
      project.owner?.location?.state?.toLowerCase().includes(filters.location.toLowerCase());

    const matchesCategories = filters.categories.length === 0 ||
      filters.categories.some(cat =>
        project.work_types.some(type => type.toLowerCase().includes(cat.toLowerCase()))
      );

    const matchesBudgetMin = filters.budgetMin === '' ||
      project.budget_max >= parseFloat(filters.budgetMin);

    const matchesBudgetMax = filters.budgetMax === '' ||
      project.budget_min <= parseFloat(filters.budgetMax);

    const matchesUrgency = filters.urgency === 'all' || project.urgency === filters.urgency;

    return matchesSearch && matchesLocation && matchesCategories &&
           matchesBudgetMin && matchesBudgetMax && matchesUrgency;
  });

  const activeFilterCount =
    (filters.location ? 1 : 0) +
    filters.categories.length +
    (filters.budgetMin ? 1 : 0) +
    (filters.budgetMax ? 1 : 0) +
    (filters.urgency !== 'all' ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
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

        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        {showFilters && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="City or State"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filters.categories.includes(category)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Budget ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={filters.budgetMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, budgetMin: e.target.value }))}
                    placeholder="0"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Budget ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={filters.budgetMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, budgetMax: e.target.value }))}
                    placeholder="∞"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
              <select
                value={filters.urgency}
                onChange={(e) => setFilters(prev => ({ ...prev, urgency: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              >
                <option value="all">All Urgencies</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-600">Try adjusting your filters or check back later</p>
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
                  {(project.properties?.city || project.owner?.location?.city) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="text-sm font-medium text-gray-900">
                          {project.properties?.city || project.owner?.location?.city}
                        </p>
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
                  <button
                    onClick={() => onSelectProject(project)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    Submit Bid
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
