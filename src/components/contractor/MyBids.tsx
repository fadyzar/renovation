import { useState, useEffect } from 'react';
import { ChevronDown, Search, Layers, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Milestone {
  description: string;
  price: number;
  duration: number;
}

interface Bid {
  id: string;
  total_price: number;
  milestones: Milestone[];
  message: string;
  status: 'submitted' | 'viewed' | 'accepted' | 'rejected';
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  project: {
    id: string;
    title: string;
    description: string;
    budget_min: number;
    budget_max: number;
    timeline_weeks: number;
    status: string;
    owner: {
      full_name: string;
      total_projects?: number;
    };
  };
}

export function MyBids() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    renovationType: 'Select Project Type',
    budgetRange: '$1,000 to $50,000',
    location: 'Select your location',
    duration: 'Next 30 Days'
  });

  useEffect(() => {
    loadBids();
  }, []);

  async function loadBids() {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          project:projects(
            id,
            title,
            description,
            budget_min,
            budget_max,
            timeline_weeks,
            status,
            owner:profiles!projects_owner_id_fkey(full_name, total_projects)
          )
        `)
        .eq('contractor_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (error) {
      console.error('Error loading bids:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'submitted':
        return {
          label: 'Pending Bid',
          className: 'bg-gray-500 text-white'
        };
      case 'viewed':
        return {
          label: 'Viewed by Owner',
          className: 'bg-blue-500 text-white'
        };
      case 'accepted':
        return {
          label: 'Approved Bid',
          className: 'bg-green-500 text-white'
        };
      case 'rejected':
        return {
          label: 'Rejected Bid',
          className: 'bg-red-500 text-white'
        };
      default:
        return {
          label: 'Pending Bid',
          className: 'bg-gray-500 text-white'
        };
    }
  };

  return (
    <div className="min-h-screen">
      <div className="bg-gray-900 text-white py-6 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">My Bids</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Submitted Bids</h2>
          <p className="text-gray-600">
            Track the status of your bids, view client responses, and manage your proposals efficiently.
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
                <option>Select Project Type</option>
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
                <option>Select your location</option>
                <option>New York</option>
                <option>California</option>
                <option>Texas</option>
              </select>
              <ChevronDown className="absolute right-3 top-11 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <select
                value={filters.duration}
                onChange={(e) => setFilters({ ...filters, duration: e.target.value })}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
              >
                <option>Next 30 Days</option>
                <option>Next 60 Days</option>
                <option>Next 90 Days</option>
                <option>All Time</option>
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
        ) : bids.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No bids yet</h3>
            <p className="text-gray-600 mb-6">Start submitting bids to projects</p>
            <button
              onClick={() => navigate('/projects')}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200"
            >
              Browse Projects
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {bids.map((bid) => {
              const statusConfig = getStatusConfig(bid.status);

              return (
                <div key={bid.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <img
                        src={`https://ui-avatars.com/api/?name=${bid.project.owner.full_name}&background=random`}
                        alt={bid.project.owner.full_name}
                        className="w-16 h-16 rounded-full flex-shrink-0"
                      />

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              {bid.project.owner.full_name}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">First-Time Renovator</p>
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Verified
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`inline-block px-4 py-1.5 rounded-lg text-sm font-semibold ${statusConfig.className} mb-3`}>
                              {statusConfig.label}
                            </span>
                            <p className="text-sm text-gray-600 mb-1">Bid Amount:</p>
                            <p className="text-2xl font-bold text-gray-900">
                              ${bid.total_price.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Layers className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Finished Projects</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {bid.project.owner.total_projects || 2} Projects
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
                                {bid.project.timeline_weeks || 1.5} Months
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="text-center py-8">
              <button
                onClick={() => navigate('/projects')}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
              >
                Browse More Projects
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
