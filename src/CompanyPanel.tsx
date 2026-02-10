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
} from 'lucide-react';

export default function CompanyPanel() {
  const [loading, setLoading] = useState(true);
  const [myOrg, setMyOrg] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Yetki İsimleri
  const permLabels: any = {
    can_invite: 'Davet Yetkisi',
    can_view_team_docs: 'Ekip Dosyalarını Gör',
    can_edit_team_docs: 'Dosya Düzenle',
    can_delete_team_docs: 'Dosya Sil',
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
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, organization:organizations(*)')
          .eq('id', session.user.id)
          .single();
        setMyProfile(profile);

        if (profile?.organization_id) {
          setMyOrg(profile.organization);

          // 1. MEVCUT ÜYELERİ ÇEK
          let query = supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id);

          // Yöneticiyi listede gösterme (Kota hesabı ve görünüm için)
          if (profile.role === 'premium_corporate')
            query = query.neq('id', session.user.id);

          const { data: members } = await query.order('role', {
            ascending: true,
          });
          setTeamMembers(members || []);

          // 2. BEKLEYEN DAVETLERİ ÇEK
          const { data: invites } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('is_used', false)
            .order('created_at', { ascending: false });
          setInvitations(invites || []);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isCorporateAdmin = myProfile?.role === 'premium_corporate';
  const canInvite =
    isCorporateAdmin ||
    (myProfile?.role === 'corporate_chief' &&
      myProfile?.permissions?.can_invite);
  const isExpired = myProfile?.role === 'normal' && myProfile?.organization_id;

  // --- KOTA HESABI ---
  // Yönetici listede yok, sadece personel + davetler
  const billableMembersCount = teamMembers.filter(
    (m) => m.role !== 'premium_corporate'
  ).length;
  const totalUsed = billableMembersCount + invitations.length;
  const maxLimit = myOrg?.member_limit || 5;
  const usagePercent = Math.min(100, (totalUsed / maxLimit) * 100);
  const isFull = totalUsed >= maxLimit;

  // --- FONKSİYONLAR ---

  const handleCreateCode = async () => {
    if (totalUsed >= maxLimit)
      return alert('Kapasite dolu! Personel sınırına ulaştınız.');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase
      .from('invitations')
      .insert([{ code, organization_id: myOrg.id, email: null }]);
    if (error) alert('Hata: ' + error.message);
    else fetchCompanyData();
  };

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalUsed >= maxLimit)
      return alert('Kapasite dolu! Paket yükseltmeniz gerekiyor.');
    if (!inviteEmail.includes('@')) return alert('Geçerli bir email giriniz.');

    setSendingEmail(true);

    try {
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

      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, organization_id')
        .eq('email', inviteEmail)
        .single();
      if (userError || !targetUser) {
        alert('❌ Kullanıcı Bulunamadı!');
        setSendingEmail(false);
        return;
      }
      if (targetUser.organization_id) {
        alert('⚠️ Bu kullanıcı zaten bir şirkette.');
        setSendingEmail(false);
        return;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([{ code, organization_id: myOrg.id, email: inviteEmail }]);
      if (inviteError) throw inviteError;

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

  // --- DÜZELTİLEN FONKSİYON: TEK SEFERDE ROL DEĞİŞTİRME ---
  const handleToggleRole = async (member: any) => {
    if (!isCorporateAdmin) return;

    // Onay Penceresi
    const confirmed = window.confirm(
      `"${member.full_name}" kullanıcısının rolünü değiştirmek istediğinize emin misiniz?`
    );
    if (!confirmed) return;

    // Yeni Rol Belirleme
    const newRole =
      member.role === 'corporate_staff' ? 'corporate_chief' : 'corporate_staff';

    // Şef ise varsayılan yetkileri kapalı gelir
    const defaultPerms =
      newRole === 'corporate_chief'
        ? {
            can_invite: false,
            can_view_team_docs: false,
            can_edit_team_docs: false,
            can_delete_team_docs: false,
          }
        : {};

    // 1. Veritabanını Güncelle
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, permissions: defaultPerms })
      .eq('id', member.id);

    if (error) {
      alert('Hata oluştu: ' + error.message);
      return;
    }

    // 2. ARAYÜZÜ ANINDA GÜNCELLE (Manuel State Update)
    // Sayfayı yenilemeden direkt listeyi güncelliyoruz, böylece "ikinci tıklama" gerekmiyor.
    setTeamMembers((prevMembers) =>
      prevMembers.map((m) =>
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

    // DB Update
    await supabase
      .from('profiles')
      .update({ permissions: newPerms })
      .eq('id', member.id);

    // UI Update (Anında Yansıma)
    setTeamMembers((prevMembers) =>
      prevMembers.map((m) =>
        m.id === member.id ? { ...m, permissions: newPerms } : m
      )
    );
  };

  const handleKick = async (id: string, role: string) => {
    if (role === 'premium_corporate') return alert('Yöneticiyi silemezsiniz.');
    if (
      window.confirm(
        'Bu personeli şirketten çıkarmak istediğinize emin misiniz?'
      )
    ) {
      await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'normal' })
        .eq('id', id);
      // Listeden çıkar
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
      // fetchCompanyData(); // Gerekirse
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!window.confirm('Davetiyeyi iptal etmek istiyor musunuz?')) return;
    await supabase.from('invitations').delete().eq('id', id);
    // Listeden çıkar
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  // --- ROL ETİKETLERİ ---
  const getHeaderBadge = () => {
    const role = myProfile?.role;
    if (role === 'premium_corporate')
      return { text: 'Şirket Sahibi', style: 'bg-purple-100 text-purple-700' };
    if (role === 'corporate_chief')
      return { text: 'Departman Şefi', style: 'bg-blue-50 text-blue-700' };
    // Varsayılan
    return { text: 'Kurumsal Personel', style: 'bg-green-50 text-green-700' };
  };

  const getListBadge = (role: string) => {
    if (role === 'premium_corporate')
      return {
        label: 'ŞİRKET SAHİBİ',
        style: 'text-purple-700 bg-purple-100 border-purple-200',
      };
    if (role === 'corporate_chief')
      return {
        label: 'DEPARTMAN ŞEFİ',
        style: 'text-blue-600 bg-blue-50 border-blue-200',
      };
    return {
      label: 'PERSONEL',
      style: 'text-gray-600 bg-gray-100 border-gray-200',
    };
  };

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (!myOrg)
    return (
      <div className="p-8 text-center text-gray-500">
        Herhangi bir şirkete bağlı değilsiniz.
      </div>
    );

  const headerBadge = getHeaderBadge();

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      {/* SÜRE DOLDU UYARISI */}
      {isExpired && (
        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center rounded-xl text-center p-6 border-2 border-red-100 h-full">
          <div className="bg-red-100 p-6 rounded-full mb-4 shadow-xl animate-pulse">
            <Lock size={64} className="text-red-500" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-800 mb-2">
            Premium Süreniz Doldu!
          </h2>
          <p className="text-gray-600 max-w-md mb-8 text-lg font-medium">
            Ekip yönetimi kısıtlandı. Yeniden aktif etmek için paketinizi
            yenileyin.
          </p>
        </div>
      )}

      <div
        className={
          isExpired
            ? 'filter blur-sm pointer-events-none select-none opacity-50'
            : ''
        }
      >
        {/* ÜST BİLGİ */}
        <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building className="text-purple-600" /> {myOrg.name}
            </h1>

            {/* BAŞLIKTAKİ ROL (Personel için 'Kurumsal Personel' yazar) */}
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${headerBadge.style}`}
              >
                {headerBadge.text}
              </span>
            </div>
          </div>

          <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-xl border">
            <div className="flex justify-between items-end mb-2">
              <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <PieChart size={14} /> Personel Kotası (Yönetici Hariç)
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
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  isFull ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              ></div>
            </div>
            {isFull && (
              <div className="text-[10px] text-red-500 mt-2 font-bold flex items-center gap-1">
                <AlertCircle size={10} /> Kota Dolu!
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* EKİP LİSTESİ */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Users size={20} /> Ekip Listesi
            </h3>
            <div className="space-y-4">
              {/* PERSONEL LİSTESİ */}
              {teamMembers.map((member) => {
                const badge = getListBadge(member.role);
                const isOwner = member.role === 'premium_corporate';

                return (
                  <div
                    key={member.id}
                    className={`p-4 rounded-lg border flex flex-col gap-2 ${
                      isOwner
                        ? 'bg-purple-50 border-purple-100'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                            isOwner
                              ? 'bg-purple-600'
                              : member.role === 'corporate_chief'
                              ? 'bg-blue-600'
                              : 'bg-gray-400'
                          }`}
                        >
                          {isOwner ? (
                            <Crown size={18} />
                          ) : (
                            member.full_name?.charAt(0) || <User size={20} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 flex items-center gap-2">
                            {member.full_name}
                            {isOwner && (
                              <Crown size={12} className="text-purple-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {member.email}
                          </div>

                          {/* LİSTEDEKİ ROL ETİKETİ */}
                          <div
                            className={`text-[10px] font-bold mt-1 uppercase w-fit px-2 py-0.5 rounded border ${badge.style}`}
                          >
                            {badge.label}
                          </div>
                        </div>
                      </div>

                      {/* Yönetici İşlemleri */}
                      {isCorporateAdmin && !isOwner && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleRole(member)}
                            className="text-xs bg-gray-100 px-2 py-1 rounded border hover:bg-gray-200 flex items-center gap-1 transition"
                          >
                            <UserCog size={12} /> Rol
                          </button>
                          <button
                            onClick={() => handleKick(member.id, member.role)}
                            className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition"
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
                                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
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
                );
              })}

              {/* BEKLEYEN DAVETLER */}
              {invitations.map((i) => (
                <div
                  key={i.id}
                  className="p-4 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col gap-2 opacity-80"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                        <Clock size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-600 text-sm">
                          {i.email ? i.email : 'İsimsiz Davet'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            DAVET GÖNDERİLDİ
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Kod: {i.code}
                          </span>
                        </div>
                      </div>
                    </div>
                    {canInvite && (
                      <button
                        onClick={() => handleDeleteInvite(i.id)}
                        className="text-xs bg-white text-red-500 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50 transition flex items-center gap-1"
                      >
                        <Trash2 size={12} /> İptal Et
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {teamMembers.length === 0 && invitations.length === 0 && (
                <div className="text-center text-gray-400 py-8 border-2 border-dashed rounded-lg">
                  Henüz ekip üyesi yok.
                </div>
              )}
            </div>
          </div>

          {/* SAĞ: DAVET OLUŞTURMA */}
          <div className="space-y-6">
            {canInvite ? (
              <>
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
                      )}{' '}
                      {sendingEmail ? 'Gönderiliyor...' : 'Davet Gönder'}
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-xl border shadow-sm border-purple-100">
                  <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                    <Ticket size={18} /> Manuel Kod Oluştur
                  </h3>
                  <button
                    onClick={handleCreateCode}
                    disabled={isFull}
                    className="w-full bg-purple-600 text-white py-2 rounded font-bold text-sm hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isFull ? 'Kota Dolu' : 'Kod Üret'}
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
      </div>
    </div>
  );
}
