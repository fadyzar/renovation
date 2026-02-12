import { useState, useEffect } from 'react';
import { Briefcase, FileText, Bell, TrendingUp, Star, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ProjectFeed } from './ProjectFeed';
import { BidBuilder } from './BidBuilder';
import { MyBids } from './MyBids';

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

type TabType = 'projects' | 'bids' | 'notifications';

export function ContractorDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stats, setStats] = useState({
    totalBids: 0,
    pending: 0,
    accepted: 0,
    totalValue: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('contractor_id', profile?.id);

      if (bidsError) throw bidsError;

      const bids = bidsData || [];
      setStats({
        totalBids: bids.length,
        pending: bids.filter(b => b.status === 'sent' || b.status === 'viewed').length,
        accepted: bids.filter(b => b.status === 'accepted').length,
        totalValue: bids.reduce((sum, b) => sum + (b.total_price || 0), 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  const handleBidSuccess = () => {
    loadStats();
    setActiveTab('bids');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contractor Dashboard</h1>
        <p className="text-gray-600">Manage your projects and bids</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Bids</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalBids}</p>
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

      <div className="bg-white rounded-xl border border-gray-100 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'projects'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Briefcase className="w-5 h-5" />
              Available Projects
            </div>
          </button>

          <button
            onClick={() => setActiveTab('bids')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'bids'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              My Bids
            </div>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'notifications'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </div>
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'projects' && (
          <ProjectFeed onSelectProject={setSelectedProject} />
        )}

        {activeTab === 'bids' && <MyBids />}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-600">You're all caught up</p>
          </div>
        )}
      </div>

      {selectedProject && (
        <BidBuilder
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
}
