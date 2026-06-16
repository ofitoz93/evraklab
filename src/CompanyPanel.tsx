import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Users,
  Ticket,
  Copy,
  Trash2,
  Mail,
  Shield,
  UserCog,
  CheckSquare,
  Square,
  PieChart,
  AlertCircle,
  Building,
  Lock,
  Send,
  Clock,
  User,
  Loader,
  Crown,
  XCircle,
  BookOpen,
  PlusCircle,
} from 'lucide-react';

export default function CompanyPanel() {
  const [loading, setLoading] = useState(true);
  const [myOrg, setMyOrg] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Compliance (Mevzuatlarımız) states
  const [activeTab, setActiveTab] = useState<'team' | 'compliance'>('team');
  const [clientRecId, setClientRecId] = useState<string | null>(null);
  const [myRegulations, setMyRegulations] = useState<any[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [selectedRegArticles, setSelectedRegArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [regsError, setRegsError] = useState<string | null>(null);

  // Mevcut Durum (Current Status Notes) states
  const [editingNotesArtId, setEditingNotesArtId] = useState<string | null>(null);
  const [tempNotesVal, setTempNotesVal] = useState('');

  // Consultant mode in CompanyPanel states
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedRegId, setSelectedRegId] = useState<string>('');

  // Request Modal & List states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestClientId, setRequestClientId] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);

  // Yetki İsimleri (Türkçe)
  const permLabels: any = {
    can_invite: 'Davet Yetkisi',
    can_view_team_docs: 'Ekip Dosyalarını Gör',
    can_edit_team_docs: 'Dosya Düzenle',
    can_delete_team_docs: 'Dosya Sil',
  };

  // Rol İsimleri (Türkçe Çeviri)
  const roleLabels: any = {
    premium_corporate: 'Şirket Sahibi',
    corporate_chief: 'Departman Şefi',
    corporate_staff: 'Personel',
    normal: 'Normal Üye',
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          let orgData = null;
          if (profile.organization_id) {
            const { data: org } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', profile.organization_id)
              .single();
            orgData = org;
          }
          const combined = { ...profile, organization: orgData };
          setMyProfile(combined);

          if (orgData) {
            setMyOrg(orgData);

          // 1. MEVCUT ÜYELER
          let query = supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id);

          if (profile.role === 'premium_corporate')
            query = query.neq('id', session.user.id);

          const { data: members } = await query.order('role', {
            ascending: true,
          });
          setTeamMembers(members || []);

          // 2. BEKLEYEN DAVETLER
          const { data: invites } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('is_used', false)
            .order('created_at', { ascending: false });
          setInvitations(invites || []);
        }
      }
    }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestsForClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('regulation_requests')
        .select('*, requested_by_profile:profiles!requested_by(full_name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMyRequests(data || []);
    } catch (err: any) {
      console.error('Talepler çekilirken hata:', err.message);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim() || !requestDescription.trim()) {
      return alert('Lütfen tüm alanları doldurun.');
    }

    const isConsultantUser = !!myOrg?.is_environmental_consultant || 
      ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(myProfile?.role);
    
    const targetClientId = isConsultantUser ? requestClientId : clientRecId;

    if (!targetClientId) {
      return alert('Lütfen talep yapılacak firmayı seçin.');
    }

    try {
      setSubmittingRequest(true);
      const isOwner = myProfile?.role === 'premium_corporate';
      const reqType = isOwner ? 'owner_to_admin' : 'staff_to_owner';

      const { error } = await supabase
        .from('regulation_requests')
        .insert({
          title: requestTitle.trim(),
          description: requestDescription.trim(),
          requested_by: myProfile.id,
          client_id: targetClientId,
          organization_id: myOrg.id,
          request_type: reqType,
          status: 'pending'
        });

      if (error) throw error;

      alert('Mevzuat talebiniz başarıyla iletildi!');
      setShowRequestModal(false);
      setRequestTitle('');
      setRequestDescription('');
      
      if (clientRecId) {
        await fetchRequestsForClient(clientRecId);
      } else {
        await fetchRequestsForClient(targetClientId);
      }
    } catch (err: any) {
      alert('Talep gönderilirken hata oluştu: ' + err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleSelectRegulation = async (regId: string) => {
    setSelectedRegId(regId);
    if (regId) {
      const reg = myRegulations.find((r) => r.id === regId);
      if (reg) {
        await fetchRegulationArticles(reg);
      }
    } else {
      setSelectedReg(null);
      setSelectedRegArticles([]);
    }
  };

  const fetchRegulationsForClient = async (clientId: string) => {
    setLoadingRegs(true);
    setRegsError(null);
    setSelectedReg(null);
    setSelectedRegArticles([]);
    setSelectedRegId('');
    try {
      setClientRecId(clientId);
      const { data: regs, error: regsErr } = await supabase
        .from('client_regulations')
        .select('*, parent:pdf_regulations(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (regsErr) throw regsErr;
      setMyRegulations(regs || []);

      // Fetch requests for this client
      await fetchRequestsForClient(clientId);
    } catch (err: any) {
      console.error('Mevzuatlar çekilirken hata:', err.message);
      setRegsError(err.message);
    } finally {
      setLoadingRegs(false);
    }
  };

  const fetchMyRegulations = async (orgName: string) => {
    setLoadingRegs(true);
    setRegsError(null);
    try {
      const isConsultant = !!myOrg?.is_environmental_consultant || 
        ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(myProfile?.role);
      if (isConsultant) {
        let clientsList: any[] = [];
        const canViewAll = myProfile?.role === 'premium_corporate' || !!myProfile?.permissions?.can_view_all_clients;
        if (canViewAll) {
          // Get all clients of the consultant company
          const { data } = await supabase
            .from('consultant_clients')
            .select('id, name')
            .eq('consultant_company_id', myOrg.id);
          clientsList = data || [];
        } else {
          // Get clients assigned to this staff member
          const { data } = await supabase
            .from('consultant_assignments')
            .select('client_id, client:consultant_clients(id, name)')
            .eq('user_id', myProfile?.id);
          clientsList = data?.map((a: any) => a.client).filter(Boolean) || [];
        }
        setAssignedClients(clientsList);
        
        // Do not auto-select. Force them to select a firm.
        setSelectedClientId('');
        setClientRecId(null);
        setMyRegulations([]);
      } else {
        // Normal client company: find matching client record in consultant_clients
        const { data: ccList, error: ccErr } = await supabase
          .from('consultant_clients')
          .select('id, name');
        
        if (ccErr) throw ccErr;
        
        let clientRec = null;
        if (ccList && ccList.length > 0) {
          // Try to find the closest match by substring matching
          const cleanOrgName = orgName.trim().toLowerCase();
          clientRec = ccList.find((c: any) => {
            const cleanClientName = c.name.trim().toLowerCase();
            return cleanClientName.includes(cleanOrgName) || cleanOrgName.includes(cleanClientName);
          });
          
          // If no fuzzy match, default to the first one available
          if (!clientRec) {
            clientRec = ccList[0];
          }
        }
        
        if (clientRec) {
          await fetchRegulationsForClient(clientRec.id);
        } else {
          setClientRecId(null);
          setMyRegulations([]);
        }
      }
    } catch (err: any) {
      console.error('Mevzuatlar çekilirken hata:', err.message);
      setRegsError(err.message);
    } finally {
      setLoadingRegs(false);
    }
  };

  const fetchRegulationArticles = async (reg: any) => {
    setLoadingArticles(true);
    setSelectedReg(reg);
    try {
      const { data, error } = await supabase
        .from('client_regulation_articles')
        .select('*, updater:profiles!last_updated_by(full_name)')
        .eq('client_regulation_id', reg.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSelectedRegArticles(data || []);
    } catch (err: any) {
      console.error('Maddeler çekilirken hata:', err.message);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleToggleArticleMandatory = async (artId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ is_mandatory: !currentStatus, last_updated_by: myProfile?.id })
        .eq('id', artId);

      if (error) throw error;

      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  const handleUpdateArticleCompliance = async (artId: string, status: 'compliant' | 'non_compliant') => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ compliance_status: status, last_updated_by: myProfile?.id })
        .eq('id', artId);

      if (error) throw error;

      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  const handleSaveArticleNotes = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({
          current_status_notes: tempNotesVal.trim() || null,
          current_status_requested: false,
          last_updated_by: myProfile?.id
        })
        .eq('id', articleId);
      if (error) throw error;
      
      setEditingNotesArtId(null);
      setTempNotesVal('');
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
    } catch (err: any) {
      alert('Mevcut durum notu kaydedilirken hata: ' + err.message);
    }
  };

  const handleRequestArticleNotes = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ current_status_requested: true })
        .eq('id', articleId);
      if (error) throw error;
      
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
      alert('Mevcut durum notu girişi talep edildi.');
    } catch (err: any) {
      alert('Talep iletilirken hata: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'compliance' && myOrg?.name && myProfile) {
      fetchMyRegulations(myOrg.name);
    }
  }, [activeTab, myOrg, myProfile]);

  const isConsultant = !!myOrg?.is_environmental_consultant || 
    ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(myProfile?.role);
  const isCorporateAdmin = myProfile?.role === 'premium_corporate';
  const canInvite =
    isCorporateAdmin ||
    (myProfile?.role === 'corporate_chief' &&
      myProfile?.permissions?.can_invite);
  const isExpired = myProfile?.role === 'normal' && myProfile?.organization_id;

  const billableMembersCount = teamMembers.filter(
    (m) => m.role !== 'premium_corporate'
  ).length;
  const totalUsed = billableMembersCount + invitations.length;
  const maxLimit = myOrg?.member_limit || 5;
  const usagePercent = Math.min(100, (totalUsed / maxLimit) * 100);
  const isFull = totalUsed >= maxLimit;

  // --- 1. E-POSTA İLE DAVET (Geri Eklendi) ---
  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalUsed >= maxLimit)
      return alert('Kapasite dolu! Paket yükseltmeniz gerekiyor.');
    if (!inviteEmail.includes('@')) return alert('Geçerli bir email giriniz.');

    setSendingEmail(true);
    try {
      // Mevcut davet var mı?
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', myOrg.id)
        .eq('email', inviteEmail)
        .eq('is_used', false)
        .maybeSingle();

      if (existingInvite) {
        alert('⚠️ Bu kullanıcıya zaten bekleyen bir davet var.');
        setSendingEmail(false);
        return;
      }

      // Kullanıcıyı Bul
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, organization_id')
        .eq('email', inviteEmail)
        .single();

      if (userError || !targetUser) {
        alert('❌ Kullanıcı Bulunamadı! (Sisteme kayıtlı olması gerekir)');
        setSendingEmail(false);
        return;
      }
      if (targetUser.organization_id) {
        alert('⚠️ Bu kullanıcı zaten bir şirkette.');
        setSendingEmail(false);
        return;
      }

      // Kod Üret ve Kaydet
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([{ code, organization_id: myOrg.id, email: inviteEmail }]);

      if (inviteError) throw inviteError;

      // Bildirim Gönder
      await supabase.from('notifications').insert([
        {
          user_id: targetUser.id,
          title: 'Şirket Daveti',
          message: `${myOrg.name} şirketi sizi ekibine katılmaya davet etti.`,
          type: 'invite',
          metadata: {
            org_id: myOrg.id,
            org_name: myOrg.name,
            invite_code: code,
          },
        },
      ]);

      alert(`✅ Davet Gönderildi!`);
      setInviteEmail('');
      fetchCompanyData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  // --- 2. MANUEL KOD ÜRETME ---
  const handleCreateCode = async () => {
    if (totalUsed >= maxLimit) return alert('Kapasite dolu!');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const { error } = await supabase
        .from('invitations')
        .insert([
          { code, organization_id: myOrg.id, email: null, is_used: false },
        ]);
      if (error) throw error;
      alert(`✅ Kod Oluşturuldu: ${code}`);
      fetchCompanyData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  // --- YARDIMCI FONKSİYONLAR ---
  const handleDeleteInvite = async (id: string) => {
    if (!window.confirm('İptal etmek istiyor musunuz?')) return;
    await supabase.from('invitations').delete().eq('id', id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Kopyalandı: ' + code);
  };

  const handleKick = async (id: string, role: string) => {
    if (role === 'premium_corporate') return alert('Yöneticiyi silemezsiniz.');
    if (window.confirm('Bu personeli şirketten çıkarmak istiyor musunuz?')) {
      await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'normal' })
        .eq('id', id);
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleToggleRole = async (member: any) => {
    if (!isCorporateAdmin) return;
    const confirmed = window.confirm(
      `"${member.full_name}" kullanıcısının rolünü değiştirmek istiyor musunuz?`
    );
    if (!confirmed) return;

    const newRole =
      member.role === 'corporate_staff' ? 'corporate_chief' : 'corporate_staff';
    const defaultPerms =
      newRole === 'corporate_chief'
        ? {
            can_invite: false,
            can_view_team_docs: false,
            can_edit_team_docs: false,
            can_delete_team_docs: false,
          }
        : {};

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, permissions: defaultPerms })
      .eq('id', member.id);
    if (error) return alert(error.message);

    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, role: newRole, permissions: defaultPerms }
          : m
      )
    );
  };

  const handleTogglePermission = async (member: any, permType: string) => {
    if (!isCorporateAdmin) return;
    const currentPerms = member.permissions || {};
    const newPerms = { ...currentPerms, [permType]: !currentPerms[permType] };
    await supabase
      .from('profiles')
      .update({ permissions: newPerms })
      .eq('id', member.id);
    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === member.id ? { ...m, permissions: newPerms } : m
      )
    );
  };

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (!myOrg)
    return (
      <div className="p-8 text-center text-gray-500">
        Herhangi bir şirkete bağlı değilsiniz.
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      {/* ÜST BİLGİ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building className="text-purple-600" /> {myOrg.name}
          </h1>
          <span className="text-sm text-gray-500">Yönetim Paneli</span>
        </div>
        <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-xl border">
          <div className="flex justify-between items-end mb-2">
            <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
              <PieChart size={14} /> Kota
            </div>
            <div className="text-xl font-black text-gray-800">
              {totalUsed}{' '}
              <span className="text-sm text-gray-400 font-medium">
                / {maxLimit}
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${
                isFull ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'team'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} /> Ekip Yönetimi
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'compliance'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield size={16} /> Mevzuatlarımız
        </button>
      </div>

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* SOL: EKİP LİSTESİ */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Users size={20} /> Ekip ve Bekleyen Kodlar
            </h3>

            <div className="space-y-4">
              {/* Mevcut Üyeler */}
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-lg border bg-white flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          member.role === 'corporate_chief'
                            ? 'bg-blue-600'
                            : 'bg-gray-400'
                        }`}
                      >
                        {member.full_name?.charAt(0) || <User size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          {member.full_name}
                          {/* Türkçe Rol Etiketi */}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                              member.role === 'corporate_chief'
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {roleLabels[member.role] || member.role}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {/* Yönetici Butonları */}
                    {isCorporateAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleRole(member)}
                          className="text-xs bg-gray-100 px-2 py-1 rounded border hover:bg-gray-200 flex items-center gap-1 transition"
                          title="Rol Değiştir"
                        >
                          <UserCog size={12} /> Rol
                        </button>
                        <button
                          onClick={() => handleKick(member.id, member.role)}
                          className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition"
                          title="Çıkar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Şef Yetkileri */}
                  {isCorporateAdmin && member.role === 'corporate_chief' && (
                    <div className="mt-2 pt-2 border-t ml-12">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">
                        ŞEF YETKİLERİ
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          'can_invite',
                          'can_view_team_docs',
                          'can_edit_team_docs',
                          'can_delete_team_docs',
                        ].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleTogglePermission(member, p)}
                            className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition ${
                              member.permissions?.[p]
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-55 text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            {member.permissions?.[p] ? (
                              <CheckSquare size={10} />
                            ) : (
                              <Square size={10} />
                            )}{' '}
                            {permLabels[p] || p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Bekleyen Davetler */}
              {invitations.map((i) => (
                <div
                  key={i.id}
                  className="p-4 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50 flex justify-between items-center opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                      {i.email ? <Mail size={20} /> : <Ticket size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-purple-900 text-sm">
                        {i.email ? i.email : 'Manuel Kod'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-700 font-mono tracking-wider">
                          {i.code}
                        </span>
                        <span className="text-[10px] text-purple-500">
                          {i.email ? '(E-posta Daveti)' : '(Manuel Kod)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCode(i.code)}
                      className="p-2 bg-white rounded border hover:bg-gray-50 text-gray-500"
                      title="Kopyala"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteInvite(i.id)}
                      className="p-2 bg-white rounded border hover:bg-red-50 text-red-500"
                      title="İptal Et"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {teamMembers.length === 0 && invitations.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  Henüz ekip üyesi yok.
                </div>
              )}
            </div>
          </div>

          {/* SAĞ: DAVET OLUŞTURMA */}
          <div className="space-y-6">
            {canInvite ? (
              <>
                {/* E-POSTA DAVET KARTI (Geri Geldi) */}
                <div className="bg-white p-6 rounded-xl border shadow-sm border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <Mail size={18} /> E-Posta ile Davet
                  </h3>
                  <form onSubmit={handleSendEmailInvite} className="space-y-2">
                    <input
                      type="email"
                      required
                      placeholder="personel@sirket.com"
                      className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button
                      disabled={isFull || sendingEmail}
                      className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {sendingEmail ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      {sendingEmail ? 'Gönderiliyor...' : 'Davet Gönder'}
                    </button>
                  </form>
                </div>

                {/* MANUEL KOD KARTI */}
                <div className="bg-white p-6 rounded-xl border shadow-sm border-purple-100">
                  <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                    <Ticket size={18} /> Manuel Kod Üret
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Bu kodu personele verin. Personel "Ayarlar" sayfasından bu
                    kodu girerek giriş talebi oluşturacak.
                  </p>
                  <button
                    onClick={handleCreateCode}
                    disabled={isFull}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {isFull ? 'Kota Dolu' : 'Kod Oluştur'}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 p-6 rounded-xl border text-center text-gray-500 text-sm">
                <Shield size={32} className="mx-auto mb-2 opacity-30" />
                Personel davet etme yetkiniz bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
          <div className="border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Shield className="text-purple-600" /> Şirket Mevzuat ve Uyum Listesi
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {!isConsultant 
                  ? 'Danışmanlık firması tarafından şirketinize tanımlanan yasal mevzuatları ve yükümlülükleri takip edin.' 
                  : 'Sorumlusu olduğunuz firmalara atanan yasal mevzuatları ve yükümlülükleri takip edin.'}
              </p>
            </div>
            
            </div>

          {regsError && (
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-150 text-red-700 dark:text-red-400 text-xs">
              ⚠️ <b>Mevzuatlar yüklenirken hata oluştu:</b> {regsError}
              <br className="mt-1" />
              Lütfen veritabanı RLS (Row Level Security) politikalarını güncellediğinizden ve SQL kodlarını Supabase SQL Editöründe çalıştırdığınızdan emin olun.
            </div>
          )}

          <div className="space-y-6">
            {/* Üst Kısım: İşletmeler ve Yönetmelikler (Yan Yana) */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* 1. İşletmeler Listesi (Sadece Danışmanlar için) */}
              {isConsultant && (
                <div className="w-full md:w-80 shrink-0 md:border-r md:pr-6 space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">İşletmeler</span>
                  {assignedClients.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl bg-slate-50/50 text-xs px-2">
                      {myProfile?.role === 'premium_corporate' 
                        ? 'Sisteme kayıtlı firma bulunmuyor.' 
                        : 'Üstünüze atanan firma bulunmuyor.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {assignedClients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedClientId(c.id);
                            fetchRegulationsForClient(c.id);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition flex items-center gap-2.5 ${
                            selectedClientId === c.id
                              ? 'border-purple-500 bg-purple-50/40 text-purple-700 font-bold'
                              : 'border-slate-150 hover:bg-slate-50 bg-white text-slate-700'
                          }`}
                        >
                          <Building size={16} className={selectedClientId === c.id ? 'text-purple-600' : 'text-gray-400'} />
                          <span className="text-xs truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Mevzuat Talep Et Butonu */}
                  <button
                    onClick={() => {
                      setRequestClientId(clientRecId || '');
                      setShowRequestModal(true);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <PlusCircle size={14} /> Mevzuat Talep Et
                  </button>
                </div>
              )}

              {/* 2. Yönetmelikler Listesi */}
              <div className="flex-1 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">Yönetmelikler</span>
                
                {!clientRecId ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl bg-slate-50/50 text-xs">
                    Lütfen önce bir firma seçin.
                  </div>
                ) : loadingRegs ? (
                  <div className="flex justify-center items-center py-12 text-xs text-gray-500 gap-2">
                    <Loader className="animate-spin" size={14} /> Yükleniyor...
                  </div>
                ) : myRegulations.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl bg-slate-50/50 text-xs space-y-2">
                    <p>Bu firmaya tanımlı mevzuat bulunmuyor.</p>
                    {!isConsultant && (
                      <button
                        onClick={() => setShowRequestModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <PlusCircle size={10} /> Talep Et
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-1">
                    {myRegulations.map((reg) => (
                      <button
                        key={reg.id}
                        onClick={() => {
                          setSelectedReg(reg);
                          fetchRegulationArticles(reg);
                        }}
                        className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                          selectedReg?.id === reg.id
                            ? 'border-purple-500 bg-purple-50/30'
                            : 'border-slate-150 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-purple-50 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-purple-100 uppercase">
                            {reg.parent?.category || 'Yönetmelik'}
                          </span>
                          <span className="font-bold text-xs text-slate-800 line-clamp-2">{reg.title}</span>
                        </div>
                        {reg.parent?.rg_no && (
                          <span className="text-[10px] text-gray-400 block mt-1">RG No: {reg.parent.rg_no}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Maddeler Detay Görünümü (Alt Kısım - Tam Genişlik) */}
            <div className="border-t pt-6 space-y-4">
              <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">Maddeler</span>
              
              {!selectedReg ? (
                <div className="text-center py-20 text-gray-400 border border-dashed rounded-xl bg-slate-50/30 text-xs">
                  <Shield size={32} className="mx-auto mb-2 opacity-30 text-purple-650" />
                  Maddelerini incelemek için yukarıdaki listeden bir mevzuat seçin.
                </div>
              ) : loadingArticles ? (
                <div className="flex justify-center items-center py-20 text-xs text-gray-500 gap-2">
                  <Loader className="animate-spin" size={16} /> Maddeler Yükleniyor...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-b pb-2 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{selectedReg.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Uygulanacak maddeleri ve uyum durumlarını yönetin.</p>
                    </div>
                    {selectedReg.parent?.rg_no && (
                      <span className="text-[10px] text-gray-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        RG No: {selectedReg.parent.rg_no}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
                    {selectedRegArticles.length === 0 ? (
                      <p className="text-center py-6 text-xs text-gray-400 italic">Mevzuata ait madde bulunamadı.</p>
                    ) : (
                       selectedRegArticles.map((art) => (
                        <div
                          key={art.id}
                          className={`p-4 rounded-xl border transition shadow-sm bg-white ${
                            art.is_mandatory ? 'border-purple-100' : 'border-slate-200 opacity-60 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                                  art.is_mandatory ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}>
                                  {art.is_mandatory ? 'Aktif' : 'Hariç Tutuldu'}
                                </span>
                                {art.is_mandatory && (
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                                    art.compliance_status === 'non_compliant'
                                      ? 'bg-red-50 text-red-700 border-red-100'
                                      : 'bg-green-50 text-green-700 border-green-100'
                                  }`}>
                                    {art.compliance_status === 'non_compliant' ? 'Uygun Değil' : 'Uygun'}
                                  </span>
                                )}
                                <span className="font-bold text-xs text-slate-800">{art.article_no} - {art.title}</span>
                              </div>
                              <p className="text-xs text-slate-650 mt-2 whitespace-pre-wrap leading-relaxed">{art.content}</p>
                              
                              {/* Last Updated By Info */}
                              {art.updater?.full_name && (
                                <div className="text-[10px] text-gray-400 mt-2 font-semibold">
                                  Son Güncelleyen: <b>{art.updater.full_name}</b>
                                </div>
                              )}

                              {/* Requested Status Badge */}
                              {art.current_status_requested && (
                                <div className="mt-2 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                  ⚠️ Mevcut Durum Notu Girişi Talep Edildi
                                </div>
                              )}
                            </div>

                            <div className="flex flex-row sm:flex-col gap-2 shrink-0 items-center sm:items-end w-full sm:w-auto justify-end">
                              {art.is_mandatory && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleUpdateArticleCompliance(art.id, 'compliant')}
                                    className={`text-[9px] font-bold px-2 py-1 rounded border transition ${
                                      art.compliance_status !== 'non_compliant'
                                        ? 'bg-green-600 border-transparent text-white shadow-sm'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-green-650'
                                    }`}
                                  >
                                    Uygun
                                  </button>
                                  <button
                                    onClick={() => handleUpdateArticleCompliance(art.id, 'non_compliant')}
                                    className={`text-[9px] font-bold px-2 py-1 rounded border transition ${
                                      art.compliance_status === 'non_compliant'
                                        ? 'bg-red-650 border-transparent text-white shadow-sm'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-red-600'
                                    }`}
                                  >
                                    Uygun Değil
                                  </button>
                                </div>
                              )}
                              <button
                                onClick={() => handleToggleArticleMandatory(art.id, art.is_mandatory)}
                                className={`text-[9px] font-bold px-2.5 py-1.5 rounded-lg border transition ${
                                  art.is_mandatory
                                    ? 'bg-white hover:bg-slate-50 border-slate-200 text-red-650'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white border-transparent'
                                }`}
                              >
                                {art.is_mandatory ? 'Hariç Tut' : 'Aktif Yap'}
                              </button>
                            </div>
                          </div>

                          {/* Mevcut Durum Notu (Current Status Note) Section */}
                          {art.is_mandatory && (
                            <div className="pt-3 mt-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
                              {editingNotesArtId === art.id ? (
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Mevcut Durum Girişi</label>
                                  <textarea
                                    rows={2}
                                    value={tempNotesVal}
                                    onChange={(e) => setTempNotesVal(e.target.value)}
                                    placeholder="Bu madde için mevcut durumu/açıklamayı yazın..."
                                    className="w-full p-2.5 border rounded-lg text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-purple-500"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => handleSaveArticleNotes(art.id)}
                                      className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                                    >
                                      Kaydet
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingNotesArtId(null);
                                        setTempNotesVal('');
                                      }}
                                      className="border hover:bg-gray-50 dark:hover:bg-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition text-gray-700 dark:text-gray-300"
                                    >
                                      İptal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
                                  <div className="flex-1 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                    <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Mevcut Durum</div>
                                    <p className="text-slate-700 dark:text-slate-350 mt-0.5 whitespace-pre-wrap leading-relaxed">
                                      {art.current_status_notes || <span className="italic text-gray-400">Durum girilmemiş</span>}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingNotesArtId(art.id);
                                        setTempNotesVal(art.current_status_notes || '');
                                      }}
                                      className="text-[10px] font-bold text-purple-650 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-purple-200 px-2.5 py-1 rounded transition"
                                    >
                                      Düzenle
                                    </button>
                                    {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief') && !art.current_status_requested && (
                                      <button
                                        onClick={() => handleRequestArticleNotes(art.id)}
                                        className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-amber-250 px-2.5 py-1 rounded transition"
                                      >
                                        Mevcut Durum Talep Et
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mevzuat Talepleri Listesi */}
          {myRequests.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="text-purple-600" size={16} /> Gönderilen Mevzuat Talepleri
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl border bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-slate-800">{req.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : req.status === 'approved'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                      </span>
                    </div>
                    {req.description && (
                      <p className="text-gray-500 whitespace-pre-wrap">{req.description}</p>
                    )}
                    <div className="text-[10px] text-gray-400 flex justify-between items-center pt-1 border-t">
                      <span>Talep Eden: {req.requested_by_profile?.full_name || 'Bilinmiyor'}</span>
                      <span>{new Date(req.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    {req.admin_notes && (
                      <div className="mt-2 p-2 bg-white rounded border text-gray-600 text-[10px]">
                        <b>Not:</b> {req.admin_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MEVZUAT TALEP ETME MODALİ */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <PlusCircle className="text-purple-600" /> Mevzuat Talep Et
              </h3>
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestTitle('');
                  setRequestDescription('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              {isConsultant && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 block">Talep Yapılacak Firma</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2.5 text-sm bg-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    value={requestClientId}
                    onChange={(e) => setRequestClientId(e.target.value)}
                  >
                    <option value="" disabled>-- Firma Seçin --</option>
                    {assignedClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">Mevzuat Adı / Konusu</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Endüstriyel Hava Kirliliği Kontrolü Yönetmeliği"
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">Talep Açıklaması / Notlar</label>
                <textarea
                  required
                  placeholder="Bu mevzuatın firmamız için neden tanımlanmasını istediğinize dair detay yazabilirsiniz."
                  rows={4}
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none"
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submittingRequest}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingRequest ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  'Talebi İlet'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
