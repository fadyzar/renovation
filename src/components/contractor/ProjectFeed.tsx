import { useState, useEffect } from 'react';
import { ChevronDown, Search, MapPin, Mail, Phone, Maximize2, BarChart3, Calendar, Layers, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BidBuilder } from './BidBuilder';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  budget_min: number;
  budget_max: number;
  work_types: string[];
  timeline_weeks: number;
  urgency: string;
  created_at: string;
  ai_analysis?: {
    complexity?: string;
    timeline_weeks?: number;
    estimated_cost?: number;
    room_dimensions?: string;
  };
  properties?: {
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  owner: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

export function ProjectFeed() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [filters, setFilters] = useState({
    renovationType: 'Select Renovation Type',
    budgetRange: '$1,000 to $50,000',
    location: 'Select your Location',
    sortBy: 'Oldest'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          properties(address, city, state, zip_code),
          owner:profiles!projects_owner_id_fkey(full_name, email, phone)
        `)
        .eq('status', 'seeking_quotes')
        .order('created_at', { ascending: filters.sortBy === 'Oldest' });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  const getProjectIcon = (title: string) => {
    if (title.toLowerCase().includes('kitchen')) return 'K';
    if (title.toLowerCase().includes('bathroom')) return 'B';
    if (title.toLowerCase().includes('roof')) return 'R';
    return title.charAt(0);
  };

  const handleSubmitBid = (project: Project) => {
    setSelectedProject(project);
  };

  return (
    <div className="min-h-screen">
      <div className="bg-gray-900 text-white py-6 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Available Projects</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Find Your Next Project</h2>
          <p className="text-gray-600">
            Browse open renovation projects, review client requirements, and submit competitive bids to win more jobs.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Renovation Type</label>
              <select
                value={filters.renovationType}
                onChange={(e) => setFilters({ ...filters, renovationType: e.target.value })}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
              >
                <option>Select Renovation Type</option>
                <option>Kitchen Renovation</option>
                <option>Bathroom Renovation</option>
                <option>Full House Renovation</option>
                <option>Roof Repair</option>
              </select>
              <ChevronDown className="absolute right-3 top-11 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget Range</label>
              <select
                value={filters.budgetRange}
                onChange={(e) => setFilters({ ...filters, budgetRange: e.target.value })}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
              >
                <option>$1,000 to $50,000</option>
                <option>$10,000 to $50,000</option>
                <option>$50,000 to $100,000</option>
                <option>$100,000+</option>
              </select>
              <ChevronDown className="absolute right-3 top-11 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <select
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
              >
                <option>Select your Location</option>
                <option>New York</option>
                <option>California</option>
                <option>Texas</option>
              </select>
              <ChevronDown className="absolute right-3 top-11 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort by (Date)</label>
              <select
                value={filters.sortBy}
                onChange={(e) => {
                  setFilters({ ...filters, sortBy: e.target.value });
                  loadProjects();
                }}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
              >
                <option>Oldest</option>
                <option>Newest</option>
              </select>
              <ChevronDown className="absolute right-3 top-11 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <button className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-full transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600">Check back later for new opportunities</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xl font-bold">{getProjectIcon(project.title)}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{project.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Project Location</p>
                      <p className="font-semibold text-gray-900">
                        {project.properties?.address}, {project.properties?.city}, {project.properties?.state} {project.properties?.zip_code}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 py-4 border-y border-gray-200">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Full Name</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{project.owner.full_name}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <Mail className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Your Mail</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{project.owner.email}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <Phone className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Phone Number</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{project.owner.phone || '+1 234567890'}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Room Dimensions</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{project.ai_analysis?.room_dimensions || '24X75'}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Finish Level</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{project.ai_analysis?.complexity || 'Standard'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${project.owner.full_name}&background=random`}
                        alt={project.owner.full_name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{project.owner.full_name}</p>
                        <p className="text-xs text-gray-500">First-Time Renovator</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Finished Projects</p>
                          <p className="text-sm font-semibold text-gray-900">2 Projects</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Estimated Completion Time</p>
                          <p className="text-sm font-semibold text-gray-900">{project.timeline_weeks || 2.5} Months</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">Bid Amount:</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${((project.budget_min + project.budget_max) / 2).toLocaleString()}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSubmitBid(project)}
                      className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Submit a bid
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProject && (
        <BidBuilder
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={() => {
            setSelectedProject(null);
            loadProjects();
          }}
        />
      )}
    </div>
  );
}
