import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Crown,
  Building,
  User,
  CreditCard,
  ArrowLeft,
  Clock,
  Users,
  Zap,
  ShieldAlert,
  LogOut,
  ChevronRight,
  Star,
  Database, // Depolama İkonu
  HardDrive,
} from 'lucide-react';
import { formatBytes } from './utils'; // Utils dosyasını oluşturduysan import et, yoksa aşağıya fonksiyonu ekle

// --- FİYATLANDIRMA AYARLARI ---
// Bu değerler artık admin panelinden ("Fiyatlandırma" sekmesi) `pricing_settings`
// tablosu üzerinden yönetiliyor. Aşağıdaki sabitler, veri henüz yüklenmeden veya
// tablo boşken kullanılan varsayılan/yedek (fallback) değerlerdir.
const DEFAULT_SUBSCRIPTION_PLANS = {
  individual_standard: {
    1: { old: 250, price: 99, label: 'Aylık' },
    3: { old: 750, price: 279, label: '3 Aylık' },
    6: { old: 1500, price: 499, label: '6 Aylık' },
    12: { old: 3000, price: 849, label: '1 Yıllık' },
  },
  individual_renewal: {
    1: { old: 99, price: 79, label: 'Aylık Uzatma' },
    3: { old: 279, price: 207, label: '3 Aylık Uzatma' },
    6: { old: 499, price: 354, label: '6 Aylık Uzatma' },
    12: { old: 849, price: 588, label: '1 Yıllık Uzatma' },
  },
  corporate: {
    1: { old: 500, price: 199, label: 'Aylık' },
    3: { old: 1500, price: 567, label: '3 Aylık' },
    6: { old: 3000, price: 1074, label: '6 Aylık' },
    12: { old: 6000, price: 1788, label: '1 Yıllık' },
  },
};

// Depolama fiyatı = Supabase maliyeti (USD/GB/Ay) × Dolar Kuru × (1 + Kar Marjı).
// Bir pakette override_price tanımlıysa otomatik hesaplama yerine o sabit fiyat kullanılır.
const DEFAULT_STORAGE_PRICING = {
  supabase_cost_usd_per_gb: 0.021,
  usd_try_rate: 46.84,
  profit_margin_percent: 100,
  packages: [
    { size_gb: 0.5, label: '500 MB Ekstra', override_price: 50 },
    { size_gb: 1, label: '1 GB Ekstra', override_price: 90 },
  ],
};

