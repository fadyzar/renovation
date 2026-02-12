import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart3, MapPin, User, Mail, Phone, Maximize2,
  Layers, Clock, CheckCircle, Circle, Upload, MessageCircle, Send, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Milestone {
  description: string;
  price: number;
  duration: number;
}

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
  owner: {
    full_name: string;
    email: string;
    phone?: string;
  };
  accepted_bid?: {
    total_price: number;
    milestones: Milestone[];
    contractor: {
      full_name: string;
      company_name?: string;
      total_projects?: number;
    };
  };
}

const projectSteps = [
  { id: 1, name: 'Step #1 Renovation', progress: '$4,7' },
  { id: 2, name: 'Step #2 Renovation', progress: '$4,7' },
  { id: 3, name: 'Step #3 Renovation', progress: '$4,7' },
  { id: 4, name: 'Step #4 Renovation', progress: '$4,7' }
];

const milestoneStatuses = [
  {
    title: 'Initial Meeting',
    status: 'completed',
    date: 'Due in 7 days',
    description: 'The contractor visited the location to assess the renovation area, take measurements, and discuss project details with the client.',
    contractorNote: 'I completed a full site inspection, noted all requirements, and aligned expectations with the client. We finalized the renovation scope and timeline, ensuring a smooth start.'
  },
  {
    title: 'Work Started',
    status: 'in_progress',
    date: 'Past due: 19/03/25',
    description: 'Removal of old materials and structural preparation began. No major permits were required. We are working on structural reinforcements. Everything is progressing as planned, and no unforeseen issues have arisen so far.',
    contractorNote: 'We have successfully completed the demolition phase and are now working on structural reinforcements. Everything is progressing as planned, and no unforeseen issues have arisen so far.'
  },
  {
    title: 'Installation Phase',
    status: 'pending',
    date: 'Past due: 17/03/25',
    description: 'Installation of cabinets, flooring, and new fixtures. Plumbing and electrical connections are being finalized. All lighting systems will be aligned regularly with flat cloth.',
    contractorNote: 'Once demolition work is completed, we will begin installing the key components of the renovation. We expect to maintain steady progress with minimal delays.'
  },
  {
    title: 'Final Review',
    status: 'pending',
    date: 'Completion: Work Begins',
    description: '',
    contractorNote: ''
  }
];

function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          owner:profiles!projects_owner_id_fkey(full_name, email, phone),
          accepted_bid:bids!bids_project_id_fkey(
            total_price,
            milestones,
            contractor:profiles!bids_contractor_id_fkey(full_name, company_name, total_projects)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Project not found</h2>
        <button
          onClick={() => navigate('/projects')}
          className="text-orange-600 hover:text-orange-700 font-medium"
        >
          Go back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 text-white py-6 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Project Details</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Project Overview: {project.title}
          </h2>
          <p className="text-gray-600">
            Here's all the key details about this project, including milestones, payments, and client communication.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {projectSteps.map((step, index) => (
            <div
              key={step.id}
              className={`p-4 rounded-xl border-2 ${
                index === 0
                  ? 'bg-green-50 border-green-500'
                  : 'bg-gray-50 border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {index === 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
                <p className="text-sm font-semibold text-gray-900">{step.name}</p>
              </div>
              <p className="text-lg font-bold text-gray-700">{step.progress}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
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
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">
                        {project.accepted_bid.contractor.full_name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">First-Time Renovator</p>
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Verified
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
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

        <div className="space-y-6 mb-12">
          {milestoneStatuses.map((milestone, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  milestone.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : milestone.status === 'in_progress'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {milestone.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <span className="font-bold">{index + 1}</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{milestone.title}</h3>
                      <p className="text-sm text-gray-500">{milestone.date}</p>
                    </div>
                    {milestone.status === 'in_progress' && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                        IN PROGRESS
                      </span>
                    )}
                  </div>

                  {milestone.description && (
                    <div className="mt-3">
                      <p className="text-gray-700 mb-3">{milestone.description}</p>
                    </div>
                  )}

                  {milestone.contractorNote && (
                    <div className="mt-3 bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Contractor's Note:</p>
                      <p className="text-sm text-gray-700">{milestone.contractorNote}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Project's Gallery</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={`https://images.pexels.com/photos/${2000000 + i}/pexels-photo-${2000000 + i}.jpeg?auto=compress&cs=tinysrgb&w=400`}
                  alt={`Gallery ${i}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <button className="w-full py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
            <Upload className="w-5 h-5" />
            Choose Files
          </button>
        </div>

        {project.accepted_bid && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Payment & Financial Management
            </h3>
            <div className="space-y-6">
              {project.accepted_bid.milestones.map((milestone, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">Milestone {index + 1}: Start</h4>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">Due in {milestone.duration} days</p>
                        <h5 className="font-semibold text-gray-900 mb-2">{milestone.description}</h5>
                        <p className="text-sm text-gray-700">Past due: 19/03/25</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">${milestone.price.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  {index < project.accepted_bid.milestones.length - 1 && (
                    <div className="h-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full my-2"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all z-50"
      >
        {chatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {chatOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          <div className="bg-blue-600 text-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Chat</h3>
              <button onClick={() => setChatOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm opacity-90">With the Mgbit Specialist</p>
          </div>
          <div className="h-96 overflow-y-auto p-4 bg-gray-50">
            <div className="space-y-4">
              <div className="bg-blue-600 text-white rounded-2xl rounded-tl-none p-3 max-w-xs">
                <p className="text-sm">Hello! How can I assist you today?</p>
              </div>
              <div className="bg-gray-200 text-gray-900 rounded-2xl rounded-tr-none p-3 max-w-xs ml-auto">
                <p className="text-sm">I have a question about the project timeline</p>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message here..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetails;
