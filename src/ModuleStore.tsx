import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  SYSTEM_MODULES,
  SYSTEM_MODULE_CATEGORIES,
  DEFAULT_EXTRA_MODULE_PRICING,
  DEFAULT_MODULE_KEYS,
  isModuleEnabled,
  getSubModuleKeysOf,
} from './moduleRegistry';
import type { ModuleParentMap } from './moduleRegistry';
import { notifyAdminsOfPayment } from './utils';
import {
  Zap,
  CheckCircle,
  PlusCircle,
  Trash2,
  QrCode,
  FlaskConical,
  PenLine,
  PieChart,
  Star,
  Loader,
  AlertCircle,
  ShoppingBag,
  Shield,
  X,
  CreditCard,
  Lock,
  Eye,
} from 'lucide-react';
import { MODULE_PREVIEWS, ModulePreviewModal } from './modulePreviews';
import PaytrCheckoutModal from './PaytrCheckoutModal';

interface ModuleStoreProps {
  organizationId: string;
  userRole: string;
  onModulesUpdated?: () => void;
  onClose?: () => void;
}

export default function ModuleStore({
  organizationId,
  userRole,
  onModulesUpdated,
  onClose,
}: ModuleStoreProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [modulePrices, setModulePrices] = useState<any>(DEFAULT_EXTRA_MODULE_PRICING);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [previewModuleKey, setPreviewModuleKey] = useState<string | null>(null);
  // Admin panelindeki "Varsayılan Paket Ayarları"nda hangi modüllerin
  // Varsayılan/Ekstra işaretlendiği — moduleRegistry.ts'teki statik isDefault
  // alanı yerine bu dinamik liste kullanılır, böylece admin bir modülü
  // Ekstra yaptığında mağazada anında (kod değişikliği gerekmeden) satın
  // alınabilir olarak görünür.
  const [defaultModuleKeys, setDefaultModuleKeys] = useState<string[]>(DEFAULT_MODULE_KEYS);
  // Alt modül eşlemesi ({ altModülKey: üstModülKey }) — admin panelinde
  // "Modül Ayarları"ndan yönetilir. Alt modüller mağazada ayrı satın alma
  // kalemi olarak gösterilmez; üst modülü satın alınca otomatik açılır.
  const [subModuleParents, setSubModuleParents] = useState<ModuleParentMap>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; fullName: string; phone: string } | null>(null);
  const [checkoutInfo, setCheckoutInfo] = useState<{ moduleKey: string; moduleName: string; price: number; categoryKey: string } | null>(null);

  // Modal State'leri
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'add' | 'remove';
    moduleKey: string;
    moduleName: string;
    price: number;
    categoryKey: string;
  }>({
    show: false,
    type: 'add',
    moduleKey: '',
    moduleName: '',
    price: 0,
    categoryKey: '',
  });

  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    fetchStoreData();
  }, [organizationId]);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      // 0. Süresi dolmuş satın alımları pasifleştir (gerçek bir ödeme
      // gateway'i/cron altyapısı olmadığından, mağaza her açıldığında fırsatçı
      // şekilde tetiklenir). Otomatik yenileme YOK — süre dolan modül düşer.
      if (organizationId) {
        try {
          await supabase.rpc('sync_expired_modules', { p_organization_id: organizationId });
        } catch (syncErr) {
          console.warn('Modül süre kontrolü uyarısı:', syncErr);
        }
      }

      // 1. Şirket verisini ve aktif modülleri çek
      if (organizationId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, enabled_modules')
          .eq('id', organizationId)
          .maybeSingle();

        if (org) {
          setOrgData(org);
          setEnabledModules(Array.isArray(org.enabled_modules) ? org.enabled_modules : []);
        }

        const { data: purchaseRows } = await supabase
          .from('organization_module_purchases')
          .select('*')
          .eq('organization_id', organizationId)
          .order('purchased_at', { ascending: false });

        setPurchases(purchaseRows || []);
      }

      // 2. Fiyatlandırma ayarlarını çek
      try {
        const { data: pricingData } = await supabase
          .from('pricing_settings')
          .select('*')
          .eq('key', 'extra_module_pricing')
          .maybeSingle();

        if (pricingData?.value) {
          setModulePrices(pricingData.value);
        }
      } catch (e) {
        console.warn('Pricing settings fetch fallback:', e);
      }

      // 3. Hangi modüllerin Varsayılan/Ekstra olduğunu (admin panelinde
      // ayarlanan güncel liste) çek.
      try {
        const { data: defaultsData } = await supabase
          .from('pricing_settings')
          .select('*')
          .eq('key', 'default_system_modules')
          .maybeSingle();

        if (defaultsData?.value && Array.isArray(defaultsData.value)) {
          setDefaultModuleKeys(defaultsData.value);
        }
      } catch (e) {
        console.warn('Varsayılan modül listesi fetch fallback:', e);
      }

      // 3b. Alt modül eşlemesini (üst modülü satın alınca otomatik açılan
      // modüller) çek — bunlar mağazada ayrıca listelenmez.
      try {
        const { data: subModuleData } = await supabase
          .from('pricing_settings')
          .select('*')
          .eq('key', 'module_sub_modules')
          .maybeSingle();

        if (subModuleData?.value && typeof subModuleData.value === 'object') {
          setSubModuleParents(subModuleData.value);
        }
      } catch (e) {
        console.warn('Alt modül eşlemesi fetch fallback:', e);
      }

      // 4. PayTR ödeme checkout'unda kullanılacak fatura/iletişim bilgileri.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, email, phone')
            .eq('id', session.user.id)
            .maybeSingle();
          setCurrentUser({
            id: session.user.id,
            email: prof?.email || session.user.email || '',
            fullName: prof?.full_name || '',
            phone: prof?.phone || '',
          });
        }
      } catch (e) {
        console.warn('Kullanıcı bilgisi fetch fallback:', e);
      }
    } catch (err: any) {
      console.error('Mağaza verisi yüklenirken hata:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // İkon haritası
  const getModuleIcon = (key: string) => {
    switch (key) {
      case 'inspections':
        return <QrCode size={24} className="text-purple-600 dark:text-purple-400" />;
      case 'waste':
        return <Trash2 size={24} className="text-emerald-600 dark:text-emerald-400" />;
      case 'msds':
        return <FlaskConical size={24} className="text-amber-600 dark:text-amber-400" />;
      case 'opinions':
        return <PenLine size={24} className="text-blue-600 dark:text-blue-400" />;
      case 'finance_management':
        return <PieChart size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case 'evaluations':
        return <Star size={24} className="text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Zap size={24} className="text-purple-600" />;
    }
  };

  // Sadece Ekstra / Opsiyonel Modüller — alt modüller (bir üst modülü satın
  // alınca otomatik açılanlar) burada ayrı bir satın alma kalemi olarak
  // gösterilmez.
  const extraModules = SYSTEM_MODULES.filter((m) => !defaultModuleKeys.includes(m.key) && !subModuleParents[m.key]);

  // Satın Alma İşlemini Onayla.
  // ÖDEME GEÇİCİ OLARAK KAPALI: normalde 'add' burada PayTR checkout'una
  // yönlendirilir (setCheckoutInfo) ve modül yalnızca gerçek ödeme onaylanınca
  // aktive edilir. Şimdilik PayTR atlanıp purchase_extra_module RPC'si
  // doğrudan çağrılıyor — eski akışı geri almak için 'add' dalını
  // setCheckoutInfo(...) çağrısına geri döndürün (bkz. alttaki yorum satırları).
  const handleConfirmAction = async () => {
    if (!organizationId || !confirmModal.moduleKey) return;

    setSaving(true);
    try {
      if (confirmModal.type === 'add') {
        // Eski (PayTR) akış: setCheckoutInfo({ moduleKey, moduleName, price, categoryKey }); return;
        const { error } = await supabase.rpc('purchase_extra_module', {
          p_organization_id: organizationId,
          p_module_key: confirmModal.moduleKey,
          p_category_key: confirmModal.categoryKey,
          p_price: confirmModal.price,
        });
        if (error) throw error;

        setConfirmModal({ ...confirmModal, show: false });

        await notifyAdminsOfPayment(
          'Yeni Ekstra Modül Satın Alındı',
          `"${orgData?.name || organizationId}" firması "${confirmModal.moduleName}" ekstra modülünü ${Number(confirmModal.price).toLocaleString('tr-TR')} ₺ karşılığında satın aldı.`
        );

        setNotification({
          show: true,
          message: `✅ ${confirmModal.moduleName} modülü paketinize eklendi.`,
          type: 'success',
        });
      } else {
        const { error } = await supabase.rpc('cancel_extra_module', {
          p_organization_id: organizationId,
          p_module_key: confirmModal.moduleKey,
        });
        if (error) throw error;

        setConfirmModal({ ...confirmModal, show: false });

        setNotification({
          show: true,
          message: `ℹ️ ${confirmModal.moduleName} modülü paketinizden çıkarıldı.`,
          type: 'success',
        });
      }

      await fetchStoreData();
      if (onModulesUpdated) onModulesUpdated();
    } catch (err: any) {
      setNotification({
        show: true,
        message: 'İşlem gerçekleştirilemedi: ' + err.message,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getPurchaseFor = (moduleKey: string) =>
    purchases.find((p) => p.module_key === moduleKey && p.status === 'active');

  // Toplam Aylık Ekstra Ücret Hesapla
  const totalExtraMonthlyFee = extraModules.reduce((sum, m) => {
    const isActive = enabledModules.includes(m.key);
    if (isActive) {
      const price = modulePrices[m.key]?.price || DEFAULT_EXTRA_MODULE_PRICING[m.key]?.price || 0;
      return sum + price;
    }
    return sum;
  }, 0);

  // Şef veya Personel ise bu sayfaya erişimi engelle
  const canAccessStore = ['premium_corporate', 'admin', 'system_admin'].includes(userRole);
  if (!canAccessStore) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-8 text-center space-y-3">
        <Lock className="mx-auto text-amber-600 dark:text-amber-400" size={36} />
        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">Erişim İzni Yok</h3>
        <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
          Ekstra Modül Mağazası ve satın alma işlemleri sadece Şirket Yöneticileri ve Şirket Sahipleri tarafından kullanılabilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* Üst Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-800 to-purple-800 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 max-w-xl z-10">
          <span className="bg-purple-500/30 border border-purple-400/40 text-purple-200 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <ShoppingBag size={12} /> Ekstra Paket & Modül Mağazası
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Şirketinizin İhtiyaçlarına Göre Paketinizi Genişletin
          </h2>
          <p className="text-purple-100 text-xs md:text-sm leading-relaxed opacity-90">
            Dilediğiniz ekstra modülü anında tek tıkla paketinize ekleyin. Ekstra ücret faturanıza aylık olarak yansıtılır ve modül hemen aktif olur.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shrink-0 space-y-1 text-right z-10 w-full md:w-auto">
          <div className="text-[10px] uppercase tracking-wider text-purple-200 font-bold">Mevcut Ekstra Paket Tutarı</div>
          <div className="text-2xl font-black text-white">₺{totalExtraMonthlyFee} <span className="text-xs font-semibold text-purple-200">/ Ay</span></div>
          <div className="text-[10px] text-purple-200/80">Aktif Ekstra Modüller: {extraModules.filter(m => enabledModules.includes(m.key)).length} Adet</div>
        </div>

        {/* Arka plan süsü */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Bildirim Alert */}
      {notification.show && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-bold animate-slideDown ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification({ ...notification, show: false })}
            className="text-xs hover:underline opacity-80"
          >
            Kapat
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400 flex items-center justify-center gap-2 text-sm font-medium">
          <Loader className="animate-spin" size={20} /> Ekstra modül mağazası yükleniyor...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Zap size={20} className="text-purple-600" /> Satın Alınabilir Ekstra Modüller
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Gereksinim duymadığınız modülleri istediğiniz zaman iptal edebilirsiniz.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {extraModules.map((m) => {
              const isActive = enabledModules.includes(m.key);
              const price = modulePrices[m.key]?.price || DEFAULT_EXTRA_MODULE_PRICING[m.key]?.price || 0;
              const purchase = getPurchaseFor(m.key);

              return (
                <div
                  key={m.key}
                  className={`bg-white dark:bg-slate-800 rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md relative overflow-hidden ${
                    isActive
                      ? 'border-purple-300 dark:border-purple-800 ring-2 ring-purple-500/20'
                      : 'border-gray-200 dark:border-slate-700'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Kart Üstü */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900/60">
                        {getModuleIcon(m.key)}
                      </div>

                      <div className="text-right">
                        <span className="text-lg font-black text-purple-900 dark:text-purple-300">₺{price}</span>
                        <span className="text-[10px] text-gray-400 block font-bold">/ Ay</span>
                      </div>
                    </div>

                    {/* Başlık ve Açıklama */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-gray-900 dark:text-white">{m.name}</h4>
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded-full inline-block mt-1">
                        {m.categoryName}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed mt-2">
                        {m.description}
                      </p>
                      {getSubModuleKeysOf(m.key, subModuleParents).length > 0 && (
                        <p className="text-[10px] text-purple-700 dark:text-purple-400 font-bold mt-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg px-2 py-1.5 leading-relaxed">
                          📦 Dahil olan alt modüller: {getSubModuleKeysOf(m.key, subModuleParents).map((k) => SYSTEM_MODULES.find((x) => x.key === k)?.name || k).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Buton ve Durum */}
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-3">
                    {MODULE_PREVIEWS[m.key] && (
                      <button
                        onClick={() => setPreviewModuleKey(m.key)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 text-xs font-bold hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
                      >
                        <Eye size={14} /> Önizle — Nasıl Çalışır?
                      </button>
                    )}
                    {isActive ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle size={14} /> Paketinizde Aktif
                        </div>
                        {purchase && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-slate-900/50 rounded-lg p-2 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Üye olunan tarih:</span>
                              <span>{formatDate(purchase.purchased_at)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Bitiş tarihi:</span>
                              <span className="text-purple-700 dark:text-purple-300">{formatDate(purchase.expires_at)}</span>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            setConfirmModal({
                              show: true,
                              type: 'remove',
                              moduleKey: m.key,
                              moduleName: m.name,
                              price: price,
                              categoryKey: m.category,
                            })
                          }
                          className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        >
                          Modülü Şimdi Kapat
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setConfirmModal({
                            show: true,
                            type: 'add',
                            moduleKey: m.key,
                            moduleName: m.name,
                            price: price,
                            categoryKey: m.category,
                          })
                        }
                        className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition active:scale-98"
                      >
                        <PlusCircle size={15} /> Paketime Ekle (₺{price}/Ay)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Satın Alma Geçmişi */}
          {purchases.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <ShoppingBag size={16} className="text-purple-600" /> Satın Alma Geçmişi
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 dark:text-gray-500 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                      <th className="py-2 pr-3">Modül</th>
                      <th className="py-2 pr-3">Fiyat</th>
                      <th className="py-2 pr-3">Satın Alma Tarihi</th>
                      <th className="py-2 pr-3">Bitiş / İptal Tarihi</th>
                      <th className="py-2 pr-3">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => {
                      const modInfo = SYSTEM_MODULES.find((m) => m.key === p.module_key);
                      const statusLabel = p.status === 'active' ? 'Aktif' : p.status === 'expired' ? 'Süresi Doldu' : 'İptal Edildi';
                      const statusClass =
                        p.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : p.status === 'expired'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-900/40 dark:text-gray-400';
                      return (
                        <tr key={p.id} className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                          <td className="py-2 pr-3 font-bold text-gray-700 dark:text-gray-200">{modInfo?.name || p.module_key}</td>
                          <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">₺{p.price}/Ay</td>
                          <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{formatDate(p.purchased_at)}</td>
                          <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                            {p.status === 'cancelled' ? formatDate(p.cancelled_at) : formatDate(p.expires_at)}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODÜL ÖNİZLEME (SATIN ALMADAN ÖNCE DENE) */}
      {previewModuleKey && MODULE_PREVIEWS[previewModuleKey] && (() => {
        const previewModule = SYSTEM_MODULES.find((m) => m.key === previewModuleKey);
        const previewPrice = modulePrices[previewModuleKey]?.price || DEFAULT_EXTRA_MODULE_PRICING[previewModuleKey]?.price || 0;
        const PreviewContent = MODULE_PREVIEWS[previewModuleKey];
        return (
          <ModulePreviewModal
            moduleName={previewModule?.name || previewModuleKey}
            price={previewPrice}
            onClose={() => setPreviewModuleKey(null)}
            onPurchase={() => {
              setPreviewModuleKey(null);
              setConfirmModal({
                show: true,
                type: 'add',
                moduleKey: previewModuleKey,
                moduleName: previewModule?.name || previewModuleKey,
                price: previewPrice,
                categoryKey: previewModule?.category || '',
              });
            }}
          >
            <PreviewContent />
          </ModulePreviewModal>
        );
      })()}

      {/* MODÜL SATIN ALMA / İPTAL ONAY MODALİ */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-700 space-y-6 animate-scaleUp">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-950/50 rounded-2xl">
                  <CreditCard className="text-purple-700 dark:text-purple-300" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">
                    {confirmModal.type === 'add' ? 'Modül Satın Alma Onayı' : 'Modül İptal Onayı'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {confirmModal.moduleName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {confirmModal.type === 'add' ? (
              <div className="space-y-4">
                <div className="bg-purple-50/60 dark:bg-purple-950/30 p-4 rounded-2xl border border-purple-100 dark:border-purple-900 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                    <span>Modül Adı:</span>
                    <span className="text-purple-900 dark:text-purple-200 font-extrabold">{confirmModal.moduleName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                    <span>Aylık Ekstra Tutarı:</span>
                    <span className="text-purple-900 dark:text-purple-200 font-extrabold">₺{confirmModal.price} / Ay</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300 pt-2 border-t border-purple-100 dark:border-purple-900">
                    <span>Aktivasyon:</span>
                    <span className="text-emerald-600 font-extrabold">⚡ Anında Aktif</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                    <span>Süre:</span>
                    <span className="text-purple-900 dark:text-purple-200 font-extrabold">1 Ay</span>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Onayladığınızda bu modül şirketiniz ve ekibiniz için anında 1 ay boyunca kullanıma açılacaktır. Ekstra ₺{confirmModal.price} ücreti faturanıza eklenecektir. Süre dolduğunda modül otomatik olarak pasifleşir; dilediğiniz zaman tekrar satın alabilirsiniz.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-4 text-xs text-red-800 dark:text-red-300 font-medium leading-relaxed">
                  <strong>{confirmModal.moduleName}</strong> modülünü şimdi kapatmak istediğinize emin misiniz? Devam ederseniz bu modül ve alt sekmelerine erişiminiz hemen sonlanacaktır.
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="flex-1 py-3 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmAction}
                className={`flex-1 py-3 rounded-xl font-bold text-xs text-white shadow-lg transition flex items-center justify-center gap-2 ${
                  confirmModal.type === 'add'
                    ? 'bg-purple-700 hover:bg-purple-800 shadow-purple-500/20'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                } disabled:opacity-50`}
              >
                {saving && <Loader size={14} className="animate-spin" />}
                {confirmModal.type === 'add' ? 'Satın Al' : 'Modülü İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutInfo && currentUser && organizationId && (
        <PaytrCheckoutModal
          purpose="module_purchase"
          purposePayload={{ moduleKey: checkoutInfo.moduleKey, categoryKey: checkoutInfo.categoryKey }}
          amount={checkoutInfo.price}
          itemLabel={checkoutInfo.moduleName}
          organizationId={organizationId}
          userId={currentUser.id}
          userEmail={currentUser.email}
          userFullName={currentUser.fullName}
          userPhone={currentUser.phone}
          onClose={() => setCheckoutInfo(null)}
        />
      )}
    </div>
  );
}
