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
  Wallet,
  ShieldAlert,
  LogOut,
  ChevronRight,
  Info,
  Star,
  Sparkles,
} from 'lucide-react';

// --- FİYATLANDIRMA YAPILANDIRMASI ---
const PRICING_CONFIG = {
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

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeMembersCount, setActiveMembersCount] = useState(1);

  // Modlar
  const [viewMode, setViewMode] = useState<'selection' | 'dashboard'>(
    'selection'
  );
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'corporate'>(
    'individual'
  );

  // Seçimler
  const [addDuration, setAddDuration] = useState(12);
  const [targetSeats, setTargetSeats] = useState(5);
  const [companyName, setCompanyName] = useState('');

  // Modallar
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showIndToCorpWarning, setShowIndToCorpWarning] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const { data } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('id', session.user.id)
        .single();
      setProfile(data);

      if (data.organization) {
        setViewMode('dashboard');
        setTargetSeats(data.organization.member_limit);
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', data.organization_id);
        setActiveMembersCount(count || 1);
        setSelectedPlan('corporate');
      } else if (data.role === 'premium_individual') {
        setViewMode('dashboard');
        setSelectedPlan('individual');
      } else {
        setViewMode('selection');
      }
    }
    setLoading(false);
  };

  const getCurrentPricingTable = () => {
    if (selectedPlan === 'corporate') return PRICING_CONFIG.corporate;
    const isPremium = profile?.role === 'premium_individual';
    const hasTimeLeft =
      profile?.subscription_end_date &&
      new Date(profile.subscription_end_date) > new Date();

    if (viewMode === 'dashboard' && isPremium && hasTimeLeft) {
      return PRICING_CONFIG.individual_renewal;
    }
    return PRICING_CONFIG.individual_standard;
  };

  const calculateTotal = () => {
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

  // --- SATIN ALMA TETİKLEYİCİ ---
  const initiatePurchase = () => {
    if (viewMode === 'selection') {
      // 1. Kurumsal Şirket Paketine sahip bir kişi bireysel premiuma geçmek isterse
      if (profile?.organization_id && selectedPlan === 'individual') {
        setShowLeaveWarning(true);
        return;
      }

      // 2. Bireysel premium olan bir kişi şirket almak istiyorsa
      if (
        profile?.role === 'premium_individual' &&
        selectedPlan === 'corporate'
      ) {
        setShowIndToCorpWarning(true);
        return;
      }

      // Diğer durumlar
      executePurchaseMock();
    } else {
      executePurchaseMock();
    }
  };

  // --- MOCK ÖDEME FONKSİYONU (PAYTR BEKLENİYOR) ---
  const executePurchaseMock = () => {
    // Modalları kapat
    setShowLeaveWarning(false);
    setShowIndToCorpWarning(false);

    // Gerçek işlem yerine uyarı ver
    alert(
      '🚧 Ödeme Sistemi Entegrasyon Aşamasındadır.\n\nÇok yakında PayTR güvencesiyle paket satın alabileceksiniz.'
    );
  };

  /* // --- GERÇEK SATIN ALMA (PAYTR EKLENDİĞİNDE BU KOD AKTİF EDİLECEK) ---
  const executePurchase = async () => {
    if (!user) return alert('Giriş yapmalısınız.');
    setProcessing(true);
    // ... Eski veritabanı kayıt kodları buraya gelecek ...
    setProcessing(false);
  };
  */

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

  const pricingTable = getCurrentPricingTable();
  const isRenewal =
    profile?.role === 'premium_individual' &&
    new Date(profile.subscription_end_date) > new Date();

  // --- SÜRE SEÇİCİ BİLEŞENİ ---
  const DurationSelector = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 3, 6, 12].map((duration) => {
        // @ts-ignore
        const info = pricingTable[duration];
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

  // ------------------------------------------------------------------
  // GÖRÜNÜM: SELECTION (Paket Seçimi)
  // ------------------------------------------------------------------
  if (viewMode === 'selection') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 pb-40">
        <div className="max-w-6xl mx-auto mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold mb-4"
          >
            <ArrowLeft size={18} /> Geri Dön
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-black text-gray-900 mb-2">
              Sizin İçin En Uygun Planı Seçin
            </h1>
            <p className="text-gray-500">
              İster bireysel, ister tüm şirketiniz için profesyonel çözüm.
            </p>
          </div>
        </div>

        {/* ANA SEÇİM TABLARI */}
        <div className="max-w-4xl mx-auto flex justify-center mb-10">
          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 inline-flex">
            <button
              onClick={() => setSelectedPlan('individual')}
              className={`px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                selectedPlan === 'individual'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <User size={18} /> Bireysel Premium
            </button>
            <button
              onClick={() => setSelectedPlan('corporate')}
              className={`px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                selectedPlan === 'corporate'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Building size={18} /> Kurumsal Premium
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {selectedPlan === 'individual'
                ? 'Bireysel Premium Paket'
                : 'Kurumsal Şirket Paketi'}
            </h2>
            <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
              {selectedPlan === 'individual'
                ? 'Kendi belgelerinizi takip edin, sınırsız hatırlatma kurun ve kişisel asistanınızın keyfini çıkarın.'
                : 'Tüm ekibinizi tek çatı altında toplayın. Personel başına ücretlendirme ile maliyetlerinizi kontrol edin.'}
            </p>

            <DurationSelector />

            {selectedPlan === 'corporate' && (
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
                {selectedPlan === 'corporate'
                  ? '(Tüm Ekip Dahil)'
                  : '(Tek Seferlik Ödeme)'}
              </div>
            </div>
            <button
              onClick={initiatePurchase}
              disabled={processing}
              className={`px-8 py-3 rounded-xl font-bold text-white text-lg shadow-lg transition flex items-center gap-2 ${
                selectedPlan === 'corporate'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {processing ? (
                'İşleniyor...'
              ) : (
                <>
                  Ödeme Sistemi (Yakında) <ChevronRight />
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
                Şu anda <b>{profile?.organization?.name}</b> şirketine
                bağlısınız.
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

  // ------------------------------------------------------------------
  // GÖRÜNÜM 2: DASHBOARD
  // ------------------------------------------------------------------
  const isExpired =
    new Date(
      profile?.organization?.subscription_end_date ||
        profile?.subscription_end_date
    ) < new Date();

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 pb-40">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold"
        >
          <ArrowLeft size={18} /> Geri Dön
        </button>
        {!profile.organization && (
          <button
            onClick={() => {
              setViewMode('selection');
              setSelectedPlan('corporate');
            }}
            className="text-sm font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 px-3 py-2 rounded-lg"
          >
            <Building size={16} /> Şirket Hesabına Geç
          </button>
        )}
      </div>

      <div
        className={`rounded-3xl p-8 text-white shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center relative overflow-hidden ${
          isExpired
            ? 'bg-gradient-to-r from-red-900 to-orange-800'
            : selectedPlan === 'corporate'
            ? 'bg-gradient-to-r from-purple-900 to-indigo-900'
            : 'bg-gradient-to-r from-blue-900 to-cyan-800'
        }`}
      >
        <Crown
          className="absolute -left-10 -top-10 text-white opacity-10"
          size={250}
        />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            {profile.organization?.name || 'Bireysel Premium Hesap'}
            {isExpired && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded animate-pulse">
                SÜRESİ DOLDU
              </span>
            )}
            {!isExpired && isRenewal && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Sparkles size={12} /> Sadakat İndirimi Aktif
              </span>
            )}
          </h1>
          <div className="flex gap-4 text-sm font-medium opacity-80">
            {profile.organization && (
              <span className="flex items-center gap-1">
                <Users size={16} /> {activeMembersCount} /{' '}
                {profile.organization.member_limit} Üye
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={16} /> Bitiş:{' '}
              {new Date(
                profile.organization?.subscription_end_date ||
                  profile.subscription_end_date
              ).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Zap className="text-yellow-500" />
          {isExpired ? 'Hemen Yenileyin' : 'Sürenizi Uzatın'}
        </h2>
        <p className="text-gray-500 mb-8">
          {isRenewal
            ? 'Mevcut üye olduğunuz için size özel indirimli fiyatlardan yararlanın.'
            : 'Aşağıdaki paketlerden birini seçerek kullanım sürenizi artırın.'}
        </p>

        <DurationSelector />

        {profile.organization && (
          <div className="max-w-xl mx-auto mt-8 bg-gray-50 p-6 rounded-2xl">
            <div className="flex justify-between mb-4">
              <label className="text-sm font-bold text-gray-500 uppercase">
                Toplam Personel Kapasitesi
              </label>
              <span className="text-3xl font-black text-purple-600">
                {targetSeats}
              </span>
            </div>
            <input
              type="range"
              min={activeMembersCount}
              max="50"
              value={targetSeats}
              onChange={(e) => setTargetSeats(parseInt(e.target.value))}
              className="w-full accent-purple-600 h-3 bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs font-bold text-gray-400 mt-2">
              <span>Min: {activeMembersCount}</span>
              <span>Maks: 50</span>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 w-full">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500 font-bold">Ödenecek Tutar</span>
              {profile.organization?.credits > 0 && (
                <span className="text-green-600 font-bold">
                  Kredi İndirimi: -
                  {Math.min(
                    profile.organization.credits,
                    calculateTotal() + profile.organization.credits
                  )}{' '}
                  TL
                </span>
              )}
            </div>
            <div className="text-4xl font-black text-gray-900">
              {calculateTotal()} TL
            </div>
          </div>
          <button
            onClick={executePurchaseMock}
            disabled={processing}
            className="w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-white text-lg shadow-xl bg-gray-900 hover:bg-black transition flex items-center justify-center gap-2"
          >
            {processing ? (
              'İşleniyor...'
            ) : (
              <>
                <CreditCard /> Ödeme Sistemi (Yakında)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
