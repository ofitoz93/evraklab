import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  CreditCard,
  ChevronRight,
  Database,
} from 'lucide-react';
import { formatBytes, notifyAdminsOfPayment } from './utils';
import PaytrCheckoutModal from './PaytrCheckoutModal';

// Depolama fiyatı = Supabase maliyeti (USD/GB/Ay) × Dolar Kuru × (1 + Kar Marjı).
// Bir pakette override_price tanımlıysa otomatik hesaplama yerine o sabit fiyat kullanılır.
const DEFAULT_STORAGE_PRICING = {
  supabase_cost_usd_per_gb: 0.021,
  usd_try_rate: 46.84,
  profit_margin_percent: 100,
  packages: [
    { size_gb: 0.5, label: '500 MB Ekstra', override_price: 100 },
    { size_gb: 1, label: '1 GB Ekstra', override_price: 190 },
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

// Firmaya bağlı danışmanların (corporate_chief / corporate_staff) kendi şahsi
// depolama kotalarını satın alabilmeleri için hazırlanmış bağımsız sayfa.
// Bu roller şirketin abonelik/koltuk yönetimini yapamadığından /pricing
// sayfasına değil buraya yönlendirilir (bkz. App.tsx /pricing route guard).
export default function Storage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [storagePricing, setStoragePricing] = useState<any>(DEFAULT_STORAGE_PRICING);

  const [selectedStorageIndex, setSelectedStorageIndex] = useState(1); // Varsayılan 1 GB
  const [storageQuantity, setStorageQuantity] = useState(1);
  const [checkoutInfo, setCheckoutInfo] = useState<{ amount: number; itemLabel: string; bytesToAdd: number } | null>(null);

  useEffect(() => {
    fetchUserData();
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('*')
        .eq('key', 'storage_pricing')
        .maybeSingle();
      if (error) throw error;
      if (data?.value) setStoragePricing(data.value);
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
    }
    setLoading(false);
  };

  const calculateTotal = () => {
    const pack = storagePricing.packages[selectedStorageIndex];
    return calcStoragePackagePrice(pack, storagePricing) * storageQuantity;
  };

  // ÖDEME GEÇİCİ OLARAK KAPALI: normalde burada PayTR checkout'una
  // yönlendirilir (setCheckoutInfo) ve add_storage_limit RPC'si sadece ödeme
  // callback'i doğrulandıktan sonra api/paytrShared.ts > activatePurchase()
  // içinde sunucu tarafında çağrılırdı. Şimdilik PayTR atlanıp RPC doğrudan
  // burada çağrılıyor — eski akışı geri almak için bu fonksiyonun gövdesini
  // setCheckoutInfo(...) çağrısına geri döndürün.
  const prepareCheckout = async () => {
    const totalAmount = calculateTotal();
    if (totalAmount <= 0) {
      alert('Ödenecek tutar bulunamadı, lütfen tekrar deneyin.');
      return;
    }
    const pack = storagePricing.packages[selectedStorageIndex];
    const totalBytesToAdd = Math.round(pack.size_gb * 1024 * 1024 * 1024) * storageQuantity;

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('add_storage_limit', {
        target_id: user.id,
        is_corporate: false,
        bytes_to_add: totalBytesToAdd,
      });
      if (error) throw error;

      await supabase.from('subscription_payments').insert({
        user_id: user.id,
        organization_id: null,
        plan_type: 'storage',
        amount: totalAmount,
        storage_bytes: totalBytesToAdd,
      });

      await notifyAdminsOfPayment(
        'Yeni Depolama Satın Alındı',
        `${user.email} ${totalAmount.toLocaleString('tr-TR')} ₺ karşılığında ${formatBytes(totalBytesToAdd)} ek depolama satın aldı (Şahsi Kota).`
      );

      alert(`✅ Depolama Alanı Başarıyla Satın Alındı!\nSisteminize ${formatBytes(totalBytesToAdd)} ekstra alan (Şahsi Kota) tanımlandı.`);
      window.location.reload();
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Yükleniyor...</div>;

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
            Depolama Alanını Genişlet
          </h1>
          <p className="text-gray-500">
            Daha fazla belge yüklemek için ek alan satın alın. Satın alınan alan kalıcıdır.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8 text-center">
          <div className="animate-fadeIn">
            <div className="max-w-md mx-auto mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100 text-left flex items-start gap-3">
              <User size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-blue-800">
                Burada satın aldığınız alan sadece size ait <b>şahsi kotanıza</b> eklenir; şirketinizin kotasından bağımsız çalışır ve Evraklar sayfasında "Şahsi" belge yükleme izniniz olmasa bile kullanılabilir.
                Şirketin ortak kotasını genişletmek isterseniz firma sahibinizle iletişime geçmeniz gerekir.
              </p>
            </div>
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
                  onClick={() => setStorageQuantity(Math.max(1, storageQuantity - 1))}
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
                  {storagePricing.packages[selectedStorageIndex].size_gb * storageQuantity} GB
                </b>{' '}
                alan eklenecek.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
          <div className="whitespace-nowrap shrink-0">
            <div className="text-xs text-gray-400 font-bold uppercase">
              Toplam Tutar
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900">
              {calculateTotal()} TL
            </div>
            <div className="text-xs text-green-600 font-bold">
              (Tek Seferlik Ödeme)
            </div>
          </div>
          <button
            onClick={prepareCheckout}
            disabled={processing}
            className="px-4 sm:px-8 py-3 rounded-xl font-bold text-white text-sm sm:text-lg shadow-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            {processing ? (
              'İşleniyor...'
            ) : (
              <>
                <CreditCard size={18} /> <span className="hidden sm:inline">Satın Al</span><span className="sm:hidden">Satın Al</span> <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {checkoutInfo && user && (
        <PaytrCheckoutModal
          purpose="storage"
          purposePayload={{ targetId: user.id, isCorporate: false, bytesToAdd: checkoutInfo.bytesToAdd }}
          amount={checkoutInfo.amount}
          itemLabel={checkoutInfo.itemLabel}
          organizationId={null}
          userId={user.id}
          userEmail={user.email}
          onClose={() => setCheckoutInfo(null)}
        />
      )}
    </div>
  );
}
