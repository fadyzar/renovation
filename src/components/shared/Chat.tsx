import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, FileText, Image as ImageIcon, CheckCheck, Check } from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  function handleTyping() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
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
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">No messages yet</p>
              <p className="text-sm text-gray-400">Start the conversation by sending a message</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwn = message.sender_id === profile?.id;
              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  {!isOwn && (
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {message.sender?.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {isOwn && (
                        message.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-100" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-blue-100" />
                        )
                      )}
                    </div>
                  </div>
                  {isOwn && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {profile?.full_name?.charAt(0) || 'Y'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {isTyping && (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">U</span>
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2 items-end">
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            style={{
              minHeight: '44px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
