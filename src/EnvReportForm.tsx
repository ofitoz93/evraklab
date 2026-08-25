import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Save,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  RefreshCw,
  UploadCloud,
  CheckCircle,
  Plus,
  Trash2,
  Eye,
  ImagePlus,
  Loader,
  X,
} from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';

interface Client {
  id: string;
  name: string;
  address: string;
  tax_no: string;
  phone: string;
  permit_stage?: string;
  permit_articles?: string[];
  ced_status?: string;
  ced_articles?: string[];
}

interface RegCategory {
  stage: string;
  code: string;
  title: string;
}

// Çevre İzin ve Lisans Yönetmeliği ile ÇED Yönetmeliği'nin EK-1/EK-2
// başlıkları — ced_project_categories / environmental_permit_categories
// tablolarını oluşturan add_ced_status_and_admin_lists.sql ve
// add_environmental_permit_categories.sql dosyalarındaki resmi liste
// başlıklarıyla birebir aynı tutuluyor.
const PERMIT_STAGE_TITLES: Record<string, string> = {
  ek1: 'Çevre İznine Tabi Faaliyetler/Tesisler Listesi',
  ek2: 'Çevre İzin ve Lisansına Tabi Faaliyetler/Tesisler Listesi',
};
const CED_STAGE_TITLES: Record<string, string> = {
  ek1: 'Çevresel Etki Değerlendirmesi Uygulanacak Projeler Listesi',
  ek2: 'Çevresel Etkileri Ön İnceleme ve Değerlendirmeye Tabi Projeler Listesi',
};
const TURKISH_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Tailwind JIT tam class adını kaynak kodda göremezse (örn. `text-${color}-600`
// gibi bir template literal) o class'ı üretmez. Bu yüzden renkler burada statik
// bir haritadan seçiliyor.
const SECTION_COLOR_CLASSES: Record<string, string> = {
  blue: 'text-blue-600 border-blue-100',
  green: 'text-green-600 border-green-100',
  amber: 'text-amber-600 border-amber-100',
  purple: 'text-purple-600 border-purple-100',
};

// Bir alt-bölümü (B.1, B.2, 6.1 vb.) tutarlı bir kart içine alır. Component
// tanımı BİLEREK modül seviyesinde (EnvReportForm'un dışında) tutuluyor:
// eğer bu component EnvReportForm'un içinde tanımlansaydı her render'da
// (örn. her tuş vuruşunda) yeni bir fonksiyon referansı oluşur, React da
// <Section> etiketini "farklı bir component tipi" sanıp tüm alt ağacı
// unmount/mount ederdi — bu da içindeki text input'ların her karakterde
// focus kaybetmesine (yazarken sürekli tekrar tıklama gerekmesine) sebep olurdu.
const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
    {children}
  </div>
);

type FieldImage = { url: string; width: number };

