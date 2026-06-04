import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';
import AdminRegulations from './AdminRegulations';
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
  XCircle,
  Send,
  Lock,
  Bell,
  Loader,
  Scale,
  Mail,
  UserPlus,
  Calendar,
  Database,
  Key,
  Phone,
  ShieldAlert,
} from 'lucide-react';

export default function AdminPanel() {
  // YENİ: 'notifications' sekmesi eklendi
  const [activeTab, setActiveTab] = useState<
    'users' | 'companies' | 'regulations' | 'tickets' | 'notifications'
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
  const [newCanViewRegulations, setNewCanViewRegulations] = useState(false);
  const [newCanManageRegulations, setNewCanManageRegulations] = useState(false);
  const [userQuotaMB, setUserQuotaMB] = useState(0);
  const [companyQuotaMB, setCompanyQuotaMB] = useState(0);
  
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
  const [compIsEnvConsultant, setCompIsEnvConsultant] = useState(false);
  const [orgsWithRegs, setOrgsWithRegs] = useState<Set<string>>(new Set());

  const [viewTeamOrg, setViewTeamOrg] = useState<any>(null);
  const [teamList, setTeamList] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');

  // --- YENİ: Hata ve Yükleme State'leri ---
  const [companySaveError, setCompanySaveError] = useState<string | null>(null);
  const [userSaveError, setUserSaveError] = useState<string | null>(null);

  // --- YENİ: Kullanıcı Oluşturma State'leri ---
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createRole, setCreateRole] = useState('normal');
  const [createOrgId, setCreateOrgId] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createQuotaMB, setCreateQuotaMB] = useState(50);
  const [createCanViewRegulations, setCreateCanViewRegulations] = useState(false);
  const [createCanManageRegulations, setCreateCanManageRegulations] = useState(false);
  const [createUserLoading, setCreateUserLoading] = useState(false);

  const roleLabels: any = {
    normal: 'Normal',
    premium_individual: 'Bireysel Premium',
    premium_corporate: 'Yönetici',
    corporate_chief: 'Şef',
    corporate_staff: 'Personel',
    admin: 'Admin',
    system_admin: 'Sistem Admin',
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
    try {
      // 1. Kullanıcıları ve Şirketleri ayrı ayrı çek (İlişki hatasını baypas etmek için manuel join)
      const { data: profs, error: pErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      const { data: comps, error: cErr } = await supabase.from('companies').select('id, name, subscription_end_date');
      
      if (pErr) throw pErr;

      // Manuel Map ile birleştir
      const companyMap = new Map();
      if(comps) comps.forEach(c => companyMap.set(c.id, c));

      const mergedUsers = (profs || []).map(u => ({
          ...u,
          organization: companyMap.get(u.organization_id) || null
      }));

      // Firmalara atanmış mevzuatları çek
      const { data: compRegs } = await supabase.from('company_pdf_regulations').select('company_id');
      const orgSet = new Set<string>((compRegs || []).map(r => r.company_id));
      setOrgsWithRegs(orgSet);

      setUsers(mergedUsers);
    } catch (err: any) {
      console.error("Kullanıcı listesi çekilirken hata:", err.message);
      setUsers([]);
    }
    setLoading(false);
  };

  const [companyFetchError, setCompanyFetchError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    setCompanyFetchError(null);
    try {
      // 1. Deneme: 'companies' tablosu
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (err: any) {
      console.warn("Şirket listesi 'companies' tablosundan çekilemedi:", err.message);
      
      try {
        // 2. Deneme: 'organizations' tablosu (Eski isim)
        const { data: orgData, error: orgError } = await supabase.from('organizations').select('*');
        if (orgError) throw orgError;
        setCompanies(orgData || []);
      } catch (err2: any) {
        setCompanyFetchError(`Tablo bulunamadı: ${err.message}`);
        console.error("Tüm tablo denemeleri başarısız oldu.");
      }
    }
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
          type: 'system_admin_announcement',
          is_read: false,
        }));
      } else {
        // Tek Kişiye Gönder
        notificationsToInsert = [
          {
            user_id: targetUser,
            title: notifTitle,
            message: notifMessage,
            type: 'system_admin_msg',
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
    setUserQuotaMB(Math.round((user.storage_limit || 0) / 1048576));
    setNewCanViewRegulations(!!user.can_view_regulations || !!(user.organization_id && orgsWithRegs.has(user.organization_id)));
    setNewCanManageRegulations(!!user.can_manage_regulations);
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

    setUserSaveError(null);
    try {
      const finalDate = newEndDate ? new Date(newEndDate).toISOString() : null;
      let targetOrgId = editingUser.organization_id;

      if (isCorporateRole(newRole)) {
        if (selectedOrgId === 'new') {
          if (!newOrgNameForUser.trim()) return alert('Şirket adı giriniz.');
          const { data: newOrg, error } = await supabase
            .from('companies')
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
              .from('companies')
              .update({ subscription_end_date: finalDate })
              .eq('id', targetOrgId);
        } else return alert('Şirket seçmelisiniz.');
      }

      const updates: any = { 
        role: newRole,
        can_view_regulations: newCanViewRegulations,
        can_manage_regulations: newCanManageRegulations,
        storage_limit: userQuotaMB * 1048576,
      };
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
      console.error("Kullanıcı kaydetme hatası:", error);
      if (error.message?.includes('row-level security') || error.message?.includes('RLS') || error.code === '42501') {
        setUserSaveError(
          '⚠️ Veritabanı RLS Politikası Engeli!\n' +
          'Kullanıcı verilerini güncelleme yetkiniz veritabanı RLS politikaları tarafından engellendi.'
        );
      } else {
        setUserSaveError('Hata: ' + error.message);
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createPassword.trim() || !createFullName.trim() || !createPhone.trim()) {
      return alert('Lütfen zorunlu alanları (E-posta, Şifre, Ad Soyad, Telefon) doldurun.');
    }
    if (createPassword.length < 6) {
      return alert('Şifre en az 6 karakter olmalıdır.');
    }

    setCreateUserLoading(true);
    setUserSaveError(null);
    try {
      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: createEmail,
        password: createPassword,
        options: {
          data: {
            full_name: createFullName,
            phone: createPhone,
          },
        },
      });

      if (authErr) throw authErr;
      if (!authData.user) {
        throw new Error('Kullanıcı kaydı başlatıldı fakat kullanıcı objesi alınamadı.');
      }

      // Supabase trigger'ının profili insert etmesi için asenkron gecikmeyi bekle
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const finalDate = createEndDate ? new Date(createEndDate).toISOString() : null;
      
      const updates: any = {
        full_name: createFullName,
        phone: createPhone,
        role: createRole,
        can_view_regulations: createCanViewRegulations,
        can_manage_regulations: createCanManageRegulations,
        storage_limit: createQuotaMB * 1048576,
      };

      if (isCorporateRole(createRole)) {
        if (!createOrgId) {
          throw new Error('Kurumsal bir rol için lütfen bir şirket seçin.');
        }
        updates.organization_id = createOrgId;
        updates.subscription_end_date = null;
      } else if (createRole === 'premium_individual') {
        updates.organization_id = null;
        updates.subscription_end_date = finalDate;
      } else {
        updates.organization_id = null;
        updates.subscription_end_date = null;
      }

      const { error: profileUpdateErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: createEmail,
          ...updates,
          updated_at: new Date(),
        });

      if (profileUpdateErr) throw profileUpdateErr;

      alert(`✅ Kullanıcı başarıyla oluşturuldu!\nE-posta: ${createEmail}`);
      setShowCreateUserModal(false);
      
      // Formu temizle
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setCreatePhone('');
      setCreateRole('normal');
      setCreateOrgId('');
      setCreateEndDate('');
      setCreateQuotaMB(50);
      setCreateCanViewRegulations(false);
      setCreateCanManageRegulations(false);
      
      fetchUsers();
    } catch (err: any) {
      console.error("Kullanıcı oluşturma hatası:", err);
      if (err.message?.includes('row-level security') || err.message?.includes('RLS') || err.code === '42501') {
        setUserSaveError(
          '⚠️ Veritabanı RLS Politikası Engeli!\n' +
          'Kullanıcı oluşturma yetkiniz veritabanı RLS politikaları tarafından engellendi. ' +
          'Lütfen Supabase Dashboard > SQL Editor sekmesinde size verilen SQL kodunu çalıştırın.'
        );
      } else {
        setUserSaveError('Hata: ' + err.message);
      }
    } finally {
      setCreateUserLoading(false);
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
    setCompIsEnvConsultant(!!comp.is_environmental_consultant);
    setCompanyQuotaMB(Math.round((comp.storage_limit || 0) / 1048576));
  };

  const handleSaveCompany = async () => {
    const isNew = editingCompany.id === 'new';
    if (
      !isNew &&
      !window.confirm('Şirketteki TÜM personelin aboneliği etkilenecek. Devam?')
    )
      return;
    
    setCompanySaveError(null);
    try {
      const finalDate = compDate ? new Date(compDate).toISOString() : null;
      if (isNew) {
        const { error } = await supabase
          .from('organizations')
          .insert([
            {
              name: compName,
              member_limit: compLimit,
              subscription_end_date: finalDate,
              storage_limit: companyQuotaMB * 1048576,
              is_environmental_consultant: compIsEnvConsultant,
            },
          ]);
        if (error) throw error;
        alert('Yeni şirket başarıyla oluşturuldu!');
      } else {
        const { error } = await supabase
          .from('organizations')
          .update({
            name: compName,
            member_limit: compLimit,
            subscription_end_date: finalDate,
            storage_limit: companyQuotaMB * 1048576,
            is_environmental_consultant: compIsEnvConsultant,
          })
          .eq('id', editingCompany.id);
        if (error) throw error;
        alert('Şirket güncellendi!');
      }
      setEditingCompany(null);
      fetchCompanies();
    } catch (e: any) {
      console.error("Şirket kaydetme hatası:", e);
      if (e.message?.includes('row-level security') || e.message?.includes('RLS') || e.code === '42501') {
        setCompanySaveError(
          '⚠️ Veritabanı RLS Politikası Engeli!\n' +
          'Şirket oluşturma/güncelleme yetkiniz veritabanı RLS politikaları tarafından engellendi. ' +
          'Lütfen Supabase Dashboard > SQL Editor sekmesinde size verilen SQL kodunu çalıştırın.'
        );
      } else {
        setCompanySaveError('Hata: ' + e.message);
      }
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
          onClick={() => setActiveTab('regulations')}
          className={`py-3 px-4 font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'regulations'
              ? 'text-red-600 border-red-600'
              : 'text-gray-500 border-transparent'
          }`}
        >
          <Scale size={16} /> Mevzuat Yönetimi
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
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <Users size={16} className="text-blue-500" />
                Sistemdeki tüm kullanıcıları yönetin ve yetkilendirin.
                <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {filteredUsers.length} Kullanıcı
                </span>
              </span>
              <button
                onClick={() => {
                  setShowCreateUserModal(true);
                  // Formu temizle
                  setCreateEmail('');
                  setCreatePassword('');
                  setCreateFullName('');
                  setCreatePhone('');
                  setCreateRole('normal');
                  setCreateOrgId('');
                  setCreateEndDate('');
                  setCreateQuotaMB(50);
                  setCreateCanViewRegulations(false);
                  setCreateCanManageRegulations(false);
                  setUserSaveError(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-100"
              >
                <Plus size={14} /> Yeni Kullanıcı Ekle
              </button>
            </div>
            
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
                      <div className="flex flex-col gap-1">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold border w-fit">
                          {roleLabels[user.role] || user.role}
                        </span>
                        {(user.can_view_regulations || (user.organization_id && orgsWithRegs.has(user.organization_id)) || user.role === 'admin' || user.role === 'system_admin') && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 w-fit">
                            <Scale size={10} /> Mevzuat Yetkili
                          </span>
                        )}
                      </div>
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
          </div>
        )}

        {/* COMPANIES TAB */}
        {activeTab === 'companies' && (
          <div className="animate-fadeIn">
            {companyFetchError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2">
                 <AlertTriangle size={18} /> {companyFetchError}
              </div>
            )}
            
            <div className="flex justify-between items-center mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <Building size={16} className="text-purple-500" />
                Sistemdeki tüm danışmanlık firmalarını ve kurumsal şirketleri yönetin.
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {filteredCompanies.length} Şirket
                </span>
              </span>
              <button
                onClick={() => {
                  setEditingCompany({ id: 'new' });
                  setCompName('');
                  setCompLimit(5);
                  setCompDate('');
                  setCompIsEnvConsultant(false);
                  setCompanyQuotaMB(500); // Varsayılan 500 MB kota
                  setCompanySaveError(null);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-purple-100"
              >
                <Plus size={14} /> Yeni Şirket Ekle
              </button>
            </div>

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
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((comp) => (
                  <tr key={comp.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-gray-800 flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                        {(comp.name || comp.title || 'Ş').substring(0,1).toUpperCase()}
                      </div>
                      {comp.name || comp.title || 'İsimsiz Şirket'}
                    </td>
                    <td className="p-3">
                      <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded font-bold text-[10px] border border-purple-100">
                        {comp.member_limit || comp.user_limit || comp.limit || '0'} Kişi
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {comp.subscription_end_date
                          ? new Date(comp.subscription_end_date).toLocaleDateString()
                          : '-'}
                      </div>
                      {comp.subscription_end_date && (
                        <div
                          className={`text-[10px] font-bold ${
                            new Date(comp.subscription_end_date) < new Date()
                              ? 'text-red-500'
                              : 'text-green-500'
                          }`}
                        >
                          ({calculateDaysLeft(comp.subscription_end_date)})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openTeamModal(comp)}
                          className="text-blue-600 font-bold text-[10px] border p-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1"
                        >
                          <Users size={12} /> Ekip
                        </button>
                        <button
                          onClick={() => openCompanyModal(comp)}
                          className="text-purple-600 font-bold text-[10px] border p-1.5 rounded-lg hover:bg-purple-50 flex items-center gap-1"
                        >
                          <Edit size={12} /> Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteCompany(comp.id, comp.name || comp.title)}
                          className="text-red-600 font-bold text-[10px] border border-red-200 p-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan={4} className="p-10 text-center text-gray-400 italic">
                      Henüz sisteme kayıtlı şirket bulunamadı.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
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

        {/* --- YENİ TAB: MEVZUAT YÖNETİMİ --- */}
        {activeTab === 'regulations' && (
          <div className="animate-fadeIn">
            <AdminRegulations />
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

      {showCreateUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 overflow-y-auto max-h-[90vh] animate-fadeIn transition-all">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                Yeni Kullanıcı Ekle
              </h3>
              <button 
                onClick={() => setShowCreateUserModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {userSaveError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold whitespace-pre-wrap flex items-start gap-2 animate-fadeIn">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>{userSaveError}</div>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ad Soyad *</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ad Soyad"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                      value={createFullName}
                      onChange={(e) => setCreateFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Telefon *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="05xx xxx xx xx"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">E-posta Adresi *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="ornek@domain.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Şifre * (En az 6 karakter)</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kullanıcı Rolü</label>
                <select
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700"
                  value={createRole}
                  onChange={(e) => {
                    setCreateRole(e.target.value);
                    if (!isCorporateRole(e.target.value)) {
                      setCreateOrgId('');
                    }
                  }}
                >
                  {Object.entries(roleLabels).map(([k, v]: any) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {isCorporateRole(createRole) && (
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 animate-fadeIn">
                  <label className="block text-xs font-bold text-purple-900 mb-1.5 uppercase tracking-wider">Atanacağı Şirket *</label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-purple-200 bg-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-purple-700"
                    value={createOrgId}
                    required={isCorporateRole(createRole)}
                    onChange={(e) => setCreateOrgId(e.target.value)}
                  >
                    <option value="">-- Şirket Seçin --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(createRole.includes('premium') || isCorporateRole(createRole)) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={14} className="text-slate-500" />
                    Abonelik Bitiş Tarihi
                    {isCorporateRole(createRole) && (
                      <span className="text-[9px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold uppercase ml-auto">
                        Şirket Ayarı
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    disabled={isCorporateRole(createRole)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                  />
                  {isCorporateRole(createRole) && (
                    <p className="text-[10px] text-purple-600 mt-1 italic font-medium">
                      * Kurumsal üyelerin aboneliği, bağlı oldukları şirketin abonelik bitiş tarihi ile eşleşir.
                    </p>
                  )}
                </div>
              )}

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-xs font-bold text-blue-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600" />
                  Özel Depolama Kotası (MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700 bg-white"
                    value={createQuotaMB}
                    onChange={(e) => setCreateQuotaMB(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-2 rounded-xl">MB</span>
                </div>
              </div>

              <div className="bg-teal-50/40 p-4 rounded-2xl border border-teal-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="create-view-regs"
                  className="mt-1 w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                  checked={createCanViewRegulations}
                  onChange={(e) => setCreateCanViewRegulations(e.target.checked)}
                />
                <label htmlFor="create-view-regs" className="flex flex-col cursor-pointer select-none">
                  <span className="text-sm font-bold text-teal-900 flex items-center gap-2">
                    Mevzuat Sayfası Erişimi
                  </span>
                  <span className="text-[10px] text-teal-600/80 font-medium">
                    Bu kullanıcının sistem genelindeki Mevzuat modülünü görüntüleme yetkisi olsun.
                  </span>
                </label>
              </div>

              <div className="bg-orange-50/40 p-4 rounded-2xl border border-orange-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="create-manage-regs"
                  className="mt-1 w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                  checked={createCanManageRegulations}
                  onChange={(e) => setCreateCanManageRegulations(e.target.checked)}
                />
                <label htmlFor="create-manage-regs" className="flex flex-col cursor-pointer select-none">
                  <span className="text-sm font-bold text-orange-900">
                    Mevzuat Yönetme Yetkisi
                  </span>
                  <span className="text-[10px] text-orange-600/80 font-medium">
                    Kendi şirketi adına yeni mevzuat maddeleri/dosyaları ekleyip düzenleyebilsin.
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={createUserLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {createUserLoading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {createUserLoading ? 'Kullanıcı Kaydediliyor...' : 'Kaydet ve Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 overflow-y-auto max-h-[90vh] animate-fadeIn transition-all">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                Kullanıcı Yetki & Profil Düzenleme
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {userSaveError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold whitespace-pre-wrap flex items-start gap-2 animate-fadeIn">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>{userSaveError}</div>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-sm bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-1">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Tam Adı:</span>
                  <span className="font-bold text-slate-800">{editingUser.full_name || 'Girilmemiş'}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>E-posta:</span>
                  <span className="font-bold text-slate-800">{editingUser.email}</span>
                </div>
                {editingUser.phone && (
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Telefon:</span>
                    <span className="font-bold text-slate-800">{editingUser.phone}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kullanıcı Rolü</label>
                <select
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700"
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    if (!isCorporateRole(e.target.value)) {
                      setSelectedOrgId('');
                    }
                  }}
                >
                  {Object.entries(roleLabels).map(([k, v]: any) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {isCorporateRole(newRole) && (
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 animate-fadeIn space-y-3">
                  <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider">
                    {newRole === 'premium_corporate' ? 'Yönettiği Şirket' : 'Atanacağı Şirket'}
                  </label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-purple-200 bg-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-purple-700"
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
                      + Yeni Şirket Oluştur ve Ata
                    </option>
                  </select>

                  {selectedOrgId === 'new' && (
                    <div className="space-y-3 pt-3 border-t border-purple-100 animate-slideDown">
                      <div>
                        <label className="block text-[10px] font-bold text-purple-700 mb-1 uppercase">Yeni Şirket Ünvanı</label>
                        <input
                          type="text"
                          placeholder="Yeni Şirket Adı"
                          className="w-full p-2.5 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-medium"
                          value={newOrgNameForUser}
                          onChange={(e) => setNewOrgNameForUser(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-purple-700 uppercase">Personel Limiti:</span>
                        <input
                          type="number"
                          className="w-24 p-2.5 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-slate-700 text-center"
                          value={newOrgLimitForUser}
                          onChange={(e) => setNewOrgLimitForUser(parseInt(e.target.value) || 2)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(newRole.includes('premium') || isCorporateRole(newRole)) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={14} className="text-slate-500" />
                    Abonelik Bitiş Tarihi
                    {isCorporateRole(newRole) && (
                      <span className="text-[9px] text-red-600 bg-red-50 border border-red-150 px-1.5 py-0.5 rounded font-bold uppercase ml-auto flex items-center gap-0.5">
                        <AlertTriangle size={10} /> Şirketi Etkiler
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium bg-white"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                  {isCorporateRole(newRole) && (
                    <p className="text-[10px] text-red-500 mt-1.5 font-medium leading-relaxed">
                      * Dikkat: Kurumsal yöneticilerin bitiş tarihi değiştirildiğinde tüm şirket çalışanlarının abonelik bitişi de senkronize olarak güncellenir.
                    </p>
                  )}
                </div>
              )}

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-xs font-bold text-blue-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600" />
                  Özel Depolama Kotası (MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700 bg-white"
                    value={userQuotaMB}
                    onChange={(e) => setUserQuotaMB(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-2 rounded-xl">MB</span>
                </div>
              </div>

              <div className="bg-teal-50/40 p-4 rounded-2xl border border-teal-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="view-regs"
                  className="mt-1 w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer"
                  checked={newCanViewRegulations}
                  onChange={(e) => setNewCanViewRegulations(e.target.checked)}
                />
                <label htmlFor="view-regs" className="flex flex-col cursor-pointer select-none">
                  <span className="text-sm font-bold text-teal-900 flex items-center gap-2">
                    Mevzuat Sayfası Erişimi
                    {editingUser?.organization_id && orgsWithRegs.has(editingUser.organization_id) && (
                      <span className="bg-teal-600 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Building size={8} /> Firmadan Aktif
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-teal-600/80 font-medium">
                    Bu kullanıcının sistem genelindeki Mevzuat modülünü görüntüleme yetkisi olsun.
                  </span>
                </label>
              </div>

              <div className="bg-orange-50/40 p-4 rounded-2xl border border-orange-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="manage-regs"
                  className="mt-1 w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                  checked={newCanManageRegulations}
                  onChange={(e) => setNewCanManageRegulations(e.target.checked)}
                />
                <label htmlFor="manage-regs" className="flex flex-col cursor-pointer select-none">
                  <span className="text-sm font-bold text-orange-900">
                    Mevzuat Yönetme Yetkisi
                  </span>
                  <span className="text-[10px] text-orange-600/80 font-medium">
                    Kendi şirketi adına yeni mevzuat maddeleri/dosyaları ekleyip düzenleyebilsin.
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleSaveUser}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  <Shield size={16} /> Değişiklikleri Kaydet
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-fadeIn transition-all">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Building size={20} />
                </div>
                {editingCompany.id === 'new' ? 'Yeni Şirket Oluştur' : 'Şirket Bilgilerini Düzenle'}
              </h3>
              <button 
                onClick={() => setEditingCompany(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {companySaveError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold whitespace-pre-wrap flex items-start gap-2 animate-fadeIn shadow-sm">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">
                  {companySaveError}
                  {companySaveError.includes('RLS') && (
                    <div className="mt-2 text-xs bg-white/70 p-2.5 rounded-lg border border-red-100 text-red-800 font-mono select-all">
                      -- Supabase Dashboard SQL Editor'de çalıştırılacak script planda mevcut!
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Şirket Ünvanı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Acme A.Ş."
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-medium"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Personel Limiti</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-slate-700"
                    value={compLimit}
                    onChange={(e) => setCompLimit(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Abonelik Bitişi</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-medium text-slate-700"
                    value={compDate}
                    onChange={(e) => setCompDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <label className="block text-xs font-bold text-purple-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-purple-600" />
                  Ortak Şirket Kotası (MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-slate-700 bg-white"
                    value={companyQuotaMB}
                    onChange={(e) => setCompanyQuotaMB(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-2 rounded-xl">MB</span>
                </div>
              </div>

              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="comp-env"
                  className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  checked={compIsEnvConsultant}
                  onChange={(e) => setCompIsEnvConsultant(e.target.checked)}
                />
                <label htmlFor="comp-env" className="flex flex-col cursor-pointer select-none">
                  <span className="text-sm font-bold text-blue-900">Çevre Danışmanlık Yetkisi (Raporlar Modülü)</span>
                  <span className="text-[10px] text-blue-600/80 font-medium">Bu şirket için detaylı Çevre Danışmanlığı Raporu (Aylık/Yıllık) hazırlama modülünü etkinleştirir.</span>
                </label>
              </div>

              {editingCompany.id !== 'new' && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[10px] font-medium leading-relaxed">
                  ⚠️ Şirket bilgileri veya abonelik süresi güncellendiğinde, bu şirkete bağlı tüm çalışanların paket aktiflik süreleri bu durumdan etkilenecektir.
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleSaveCompany}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
                >
                  <Building size={16} /> Şirketi Kaydet
                </button>
                <button
                  onClick={() => setEditingCompany(null)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
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

