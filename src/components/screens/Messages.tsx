import { useState, useEffect } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Chat } from '../shared/Chat';

interface Conversation {
  id: string;
  project_id: string;
  owner_id: string;
  contractor_id: string;
  last_message_at: string;
  project?: {
    title: string;
  };
  owner?: {
    full_name: string;
    avatar_url?: string;
  };
  contractor?: {
    full_name: string;
    avatar_url?: string;
  };
  last_message?: {
    content: string;
    is_read: boolean;
  };
}

export function Messages() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile) {
      loadConversations();

      const channel = supabase
        .channel('conversations-list')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          () => {
            loadConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id]);

  async function loadConversations() {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          project:projects(title),
          owner:profiles!conversations_owner_id_fkey(full_name, avatar_url),
          contractor:profiles!conversations_contractor_id_fkey(full_name, avatar_url)
        `)
        .or(`owner_id.eq.${profile.id},contractor_id.eq.${profile.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const conversationsWithLastMessage = await Promise.all(
        (data || []).map(async (conv) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, is_read')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return { ...conv, last_message: lastMsg };
        })
      );

      setConversations(conversationsWithLastMessage);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    const otherPerson =
      profile?.id === conv.owner_id ? conv.contractor?.full_name : conv.owner?.full_name;
    const projectTitle = conv.project?.title || '';
    const query = searchQuery.toLowerCase();

    return (
      otherPerson?.toLowerCase().includes(query) ||
      projectTitle.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-2">Messages</h1>
          <p className="text-blue-100">Chat with property owners and contractors</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No conversations yet</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const otherPerson =
                    profile?.id === conv.owner_id
                      ? conv.contractor?.full_name
                      : conv.owner?.full_name;
                  const isSelected = selectedConversation === conv.id;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-lg">
                            {otherPerson?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {otherPerson}
                            </h3>
                            {!conv.last_message?.is_read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{conv.project?.title}</p>
                          {conv.last_message && (
                            <p className="text-sm text-gray-600 truncate">
                              {conv.last_message.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedConversation ? (
              <Chat conversationId={selectedConversation} />
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Select a conversation
                  </h3>
                  <p className="text-gray-600">Choose a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
