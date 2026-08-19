export interface SystemCategory {
  key: string;
  name: string;
  isDefault: boolean;
  description: string;
}

export interface SystemModule {
  key: string;
  name: string;
  category: 'operations' | 'compliance' | 'documents' | 'finance' | 'hr';
  categoryName: string;
  isDefault: boolean;
  description: string;
}

export const SYSTEM_MODULE_CATEGORIES: SystemCategory[] = [
  { key: 'operations', name: 'Operasyon & İşletmeler', isDefault: true, description: 'İşletme takibi, saha denetimleri ve atık yönetimi ana modülü' },
  { key: 'compliance', name: 'Yasal Uyum & Takip', isDefault: true, description: 'Mevzuat takibi, talepler, aksiyonlar ve görüşler ana modülü' },
  { key: 'documents', name: 'Dokümantasyon', isDefault: true, description: 'Raporlar, zorunlu belgeler, evrak talepleri ve MSDS ana modülü' },
  { key: 'finance', name: 'Finans & Maliyet', isDefault: true, description: 'Gelir, ödeme, faturalandırma ve gider takibi ana modülü' },
  { key: 'hr', name: 'İnsan Kaynakları & Yönetim', isDefault: true, description: 'Ekip yönetimi, şemalar, performans ve ayrılanlar ana modülü' },
];

export const SYSTEM_MODULES: SystemModule[] = [
  // 1. Operasyon & İşletmeler (category: 'operations')
  { key: 'clients', name: 'Hizmet Verilen İşletmeler', category: 'operations', categoryName: 'Operasyon & İşletmeler', isDefault: true, description: 'Aktif müşteri ve tesis listesi' },
  { key: 'terminated_clients', name: 'Hizmeti Sonlandırılan Firmalar', category: 'operations', categoryName: 'Operasyon & İşletmeler', isDefault: true, description: 'Pasif/eski işletme kayıtları' },
  { key: 'inspections', name: 'Saha QR Denetimleri', category: 'operations', categoryName: 'Operasyon & İşletmeler', isDefault: false, description: 'Tesis içi QR kodlu denetim formları (Ekstra Modül)' },
  { key: 'waste', name: 'Atık Yönetimi', category: 'operations', categoryName: 'Operasyon & İşletmeler', isDefault: false, description: 'Tehlikeli ve evsel atık takip kayıtları (Ekstra Modül)' },

  // 2. Yasal Uyum & Takip (category: 'compliance')
  { key: 'legislations', name: 'Mevzuat Takip', category: 'compliance', categoryName: 'Yasal Uyum & Takip', isDefault: true, description: 'Yasal mevzuat ve standart takibi' },
  { key: 'requests', name: 'Mevzuat Talepleri', category: 'compliance', categoryName: 'Yasal Uyum & Takip', isDefault: true, description: 'Şirketler arası mevzuat talepleri' },
  { key: 'actions', name: 'Aksiyon Takip', category: 'compliance', categoryName: 'Yasal Uyum & Takip', isDefault: true, description: 'Mevzuat ve denetim aksiyon yönetimi' },
  { key: 'opinions', name: 'Görüşler', category: 'compliance', categoryName: 'Yasal Uyum & Takip', isDefault: false, description: 'Firma görüş taslakları ve resmi yazışmalar (Ekstra Modül)' },

  // 3. Dokümantasyon (category: 'documents')
  { key: 'reports', name: 'Aylık & Yıllık Raporlar', category: 'documents', categoryName: 'Dokümantasyon', isDefault: true, description: 'Danışmanlık faaliyet raporları' },
  { key: 'document_matrix', name: 'Zorunlu Belge Matrisi', category: 'documents', categoryName: 'Dokümantasyon', isDefault: true, description: 'Mevzuat zorunlu evrak şablon matrisi' },
  { key: 'document_requests', name: 'Evrak Talepleri', category: 'documents', categoryName: 'Dokümantasyon', isDefault: true, description: 'Müşteri evrak talep yönetimi' },
  { key: 'msds', name: 'MSDS/SDS Takibi', category: 'documents', categoryName: 'Dokümantasyon', isDefault: false, description: 'Malzeme Güvenlik Bilgi Formları (Ekstra Modül)' },
  { key: 'definitions', name: 'Belge & Şablon Tanımları', category: 'documents', categoryName: 'Dokümantasyon', isDefault: true, description: 'Kullanıcı tanımlı evrak şablonları' },

  // 4. Finans & Maliyet (category: 'finance')
  // NOT: modül anahtarı bilerek kategori anahtarından ('finance') farklı
  // tutuluyor ('finance_management') — aynı olsaydı admin panelindeki
  // varsayılan-modül listesi (düz string dizisi) modülü kapatınca kategoriyi
  // de kapatıyordu (ikisi de aynı 'finance' string'ini paylaştığı için).
  { key: 'finance_management', name: 'Finans & Gider Yönetimi', category: 'finance', categoryName: 'Finans & Maliyet', isDefault: false, description: 'Gelir, ödeme, fatura ve gider takibi (Ekstra Modül)' },

  // 5. İnsan Kaynakları & Yönetim (category: 'hr')
  { key: 'team', name: 'Ekip Yönetimi', category: 'hr', categoryName: 'İnsan Kaynakları & Yönetim', isDefault: true, description: 'Personel yetkileri ve kullanıcı hesapları' },
  { key: 'org_chart', name: 'Organizasyon Şeması', category: 'hr', categoryName: 'İnsan Kaynakları & Yönetim', isDefault: true, description: 'Hiyerarşik şirket şeması' },
  { key: 'evaluations', name: 'Çalışan Değerlendirmeleri', category: 'hr', categoryName: 'İnsan Kaynakları & Yönetim', isDefault: false, description: 'Personel performans değerlendirmeleri (Ekstra Modül)' },
  { key: 'departed', name: 'Ayrılan Personeller', category: 'hr', categoryName: 'İnsan Kaynakları & Yönetim', isDefault: true, description: 'İşten ayrılan personel kayıtları' },
];

