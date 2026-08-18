import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  SYSTEM_MODULES,
  SYSTEM_MODULE_CATEGORIES,
  DEFAULT_EXTRA_MODULE_PRICING,
  isModuleEnabled,
} from './moduleRegistry';
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
} from 'lucide-react';

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
      case 'finance':
        return <PieChart size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case 'evaluations':
        return <Star size={24} className="text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Zap size={24} className="text-purple-600" />;
    }
  };

  // Sadece Ekstra / Opsiyonel Modüller
  const extraModules = SYSTEM_MODULES.filter((m) => !m.isDefault);

  // Satın Alma İşlemini Onayla
  const handleConfirmAction = async () => {
    if (!organizationId || !confirmModal.moduleKey) return;
    setSaving(true);
    try {
      let updatedList = [...enabledModules];

      if (confirmModal.type === 'add') {
        // Hem kategori key hem de modül key eklensin
        if (!updatedList.includes(confirmModal.categoryKey)) {
          updatedList.push(confirmModal.categoryKey);
        }
        if (!updatedList.includes(confirmModal.moduleKey)) {
          updatedList.push(confirmModal.moduleKey);
        }
      } else {
        // Modül key çıkarılsın
        updatedList = updatedList.filter((k) => k !== confirmModal.moduleKey);
      }

      // 1. Veritabanını Güncelle (organizations.enabled_modules)
      const { error: updateErr } = await supabase
        .from('organizations')
        .update({ enabled_modules: updatedList })
        .eq('id', organizationId);

      if (updateErr) throw updateErr;

      // 2. Güvenli Ödeme Log Kaydı (subscription_payments)
      if (confirmModal.type === 'add') {
        try {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from('subscription_payments').insert({
            organization_id: organizationId,
            user_id: userData?.user?.id || null,
            amount: confirmModal.price,
            plan_type: 'extra_module',
          });
        } catch (logErr) {
          console.warn('Abonelik ödeme log kaydı uyarısı:', logErr);
        }
      }

      setEnabledModules(updatedList);
      setConfirmModal({ ...confirmModal, show: false });

      setNotification({
        show: true,
        message:
          confirmModal.type === 'add'
            ? `🎉 ${confirmModal.moduleName} modülü başarıyla paketinize eklendi ve anında aktif edildi!`
            : `ℹ️ ${confirmModal.moduleName} modülü paketinizden çıkarıldı.`,
        type: 'success',
      });

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
                    </div>
                  </div>

                  {/* Buton ve Durum */}
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-3">
                    {isActive ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle size={14} /> Paketinizde Aktif
                        </div>
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
                          Modülü İptal Et / Çıkar
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
        </div>
      )}

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
                    <span>Aktivasyon Süresi:</span>
                    <span className="text-emerald-600 font-extrabold">⚡ Anında Aktif</span>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Onayladığınızda bu modül şirketiniz ve ekibiniz için anında kullanıma açılacaktır. Ekstra ₺{confirmModal.price}/Ay ücreti faturanıza eklenecektir.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-4 text-xs text-red-800 dark:text-red-300 font-medium leading-relaxed">
                  <strong>{confirmModal.moduleName}</strong> modülünü paketinizden çıkarmak istediğinize emin misiniz? Devam ederseniz bu modül ve alt sekmelerine erişiminiz sonlanacaktır.
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
                {confirmModal.type === 'add' ? 'Satın Al ve Aktif Et' : 'Modülü İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
