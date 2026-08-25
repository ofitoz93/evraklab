import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  FileText,
  Calendar,
  Trash2,
  LogOut,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  MapPin,
  ChevronRight,
  Table,
  QrCode,
  Scale,
  BookOpen,
  Eye,
  PlusCircle,
  X,
  Sparkles,
  PartyPopper,
  Sun,
  Moon,
  Star,
  Loader,
  ThumbsUp,
  Inbox,
  Upload,
  Plus,
  FlaskConical,
} from 'lucide-react';
import QRCode from 'qrcode';
import { WASTE_CODES, RECOVERY_CODES, DISPOSAL_CODES } from './wasteCodes';
import { CLIENT_QUESTIONS } from './ClientEvaluationPage';
import InspectionAnalytics from './InspectionAnalytics';
import { extractTextFromPdf } from './localScanner';
import {
  parseMsdsText,
  computeExpiryDate,
  computeMsdsStatus,
  computeDaysRemaining,
  MSDS_STATUS_LABELS_TR,
  MSDS_STATUS_BADGE_CLASSES,
} from './msdsParser';

const getContractStatus = (startDateStr: string) => {
  const serviceStartDate = new Date(startDateStr);
  const expiryDate = new Date(serviceStartDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Hizmet süresi 1 yıl

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryWithoutTime = new Date(expiryDate);
  expiryWithoutTime.setHours(0, 0, 0, 0);

  const diffTime = expiryWithoutTime.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    expiryDate,
    daysLeft: diffDays,
    isExpired: diffDays <= 0,
    isWarning: diffDays > 0 && diffDays <= 30,
  };
};

// Sözleşme (hizmet süresi) dolduktan sonra müşteri en fazla ACCESS_GRACE_DAYS
// gün daha panele erişebilir; bu sürenin üzerinde panel tamamen kilitlenir
// (bkz. isLockedOut / kilit ekranı render'ı aşağıda). service_start_date hiç
// girilmemiş firmalar asla kilitlenmez (eksik veri yüzünden yanlışlıkla
// müşteriyi dışarıda bırakmamak için).
const ACCESS_GRACE_DAYS = 30;

// Bu belge türleri müşteri tarafından değil, danışman tarafından hazırlanır
// (Aylık Faaliyet Raporu / Yıllık İç Tetkik Raporu) — bu yüzden süresi
// geçtiğinde ensureAutoDocumentRequests otomatik "Evrak Talebi" AÇMAZ (MSDS'te
// olduğu gibi). Danışman bu belgelerden birini elden isterse, ConsultantPanel
// üzerinden kendisi manuel bir talep açabilir; o akış bu hariç tutmadan
// etkilenmez.
const AUTO_REQUEST_EXCLUDED_DOC_TYPES = new Set(['Aylık Faaliyet Raporu', 'Yıllık İç Tetkik Raporu']);

type ServiceStatus = { expiryDate: Date; daysLeft: number; isExpired: boolean; isWarning: boolean; startDate: Date; isTerminated: boolean };

// Sözleşme durumu artık sabit "service_start_date + 1 yıl" yerine, en güncel
// consultant_client_service_periods satırının end_date'ine göre hesaplanır
// (bkz. add_consultant_client_service_periods.sql - danışman "Hizmet Yenile"
// dedikçe ardışık yeni dönemler ekleniyor). Henüz hiç dönemi olmayan (eski/
// taşınmamış veri) bir firma için eski hesaba (service_start_date + 1 yıl)
// geri düşülür. terminatedAt doluysa (danışman "Hizmet Sonlandır" demişse,
// bkz. add_client_service_termination.sql) isTerminated=true döner - bu,
// "unutulmuş yenileme"den kasıtlı olarak ayrı ele alınır (bkz. lockout).
function computeServiceStatus(
  periods: Array<{ start_date: string; end_date: string }>,
  fallbackServiceStartDate: string | null | undefined,
  terminatedAt?: string | null
): ServiceStatus | null {
  const isTerminated = !!terminatedAt;
  if (periods.length === 0) {
    if (!fallbackServiceStartDate) return null;
    const fallback = getContractStatus(fallbackServiceStartDate);
    return { ...fallback, startDate: new Date(fallbackServiceStartDate), isTerminated };
  }
  const sorted = [...periods].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const latest = sorted[0];
  const earliest = sorted[sorted.length - 1];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(latest.end_date);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return {
    startDate: new Date(earliest.start_date),
    expiryDate: expiry,
    daysLeft: diffDays,
    isExpired: diffDays <= 0,
    isWarning: diffDays > 0 && diffDays <= 30,
    isTerminated,
  };
}

// Kasıtlı sonlandırma, 30 günlük ek süreyi beklemeden hemen kilitler -
// unutulmuş bir yenilemeden farklı olarak burada danışman zaten bilinçli
// olarak ilişkiyi bitirdi.
function computeAccessLockoutFromStatus(status: ServiceStatus | null): boolean {
  if (!status) return false;
  if (status.isTerminated) return true;
  return status.isExpired && -status.daysLeft > ACCESS_GRACE_DAYS;
}