// Her form alanının altında, isteğe bağlı olarak sürükle-bırak (veya tıkla)
// ile görsel eklenebilen ve köşesinden boyutlandırılabilen küçük bir blok.
// "İş Akım Şeması" gibi görsel/şema gerektiren alanlarda kullanılmak üzere
// TÜM alanlara (renderTextInput üzerinden) eklendi. Modül seviyesinde
// tanımlı olmasının sebebi Section ile aynı: EnvReportForm içinde
// tanımlansaydı her tuş vuruşunda yeniden yaratılıp input focus'unu
// kaybettirirdi.
function FieldImageBlock({
  image,
  uploading,
  readOnly,
  onUpload,
  onResize,
  onRemove,
}: {
  image: FieldImage | null;
  uploading: boolean;
  readOnly: boolean;
  onUpload: (file: File) => void;
  onResize: (width: number) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, startWidth: image?.width || 240 };
  };
  const handleResizePointerMove = (e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st) return;
    const newWidth = Math.max(80, Math.min(720, st.startWidth + (e.clientX - st.startX)));
    onResize(newWidth);
  };
  const handleResizePointerUp = () => {
    dragStateRef.current = null;
  };

  if (!image && readOnly) return null;

  if (image) {
    return (
      <div className="mt-2 relative inline-block group" style={{ width: image.width, maxWidth: '100%' }}>
        <img src={image.url} style={{ width: '100%', height: 'auto', display: 'block' }} className="rounded-lg border border-gray-200 dark:border-slate-700" alt="Eklenen görsel" />
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow"
              title="Görseli Kaldır"
            >
              <X size={12} />
            </button>
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerLeave={handleResizePointerUp}
              className="absolute -right-1.5 -bottom-1.5 w-4 h-4 bg-blue-600 rounded-full border-2 border-white cursor-nwse-resize touch-none"
              title="Sürükleyerek Boyutlandır"
            />
          </>
        )}
      </div>
    );
  }

  if (readOnly) return null;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      onClick={() => fileInputRef.current?.click()}
      className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed text-[11px] font-bold cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 dark:border-slate-700 text-gray-400 hover:border-blue-300 hover:text-blue-500'
        }`}
    >
      {uploading ? <Loader size={13} className="animate-spin" /> : <ImagePlus size={13} />}
      {uploading ? 'Yükleniyor...' : 'Görseli sürükleyip bırakın veya tıklayın'}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onUpload(f);
        }}
      />
    </div>
  );
}

export default function EnvReportForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Evraklar sayfasındaki "Yenile" butonundan ?renewFrom=<env_report_id> ile
  // gelindiyse, önceki raporun işletmesi/türü/doldurulmuş verileri otomatik
  // çekilip forma basılır (bkz. clients yüklendikten sonra çalışan useEffect
  // aşağıda). Kaydet her zaman YENİ bir env_reports satırı INSERT eder (bu
  // bileşende hiç UPDATE yolu yok), bu yüzden eski rapor asla üzerine
  // yazılmaz — sadece handleSave içindeki "Önceki aktif raporları arşivle"
  // bloğu devreye girip eski belgeyi arşive taşır, yeni belge ıslak imzasız
  // olarak en güncel olur.
  const renewFromReportId = searchParams.get('renewFrom');
  const [renewFromApplied, setRenewFromApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Form State
  const [clientId, setClientId] = useState('');
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isManualUpload, setIsManualUpload] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  // Manuel rapor dosyası (PDF/görsel) seçildiğinde direkt yüklemek yerine önce
  // önizleme + kaşe/imza/logo ekleme ekranı açılır.
  const [pendingManualFile, setPendingManualFile] = useState<File | null>(null);

  // Kompleks JSON verisi
  const [formData, setFormData] = useState<any>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  // Sistem formu (adım adım) yolunda, son içerik adımından sonra kaydetmeden
  // önce tüm girilen verilerin salt-okunur bir dökümünü gösteren önizleme ekranı.
  const [previewMode, setPreviewMode] = useState(false);

  const [userMode, setUserMode] = useState<'personal' | 'consultant' | 'loading'>('loading');
  const [noAssignedClients, setNoAssignedClients] = useState(false);
  const [isCorporateExpired, setIsCorporateExpired] = useState(false);

  // A - İŞLETME BİLGİLERİ bölümündeki otomatik alanlar için: seçilen firmanın
  // Çevre İzin / ÇED madde kodlarını okunabilir başlığa çevirmek üzere bir
  // kereye mahsus çekilen referans listeler, ve hizmet veren danışmanlık
  // firmasının ünvanı (organizations.name).
  const [permitCategories, setPermitCategories] = useState<RegCategory[]>([]);
  const [cedCategories, setCedCategories] = useState<RegCategory[]>([]);
  const [consultantOrgName, setConsultantOrgName] = useState('');

  useEffect(() => {
    fetchInitialData();
    supabase.from('environmental_permit_categories').select('stage, code, title').then(({ data }) => {
      if (data) setPermitCategories(data);
    });
    supabase.from('ced_project_categories').select('stage, code, title').then(({ data }) => {
      if (data) setCedCategories(data);
    });
  }, []);

  // clients listesi gelene kadar bekleyip (aksi halde <select> içinde
  // clientId eşleşecek bir <option> henüz yok) kaynak raporu tek seferlik
  // uygular.
  useEffect(() => {
    if (!renewFromReportId || renewFromApplied || userMode !== 'consultant' || clients.length === 0) return;
    setRenewFromApplied(true);
    (async () => {
      const { data: source, error } = await supabase
        .from('env_reports')
        .select('client_id, report_type, is_manual_upload, form_data')
        .eq('id', renewFromReportId)
        .single();
      if (error || !source) {
        console.error('Yenilenecek rapor bulunamadı:', error?.message);
        return;
      }
      setClientId(source.client_id || '');
      setReportType(source.report_type === 'yearly' ? 'yearly' : 'monthly');
      setIsManualUpload(!!source.is_manual_upload);
      if (source.form_data) {
        setFormData(source.form_data);
        if (source.form_data.attachment_urls) setAttachmentUrls(source.form_data.attachment_urls);
      }
    })();
  }, [renewFromReportId, renewFromApplied, userMode, clients]);

  // Seçilen işletme değiştiğinde, bu işletme için daha önce girilmiş "İşletme
  // Yetkilisi" adı var mı diye en son rapora bakar (alan boşsa doldurur, kullanıcı
  // zaten bir şey yazdıysa dokunmaz).
  useEffect(() => {
    if (!clientId || formData.A_yetkili_ad_soyad) return;
    supabase
      .from('env_reports')
      .select('form_data')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const prevName = data?.form_data?.A_yetkili_ad_soyad;
        if (prevName) {
          setFormData((prev: any) => (prev.A_yetkili_ad_soyad ? prev : { ...prev, A_yetkili_ad_soyad: prevName }));
        }
      });
    // formData bilerek dependency'de değil: her alan değişikliğinde değil,
    // sadece işletme değiştiğinde bir kere kontrol edilmesi isteniyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const fetchInitialData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, organization_id, extra_permissions, subscription_end_date')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      setUserProfile(profile);
      const perms = profile.extra_permissions || {};

      if (profile.organization_id) {
        supabase.from('organizations').select('name').eq('id', profile.organization_id).single().then(({ data: orgRow }) => {
          if (orgRow?.name) setConsultantOrgName(orgRow.name);
        });
      }

      // --- MOD TESPİTİ ---
      // Danışmanlık modu: kullanıcının bir şirkete bağlı olması YETERLİ değil,
      // o şirketin çevre danışmanlığı olması gerekiyor.
      // Ek güvence: corporate_* rolü olan ve organization_id'si olan kullanıcılar
      // daima danışmanlık moduna alınır (RLS hatalarına karşı güvenli).

      const isCorporateRole = ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(profile.role);
      const isPremiumIndividual = profile.role === 'premium_individual';
      const hasOrg = !!profile.organization_id;

      let isEnvConsultantOrg = false;
      if (hasOrg && !isCorporateRole && !isPremiumIndividual) {
        // Sadece corporate/bireysel premium dışı roller için org kontrolü yap
        // (corporate roller ve bireysel premium zaten danışman modunda)
        const { data: org } = await supabase
          .from('organizations')
          .select('is_environmental_consultant')
          .eq('id', profile.organization_id)
          .single();
        if (org?.is_environmental_consultant) isEnvConsultantOrg = true;
      }

      // Kurumsal (yönetici/şef/danışman) hesap, şirket abonelik süresi doldu mu?
      if (hasOrg && isCorporateRole && profile.role !== 'admin') {
        const { data: orgSub } = await supabase
          .from('organizations')
          .select('subscription_end_date')
          .eq('id', profile.organization_id)
          .single();
        const expired = !orgSub?.subscription_end_date || new Date(orgSub.subscription_end_date) <= new Date();
        setIsCorporateExpired(expired);
      } else if (isPremiumIndividual) {
        // Bireysel premium hesabın aboneliği kendi profilinde tutulur, kişisel
        // organizasyonun subscription_end_date'i hiç set edilmez.
        const expired = !profile.subscription_end_date || new Date(profile.subscription_end_date) <= new Date();
        setIsCorporateExpired(expired);
      }

      // Admin veya corporate rolle şirkete bağlı veya env danışmanlık üyesi veya
      // bireysel premium (kendi lokasyonları için) → danışman modu.
      const isConsultantMode =
        profile.role === 'admin' ||
        (hasOrg && isCorporateRole) ||
        (hasOrg && isEnvConsultantOrg) ||
        (hasOrg && isPremiumIndividual);

      if (!isConsultantMode) {
        // Normal / bireysel üye → şahsi rapor modu
        setUserMode('personal');
        return;
      }

      // Danışman / Admin modu → hizmet verilen firmaları çek
      setUserMode('consultant');
      let query = supabase.from('consultant_clients').select('*');

      const isRestrictedRole = profile.role === 'corporate_staff' || profile.role === 'corporate_chief';

      if (profile.role !== 'admin' && isRestrictedRole && !perms.can_view_all_clients) {
        // Personel: sadece atandığı firmalar
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', session.user.id);
        const cIds = assignments?.map((a) => a.client_id) || [];
        if (cIds.length > 0) {
          query = query.in('id', cIds);
        } else {
          // Atanmış firma yok
          setNoAssignedClients(true);
          return;
        }
      } else if (profile.role !== 'admin') {
        // Yönetici/Sahip: kendi şirketinin tüm firmaları
        query = query.eq('consultant_company_id', profile.organization_id);
      }
      // Admin: filtre yok (tüm firmalar)

      const { data: clientsData } = await query;
      if (clientsData) setClients(clientsData);
    }
  };

  const handleLoadPrevious = async () => {
    if (!clientId) {
      alert('Lütfen önce bir işletme seçin.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('env_reports')
        .select('form_data')
        .eq('client_id', clientId)
        .eq('report_type', reportType)
        .eq('is_manual_upload', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      if (data?.form_data) {
        setFormData(data.form_data);
        if (data.form_data.attachment_urls) {
          setAttachmentUrls(data.form_data.attachment_urls);
        }
        alert('Önceki veriler başarıyla yüklendi!');
      } else {
        alert('Bu işletme ve rapor türü için önceki bir kayıt bulunamadı.');
      }
    } catch (err: any) {
      if (err.code === 'PGRST116') {
         alert('Bu işletme ve rapor türü için önceki bir kayıt bulunamadı.');
      } else {
         console.error('Veri çekme hatası:', err);
      }
    }
  };

  const handleUpdateField = (path: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev };
      newData[path] = value;
      return newData;
    });
  };

  const uploadToClientAssets = async (file: File, prefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${prefix}_${Math.random()}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('client_assets')
      .upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('client_assets').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isAttachment = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const publicUrl = await uploadToClientAssets(file, isAttachment ? 'attach' : 'report');
      if (isAttachment) {
        setAttachmentUrls(prev => [...prev, publicUrl]);
      } else {
        setFileUrl(publicUrl);
      }
    } catch (err: any) {
      alert('Dosya yüklenirken hata: ' + err.message + '\nLütfen "client_assets" bucket\'ının mevcut olduğundan emin olun.');
    } finally {
      setUploading(false);
    }
  };

  const handleManualFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    setPendingManualFile(f);
  };

  const uploadReportFile = async (file: File) => {
    setUploading(true);
    try {
      const publicUrl = await uploadToClientAssets(file, 'report');
      setFileUrl(publicUrl);
    } catch (err: any) {
      alert('Dosya yüklenirken hata: ' + err.message + '\nLütfen "client_assets" bucket\'ının mevcut olduğundan emin olun.');
    } finally {
      setUploading(false);
    }
  };

  // --- ALAN BAZLI GÖRSEL EKLEME (örn. "İş Akım Şeması") ---
  // Her formData alanının yanında, o alana özel sürükle-bırak ile eklenip
  // boyutlandırılabilen bir görsel tutulabilir. Görsel bilgisi formData
  // içinde `${fieldKey}__img` anahtarıyla saklanır; böylece raporun geri
  // kalanıyla birlikte otomatik olarak kaydedilir/yüklenir, ayrı bir
  // sütun/tablo gerekmez.
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);

  const getFieldImage = (fieldKey: string): FieldImage | null => formData[`${fieldKey}__img`] || null;

  const setFieldImage = (fieldKey: string, img: FieldImage | null) => {
    setFormData((prev: any) => {
      const next = { ...prev };
      if (img) next[`${fieldKey}__img`] = img;
      else delete next[`${fieldKey}__img`];
      return next;
    });
  };

  const handleFieldImageUpload = async (fieldKey: string, file: File) => {
    setUploadingFieldKey(fieldKey);
    try {
      const url = await uploadToClientAssets(file, `field_${fieldKey}`);
      const probe = new Image();
      probe.onload = () => {
        const width = Math.min(320, probe.width || 320);
        setFieldImage(fieldKey, { url, width });
      };
      probe.onerror = () => setFieldImage(fieldKey, { url, width: 240 });
      probe.src = url;
    } catch (err: any) {
      alert('Görsel yüklenirken hata: ' + err.message + '\nLütfen "client_assets" bucket\'ının mevcut olduğundan emin olun.');
    } finally {
      setUploadingFieldKey(null);
    }
  };

  const handleSave = async () => {
    if (isCorporateExpired) {
      alert('Şirketinizin premium süresi doldu. Yeni rapor oluşturmak için lütfen paketinizi yenileyin.');
      return;
    }
    const isPersonal = userMode === 'personal';
    if (!isPersonal && !clientId) {
      alert('Lütfen bir işletme seçin!');
      return;
    }
    setLoading(true);
    try {
      // Geçerlilik tarihi hesapla
      const dateObj = new Date(reportDate);
      if (reportType === 'monthly') {
        dateObj.setMonth(dateObj.getMonth() + 1);
      } else {
        dateObj.setFullYear(dateObj.getFullYear() + 1);
      }
      const expiresAt = dateObj.toISOString().split('T')[0];

      // Form verisine ekleri de koyalım
      const finalFormData = { ...formData, attachment_urls: attachmentUrls };

      let reportId: string | null = null;

      if (!isPersonal) {
        // Danışman modu: env_reports tablosuna kaydet
        const { data, error } = await supabase.from('env_reports').insert([
          {
            client_id: clientId,
            consultant_company_id: userProfile?.organization_id,
            creator_id: userProfile?.id,
            report_type: reportType,
            report_date: reportDate,
            expires_at: expiresAt,
            is_manual_upload: isManualUpload,
            file_url: fileUrl,
            form_data: finalFormData,
            status: 'completed',
          },
        ]).select('id').single();

        if (error) throw error;
        reportId = data.id;
      }

      // --- Otomatik Olarak Evraklar Sayfasına Ekle ---
      try {
        const client = clients.find(c => c.id === clientId);
        const clientName = isPersonal ? 'Şahsi Rapor' : (client ? client.name : 'Bilinmeyen Firma');
        
        // 1. Kullanıcı veya şirket kullanıcılarını çek (tanımları ortak havuzdan aramak için)
        let orgUserIds = [userProfile.id];
        if (userProfile.organization_id) {
          const { data: orgProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('organization_id', userProfile.organization_id);
          if (orgProfiles && orgProfiles.length > 0) {
            orgUserIds = orgProfiles.map(p => p.id);
          }
        }

        // 2. Belge Türü (Aylık Faaliyet Raporu / Yıllık İç Tetkik Raporu) bul veya oluştur
        const typeLabel = reportType === 'monthly' ? 'Aylık Faaliyet Raporu' : 'Yıllık İç Tetkik Raporu';
        let typeDefId = null;

        let typeQuery = supabase.from('user_definitions')
          .select('id')
          .eq('category', 'doc_type')
          .ilike('label', typeLabel);

        if (!isPersonal && userProfile.organization_id) {
          typeQuery = typeQuery.eq('organization_id', userProfile.organization_id);
        } else {
          typeQuery = typeQuery.eq('user_id', userProfile.id).is('organization_id', null);
        }
        
        const { data: existingType } = await typeQuery.maybeSingle();

        if (existingType) {
          typeDefId = existingType.id;
        } else {
          const { data: newType } = await supabase
            .from('user_definitions')
            .insert([{ 
              user_id: userProfile.id, 
              category: 'doc_type', 
              label: typeLabel,
              organization_id: !isPersonal ? userProfile.organization_id : null
            }])
            .select('id')
            .single();
          if (newType) typeDefId = newType.id;
        }

        // 3. Lokasyon bul veya oluştur (şahsi raporda lokasyon yok)
        let locationDefId = null;
        if (!isPersonal) {
          let locQuery = supabase.from('user_definitions')
            .select('id')
            .eq('category', 'location')
            .ilike('label', clientName);

          if (userProfile.organization_id) {
            locQuery = locQuery.eq('organization_id', userProfile.organization_id);
          } else {
            locQuery = locQuery.eq('user_id', userProfile.id).is('organization_id', null);
          }
          
          const { data: existingLoc } = await locQuery.maybeSingle();

          if (existingLoc) {
            locationDefId = existingLoc.id;
          } else {
            const { data: newLoc } = await supabase
              .from('user_definitions')
              .insert([{ 
                user_id: userProfile.id, 
                category: 'location', 
                label: clientName,
                organization_id: userProfile.organization_id || null
              }])
              .select('id')
              .single();
            if (newLoc) locationDefId = newLoc.id;
          }
        }

        // Önceki aktif raporları arşivle (Tür ve Lokasyon bazlı)
        if (typeDefId) {
          let archQuery = supabase
            .from('documents')
            .update({ is_archived: true })
            .eq('type_def_id', typeDefId)
            .eq('is_archived', false);
            
          if (locationDefId) {
            archQuery = archQuery.eq('location_def_id', locationDefId);
          } else {
            archQuery = archQuery.is('location_def_id', null);
          }
          
          if (isPersonal) {
            archQuery = archQuery.eq('uploader_id', userProfile.id);
          } else if (userProfile.organization_id) {
            archQuery = archQuery.eq('organization_id', userProfile.organization_id);
          }
          
          await archQuery;
        }

        // 4. Belgeyi ekle
        const docTitle = isPersonal
          ? (reportType === 'monthly'
              ? `Şahsi Aylık Faaliyet Raporu - ${reportDate}`
              : `Şahsi Yıllık İç Tetkik Raporu - ${reportDate}`)
          : (reportType === 'monthly'
              ? `${clientName} Aylık Faaliyet Raporu - ${reportDate}`
              : `${clientName} Yıllık İç Tetkik Raporu - ${reportDate}`);

        await supabase.from('documents').insert([
          {
            organization_id: isPersonal ? null : userProfile.organization_id,
            uploader_id: userProfile.id,
            title: docTitle,
            description: isPersonal
              ? `Şahsi ${reportType === 'monthly' ? 'aylık faaliyet' : 'yıllık iç tetkik'} raporudur.`
              : `${clientName} firması için hazırlanan ${reportType === 'monthly' ? 'aylık faaliyet' : 'yıllık iç tetkik'} raporudur.`,
            type_def_id: typeDefId,
            location_def_id: locationDefId,
            acquisition_date: reportDate,
            expiry_date: expiresAt,
            application_deadline: expiresAt,
            is_indefinite: false,
            reminder_days: 30,
            reminder_based_on: 'expiry',
            is_archived: false,
            file_url: fileUrl || null,
            file_type: fileUrl ? fileUrl.split('.').pop() : null,
            file_size: 0,
            env_report_id: reportId || null,  // Rapor bağlantısı (görüntüleme için)
          }
        ]);
      } catch (docErr) {
        console.error('Evrak tablosuna kopyalama başarısız oldu:', docErr);
      }

      alert('Rapor başarıyla kaydedildi!');
      if (reportId) {
        navigate(`/consultant/reports/${reportId}`);
      } else {
        navigate('/documents');
      }
    } catch (err: any) {
      alert('Kaydetme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----- RENDER YARDIMCILARI -----
  const renderTextInput = (label: string, fieldKey: string, placeholder: string = '', isTextArea = false, note: string = '', noImage = false) => {
    const value = formData[fieldKey] || '';
    const fieldImage = noImage ? null : getFieldImage(fieldKey);
    const imageBlock = noImage ? null : (
      <FieldImageBlock
        image={fieldImage}
        uploading={uploadingFieldKey === fieldKey}
        readOnly={previewMode}
        onUpload={(file) => handleFieldImageUpload(fieldKey, file)}
        onResize={(width) => setFieldImage(fieldKey, { url: fieldImage!.url, width })}
        onRemove={() => setFieldImage(fieldKey, null)}
      />
    );

    // Önizleme ekranında alanlar düzenlenemez, sadece girilen değer (ve varsa eklenen görsel) gösterilir.
    if (previewMode) {
      return (
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            {label}
          </label>
          <div className={`w-full p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-sm whitespace-pre-wrap ${value ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 italic'}`}>
            {value || 'Boş bırakıldı'}
          </div>
          {imageBlock}
        </div>
      );
    }

    return (
      <div>
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          {label}
        </label>
        {isTextArea ? (
          <textarea
            value={value}
            onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
            placeholder={placeholder}
            className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 min-h-[100px] outline-none focus:ring-1 focus:ring-blue-500 text-sm text-gray-700 dark:text-gray-300 resize-y"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
            placeholder={placeholder}
            className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300"
          />
        )}
        {imageBlock}
        {note && <p className="text-[10px] text-gray-400 mt-1 leading-tight italic">{note}</p>}
      </div>
    );
  };

  const renderSectionHeader = (title: string, color: string = 'blue') => (
    <h4 className={`font-bold text-base ${SECTION_COLOR_CLASSES[color] || SECTION_COLOR_CLASSES.blue} mb-3`}>{title}</h4>
  );

  // Sistem tarafından otomatik doldurulan, kullanıcının elle değiştiremediği
  // bir alanı gösterir (örn. seçilen işletmenin ünvanı/adresi, danışmanlık
  // firması, sorumlu mühendis). Görsel ekleme desteklenmez.
  const renderReadOnlyField = (label: string, value: string, note: string = '') => (
    <div>
      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className={`w-full p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-sm font-semibold whitespace-pre-wrap ${value ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 italic font-normal'}`}>
        {value || 'Otomatik doldurulacak'}
      </div>
      {note && <p className="text-[10px] text-gray-400 mt-1 leading-tight italic">{note}</p>}
    </div>
  );

  const renderDateInput = (label: string, fieldKey: string) => {
    const value = formData[fieldKey] || '';
    if (previewMode) {
      return renderReadOnlyField(label, value ? new Date(value).toLocaleDateString('tr-TR') : '');
    }
    return (
      <div>
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          {label}
        </label>
        <input
          type="date"
          value={value}
          onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
          className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300"
        />
      </div>
    );
  };

  // "Faturaya ait Hizmet Verilen Ay" — mevcut yıl ± 1 yıl aralığında Ay/Yıl seçimi.
  const renderMonthSelect = (label: string, fieldKey: string) => {
    const value = formData[fieldKey] || '';
    if (previewMode) return renderReadOnlyField(label, value);
    const currentYear = new Date().getFullYear();
    const options: string[] = [];
    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      for (const m of TURKISH_MONTHS) options.push(`${m} ${y}`);
    }
    return (
      <div>
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          {label}
        </label>
        <select
          value={value}
          onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
          className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300"
        >
          <option value="">Seçiniz...</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  };

  // Sadece rakam girilen sayaç alanları (personel sayıları vb.) için. Görsel
  // eklenemez; her zaman noImage mantığıyla renderTextInput'un dışında tutulur.
  const renderNumberInput = (label: string, fieldKey: string) => {
    const value = formData[fieldKey] ?? '';
    if (previewMode) return renderReadOnlyField(label, value !== '' ? String(value) : '');
    return (
      <div>
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
          {label}
        </label>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
          className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300"
        />
      </div>
    );
  };

  // Yıllık raporun "Personel Sayıları" bloğunda İdari/Mühendis/Teknisyen/Usta/İşçi
  // sayaçlarının toplamını otomatik hesaplar; hiçbiri doldurulmamışsa boş döner.
  const PERSONNEL_COUNT_KEYS = ['Y1_p_idari', 'Y1_p_muh', 'Y1_p_tek', 'Y1_p_usta', 'Y1_p_isci'];
  const computePersonnelTotal = (): string => {
    const anyFilled = PERSONNEL_COUNT_KEYS.some((k) => formData[k] !== undefined && formData[k] !== '');
    if (!anyFilled) return '';
    const sum = PERSONNEL_COUNT_KEYS.reduce((acc, k) => acc + (Number(formData[k]) || 0), 0);
    return String(sum);
  };

  const getSelectedClient = () => clients.find((c) => c.id === clientId);

  // Seçilen işletmenin consultant_clients.permit_stage / permit_articles
  // kolonlarından "Çevre İzin ve Lisans Yönetmeliği Kapsamındaki Yeri" metnini
  // otomatik üretir (bkz. add_permit_stage_to_clients.sql, ConsultantPanel'deki
  // aynı alanın düzenlendiği yer).
  const buildPermitScopeText = (client?: Client) => {
    if (!client) return '';
    const stage = client.permit_stage || 'out_of_scope';
    if (stage === 'out_of_scope') return 'Çevre İzin ve Lisans Yönetmeliği kapsamı dışındadır.';
    const stageLabel = stage === 'ek1' ? 'Ek-1' : 'Ek-2';
    const stageTitle = PERMIT_STAGE_TITLES[stage] || '';
    const codes = Array.isArray(client.permit_articles) ? client.permit_articles : [];
    if (codes.length === 0) return `${stageLabel} - ${stageTitle}`;
    const lines = codes.map((code) => {
      const cat = permitCategories.find((c) => c.stage === stage && c.code === code);
      return cat ? `${code} ${cat.title} maddesi` : `${code} maddesi`;
    });
    return `${stageLabel} - ${stageTitle}\n${lines.join('\n')}`;
  };

  // Aynı mantık, ÇED Yönetmeliği (consultant_clients.ced_status / ced_articles) için.
  const buildCedScopeText = (client?: Client) => {
    if (!client) return '';
    const stage = client.ced_status || 'out_of_scope';
    if (stage === 'out_of_scope') return 'ÇED Yönetmeliği kapsamı dışındadır.';
    const stageLabel = stage === 'ek1' ? 'Ek-1' : 'Ek-2';
    const stageTitle = CED_STAGE_TITLES[stage] || '';
    const codes = Array.isArray(client.ced_articles) ? client.ced_articles : [];
    if (codes.length === 0) return `${stageLabel} - ${stageTitle}`;
    const lines = codes.map((code) => {
      const cat = cedCategories.find((c) => c.stage === stage && c.code === code);
      return cat ? `${code} ${cat.title} maddesi` : `${code} maddesi`;
    });
    return `${stageLabel} - ${stageTitle}\n${lines.join('\n')}`;
  };

  // renderReadOnlyField ile A bölümünde (aylık) ve 3/4. bölümlerde (yıllık)
  // gösterilen ÇED / Çevre İzin metinleri sadece render sırasında
  // hesaplanıyordu; formData'ya hiç yazılmadıkları için kayıt/çıktıda
  // (EnvReportView) boş görünüyorlardı. Bu effect, seçilen işletme (veya
  // referans listeler) değiştiğinde hesaplanan metinleri formData'ya da
  // yazarak kaydedilmelerini sağlar.
  useEffect(() => {
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient) return;
    const permitText = buildPermitScopeText(selectedClient);
    const cedText = buildCedScopeText(selectedClient);

    const permitStage = selectedClient.permit_stage || 'out_of_scope';
    const permitStageLabel = permitStage === 'ek1' ? 'Ek-1' : permitStage === 'ek2' ? 'Ek-2' : 'Kapsam Dışı';
    const permitCodes = Array.isArray(selectedClient.permit_articles) ? selectedClient.permit_articles : [];
    const permitTitles = permitCodes.map((code) => permitCategories.find((c) => c.stage === permitStage && c.code === code)?.title || '');

    setFormData((prev: any) => {
      const next = { ...prev };
      let changed = false;
      const setIfChanged = (key: string, val: string) => {
        if (next[key] !== val) { next[key] = val; changed = true; }
      };
      setIfChanged('A_cevre_izin_yeri', permitText);
      setIfChanged('A_ced_durumu', cedText);
      setIfChanged('Y3_ced_oto', cedText);
      setIfChanged('Y4_ek_liste', permitStageLabel);
      setIfChanged('Y4_bolum_no', permitCodes.join(', '));
      setIfChanged('Y4_faaliyet_adi', permitTitles.join(', '));
      return changed ? next : prev;
    });
    // buildPermitScopeText/buildCedScopeText her render'da yeniden oluşan
    // fonksiyonlar; deps'e eklemek gereksiz yere sonsuz effect döngüsüne yol açar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clients, permitCategories, cedCategories]);

  // Personel Sayıları: İdari/Mühendis/Teknisyen/Usta/İşçi değiştikçe Toplam'ı
  // otomatik hesaplayıp formData'ya yazar (bkz. computePersonnelTotal).
  useEffect(() => {
    const total = computePersonnelTotal();
    setFormData((prev: any) => (prev.Y1_p_toplam === total ? prev : { ...prev, Y1_p_toplam: total }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.Y1_p_idari, formData.Y1_p_muh, formData.Y1_p_tek, formData.Y1_p_usta, formData.Y1_p_isci]);

  const renderAttachments = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {attachmentUrls.map((url, idx) => (
          <div key={idx} className="relative group w-24 h-24 border rounded-lg overflow-hidden bg-gray-50">
            <img src={url} alt="Ek" className="w-full h-full object-cover" />
            <button
              onClick={() => setAttachmentUrls(prev => prev.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 cursor-pointer transition">
          {uploading ? <RefreshCw size={20} className="animate-spin" /> : <Plus size={20} />}
          <span className="text-[10px] font-bold mt-1">{uploading ? 'Yükleniyor' : 'Dosya Ekle'}</span>
          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, true)} disabled={uploading} />
        </label>
      </div>
      <p className="text-[10px] text-gray-400 italic">Fotoğraf, analiz raporu veya MOTAT ekran görüntülerini ekleyebilirsiniz.</p>
    </div>
  );

  // --- AYLIK RAPOR ADIMLARI ---
  const renderMonthlyStep2 = () => {
    const selectedClient = getSelectedClient();
    return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">A - İŞLETME BİLGİLERİ</h3>
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderReadOnlyField('Ünvanı', selectedClient?.name || '')}
          {renderReadOnlyField('Adresi', selectedClient?.address || '')}
        </div>

        {renderTextInput('Faaliyet Konusu', 'A_faaliyet_konusu', '', false, '', true)}

        {renderReadOnlyField(
          'Çevre İzin ve Lisans Yönetmeliği Kapsamındaki Yeri',
          buildPermitScopeText(selectedClient),
          'İşletmenin Çevre İzin ve Lisans Yönetmeliği kapsamı, "Hizmet Verilen İşletmeler" tanımından otomatik çekilir.'
        )}

        <div className="space-y-2">
          {renderReadOnlyField('ÇED Yönetmeliği Kapsamındaki Değerlendirmesi', buildCedScopeText(selectedClient))}
          {renderTextInput(
            'ÇED İle İlgili Resmi Yazılar / Notlar',
            'A_ced_notlar',
            'Örn: 10.01.2025 tarihli ÇED kapsam dışı yazısı alınmıştır.',
            true,
            'Bakanlık merkez veya il müdürlüklerinden alınmış resmi belgeler; alındıkları mercii, tarih, sayı ve konusu ile birlikte yazılmalıdır.',
            true
          )}
        </div>

        {renderTextInput('Çalışan Personel Sayısı', 'A_personel_sayisi', 'Örn: Taşeron: 500  Kadro: 200', false, '', true)}
        {renderTextInput('İşletme Yetkilisi', 'A_yetkili_ad_soyad', '', false, '', true)}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderReadOnlyField('Hizmet Alınan Çevre Danışmanlık Firması', consultantOrgName)}
          {renderReadOnlyField('Sorumlu Çevre Mühendisi / Yetkilendirilmiş Kişi', userProfile?.full_name || '')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderDateInput('Son Ay Yapılan Ziyarete Ait Fatura Tarihi', 'A_fatura_tarihi')}
          {renderTextInput('Fatura Numarası', 'A_fatura_no', '', false, '', true)}
        </div>

        {renderMonthSelect('Faturaya ait Hizmet Verilen Ay', 'A_fatura_ayi')}
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">B - FAALİYETİN ÇEVRESEL ETKİLERİ VE ALINAN/ALINACAK ÖNLEMLER</h3>
      <Section>
        {renderSectionHeader('B.1 - SU VE ATIKSU YÖNETİMİ')}
        <div className="space-y-4">
          {renderTextInput('B.1.1 SU TÜKETİMİ', 'B11_su_tuketimi', '', true, 'Rapor dönemi içinde su tüketim miktarı (kaynak bilgisiyle birlikte) hakkında bilgi verilmelidir.')}
          {renderTextInput('B.1.2 EVSEL ATIKSU', 'B12_evsel_atiksu', '', true, 'Rapor dönemi içinde işletmede oluşan evsel atıksuların miktarı, kaynakları, kirlilik yükleri ve bertarafları hakkında bilgi verilmelidir.')}
          {renderTextInput('B.1.3 ENDÜSTRİYEL ATIKSU', 'B13_end_atiksu', '', true, 'Rapor dönemi içinde işletmede oluşan endüstriyel atıksuların miktarı, kaynakları, kirlilik yükleri ve bertarafları hakkında bilgi verilmelidir.')}
          {renderTextInput('B.1.4 DİĞER ATIKSULAR', 'B14_diger_atiksu', '', true, 'Rapor dönemi içinde soğutma suyu, blöf suyu vb. miktarı, kaynakları, bertarafları hakkında bilgi verilmelidir.')}
          {renderTextInput('B.1.5 ATIKSU ARITMA TESİSİ HAKKINDA BİLGİ', 'B15_aritma_tesisi', '', true, 'Rapor dönemi içinde deşarj edilen su miktarı, SKKY tablosu, var ise sürekli ölçüm sonuçlarına ilişkin değerlendirme, arıtma çamurunun türü (tehlikeli/tehlikesiz), miktarı ve bertaraf yöntemi hakkında bilgi verilmelidir.')}
          {renderTextInput('B.1.6 İÇ İZLEME', 'B16_ic_izleme', '', true, 'Her bir atıksu kaynağının Çevre İzin koşullarında da yer alan iç izleme numune alma periyotları belirtilerek numune alma tarihleri ve analiz sonuçları tablo halinde sunulmalıdır.')}
          {renderTextInput('B.1.7 YERALTI SUYU İZLEME', 'B17_yeralti_suyu', '', true, 'Rapor dönemi içinde numune alınan yeraltı suyu gözlem kuyusu bilgisi, numune alma tarihi ve ölçüm sonuçları hakkında bilgi verilmelidir.')}
          {renderTextInput('B.1.8 DENİZ SUYU KALİTESİ', 'B18_deniz_suyu', '', true, 'Rapor dönemi içinde deniz suyundan numune alınan nokta bilgisi, numune alma tarihi ve ölçüm sonuçları hakkında bilgi verilmelidir.')}
        </div>
      </Section>
    </div>
    );
  };

  const renderMonthlyStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <Section>
        {renderSectionHeader('B.2 - HAVA YÖNETİMİ')}
        <div className="space-y-4">
          {renderTextInput('B.2.1 TEYİT ÖLÇÜMÜ', 'B21_teyit_olcumu', '', true, 'Çevre İznine esas emisyon ölçüm rapor tarihi ve bunu izleyen sonraki teyit ölçüm rapor tarihleri belirtilmelidir.')}
          {renderTextInput('B.2.2 SÜREKLİ EMİSYON ÖLÇÜMÜ', 'B22_surekli_emisyon', '', true, 'İşletme, Sürekli Emisyon Ölçüm Sistemleri Tebliği kapsamında ise rapor döneminde yapılan KGS3 testler değerlendirilmeli.')}

          <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700 p-4 space-y-4">
            <h5 className="font-bold text-sm text-gray-700 dark:text-gray-300">B.2.3 İÇ İZLEME AMACIYLA YAPILAN ÖLÇÜMLER</h5>
            {renderTextInput('HAVA KALİTESİ ÖLÇÜMLERİ', 'B231_hava_kalitesi', '', true, 'İşletmede hava kalitesi ölçüm istasyonu var ise, kalibrasyon bilgisi ve verilerin yönetmeliğe göre değerlendirilmesi.')}
            {renderTextInput('BACA GAZI ÖLÇÜMLERİ', 'B232_baca_gazi', '', true, 'Rapor dönemi içerisinde gerçekleştirilen baca gazı ölçümlerine ilişkin değerlendirme yapılmalıdır.')}
          </div>

          {renderTextInput('B.2.4 KONTROLSÜZ EMİSYON KAYNAKLARI', 'B24_kontrolsuz_emisyon', '', true, 'Tesiste oluşan kontrolsüz emisyonlar ile bu emisyonların giderilmesi için alınacak önlemler.')}
        </div>
      </Section>

      <Section>
        {renderSectionHeader('B.3 - ATIK YÖNETİMİ')}
        <div className="space-y-4">
          {renderTextInput('B.3.1 GENEL ATIKLAR', 'B31_genel_atiklar', '', true, 'Evsel, ambalaj vb. atıklar, Atık Yönetimi Yönetmeliği göre atık kodları, kaynakları, miktarları.')}
          {renderTextInput('B.3.2 PROSES ATIKLARI', 'B32_proses_atiklari', '', true, 'Proseslerden kaynaklanan atıklar (tehlikeli atık, atık yağ vb) Atık Yönetimi Yönetmeliği göre atık kodları.')}
          {renderTextInput('B.3.3 ATIK ANALİZLERİ', 'B33_atik_analizleri', '', true, 'Rapor dönemi içinde atıklara ilişkin yaptırılan analizler ve sonuçları.')}
        </div>
      </Section>

      <Section>
        {renderSectionHeader('DİĞER YÖNETİMLER')}
        <div className="space-y-4">
          {renderTextInput('B.4 GÜRÜLTÜ YÖNETİMİ', 'B4_gurultu', '', true, 'Şikayet ya da talep üzerine yapılmış ölçüm/arka plan ölçümü bilgisi.')}
          {renderTextInput('B.5 TOPRAK KİRLİLİĞİ', 'B5_toprak', '', true, 'Saha içinde toprak kirliliği olup olmadığının tespit edilmesi.')}
          {renderTextInput('B.6 KİMYASALLAR YÖNETİMİ', 'B6_kimyasallar', '', true, 'Kullanılan tüm kimyasallara ait güvenlik bilgi formları, depolama şartları.')}
          {renderTextInput('B.7 BÜYÜK ENDÜSTRİYEL KAZALARIN KONTROLÜ (BEKRA)', 'B7_bekra', '', true, 'BEKRA bildiriminin güncellenmesine ilişkin kontrol ve değerlendirmeler.')}
        </div>
      </Section>
    </div>
  );

  const renderMonthlyStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      <Section>
        {renderSectionHeader('B.8 - KIYI TESİSLERİ')}
        <div className="space-y-4">
          {renderTextInput('B.8.1 DENİZ KİRLİLİĞİ İLE MÜCADELE', 'B81_deniz_kirliligi', '', true, 'Tatbikat bilgisi, uygulama ve kontroller.')}
          {renderTextInput('B.8.2 ATIK KABUL TESİSİ', 'B82_atik_kabul', '', true, 'Atık kabul tesisine alınan ve bertarafa gönderilen atık türleri ve miktarları.')}
        </div>
      </Section>

      <Section>
        {renderSectionHeader('B.9 - MADEN İŞLETMELERİ')}
        <div className="space-y-4">
          {renderTextInput('B.9.1 KOORDİNATLAR', 'B91_koordinatlar', '', true, 'Stok, pasa, bitkisel toprak, ruhsat alanı vb. koordinat bilgisi.')}
          {renderTextInput('B.9.2 PATLATMA BİLGİLERİ', 'B92_patlatma', '', true, 'Patlatma dizaynı, kullanılan patlayıcı miktarı, sıklığı.')}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">C - GFB / ÇEVRE İZNİ İŞLEMLERİ</h3>
      <Section>
        <div className="space-y-4">
          {renderTextInput('C.1 GFB İşlemleri', 'C1_gfb_islemleri', '', true, 'Geçici faaliyet belgesi ile ilgili olarak dönem içinde yapılan iş ve işlemler.')}
          {renderTextInput('C.2 Çevre İzni / Çevre İzin ve Lisansı İşlemleri', 'C2_izin_islemleri', '', true, 'Çevre İzni/Lisansı ile ilgili olarak dönem içinde yapılan iş ve işlemler.')}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">Ç - KAZA, KAÇAK, ARIZA, BAKIM VE ONARIM</h3>
      <Section>
        <div className="space-y-4">
          {renderTextInput('Ç.1 KAZA VE KAÇAKLAR', 'C1_kaza_kacaklar', '', true, 'Yaşanan kaza ve kaçaklara ilişkin bilgi, alınan önlemler.')}
          {renderTextInput('Ç.2 ARIZA, BAKIM VE ONARIM', 'C2_ariza_bakim', '', true, 'Çevresel etki yaratan arıza, bakım ve onarım işlemlerine dair bilgi.')}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">D - ŞİKAYETLER</h3>
      <Section>
        <div className="space-y-4">
          {renderTextInput('D.1 İŞLETMEYE GELEN ŞİKAYETLER', 'D1_isletme_sikayet', '', true, 'İşletmeye iletilen şikayetlerin konusu ve yapılan işlemler.')}
          {renderTextInput('D.2 BAKANLIĞA İLETİLEN ŞİKAYETLER', 'D2_bakanlik_sikayet', '', true, 'Şikayet sonucunda yetkili otorite tarafından yapılan denetimler.')}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">E - EĞİTİMLER</h3>
      <Section>
        <div className="space-y-4">
          {renderTextInput('E.1 EĞİTİMLER', 'E1_egitimler', '', true, 'Gerçekleştirilen eğitimlerin tarihi, katılımcı sayısı ve konuları.')}
          {renderTextInput('E.2 BİLİNÇLENDİRME ÇALIŞMALARI', 'E2_bilinclendirme', '', true, 'Çevre duyarlılığını arttırmak amacıyla yapılan faaliyetler.')}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8 text-green-600">F - SONUÇ VE ÖNERİLER</h3>
      <Section>
        {renderTextInput('Sonuç ve Öneriler', 'F_sonuc_oneriler', '', true, 'Olumsuzluk, eksiklik ve giderilmesine yönelik öneriler.')}
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">G - EKLER</h3>
      <Section>
        {renderAttachments()}
      </Section>
    </div>
  );

  // --- YILLIK RAPOR ADIMLARI ---
  const renderYearlyStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">1 - İŞLETME BİLGİLERİ</h3>
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderTextInput('Vergi Dairesi ve Numarası', 'Y1_vergi_bilgisi', '', false, '', true)}
          {renderTextInput('Çevre Kimlik Numarası (ÇKN)', 'Y1_ckn', '', false, '', true)}
          {renderTextInput('Beldesi / İlçesi / İli', 'Y1_il_ilce', '', false, '', true)}
          {renderTextInput('Koordinat Bilgileri (UTM)', 'Y1_koordinat', '', false, '', true)}
          {renderTextInput('Kurulu Olduğu Yer', 'Y1_kurulus_yeri', 'OSB, İOSB, Yerleşim alanı vb.', false, '', true)}
          {renderTextInput('Çalışma Şekli', 'Y1_calisma_sekli', 'Sürekli / Mevsimlik', false, '', true)}
          {renderTextInput('Vardiya Sayısı', 'Y1_vardiya', '', false, '', true)}
          {renderTextInput('Üretim Konusu', 'Y1_uretim', '', false, '', true)}
        </div>

        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
          <h5 className="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300">Alan Bilgileri (m²)</h5>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {renderTextInput('Açık Alan', 'Y1_alan_acik', '', false, '', true)}
            {renderTextInput('Kapalı Alan', 'Y1_alan_kapali', '', false, '', true)}
            {renderTextInput('Toplam Alan', 'Y1_alan_toplam', '', false, '', true)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
          <h5 className="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300">Personel Sayıları</h5>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {renderNumberInput('İdari', 'Y1_p_idari')}
            {renderNumberInput('Mühendis', 'Y1_p_muh')}
            {renderNumberInput('Teknisyen', 'Y1_p_tek')}
            {renderNumberInput('Usta', 'Y1_p_usta')}
            {renderNumberInput('İşçi', 'Y1_p_isci')}
            {renderReadOnlyField('Toplam', computePersonnelTotal())}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
          <h5 className="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300">NACE Kodları</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderTextInput('NACE Kodu', 'Y1_nace_kod', '', false, '', true)}
            {renderTextInput('NACE Adı', 'Y1_nace_adi', '', false, '', true)}
          </div>
        </div>

        <div>
          <h5 className="font-bold text-sm mb-3 text-gray-700 dark:text-gray-300">Kapasite ve Belgeler</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderTextInput('ÇED Kararı Yazısı', 'Y1_kap_ced', '', false, '', true)}
            {renderTextInput('Çevre İzni/Lisansı', 'Y1_kap_izin', '', false, '', true)}
            {renderTextInput('Kapasite Raporu', 'Y1_kap_rapor', '', false, '', true)}
            {renderTextInput('Çevre Yönetim Sistemi Belgesi', 'Y1_cys_belge', '', false, '', true)}
            {renderTextInput('Teşvik ve Ödüller', 'Y1_tesvik_odul', '', false, '', true)}
          </div>
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">2 - İŞLETME HAKKINDA GENEL BİLGİLER</h3>
      <Section>
        <div className="space-y-4">
          {renderTextInput('Genel Bilgiler', 'Y2_genel_bilgiler', 'Pafta, parsel, ada no ve mülkiyet durumu...', true, '', true)}
          {renderTextInput('Faaliyet Sahibi Bilgisi', 'Y2_faaliyet_sahibi', 'Unvan değişikliği vb. bilgiler', true, '', true)}
        </div>
      </Section>
    </div>
  );

  const renderYearlyStep3 = () => {
    const selectedClient = getSelectedClient();
    return (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">3 - ÇED YÖNETMELİĞİNE GÖRE DURUMU</h3>
      <Section>
        {renderReadOnlyField('ÇED Kapsamı (Otomatik)', buildCedScopeText(selectedClient))}
        {renderTextInput('ÇED Değerlendirmesi / Resmi Yazılar', 'Y3_ced_durumu', 'ÇED Olumlu/Gerekli Değildir vb. resmi belgeler, tarih ve sayıları ile...', true, 'Son Kapasite Raporunda yer alan kapasiteye göre değerlendirilme yapılmalıdır.')}
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">4 - ÇEVRE İZİN VE LİSANS YÖNETMELİĞİNE (ÇİLY) GÖRE DURUMU</h3>
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderReadOnlyField('Ek Liste', selectedClient?.permit_stage === 'ek1' ? 'Ek-1' : selectedClient?.permit_stage === 'ek2' ? 'Ek-2' : 'Kapsam Dışı')}
          {renderReadOnlyField('Bölüm No', (selectedClient?.permit_articles || []).join(', '))}
          {renderReadOnlyField('Faaliyet Adı', (selectedClient?.permit_articles || []).map((code) => permitCategories.find((c) => c.stage === selectedClient?.permit_stage && c.code === code)?.title || '').join(', '))}
        </div>
        <div className="space-y-4">
          {renderTextInput('İzin Konuları', 'Y4_izin_konulari', 'Hava emisyonu, atıksu deşarjı vb.')}
          {renderTextInput('Geçici Faaliyet Belgesi İşlemleri', 'Y4_gfb_islemleri', 'Alındığı mercii, tarih, sayı ve konusu...', true)}
          {renderTextInput('Çevre İzni / Lisans İşlemleri', 'Y4_izin_lisans_islemleri', 'Alındığı mercii, tarih, sayı ve konusu...', true)}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">5 - İŞ AKIM ŞEMASI VE PROSES ÖZETİ</h3>
      <Section>
        {renderTextInput('İş Akımı ve Proses', 'Y5_proses_ozeti', 'Faaliyet alanı, vaziyet planı, üretim süreçleri ve emisyon çıkışları...', true)}
      </Section>
    </div>
    );
  };

  const renderYearlyStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h3 className="text-xl font-bold border-b pb-2">6 - ÇEVRESEL ETKİLER VE ÖNLEMLER</h3>
        <p className="text-xs text-amber-600 italic mt-2">Not: Rapor kontrol listesi şeklinde olmamalı, net ifadeler ve rakamlarla değerlendirme yapılmalıdır.</p>
      </div>

      <Section>
        {renderSectionHeader('6.1 - SU VE ATIKSU YÖNETİMİ')}
        <div className="space-y-4">
          {renderTextInput('6.1.1 SU TÜKETİMİ', 'Y611_su_tuketimi', '', true, 'Temin edilen kaynaklar, tüketim miktarı ve kuyu izinleri.')}
          {renderTextInput('6.1.2 EVSEL ATIKSU', 'Y612_evsel_atiksu', '', true, 'Miktar, kaynak, arıtma/kanal/vidanjör bilgileri.')}
          {renderTextInput('6.1.3 ENDÜSTRİYEL ATIKSU', 'Y613_end_atiksu', '', true, 'Miktar, kaynak, arıtma/kanal/vidanjör bilgileri.')}
          {renderTextInput('6.1.4 YAĞMUR VE YIKAMA SULARI', 'Y614_yagmur_suyu', '', true, 'Toplanması ve bertaraf yöntemi.')}
          {renderTextInput('6.1.5 DİĞER ATIKSULAR', 'Y615_diger_atiksu', '', true, 'Soğutma suyu, blöf suyu vb.')}
          {renderTextInput('6.1.6 ATIKSU ARITMA TESİSİ BİLGİSİ', 'Y616_aritma_bilgi', '', true, 'Kapasite, deşarj yeri, sürekli ölçüm, arıtma çamuru bertarafı.')}
          {renderTextInput('6.1.7 İÇ İZLEME', 'Y617_ic_izleme', '', true, 'Numune alma periyotları ve analiz sonuçları tablosu.')}
          {renderTextInput('6.1.8 YERALTI SUYU İZLEME', 'Y618_yeralti_izleme', '', true, 'Gözlem kuyuları ve ölçüm sonuçları.')}
          {renderTextInput('6.1.9 DENİZ SUYU KALİTESİ', 'Y619_deniz_izleme', '', true, 'Ölçümler ve su kalitesi değişimi.')}
        </div>
      </Section>

      <Section>
        {renderSectionHeader('6.2 - HAVA YÖNETİMİ')}
        <div className="space-y-4">
          {renderTextInput('6.2.1 EMİSYON KAYNAKLARI', 'Y621_emisyon_kaynaklari', '', true, 'Yakıt türleri, tüketim, emisyon azaltıcı tedbirler.')}
          {renderTextInput('6.2.2 KONTROLSÜZ EMİSYONLAR', 'Y622_kontrolsuz_emisyon', '', true, 'Giderilmesi için alınan önlemler.')}
          {renderTextInput('6.2.3 TEYİT ÖLÇÜMÜ', 'Y623_teyit_olcumu', '', true, 'Tarih ve sonuç değerlendirmesi.')}
          {renderTextInput('6.2.4 SÜREKLİ EMİSYON ÖLÇÜMÜ', 'Y624_surekli_emisyon', '', true, 'SEÖS verilerinin değerlendirilmesi.')}
          {renderTextInput('6.2.5 İÇ İZLEME ÖLÇÜMLERİ', 'Y625_hava_ic_izleme', '', true, 'Hava kalitesi ve baca gazı ölçümleri.')}
          {renderTextInput('6.2.6 TESİS İÇİ YOLLAR', 'Y626_yollar', '', true, 'SKHKKY Ek-1 değerlendirmesi.')}
          {renderTextInput('6.2.7 YIĞMA MALZEME', 'Y627_yigma_malzeme', '', true, 'Açıkta depolanan yığma malzeme önlemleri.')}
        </div>
      </Section>
    </div>
  );

  const renderYearlyStep5 = () => (
    <div className="space-y-6 animate-fadeIn">
      <Section>
        {renderSectionHeader('6.3 - ATIK YÖNETİMİ')}
        <div className="space-y-4">
          {renderTextInput('6.3.1 GENEL ATIKLAR', 'Y631_genel_atiklar', '', true, 'Evsel, ambalaj vb. Atık kodları, miktarları ve bertarafçı bilgileri.')}
          {renderTextInput('6.3.2 PROSES ATIKLARI', 'Y632_proses_atiklari', '', true, 'Tehlikeli/tehlikesiz, atık yağ vb. Kodlar ve bertaraf yöntemleri.')}
          {renderTextInput('6.3.3 ATIK ANALİZLERİ', 'Y633_atik_analizleri', '', true)}
          {renderTextInput('6.3.4 ATIK YÖNETİM PLANI', 'Y634_atik_plani', '', true, 'Onay tarihi ve karşılaştırmalı değerlendirme.')}
          {renderTextInput('6.3.5 ATIK BEYANLARI', 'Y635_atik_beyanlari', '', true, 'MOTAT, Ambalaj vb. beyan bilgileri.')}
          {renderTextInput('6.3.6 MALİ SORUMLULUK SİGORTASI', 'Y636_sigorta', 'Başlangıç ve bitiş tarihleri.')}
          {renderTextInput('6.3.7 ATIK SÖZLEŞMELERİ', 'Y637_sozlesmeler', 'Bertaraf sözleşmeleri tarih ve tarafları.')}
        </div>
      </Section>

      <Section>
        {renderSectionHeader('6.4 - 6.12 DİĞER YÖNETİMLER')}
        <div className="space-y-4">
          {renderTextInput('6.4 GÜRÜLTÜ YÖNETİMİ', 'Y64_gurultu', '', true)}
          {renderTextInput('6.5 TOPRAK KİRLİLİĞİ', 'Y65_toprak', '', true)}
          {renderTextInput('6.6 KİMYASALLAR YÖNETİMİ', 'Y66_kimyasallar', '', true)}
          {renderTextInput('6.7 BÜYÜK ENDÜSTRİYEL KAZALAR (BEKRA)', 'Y67_bekra', '', true)}
          {renderTextInput('6.8 KIYI TESİSLERİ', 'Y68_kiyi', '', true)}
          {renderTextInput('6.9 MADENLER', 'Y69_maden', '', true)}
          {renderTextInput('6.10 ÇEVRE DENETİMİ', 'Y610_denetim', 'Bakanlık/İl müdürlüğü denetimleri...', true)}
          {renderTextInput('6.11 YATIRIMLAR VE İYİLEŞTİRMELER', 'Y611_yatirimlar', '', true)}
          {renderTextInput('6.12 DİĞER', 'Y612_diger', '', true)}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">7 - 8 - 9 BÖLÜMLER</h3>
      <Section>
        <div className="space-y-4">
          {renderTextInput('7 - KAZA VE KAÇAKLAR / ARIZA BAKIM', 'Y7_kaza_ariza', '', true)}
          {renderTextInput('8 - ŞİKAYETLER', 'Y8_sikayetler', '', true)}
          {renderTextInput('9 - EĞİTİMLER VE BİLİNÇLENDİRME', 'Y9_egitimler', '', true)}
        </div>
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8 text-green-600">10 - SONUÇ VE ÖNERİLER</h3>
      <Section>
        {renderTextInput('Sonuç ve Öneriler', 'Y10_sonuc_oneriler', 'Olumsuzluk, eksiklik ve giderilmesine yönelik öneriler.', true)}
      </Section>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">11 - EKLER (BELGE LİSTESİ)</h3>
      <Section>
        {renderAttachments()}
      </Section>
    </div>
  );


  const renderSteps = () => {
    if (previewMode) return renderPreview();

    if (currentStep === 1) {
      return (
        <div className="space-y-6 animate-fadeIn">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Temel Bilgiler</h2>

          {userMode === 'personal' && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
              <p className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <FileText size={16} /> Şahsi Rapor Modu
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Bu rapor, kişisel evrak listenize şahsi olarak eklenecektir. İşletme seçimi gerekmemektedir.
              </p>
            </div>
          )}

          <Section>
            {userMode === 'consultant' && (
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Hizmet Verilen İşletme *
                </label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  <option value="">Seçiniz...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Rapor Türü *
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as 'monthly'|'yearly')}
                  disabled={!!renewFromReportId}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed disabled:text-gray-500"
                >
                  <option value="monthly">Aylık Değerlendirme Raporu</option>
                  <option value="yearly">Yıllık İç Tetkik Raporu</option>
                </select>
                {renewFromReportId && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Yenilenen raporun türü değiştirilemez.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Rapor (Ziyaret) Tarihi *
                </label>
                <input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm font-semibold text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>

            {reportType === 'monthly' && !isManualUpload && (
              <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">Aylık Ziyaret Saati</label>
                <div className="flex gap-8 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.visit_morning || false}
                      onChange={(e) => handleUpdateField('visit_morning', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Öğleden Önce</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.visit_afternoon || false}
                      onChange={(e) => handleUpdateField('visit_afternoon', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Öğleden Sonra</span>
                  </label>
                </div>
                <p className="text-[11px] text-amber-600 font-medium italic">Not: Tüm gün tesiste bulunulacaksa her iki saat aralığı da işaretlenmelidir.</p>
              </div>
            )}

            {userMode === 'consultant' && !isManualUpload && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl">
                <RefreshCw size={20} className="shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Zaman Kazanmak İster misiniz?</p>
                  <p className="text-xs opacity-80">Bu işletme için oluşturulmuş en son rapor verilerini form üzerine otomatik çekebilirsiniz.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadPrevious}
                  disabled={!clientId}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 shrink-0"
                >
                  Önceki Verileri Çek
                </button>
              </div>
            )}
          </Section>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
             <label className="flex items-center gap-3 cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={isManualUpload} 
                 onChange={(e) => setIsManualUpload(e.target.checked)} 
                 className="w-5 h-5 text-blue-600 rounded" 
               />
               <span className="font-semibold">Sistem Formu Yerine Manuel Dosya (PDF) Yüklemek İstiyorum</span>
             </label>
             {isManualUpload && (
               <div className="mt-4 p-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-slate-900/50">
                 <UploadCloud size={48} className="mb-3 text-blue-500" />
                 
                 {fileUrl ? (
                   <div className="text-center">
                     <p className="text-green-600 font-bold flex items-center gap-2 mb-4">
                       <CheckCircle size={20} /> Dosya Başarıyla Hazırlandı
                     </p>
                     <p className="text-xs text-gray-400 mb-4 truncate max-w-xs">{fileUrl}</p>
                     <button 
                       type="button" 
                       onClick={() => setFileUrl('')}
                       className="text-red-500 text-sm font-bold hover:underline"
                     >
                       Dosyayı Değiştir
                     </button>
                   </div>
                 ) : (
                   <div className="text-center">
                     <p className="font-bold text-gray-700 dark:text-gray-300 mb-2">Rapor Dosyasını Seçin</p>
                     <p className="text-xs text-gray-400 mb-6">PDF, Word veya Görsel dosyaları desteklenir.</p>
                     
                     <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition shadow-lg inline-flex items-center gap-2">
                       {uploading ? <RefreshCw size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                       {uploading ? 'Yükleniyor...' : 'Bilgisayardan Dosya Seç'}
                       <input
                         type="file"
                         className="hidden"
                         accept=".pdf,.doc,.docx,image/*"
                         onChange={handleManualFileSelected}
                         disabled={uploading}
                       />
                     </label>
                   </div>
                 )}
                 
                 <p className="text-[10px] mt-6 text-gray-400 italic">Not: Manuel dosya yükleme sistem form adımlarını atlar. Dosyayı seçtikten sonra açılan önizleme ekranında sayfaları kontrol edip kaşe/imza/logo görseli ekleyebilir, ardından onaylayabilirsiniz.</p>
               </div>
             )}
          </div>
        </div>
      );
    }

    if (reportType === 'monthly') {
      if (currentStep === 2) return renderMonthlyStep2();
      if (currentStep === 3) return renderMonthlyStep3();
      if (currentStep === 4) return renderMonthlyStep4();
    } else {
      if (currentStep === 2) return renderYearlyStep2();
      if (currentStep === 3) return renderYearlyStep3();
      if (currentStep === 4) return renderYearlyStep4();
      if (currentStep === 5) return renderYearlyStep5();
    }
  };

  // Kaydetmeden önceki son adım: tüm doldurulan alanları (ve eklenen görselleri)
  // salt-okunur olarak tek ekranda gösterir. renderTextInput, previewMode true
  // olduğunda otomatik olarak salt-okunur görünüme geçtiği için mevcut
  // renderMonthlyStepX / renderYearlyStepX fonksiyonları aynen yeniden kullanılıyor.
  const renderPreview = () => (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
        <Eye size={20} className="shrink-0" />
        <p className="text-sm font-bold">
          Rapor Önizlemesi — Kaydetmeden önce tüm bilgileri kontrol edin. Görsel eklemek/kaldırmak için aşağıdaki "Ekler" bölümünü kullanabilirsiniz.
        </p>
      </div>
      {reportType === 'monthly' ? (
        <>
          {renderMonthlyStep2()}
          {renderMonthlyStep3()}
          {renderMonthlyStep4()}
        </>
      ) : (
        <>
          {renderYearlyStep2()}
          {renderYearlyStep3()}
          {renderYearlyStep4()}
          {renderYearlyStep5()}
        </>
      )}
    </div>
  );

  const getMaxSteps = () => {
    if (isManualUpload) return 1;
    return reportType === 'monthly' ? 4 : 5;
  };

  const handleNext = () => {
    if (currentStep === 1 && userMode === 'consultant' && !clientId) {
      alert("Lütfen işletme seçiniz!");
      return;
    }
    if (currentStep < getMaxSteps()) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    } else if (!isManualUpload) {
      // Son içerik adımındayız: kaydetmeden önce önizleme ekranına geç.
      setPreviewMode(true);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (previewMode) {
      setPreviewMode(false);
      window.scrollTo(0, 0);
      return;
    }
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  // --- Loading State ---
  if (userMode === 'loading') {
    return (
      <div className="max-w-5xl mx-auto p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    );
  }

  // --- Premium Süresi Dolmuş Kurumsal Hesap ---
  if (isCorporateExpired) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-24">
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <button onClick={() => navigate('/documents')} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Yeni Rapor Oluştur</h1>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-rose-200 p-12 text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={32} className="text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Premium Süresi Doldu</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
            Şirketinizin premium paketi sona ermiş. Yeni rapor oluşturabilmek için lütfen paketinizi yenileyin.
          </p>
          <a
            href="/pricing"
            className="mt-6 inline-block bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg font-bold transition"
          >
            Paketi Yenile
          </a>
        </div>
      </div>
    );
  }

  // --- No Assigned Clients State ---
  if (noAssignedClients) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-24">
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
          <button onClick={() => navigate('/documents')} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Yeni Rapor Oluştur</h1>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-amber-200 p-12 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Atanmış İşletme Bulunamadı</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
            Rapor oluşturmak için size atanmış bir hizmet verilen işletme bulunmamaktadır.
            Lütfen şirket yöneticinizle iletişime geçin ve size bir işletme atanmasını isteyin.
          </p>
          <button
            onClick={() => navigate('/documents')}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition"
          >
            Evraklar Sayfasına Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 sticky top-[72px] z-10">
        <button onClick={() => navigate(userMode === 'personal' ? '/documents' : '/consultant')} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">
            {renewFromReportId
              ? 'Raporu Yenile'
              : userMode === 'personal' ? 'Şahsi Rapor Oluştur' : 'Yeni Rapor Oluştur'}
          </h1>
          <p className="text-xs text-gray-500">
            {previewMode
              ? 'Önizleme'
              : renewFromReportId
                ? `Önceki raporun verileri yüklendi, güncelleyip kaydedin · Adım ${currentStep} / ${getMaxSteps()}`
                : `Adım ${currentStep} / ${getMaxSteps()}`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 ml-8">
           <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
             <div
               className="h-full bg-blue-600 transition-all duration-500"
               style={{ width: `${previewMode ? 100 : (currentStep / getMaxSteps()) * 100}%` }}
             ></div>
           </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        {renderSteps()}
      </div>

      {/* Footer Navigation — her zaman viewport altına sabit; içeriğin ne kadar
          kısa olduğuna bakılmaksızın (bkz. `pb-28` üst kapsayıcıda) üstüne
          binmez. Önceki `sticky bottom-4` deseni kısa adımlarda (örn. Adım 1)
          hiç kaydırmadan içeriğin üstüne biniyordu. */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-5xl mx-auto flex justify-between items-center p-4">
          <button
            onClick={handlePrev}
            disabled={(currentStep === 1 && !previewMode) || loading}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 text-sm sm:text-base"
          >
            <ChevronLeft size={18} /> {previewMode ? 'Düzenlemeye Dön' : 'Geri'}
          </button>

          {previewMode || (currentStep === getMaxSteps() && isManualUpload) ? (
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 sm:px-8 py-2 rounded-lg font-bold shadow-lg transition disabled:opacity-50 text-sm sm:text-base"
            >
              {loading ? 'Kaydediliyor...' : 'Onayla ve Kaydet'} <Save size={18} />
            </button>
          ) : currentStep === getMaxSteps() ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-8 py-2 rounded-lg font-bold shadow-lg transition text-sm sm:text-base"
            >
              <Eye size={18} /> Önizleme
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-8 py-2 rounded-lg font-bold shadow-lg transition text-sm sm:text-base"
            >
              İleri <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>

      {pendingManualFile && (
        <DocumentPreviewModal
          file={pendingManualFile}
          confirmLabel="Onayla ve Yükle"
          onClose={() => setPendingManualFile(null)}
          onConfirm={(finalFile) => {
            setPendingManualFile(null);
            uploadReportFile(finalFile);
          }}
        />
      )}
    </div>
  );
}
