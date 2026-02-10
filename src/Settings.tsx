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
} from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Şifre Değiştirme State'leri
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, full_name: fullName, phone: phone });
      alert('Profil bilgileri başarıyla güncellendi!');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6)
      return alert('Şifre en az 6 karakter olmalıdır.');
    if (newPassword !== confirmPassword) return alert('Şifreler uyuşmuyor!');

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      alert('Şifreniz başarıyla güncellendi!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploadingAvatar(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
      alert('Profil resmi güncellendi!');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLeaveCompany = async () => {
    if (!profile?.organization_id) return;
    const isOwner =
      profile.role === 'premium_corporate' || profile.org_role === 'owner';
    if (isOwner) return alert('Şirket sahibi olarak şirketten ayrılamazsınız.');
    const companyName = profile.organization?.name || 'Şirket';
    if (
      !window.confirm(`"${companyName}" şirketinden ayrılmak istiyor musunuz?`)
    )
      return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          organization_id: null,
          role: 'normal',
          org_role: 'staff',
          permissions: {},
        })
        .eq('id', profile.id);
      if (error) throw error;
      alert('Şirketten başarıyla ayrıldınız.');
      window.location.reload();
    } catch (error: any) {
      alert('Hata: ' + error.message);
      setLoading(false);
    }
  };

  const getRoleDisplay = () => {
    if (!profile)
      return {
        label: 'Yükleniyor...',
        color: 'text-gray-500',
        bg: 'bg-gray-100',
      };

    if (profile.role === 'admin') {
      return { label: 'ADMIN', color: 'text-red-700', bg: 'bg-red-100' };
    }

    if (profile.role === 'premium_individual') {
      return {
        label: 'Bireysel Premium',
        color: 'text-blue-700',
        bg: 'bg-blue-100',
      };
    }

    if (profile.organization_id) {
      const effectiveRole = profile.org_role || profile.role;

      if (effectiveRole === 'owner' || profile.role === 'premium_corporate') {
        return {
          label: 'Şirket Yöneticisi',
          color: 'text-purple-700',
          bg: 'bg-purple-100',
        };
      } else if (
        effectiveRole === 'chief' ||
        profile.role === 'corporate_chief'
      ) {
        return {
          label: 'Departman Şefi',
          color: 'text-green-700',
          bg: 'bg-green-100',
        };
      } else if (
        effectiveRole === 'staff' ||
        profile.role === 'corporate_staff'
      ) {
        return {
          label: 'Kurumsal Personel',
          color: 'text-green-700',
          bg: 'bg-green-100',
        };
      }
      if (profile.role === 'normal') {
        return {
          label: 'Kurumsal (Süresi Doldu)',
          color: 'text-red-700',
          bg: 'bg-red-100',
        };
      }
    }

    return { label: 'Normal Üye', color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  const roleInfo = getRoleDisplay();
  const hasCompany = !!profile?.organization_id;
  const isOwner =
    profile?.role === 'premium_corporate' || profile?.org_role === 'owner';
  const showLeaveButton = hasCompany && !isOwner && profile?.role !== 'admin';

  // --- ABONELİK BİLGİLERİNİ HESAPLA ---
  const getSubscriptionDetails = () => {
    if (!profile) return null;

    // 1. Şirket Hesabı Kontrolü
    if (profile.organization_id && profile.organization) {
      const orgName = profile.organization.name;
      const endDate = new Date(profile.organization.subscription_end_date);
      const isActive = endDate > new Date();

      if (isActive) {
        return {
          type: 'corporate',
          title: 'Kurumsal Premium Hesap',
          subtitle: `${orgName} Şirketine Bağlı`,
          endDate: endDate.toLocaleDateString('tr-TR'),
          status: 'active',
          color: 'from-purple-600 to-indigo-600',
        };
      } else {
        return {
          type: 'corporate_expired',
          title: 'Şirket Üyeliği (Süresi Dolmuş)',
          subtitle: `${orgName} - Yenileme Gerekli`,
          endDate: endDate.toLocaleDateString('tr-TR'),
          status: 'expired',
          color: 'from-gray-500 to-gray-700',
        };
      }
    }

    // 2. Bireysel Premium Kontrolü
    if (profile.role === 'premium_individual') {
      const endDate = new Date(profile.subscription_end_date);
      const isActive = endDate > new Date();

      if (isActive) {
        return {
          type: 'individual',
          title: 'Bireysel Premium Üyelik',
          subtitle: 'Tüm özellikler aktif',
          endDate: endDate.toLocaleDateString('tr-TR'),
          status: 'active',
          color: 'from-blue-600 to-cyan-600',
        };
      }
    }

    // 3. Admin Kontrolü
    if (profile.role === 'admin') {
      return {
        type: 'admin',
        title: 'Sistem Yöneticisi',
        subtitle: 'Sınırsız Erişim',
        endDate: 'Süresiz',
        status: 'active',
        color: 'from-red-600 to-orange-600',
      };
    }

    // 4. Normal Üyelik
    return {
      type: 'normal',
      title: 'Standart Üyelik',
      subtitle: 'Abonelik Yok',
      endDate: '-',
      status: 'inactive',
      color: 'from-gray-400 to-gray-500',
    };
  };

  const subDetails = getSubscriptionDetails();

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-2">
        <User className="text-blue-600" /> Profil Ayarları
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SOL: Profil Kartı */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
            <div className="relative w-28 h-28 mx-auto mb-4 group">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              <button
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingAvatar ? (
                  <Loader className="animate-spin text-white" />
                ) : (
                  <Camera className="text-white" size={24} />
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              {profile?.full_name}
            </h2>

            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                <Mail size={12} /> {profile?.email}
              </p>
              {profile?.phone && (
                <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                  <Phone size={12} /> {profile?.phone}
                </p>
              )}
            </div>

            <div
              className={`mt-4 py-2 px-4 rounded-lg font-bold text-sm ${roleInfo.bg} ${roleInfo.color} flex items-center justify-center gap-2`}
            >
              {roleInfo.label === 'ADMIN' ? (
                <Shield size={14} />
              ) : roleInfo.label.includes('Yönetici') ||
                roleInfo.label.includes('Premium') ? (
                <Crown size={14} />
              ) : (
                <Briefcase size={14} />
              )}
              {roleInfo.label}
            </div>
          </div>

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
                  <span className="text-gray-500">Üye Sayısı:</span>
                  <span className="font-bold">
                    {profile.organization.member_limit || 'Sınırsız'} Kişi
                  </span>
                </div>
              </div>

              {/* Şirketten Ayrıl Butonu Buraya Taşındı */}
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
        </div>

        {/* SAĞ: Formlar ve Abonelik */}
        <div className="lg:col-span-2 space-y-6">
          {/* YENİLENMİŞ ABONELİK KARTI */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-500" /> Abonelik
                Durumu
              </h3>
            </div>

            <div className="p-6">
              <div
                className={`relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-r ${subDetails?.color} shadow-lg`}
              >
                {/* Arka Plan Deseni */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-black opacity-10 rounded-full blur-2xl"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {subDetails?.status === 'active' ? (
                        <CheckCircle2 className="text-white/90" size={20} />
                      ) : (
                        <AlertCircle className="text-white/90" size={20} />
                      )}
                      <h4 className="font-bold text-lg md:text-xl">
                        {subDetails?.title}
                      </h4>
                    </div>
                    <p className="text-white/80 text-sm font-medium">
                      {subDetails?.subtitle}
                    </p>

                    {subDetails?.status === 'active' && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold">
                        <Calendar size={14} />
                        Bitiş Tarihi: {subDetails?.endDate}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Yönetici Butonu */}
                    {(profile?.role === 'premium_individual' ||
                      profile?.org_role === 'owner') && (
                      <button
                        onClick={() => (window.location.href = '/pricing')}
                        className="bg-white text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition shadow-sm"
                      >
                        Planı Yönet
                      </button>
                    )}

                    {/* Premium Al Butonu (Normal Üye ise) */}
                    {subDetails?.status === 'inactive' &&
                      profile?.role !== 'admin' && (
                        <button
                          onClick={() => (window.location.href = '/pricing')}
                          className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition shadow-sm animate-pulse"
                        >
                          Premium'a Geç
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Shield size={20} className="text-gray-400" /> Kişisel Bilgiler
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Telefon Numarası
                  </label>
                  <div className="relative">
                    <Phone
                      size={18}
                      className="absolute left-3 top-3.5 text-gray-400"
                    />
                    <input
                      type="tel"
                      placeholder="05XX XXX XX XX"
                      className="w-full border p-3 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  className="w-full border p-3 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
                  value={email}
                />
                <p className="text-xs text-gray-400 mt-1">
                  E-posta adresi güvenlik nedeniyle değiştirilemez.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader size={18} className="animate-spin" />{' '}
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Save size={18} /> Kaydet
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ŞİFRE DEĞİŞTİRME */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Lock size={20} className="text-orange-500" /> Şifre Güncelle
            </h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Yeni Şifre
                  </label>
                  <input
                    type="password"
                    placeholder="******"
                    required
                    className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Şifre Tekrar
                  </label>
                  <input
                    type="password"
                    placeholder="******"
                    required
                    className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  disabled={passwordSaving}
                  className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition flex items-center gap-2"
                >
                  {passwordSaving ? (
                    'Güncelleniyor...'
                  ) : (
                    <>
                      <Save size={18} /> Şifreyi Güncelle
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
