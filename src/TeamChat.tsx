import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import {
  Send,
  User,
  Hash,
  Loader,
  MessageSquare,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Eye,
  FileText,
  Lock,
} from 'lucide-react';

export default function TeamChat() {
  // ... (State'ler aynı) ...
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<any>('general');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>(
    {}
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ... (useEffectler aynı - Realtime, Init vb.) ...
  useEffect(() => {
    initializeChat();
  }, []);
  useEffect(() => {
    if (currentUser) {
      setMessages([]);
      fetchMessagesAndMarkRead();
      checkMuteStatus();
    }
  }, [activeChannel, currentUser]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime Dinleyici (Aynen koru)
  useEffect(() => {
    if (!currentUser?.organization_id) return;
    const msgChannel = supabase
      .channel('chat_msg_v5')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_messages',
          filter: `organization_id=eq.${currentUser.organization_id}`,
        },
        async (payload) => {
          const newMsg = payload.new;
          if (newMsg.sender_id === currentUser.id) return;
          let targetKey = '';
          if (newMsg.receiver_id === null) targetKey = 'general';
          else if (newMsg.receiver_id === currentUser.id)
            targetKey = newMsg.sender_id;
          const isGeneral = activeChannel === 'general';
          const isActive = isGeneral
            ? targetKey === 'general'
            : targetKey === activeChannel.id;
          if (isActive) {
            const sender = teamMembers.find((m) => m.id === newMsg.sender_id);
            const enrichedMsg = {
              ...newMsg,
              sender: { full_name: sender?.full_name || '...' },
              reads: [],
            };
            setMessages((prev) => [...prev, enrichedMsg]);
            markAsRead([newMsg.id]);
          } else if (targetKey) {
            setUnreadCounts((prev) => ({
              ...prev,
              [targetKey]: (prev[targetKey] || 0) + 1,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reads' },
        (payload) => {
          const { message_id, user_id } = payload.new;
          let readerName =
            currentUser.id === user_id
              ? currentUser.full_name
              : teamMembers.find((m) => m.id === user_id)?.full_name;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === message_id) {
                const oldReads = msg.reads || [];
                if (!oldReads.some((r: any) => r.user_id === user_id)) {
                  return {
                    ...msg,
                    reads: [...oldReads, { user_id, reader_name: readerName }],
                  };
                }
              }
              return msg;
            })
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [activeChannel, currentUser, teamMembers]);

  // ... (initializeChat, markAsRead, fetchMessages... hepsi aynı) ...
  const initializeChat = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    setCurrentUser(profile);
    if (profile.organization_id) {
      const { data: members } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('organization_id', profile.organization_id)
        .neq('id', profile.id);
      setTeamMembers(members || []);
      const { data: unreads } = await supabase
        .from('company_messages')
        .select('id, sender_id, receiver_id')
        .eq('organization_id', profile.organization_id)
        .neq('sender_id', session.user.id)
        .or(`receiver_id.is.null,receiver_id.eq.${session.user.id}`);
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', session.user.id);
      const readSet = new Set(reads?.map((r) => r.message_id));
      const counts: any = {};
      unreads?.forEach((msg: any) => {
        if (!readSet.has(msg.id)) {
          const key = msg.receiver_id === null ? 'general' : msg.sender_id;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    }
    setLoading(false);
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!messageIds.length || !currentUser) return;
    const inserts = messageIds.map((id) => ({
      message_id: id,
      user_id: currentUser.id,
    }));
    await supabase
      .from('message_reads')
      .upsert(inserts, {
        onConflict: 'message_id, user_id',
        ignoreDuplicates: true,
      });
  };

  const fetchMessagesAndMarkRead = async () => {
    if (!currentUser?.organization_id) return;
    let query = supabase
      .from('company_messages')
      .select(
        `*, sender:profiles!sender_id(full_name), reads:message_reads(user_id)`
      )
      .eq('organization_id', currentUser.organization_id)
      .order('created_at', { ascending: true });
    if (activeChannel === 'general') query = query.is('receiver_id', null);
    else
      query = query.or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChannel.id}),and(sender_id.eq.${activeChannel.id},receiver_id.eq.${currentUser.id})`
      );
    const { data } = await query;
    const formattedData =
      data?.map((msg: any) => ({
        ...msg,
        reads: msg.reads.map((r: any) => ({
          user_id: r.user_id,
          reader_name:
            r.user_id === currentUser.id
              ? currentUser.full_name
              : teamMembers.find((m) => m.id === r.user_id)?.full_name,
        })),
      })) || [];
    setMessages(formattedData);
    const unreadIds = formattedData
      .filter((m: any) => m.sender_id !== currentUser.id)
      .filter(
        (m: any) => !m.reads.some((r: any) => r.user_id === currentUser.id)
      )
      .map((m: any) => m.id);
    if (unreadIds.length > 0) markAsRead(unreadIds);
    const targetKey =
      activeChannel === 'general' ? 'general' : activeChannel.id;
    setUnreadCounts((prev) => ({ ...prev, [targetKey]: 0 }));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const tempId = crypto.randomUUID();
    const tempMsg = {
      id: tempId,
      message: newMessage,
      sender_id: currentUser.id,
      receiver_id: activeChannel === 'general' ? null : activeChannel.id,
      created_at: new Date().toISOString(),
      sender: { full_name: currentUser.full_name },
      reads: [],
    };
    setMessages((prev) => [...prev, tempMsg]);
    const msgToSend = newMessage;
    setNewMessage('');
    setSending(true);
    try {
      await supabase
        .from('company_messages')
        .insert([
          {
            organization_id: currentUser.organization_id,
            sender_id: currentUser.id,
            receiver_id: activeChannel === 'general' ? null : activeChannel.id,
            message: msgToSend,
          },
        ]);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const checkMuteStatus = async () => {
    const targetId = activeChannel === 'general' ? 'general' : activeChannel.id;
    const { data } = await supabase
      .from('chat_settings')
      .select('is_muted')
      .eq('user_id', currentUser.id)
      .eq('target_id', targetId)
      .single();
    setIsMuted(data ? data.is_muted : false);
  };
  const toggleMute = async () => {
    const targetId = activeChannel === 'general' ? 'general' : activeChannel.id;
    const newStatus = !isMuted;
    await supabase
      .from('chat_settings')
      .upsert(
        { user_id: currentUser.id, target_id: targetId, is_muted: newStatus },
        { onConflict: 'user_id, target_id' }
      );
    setIsMuted(newStatus);
  };

  // --- YENİ: BELGE GÖRME YETKİSİ KONTROLÜ ---
  const canViewDocument = () => {
    // Admin ve şirket yöneticisi/şef her zaman görür
    if (
      currentUser?.role === 'admin' ||
      currentUser?.role === 'premium_corporate' ||
      currentUser?.role === 'corporate_chief'
    )
      return true;
    // Normal personel sadece özelden (DM) atıldıysa görebilir
    if (activeChannel !== 'general') return true;
    // Genel sohbette normal personel göremez
    return false;
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;
  if (!currentUser?.organization_id)
    return <div className="p-10 text-center">Şirket yok.</div>;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex border border-gray-200 dark:border-slate-700">
      {/* SOL: SIDEBAR (AYNI) */}
      <div className="w-80 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-gray-50 dark:bg-slate-900">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 font-bold text-gray-700 dark:text-white flex items-center gap-2">
          <MessageSquare className="text-blue-600" /> Ekip Sohbeti
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => setActiveChannel('general')}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition ${
              activeChannel === 'general'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-blue-700 dark:text-white">
                <Hash size={20} />
              </div>
              <div className="font-bold text-sm">Genel Sohbet</div>
            </div>
            {unreadCounts['general'] > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                {unreadCounts['general']}
              </span>
            )}
          </button>
          <div className="pt-4 pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Kişiler
          </div>
          {teamMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => setActiveChannel(member)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition ${
                activeChannel.id === member.id
                  ? 'bg-white dark:bg-slate-700 shadow-sm border border-gray-200 dark:border-slate-600'
                  : 'hover:bg-gray-200 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-slate-600 flex items-center justify-center text-purple-600 dark:text-white font-bold">
                  {member.full_name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                    {member.full_name}
                  </div>
                </div>
              </div>
              {unreadCounts[member.id] > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                  {unreadCounts[member.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SAĞ: MESAJLAR */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-3">
            {activeChannel === 'general' ? (
              <Hash className="text-gray-400" />
            ) : (
              <User className="text-purple-500" />
            )}
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white">
                {activeChannel === 'general'
                  ? 'Genel Sohbet'
                  : activeChannel.full_name}
              </h3>
            </div>
          </div>
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg border transition text-xs font-bold flex items-center gap-2 ${
              isMuted
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300'
            }`}
          >
            {isMuted ? <BellOff size={16} /> : <Bell size={16} />}{' '}
            {isMuted ? 'Sessizden Çıkar' : 'Sessize Al'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-slate-900/50">
          {messages.map((msg, index) => {
            const isMe = msg.sender_id === currentUser.id;
            const seenBy =
              msg.reads?.filter((r: any) => r.user_id !== currentUser.id) || [];
            const isSeen = seenBy.length > 0;
            // Belge yetkisi var mı?
            const hasDocAccess = isMe || canViewDocument();

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex flex-col max-w-[70%] ${
                    isMe ? 'items-end' : 'items-start'
                  }`}
                >
                  {!isMe &&
                    activeChannel === 'general' &&
                    (index === 0 ||
                      messages[index - 1].sender_id !== msg.sender_id) && (
                      <span className="text-[10px] text-gray-500 ml-1 mb-1 font-bold">
                        {msg.sender?.full_name}
                      </span>
                    )}
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 border dark:border-slate-600 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>

                    {/* --- BELGE KARTI --- */}
                    {msg.document_id && (
                      <div
                        className={`mt-2 p-3 rounded-xl flex items-center gap-3 border ${
                          isMe
                            ? 'bg-blue-500 border-blue-400'
                            : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg ${
                            isMe ? 'bg-white/20' : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs truncate">
                            {msg.document_title || 'Belge'}
                          </div>
                          <div className="text-[10px] opacity-80">
                            Evrak İletildi
                          </div>
                        </div>
                        {hasDocAccess ? (
                          <Link
                            to={`/documents/${msg.document_id}`}
                            className={`p-2 rounded-lg text-xs font-bold transition ${
                              isMe
                                ? 'bg-white text-blue-600 hover:bg-gray-100'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            Aç
                          </Link>
                        ) : (
                          <div
                            className="p-2 text-gray-400"
                            title="Yetkiniz yok"
                          >
                            <Lock size={16} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span
                        className={`text-[9px] opacity-70 ${
                          isMe ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {new Date(msg.created_at)
                          .toLocaleTimeString()
                          .slice(0, 5)}
                      </span>
                      {isMe &&
                        (isSeen ? (
                          activeChannel === 'general' ? (
                            <Eye
                              size={12}
                              className="text-blue-200"
                              title={`Görenler: ${seenBy
                                .map((s: any) => s.reader_name)
                                .join(', ')}`}
                            />
                          ) : (
                            <CheckCheck size={12} className="text-blue-200" />
                          )
                        ) : (
                          <Check size={12} className="text-blue-300" />
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t bg-white dark:bg-slate-800 dark:border-slate-700"
        >
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-white"
              placeholder="Mesaj yaz..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              disabled={!newMessage.trim()}
              className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
