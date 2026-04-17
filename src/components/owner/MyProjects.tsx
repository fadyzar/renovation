import { useState, useEffect } from 'react';
import { MapPin, User, Mail, Phone, Maximize2, BarChart3, Layers, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  title: string;
  description: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  budget_min: number;
  budget_max: number;
  timeline_weeks: number;
  room_dimensions?: string;
  finish_level?: string;
  status: string;
  owner_id: string;
  owner: {
    full_name: string;
  };
  accepted_bid?: {
    contractor_id: string;
    contractor: {
      full_name: string;
      company_name?: string;
      total_projects?: number;
    };
  };
}

export function MyProjects() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(full_name),
          accepted_bid:bids!bids_project_id_fkey(
            contractor_id,
            contractor:profiles!bids_contractor_id_fkey(full_name, company_name, total_projects)
          )
        `)
        .eq('owner_id', profile?.id)
        .in('status', ['in_progress', 'seeking_quotes'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="bg-gray-900 text-white py-6 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">My Projects</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Active Projects</h2>
          <p className="text-gray-600">
            Track your ongoing projects, update progress, and manage communication with clients—all in one place.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No active projects</h3>
            <p className="text-gray-600 mb-6">Create a new project to get started</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h3>
                      <p className="text-gray-600">{project.description}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Project Location</p>
                      <p className="text-gray-900">
                        {project.property_address}, {project.property_city}, {project.property_state} {project.property_zip}, USA
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6 py-4 border-y border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="text-sm font-semibold text-gray-900">{project.owner.full_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Your Mail</p>
                        <p className="text-sm font-semibold text-gray-900">{project.owner.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Phone className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone Number</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {project.owner.phone || '+1 1234567890'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Maximize2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Room Dimensions</p>
                        <p className="text-sm font-semibold text-gray-900">{project.room_dimensions || '24x75'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Finish Level</p>
                        <p className="text-sm font-semibold text-gray-900">{project.finish_level || 'Standard'}</p>
                      </div>
                    </div>
                  </div>

                  {project.accepted_bid && (
                    <div className="flex items-start gap-4 pt-2">
                      <img
                        src={`https://ui-avatars.com/api/?name=${project.accepted_bid.contractor.full_name}&background=random`}
                        alt={project.accepted_bid.contractor.full_name}
                        className="w-16 h-16 rounded-full flex-shrink-0"
                      />

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 mb-1">
                              {project.accepted_bid.contractor.full_name}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {project.accepted_bid.contractor.company_name || 'First-Time Renovator'}
                            </p>
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Verified
                            </span>
                          </div>

                          <button
                            onClick={() => navigate(`/project/${project.id}`)}
                            className="px-8 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                          >
                            View Project
                          </button>
                        </div>

                        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Layers className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Finished Projects</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {project.accepted_bid.contractor.total_projects || 2} Projects
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Clock className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Estimated Completion Time</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {project.timeline_weeks || 1.5} Months
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
