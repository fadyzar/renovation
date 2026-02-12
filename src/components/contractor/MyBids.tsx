import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Eye, DollarSign, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  status: 'sent' | 'viewed' | 'accepted' | 'rejected';
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
    status: string;
    owner: {
      full_name: string;
    };
  };
}

export function MyBids() {
  const { profile } = useAuth();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'viewed' | 'accepted' | 'rejected'>('all');
  const [expandedBid, setExpandedBid] = useState<string | null>(null);

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
            status,
            owner:profiles!projects_owner_id_fkey(full_name)
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

  const filteredBids = filter === 'all'
    ? bids
    : bids.filter(bid => bid.status === filter);

  const stats = {
    total: bids.length,
    sent: bids.filter(b => b.status === 'sent').length,
    viewed: bids.filter(b => b.status === 'viewed').length,
    accepted: bids.filter(b => b.status === 'accepted').length,
    rejected: bids.filter(b => b.status === 'rejected').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'viewed':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'accepted':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Clock className="w-4 h-4" />;
      case 'viewed':
        return <Eye className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpand = (bidId: string) => {
    setExpandedBid(expandedBid === bidId ? null : bidId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'all'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="text-sm text-gray-600 mb-1">Total Bids</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </button>

        <button
          onClick={() => setFilter('sent')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'sent'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="text-sm text-gray-600 mb-1">Sent</p>
          <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
        </button>

        <button
          onClick={() => setFilter('viewed')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'viewed'
              ? 'border-purple-600 bg-purple-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="text-sm text-gray-600 mb-1">Viewed</p>
          <p className="text-2xl font-bold text-purple-600">{stats.viewed}</p>
        </button>

        <button
          onClick={() => setFilter('accepted')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'accepted'
              ? 'border-green-600 bg-green-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="text-sm text-gray-600 mb-1">Accepted</p>
          <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
        </button>

        <button
          onClick={() => setFilter('rejected')}
          className={`p-4 rounded-xl border-2 transition-all ${
            filter === 'rejected'
              ? 'border-red-600 bg-red-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <p className="text-sm text-gray-600 mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredBids.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No bids found</h3>
          <p className="text-gray-600">
            {filter === 'all'
              ? 'Start submitting bids to projects'
              : `No ${filter} bids yet`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBids.map(bid => (
            <div
              key={bid.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {bid.project.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      To: {bid.project.owner.full_name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-sm ${getStatusColor(bid.status)}`}>
                      {getStatusIcon(bid.status)}
                      {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      ${bid.total_price.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-100">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Budget Range</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${(bid.project.budget_min / 1000).toFixed(0)}k - ${(bid.project.budget_max / 1000).toFixed(0)}k
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Submitted</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(bid.created_at)}
                      </p>
                    </div>
                  </div>

                  {bid.viewed_at && (
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Viewed</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(bid.viewed_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {bid.responded_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Responded</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(bid.responded_at)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => toggleExpand(bid.id)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    {expandedBid === bid.id ? 'Hide Details' : 'Show Details'}
                  </button>

                  {expandedBid === bid.id && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Your Message</h4>
                        <p className="text-gray-700 bg-gray-50 rounded-lg p-4">
                          {bid.message}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Milestones</h4>
                        <div className="space-y-3">
                          {bid.milestones.map((milestone, index) => (
                            <div
                              key={index}
                              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900">
                                  Milestone {index + 1}
                                </h5>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="font-semibold text-gray-900">
                                    ${milestone.price.toLocaleString()}
                                  </span>
                                  <span className="text-gray-600">
                                    {milestone.duration} days
                                  </span>
                                </div>
                              </div>
                              <p className="text-gray-700">{milestone.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