export default function ClientPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [permitCategories, setPermitCategories] = useState<{ stage: string; code: string; title: string }[]>([]);
  const [cedCategories, setCedCategories] = useState<{ stage: string; code: string; title: string }[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [completingActionId, setCompletingActionId] = useState<string | null>(null);
  const [actionNoteInput, setActionNoteInput] = useState('');
  const [actionFileInput, setActionFileInput] = useState<File | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [wastes, setWastes] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // Evrak Talepleri (Danışman'ın açtığı, müşterinin belge yükleyip karşıladığı talepler)
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [docReqUploadFiles, setDocReqUploadFiles] = useState<Record<string, File | null>>({});
  const [fulfillingRequestId, setFulfillingRequestId] = useState<string | null>(null);

  // Hizmet Dönemleri (sözleşme yenileme geçmişi - danışman panelindeki
  // "Hizmet Başlat/Yenile" ile eklenir, burada salt okunur görüntülenir)
  const [servicePeriods, setServicePeriods] = useState<any[]>([]);

  // MSDS/SDS öz-servis ("Belgelerim" içinde ayrı alt-alan)
  const [msdsDocuments, setMsdsDocuments] = useState<any[]>([]);
  const [docsSubView, setDocsSubView] = useState<'all' | 'msds'>('all');
  const [editingMsdsId, setEditingMsdsId] = useState<string | null>(null);
  const [msdsEditProductName, setMsdsEditProductName] = useState('');
  const [msdsEditPrimaryDate, setMsdsEditPrimaryDate] = useState('');
  const [msdsEditFile, setMsdsEditFile] = useState<File | null>(null);
  const [msdsParsing, setMsdsParsing] = useState(false);
  const [msdsSaving, setMsdsSaving] = useState(false);

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'doc_requests' | 'actions' | 'waste' | 'reports' | 'matrix' | 'inspections' | 'legislations' | 'evaluation'>('overview');

  const NAV_TABS: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Genel Bakış', icon: <Activity size={15} /> },
    { id: 'docs', label: 'Belgelerim', icon: <FileText size={15} /> },
    { id: 'doc_requests', label: 'Evrak Talepleri', icon: <Inbox size={15} /> },
    { id: 'actions', label: 'Aksiyonlar', icon: <CheckCircle size={15} /> },
    { id: 'waste', label: 'Atık Yönetimi', icon: <Trash2 size={15} /> },
    { id: 'matrix', label: 'Zorunlu Belge Matrisi', icon: <Table size={15} /> },
    { id: 'reports', label: 'Aylık & Yıllık Raporlar', icon: <Calendar size={15} /> },
    { id: 'inspections', label: 'Saha QR Denetimleri', icon: <QrCode size={15} /> },
    { id: 'legislations', label: 'Mevzuat Takip', icon: <Scale size={15} /> },
    { id: 'evaluation', label: 'Danışman Değerlendirme', icon: <Star size={15} /> },
  ];

  // Danışman Değerlendirme Anketi state'leri
  const [activeEvalPeriod, setActiveEvalPeriod] = useState<any>(null);
  const [assignedStaffForEval, setAssignedStaffForEval] = useState<any[]>([]);
  const [myClientEvaluations, setMyClientEvaluations] = useState<any[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [selectedEvalStaffId, setSelectedEvalStaffId] = useState<string | null>(null);
  const [evalScores, setEvalScores] = useState<Record<string, number>>({});
  const [evalComments, setEvalComments] = useState('');
  const [submittingEval, setSubmittingEval] = useState(false);

  // Aktif donem yoksa sekme hic gozukmesin; donem varken doldurulmamis
  // degerlendirme kaldigi surece sekme yanip sonsun (dikkat cekmek icin).
  const evaluatedStaffIdSet = new Set(myClientEvaluations.map((ev) => ev.evaluatee_id));
  const hasPendingEvaluation =
    !!activeEvalPeriod && assignedStaffForEval.some((a) => !evaluatedStaffIdSet.has(a.user_id));
  const hasPendingDocRequests = documentRequests.some((r) => r.status === 'pending');
  const visibleNavTabs = NAV_TABS.filter((t) => t.id !== 'evaluation' || !!activeEvalPeriod);
  
  // New States for Matrix, Inspections, and Legislations
  const [defTabTypes, setDefTabTypes] = useState<any[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
  const [allDocsForMatrix, setAllDocsForMatrix] = useState<any[]>([]);
  const [rawDefs, setRawDefs] = useState<any[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const [inspectionForms, setInspectionForms] = useState<any[]>([]);
  const [inspectionPoints, setInspectionPoints] = useState<any[]>([]);
  const [inspectionSubmissions, setInspectionSubmissions] = useState<any[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);

  // Kendi saha denetim formunuzu oluşturma (form tasarımı + QR nokta)
  const [showCreateInspectionFormModal, setShowCreateInspectionFormModal] = useState(false);
  const [newInsFormTitle, setNewInsFormTitle] = useState('');
  const [newInsFormDesc, setNewInsFormDesc] = useState('');
  const [newInsFormQuestions, setNewInsFormQuestions] = useState<any[]>([
    { question_text: '', question_type: 'yes_no', is_required: true },
  ]);
  const [savingInspectionForm, setSavingInspectionForm] = useState(false);

  const [showCreateInspectionPointModal, setShowCreateInspectionPointModal] = useState(false);
  const [newInsPointFormId, setNewInsPointFormId] = useState('');
  const [newInsPointName, setNewInsPointName] = useState('');
  const [newInsPointLocation, setNewInsPointLocation] = useState('');
  const [savingInspectionPoint, setSavingInspectionPoint] = useState(false);

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [qrPointForModal, setQrPointForModal] = useState<any>(null);
  const [selectedSubmissionForDetail, setSelectedSubmissionForDetail] = useState<any>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [submissionAnswers, setSubmissionAnswers] = useState<Record<string, any[]>>({});
  const [submissionFindingsCount, setSubmissionFindingsCount] = useState<Record<string, number>>({});

  const [clientRegulations, setClientRegulations] = useState<any[]>([]);
  const [selectedRegulation, setSelectedRegulation] = useState<any>(null);
  const [regulationArticles, setRegulationArticles] = useState<any[]>([]);
  const [loadingLegs, setLoadingLegs] = useState(false);
  const [showLegArticlesModal, setShowLegArticlesModal] = useState(false);

  // Preview / Detail States
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Welcome banner (shown once per account on first login)
  const [showWelcome, setShowWelcome] = useState(false);

  // Açık/Koyu tema tercihi (tarayıcıda hatırlanır)
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('evraklab_client_theme') as 'light' | 'dark') || 'light'
  );
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('evraklab_client_theme', next);
      return next;
    });
  };
  const isDark = theme === 'dark';

  // Waste Management: companies (transporter/destination) + add-record / add-company modals
  const [wasteCompanies, setWasteCompanies] = useState<any[]>([]);
  const [showAddWasteModal, setShowAddWasteModal] = useState(false);
  const [newWasteCode, setNewWasteCode] = useState('');
  const [newWasteExitDate, setNewWasteExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [newWasteQuantity, setNewWasteQuantity] = useState('');
  const [newWasteTransporterId, setNewWasteTransporterId] = useState('');
  const [newWasteDestinationId, setNewWasteDestinationId] = useState('');
  const [newWasteDisposalType, setNewWasteDisposalType] = useState<'recovery' | 'disposal'>('recovery');
  const [newWasteDisposalCode, setNewWasteDisposalCode] = useState('');
  const [newWasteDescription, setNewWasteDescription] = useState('');
  const [submittingWaste, setSubmittingWaste] = useState(false);

  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyType, setNewCompanyType] = useState<'transporter' | 'destination'>('transporter');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [submittingCompany, setSubmittingCompany] = useState(false);

  const [generatingReport, setGeneratingReport] = useState(false);

  // Waste list filters
  const [wasteSearchQuery, setWasteSearchQuery] = useState('');
  const [wasteFilterDisposal, setWasteFilterDisposal] = useState<'all' | 'recovery' | 'disposal'>('all');
  const [wasteFilterPeriod, setWasteFilterPeriod] = useState<'all' | 'monthly' | 'yearly'>('all');
  const [wasteFilterMonth, setWasteFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [wasteFilterYear, setWasteFilterYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // 1. Get profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profErr || !prof) {
        throw new Error('Profil yüklenemedi.');
      }

      // Normal (client olmayan) hesaplar da, kendilerine bağlanmış bir client_id
      // varsa bu panele erişebilir (bkz. Müşteri Girişi > "mevcut hesaba bağla").
      if (!prof.client_id) {
        alert('Bu panele sadece müşteri hesapları erişebilir.');
        navigate('/');
        return;
      }

      setProfile(prof);

      // Hoşgeldiniz banner'ı bu hesap için daha önce gösterilmediyse bir kere göster
      const welcomeKey = `evraklab_welcome_seen_${prof.id}`;
      if (!localStorage.getItem(welcomeKey)) {
        setShowWelcome(true);
        localStorage.setItem(welcomeKey, '1');
      }

      // 2. Get client info
      const { data: client, error: clientErr } = await supabase
        .from('consultant_clients')
        .select('*, consultant_company:consultant_company_id(name, email, phone)')
        .eq('id', prof.client_id)
        .single();

      if (clientErr || !client) {
        throw new Error('Müşteri firma detayları bulunamadı.');
      }
      setClientDetails(client);

      const { data: periods } = await supabase
        .from('consultant_client_service_periods')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('start_date', { ascending: false });
      setServicePeriods(periods || []);

      const { data: permitCats } = await supabase
        .from('environmental_permit_categories')
        .select('stage, code, title')
        .order('sort_order', { ascending: true });
      setPermitCategories(permitCats || []);

      const { data: cedCats } = await supabase
        .from('ced_project_categories')
        .select('stage, code, title')
        .order('sort_order', { ascending: true });
      setCedCategories(cedCats || []);

      // Taşıyıcı / gönderilen firma listesi (danışmanın tanımladığı ortak liste)
      if (client.consultant_company_id) {
        fetchWasteCompanies(client.consultant_company_id);
      }

      // 3. Get documents matching client name in location_def
      // Not: location_def.label serbest metin olarak danışman tarafından girildiği için
      // büyük/küçük harf veya boşluk farkı olabilir; bu yüzden eşleşmeyi client-side
      // (trim + lowercase) yapıyoruz, tıpkı Zorunlu Belge Matrisi'nde olduğu gibi.
      const { data: allDocs, error: docsErr } = await supabase
        .from('documents')
        .select('*, type_def:user_definitions!type_def_id(label), location_def:user_definitions!location_def_id(id, label)')
        .eq('is_archived', false);
      if (docsErr) {
        console.error('Belgelerim fetch error:', docsErr.message, docsErr);
        setDocuments([]);
      } else {
        const cleanClientName = (client.name || '').trim().toLowerCase();
        const matchedDocs = (allDocs || []).filter((d: any) => {
          const label = d.location_def?.label;
          return label && label.trim().toLowerCase() === cleanClientName;
        });
        setDocuments(matchedDocs);

        // 3b. MSDS/SDS kayıtları (Belgelerim içinde ayrı alt-alan)
        const msdsRows = await fetchMsdsDocuments(prof.client_id);
        setMsdsDocuments(msdsRows);

        // Süresi geçen MSDS-olmayan belgeler için otomatik Evrak Talebi aç
        // (MSDS'ler bu akışa girmez, kendi alt-alanlarında düzeltilir).
        await ensureAutoDocumentRequests(matchedDocs, msdsRows, client, prof);
      }

      // 4. Get actions (kendi mail adresine atanmış olanlar + firma geneli olanlar)
      const { data: acts, error: actsErr } = await supabase
        .from('compliance_actions')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('due_date', { ascending: true });
      if (actsErr) console.error('Aksiyonlar fetch error:', actsErr.message, actsErr);
      const myEmail = (prof.email || '').trim().toLowerCase();
      const visibleActs = (acts || []).filter((a: any) => {
        if (!a.assigned_client_email) return true;
        return a.assigned_client_email.trim().toLowerCase() === myEmail;
      });
      setActions(visibleActs);

      // 5. Get waste dispatches
      await fetchWastes(prof.client_id);

      // 6. Get visits
      const { data: vs } = await supabase
        .from('visit_schedules')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('visit_date', { ascending: true });
      setVisits(vs || []);

      // 7. Get environmental reports
      const { data: reps } = await supabase
        .from('env_reports')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('created_at', { ascending: false });
      setReports(reps || []);

      // Fetch additional matrix, inspections and legislations
      fetchMatrixData(prof.client_id);
      fetchInspectionsData(prof.client_id);
      fetchLegislationsData(prof.client_id);
      fetchDocumentRequests(prof.client_id);
      if (client.consultant_company_id) {
        fetchEvaluationData(prof.client_id, client.consultant_company_id);
      }

    } catch (err: any) {
      console.error(err);
      alert('Veriler yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvaluationData = async (clientId: string, orgId: string) => {
    setLoadingEval(true);
    try {
      const { data: period, error: periodErr } = await supabase
        .from('evaluation_periods')
        .select('*')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .maybeSingle();
      if (periodErr) throw periodErr;
      setActiveEvalPeriod(period || null);
      if (!period) {
        setAssignedStaffForEval([]);
        setMyClientEvaluations([]);
        return;
      }

      const { data: assigns, error: assignsErr } = await supabase
        .from('consultant_assignments')
        .select('user_id, staff:user_id(id, full_name, role)')
        .eq('client_id', clientId);
      if (assignsErr) throw assignsErr;
      setAssignedStaffForEval(assigns || []);

      const { data: evals, error: evalsErr } = await supabase
        .from('evaluations')
        .select('*')
        .eq('client_id', clientId)
        .eq('period_id', period.id)
        .eq('evaluator_type', 'client');
      if (evalsErr) throw evalsErr;
      setMyClientEvaluations(evals || []);
    } catch (err: any) {
      // Sessizce yutulmasin: bu tam da openAssignModal'da bulunan hatanin
      // ayni sinifi - once hata gizlenip sekme "bos/kapali" gorunuyordu.
      console.error('Değerlendirme verisi alınamadı:', err);
      setActiveEvalPeriod(null);
    } finally {
      setLoadingEval(false);
    }
  };

  const handleEvalScoreChange = (qId: string, rating: number) => {
    setEvalScores((prev) => ({ ...prev, [qId]: rating }));
  };

  const handleSubmitClientEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvalPeriod || !selectedEvalStaffId || !profile) return;

    const unanswered = CLIENT_QUESTIONS.filter((q) => !evalScores[q.id]);
    if (unanswered.length > 0) {
      alert('Lütfen tüm değerlendirme sorularını oylayınız.');
      return;
    }

    setSubmittingEval(true);
    try {
      const { error } = await supabase.from('evaluations').insert({
        period_id: activeEvalPeriod.id,
        evaluator_id: null,
        evaluatee_id: selectedEvalStaffId,
        client_id: profile.client_id,
        evaluator_type: 'client',
        scores: evalScores,
        comments: evalComments.trim() || null,
      });
      if (error) throw error;

      alert('Değerlendirmeniz kaydedildi, teşekkür ederiz!');
      setSelectedEvalStaffId(null);
      setEvalScores({});
      setEvalComments('');
      fetchEvaluationData(profile.client_id, clientDetails.consultant_company_id);
    } catch (err: any) {
      alert('Değerlendirme kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSubmittingEval(false);
    }
  };

  const fetchWastes = async (clientId: string) => {
    const { data: wst } = await supabase
      .from('waste_records')
      .select('*, transporter_company:transporter_id(id, name, address), destination_company:destination_id(id, name, address)')
      .eq('client_id', clientId)
      .order('exit_date', { ascending: false });
    setWastes(wst || []);
  };

  const fetchWasteCompanies = async (orgId: string) => {
    const { data } = await supabase
      .from('waste_companies')
      .select('*')
      .eq('organization_id', orgId)
      .order('name', { ascending: true });
    setWasteCompanies(data || []);
  };

  const handleAddWasteRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWasteCode || !newWasteExitDate || !newWasteQuantity || !newWasteTransporterId || !newWasteDestinationId || !newWasteDisposalCode) {
      return alert('Lütfen zorunlu tüm alanları doldurun.');
    }
    const qty = parseFloat(newWasteQuantity);
    if (isNaN(qty) || qty <= 0) {
      return alert('Atık miktarı 0\'dan büyük olmalıdır.');
    }

    setSubmittingWaste(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !profile) return;

      const selectedTransporter = wasteCompanies.find(c => c.id === newWasteTransporterId);
      const selectedDestination = wasteCompanies.find(c => c.id === newWasteDestinationId);

      const { error } = await supabase
        .from('waste_records')
        .insert([{
          client_id: profile.client_id,
          waste_code: newWasteCode,
          exit_date: newWasteExitDate,
          quantity_kg: qty,
          transporter_id: newWasteTransporterId || null,
          destination_id: newWasteDestinationId || null,
          transporter: selectedTransporter?.name || null,
          transporter_address: selectedTransporter?.address || null,
          destination: selectedDestination?.name || null,
          destination_address: selectedDestination?.address || null,
          disposal_type: newWasteDisposalType,
          disposal_code: newWasteDisposalCode || null,
          description: newWasteDescription.trim() || null,
          created_by: session.user.id,
        }]);

      if (error) throw error;

      alert('Atık kaydı başarıyla eklendi!');
      setShowAddWasteModal(false);
      setNewWasteCode('');
      setNewWasteQuantity('');
      setNewWasteTransporterId('');
      setNewWasteDestinationId('');
      setNewWasteDisposalCode('');
      setNewWasteDescription('');
      await fetchWastes(profile.client_id);
    } catch (err: any) {
      alert('Atık kaydı eklenirken hata: ' + err.message);
    } finally {
      setSubmittingWaste(false);
    }
  };

  const handleCreateWasteCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      return alert('Lütfen firma adını yazın.');
    }
    if (!clientDetails?.consultant_company_id) return;

    setSubmittingCompany(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('waste_companies')
        .insert([{
          organization_id: clientDetails.consultant_company_id,
          name: newCompanyName.trim(),
          type: newCompanyType,
          address: newCompanyAddress.trim() || null,
          created_by: session?.user.id,
        }]);

      if (error) throw error;

      alert('Firma başarıyla kaydedildi.');
      setShowAddCompanyModal(false);
      setNewCompanyName('');
      setNewCompanyAddress('');
      await fetchWasteCompanies(clientDetails.consultant_company_id);
    } catch (err: any) {
      alert('Firma kaydedilirken hata: ' + err.message);
    } finally {
      setSubmittingCompany(false);
    }
  };

  const getFilteredWastes = () => {
    return wastes.filter((w) => {
      if (wasteFilterDisposal !== 'all' && w.disposal_type !== wasteFilterDisposal) return false;
      if (wasteFilterPeriod === 'monthly' && !(w.exit_date || '').startsWith(wasteFilterMonth)) return false;
      if (wasteFilterPeriod === 'yearly' && !(w.exit_date || '').startsWith(wasteFilterYear)) return false;
      if (wasteSearchQuery.trim()) {
        const q = wasteSearchQuery.trim().toLowerCase();
        const wasteDef = WASTE_CODES.find(wc => wc.code === w.waste_code);
        const codeMatch = (w.waste_code || '').toLowerCase().includes(q);
        const nameMatch = wasteDef ? wasteDef.name.toLowerCase().includes(q) : false;
        const descMatch = (w.description || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !descMatch) return false;
      }
      return true;
    });
  };

  const getWastePeriodLabel = () => {
    if (wasteFilterPeriod === 'monthly') {
      const [year, month] = wasteFilterMonth.split('-');
      return `${month}/${year} (Aylık)`;
    }
    if (wasteFilterPeriod === 'yearly') return `${wasteFilterYear} Yılı (Yıllık)`;
    return 'Tüm Zamanlar (Genel)';
  };

  const handleGenerateWasteReport = () => {
    const reportWastes = getFilteredWastes();
    if (reportWastes.length === 0) {
      return alert('Seçilen filtrede kaydedilmiş bir atık gönderimi bulunmamaktadır.');
    }
    setGeneratingReport(true);
    try {
      let totalQty = 0;
      let hazardousQty = 0;
      let nonHazardousQty = 0;

      const codeQuantities: Record<string, { name: string, isHazardous: boolean, total: number }> = {};
      const destQuantities: Record<string, { address: string, total: number }> = {};

      reportWastes.forEach((rec) => {
        const qty = Number(rec.quantity_kg) || 0;
        totalQty += qty;

        const isHaz = !!rec.waste_code?.includes('*');
        if (isHaz) hazardousQty += qty;
        else nonHazardousQty += qty;

        const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
        const name = wasteDef ? wasteDef.name : 'Diğer/Özel Atık';
        if (!codeQuantities[rec.waste_code]) {
          codeQuantities[rec.waste_code] = { name, isHazardous: isHaz, total: 0 };
        }
        codeQuantities[rec.waste_code].total += qty;

        const destName = rec.destination_company?.name || rec.destination || 'Belirtilmedi';
        const destAddr = rec.destination_company?.address || rec.destination_address || '-';
        if (!destQuantities[destName]) {
          destQuantities[destName] = { address: destAddr, total: 0 };
        }
        destQuantities[destName].total += qty;
      });

      const groupedByCodeHtml = Object.entries(codeQuantities).map(([code, data]) => `
        <tr>
          <td><span class="badge ${data.isHazardous ? 'badge-danger' : 'badge-safe'} font-mono">${code}</span></td>
          <td>${data.name}</td>
          <td class="center font-bold text-xs">${data.isHazardous ? 'Tehlikeli Atık' : 'Tehlikesiz Atık'}</td>
          <td class="right font-bold">${data.total.toLocaleString('tr-TR')} kg</td>
        </tr>
      `).join('');

      const groupedByDestHtml = Object.entries(destQuantities).map(([name, data]) => `
        <tr>
          <td class="font-bold text-xs">${name}</td>
          <td class="text-xs text-gray-500">${data.address}</td>
          <td class="right font-bold">${data.total.toLocaleString('tr-TR')} kg</td>
        </tr>
      `).join('');

      const detailedRowsHtml = reportWastes.map((rec) => {
        const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
        const name = wasteDef ? wasteDef.name : 'Diğer/Özel Atık';
        const dateStr = new Date(rec.exit_date).toLocaleDateString('tr-TR');
        const transporterName = rec.transporter_company?.name || rec.transporter || '-';
        const destinationName = rec.destination_company?.name || rec.destination || '-';
        const dispType = rec.disposal_type === 'recovery' ? 'Geri Kazanım' : 'Bertaraf';
        const dispCode = rec.disposal_code ? ` (${rec.disposal_code})` : '';

        return `
          <tr>
            <td class="font-mono text-xs">${dateStr}</td>
            <td>
              <span class="badge ${rec.waste_code?.includes('*') ? 'badge-danger' : 'badge-safe'} font-mono mr-1">${rec.waste_code}</span>
              <span class="text-slate-700 font-semibold">${name}</span>
            </td>
            <td class="right font-bold text-slate-800">${Number(rec.quantity_kg).toLocaleString('tr-TR')} kg</td>
            <td class="text-xs">${transporterName}</td>
            <td class="text-xs">${destinationName}</td>
            <td class="center"><span class="badge ${rec.disposal_type === 'recovery' ? 'badge-safe' : 'badge-danger'} text-[10px]">${dispType}${dispCode}</span></td>
          </tr>
        `;
      }).join('');

      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Yazdırma penceresi engellendi. Lütfen pop-up engelleyicileri kaldırın.');

      printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Atık Çıkış Beyan Raporu — ${clientDetails?.name}</title>
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 30px; margin: 0; line-height: 1.5; font-size: 13px; background:#fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
    .header-logo { font-size: 20px; font-weight: 800; color: #0f172a; }
    .header-logo span { color: #2ca58d; }
    .header-meta { text-align: right; font-size: 11px; color: #64748b; font-weight: 600; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 5px; }
    .subtitle { font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 25px; }

    .grid-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
    .card-label { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-bottom: 5px; }
    .card-value { font-size: 22px; font-weight: 900; color: #0f172a; }
    .card-unit { font-size: 11px; font-weight: 600; color: #64748b; margin-left: 2px; }
    .card-danger { border-left: 4px solid #ef4444; }
    .card-safe { border-left: 4px solid #10b981; }
    .card-primary { border-left: 4px solid #2ca58d; }

    .section { margin-bottom: 30px; }
    .section-title { font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #f1f5f9; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 12px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .right { text-align: right; }
    .center { text-align: center; }
    .font-mono { font-family: monospace; font-weight: bold; }

    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-safe { background: #d1fae5; color: #065f46; }

    .signature-row { display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid; }
    .signature-box { width: 45%; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; }
    .sig-label { font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 40px; line-height: 1.4; }
    .sig-line { width: 80%; border-bottom: 1px solid #94a3b8; margin: 0 auto 5px auto; }
    .sig-date { font-size: 10px; color: #64748b; font-weight: 600; }

    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="header-logo">EVRAK<span>LAB</span></div>
        <div style="font-size:10px; font-weight:bold; color:#64748b; margin-top:2px;">ATIK BEYAN VE ÇIKIŞ TAKİP SİSTEMİ</div>
      </div>
      <div class="header-meta">
        <div>Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
        <div>Rapor ID: WBR-${Math.floor(100000 + Math.random() * 900000)}</div>
        <div style="color:#2ca58d; font-weight:800; font-size:10px; margin-top:3px;">ENV-COMPLIANT PRINT</div>
      </div>
    </div>

    <h2 class="title">${clientDetails?.name}</h2>
    <div class="subtitle">Atık Çıkış Beyan Raporu — ${getWastePeriodLabel()}</div>

    <div class="grid-summary">
      <div class="card card-primary">
        <div class="card-label">Toplam Atık Çıkışı</div>
        <div class="card-value">${totalQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
      <div class="card card-danger">
        <div class="card-label">Tehlikeli Atık</div>
        <div class="card-value">${hazardousQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
      <div class="card card-safe">
        <div class="card-label">Tehlikesiz Atık</div>
        <div class="card-value">${nonHazardousQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">1 — Atık Kodlarına Göre Kümülatif Dağılım</div>
      <table>
        <thead>
          <tr>
            <th style="width:110px">Atık Kodu</th>
            <th>Atık Tanımı</th>
            <th class="center" style="width:110px">Sınıfı</th>
            <th class="right" style="width:130px">Toplam Miktar</th>
          </tr>
        </thead>
        <tbody>
          ${groupedByCodeHtml}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">2 — Gönderilen Geri Kazanım / Bertaraf Tesisleri</div>
      <table>
        <thead>
          <tr>
            <th>Gönderilen Tesis / Alıcı Firma</th>
            <th>Adres / Lokasyon</th>
            <th class="right" style="width:150px">Toplam Miktar</th>
          </tr>
        </thead>
        <tbody>
          ${groupedByDestHtml}
        </tbody>
      </table>
    </div>

    <div class="section page-break">
      <div class="section-title">3 — Ayrıntılı Atık Çıkış Kayıtları</div>
      <table>
        <thead>
          <tr>
            <th style="width:88px">Tarih</th>
            <th>Atık Kodu &amp; Tanımı</th>
            <th class="right" style="width:100px">Miktar</th>
            <th>Taşıyıcı Firma</th>
            <th>Gönderilen Tesis</th>
            <th class="center" style="width:130px">İşlem Yöntemi</th>
          </tr>
        </thead>
        <tbody>
          ${detailedRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="signature-row">
      <div class="signature-box">
        <div class="sig-label">${clientDetails?.name}<br/>Yetkili Temsilci / İmza</div>
        <div class="sig-line"></div>
        <div class="sig-date">Tarih: _____ / _____ / 20_____</div>
      </div>
      <div class="signature-box">
        <div class="sig-label">${clientDetails?.consultant_company?.name || 'Danışmanlık Firması'}<br/>Çevre Görevlisi / İmza</div>
        <div class="sig-line"></div>
        <div class="sig-date">Tarih: _____ / _____ / 20_____</div>
      </div>
    </div>

  </div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 700); };
  </script>
</body>
</html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      alert('Rapor oluşturulurken hata: ' + err.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const fetchDocumentRequests = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_requests')
        .select('*, document:document_id(file_url, file_type, file_size), requester:requested_by(full_name, email)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocumentRequests(data || []);
    } catch (err: any) {
      console.error('Evrak talepleri fetch error:', err.message);
    }
  };

  const fetchMsdsDocuments = async (clientId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('msds_documents')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('expiry_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('MSDS belgeleri fetch error:', err.message);
      return [];
    }
  };

  // Süresi geçmiş, MSDS OLMAYAN belgeler için (idempotent şekilde) otomatik bir
  // Evrak Talebi açar — müşteri zaten bildiği "Evrak Talepleri" ekranından bu
  // belgeyi güncelleyebilsin diye. MSDS'ler bu akışa hiç girmez; onlar ayrı
  // "MSDS/SDS Formları" alt-alanında (Belgelerim) doğrudan düzeltilir.
  const ensureAutoDocumentRequests = async (allDocs: any[], msdsRows: any[], client: any, prof: any) => {
    try {
      if (!client?.consultant_company_id) return;
      const msdsDocIds = new Set(msdsRows.map((m) => m.document_id).filter(Boolean));
      const today = new Date();
      const expiredNonMsds = allDocs.filter(
        (d) =>
          d.expiry_date &&
          new Date(d.expiry_date) < today &&
          !msdsDocIds.has(d.id) &&
          !AUTO_REQUEST_EXCLUDED_DOC_TYPES.has(d.type_def?.label)
      );
      if (expiredNonMsds.length === 0) return;

      const expiredIds = expiredNonMsds.map((d) => d.id);
      const { data: existing, error: existingErr } = await supabase
        .from('document_requests')
        .select('source_document_id')
        .eq('client_id', prof.client_id)
        .eq('status', 'pending')
        .in('source_document_id', expiredIds);
      if (existingErr) throw existingErr;
      const alreadyRequested = new Set((existing || []).map((r: any) => r.source_document_id));

      const toCreate = expiredNonMsds.filter((d) => !alreadyRequested.has(d.id));
      if (toCreate.length === 0) return;

      const rows = toCreate.map((d) => ({
        client_id: prof.client_id,
        consultant_company_id: client.consultant_company_id,
        requested_by: prof.id,
        title: `Güncel ${d.title}`,
        description: `Bu belgenin süresi ${new Date(d.expiry_date).toLocaleDateString('tr-TR')} tarihinde dolmuştur. Lütfen güncel belgeyi yükleyiniz.`,
        source_document_id: d.id,
      }));
      const { error: insertErr } = await supabase.from('document_requests').insert(rows);
      if (insertErr) throw insertErr;
      await fetchDocumentRequests(prof.client_id);
    } catch (err: any) {
      console.error('Otomatik evrak talebi oluşturulurken hata:', err.message);
    }
  };

  const sendDocumentFulfilledEmail = async (email: string, clientName: string, title: string): Promise<boolean> => {
    if (!email) return false;
    try {
      const { data: scriptSetting } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'script_url')
        .maybeSingle();
      const actualScriptUrl = scriptSetting?.value;
      if (!actualScriptUrl) {
        console.warn('Evrak yükleme bildirim e-postası gönderilemedi: Google Apps Script URL tanımlı değil.');
        return false;
      }

      await fetch(actualScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'document_request_fulfilled',
          email,
          clientName,
          title,
          loginLink: `${window.location.origin}/login`,
        }),
      });
      return true;
    } catch (err) {
      console.error('Evrak yükleme bildirim e-postası gönderilemedi:', err);
      return false;
    }
  };

  const handleFulfillDocumentRequest = async (request: any) => {
    const file = docReqUploadFiles[request.id];
    if (!file) {
      alert('Lütfen önce bir dosya seçin.');
      return;
    }
    if (!clientDetails?.consultant_company_id) {
      alert('Danışmanlık firması bilgisi bulunamadı.');
      return;
    }
    setFulfillingRequestId(request.id);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `document_requests/${request.id}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      // Belgeyi kendi firma adıyla (mevcut "lokasyon" etiketleme kuralı) etiketle ki
      // Zorunlu Belge Matrisi, Firma Bazlı Kota ve kendi "Belgelerim" sekmesinde görünsün.
      const cleanClientName = (clientDetails.name || '').trim();
      let locationDefId: string | null = null;
      if (cleanClientName) {
        const { data: existingLoc } = await supabase
          .from('user_definitions')
          .select('id')
          .eq('organization_id', clientDetails.consultant_company_id)
          .eq('category', 'location')
          .ilike('label', cleanClientName)
          .maybeSingle();

        if (existingLoc?.id) {
          locationDefId = existingLoc.id;
        } else {
          const { data: newLoc, error: locErr } = await supabase
            .from('user_definitions')
            .insert({
              organization_id: clientDetails.consultant_company_id,
              category: 'location',
              label: cleanClientName,
              user_id: profile.id,
            })
            .select('id')
            .single();
          if (!locErr) locationDefId = newLoc?.id || null;
        }
      }

      const { data: newDoc, error: docErr } = await supabase
        .from('documents')
        .insert({
          organization_id: clientDetails.consultant_company_id,
          uploader_id: profile.id,
          title: request.title,
          description: request.description || null,
          acquisition_date: new Date().toISOString().split('T')[0],
          location_def_id: locationDefId,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          is_indefinite: true,
        })
        .select()
        .single();
      if (docErr) throw docErr;

      const { error: reqErr } = await supabase
        .from('document_requests')
        .update({
          status: 'fulfilled',
          document_id: newDoc.id,
          fulfilled_by: profile.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      if (reqErr) throw reqErr;

      // Talebi açan personele belgenin yüklendiğini bildiren mail gönder
      if (request.requester?.email) {
        await sendDocumentFulfilledEmail(request.requester.email, clientDetails?.name || '', request.title);
      }

      alert('Belge başarıyla yüklendi, talep karşılandı.');
      setDocReqUploadFiles((prev) => ({ ...prev, [request.id]: null }));
      await fetchDocumentRequests(request.client_id);
    } catch (err: any) {
      alert('Belge yüklenirken hata: ' + err.message);
    } finally {
      setFulfillingRequestId(null);
    }
  };

  const handleStartEditMsds = (row: any) => {
    setEditingMsdsId(row.id);
    setMsdsEditProductName(row.product_name || '');
    setMsdsEditPrimaryDate(row.primary_date || '');
    setMsdsEditFile(null);
  };

  const handleMsdsFileSelect = async (file: File) => {
    setMsdsEditFile(file);
    setMsdsParsing(true);
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseMsdsText(text);
      if (parsed.productName.productName) setMsdsEditProductName(parsed.productName.productName);
      if (parsed.dates.primaryDate) setMsdsEditPrimaryDate(parsed.dates.primaryDate.date);
    } catch (err: any) {
      console.error('MSDS ayrıştırma hatası:', err.message);
    } finally {
      setMsdsParsing(false);
    }
  };

  const handleSaveMsdsEdit = async (row: any) => {
    if (!msdsEditProductName.trim() || !msdsEditPrimaryDate) {
      alert('Lütfen ürün adı ve ana tarihi girin.');
      return;
    }
    setMsdsSaving(true);
    try {
      let fileUrl = row.file_url;
      let fileType = row.file_type;
      let fileSize = row.file_size;
      let originalFileName = row.original_file_name;

      if (msdsEditFile) {
        const fileExt = msdsEditFile.name.split('.').pop() || 'pdf';
        const filePath = `${clientDetails.consultant_company_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, msdsEditFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileType = fileExt;
        fileSize = msdsEditFile.size;
        originalFileName = msdsEditFile.name;
      }

      const expiry = computeExpiryDate(msdsEditPrimaryDate, row.validity_years || 5);

      if (row.document_id) {
        const { error: docErr } = await supabase
          .from('documents')
          .update({
            title: msdsEditProductName.trim(),
            acquisition_date: msdsEditPrimaryDate,
            expiry_date: expiry,
            application_deadline: expiry,
            file_url: fileUrl,
            file_type: fileType,
            file_size: fileSize,
          })
          .eq('id', row.document_id);
        if (docErr) throw docErr;
      }

      const { error: msdsErr } = await supabase
        .from('msds_documents')
        .update({
          product_name: msdsEditProductName.trim(),
          product_name_manual_override: true,
          primary_date: msdsEditPrimaryDate,
          primary_date_manual_override: true,
          primary_date_source_label: null,
          primary_date_tier: null,
          primary_date_day_defaulted: false,
          expiry_date: expiry,
          extraction_status: 'manual',
          original_file_name: originalFileName,
          file_url: fileUrl,
          file_type: fileType,
          file_size: fileSize,
        })
        .eq('id', row.id);
      if (msdsErr) throw msdsErr;

      alert('MSDS kaydı güncellendi.');
      setEditingMsdsId(null);
      setMsdsEditFile(null);
      const refreshed = await fetchMsdsDocuments(profile.client_id);
      setMsdsDocuments(refreshed);
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setMsdsSaving(false);
    }
  };

  const handleClientSubmitAction = async (actionId: string) => {
    if (!actionNoteInput.trim()) {
      alert('Lütfen yapılan işle ilgili bir açıklama yazın.');
      return;
    }
    setSubmittingAction(true);
    try {
      let evidenceUrl: string | null = null;
      if (actionFileInput) {
        const fileExt = actionFileInput.name.split('.').pop();
        const filePath = `evidence/client_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('client_assets').upload(filePath, actionFileInput);
        if (uploadErr) throw uploadErr;
        const { data } = supabase.storage.from('client_assets').getPublicUrl(filePath);
        evidenceUrl = data.publicUrl;
      }

      const updates: any = {
        notes: actionNoteInput.trim(),
        status: 'completed',
        updated_at: new Date().toISOString(),
      };
      if (evidenceUrl) updates.evidence_url = evidenceUrl;

      const { error } = await supabase.from('compliance_actions').update(updates).eq('id', actionId);
      if (error) throw error;

      setActions(prev => prev.map(a => a.id === actionId ? { ...a, ...updates } : a));
      alert('Aksiyon tamamlandı olarak işaretlendi ve danışmanınızın onayına gönderildi!');
      setCompletingActionId(null);
      setActionNoteInput('');
      setActionFileInput(null);
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchMatrixData = async (clientId: string) => {
    setLoadingMatrix(true);
    try {
      const { data: defs, error: defsErr } = await supabase
        .from('user_definitions')
        .select('*');
      if (defsErr) throw defsErr;
      setRawDefs(defs || []);

      const docTypes = defs?.filter(d => d.category === 'doc_type') || [];
      const groupedTypesMap = {};
      docTypes.forEach(t => {
        if (!t.label) return;
        const key = t.label.trim();
        if (!groupedTypesMap[key]) {
          groupedTypesMap[key] = [];
        }
        groupedTypesMap[key].push(t.id);
      });
      const tabTypes = Object.keys(groupedTypesMap).map((label, idx) => ({
        id: `group_${idx}`,
        label,
        rowIds: groupedTypesMap[label]
      }));
      setDefTabTypes(tabTypes);

      const { data: reqDocs, error: reqErr } = await supabase
        .from('client_required_documents')
        .select('*')
        .eq('client_id', clientId);
      if (reqErr) throw reqErr;
      setRequiredDocs(reqDocs || []);

      const { data: allDocs, error: docsErr } = await supabase
        .from('documents')
        .select('*')
        .eq('is_archived', false);
      if (docsErr) throw docsErr;
      setAllDocsForMatrix(allDocs || []);
    } catch (err: any) {
      console.error('Matrix error:', err.message);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const fetchInspectionsData = async (clientId: string) => {
    setLoadingInspections(true);
    try {
      const { data: forms, error: formsError } = await supabase
        .from('inspection_forms')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (formsError) throw formsError;
      setInspectionForms(forms || []);

      const formIds = forms?.map(f => f.id) || [];
      if (formIds.length > 0) {
        const { data: points, error: pointsError } = await supabase
          .from('inspection_points')
          .select('*, form:inspection_forms(*)')
          .in('form_id', formIds)
          .order('created_at', { ascending: false });

        if (pointsError) throw pointsError;
        setInspectionPoints(points || []);

        const pointIds = points?.map(p => p.id) || [];
        if (pointIds.length > 0) {
          const { data: subs, error: subsError } = await supabase
            .from('inspection_submissions')
            .select('*, point:inspection_points(name, location_description, form:inspection_forms(title))')
            .in('point_id', pointIds)
            .order('submitted_at', { ascending: false });

          if (subsError) throw subsError;
          setInspectionSubmissions(subs || []);

          const subIds = subs?.map(s => s.id) || [];
          if (subIds.length > 0) {
            const { data: allAnswers } = await supabase
              .from('inspection_answers')
              .select('submission_id, answer_bool, question:inspection_questions(question_type)')
              .in('submission_id', subIds);

            const counts: Record<string, number> = {};
            (allAnswers || []).forEach((a: any) => {
              const isFinding = (a.question?.question_type === 'yes_no' || a.question?.question_type === 'compliant') && a.answer_bool === false;
              if (isFinding) counts[a.submission_id] = (counts[a.submission_id] || 0) + 1;
            });
            setSubmissionFindingsCount(counts);
          } else {
            setSubmissionFindingsCount({});
          }
        } else {
          setInspectionSubmissions([]);
          setSubmissionFindingsCount({});
        }
      } else {
        setInspectionPoints([]);
        setInspectionSubmissions([]);
      }
    } catch (err: any) {
      console.error('Inspections error:', err.message);
    } finally {
      setLoadingInspections(false);
    }
  };

  const handleSaveInspectionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsFormTitle.trim()) return alert('Lütfen form başlığını girin.');
    if (newInsFormQuestions.length === 0) return alert('Lütfen en az bir soru ekleyin.');
    if (newInsFormQuestions.some((q) => !q.question_text.trim())) {
      return alert('Lütfen tüm soru metinlerini doldurun.');
    }
    if (!clientDetails?.consultant_company_id) {
      return alert('Danışmanlık firması bilgisi bulunamadı.');
    }

    setSavingInspectionForm(true);
    try {
      const { data: form, error: formError } = await supabase
        .from('inspection_forms')
        .insert({
          organization_id: clientDetails.consultant_company_id,
          client_id: profile.client_id,
          title: newInsFormTitle.trim(),
          description: newInsFormDesc.trim() || null,
          created_by: profile.id,
        })
        .select()
        .single();
      if (formError) throw formError;

      const questionsToInsert = newInsFormQuestions.map((q, index) => ({
        form_id: form.id,
        order_index: index + 1,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        is_required: q.is_required,
      }));
      const { error: qError } = await supabase.from('inspection_questions').insert(questionsToInsert);
      if (qError) throw qError;

      alert('Denetim formunuz oluşturuldu! Şimdi bir denetim noktası ve QR kod ekleyebilirsiniz.');
      setShowCreateInspectionFormModal(false);
      setNewInsFormTitle('');
      setNewInsFormDesc('');
      setNewInsFormQuestions([{ question_text: '', question_type: 'yes_no', is_required: true }]);
      await fetchInspectionsData(profile.client_id);
    } catch (err: any) {
      alert('Form kaydedilirken hata: ' + err.message);
    } finally {
      setSavingInspectionForm(false);
    }
  };

  const handleSaveInspectionPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsPointName.trim()) return alert('Lütfen nokta adını girin.');
    if (!newInsPointFormId) return alert('Lütfen bu noktada kullanılacak denetim formunu seçin.');

    setSavingInspectionPoint(true);
    try {
      const randToken = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const { data: point, error } = await supabase
        .from('inspection_points')
        .insert({
          form_id: newInsPointFormId,
          name: newInsPointName.trim(),
          location_description: newInsPointLocation.trim() || null,
          qr_token: randToken,
        })
        .select()
        .single();
      if (error) throw error;

      setShowCreateInspectionPointModal(false);
      setNewInsPointName('');
      setNewInsPointLocation('');
      setNewInsPointFormId('');
      await fetchInspectionsData(profile.client_id);
      await handleShowQrCode(point);
    } catch (err: any) {
      alert('Nokta oluşturulurken hata: ' + err.message);
    } finally {
      setSavingInspectionPoint(false);
    }
  };

  const handleShowQrCode = async (point: any) => {
    setQrPointForModal(point);
    const url = `${window.location.origin}/inspect/${point.qr_token}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
      setQrCodeDataUrl(dataUrl);
      setShowQrModal(true);
    } catch (err) {
      console.error(err);
      alert('QR kod oluşturulamadı.');
    }
  };

  const fetchLegislationsData = async (clientId: string) => {
    setLoadingLegs(true);
    try {
      const { data: regs, error: regsError } = await supabase
        .from('client_regulations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (regsError) throw regsError;
      setClientRegulations(regs || []);
    } catch (err: any) {
      console.error('Legislation error:', err.message);
    } finally {
      setLoadingLegs(false);
    }
  };

  const handleViewSubmissionAnswers = async (submissionId: string) => {
    if (expandedSubmissionId === submissionId) {
      setExpandedSubmissionId(null);
      return;
    }
    if (submissionAnswers[submissionId]) {
      setExpandedSubmissionId(submissionId);
      return;
    }
    try {
      const { data: answers, error: answersError } = await supabase
        .from('inspection_answers')
        .select('*, question:inspection_questions(question_text, question_type, order_index)')
        .eq('submission_id', submissionId);

      if (answersError) throw answersError;
      const sorted = (answers || []).sort((a: any, b: any) => (a.question?.order_index ?? 0) - (b.question?.order_index ?? 0));
      setSubmissionAnswers(prev => ({ ...prev, [submissionId]: sorted }));
      setExpandedSubmissionId(submissionId);
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  const handleViewRegulationArticles = async (reg: any) => {
    setSelectedRegulation(reg);
    setRegulationArticles([]);
    setShowLegArticlesModal(true);
    setLoadingLegs(true);
    try {
      const { data: articles, error } = await supabase
        .from('client_regulation_articles')
        .select('*')
        .eq('client_regulation_id', reg.id)
        .order('article_no', { ascending: true });

      if (error) throw error;
      setRegulationArticles(articles || []);
    } catch (err: any) {
      alert('Maddeler yüklenirken hata: ' + err.message);
    } finally {
      setLoadingLegs(false);
    }
  };

  const renderMatrixView = () => {
    return (
      <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-fadeIn text-xs">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-xl">
            <Table size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Zorunlu Belge Durum Matrisi</h3>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">İşletmenizin yasal zorunlu belge durum özeti</p>
          </div>
        </div>

        {loadingMatrix ? (
          <div className="py-20 text-center text-xs text-gray-400 dark:text-slate-500">Yükleniyor...</div>
        ) : defTabTypes.length === 0 ? (
          <div className="py-20 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">Tanımlı zorunlu belge şablonu bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                  <th className="p-4">Belge / Tanım Grubu</th>
                  <th className="p-4 text-center">Durum</th>
                  <th className="p-4">Geçerlilik Tarihi</th>
                  <th className="p-4 text-right">Detay / Belge</th>
                </tr>
              </thead>
              <tbody>
                {defTabTypes.map(type => {
                  const reqConf = requiredDocs.find(rd => type.rowIds.includes(rd.type_def_id));
                  
                  if (!reqConf) {
                    return (
                      <tr key={type.id} className="border-b border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-500">
                        <td className="p-4 font-semibold">{type.label}</td>
                        <td className="p-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">GEREKLİ DEĞİL</span>
                        </td>
                        <td className="p-4">-</td>
                        <td className="p-4 text-right">-</td>
                      </tr>
                    );
                  }

                  if (reqConf.is_exempt) {
                    return (
                      <tr key={type.id} className="border-b border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400">
                        <td className="p-4 font-semibold">{type.label}</td>
                        <td className="p-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/35" title={reqConf.exempt_reason}>
                            MUAF
                          </span>
                        </td>
                        <td className="p-4 text-gray-400 dark:text-slate-500 italic">Muafiyet Nedeni: {reqConf.exempt_reason || 'Belirtilmedi'}</td>
                        <td className="p-4 text-right">-</td>
                      </tr>
                    );
                  }

                  const matchingDoc = allDocsForMatrix.find(d => type.rowIds.includes(d.type_def_id) && rawDefs.some(rd => rd.id === d.location_def_id && rd.label && rd.label.trim().toLowerCase() === clientDetails?.name?.trim().toLowerCase()));

                  if (matchingDoc) {
                    const isIndefinite = matchingDoc.is_indefinite || !matchingDoc.expiry_date;
                    const expiryDate = matchingDoc.expiry_date;
                    const today = new Date().toISOString().split('T')[0];
                    const isExpired = !isIndefinite && expiryDate && expiryDate < today;

                    if (isExpired) {
                      return (
                        <tr key={type.id} className="border-b border-gray-200 dark:border-slate-800 text-amber-500">
                          <td className="p-4 font-bold">{type.label}</td>
                          <td className="p-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/35">SÜRESİ GEÇTİ</span>
                          </td>
                          <td className="p-4 font-semibold text-rose-500">{new Date(expiryDate).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4 text-right">
                            {matchingDoc.file_url && (
                              <a href={matchingDoc.file_url} target="_blank" rel="noreferrer" className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold underline">Belgeyi Gör ↗</a>
                            )}
                          </td>
                        </tr>
                      );
                    } else {
                      return (
                        <tr key={type.id} className="border-b border-gray-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400">
                          <td className="p-4 font-bold">{type.label}</td>
                          <td className="p-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/35">GEÇERLİ</span>
                          </td>
                          <td className="p-4 text-gray-600 dark:text-slate-300">
                            {isIndefinite ? <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded font-bold">Süresiz</span> : new Date(expiryDate).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="p-4 text-right">
                            {matchingDoc.file_url && (
                              <a href={matchingDoc.file_url} target="_blank" rel="noreferrer" className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold underline">Belgeyi Gör ↗</a>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  }

                  return (
                    <tr key={type.id} className="border-b border-gray-200 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                      <td className="p-4 font-bold">{type.label}</td>
                      <td className="p-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/35 animate-pulse">EKSİK BELGE</span>
                      </td>
                      <td className="p-4">-</td>
                      <td className="p-4 text-right">-</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderInspectionsView = () => {
    return (
      <div className="space-y-6 animate-fadeIn text-xs">
        {/* KENDİ DENETİM FORMLARINIZ */}
        <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Kendi Denetim Formlarınız</h3>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">Kendi saha denetim formunuzu tasarlayıp QR nokta oluşturabilirsiniz</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateInspectionFormModal(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shrink-0"
            >
              <Plus size={14} /> Yeni Form Oluştur
            </button>
          </div>

          {inspectionForms.length === 0 ? (
            <div className="py-14 text-center text-gray-400 dark:text-slate-500 text-xs font-medium italic">
              Henüz kendi denetim formunuzu oluşturmadınız.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {inspectionForms.map((form) => {
                const formPoints = inspectionPoints.filter((p) => p.form_id === form.id);
                return (
                  <div key={form.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-gray-800 dark:text-white">{form.title}</div>
                        {form.description && <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{form.description}</div>}
                      </div>
                      <button
                        onClick={() => {
                          setNewInsPointFormId(form.id);
                          setShowCreateInspectionPointModal(true);
                        }}
                        className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40 text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0"
                      >
                        <PlusCircle size={13} /> Nokta ve QR Ekle
                      </button>
                    </div>
                    {formPoints.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {formPoints.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleShowQrCode(p)}
                            className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-[11px] font-bold text-gray-600 dark:text-slate-300 px-2.5 py-1.5 rounded-lg transition"
                          >
                            <QrCode size={12} /> {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ANALİZ */}
        {inspectionForms.length > 0 && (
          <InspectionAnalytics inspectionForms={inspectionForms} supabase={supabase} />
        )}

        <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Saha QR Denetim Kayıtları</h3>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">Tesisinizde QR noktaları üzerinden gerçekleştirilmiş denetim geçmişi</p>
            </div>
          </div>

          {loadingInspections ? (
            <div className="py-20 text-center text-xs text-gray-400 dark:text-slate-500">Denetim verileri yükleniyor...</div>
          ) : inspectionSubmissions.length === 0 ? (
            <div className="py-20 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">Tesisinize ait doldurulmuş saha denetim formu bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                    <th className="p-4">Denetim Noktası</th>
                    <th className="p-4">Kullanılan Form</th>
                    <th className="p-4">Denetim Tarihi</th>
                    <th className="p-4">Denetleyen / Personel</th>
                    <th className="p-4 text-center">Bulgular</th>
                    <th className="p-4 text-right">Ayrıntı</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionSubmissions.map(sub => {
                    const submitterName = [sub.submitted_by_name, sub.submitted_by_surname].filter(Boolean).join(' ').trim();
                    const findings = submissionFindingsCount[sub.id] || 0;
                    return (
                      <tr key={sub.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/30 transition text-gray-600 dark:text-slate-300">
                        <td className="p-4 font-bold text-gray-800 dark:text-slate-200">
                          {sub.point?.name || 'Belirtilmedi'}
                          {sub.point?.location_description && (
                            <div className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">{sub.point.location_description}</div>
                          )}
                        </td>
                        <td className="p-4">{sub.point?.form?.title || 'Genel Form'}</td>
                        <td className="p-4 text-teal-600 dark:text-teal-400">{new Date(sub.submitted_at).toLocaleString('tr-TR')}</td>
                        <td className="p-4 font-semibold text-gray-600 dark:text-slate-300">{submitterName || 'Anonim Saha Personeli'}</td>
                        <td className="p-4 text-center">
                          {findings > 0 ? (
                            <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                              ⚠️ {findings} Uyumsuz
                            </span>
                          ) : (
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                              ✅ Uyumlu
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedSubmissionForDetail(sub);
                              handleViewSubmissionAnswers(sub.id);
                            }}
                            className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold hover:underline"
                          >
                            Cevapları Gör <Eye size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEvaluationView = () => {
    if (loadingEval) {
      return (
        <div className="flex justify-center items-center py-16 text-xs text-gray-500 gap-2">
          <Loader className="animate-spin" size={16} /> Yükleniyor...
        </div>
      );
    }

    if (!activeEvalPeriod) {
      return (
        <div className="p-10 text-center text-sm text-gray-400 italic bg-white dark:bg-slate-900/20 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
          Şu anda açık bir değerlendirme dönemi bulunmuyor. Danışmanlık firmanız yeni bir dönem açtığında burada anketi doldurabileceksiniz.
        </div>
      );
    }

    const evaluatedStaffIds = new Set(myClientEvaluations.map((ev) => ev.evaluatee_id));

    if (selectedEvalStaffId) {
      const staff = assignedStaffForEval.find((a) => a.user_id === selectedEvalStaffId)?.staff;
      return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900/20 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden animate-fadeIn">
          <div className="p-6 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
            <h3 className="text-lg font-black">Danışman Değerlendirme Anketi</h3>
            <p className="text-xs text-teal-100 mt-1">{staff?.full_name} için değerlendirmenizi doldurun</p>
          </div>
          <form onSubmit={handleSubmitClientEvaluation} className="p-6 space-y-5">
            {CLIENT_QUESTIONS.map((q, index) => (
              <div key={q.id} className="p-4 bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-gray-150/40 dark:border-slate-800/60 space-y-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block">Soru {index + 1}</span>
                    <h4 className="font-bold text-gray-800 dark:text-white text-sm">{q.text}</h4>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleEvalScoreChange(q.id, star)}
                        className={`p-0.5 transition ${
                          star <= (evalScores[q.id] || 0)
                            ? 'text-yellow-500 fill-yellow-500 hover:scale-110'
                            : 'text-gray-300 dark:text-slate-700 hover:text-yellow-450'
                        }`}
                      >
                        <Star size={20} />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{q.desc}</p>
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Ek Görüş ve Önerileriniz (İsteğe Bağlı)</label>
              <textarea
                value={evalComments}
                onChange={(e) => setEvalComments(e.target.value)}
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 h-24"
                placeholder="Danışmanınız hakkında eklemek istediğiniz geri bildirimleri yazabilirsiniz..."
              ></textarea>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setSelectedEvalStaffId(null); setEvalScores({}); setEvalComments(''); }}
                className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submittingEval}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                {submittingEval ? (<><Loader className="animate-spin" size={16} /> Gönderiliyor...</>) : 'Anketi Tamamla ve Gönder'}
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50 rounded-xl text-xs text-teal-800 dark:text-teal-300">
          <b>{activeEvalPeriod.title}</b> dönemi için danışmanlarınızı değerlendirebilirsiniz. Görüşleriniz hizmet kalitemizin takibi için önemlidir.
        </div>
        {assignedStaffForEval.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400 italic bg-white dark:bg-slate-900/20 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
            Firmanıza henüz atanmış bir danışman bulunmuyor.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedStaffForEval.map((a) => {
              const isDone = evaluatedStaffIds.has(a.user_id);
              return (
                <div key={a.user_id} className="p-5 bg-white dark:bg-slate-900/20 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">{a.staff?.full_name}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">Danışman</div>
                  </div>
                  {isDone ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg">
                      <ThumbsUp size={13} /> Değerlendirildi
                    </span>
                  ) : (
                    <button
                      onClick={() => { setSelectedEvalStaffId(a.user_id); setEvalScores({}); setEvalComments(''); }}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Star size={13} /> Değerlendir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLegislationsView = () => {
    return (
      <div className="space-y-6 animate-fadeIn text-xs">
        <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Scale size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Uyumlu Olduğunuz Mevzuatlar</h3>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">Danışmanınız tarafından firmanıza tanımlanmış yasal mevzuat listesi</p>
            </div>
          </div>

          {loadingLegs ? (
            <div className="py-20 text-center text-xs text-gray-400 dark:text-slate-500">Mevzuatlar yükleniyor...</div>
          ) : clientRegulations.length === 0 ? (
            <div className="py-20 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">Tesisinize atanmış aktif bir mevzuat kaydı bulunmuyor.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                    <th className="p-4">Mevzuat Adı</th>
                    <th className="p-4">Kategori</th>
                    <th className="p-4">Resmi Gazete No / Tarih</th>
                    <th className="p-4 text-right">Madde Takibi</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRegulations.map(reg => (
                    <tr key={reg.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/30 transition text-gray-600 dark:text-slate-300">
                      <td className="p-4 font-bold text-gray-800 dark:text-slate-200">{reg.title}</td>
                      <td className="p-4 uppercase font-semibold text-gray-500 dark:text-slate-400">{reg.category || 'Kanun/Yönetmelik'}</td>
                      <td className="p-4 text-gray-500 dark:text-slate-400">
                        {reg.rg_no ? `RG: ${reg.rg_no}` : ''} {reg.rg_date ? `(${new Date(reg.rg_date).toLocaleDateString('tr-TR')})` : ''}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleViewRegulationArticles(reg)}
                          className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold hover:underline"
                        >
                          Maddeleri Gör <BookOpen size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-gray-900 dark:text-white">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
            <p className="text-sm font-semibold tracking-wider text-gray-500 dark:text-slate-400">Veriler Güvenle Çekiliyor...</p>
          </div>
        </div>
      </div>
    );
  }

  // Sözleşme süresi + 30 günlük ek süre de dolmuşsa panel tamamen kilitlenir;
  // giriş çalışır ama hiçbir sekmeye erişilemez, sadece danışmanlık iletişim
  // bilgisi gösterilir. En güncel hizmet dönemine göre hesaplanır (yenilenmiş
  // bir müşteri artık yanlışlıkla kilitlenmez).
  const serviceStatus = computeServiceStatus(servicePeriods, clientDetails?.service_start_date, clientDetails?.service_terminated_at);
  const isLockedOut = computeAccessLockoutFromStatus(serviceStatus);
  if (isLockedOut) {
    const consultancy = clientDetails?.consultant_company;
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center text-gray-900 dark:text-white p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={26} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">Hizmet Süreniz Sona Erdi</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
                <b>{clientDetails?.name}</b>, <b className="text-teal-600 dark:text-teal-400">{consultancy?.name || 'danışmanlık firmanız'}</b> firmasından danışmanlık hizmeti almaktadır.
                Panelinize erişebilmek için lütfen danışmanınızla iletişime geçin.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-xs text-left">
              {consultancy?.email && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-400 dark:text-slate-500">E-posta</span>
                  <a href={`mailto:${consultancy.email}`} className="font-bold text-teal-600 dark:text-teal-400 truncate">{consultancy.email}</a>
                </div>
              )}
              {consultancy?.phone && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-400 dark:text-slate-500">Telefon</span>
                  <a href={`tel:${consultancy.phone}`} className="font-bold text-teal-600 dark:text-teal-400">{consultancy.phone}</a>
                </div>
              )}
              {!consultancy?.email && !consultancy?.phone && (
                <p className="text-gray-400 dark:text-slate-500 italic text-center">İletişim bilgisi bulunamadı, lütfen danışmanlık firmanızla doğrudan iletişime geçin.</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition border border-rose-200 dark:border-rose-900/30"
            >
              <LogOut size={14} /> Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Count helper definitions
  const pendingActions = actions.filter(a => a.status !== 'completed' && a.status !== 'done').length;
  // MSDS'e bağlı documents satırları bu sayaca dahil değil - onlar ayrı bir
  // alt-alanda (expiredMsdsCount) takip edilir, otomatik Evrak Talebi'ne girmez.
  const msdsDocIdSet = new Set(msdsDocuments.map((m) => m.document_id).filter(Boolean));
  const expiredDocs = documents.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date() && !msdsDocIdSet.has(d.id)).length;
  const expiredMsdsCount = msdsDocuments.filter((m) => computeMsdsStatus(m.expiry_date, m.warning_threshold_days || 30) === 'expired').length;

  return (
    <div className={isDark ? 'dark' : ''}>
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">

      {/* HEADER NAVBAR */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {clientDetails?.logo_url ? (
            <img src={clientDetails.logo_url} alt="Logo" className="w-10 h-10 rounded-xl border border-gray-200 dark:border-slate-700 object-contain bg-white dark:bg-slate-950 p-1" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
              <Building size={20} />
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-base md:text-lg tracking-tight text-gray-900 dark:text-white flex items-center gap-1.5">
              {clientDetails?.name}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 uppercase tracking-wider">MÜŞTERİ PANELİ</span>
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">Hizmet Sağlayıcı: <span className="text-teal-600 dark:text-teal-400">{clientDetails?.consultant_company?.name || 'Danışmanlık Firması'}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition border border-gray-200 dark:border-slate-700"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition border border-rose-200 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-900/60"
          >
            <LogOut size={14} /> Çıkış Yap
          </button>
        </div>
      </header>

      {/* TAB NAVIGATION */}
      <nav className="bg-white/60 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-800 px-4 sticky top-[73px] z-30 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-1 py-2">
          {visibleNavTabs.map((tab) => {
            const isBlinking =
              (tab.id === 'evaluation' && hasPendingEvaluation && activeTab !== 'evaluation') ||
              (tab.id === 'doc_requests' && hasPendingDocRequests && activeTab !== 'doc_requests');
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-teal-600 text-white shadow-md'
                    : isBlinking
                      ? 'text-teal-700 dark:text-teal-300 animate-pulse bg-teal-100 dark:bg-teal-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-gray-200 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon} {tab.label}
                {isBlinking && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="p-6 flex-1 max-w-7xl mx-auto w-full">

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Warning if expired docs exist */}
            {(expiredDocs > 0 || expiredMsdsCount > 0) && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <h5 className="text-xs font-extrabold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Dikkat Edilmesi Gereken Evraklar Mevcut</h5>
                  <p className="text-xs text-rose-300 mt-1">
                    {expiredDocs > 0 && <>Süresi geçmiş {expiredDocs} adet belgeniz için otomatik evrak talebi oluşturuldu. </>}
                    {expiredMsdsCount > 0 && <>Süresi geçmiş {expiredMsdsCount} adet MSDS/SDS kaydınız var.</>}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {expiredDocs > 0 && (
                      <button onClick={() => setActiveTab('doc_requests')} className="text-[11px] font-bold text-rose-700 dark:text-rose-300 underline">
                        Evrak Taleplerine Git
                      </button>
                    )}
                    {expiredMsdsCount > 0 && (
                      <button onClick={() => { setActiveTab('docs'); setDocsSubView('msds'); }} className="text-[11px] font-bold text-rose-700 dark:text-rose-300 underline">
                        MSDS Formlarını Görüntüle
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Firm Information */}
              <div className="bg-white dark:bg-slate-900/30 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider pb-3 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2">
                  <Shield size={16} className="text-teal-600 dark:text-teal-500" /> Firma Bilgileri
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-slate-500 block mb-1">Firma Ünvanı</span>
                    <span className="font-bold text-gray-800 dark:text-slate-200">{clientDetails?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-slate-500 block mb-1">Vergi Numarası</span>
                    <span className="font-bold text-gray-800 dark:text-slate-200">{clientDetails?.tax_no || 'Belirtilmedi'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-slate-500 block mb-1">Telefon</span>
                    <span className="font-bold text-gray-800 dark:text-slate-200">{clientDetails?.phone || 'Belirtilmedi'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-slate-500 block mb-1">E-posta</span>
                    <span className="font-bold text-gray-800 dark:text-slate-200">{clientDetails?.email || 'Belirtilmedi'}</span>
                  </div>
                  {clientDetails?.kep_address && (
                    <div>
                      <span className="text-gray-400 dark:text-slate-500 block mb-1">KEP Adresi</span>
                      <span className="font-bold text-gray-800 dark:text-slate-200">{clientDetails.kep_address}</span>
                    </div>
                  )}
                  <div className={clientDetails?.kep_address ? '' : 'col-span-2'}>
                    <span className="text-gray-400 dark:text-slate-500 block mb-1">Tesis Konumu</span>
                    <span className="font-bold text-gray-800 dark:text-slate-200">{clientDetails?.address || 'Belirtilmedi'}</span>
                    {clientDetails?.latitude && clientDetails?.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${clientDetails.latitude},${clientDetails.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold mt-1"
                      >
                        <MapPin size={11} /> Haritada Gör
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Service / Permit Status */}
              <div className="bg-white dark:bg-slate-900/30 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider pb-3 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2">
                  <Layers size={16} className="text-teal-600 dark:text-teal-500" /> Hizmet ve İzin Durumu
                </h3>

                {serviceStatus ? (() => {
                  const status = serviceStatus;
                  return (
                    <div className="p-3 bg-gray-50 dark:bg-slate-950/40 rounded-xl border border-gray-200 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Hizmet Süresi</span>
                        {status.isExpired ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 uppercase">Süresi Doldu</span>
                        ) : status.isWarning ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 uppercase animate-pulse">Son {status.daysLeft} Gün</span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 uppercase">{status.daysLeft} Gün Kaldı</span>
                        )}
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-500 dark:text-slate-400">
                        <span>Başlangıç: <b className="text-gray-800 dark:text-slate-200">{status.startDate.toLocaleDateString('tr-TR')}</b></span>
                        <span>Bitiş: <b className="text-gray-800 dark:text-slate-200">{status.expiryDate.toLocaleDateString('tr-TR')}</b></span>
                      </div>
                      {clientDetails?.contract_file_url && (
                        <div className="pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-800 flex justify-end">
                          <a href={clientDetails.contract_file_url} target="_blank" rel="noreferrer" className="text-[11px] text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold flex items-center gap-1">
                            Sözleşme Nüshası ↗
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <p className="text-xs text-gray-400 dark:text-slate-500 py-2">Hizmet başlangıç tarihi henüz tanımlanmamış.</p>
                )}

                <div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Çevre İzin ve Lisans Yönetmeliği Kapsamındaki Yeri</span>
                  {clientDetails?.permit_stage === 'ek1' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 uppercase">EK-1 Kapsamında</span>
                  ) : clientDetails?.permit_stage === 'ek2' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 uppercase">EK-2 Kapsamında</span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 uppercase">Kapsam Dışı</span>
                  )}

                  {clientDetails?.permit_stage && clientDetails.permit_stage !== 'out_of_scope' && (() => {
                    const articlesArray: string[] = Array.isArray(clientDetails.permit_articles)
                      ? clientDetails.permit_articles
                      : typeof clientDetails.permit_articles === 'string'
                        ? JSON.parse(clientDetails.permit_articles || '[]')
                        : [];
                    if (articlesArray.length === 0) return null;
                    const source = permitCategories.filter((c) => c.stage === clientDetails.permit_stage);
                    return (
                      <div className="mt-2 space-y-1.5">
                        {articlesArray.map((code) => {
                          const art = source.find(a => a.code === code);
                          return (
                            <div key={code} className="text-[11px] bg-gray-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 flex gap-2">
                              <span className="font-mono font-bold text-blue-700 dark:text-blue-400 shrink-0">{code}</span>
                              <span className="text-gray-500 dark:text-slate-400">{art?.title || 'Madde tanımı bulunamadı'}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-3 border-t border-dashed border-gray-200 dark:border-slate-800">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Çevresel Etki Değerlendirmesi Yönetmeliği Kapsamındaki Yeri (ÇED)</span>
                  {clientDetails?.ced_status === 'ek1' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 uppercase">EK-1 Kapsamında</span>
                  ) : clientDetails?.ced_status === 'ek2' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 uppercase">EK-2 Kapsamında</span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 uppercase">Kapsam Dışı</span>
                  )}

                  {clientDetails?.ced_status && clientDetails.ced_status !== 'out_of_scope' && (() => {
                    const articlesArray: string[] = Array.isArray(clientDetails.ced_articles)
                      ? clientDetails.ced_articles
                      : typeof clientDetails.ced_articles === 'string'
                        ? JSON.parse(clientDetails.ced_articles || '[]')
                        : [];
                    if (articlesArray.length === 0) return null;
                    const source = cedCategories.filter((c) => c.stage === clientDetails.ced_status);
                    return (
                      <div className="mt-2 space-y-1.5">
                        {articlesArray.map((code) => {
                          const art = source.find(a => a.code === code);
                          return (
                            <div key={code} className="text-[11px] bg-gray-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 flex gap-2">
                              <span className="font-mono font-bold text-blue-700 dark:text-blue-400 shrink-0">{code}</span>
                              <span className="text-gray-500 dark:text-slate-400">{art?.title || 'Madde tanımı bulunamadı'}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Next Visits */}
              <div className="bg-white dark:bg-slate-900/30 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 md:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider pb-3 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2">
                  <Calendar size={16} className="text-teal-600 dark:text-teal-500" /> Yaklaşan Ziyaretler
                </h3>
                {visits.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 py-6 text-center">Planlanmış yakın bir ziyaret bulunmamaktadır.</p>
                ) : (
                  <div className="space-y-3">
                    {visits.slice(0, 3).map((v) => (
                      <div key={v.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800/80 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-gray-800 dark:text-slate-200 block">{v.purpose || 'Çevre Denetimi & Ziyaret'}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">{v.duration_hours || 2} saat planlandı</span>
                        </div>
                        <span className="text-xs font-extrabold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-900/40">
                          {new Date(v.visit_date).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: CLIENT DOCUMENTS */}
        {activeTab === 'docs' && (
          <div className="space-y-4">
            {/* Belgelerim içinde "sayfa içinde sayfa": Tüm Belgeler / MSDS ayrımı */}
            <div className="flex gap-1.5 bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl p-1.5">
              <button
                onClick={() => setDocsSubView('all')}
                className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  docsSubView === 'all'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                Tüm Belgeler
              </button>
              <button
                onClick={() => setDocsSubView('msds')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  docsSubView === 'msds'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <FlaskConical size={14} /> MSDS/SDS Formları
                {expiredMsdsCount > 0 && docsSubView !== 'msds' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>

            {docsSubView === 'all' ? (
              <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Sistemde Kayıtlı Belgeleriniz</h3>
                  <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 dark:text-slate-400">{documents.length} Adet</span>
                </div>

                {documents.length === 0 ? (
                  <div className="py-20 text-center space-y-3">
                    <FileText size={40} className="text-gray-300 dark:text-slate-600 mx-auto" />
                    <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Bu firma için yüklenmiş aktif belge bulunmamaktadır.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                          <th className="p-4">Belge Adı</th>
                          <th className="p-4">Belge Türü</th>
                          <th className="p-4">Yayın Tarihi</th>
                          <th className="p-4">Geçerlilik Tarihi</th>
                          <th className="p-4">Boyut</th>
                          <th className="p-4 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => {
                          const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                          return (
                            <tr key={doc.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/30 transition">
                              <td className="p-4 font-bold text-gray-800 dark:text-slate-200">{doc.title}</td>
                              <td className="p-4 text-gray-500 dark:text-slate-400">{doc.type_def?.label || 'Belirtilmedi'}</td>
                              <td className="p-4 text-gray-500 dark:text-slate-400">{new Date(doc.acquisition_date).toLocaleDateString('tr-TR')}</td>
                              <td className="p-4">
                                {doc.is_indefinite ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">Süresiz</span>
                                ) : (
                                  <span className={`font-bold ${isExpired ? 'text-rose-500' : 'text-slate-300'}`}>
                                    {new Date(doc.expiry_date).toLocaleDateString('tr-TR')}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-gray-400 dark:text-slate-500">{formatFileSize(doc.file_size)}</td>
                              <td className="p-4 text-right">
                                {doc.file_url ? (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold"
                                  >
                                    Görüntüle <ExternalLink size={12} />
                                  </a>
                                ) : (
                                  <span className="text-gray-400 dark:text-slate-600">Dosya Yok</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20">
                  <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <FlaskConical size={14} className="text-teal-500" /> MSDS/SDS Formlarınız
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                    Süresi dolan veya bilgileri hatalı tespit edilmiş MSDS/SDS kayıtlarını buradan düzeltip güncel belgeyi yükleyebilirsiniz.
                  </p>
                </div>

                {msdsDocuments.length === 0 ? (
                  <div className="py-16 text-center text-xs text-gray-400 dark:text-slate-500 italic">Kayıtlı MSDS/SDS belgeniz bulunmuyor.</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {msdsDocuments.map((m) => {
                      const status = computeMsdsStatus(m.expiry_date, m.warning_threshold_days || 30);
                      const days = computeDaysRemaining(m.expiry_date);
                      const isEditing = editingMsdsId === m.id;
                      return (
                        <div key={m.id} className="p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-bold text-sm text-gray-800 dark:text-slate-200">{m.product_name || 'İsimsiz Ürün'}</div>
                              <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                                Ana Tarih: {m.primary_date || '—'} · Geçerlilik: {m.expiry_date || '—'}
                                {days !== null && (days >= 0 ? ` · ${days} gün kaldı` : ` · ${Math.abs(days)} gün geçti`)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${MSDS_STATUS_BADGE_CLASSES[status]}`}>
                                {MSDS_STATUS_LABELS_TR[status]}
                              </span>
                              <button
                                onClick={() => (isEditing ? setEditingMsdsId(null) : handleStartEditMsds(m))}
                                className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline whitespace-nowrap"
                              >
                                {isEditing ? 'Vazgeç' : 'Düzenle / Güncel Belge Yükle'}
                              </button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="mt-4 bg-gray-50 dark:bg-slate-950/30 border border-gray-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ürün Adı</label>
                                  <input
                                    type="text"
                                    value={msdsEditProductName}
                                    onChange={(e) => setMsdsEditProductName(e.target.value)}
                                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ana Tarih</label>
                                  <input
                                    type="date"
                                    value={msdsEditPrimaryDate}
                                    onChange={(e) => setMsdsEditPrimaryDate(e.target.value)}
                                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Güncel PDF Yükle (opsiyonel)</label>
                                <input
                                  type="file"
                                  accept=".pdf"
                                  onChange={(e) => e.target.files?.[0] && handleMsdsFileSelect(e.target.files[0])}
                                  className="text-xs text-gray-600 dark:text-slate-300"
                                />
                                {msdsParsing && (
                                  <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-1">
                                    <Loader size={11} className="animate-spin" /> PDF okunuyor...
                                  </span>
                                )}
                                {msdsEditFile && !msdsParsing && (
                                  <span className="text-[11px] text-emerald-600 block mt-1">{msdsEditFile.name} seçildi</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleSaveMsdsEdit(m)}
                                disabled={msdsSaving}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
                              >
                                {msdsSaving ? 'Kaydediliyor...' : 'Kaydet'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2.5: EVRAK TALEPLERİ */}
        {activeTab === 'doc_requests' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 bg-gray-50 dark:bg-slate-950/20">
              <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Inbox size={14} className="text-teal-500" /> Evrak Talepleri
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Danışmanınızın sizden talep ettiği belgeler burada listelenir. Belgeyi seçip yükleyerek talebi karşılayabilirsiniz.
              </p>
            </div>

            {documentRequests.length === 0 ? (
              <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-xs italic bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl">
                Henüz bir evrak talebi bulunmuyor.
              </div>
            ) : (
              <>
                {documentRequests.filter((r) => r.status === 'pending').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Bekleyen Talepler</h4>
                    {documentRequests.filter((r) => r.status === 'pending').map((r) => (
                      <div key={r.id} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                            {r.title}
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 animate-pulse">Bekliyor</span>
                          </div>
                          {r.description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{r.description}</p>}
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Talep tarihi: {new Date(r.created_at).toLocaleDateString('tr-TR')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                            <Upload size={13} />
                            {docReqUploadFiles[r.id] ? docReqUploadFiles[r.id]!.name.slice(0, 18) : 'Dosya Seç'}
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => setDocReqUploadFiles((prev) => ({ ...prev, [r.id]: e.target.files?.[0] || null }))}
                            />
                          </label>
                          <button
                            onClick={() => handleFulfillDocumentRequest(r)}
                            disabled={!docReqUploadFiles[r.id] || fulfillingRequestId === r.id}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {fulfillingRequestId === r.id ? 'Yükleniyor...' : 'Yükle'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {documentRequests.filter((r) => r.status === 'fulfilled').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-6">Karşılanan Talepler</h4>
                    {documentRequests.filter((r) => r.status === 'fulfilled').map((r) => (
                      <div key={r.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                            {r.title}
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40">Karşılandı</span>
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                            {r.fulfilled_at && `Yükleme: ${new Date(r.fulfilled_at).toLocaleDateString('tr-TR')}`}
                          </p>
                        </div>
                        {r.document?.file_url && (
                          <a
                            href={r.document.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40 px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0"
                          >
                            <Download size={13} /> İndir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: COMPLIANCE ACTIONS */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center bg-gray-50 dark:bg-slate-950/20">
              <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Aksiyon Planı ve Denetim Bulguları</h3>
              <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 dark:text-slate-400">{actions.length} Aksiyon</span>
            </div>

            {actions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl py-20 text-center space-y-3">
                <CheckCircle size={40} className="text-gray-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Planlanmış veya bekleyen bir aksiyon bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actions.map((act) => {
                  const isPending = act.status === 'pending';
                  const isOverdue = act.due_date && new Date(act.due_date) < new Date() && isPending;
                  const canRespond = act.status === 'pending' || act.status === 'correction_requested';
                  const isEditing = completingActionId === act.id;

                  return (
                    <div
                      key={act.id}
                      className={`p-5 rounded-2xl border transition ${act.status === 'approved' ? 'bg-gray-50 dark:bg-slate-950/20 border-gray-200 dark:border-slate-900' : 'bg-white dark:bg-slate-900/30 border-gray-200 dark:border-slate-800'}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{act.title || 'Aksiyon'}</span>
                        {act.status === 'approved' ? (
                          <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 px-2.5 py-0.5 rounded-full uppercase shrink-0">Tamamlandı</span>
                        ) : act.status === 'completed' ? (
                          <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 px-2.5 py-0.5 rounded-full uppercase shrink-0">Onay Bekliyor</span>
                        ) : act.status === 'correction_requested' ? (
                          <span className="text-[10px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 px-2.5 py-0.5 rounded-full uppercase shrink-0">Düzeltme İstendi</span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 px-2.5 py-0.5 rounded-full uppercase animate-pulse shrink-0">Gecikmiş</span>
                        ) : (
                          <span className="text-[10px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 px-2.5 py-0.5 rounded-full uppercase shrink-0">Bekliyor</span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 line-clamp-3"><span className="font-semibold text-gray-500 dark:text-slate-400">Açıklama:</span> {act.description || 'Belirtilmedi'}</p>

                      {act.status === 'correction_requested' && act.manager_comment && (
                        <div className="mt-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-lg p-2.5 text-xs text-rose-300">
                          <span className="font-bold text-[9px] uppercase tracking-wide block mb-0.5">Düzeltme Gerekçesi</span>
                          <p className="italic">{act.manager_comment}</p>
                        </div>
                      )}

                      {act.notes && (act.status === 'completed' || act.status === 'approved') && (
                        <div className="mt-2 bg-gray-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 text-xs">
                          <span className="font-bold text-[9px] uppercase tracking-wide text-gray-400 dark:text-slate-500 block mb-0.5">Gönderilen Açıklama</span>
                          <p className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{act.notes}</p>
                          {act.evidence_url && (
                            <a href={act.evidence_url} target="_blank" rel="noreferrer" className="inline-block mt-1.5 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold">
                              📎 Yüklenen Belgeyi Gör ↗
                            </a>
                          )}
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-slate-800 flex justify-between items-center text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <span>Hedef Tarih</span>
                        <span className={isOverdue ? 'text-rose-500 font-extrabold' : 'text-slate-300'}>
                          {act.due_date ? new Date(act.due_date).toLocaleDateString('tr-TR') : 'Süresiz'}
                        </span>
                      </div>

                      {canRespond && (
                        isEditing ? (
                          <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-slate-800 space-y-2.5">
                            <textarea
                              rows={2}
                              placeholder="Yapılan işi kısaca açıklayın..."
                              value={actionNoteInput}
                              onChange={(e) => setActionNoteInput(e.target.value)}
                              className="w-full border rounded-lg p-2 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
                            />
                            <input
                              type="file"
                              onChange={(e) => setActionFileInput(e.target.files?.[0] || null)}
                              className="w-full text-[11px] text-gray-500 dark:text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletingActionId(null);
                                  setActionNoteInput('');
                                  setActionFileInput(null);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-slate-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-800 transition"
                              >
                                Vazgeç
                              </button>
                              <button
                                type="button"
                                disabled={submittingAction}
                                onClick={() => handleClientSubmitAction(act.id)}
                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                              >
                                {submittingAction ? 'Gönderiliyor...' : 'Gönder'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingActionId(act.id);
                              setActionNoteInput('');
                              setActionFileInput(null);
                            }}
                            className="mt-3 w-full border border-dashed border-teal-300 dark:border-teal-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 font-bold py-2 rounded-lg text-xs transition"
                          >
                            📎 Kanıt Dosyası Yükle & Tamamlandı İşaretle
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WASTE DISPATCHES */}
        {activeTab === 'waste' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Atık Gönderim Sevkiyat Tarihçesi</h3>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{wastes.length} kayıtlı sevkiyat</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setNewWasteCode('');
                    setNewWasteExitDate(new Date().toISOString().split('T')[0]);
                    setNewWasteQuantity('');
                    setNewWasteTransporterId('');
                    setNewWasteDestinationId('');
                    setNewWasteDisposalType('recovery');
                    setNewWasteDisposalCode('');
                    setNewWasteDescription('');
                    setShowAddWasteModal(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md"
                >
                  <PlusCircle size={14} /> Yeni Atık Kaydı
                </button>
                <button
                  onClick={() => {
                    setNewCompanyType('transporter');
                    setNewCompanyName('');
                    setNewCompanyAddress('');
                    setShowAddCompanyModal(true);
                  }}
                  className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <PlusCircle size={14} className="text-teal-400" /> Firma Ekle
                </button>
                <button
                  onClick={handleGenerateWasteReport}
                  disabled={generatingReport}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md disabled:opacity-50"
                >
                  <FileText size={14} /> {generatingReport ? 'Oluşturuluyor...' : 'Çıkış Raporu (PDF)'}
                </button>
              </div>
            </div>

            {/* FILTER BAR */}
            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="Atık kodu veya açıklama ara..."
                  value={wasteSearchQuery}
                  onChange={(e) => setWasteSearchQuery(e.target.value)}
                  className="border rounded-xl p-2 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white w-52"
                />

                <div className="flex gap-1.5 bg-gray-100 dark:bg-slate-800/60 p-1 rounded-xl">
                  {(['all', 'recovery', 'disposal'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setWasteFilterDisposal(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        wasteFilterDisposal === t ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t === 'all' ? 'Tümü' : t === 'recovery' ? 'Geri Kazanım' : 'Bertaraf'}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1.5 bg-gray-100 dark:bg-slate-800/60 p-1 rounded-xl">
                  {(['all', 'monthly', 'yearly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setWasteFilterPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        wasteFilterPeriod === p ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p === 'all' ? 'Tüm Zamanlar' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
                    </button>
                  ))}
                </div>

                {wasteFilterPeriod === 'monthly' && (
                  <input
                    type="month"
                    value={wasteFilterMonth}
                    onChange={(e) => setWasteFilterMonth(e.target.value)}
                    className="border rounded-xl p-2 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
                  />
                )}
                {wasteFilterPeriod === 'yearly' && (
                  <input
                    type="number"
                    value={wasteFilterYear}
                    onChange={(e) => setWasteFilterYear(e.target.value)}
                    className="border rounded-xl p-2 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white w-24"
                  />
                )}
              </div>
              <span className="text-[10px] font-medium px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 dark:text-slate-400">
                {getFilteredWastes().length} / {wastes.length} kayıt gösteriliyor
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {getFilteredWastes().length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <Trash2 size={40} className="text-gray-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Filtrenize uyan bir atık gönderimi bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                      <th className="p-4">Atık Kodu</th>
                      <th className="p-4">Miktar (kg)</th>
                      <th className="p-4">Taşıyıcı Firma</th>
                      <th className="p-4">Alıcı / Bertarafçı</th>
                      <th className="p-4">Bertaraf/Geri Kazanım Yöntemi</th>
                      <th className="p-4">Sevkiyat Tarihi</th>
                      <th className="p-4">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredWastes().map((w) => (
                      <tr key={w.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/30 transition text-gray-600 dark:text-slate-300">
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            w.waste_code?.includes('*')
                              ? 'bg-rose-50 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
                              : 'bg-emerald-50 dark:bg-green-900/50 text-emerald-700 dark:text-green-300 border border-emerald-200 dark:border-green-800/50'
                          }`}>
                            {w.waste_code || '-'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          {w.quantity_kg ? Number(w.quantity_kg).toLocaleString('tr-TR') + ' kg' : '-'}
                        </td>
                        <td className="p-4 text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {w.transporter_company?.name || w.transporter || '-'}
                        </td>
                        <td className="p-4 text-xs font-semibold text-gray-600 dark:text-slate-300">
                          {w.destination_company?.name || w.destination || '-'}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            w.disposal_type === 'recovery'
                              ? 'bg-emerald-50 dark:bg-green-950/40 text-emerald-700 dark:text-green-400 border border-emerald-200 dark:border-green-900/30'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
                          }`}>
                            {w.disposal_type === 'recovery' ? 'Geri Kazanım' : 'Bertaraf'}
                            {w.disposal_code ? ' (' + w.disposal_code + ')' : ''}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 dark:text-slate-400">
                          {w.exit_date ? new Date(w.exit_date).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="p-4 text-xs text-gray-500 dark:text-slate-400 italic max-w-xs truncate" title={w.description}>
                          {w.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS & VISITS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Visit Schedules */}
            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Danışman Ziyaret Planları</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 dark:text-slate-400">{visits.length} Toplam</span>
              </div>

              {visits.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">Planlanmış veya gerçekleşmiş ziyaret kaydı bulunmuyor.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                        <th className="p-4">Ziyaret Tarihi</th>
                        <th className="p-4">Ziyaret Amacı / Açıklama</th>
                        <th className="p-4">Süre (Saat)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr key={v.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/30 transition text-gray-600 dark:text-slate-300">
                          <td className="p-4 font-bold text-teal-600 dark:text-teal-400">{new Date(v.visit_date).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4 font-semibold text-gray-800 dark:text-slate-200">{v.purpose || '-'}</td>
                          <td className="p-4">{v.duration_hours || '-'} Saat</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Environmental Reports */}
            <div className="bg-white dark:bg-slate-900/20 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/20 flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">Yayınlanmış Çevre Raporları</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 dark:text-slate-400">{reports.length} Rapor</span>
              </div>

              {reports.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-xs font-medium">Yüklenmiş veya imzalanmış çevre raporu bulunmuyor.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/40 text-gray-500 dark:text-slate-400 font-bold">
                        <th className="p-4">Rapor Başlığı</th>
                        <th className="p-4">Dönem</th>
                        <th className="p-4">Islak İmzalı Rapor</th>
                        <th className="p-4">Oluşturulma Tarihi</th>
                        <th className="p-4 text-right">Dosya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id} className="border-b border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900/30 transition text-gray-600 dark:text-slate-300">
                          <td className="p-4 font-bold text-gray-800 dark:text-slate-200">
                            {r.report_type === 'monthly' ? 'Aylık Değerlendirme' : r.report_type === 'yearly' ? 'Yıllık İç Tetkik' : (r.title || 'Çevre Raporu')}
                          </td>
                          <td className="p-4">{r.period || '-'}</td>
                          <td className="p-4">
                            {r.wet_signature_url ? (
                              <a 
                                href={r.wet_signature_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-teal-400 font-bold hover:underline"
                              >
                                Islak İmzalı Raporu Gör ↗
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-slate-500">Henüz Yüklenmedi</span>
                            )}
                          </td>
                          <td className="p-4">{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4 text-right">
                            {r.file_url ? (
                              <a 
                                href={r.file_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-bold inline-flex items-center gap-1"
                              >
                                İndir <Download size={12} />
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-slate-600">Yok</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}


        {/* TAB 6: MANDATORY DOCUMENT MATRIX */}
        {activeTab === 'matrix' && (
          renderMatrixView()
        )}

        {/* TAB 7: SAHA QR DENETİMLERİ */}
        {activeTab === 'inspections' && (
          renderInspectionsView()
        )}

        {/* TAB 8: MEVZUATLAR */}
        {activeTab === 'legislations' && (
          renderLegislationsView()
        )}

        {/* TAB 9: DANIŞMAN DEĞERLENDİRME */}
        {activeTab === 'evaluation' && (
          renderEvaluationView()
        )}
            </main>


      {/* SAHA DENETİM CEVAP DETAY MODALI */}
      {selectedSubmissionForDetail && (() => {
        const answers = submissionAnswers[selectedSubmissionForDetail.id];
        const submitterName = [selectedSubmissionForDetail.submitted_by_name, selectedSubmissionForDetail.submitted_by_surname].filter(Boolean).join(' ').trim();
        const findingsCount = (answers || []).filter((a: any) =>
          (a.question?.question_type === 'yes_no' || a.question?.question_type === 'compliant') && a.answer_bool === false
        ).length;

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scaleIn flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-3.5 mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <QrCode className="text-teal-400" size={16} /> Denetim Detayları
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">
                    Nokta: <b>{selectedSubmissionForDetail.point?.name}</b>
                    {selectedSubmissionForDetail.point?.location_description && <> ({selectedSubmissionForDetail.point.location_description})</>}
                    {' '}| Form: <b>{selectedSubmissionForDetail.point?.form?.title || 'Genel Form'}</b>
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                    Dolduran: <b className="text-gray-600 dark:text-slate-300">{submitterName || 'Anonim Saha Personeli'}</b>
                    {' '}| Tarih: {new Date(selectedSubmissionForDetail.submitted_at).toLocaleString('tr-TR')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSubmissionForDetail(null);
                    setExpandedSubmissionId(null);
                  }}
                  className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition font-bold shrink-0"
                >
                  Kapat
                </button>
              </div>

              {answers && (
                <div className="mb-4">
                  {findingsCount > 0 ? (
                    <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-[10px] font-black px-2.5 py-1 rounded-full">
                      ⚠️ {findingsCount} Uyumsuz Madde Tespit Edildi
                    </span>
                  ) : (
                    <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-[10px] font-black px-2.5 py-1 rounded-full">
                      ✅ Tam Uyumlu
                    </span>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {selectedSubmissionForDetail.general_notes && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 text-xs text-amber-300">
                    <span className="font-extrabold uppercase text-[9px] tracking-wide block mb-1">Saha Tespitleri / Genel Notlar</span>
                    <p className="leading-relaxed whitespace-pre-wrap">{selectedSubmissionForDetail.general_notes}</p>
                  </div>
                )}

                {!answers ? (
                  <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-500">Cevaplar yükleniyor...</div>
                ) : answers.length === 0 ? (
                  <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-500">Kayıtlı soru-cevap bulunamadı.</div>
                ) : (
                  answers.map((ans: any, idx: number) => (
                    <div key={ans.id} className="p-3 bg-gray-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-xl flex justify-between items-start gap-3">
                      <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex gap-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span>{ans.question?.question_text}</span>
                      </div>
                      <div className="shrink-0 font-bold text-xs">
                        {ans.question?.question_type === 'yes_no' && (
                          ans.answer_bool ? (
                            <span className="text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/40">EVET</span>
                          ) : (
                            <span className="text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/40">HAYIR</span>
                          )
                        )}
                        {ans.question?.question_type === 'compliant' && (
                          ans.answer_bool ? (
                            <span className="text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/40">UYGUN</span>
                          ) : (
                            <span className="text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/40">UYGUN DEĞİL</span>
                          )
                        )}
                        {ans.question?.question_type === 'text' && (
                          <span className="text-gray-600 dark:text-slate-300 font-medium">{ans.answer_text || <span className="italic text-gray-400 dark:text-slate-500">Boş bırakılmış</span>}</span>
                        )}
                        {ans.question?.question_type === 'rating' && (
                          <span className="text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900/40">⭐ {ans.answer_text} / 5</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* DENETİM FORMU OLUŞTURMA MODALI */}
      {showCreateInspectionFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText size={20} /> Yeni Saha Denetim Formu Tasarla
                </h3>
                <p className="text-xs opacity-80">Kendi tesisiniz için evet/hayır tarzı sorulardan oluşan bir kontrol listesi oluşturun</p>
              </div>
              <button onClick={() => setShowCreateInspectionFormModal(false)} className="p-1 hover:bg-white/10 rounded-full text-white transition">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveInspectionForm} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Form Başlığı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Atık Depolama Sahası Günlük Kontrolü"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newInsFormTitle}
                  onChange={(e) => setNewInsFormTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Yönergeler</label>
                <textarea
                  rows={2}
                  placeholder="Formu dolduracak personelin dikkat etmesi gereken kurallar varsa belirtin..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200 resize-none"
                  value={newInsFormDesc}
                  onChange={(e) => setNewInsFormDesc(e.target.value)}
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center border-b pb-2 border-gray-100 dark:border-slate-700">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle size={16} className="text-blue-600" /> Form Soruları
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setNewInsFormQuestions([...newInsFormQuestions, { question_text: '', question_type: 'yes_no', is_required: true }])
                    }
                    className="bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-blue-200 dark:border-slate-600 transition"
                  >
                    <Plus size={14} /> Soru Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {newInsFormQuestions.map((q, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col md:flex-row gap-3 items-end animate-fadeIn">
                      <div className="flex-shrink-0 text-xs font-bold bg-slate-200 dark:bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 self-center">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-1 w-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Soru Metni *</label>
                        <input
                          type="text"
                          required
                          placeholder="Örn: Konteynerlerin kapakları kapalı ve sızdırmaz mı?"
                          className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                          value={q.question_text}
                          onChange={(e) => {
                            const updated = [...newInsFormQuestions];
                            updated[idx].question_text = e.target.value;
                            setNewInsFormQuestions(updated);
                          }}
                        />
                      </div>
                      <div className="w-full md:w-36 space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Soru Türü</label>
                        <select
                          className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 font-semibold"
                          value={q.question_type}
                          onChange={(e) => {
                            const updated = [...newInsFormQuestions];
                            updated[idx].question_type = e.target.value as any;
                            setNewInsFormQuestions(updated);
                          }}
                        >
                          <option value="yes_no">EVET / HAYIR</option>
                          <option value="compliant">UYGUN / DEĞİL</option>
                          <option value="text">Serbest Metin</option>
                          <option value="rating">Derecelendirme (1-5)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={q.is_required}
                            onChange={(e) => {
                              const updated = [...newInsFormQuestions];
                              updated[idx].is_required = e.target.checked;
                              setNewInsFormQuestions(updated);
                            }}
                            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                          />
                          Zorunlu
                        </label>
                        {newInsFormQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewInsFormQuestions(newInsFormQuestions.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                            title="Soruyu Kaldır"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-slate-700 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateInspectionFormModal(false)}
                  className="px-5 py-2.5 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300 border-slate-200 dark:border-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingInspectionForm}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg disabled:opacity-50"
                >
                  {savingInspectionForm ? 'Kaydediliyor...' : 'Form Şablonunu Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DENETİM NOKTASI + QR OLUŞTURMA MODALI */}
      {showCreateInspectionPointModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-lg">
                <PlusCircle size={18} className="text-teal-600" /> Yeni Denetim Noktası ve QR Tanımla
              </h3>
              <button onClick={() => setShowCreateInspectionPointModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInspectionPoint} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Kullanılacak Form Şablonu *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newInsPointFormId}
                  onChange={(e) => setNewInsPointFormId(e.target.value)}
                >
                  <option value="">-- Form Seçin --</option>
                  {inspectionForms.map((form) => (
                    <option key={form.id} value={form.id}>{form.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Nokta Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Kazan Dairesi Atıksu Çıkışı, A Bölgesi Deposu"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newInsPointName}
                  onChange={(e) => setNewInsPointName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Lokasyon Açıklaması / Konum</label>
                <textarea
                  rows={2}
                  placeholder="Örn: Fabrika arka giriş kapısının sağ tarafındaki konteyner kafesi..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200 resize-none"
                  value={newInsPointLocation}
                  onChange={(e) => setNewInsPointLocation(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={savingInspectionPoint}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {savingInspectionPoint ? 'Oluşturuluyor...' : 'Noktayı ve QR Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateInspectionPointModal(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR KOD GÖSTERİM MODALI */}
      {showQrModal && qrPointForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn text-center">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{qrPointForModal.name}</h3>
              <button onClick={() => setShowQrModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>
            {qrCodeDataUrl && (
              <div className="flex flex-col items-center gap-3">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48 border border-gray-100 dark:border-slate-700 rounded-xl" />
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Bu QR kodu sahada bu noktaya yerleştirip personelin telefonla okutmasını sağlayın.</p>
                <a
                  href={qrCodeDataUrl}
                  download={`qr-${qrPointForModal.qr_token}.png`}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-xl font-bold text-xs transition"
                >
                  QR Kodu İndir
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEVZUAT MADDELERİ DETAY MODALI */}
      {showLegArticlesModal && selectedRegulation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-scaleIn flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start border-b border-gray-200 dark:border-slate-800 pb-3.5 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Scale className="text-blue-400" size={16} /> Mevzuat Maddeleri ve Uyum Takibi
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">
                  Mevzuat: <b>{selectedRegulation.title}</b>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLegArticlesModal(false);
                  setSelectedRegulation(null);
                  setRegulationArticles([]);
                }}
                className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition font-bold"
              >
                Kapat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingLegs ? (
                <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-500">Maddeler yükleniyor...</div>
              ) : regulationArticles.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-500">Bu mevzuata ait eklenmiş madde bulunmamaktadır.</div>
              ) : (
                regulationArticles.map((art) => (
                  <div key={art.id} className="p-4 bg-gray-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-xs font-black text-teal-600 dark:text-teal-400 uppercase tracking-wide">Madde {art.article_no}</span>
                      <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                        art.compliance_status === 'compliant' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30' :
                        art.compliance_status === 'partial' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' :
                        art.compliance_status === 'non_compliant' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30 animate-pulse' :
                        'bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700/50'
                      }`}>
                        {art.compliance_status === 'compliant' ? 'Uyumlu' :
                         art.compliance_status === 'partial' ? 'Kısmi Uyumlu' :
                         art.compliance_status === 'non_compliant' ? 'Uyumsuz' : 'Değerlendirilmedi'}
                      </span>
                    </div>
                    {art.title && <div className="text-xs font-bold text-gray-800 dark:text-slate-200">{art.title}</div>}
                    <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-line bg-gray-50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-gray-200 dark:border-slate-900">{art.content}</p>
                    {art.compliance_notes && (
                      <div className="text-[11px] text-gray-400 dark:text-slate-500 italic bg-gray-50 dark:bg-slate-950/10 p-2 rounded-lg border border-dashed border-gray-200 dark:border-slate-800">
                        💡 <b>Not / Uyum Detayı:</b> {art.compliance_notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* HOŞGELDİNİZ BANNER (İlk giriş) */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-teal-900/40 text-gray-900 dark:text-slate-100 rounded-2xl w-full max-w-md p-8 shadow-2xl animate-scaleIn text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-teal-950/40 border border-teal-900/40 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400">
              <PartyPopper size={32} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                Hoşgeldiniz{clientDetails?.name ? ',' : ''} <Sparkles className="text-teal-400" size={18} />
              </h3>
              {clientDetails?.name && (
                <p className="text-sm font-bold text-teal-600 dark:text-teal-400 mt-1">{clientDetails.name}</p>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              EvrakLab Müşteri Paneli'ne hoş geldiniz. Buradan belgelerinizi, aksiyon planlarınızı ve atık gönderim kayıtlarınızı takip edebilir; atık yönetimi sekmesinden kendi atık sevkiyatlarınızı ekleyip çıkış raporunuzu PDF olarak indirebilirsiniz.
            </p>
            <button
              onClick={() => setShowWelcome(false)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
            >
              Panele Git
            </button>
          </div>
        </div>
      )}

      {/* YENİ ATIK KAYDI MODALI */}
      {showAddWasteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-2xl w-full max-w-lg shadow-2xl animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-teal-700 to-teal-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Yeni Atık Gönderimi Ekle</h3>
                <p className="text-xs text-white/80">{clientDetails?.name} için yeni bir atık çıkış kaydı beyanı ekleyin.</p>
              </div>
              <button onClick={() => setShowAddWasteModal(false)} className="text-white hover:bg-white/10 p-1.5 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddWasteRecord} className="p-5 space-y-4 overflow-y-auto">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Atık Kodu & Tanımı <span className="text-rose-500">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="Kod yazın (örn: 15 01 02) veya arayın..."
                  value={newWasteCode}
                  onChange={(e) => setNewWasteCode(e.target.value)}
                  className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 font-mono font-bold text-gray-900 dark:text-white"
                />
                {newWasteCode.trim().length > 0 && !WASTE_CODES.some(w => w.code === newWasteCode) && (
                  <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 py-1 text-xs">
                    {WASTE_CODES.filter(w =>
                      w.code.includes(newWasteCode) ||
                      w.name.toLowerCase().includes(newWasteCode.toLowerCase())
                    ).slice(0, 15).map(w => (
                      <button
                        type="button"
                        key={w.code}
                        onClick={() => setNewWasteCode(w.code)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-200 dark:hover:bg-slate-800 border-b border-gray-200 dark:border-slate-800 last:border-0"
                      >
                        <span className="font-bold font-mono text-teal-600 dark:text-teal-400 mr-2">{w.code}</span>
                        <span className="text-gray-500 dark:text-slate-400 text-[11px]">{w.name}</span>
                      </button>
                    ))}
                    {WASTE_CODES.filter(w =>
                      w.code.includes(newWasteCode) ||
                      w.name.toLowerCase().includes(newWasteCode.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-gray-400 dark:text-slate-500 italic text-[11px]">
                        Özel kod olarak kaydedilecek: "{newWasteCode}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Çıkış Tarihi <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="date"
                    value={newWasteExitDate}
                    onChange={(e) => setNewWasteExitDate(e.target.value)}
                    className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Miktar (kg) <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Miktar"
                    value={newWasteQuantity}
                    onChange={(e) => setNewWasteQuantity(e.target.value)}
                    className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Taşıyıcı Firma <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={newWasteTransporterId}
                    onChange={(e) => setNewWasteTransporterId(e.target.value)}
                    className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 font-bold text-gray-900 dark:text-white"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Gönderilen Firma <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={newWasteDestinationId}
                    onChange={(e) => setNewWasteDestinationId(e.target.value)}
                    className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 font-bold text-gray-900 dark:text-white"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {wasteCompanies.length === 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg px-3 py-2">
                  Henüz kayıtlı taşıyıcı/gönderilen firma yok. Önce "Firma Ekle" ile bir firma tanımlayın.
                </p>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Yöntem Türü <span className="text-rose-500">*</span></label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="client_new_disposal_type"
                      value="recovery"
                      checked={newWasteDisposalType === 'recovery'}
                      onChange={() => { setNewWasteDisposalType('recovery'); setNewWasteDisposalCode(''); }}
                      className="text-teal-500 focus:ring-teal-500"
                    />
                    Geri Kazanım
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="client_new_disposal_type"
                      value="disposal"
                      checked={newWasteDisposalType === 'disposal'}
                      onChange={() => { setNewWasteDisposalType('disposal'); setNewWasteDisposalCode(''); }}
                      className="text-rose-500 focus:ring-rose-500"
                    />
                    Bertaraf
                  </label>
                </div>

                {newWasteDisposalType === 'recovery' ? (
                  <select
                    required
                    value={newWasteDisposalCode}
                    onChange={(e) => setNewWasteDisposalCode(e.target.value)}
                    className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
                  >
                    <option value="">Kod Seçiniz (R1 - R13)...</option>
                    {RECOVERY_CODES.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    required
                    value={newWasteDisposalCode}
                    onChange={(e) => setNewWasteDisposalCode(e.target.value)}
                    className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
                  >
                    <option value="">Kod Seçiniz (D1 - D15)...</option>
                    {DISPOSAL_CODES.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Açıklama (İsteğe Bağlı)</label>
                <textarea
                  rows={2}
                  value={newWasteDescription}
                  onChange={(e) => setNewWasteDescription(e.target.value)}
                  className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWasteModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-600 dark:text-slate-300 text-xs font-bold transition hover:bg-gray-200 dark:hover:bg-slate-800"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submittingWaste}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingWaste ? 'Kaydediliyor...' : 'Atık Kaydını Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FİRMA EKLE MODALI (Taşıyıcı / Gönderilen) */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-2xl w-full max-w-md shadow-2xl animate-scaleIn overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white flex justify-between items-center">
              <h3 className="font-bold text-base">Taşıyıcı / Gönderilen Firma Ekle</h3>
              <button onClick={() => setShowAddCompanyModal(false)} className="text-white hover:bg-white/10 p-1.5 rounded-full transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateWasteCompany} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Firma Türü <span className="text-rose-500">*</span></label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="client_new_company_type"
                      value="transporter"
                      checked={newCompanyType === 'transporter'}
                      onChange={() => setNewCompanyType('transporter')}
                      className="text-teal-500 focus:ring-teal-500"
                    />
                    Taşıyıcı
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="client_new_company_type"
                      value="destination"
                      checked={newCompanyType === 'destination'}
                      onChange={() => setNewCompanyType('destination')}
                      className="text-teal-500 focus:ring-teal-500"
                    />
                    Gönderilen / Bertarafçı
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Firma Adı <span className="text-rose-500">*</span></label>
                <input
                  required
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 font-bold text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Adres (İsteğe Bağlı)</label>
                <input
                  type="text"
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  className="w-full border rounded-xl p-2.5 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-600 dark:text-slate-300 text-xs font-bold transition hover:bg-gray-200 dark:hover:bg-slate-800"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingCompany ? 'Kaydediliyor...' : 'Firmayı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto py-6 border-t border-gray-200 dark:border-slate-900 text-center text-[10px] text-gray-400 dark:text-slate-500">
        © {new Date().getFullYear()} EvrakLab Müşteri Portalı. Tüm hakları saklıdır.
      </footer>

    </div>
    </div>
  );
}
