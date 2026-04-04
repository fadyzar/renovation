import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, FileText, Image as ImageIcon, CheckCheck, Check, Paperclip, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  conversation_id?: string;
  content: string;
  sender_id: string;
  is_read: boolean;
  created_at: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
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
    avatar_url?: string;
  };
  contractor?: {
    full_name: string;
    avatar_url?: string;
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
  const [messageError, setMessageError] = useState('');
  const [loading, setLoading] = useState(true);
  const [depositPaid, setDepositPaid] = useState(false);
  const [checkingDeposit, setCheckingDeposit] = useState(true);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationId, projectId, contractorId]);

  useEffect(() => {
    if (!conversation || !profile?.id) return;

    const channel = supabase
      .channel(`conversation:${conversation.id}`, {
        config: {
          presence: {
            key: profile.id,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMessage.sender_id)
            .maybeSingle();

          setMessages((prev) => {
            const exists = prev.some(msg =>
              msg.id === newMessage.id ||
              (msg.content === newMessage.content &&
               msg.sender_id === newMessage.sender_id &&
               Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 2000)
            );
            if (exists) return prev;
            return [...prev, { ...newMessage, sender }];
          });

          if (newMessage.sender_id !== profile?.id) {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? { ...msg, is_read: updatedMessage.is_read } : msg
            )
          );
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presenceData = Object.values(state).flat() as any[];
        const otherUsersTyping = presenceData.some(
          (user: any) => user.user_id !== profile.id && user.typing === true
        );
        setOtherUserTyping(otherUsersTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: profile.id,
            typing: false,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, profile?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function checkDepositStatus(projId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('payments')
        .select('id')
        .eq('project_id', projId)
        .eq('is_deposit', true)
        .in('status', ['escrowed', 'partially_released', 'completed'])
        .maybeSingle();

      return !!data;
    } catch (error) {
      console.error('Error checking deposit:', error);
      return false;
    }
  }

  async function loadConversation() {
    try {
      let loadedConversationId: string | null = null;
      let loadedProjectId: string | null = projectId || null;

      if (conversationId) {
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            project:projects(title),
            owner:profiles!conversations_owner_id_fkey(full_name, avatar_url),
            contractor:profiles!conversations_contractor_id_fkey(full_name, avatar_url)
          `)
          .eq('id', conversationId)
          .maybeSingle();

        if (error) throw error;
        setConversation(data);
        loadedConversationId = data?.id || null;
        loadedProjectId = data?.project_id || null;
      } else if (projectId && contractorId) {
        loadedProjectId = projectId;

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

        setConversation(data);
        loadedConversationId = data?.id || null;
      }

      if (loadedProjectId) {
        const isPaid = await checkDepositStatus(loadedProjectId);
        setDepositPaid(isPaid);
        setCheckingDeposit(false);

        if (loadedConversationId && isPaid) {
          await loadMessages(loadedConversationId);
        }
      } else {
        setCheckingDeposit(false);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      setCheckingDeposit(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(convId?: string) {
    const idToUse = convId || conversation?.id || conversationId;
    if (!idToUse) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name, avatar_url)
        `)
        .eq('conversation_id', idToUse)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', idToUse)
        .neq('sender_id', profile?.id || '');
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async function uploadFile(file: File): Promise<string | null> {
    if (!profile?.id) return null;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage() {
    if ((!newMessage.trim() && !selectedFile) || !conversation?.id || !profile?.id) return;

    const messageContent = newMessage.trim();

    if (messageContent) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const checkResponse = await fetch(
          `${supabaseUrl}/functions/v1/validate-message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              message: messageContent,
              userId: profile.id,
              projectId: conversation.project_id,
              conversationId: conversation.id,
              type: 'chat',
            }),
          }
        );

        if (checkResponse.ok) {
          const result = await checkResponse.json();

          if (!result.isValid && result.shouldBlock) {
            setMessageError(result.message);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking message:', error);
      }
    }

    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    let attachmentName: string | null = null;

    if (selectedFile) {
      attachmentUrl = await uploadFile(selectedFile);
      if (!attachmentUrl) {
        return;
      }
      attachmentType = selectedFile.type.startsWith('image/') ? 'image' :
                       selectedFile.type.startsWith('video/') ? 'video' : 'file';
      attachmentName = selectedFile.name;
    }

    setNewMessage('');
    setSelectedFile(null);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: profile.id,
        content: messageContent || null,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        attachment_name: attachmentName,
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      if (channelRef.current) {
        await channelRef.current.track({
          user_id: profile.id,
          typing: false,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    }
  }

  async function handleTyping(isTyping: boolean) {
    if (!channelRef.current || !profile?.id) return;

    await channelRef.current.track({
      user_id: profile.id,
      typing: isTyping,
    });
  }

  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }

  const otherPerson =
    profile?.id === conversation?.owner_id
      ? conversation?.contractor?.full_name
      : conversation?.owner?.full_name;

  if (loading || checkingDeposit) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!depositPaid) {
    return (
      <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-white">Chat Locked</h3>
              <p className="text-xs text-amber-100">Deposit payment required</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-amber-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Deposit Payment Required</h3>
            <p className="text-gray-600 mb-4">
              The contractor must pay the 10% security deposit before communication is enabled. This protects both parties and ensures commitment to the project.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
              <p className="text-sm text-amber-900 font-medium mb-2">What happens next:</p>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Contractor pays security deposit (held in escrow)</li>
                <li>• Project status changes to "Active"</li>
                <li>• Chat unlocks automatically</li>
                <li>• You can coordinate project details</li>
              </ul>
            </div>
          </div>
        </div>
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

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[600px]">
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
              const senderAvatar = isOwn
                ? profile?.avatar_url
                : (profile?.id === conversation?.owner_id
                    ? conversation?.contractor?.avatar_url
                    : conversation?.owner?.avatar_url);
              const senderName = isOwn
                ? profile?.full_name
                : (profile?.id === conversation?.owner_id
                    ? conversation?.contractor?.full_name
                    : conversation?.owner?.full_name);

              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  {!isOwn && (
                    senderAvatar ? (
                      <img
                        src={senderAvatar}
                        alt={senderName || 'User'}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">
                          {message.sender?.full_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.attachment_url && (
                      <div className="mb-2">
                        {message.attachment_type === 'image' ? (
                          <img
                            src={message.attachment_url}
                            alt={message.attachment_name || 'Attached image'}
                            className="max-w-full rounded-lg mb-1"
                            style={{ maxHeight: '300px' }}
                          />
                        ) : (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg ${
                              isOwn ? 'bg-blue-800/30' : 'bg-gray-200'
                            }`}
                          >
                            <FileText className="w-5 h-5" />
                            <span className="text-sm truncate">{message.attachment_name || 'File'}</span>
                          </a>
                        )}
                      </div>
                    )}
                    {message.content && (
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    )}
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
                    senderAvatar ? (
                      <img
                        src={senderAvatar}
                        alt={senderName || 'You'}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">
                          {profile?.full_name?.charAt(0) || 'Y'}
                        </span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
            {otherUserTyping && (
              <div className="flex items-end gap-2">
                {(profile?.id === conversation?.owner_id
                  ? conversation?.contractor?.avatar_url
                  : conversation?.owner?.avatar_url) ? (
                  <img
                    src={profile?.id === conversation?.owner_id
                      ? conversation?.contractor?.avatar_url
                      : conversation?.owner?.avatar_url}
                    alt={otherPerson || 'User'}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {otherPerson?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
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
        {messageError && (
          <div className="mb-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">{messageError}</p>
              <button
                onClick={() => setMessageError('')}
                className="text-xs text-red-600 hover:text-red-800 underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {selectedFile && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedFile.type.startsWith('image/') ? (
                <ImageIcon className="w-5 h-5 text-blue-600" />
              ) : (
                <FileText className="w-5 h-5 text-blue-600" />
              )}
              <span className="text-sm text-gray-700 truncate max-w-xs">{selectedFile.name}</span>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 hover:bg-blue-100 rounded"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFile(file);
              }
            }}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-600 hover:bg-gray-200 rounded-2xl transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => {
              const value = e.target.value;
              setNewMessage(value);
              setMessageError('');
              handleTyping(value.trim().length > 0 || selectedFile !== null);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className={`flex-1 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 resize-none ${
              messageError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
            }`}
            style={{
              minHeight: '44px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || uploading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{uploading ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
