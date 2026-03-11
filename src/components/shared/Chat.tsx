import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url?: string;
  };
}

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
  };
  contractor?: {
    full_name: string;
  };
}

interface ChatProps {
  conversationId?: string;
  projectId?: string;
  contractorId?: string;
  onClose?: () => void;
}

export function Chat({ conversationId, projectId, contractorId, onClose }: ChatProps) {
  const { profile } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationId, projectId, contractorId]);

  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel(`conversation:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadConversation() {
    try {
      if (conversationId) {
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            project:projects(title),
            owner:profiles!conversations_owner_id_fkey(full_name),
            contractor:profiles!conversations_contractor_id_fkey(full_name)
          `)
          .eq('id', conversationId)
          .maybeSingle();

        if (error) throw error;
        setConversation(data);
      } else if (projectId && contractorId) {
        let { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            project:projects(title),
            owner:profiles!conversations_owner_id_fkey(full_name),
            contractor:profiles!conversations_contractor_id_fkey(full_name)
          `)
          .eq('project_id', projectId)
          .eq('contractor_id', contractorId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data && profile) {
          const { data: project } = await supabase
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .maybeSingle();

          const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({
              project_id: projectId,
              contractor_id: contractorId,
              owner_id: project?.owner_id,
            })
            .select(`
              *,
              project:projects(title),
              owner:profiles!conversations_owner_id_fkey(full_name),
              contractor:profiles!conversations_contractor_id_fkey(full_name)
            `)
            .single();

          if (createError) throw createError;
          data = newConv;
        }

        setConversation(data);
      }

      if (conversation || conversationId || (projectId && contractorId)) {
        await loadMessages();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    if (!conversation?.id && !conversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name, avatar_url)
        `)
        .eq('conversation_id', conversation?.id || conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversation?.id || conversationId)
        .neq('sender_id', profile?.id || '');
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !conversation?.id || !profile?.id) return;

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: profile.id,
        content: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const otherPerson =
    profile?.id === conversation?.owner_id
      ? conversation?.contractor?.full_name
      : conversation?.owner?.full_name;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-white">{otherPerson || 'Chat'}</h3>
            <p className="text-xs text-blue-100">{conversation?.project?.title}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[600px]">
        {messages.map((message) => {
          const isOwn = message.sender_id === profile?.id;
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  isOwn
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
