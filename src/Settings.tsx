import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  User,
  Building,
  Shield,
  CreditCard,
  LogOut,
  Crown,
  Briefcase,
  Camera,
  Lock,
  Save,
  Loader,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Ticket,
  Send
} from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Profil Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Şirket Katılım
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Şifre
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('id', session.user.id)
        .single();

      setProfile(data);
      setFullName(data.full_name || '');
      setEmail(data.email || session.user.email);
      setPhone(data.phone || '');
      setAvatarUrl(data.avatar_url || null);
    }
    setLoading(false);
  };

  // --- İŞLEM FONKSİYONLARI ---

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: phone }).eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, full_name: fullName, phone: phone });
      alert('Profil güncellendi!');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert('Şifre en az 6 karakter olmalı.');
    if (newPassword !== confirmPassword) return alert('Şifreler uyuşmuyor.');
    
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Şifre başarıyla güncellendi!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
    
    setUploadingAvatar(true);
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      alert('Profil fotoğrafı güncellendi!');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode) return alert('Lütfen kod girin.');
    if (profile.organization_id) return alert('Zaten bir şirkettesiniz.');

    setJoining(true);
    try {
      // 1. Kod Kontrolü
      const { data: invite, error: inviteError } = await supabase
        .from('invitations')
        .select('*, organization:organizations(name, id)')
        .eq('code', inviteCode.trim().toUpperCase())
        .eq('is_used', false)
        .single();

      if (inviteError || !invite) throw new Error('Geçersiz veya kullanılmış kod.');

      // 2. Yöneticiyi Bul
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', invite.organization_id)
        .eq('role', 'premium_corporate')
        .single();

      if (!adminProfile) throw new Error('Şirket yöneticisi bulunamadı.');

      // 3. Bildirim Gönder
      await supabase.from('notifications').insert([{
        user_id: adminProfile.id,
        title: 'Yeni Personel Talebi',
        message: `${fullName} (${email}) şirketinize katılmak için kod kullandı. Onaylıyor musunuz?`,
        type: 'join_request',
        metadata: {
          requester_id: profile.id,
          requester_name: fullName,
          invitation_id: invite.id,
          invite_code: invite.code
        }
      }]);

      alert(`✅ Talep Gönderildi! "${invite.organization.name}" yöneticisi onayladığında giriş yapabileceksiniz.`);
      setInviteCode('');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveCompany = async () => {
    if (!profile?.organization_id) return;
    const isOwner = profile.role === 'premium_corporate';
    if (isOwner) return alert('Şirket sahibi ayrılamaz.');
    
    if (window.confirm(`"${profile.organization?.name}" şirketinden ayrılmak istediğinize emin misiniz?`)) {
      setLoading(true);
      try {
        await supabase.from('profiles').update({ organization_id: null, role: 'normal' }).eq('id', profile.id);
        alert('Ayrıldınız.');
        window.location.reload();
      } catch (err: any) {
        alert(err.message);
        setLoading(false);
      }
    }
  };

  // --- YARDIMCI FONKSİYONLAR ---
  const getRoleDisplay = () => {
    if (!profile) return { label: 'Yükleniyor...', color: 'text-gray-500', bg: 'bg-gray-100' };
    if (profile.role === 'admin') return { label: 'ADMIN', color: 'text-red-700', bg: 'bg-red-100' };
    if (profile.role === 'premium_individual') return { label: 'Bireysel Premium', color: 'text-blue-700', bg: 'bg-blue-100' };
    
    if (profile.organization_id) {
      if (profile.role === 'premium_corporate') return { label: 'Şirket Yöneticisi', color: 'text-purple-700', bg: 'bg-purple-100' };
      if (profile.role === 'corporate_chief') return { label: 'Departman Şefi', color: 'text-green-700', bg: 'bg-green-100' };
      if (profile.role === 'corporate_staff') return { label: 'Kurumsal Personel', color: 'text-green-700', bg: 'bg-green-100' };
      if (profile.role === 'normal') return { label: 'Kurumsal (Süresi Doldu)', color: 'text-red-700', bg: 'bg-red-100' };
    }
    return { label: 'Normal Üye', color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const getSubscriptionDetails = () => {
    if (!profile) return null;
    
    // Şirket
    if (profile.organization) {
      const orgName = profile.organization.name;
      const endDate = new Date(profile.organization.subscription_end_date);
      const isActive = endDate > new Date();
      return {
        type: isActive ? 'corporate' : 'corporate_expired',
        title: isActive ? 'Kurumsal Premium Hesap' : 'Süresi Dolmuş Üyelik',
        subtitle: `${orgName} Şirketine Bağlı`,
        endDate: endDate.toLocaleDateString('tr-TR'),
        status: isActive ? 'active' : 'expired',
        color: isActive ? 'from-purple-600 to-indigo-600' : 'from-gray-500 to-gray-700'
      };
    }
    // Bireysel
    if (profile.role === 'premium_individual') {
      const endDate = new Date(profile.subscription_end_date);
      const isActive = endDate > new Date();
      return {
        type: 'individual',
        title: 'Bireysel Premium',
        subtitle: 'Tüm özellikler aktif',
        endDate: endDate.toLocaleDateString('tr-TR'),
        status: isActive ? 'active' : 'inactive',
        color: isActive ? 'from-blue-600 to-cyan-600' : 'from-gray-500 to-gray-600'
      };
    }
    // Admin
    if (profile.role === 'admin') {
      return { type: 'admin', title: 'Sistem Yöneticisi', subtitle: 'Sınırsız Erişim', endDate: 'Süresiz', status: 'active', color: 'from-red-600 to-orange-600' };
    }
    // Normal
    return { type: 'normal', title: 'Standart Üyelik', subtitle: 'Abonelik Yok', endDate: '-', status: 'inactive', color: 'from-gray-400 to-gray-500' };
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  const roleInfo = getRoleDisplay();
  const subDetails = getSubscriptionDetails();
  const showLeaveButton = profile?.organization_id && profile?.role !== 'premium_corporate' && profile?.role !== 'admin';

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-2">
        <User className="text-blue-600" /> Profil Ayarları
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- SOL: PROFİL KARTI --- */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
            <div className="relative w-28 h-28 mx-auto mb-4 group">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? <Loader className="animate-spin text-white" /> : <Camera className="text-white" size={24} />}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>
            
            <h2 className="text-xl font-bold text-gray-800">{profile?.full_name}</h2>
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <p className="flex items-center justify-center gap-1"><Mail size={12} /> {profile?.email}</p>
              {profile?.phone && <p className="flex items-center justify-center gap-1"><Phone size={12} /> {profile?.phone}</p>}
            </div>

            <div className={`mt-4 py-2 px-4 rounded-lg font-bold text-sm ${roleInfo.bg} ${roleInfo.color} flex items-center justify-center gap-2`}>
              {roleInfo.label.includes('Yönetici') || roleInfo.label.includes('Premium') ? <Crown size={14} /> : <Briefcase size={14} />}
              {roleInfo.label}
            </div>
          </div>

          {/* ŞİRKET BİLGİSİ (GERİ GELDİ) */}
          {profile?.organization && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Building size={18} /> Şirket Bilgileri
              </h3>
              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">Adı:</span>
                  <span className="font-bold">{profile.organization.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Kapasite:</span>
                  <span className="font-bold">{profile.organization.member_limit || 'Sınırsız'} Kişi</span>
                </div>
              </div>
              
              {showLeaveButton && (
                <button
                  onClick={handleLeaveCompany}
                  className="w-full text-xs bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition"
                >
                  <LogOut size={14} /> Şirketten Ayrıl
                </button>
              )}
            </div>
          )}

          {/* ŞİRKETE KATILMA (GERİ GELDİ) */}
          {!profile?.organization_id && (
             <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 shadow-sm">
                <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                    <Ticket size={18} /> Şirkete Katıl
                </h3>
                <p className="text-xs text-purple-600 mb-4">
                    Yöneticinizden aldığınız 6 haneli davet kodunu girerek giriş talebi oluşturun.
                </p>
                <form onSubmit={handleJoinCompany} className="space-y-2">
                    <input 
                        type="text" 
                        placeholder="KOD GİRİN (Örn: X9Y2Z1)"
                        className="w-full p-2 border border-purple-200 rounded text-center font-mono uppercase tracking-widest outline-none focus:border-purple-500"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        maxLength={6}
                    />
                    <button 
                        disabled={joining}
                        className="w-full bg-purple-600 text-white py-2 rounded font-bold text-sm hover:bg-purple-700 flex items-center justify-center gap-2"
                    >
                        {joining ? <Loader size={14} className="animate-spin"/> : <Send size={14}/>}
                        Talep Gönder
                    </button>
                </form>
             </div>
           )}
        </div>

        {/* --- SAĞ: ABONELİK VE FORMLAR --- */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ABONELİK KARTI (GERİ GELDİ) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-500" /> Abonelik Durumu
              </h3>
            </div>
            <div className="p-6">
              <div className={`relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-r ${subDetails?.color} shadow-lg`}>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {subDetails?.status === 'active' ? <CheckCircle2 className="text-white/90" size={20} /> : <AlertCircle className="text-white/90" size={20} />}
                      <h4 className="font-bold text-lg md:text-xl">{subDetails?.title}</h4>
                    </div>
                    <p className="text-white/80 text-sm font-medium">{subDetails?.subtitle}</p>
                    {subDetails?.status === 'active' && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold">
                        <Calendar size={14} /> Bitiş Tarihi: {subDetails?.endDate}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {(profile?.role === 'premium_individual' || profile?.org_role === 'owner') && (
                      <button onClick={() => (window.location.href = '/pricing')} className="bg-white text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition shadow-sm">
                        Planı Yönet
                      </button>
                    )}
                    {subDetails?.status === 'inactive' && profile?.role !== 'admin' && (
                      <button onClick={() => (window.location.href = '/pricing')} className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition shadow-sm animate-pulse">
                        Premium'a Geç
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KİŞİSEL BİLGİLER FORMU */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Shield size={20} className="text-gray-400" /> Kişisel Bilgiler
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Ad Soyad</label>
                  <input type="text" className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Telefon</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" />
                    <input type="tel" className="w-full border p-3 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button disabled={saving} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2">
                  {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} Kaydet
                </button>
              </div>
            </form>
          </div>

          {/* ŞİFRE GÜNCELLEME */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Lock size={20} className="text-orange-500" /> Şifre Güncelle
            </h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="password" placeholder="Yeni Şifre" className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <input type="password" placeholder="Tekrar" className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end">
                <button disabled={passwordSaving} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition flex items-center gap-2">
                  {passwordSaving ? 'Güncelleniyor...' : <><Save size={18} /> Şifreyi Güncelle</>}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
