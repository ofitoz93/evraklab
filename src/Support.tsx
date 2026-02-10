import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  MessageCircle,
  Send,
  Loader,
  User,
  Shield,
  Lock,
  AlertTriangle,
  Clock,
  Eye,
  XCircle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function Support() {
  const [loading, setLoading] = useState(true);

  // Aktif Ticket State
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Geçmiş Ticketlar State
  const [pastTickets, setPastTickets] = useState<any[]>([]);
  const [viewTicket, setViewTicket] = useState<any>(null); // Modalda görüntülenen ticket
  const [viewMessages, setViewMessages] = useState<any[]>([]); // Modaldaki mesajlar

  // Yeni Talep Formu
  const [newSubject, setNewSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');

  // SSS State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initPage = async () => {
      await markAllAsRead(); // Önce tüm bildirimleri temizle
      await fetchData(); // Sonra verileri çek
    };
    initPage();
  }, []);

  // Mesaj gelince en alta kaydır
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- TÜM BİLDİRİMLERİ SIFIRLA ---
  const markAllAsRead = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // Kullanıcının "okunmamış" olarak işaretli TÜM ticketlarını (açık/kapalı fark etmez) okundu yap.
    await supabase
      .from('tickets')
      .update({ has_unread_messages: false })
      .eq('user_id', session.user.id)
      .eq('has_unread_messages', true);
  };

  const fetchData = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    // 1. Aktif Ticket (Açık veya Cevaplanmış)
    const { data: active } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'closed')
      .maybeSingle();

    setActiveTicket(active);

    if (active) {
      const { data: msgs } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', active.id)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
    }

    // 2. Geçmiş Ticketlar (Kapalı olanlar)
    const { data: closed } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .order('created_at', { ascending: false });

    setPastTickets(closed || []);
    setLoading(false);
  };

  const openPastTicketModal = async (ticket: any) => {
    setViewTicket(ticket);
    const { data: msgs } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setViewMessages(msgs || []);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !firstMessage.trim())
      return alert('Konu ve mesaj zorunludur.');

    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert([
          {
            user_id: session?.user.id,
            subject: newSubject,
            status: 'open',
            message: firstMessage,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('ticket_messages')
        .insert([
          { ticket_id: ticket.id, sender_role: 'user', message: firstMessage },
        ]);

      alert('Destek talebi oluşturuldu.');
      setNewSubject('');
      setFirstMessage('');
      fetchData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    setSending(true);
    try {
      await supabase
        .from('ticket_messages')
        .insert([
          {
            ticket_id: activeTicket.id,
            sender_role: 'user',
            message: chatMessage,
          },
        ]);

      await supabase
        .from('tickets')
        .update({ status: 'open' })
        .eq('id', activeTicket.id);

      setChatMessage('');

      const { data: msgs } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', activeTicket.id)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const calculateConsecutiveUserMessages = () => {
    let count = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_role === 'admin') break;
      count++;
    }
    return count;
  };

  const limitReached = calculateConsecutiveUserMessages() >= 10;

  const faqs = [
    {
      id: 1,
      q: 'Şirket bilgilerimi nasıl güncellerim?',
      a: 'Ayarlar > Şirket Bilgileri sekmesinden yönetici iseniz düzenleme yapabilirsiniz.',
    },
    {
      id: 2,
      q: 'Premium üyelik faturama nasıl ulaşırım?',
      a: "Faturalarınız her ayın 1'inde kayıtlı e-posta adresinize otomatik olarak gönderilir.",
    },
    {
      id: 3,
      q: 'Personel limiti doldu, ne yapmalıyım?',
      a: 'Fiyatlandırma sayfasından mevcut paketinizi yükselterek personel limitini artırabilirsiniz.',
    },
  ];

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="animate-spin text-blue-600 mr-2" /> Yükleniyor...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-8 flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-white to-blue-50">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center gap-2">
            <MessageCircle className="text-blue-600" /> Destek Merkezi
          </h1>
          <p className="text-gray-500">Sorunlarınızı çözmek için buradayız.</p>
        </div>

        <div className="flex gap-4 mt-4 md:mt-0">
          <div className="text-center px-6 py-2 bg-white rounded-xl border shadow-sm">
            <div className="text-2xl font-black text-blue-600">
              {activeTicket ? 1 : 0}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase">
              Aktif
            </div>
          </div>
          <div className="text-center px-6 py-2 bg-white rounded-xl border shadow-sm">
            <div className="text-2xl font-black text-gray-600">
              {pastTickets.length}
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase">
              Geçmiş
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTicket ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[600px]">
              <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md z-10">
                <div>
                  <h2 className="font-bold flex items-center gap-2">
                    <MessageCircle size={20} /> {activeTicket.subject}
                  </h2>
                  <p className="text-xs text-blue-200 opacity-80">
                    Talep No: #{activeTicket.id.slice(0, 8)}
                  </p>
                </div>
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                  {activeTicket.status === 'open'
                    ? 'Yanıt Bekleniyor'
                    : 'Yanıtlandı'}
                </span>
              </div>

              <div className="flex-1 bg-gray-50 p-6 overflow-y-auto space-y-4">
                {messages.map((msg) => {
                  const isAdmin = msg.sender_role === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isAdmin ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`flex gap-3 max-w-[80%] ${
                          isAdmin ? 'flex-row' : 'flex-row-reverse'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                            isAdmin
                              ? 'bg-white text-blue-600 border border-gray-200'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isAdmin ? <Shield size={14} /> : <User size={14} />}
                        </div>
                        <div
                          className={`p-4 rounded-2xl text-sm shadow-sm ${
                            isAdmin
                              ? 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                              : 'bg-blue-600 text-white rounded-tr-none'
                          }`}
                        >
                          <div className="font-bold text-[10px] mb-1 opacity-70 uppercase tracking-wide">
                            {isAdmin ? 'Destek Ekibi' : 'Siz'} •{' '}
                            {new Date(msg.created_at)
                              .toLocaleTimeString()
                              .slice(0, 5)}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-gray-200">
                {limitReached ? (
                  <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="flex-shrink-0" />
                    <p className="text-sm font-medium">
                      Lütfen destek ekibinin yanıt vermesini bekleyin.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      className="flex-1 border p-3 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                      placeholder="Mesajınızı yazın..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                    />
                    <button
                      disabled={sending}
                      className="bg-blue-600 text-white px-6 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 font-bold shadow-lg shadow-blue-200"
                    >
                      {sending ? (
                        <Loader size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </form>
                )}
                <div className="text-center mt-2 text-xs text-gray-400">
                  Konu çözüldüğünde talep admin tarafından kapatılacaktır.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Send size={20} className="text-blue-600" /> Yeni Talep Oluştur
              </h3>
              <form onSubmit={handleCreateTicket} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
                    Konu
                  </label>
                  <input
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                    placeholder="Örn: Şirket değişikliği"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
                    Mesajınız
                  </label>
                  <textarea
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
                    rows={5}
                    placeholder="Detayları buraya yazın..."
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                  ></textarea>
                </div>
                <button
                  disabled={sending}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                  {sending ? 'Gönderiliyor...' : 'Talebi Gönder'}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <HelpCircle size={20} className="text-purple-600" /> Sıkça
              Sorulanlar
            </h3>
            <div className="space-y-2">
              {faqs.map((f) => (
                <div
                  key={f.id}
                  className="border border-gray-100 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}
                    className="w-full flex justify-between items-center p-3 text-left bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <span className="text-sm font-bold text-gray-700">
                      {f.q}
                    </span>
                    {openFaq === f.id ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </button>
                  {openFaq === f.id && (
                    <div className="p-3 text-xs text-gray-600 bg-white leading-relaxed">
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-gray-400" /> Kapanmış Talepler
            </h3>
            <div className="space-y-3">
              {pastTickets.length === 0 && (
                <div className="text-gray-400 text-sm italic text-center py-4">
                  Geçmiş talep bulunamadı.
                </div>
              )}
              {pastTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 border border-gray-100 rounded-xl hover:border-blue-200 transition group bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition">
                      {t.subject}
                    </h4>
                    <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                      Kapalı
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    {new Date(t.created_at).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => openPastTicketModal(t)}
                    className="w-full text-xs bg-white border border-gray-200 py-2 rounded-lg font-bold text-gray-600 hover:text-blue-600 hover:border-blue-200 transition flex items-center justify-center gap-1"
                  >
                    <Eye size={12} /> İncele
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewTicket && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl animate-fadeIn">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase mb-1">
                  Geçmiş Talep
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  {viewTicket.subject}
                </h3>
              </div>
              <button
                onClick={() => setViewTicket(null)}
                className="text-gray-400 hover:text-red-500 transition"
              >
                <XCircle size={28} />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-white space-y-4">
              {/* Başlangıç Mesajı */}
              {viewTicket.message && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none border border-gray-200 max-w-[85%]">
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Başlangıç Mesajı
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {viewTicket.message}
                    </p>
                  </div>
                </div>
              )}

              {viewMessages.map((msg) => {
                const isAdmin = msg.sender_role === 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      isAdmin ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <div
                      className={`p-4 rounded-2xl text-sm max-w-[85%] ${
                        isAdmin
                          ? 'bg-green-50 border border-green-200 text-green-900 rounded-tl-none'
                          : 'bg-gray-100 text-gray-700 rounded-tr-none'
                      }`}
                    >
                      <div
                        className={`font-bold text-[10px] mb-1 uppercase ${
                          isAdmin ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {isAdmin ? 'Destek Ekibi (Çözüm)' : 'Siz'} •{' '}
                        {new Date(msg.created_at).toLocaleDateString()}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                );
              })}

              {viewTicket.admin_reply && viewMessages.length === 0 && (
                <div className="flex justify-start">
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-200 max-w-[85%]">
                    <div className="font-bold text-green-700 text-xs mb-2 flex items-center gap-1">
                      <CheckCircle size={12} /> Admin Sonucu:
                    </div>
                    <p className="text-sm text-green-900 whitespace-pre-wrap">
                      {viewTicket.admin_reply}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 text-center text-xs text-gray-500 rounded-b-2xl">
              <Lock size={12} className="inline mr-1" /> Bu talep kapatılmıştır,
              işlem yapılamaz.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