export const DEFAULT_CATEGORY_KEYS = SYSTEM_MODULE_CATEGORIES.filter(c => c.isDefault).map(c => c.key);
export const DEFAULT_MODULE_KEYS = [
  ...DEFAULT_CATEGORY_KEYS,
  ...SYSTEM_MODULES.filter(m => m.isDefault).map(m => m.key)
];

export function isCategoryEnabled(
  categoryKey: string,
  enabledModules?: string[] | null,
  role?: string
): boolean {
  if (role === 'admin' || role === 'system_admin') return true;

  if (!enabledModules || !Array.isArray(enabledModules) || enabledModules.length === 0) {
    return DEFAULT_CATEGORY_KEYS.includes(categoryKey);
  }

  if (enabledModules.includes(categoryKey)) return true;

  // Legacy fallback for old subkeys
  if (categoryKey === 'compliance' && (enabledModules.includes('compliance') || enabledModules.includes('legislations') || enabledModules.includes('requests') || enabledModules.includes('actions'))) return true;
  if (categoryKey === 'operations' && (enabledModules.includes('operations') || enabledModules.includes('clients') || enabledModules.includes('waste') || enabledModules.includes('inspections'))) return true;
  if (categoryKey === 'documents' && (enabledModules.includes('documents') || enabledModules.includes('reports') || enabledModules.includes('document_matrix') || enabledModules.includes('msds'))) return true;
  if (categoryKey === 'hr' && (enabledModules.includes('hr') || enabledModules.includes('team') || enabledModules.includes('org_chart'))) return true;
  if (categoryKey === 'finance' && (enabledModules.includes('finance') || enabledModules.includes('finance_summary') || enabledModules.includes('finance_payments') || enabledModules.includes('finance_expenses'))) return true;

  // Detect old DB array format (e.g. ['compliance', 'actions', 'team', 'waste', 'msds'])
  const isOldFormat = enabledModules.every(k => ['compliance', 'actions', 'team', 'waste', 'msds'].includes(k));
  if (isOldFormat) {
    return DEFAULT_CATEGORY_KEYS.includes(categoryKey);
  }

  return false;
}

export function isModuleEnabled(
  moduleKey: string,
  enabledModules?: string[] | null,
  role?: string,
  categoryKey?: string
): boolean {
  if (role === 'admin' || role === 'system_admin') return true;

  if (categoryKey && !isCategoryEnabled(categoryKey, enabledModules, role)) {
    return false;
  }

  if (!enabledModules || !Array.isArray(enabledModules) || enabledModules.length === 0) {
    return DEFAULT_MODULE_KEYS.includes(moduleKey);
  }

  if (enabledModules.includes(moduleKey)) return true;

  // Old DB format detection
  const isOldFormat = enabledModules.every(k => ['compliance', 'actions', 'team', 'waste', 'msds'].includes(k));
  if (isOldFormat) {
    if (moduleKey === 'legislations' || moduleKey === 'requests') return enabledModules.includes('compliance');
    if (moduleKey === 'actions') return enabledModules.includes('actions');
    if (moduleKey === 'team') return enabledModules.includes('team');
    if (moduleKey === 'waste') return enabledModules.includes('waste');
    if (moduleKey === 'msds') return enabledModules.includes('msds');

    return DEFAULT_MODULE_KEYS.includes(moduleKey);
  }

  return false;
}

export interface ExtraModulePricing {
  [key: string]: {
    price: number;
    period: 'monthly' | 'yearly';
  };
}

export const DEFAULT_EXTRA_MODULE_PRICING: ExtraModulePricing = {
  inspections: { price: 150, period: 'monthly' },
  waste: { price: 100, period: 'monthly' },
  msds: { price: 75, period: 'monthly' },
  opinions: { price: 100, period: 'monthly' },
  finance_management: { price: 200, period: 'monthly' },
  evaluations: { price: 75, period: 'monthly' },
};
