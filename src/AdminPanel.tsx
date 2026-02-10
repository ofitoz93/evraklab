import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Shield,
  Search,
  Building,
  Edit,
  Users,
  AlertTriangle,
  Trash2,
  Plus,
  MessageSquare,
  CheckCircle,
  XCircle,
  Send,
  Lock,
  Bell, // Bildirim İkonu
  Loader,
} from 'lucide-react';

export default function AdminPanel() {
  // YENİ: 'notifications' sekmesi eklendi
  const [activeTab, setActiveTab] = useState<
    'users' | 'companies' | 'tickets' | 'notifications'
  >('tickets');

  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Ticket Yönetimi ---
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- YENİ: Bildirim Gönderme State'leri ---
  const [targetUser, setTargetUser] = useState('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // --- Kullanıcı ve Şirket State'leri ---
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [newOrgNameForUser, setNewOrgNameForUser] = useState('');
  const [newOrgLimitForUser, setNewOrgLimitForUser] = useState(5);

  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [compName, setCompName] = useState('');
  const [compLimit, setCompLimit] = useState(0);
  const [compDate, setCompDate] = useState('');

  const [viewTeamOrg, setViewTeamOrg] = useState<any>(null);
  const [teamList, setTeamList] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');

  const roleLabels: any = {
    normal: 'Normal',
    premium_individual: 'Bireysel Premium',
    premium_corporate: 'Yönetici',
    corporate_chief: 'Şef',
    corporate_staff: 'Personel',
    admin: 'Admin',
  };
  const isCorporateRole = (r: string) =>
    ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(r);

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'notifications') fetchUsers();
    else if (activeTab === 'companies') fetchCompanies();
    else if (activeTab === 'tickets') fetchTickets();
  }, [activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketMessages]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*, organization:organizations(id, name, subscription_end_date)')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  const fetchCompanies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    setCompanies(data || []);
    setLoading(false);
  };

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('*, sender:profiles!user_id(full_name, email)')
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  // --- YENİ: Bildirim Gönderme Fonksiyonu ---
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim())
      return alert('Başlık ve mesaj zorunludur.');

    setSendingNotif(true);
    try {
      let notificationsToInsert = [];

      if (targetUser === 'all') {
        // Herkese Gönder
        notificationsToInsert = users.map((u) => ({
          user_id: u.id,
          title: notifTitle,
          message: notifMessage,
          type: 'admin_announcement',
          is_read: false,
        }));
      } else {
        // Tek Kişiye Gönder
        notificationsToInsert = [
          {
            user_id: targetUser,
            title: notifTitle,
            message: notifMessage,
            type: 'admin_msg',
            is_read: false,
          },
        ];
      }

      const { error } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (error) throw error;

      alert('Bildirim başarıyla gönderildi!');
      setNotifTitle('');
      setNotifMessage('');
      setTargetUser('all');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingNotif(false);
    }
  };

  const selectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setTicketMessages(data || []);
  };

  const handleReplyTicket = async (ticketId?: any) => {
    const targetId =
      typeof ticketId === 'string' ? ticketId : selectedTicket?.id;

    if (!targetId) {
      return alert('Hata: Hangi destek talebine cevap verileceği bulunamadı.');
    }

    if (!replyText.trim()) return;

    const { error } = await supabase
      .from('ticket_messages')
      .insert([
        { ticket_id: targetId, sender_role: 'admin', message: replyText },
      ]);

    if (error) {
      console.error('Mesaj hatası:', error);
      return alert('Mesaj gönderilemedi: ' + error.message);
    }

    await supabase
      .from('tickets')
      .update({
        status: 'replied',
        has_unread_messages: true,
      })
      .eq('id', targetId);

    setReplyText('');

    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', targetId)
      .order('created_at', { ascending: true });
    setTicketMessages(data || []);

    fetchTickets();
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;
    if (!window.confirm('Bu talebi kapatmak istediğinize emin misiniz?'))
      return;

    await supabase
      .from('tickets')
      .update({ status: 'closed' })
      .eq('id', selectedTicket.id);
    alert('Talep kapatıldı.');
    setSelectedTicket(null);
    fetchTickets();
  };

  const openTeamModal = async (org: any) => {
    setViewTeamOrg(org);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', org.id);
    setTeamList(data || []);
  };

  const removeUserFromOrg = async (userId: string) => {
    if (!window.confirm('Bu kullanıcıyı şirketten çıkarmak istiyor musunuz?'))
      return;
    await supabase
      .from('profiles')
      .update({ organization_id: null, role: 'normal' })
      .eq('id', userId);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', viewTeamOrg.id);
    setTeamList(data || []);
  };

  const addUserToOrg = async () => {
    if (!newUserEmail) return;
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newUserEmail)
      .single();
    if (!user) return alert('Bu e-posta ile kayıtlı kullanıcı bulunamadı.');
    await supabase
      .from('profiles')
      .update({ organization_id: viewTeamOrg.id, role: 'corporate_staff' })
      .eq('id', user.id);
    alert('Kullanıcı şirkete eklendi!');
    setNewUserEmail('');
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', viewTeamOrg.id);
    setTeamList(data || []);
  };

  const openUserModal = async (user: any) => {
    setEditingUser(user);
    setNewRole(user.role);
    let date = user.subscription_end_date;
    if (isCorporateRole(user.role) && user.organization)
      date = user.organization.subscription_end_date;
    setNewEndDate(date ? new Date(date).toISOString().split('T')[0] : '');
    setSelectedOrgId(user.organization_id || '');
    setNewOrgNameForUser('');
    await fetchCompanies();
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (isCorporateRole(newRole)) {
      if (
        !window.confirm(
          '⚠️ Şirket tarihini değiştiriyorsunuz. Tüm personel etkilenecek.'
        )
      )
        return;
    } else {
      if (!window.confirm('Kullanıcıyı güncellemek istediğinize emin misiniz?'))
        return;
    }

    try {
      const finalDate = newEndDate ? new Date(newEndDate).toISOString() : null;
      let targetOrgId = editingUser.organization_id;

      if (isCorporateRole(newRole)) {
        if (selectedOrgId === 'new') {
          if (!newOrgNameForUser.trim()) return alert('Şirket adı giriniz.');
          const { data: newOrg, error } = await supabase
            .from('organizations')
            .insert([
              {
                name: newOrgNameForUser,
                member_limit: newOrgLimitForUser,
                subscription_end_date: finalDate,
              },
            ])
            .select()
            .single();
          if (error) throw error;
          targetOrgId = newOrg.id;
        } else if (selectedOrgId) {
          targetOrgId = selectedOrgId;
          if (finalDate)
            await supabase
              .from('organizations')
              .update({ subscription_end_date: finalDate })
              .eq('id', targetOrgId);
        } else return alert('Şirket seçmelisiniz.');
      }

      const updates: any = { role: newRole };
      if (isCorporateRole(newRole)) {
        updates.organization_id = targetOrgId;
        updates.subscription_end_date = null;
      } else if (newRole === 'premium_individual') {
        updates.organization_id = null;
        updates.subscription_end_date = finalDate;
      } else {
        updates.organization_id = null;
        updates.subscription_end_date = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', editingUser.id);
      if (error) throw error;
      alert('Güncelleme başarılı!');
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const openCompanyModal = (comp: any) => {
    setEditingCompany(comp);
    setCompName(comp.name);
    setCompLimit(comp.member_limit || 5);
    setCompDate(
      comp.subscription_end_date
        ? new Date(comp.subscription_end_date).toISOString().split('T')[0]
        : ''
    );
  };

  const handleSaveCompany = async () => {
    if (
      !window.confirm('Şirketteki TÜM personelin aboneliği etkilenecek. Devam?')
    )
      return;
    try {
      const finalDate = compDate ? new Date(compDate).toISOString() : null;
      await supabase
        .from('organizations')
        .update({
          name: compName,
          member_limit: compLimit,
          subscription_end_date: finalDate,
        })
        .eq('id', editingCompany.id);
      setEditingCompany(null);
      fetchCompanies();
      alert('Şirket güncellendi!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteCompany = async (orgId: string, orgName: string) => {
    if (
      !window.confirm(
        `"${orgName}" şirketini silmek istediğinize emin misiniz?`
      )
    )
      return;
    try {
      await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'normal', org_role: 'staff' })
        .eq('organization_id', orgId);
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);
      if (error) throw error;
      alert('Şirket silindi.');
      fetchCompanies();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const calculateDaysLeft = (dateString: string) => {
    if (!dateString) return 'Yok';
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? `${days} Gün` : 'Dolmuş';
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCompanies = companies.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const openTicketCount = tickets.filter((t) => t.status === 'open').length;

  if (loading && activeTab !== 'tickets')
    return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-red-700 flex items-center gap-2">
            <Shield size={24} /> Admin Yönetim Paneli
          </h1>
        </div>
      </div>

      <div className="flex gap-4 border-b bg-white px-4 rounded-t-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-4 font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'users'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent'
          }`}
        >
          Kullanıcılar
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`py-3 px-4 font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'companies'
              ? 'text-purple-600 border-purple-600'
              : 'text-gray-500 border-transparent'
          }`}
        >
          Şirketler
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`py-3 px-4 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tickets'
              ? 'text-orange-600 border-orange-600'
              : 'text-gray-500 border-transparent'
          }`}
        >
          Destek Talepleri{' '}
          {openTicketCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {openTicketCount}
            </span>
          )}
        </button>
        {/* --- YENİ SEKMESİ: Bildirim Gönder --- */}
        <button
          onClick={() => setActiveTab('notifications')}
          className={`py-3 px-4 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'text-teal-600 border-teal-600'
              : 'text-gray-500 border-transparent'
          }`}
        >
          <Bell size={16} /> Bildirim Gönder
        </button>
      </div>

      <div className="bg-white p-4 rounded-b-xl shadow-sm border space-y-4 min-h-[500px]">
        {activeTab !== 'tickets' && activeTab !== 'notifications' && (
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
            <Search className="text-gray-400" />
            <input
              type="text"
              placeholder="Ara..."
              className="bg-transparent outline-none w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-3">Kullanıcı</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Bitiş</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {filteredUsers.map((user) => {
                let displayDate = user.subscription_end_date;
                if (isCorporateRole(user.role) && user.organization)
                  displayDate = user.organization.subscription_end_date;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-bold">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      {user.organization && (
                        <div className="text-[10px] text-blue-600 font-bold flex gap-1 items-center">
                          <Building size={10} /> {user.organization.name}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold border">
                        {roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono">
                      {displayDate
                        ? new Date(displayDate).toLocaleDateString()
                        : '-'}
                      {displayDate && (
                        <div
                          className={
                            new Date(displayDate) < new Date()
                              ? 'text-red-500 font-bold'
                              : 'text-green-500 font-bold'
                          }
                        >
                          ({calculateDaysLeft(displayDate)})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openUserModal(user)}
                        className="text-blue-600 font-bold text-xs border p-1.5 rounded hover:bg-blue-50 flex items-center gap-1 float-right"
                      >
                        <Edit size={12} /> Düzenle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* COMPANIES TAB */}
        {activeTab === 'companies' && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-3">Şirket Ünvanı</th>
                <th className="p-3">Limit</th>
                <th className="p-3">Abonelik Bitişi</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {filteredCompanies.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="p-3 font-bold text-gray-800 flex items-center gap-2">
                    <Building size={16} className="text-purple-600" />{' '}
                    {comp.name}
                  </td>
                  <td className="p-3">
                    <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded font-bold text-xs">
                      {comp.member_limit} Kişi
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-sm">
                      {comp.subscription_end_date
                        ? new Date(
                            comp.subscription_end_date
                          ).toLocaleDateString()
                        : '-'}
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        new Date(comp.subscription_end_date) < new Date()
                          ? 'text-red-500'
                          : 'text-green-500'
                      }`}
                    >
                      ({calculateDaysLeft(comp.subscription_end_date)})
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openTeamModal(comp)}
                        className="text-blue-600 font-bold text-xs border p-1.5 rounded hover:bg-blue-50 flex items-center gap-1"
                      >
                        <Users size={12} /> Ekip
                      </button>
                      <button
                        onClick={() => openCompanyModal(comp)}
                        className="text-purple-600 font-bold text-xs border p-1.5 rounded hover:bg-purple-50 flex items-center gap-1"
                      >
                        <Edit size={12} /> Düzenle
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(comp.id, comp.name)}
                        className="text-red-600 font-bold text-xs border border-red-200 p-1.5 rounded hover:bg-red-50 flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* --- YENİ TAB: NOTIFICATIONS (BİLDİRİM GÖNDERME) --- */}
        {activeTab === 'notifications' && (
          <div className="max-w-2xl mx-auto py-6">
            <div className="bg-teal-50 border border-teal-100 p-6 rounded-xl mb-6">
              <h2 className="text-xl font-bold text-teal-800 flex items-center gap-2 mb-2">
                <Bell className="text-teal-600" /> Duyuru & Bildirim Paneli
              </h2>
              <p className="text-teal-600 text-sm">
                Buradan tüm kullanıcılara veya tek bir kişiye sistem bildirimi
                gönderebilirsiniz.
              </p>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Kime Gönderilecek?
                </label>
                <select
                  className="w-full p-3 rounded-xl border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-teal-500"
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                >
                  <option value="all">📢 TÜM KULLANICILARA GÖNDER</option>
                  <optgroup label="Tek Kullanıcı Seç">
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || 'İsimsiz'} ({u.email})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bildirim Başlığı
                </label>
                <input
                  type="text"
                  placeholder="Örn: Sistem Bakım Çalışması"
                  className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-teal-500"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Mesaj İçeriği
                </label>
                <textarea
                  rows={5}
                  placeholder="Duyuru detaylarını buraya yazın..."
                  className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                ></textarea>
              </div>

              <button
                disabled={sendingNotif}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-teal-100 disabled:opacity-50"
              >
                {sendingNotif ? (
                  <Loader className="animate-spin" size={20} />
                ) : (
                  <Send size={20} />
                )}
                {sendingNotif ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
              </button>
            </form>
          </div>
        )}

        {/* --- TICKETS TAB --- */}
        {activeTab === 'tickets' && (
          <div className="flex h-[600px] border rounded-xl overflow-hidden bg-white">
            <div className="w-1/3 border-r bg-gray-50 overflow-y-auto">
              <div className="p-4 font-bold border-b bg-gray-100 text-gray-700 sticky top-0">
                Gelen Talepler
              </div>
              {tickets.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Henüz talep yok.
                </div>
              )}
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTicket(t)}
                  className={`p-4 border-b cursor-pointer hover:bg-white transition ${
                    selectedTicket?.id === t.id
                      ? 'bg-white border-l-4 border-l-blue-600 shadow-sm'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        t.status === 'open'
                          ? 'bg-orange-100 text-orange-700'
                          : t.status === 'replied'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {t.status === 'open'
                        ? 'Bekliyor'
                        : t.status === 'replied'
                        ? 'Cevaplandı'
                        : 'Kapalı'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-bold text-gray-800 text-sm truncate mt-1">
                    {t.subject}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Users size={12} /> {t.sender?.full_name || 'Bilinmeyen'}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col bg-white">
              {selectedTicket ? (
                <>
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                      <div className="font-bold text-gray-800">
                        {selectedTicket.subject}
                      </div>
                      <div className="text-xs text-gray-500">
                        {selectedTicket.sender?.email}
                      </div>
                    </div>
                    {selectedTicket.status !== 'closed' ? (
                      <button
                        onClick={closeTicket}
                        className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100 flex items-center gap-1"
                      >
                        <Lock size={12} /> Kapat
                      </button>
                    ) : (
                      <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={12} /> Kapalı
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/30">
                    <div className="flex justify-start">
                      <div className="bg-white p-3 rounded-2xl rounded-tl-none border shadow-sm max-w-[85%]">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                          Kullanıcı (Başlangıç)
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedTicket.message}
                        </p>
                      </div>
                    </div>
                    {ticketMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.sender_role === 'admin'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl shadow-sm max-w-[85%] text-sm ${
                            m.sender_role === 'admin'
                              ? 'bg-blue-600 text-white rounded-tr-none'
                              : 'bg-white border text-gray-800 rounded-tl-none'
                          }`}
                        >
                          <div
                            className={`text-[10px] font-bold uppercase mb-1 ${
                              m.sender_role === 'admin'
                                ? 'text-blue-200'
                                : 'text-gray-400'
                            }`}
                          >
                            {m.sender_role === 'admin' ? 'Siz' : 'Kullanıcı'}
                          </div>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef}></div>
                  </div>

                  {selectedTicket.status !== 'closed' ? (
                    <div className="p-4 border-t bg-white">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Cevabınızı yazın..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleReplyTicket()
                          }
                        />
                        <button
                          onClick={() => handleReplyTicket()}
                          className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-100 text-center text-gray-500 text-sm font-bold border-t">
                      Bu destek talebi kapatılmıştır.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageSquare size={48} className="mb-2 opacity-20" />
                  <p>Detayları görmek için bir talep seçin.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* --- MODALLAR (AYNI KALDI) --- */}
      {viewTeamOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building className="text-purple-600" /> {viewTeamOrg.name} -
                Ekip Yönetimi
              </h3>
              <button onClick={() => setViewTeamOrg(null)}>
                <XCircle className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
            <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
              <input
                className="flex-1 border p-2 rounded text-sm"
                placeholder="Kullanıcı Email Adresi"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <button
                onClick={addUserToOrg}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1"
              >
                <Plus size={14} /> Ekle
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="p-2">İsim</th>
                    <th className="p-2">Rol</th>
                    <th className="p-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teamList.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2">
                        <div>{m.full_name}</div>
                        <div className="text-xs text-gray-500">{m.email}</div>
                      </td>
                      <td className="p-2">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                          {roleLabels[m.role]}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {m.role !== 'premium_corporate' && (
                          <button
                            onClick={() => removeUserFromOrg(m.id)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between mb-4 border-b pb-2">
              <h3 className="text-lg font-bold">Kullanıcı Düzenle</h3>
              <button onClick={() => setEditingUser(null)}>
                <XCircle className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-sm bg-gray-50 p-3 rounded border">
                <div>
                  <b>İsim:</b> {editingUser.full_name}
                </div>
                <div>
                  <b>Email:</b> {editingUser.email}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">
                  Rol Değiştir
                </label>
                <select
                  className="w-full border p-2 rounded bg-white"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {Object.entries(roleLabels).map(([k, v]: any) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              {isCorporateRole(newRole) && (
                <div className="bg-purple-50 p-3 rounded border border-purple-200 animate-fadeIn">
                  <label className="block text-xs font-bold text-purple-900 mb-1">
                    {newRole === 'premium_corporate'
                      ? 'Şirket Yönetimi'
                      : 'Atanacağı Şirket'}
                  </label>
                  <select
                    className="w-full border p-2 rounded bg-white mb-2"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                  >
                    <option value="">-- Şirket Seçin --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="new" className="font-bold text-blue-600">
                      + Yeni Şirket Oluştur
                    </option>
                  </select>
                  {selectedOrgId === 'new' && (
                    <div className="space-y-2 pt-2 border-t border-purple-200">
                      <input
                        type="text"
                        placeholder="Yeni Şirket Adı"
                        className="w-full border p-2 rounded"
                        value={newOrgNameForUser}
                        onChange={(e) => setNewOrgNameForUser(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Limit:</span>
                        <input
                          type="number"
                          className="w-20 border p-2 rounded"
                          value={newOrgLimitForUser}
                          onChange={(e) =>
                            setNewOrgLimitForUser(parseInt(e.target.value))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(newRole.includes('premium') ||
                newRole === 'corporate_chief' ||
                newRole === 'corporate_staff') && (
                <div className="bg-gray-50 p-3 rounded border">
                  <label className="block text-xs font-bold mb-1 flex items-center gap-2">
                    Abonelik Bitiş Tarihi{' '}
                    {isCorporateRole(newRole) && (
                      <span className="text-[10px] text-red-500 bg-red-100 px-1 rounded flex items-center">
                        <AlertTriangle size={10} /> ŞİRKETİ ETKİLER
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={handleSaveUser}
                  className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700"
                >
                  Kaydet
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 border py-2 rounded font-bold hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Building /> Şirket Düzenle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold">Şirket Ünvanı</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Personel Limiti</label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={compLimit}
                  onChange={(e) => setCompLimit(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Abonelik Bitişi</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded"
                  value={compDate}
                  onChange={(e) => setCompDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={handleSaveCompany}
                  className="flex-1 bg-purple-600 text-white py-2 rounded font-bold"
                >
                  Kaydet
                </button>
                <button
                  onClick={() => setEditingCompany(null)}
                  className="flex-1 border py-2 rounded"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