const calcStoragePackagePrice = (pkg: any, storagePricing: any) => {
  if (pkg.override_price !== null && pkg.override_price !== undefined && pkg.override_price !== '') {
    return Number(pkg.override_price);
  }
  const cost = Number(storagePricing.supabase_cost_usd_per_gb) || 0;
  const rate = Number(storagePricing.usd_try_rate) || 0;
  const margin = Number(storagePricing.profit_margin_percent) || 0;
  return Math.round(Number(pkg.size_gb) * cost * rate * (1 + margin / 100) * 100) / 100;
};

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeMembersCount, setActiveMembersCount] = useState(1);

  const [subscriptionPlans, setSubscriptionPlans] = useState<any>(DEFAULT_SUBSCRIPTION_PLANS);
  const [storagePricing, setStoragePricing] = useState<any>(DEFAULT_STORAGE_PRICING);

  // Görünüm Modları: 'subscription' (Süre) veya 'storage' (Depolama)
  const [purchaseType, setPurchaseType] = useState<'subscription' | 'storage'>(
    'subscription'
  );

  const [viewMode, setViewMode] = useState<'selection' | 'dashboard'>(
    'selection'
  );
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'corporate'>(
    'individual'
  );

  // Seçim State'leri
  const [addDuration, setAddDuration] = useState(12);
  const [targetSeats, setTargetSeats] = useState(5);
  const [companyName, setCompanyName] = useState('');

  // Depolama Seçimi
  const [selectedStorageIndex, setSelectedStorageIndex] = useState(1); // Varsayılan 1 GB
  const [storageQuantity, setStorageQuantity] = useState(1); // Kaç adet alınacak?

  // Modallar
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showIndToCorpWarning, setShowIndToCorpWarning] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      const { data, error } = await supabase.from('pricing_settings').select('*');
      if (error) throw error;
      data?.forEach((row: any) => {
        if (row.key === 'subscription_plans') setSubscriptionPlans(row.value);
        if (row.key === 'storage_pricing') setStoragePricing(row.value);
      });
    } catch (err: any) {
      console.error('Fiyatlandırma ayarları yüklenemedi, varsayılan fiyatlar kullanılıyor:', err.message);
    }
  };

  const fetchUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        let orgData = null;
        if (profileData.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single();
          orgData = org;
        }
        const combined = { ...profileData, organization: orgData };
        setProfile(combined);

        if (profileData.role === 'premium_individual') {
          // Bireysel premium hesaplar, Premium Panel özellikleri (Saha Denetimleri,
          // Atık Yönetimi, Mevzuat Takip, Aksiyon Takip) çalışabilsin diye kendilerine
          // özel "kişisel" bir organizations kaydına bağlı olabilir (bkz.
          // executePurchaseMock). Bu org kurumsal bir şirket DEĞİLDİR, bu yüzden
          // orgData var olsa bile burada her zaman bireysel plan gösterilir.
          setViewMode('dashboard');
          setSelectedPlan('individual');
        } else if (orgData) {
          setViewMode('dashboard');
          setTargetSeats(orgData.member_limit);
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', profileData.organization_id);
          setActiveMembersCount(count || 1);
          setSelectedPlan('corporate');
        } else {
          setViewMode('selection');
        }
      }
    }
    setLoading(false);
  };

  const getCurrentPricingTable = () => {
    if (selectedPlan === 'corporate') return subscriptionPlans.corporate;
    const isPremium = profile?.role === 'premium_individual';
    const subEnd = profile?.subscription_end_date
      ? new Date(profile.subscription_end_date)
      : new Date(0);
    const hasTimeLeft = subEnd > new Date();

    if (viewMode === 'dashboard' && isPremium && hasTimeLeft) {
      return subscriptionPlans.individual_renewal;
    }
    return subscriptionPlans.individual_standard;
  };

  const calculateTotal = () => {
    // Depolama Modu
    if (purchaseType === 'storage') {
      const pack = storagePricing.packages[selectedStorageIndex];
      return calcStoragePackagePrice(pack, storagePricing) * storageQuantity;
    }

    // Abonelik Modu
    const pricingTable = getCurrentPricingTable();
    // @ts-ignore
    const priceInfo = pricingTable[addDuration];
    if (!priceInfo) return 0;

    let total = priceInfo.price;
    if (selectedPlan === 'corporate') {
      total = total * targetSeats;
    }

    let credits = 0;
    if (viewMode === 'dashboard') credits = profile?.organization?.credits || 0;
    return Math.max(0, total - credits);
  };

  const initiatePurchase = () => {
    if (purchaseType === 'storage') {
      executePurchaseMock();
      return;
    }

    if (viewMode === 'selection') {
      if (selectedPlan === 'corporate' && !companyName.trim()) {
        alert('Lütfen şirket ünvanını giriniz.');
        return;
      }
      if (profile?.organization_id && selectedPlan === 'individual') {
        setShowLeaveWarning(true);
        return;
      }
      if (
        profile?.role === 'premium_individual' &&
        selectedPlan === 'corporate'
      ) {
        setShowIndToCorpWarning(true);
        return;
      }
      executePurchaseMock();
    } else {
      executePurchaseMock();
    }
  };

  const executePurchaseMock = async () => {
    setShowLeaveWarning(false);
    setShowIndToCorpWarning(false);
    setProcessing(true);

    const totalAmount = calculateTotal();

    try {
      if (purchaseType === 'storage') {
        const pack = storagePricing.packages[selectedStorageIndex];
        const totalBytesToAdd = Math.round(pack.size_gb * 1024 * 1024 * 1024) * storageQuantity;
        const targetId = profile?.organization_id || user.id;
        const isCorporate = !!profile?.organization_id;

        const { error } = await supabase.rpc('add_storage_limit', {
          target_id: targetId,
          is_corporate: isCorporate,
          bytes_to_add: totalBytesToAdd,
        });

        if (error) throw error;

        await supabase.from('subscription_payments').insert({
          user_id: user.id,
          organization_id: profile?.organization_id || null,
          plan_type: 'storage',
          amount: totalAmount,
          storage_bytes: totalBytesToAdd,
        });

        alert(`✅ Depolama Alanı Başarıyla Satın Alındı!\nSisteminize ${formatBytes(totalBytesToAdd)} ekstra alan tanımlandı.`);
      } else {
        // subscription
        const now = new Date();
        const finalDate = new Date(now.setMonth(now.getMonth() + addDuration)).toISOString();

        if (selectedPlan === 'corporate') {
          if (viewMode === 'selection') {
            if (!companyName.trim()) {
              throw new Error('Lütfen şirket adı giriniz.');
            }

            // 1. Şirket oluştur (organizations tablosu)
            const { data: newOrg, error: orgErr } = await supabase
              .from('organizations')
              .insert([
                {
                  name: companyName,
                  member_limit: targetSeats,
                  subscription_end_date: finalDate,
                  storage_limit: 1073741824, // 1 GB default
                  is_environmental_consultant: false,
                },
              ])
              .select()
              .single();

            if (orgErr) throw orgErr;

            // 2. Kullanıcı profilini güncelle (premium_corporate rolü ve organization_id)
            const { error: profErr } = await supabase
              .from('profiles')
              .update({
                role: 'premium_corporate',
                organization_id: newOrg.id,
                subscription_end_date: null,
              })
              .eq('id', user.id);

            if (profErr) throw profErr;

            await supabase.from('subscription_payments').insert({
              user_id: user.id,
              organization_id: newOrg.id,
              plan_type: 'corporate_new',
              amount: totalAmount,
              duration_months: addDuration,
              seats: targetSeats,
            });

            alert(`✅ Kurumsal Premium Aboneliğiniz Başarıyla Aktifleştirildi!\n"${companyName}" isimli şirketiniz oluşturuldu ve yönetici rolünüz tanımlandı.`);
          } else {
            // Dashboard mode - extend subscription and seats
            if (!profile?.organization_id) throw new Error('Şirketiniz bulunamadı.');

            const { error: orgErr } = await supabase
              .from('organizations')
              .update({
                member_limit: targetSeats,
                subscription_end_date: finalDate,
              })
              .eq('id', profile.organization_id);

            if (orgErr) throw orgErr;

            // Abonelik süresi dolduğunda 'normal' rolüne düşürülen ekip
            // üyelerini (previous_role kaydı varsa) eski rollerine geri yükle.
            await supabase.rpc('restore_org_roles', { org_id: profile.organization_id });

            await supabase.from('subscription_payments').insert({
              user_id: user.id,
              organization_id: profile.organization_id,
              plan_type: 'corporate_renewal',
              amount: totalAmount,
              duration_months: addDuration,
              seats: targetSeats,
            });

            alert(`✅ Kurumsal Aboneliğiniz Başarıyla Güncellendi!\nŞirket personel limitiniz ${targetSeats} kişiye yükseltildi ve abonelik süreniz ${new Date(finalDate).toLocaleDateString('tr-TR')} tarihine kadar uzatıldı.`);
          }
        } else {
          // individual
          // Premium Panel özellikleri (Saha Denetimleri, Atık Yönetimi, Mevzuat
          // Takip, Aksiyon Takip) organizasyon/firma kimliğine ihtiyaç duyduğu
          // için, bireysel premium hesaba kendine özel (danışmanlık firması
          // OLMAYAN) küçük bir "kişisel organizasyon" ve bu organizasyona bağlı,
          // kendi adını taşıyan bir "kişisel firma" (consultant_clients) kaydı
          // otomatik tanımlanır/yeniden kullanılır. Zaten varsa (yenileme) yeni
          // kayıt oluşturulmaz.
          let personalOrgId: string | null = profile?.organization_id || null;
          const personalName = profile?.full_name?.trim() || user.email;
          const isFirstPersonalOrg = !personalOrgId;

          if (isFirstPersonalOrg) {
            const { data: newPersonalOrg, error: personalOrgErr } = await supabase
              .from('organizations')
              .insert([
                {
                  name: personalName,
                  member_limit: 1,
                  is_environmental_consultant: false,
                  is_personal: true,
                },
              ])
              .select()
              .single();
            if (personalOrgErr) throw personalOrgErr;
            personalOrgId = newPersonalOrg.id;
          }

          // Rolü/organizasyonu önce güncelliyoruz: consultant_clients RLS
          // politikası 'premium_individual' rolünü şart koşuyor, bu yüzden
          // "kişisel firma" kaydı ancak rol güncellendikten sonra eklenebilir.
          const { error: profErr } = await supabase
            .from('profiles')
            .update({
              role: 'premium_individual',
              organization_id: personalOrgId,
              subscription_end_date: finalDate,
            })
            .eq('id', user.id);

          if (profErr) throw profErr;

          if (isFirstPersonalOrg) {
            // Not: kayıt kasıtlı olarak kullanıcının kendi adıyla değil "Lokasyon 1"
            // adıyla oluşturuluyor - Aksiyon/Görüş/Mevzuat gibi yerlerdeki seçim
            // listelerinde "kendi adı soyadı" görünmesin diye. Kullanıcı Premium
            // Panel > Dokümantasyon > Tanımlar'dan kendi lokasyon adlarını
            // tanımladıkça bu listeye ek kayıtlar (aynı mekanizmayla) eklenir.
            const { error: personalClientErr } = await supabase
              .from('consultant_clients')
              .insert([
                {
                  consultant_company_id: personalOrgId,
                  name: 'Lokasyon 1',
                },
              ]);
            if (personalClientErr) throw personalClientErr;

            // consultant_clients kaydıyla birebir aynı isimde bir
            // user_definitions (category='location') kaydı da oluşturuyoruz;
            // Evrak Yükle / Belge Ekle sayfalarındaki "Lokasyon" seçimi bu
            // tabloyu okuyor, ikisi senkron olmazsa listeler eşleşmez.
            const { error: personalLocDefErr } = await supabase
              .from('user_definitions')
              .insert([
                {
                  user_id: user.id,
                  category: 'location',
                  label: 'Lokasyon 1',
                  organization_id: personalOrgId,
                },
              ]);
            if (personalLocDefErr) throw personalLocDefErr;
          }

          await supabase.from('subscription_payments').insert({
            user_id: user.id,
            organization_id: personalOrgId,
            plan_type: 'individual',
            amount: totalAmount,
            duration_months: addDuration,
          });

          alert(`✅ Bireysel Premium Aboneliğiniz Başarıyla Aktifleştirildi!\nTüm premium özellikler ${new Date(finalDate).toLocaleDateString('tr-TR')} tarihine kadar hesabınıza tanımlandı.`);
        }
      }

      // Refresh
      window.location.reload();
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  const pricingTable = getCurrentPricingTable();
  const subEndDate =
    profile?.organization?.subscription_end_date ||
    profile?.subscription_end_date;
  const isExpired = subEndDate ? new Date(subEndDate) < new Date() : false;
  const isRenewal = !isExpired && profile?.role === 'premium_individual';

  // --- SÜRE SEÇİM KARTLARI ---
  const DurationSelector = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 3, 6, 12].map((duration) => {
        // @ts-ignore
        const info = pricingTable[duration];
        if (!info) return null;

        const monthlyCost = (info.price / duration).toFixed(2);
        const discountPercent = Math.round(
          ((info.old - info.price) / info.old) * 100
        );

        return (
          <div
            key={duration}
            onClick={() => setAddDuration(duration)}
            className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-300 flex flex-col justify-between ${
              addDuration === duration
                ? 'border-blue-600 bg-blue-50 shadow-lg scale-105 z-10'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
            }`}
          >
            {duration === 12 && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <Star size={12} fill="white" /> EN AVANTAJLI
              </div>
            )}
            <div className="text-center mb-2">
              <h4 className="text-lg font-bold text-gray-800">{info.label}</h4>
              {discountPercent > 0 && (
                <span className="inline-block bg-green-100 text-green-700 text-xs font-extrabold px-2 py-0.5 rounded mt-1">
                  %{discountPercent} İNDİRİM
                </span>
              )}
            </div>
            <div className="text-center my-2">
              <div className="text-gray-400 text-sm line-through decoration-red-400 decoration-2">
                {info.old} TL
              </div>
              <div className="text-3xl font-black text-gray-900">
                {info.price} TL
              </div>
              <div className="text-blue-600 text-sm font-semibold mt-1">
                {monthlyCost} TL / Ay
              </div>
            </div>
            <div className="flex justify-center mt-3">
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  addDuration === duration
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}
              >
                {addDuration === duration && (
                  <CheckCircle size={16} className="text-white" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 pb-40">
      <div className="max-w-6xl mx-auto mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-4"
        >
          <ArrowLeft size={18} /> Geri Dön
        </button>

        {/* ANA MOD SEÇİCİ (ABONELİK / DEPOLAMA) */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-1.5 rounded-2xl shadow-md border border-gray-200 inline-flex">
            <button
              onClick={() => setPurchaseType('subscription')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                purchaseType === 'subscription'
                  ? 'bg-gray-900 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Zap size={18} /> Üyelik & Süre
            </button>
            <button
              onClick={() => setPurchaseType('storage')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                purchaseType === 'storage'
                  ? 'bg-gray-900 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <HardDrive size={18} /> Ekstra Depolama
            </button>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            {purchaseType === 'subscription'
              ? 'Paket Seçimi & Yenileme'
              : 'Depolama Alanını Genişlet'}
          </h1>
          <p className="text-gray-500">
            {purchaseType === 'subscription'
              ? 'İhtiyacınıza uygun paketi seçin veya mevcut planınızı uzatın.'
              : 'Daha fazla belge yüklemek için ek alan satın alın. Satın alınan alan kalıcıdır.'}
          </p>
        </div>
      </div>

      {/* --- İÇERİK ALANI --- */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8 text-center">
          {purchaseType === 'subscription' ? (
            <>
              {viewMode === 'selection' && (
                <div className="flex justify-center mb-8">
                  <div className="bg-gray-50 p-1 rounded-xl border border-gray-200 inline-flex">
                    <button
                      onClick={() => setSelectedPlan('individual')}
                      className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                        selectedPlan === 'individual'
                          ? 'bg-white text-blue-600 shadow'
                          : 'text-gray-500'
                      }`}
                    >
                      <User size={16} className="inline mr-2" /> Bireysel
                    </button>
                    <button
                      onClick={() => setSelectedPlan('corporate')}
                      className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                        selectedPlan === 'corporate'
                          ? 'bg-white text-purple-600 shadow'
                          : 'text-gray-500'
                      }`}
                    >
                      <Building size={16} className="inline mr-2" /> Kurumsal
                    </button>
                  </div>
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {selectedPlan === 'individual'
                  ? 'Bireysel Premium Paket'
                  : 'Kurumsal Şirket Paketi'}
              </h2>
              <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
                {selectedPlan === 'individual'
                  ? 'Sınırsız hatırlatma ve 500 MB depolama.'
                  : 'Ekip yönetimi, sohbet ve 1 GB ortak depolama.'}
              </p>

              <DurationSelector />

              {/* Kurumsal Ayarlar (Sadece Selection Modunda ve Corporate seçiliyse) */}
              {viewMode === 'selection' && selectedPlan === 'corporate' && (
                <div className="max-w-xl mx-auto bg-purple-50 p-6 rounded-2xl border border-purple-100 animate-fadeIn">
                  <div className="mb-4">
                    <label className="block text-left text-sm font-bold text-purple-900 mb-2">
                      Şirket Adı
                    </label>
                    <input
                      className="w-full p-3 border border-purple-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Örn: Acme Lojistik A.Ş."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2 text-sm font-bold text-purple-900">
                      <span>Çalışan Sayısı</span>
                      <span className="text-2xl">{targetSeats} Kişi</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="50"
                      value={targetSeats}
                      onChange={(e) => setTargetSeats(parseInt(e.target.value))}
                      className="w-full accent-purple-600 h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-xs text-purple-500 mt-1 flex justify-between">
                      <span>Min: 2</span>
                      <span>Max: 50</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mevcut Kurumsal Ayarları (Dashboard Modunda) */}
              {viewMode === 'dashboard' && selectedPlan === 'corporate' && (
                <div className="max-w-xl mx-auto bg-gray-50 p-6 rounded-2xl border">
                  <div className="flex justify-between mb-2 text-sm font-bold text-gray-700">
                    <span>Toplam Kapasite</span>
                    <span className="text-2xl">{targetSeats} Kişi</span>
                  </div>
                  <input
                    type="range"
                    min={activeMembersCount}
                    max="50"
                    value={targetSeats}
                    onChange={(e) => setTargetSeats(parseInt(e.target.value))}
                    className="w-full accent-purple-600 h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </>
          ) : (
            /* --- DEPOLAMA SATIN ALMA EKRANI --- */
            <div className="animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
                {storagePricing.packages.map((pack: any, index: number) => (
                  <div
                    key={index}
                    onClick={() => setSelectedStorageIndex(index)}
                    className={`relative cursor-pointer p-6 rounded-2xl border-2 transition-all flex items-center justify-between
                                    ${
                                      selectedStorageIndex === index
                                        ? 'border-blue-600 bg-blue-50 shadow-lg'
                                        : 'border-gray-200 hover:border-blue-300'
                                    }
                                `}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-full ${
                          selectedStorageIndex === index
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Database size={24} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xl font-bold text-gray-800">
                          {pack.label}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Kalıcı alan artışı
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-gray-900">
                        {calcStoragePackagePrice(pack, storagePricing)} TL
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="max-w-md mx-auto bg-gray-50 p-6 rounded-2xl border">
                <label className="block text-sm font-bold text-gray-500 mb-2">
                  Adet Seçiniz (Kaç tane alınacak?)
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() =>
                      setStorageQuantity(Math.max(1, storageQuantity - 1))
                    }
                    className="w-10 h-10 rounded-lg bg-white border font-bold text-xl hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="text-3xl font-black text-blue-600 w-12">
                    {storageQuantity}
                  </span>
                  <button
                    onClick={() => setStorageQuantity(storageQuantity + 1)}
                    className="w-10 h-10 rounded-lg bg-white border font-bold text-xl hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  Toplamda{' '}
                  <b>
                    {storagePricing.packages[selectedStorageIndex].size_gb *
                      storageQuantity}{' '}
                    GB
                  </b>{' '}
                  alan eklenecek.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ALT BAR (ÖDEME) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase">
              Toplam Tutar
            </div>
            <div className="text-3xl font-black text-gray-900">
              {calculateTotal()} TL
            </div>
            <div className="text-xs text-green-600 font-bold">
              {purchaseType === 'subscription' && selectedPlan === 'corporate'
                ? '(Tüm Ekip Dahil)'
                : '(Tek Seferlik Ödeme)'}
            </div>
          </div>
          <button
            onClick={initiatePurchase}
            disabled={processing}
            className={`px-8 py-3 rounded-xl font-bold text-white text-lg shadow-lg transition flex items-center gap-2 ${
              selectedPlan === 'corporate' && purchaseType === 'subscription'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {processing ? (
              'İşleniyor...'
            ) : (
              <>
                <CreditCard /> Ödeme Sistemi (Yakında) <ChevronRight />
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODALLAR */}
      {showLeaveWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="text-orange-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              Şirketten Ayrılma Onayı
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Şu anda <b>{profile?.organization?.name}</b> şirketine bağlısınız.
              <br />
              <br />
              Bireysel paket alımına devam ederseniz{' '}
              <b>şirketten ayrılacaksınız.</b> Onaylıyor musunuz?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveWarning(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                İptal
              </button>
              <button
                onClick={executePurchaseMock}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-700 transition"
              >
                Evet, Ayrılıyorum
              </button>
            </div>
          </div>
        </div>
      )}

      {showIndToCorpWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="text-purple-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              Süre Sıfırlama Uyarısı
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Bireysel premiumun süresi bitmeden kurumsal paket alırsanız{' '}
              <b>mevcut premium üyelik süresi sıfırlanır.</b>
              <br />
              <br />
              Devam etmek istiyor musunuz?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowIndToCorpWarning(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                İptal
              </button>
              <button
                onClick={executePurchaseMock}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 transition"
              >
                Anladım, Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
