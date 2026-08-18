import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Building,
  Plus,
  Edit2,
  Trash2,
  Users,
  FileText,
  Search,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Settings as SettingsIcon,
  Copy,
  Mail,
  User,
  MapPin,
  Tag,
  Loader,
  Scale,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  XCircle,
  Crown,
  PlusCircle,
  Bell,
  QrCode,
  HelpCircle,
  PieChart,
  Calendar,
  RefreshCw,
  X,
  ExternalLink,
  Send,
  Star,
  Table,
  GitBranch,
  GitBranchPlus,
  Network,
  PenLine,
  Lock,
  HardDrive,
  Inbox,
  LogOut,
  FlaskConical,
  ShoppingBag,
} from 'lucide-react';

import ModuleStore from './ModuleStore';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import { MapPickerModal, calculatePolygonAreaM2, formatArea } from './MapPickerModal';
import type { AreaPoint } from './MapPickerModal';
import { Link } from 'react-router-dom';
import InspectionAnalytics from './InspectionAnalytics';
import { extractTextFromPdf } from './localScanner';
import { isModuleEnabled } from './moduleRegistry';
import { parseLegislationText } from './parserUtils';
import {
  computeMsdsStatus,
  computeDaysRemaining,
  computeExpiryDate,
  parseMsdsText,
  type MsdsStatus,
  MSDS_STATUS_LABELS_TR as STATUS_LABELS_TR,
  MSDS_STATUS_BADGE_CLASSES as STATUS_BADGE_CLASSES_MSDS,
} from './msdsParser';
import EvaluationPanel from './EvaluationPanel';
import WasteManagement from './WasteManagement';
import PersonnelCard from './PersonnelCard';
import ExitDateModal from './ExitDateModal';
import RehireDateModal from './RehireDateModal';
import TerminateServiceModal from './TerminateServiceModal';

const TR_MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  sirket_karti: 'Şirket Kartı',
  sirket_sahsi: 'Şirket Şahsi',
  kisisel_odeme: 'Kişisel Ödeme (Cepten)',
};

// Boyut formatlama (Byte -> MB/GB)
function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface Client {
  id: string;
  name: string;
  address: string;
  tax_no: string;
  phone: string;
  email?: string;
  logo_url: string;
  monthly_fee?: number;
  created_by?: string;
  created_at?: string;
  service_start_date?: string;
  contract_file_url?: string;
  permit_stage?: string;
  permit_articles?: string[];
  kep_address?: string;
  parent_client_id?: string | null;
  ced_status?: string;
  ced_articles?: string[];
  latitude?: number | null;
  longitude?: number | null;
  area_points?: AreaPoint[] | null;
  area_m2?: number | null;
  service_terminated_at?: string | null;
}

interface CedCategory {
  id: string;
  stage: 'ek1' | 'ek2';
  code: string;
  title: string;
}

interface PermitCategory {
  id: string;
  stage: 'ek1' | 'ek2';
  code: string;
  title: string;
}

interface Report {
  id: string;
  client_id: string;
  report_type: 'monthly' | 'yearly';
  report_date: string;
  expires_at: string;
  status: string;
  client: { name: string };
  creator: { full_name: string };
  is_manual_upload: boolean;
  file_url: string;
  wet_signature_url: string | null;
  wet_signed_at: string | null;
}

interface VisitSchedule {
  id: string;
  consultant_company_id: string;
  client_id: string;
  personnel_id: string;
  visit_date: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  change_request_status: 'none' | 'pending' | 'approved' | 'rejected';
  change_request_reason?: string;
  change_request_date?: string;
  client?: { name: string };
  personnel?: { full_name: string };
  created_at?: string;
  updated_at?: string;
}

const getContractStatus = (startDateStr: string) => {
  const serviceStartDate = new Date(startDateStr);
  const expiryDate = new Date(serviceStartDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year contract length
  
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
    isWarning: diffDays > 0 && diffDays <= 10,
  };
};

export default function ConsultantPanel() {
  const [activeTab, setActiveTab] = useState<'clients' | 'terminated_clients' | 'reports' | 'settings' | 'storage_settings' | 'team' | 'org_chart' | 'definitions' | 'legislations' | 'requests' | 'actions' | 'inspections' | 'evaluations' | 'finance_summary' | 'finance_payments' | 'finance_expenses' | 'staff_expense_submission' | 'waste' | 'document_matrix' | 'opinions' | 'document_requests' | 'msds'>('clients');
  const [reportsSubView, setReportsSubView] = useState<'monthly' | 'yearly'>('monthly');

  // --- SAHA QR DENETİM MODÜLÜ STATE'LERİ ---
  const [inspectionsSubTab, setInspectionsSubTab] = useState<'points' | 'forms' | 'analytics'>('points');
  const [inspectionForms, setInspectionForms] = useState<any[]>([]);
  const [inspectionPoints, setInspectionPoints] = useState<any[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [selectedInspectionClientId, setSelectedInspectionClientId] = useState('');
  
  const [showCreateInspectionFormModal, setShowCreateInspectionFormModal] = useState(false);
  const [showCreateInspectionPointModal, setShowCreateInspectionPointModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [selectedInspectionPoint, setSelectedInspectionPoint] = useState<any>(null);
  const [pointSubmissions, setPointSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [submissionAnswers, setSubmissionAnswers] = useState<Record<string, any[]>>({});

  // Form creation fields
  const [newInsFormTitle, setNewInsFormTitle] = useState('');
  const [newInsFormDesc, setNewInsFormDesc] = useState('');
  const [newInsFormClientId, setNewInsFormClientId] = useState('');
  const [newInsFormPassword, setNewInsFormPassword] = useState('');
  const [newInsFormQuestions, setNewInsFormQuestions] = useState<any[]>([
    { question_text: '', question_type: 'yes_no', is_required: true }
  ]);

  // Point creation fields
  const [newInsPointName, setNewInsPointName] = useState('');
  const [newInsPointLocation, setNewInsPointLocation] = useState('');
  const [newInsPointFormId, setNewInsPointFormId] = useState('');

  // QR Print fields
  const [showQrPrintModal, setShowQrPrintModal] = useState(false);
  const [qrPrintPoint, setQrPrintPoint] = useState<any>(null);
  const [qrPrintCodeUrl, setQrPrintCodeUrl] = useState('');

  const fetchInspections = async () => {
    if (!orgId) return;
    setLoadingInspections(true);
    try {
      const { data: forms, error: formsError } = await supabase
        .from('inspection_forms')
        .select('*, client:consultant_clients(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (formsError) throw formsError;
      setInspectionForms(forms || []);

      const formIds = forms?.map(f => f.id) || [];
      if (formIds.length > 0) {
        const { data: points, error: pointsError } = await supabase
          .from('inspection_points')
          .select('*, form:inspection_forms(*, client:consultant_clients(name))')
          .in('form_id', formIds)
          .order('created_at', { ascending: false });

        if (pointsError) throw pointsError;
        setInspectionPoints(points || []);
      } else {
        setInspectionPoints([]);
      }
    } catch (err: any) {
      console.error('Error fetching inspections:', err.message);
    } finally {
      setLoadingInspections(false);
    }
  };

  const handleSaveInspectionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsFormTitle.trim()) return alert('Lütfen form başlığını girin.');
    if (!newInsFormClientId) return alert('Lütfen hizmet verilen işletmeyi seçin.');
    if (newInsFormQuestions.length === 0) return alert('Lütfen en az bir soru ekleyin.');
    
    if (newInsFormQuestions.some(q => !q.question_text.trim())) {
      return alert('Lütfen tüm soru metinlerini doldurun.');
    }

    try {
      const { data: form, error: formError } = await supabase
        .from('inspection_forms')
        .insert({
          organization_id: orgId,
          client_id: newInsFormClientId,
          title: newInsFormTitle.trim(),
          description: newInsFormDesc.trim() || null,
          access_password: newInsFormPassword.trim() || null,
          created_by: userId
        })
        .select()
        .single();

      if (formError) throw formError;

      const questionsToInsert = newInsFormQuestions.map((q, index) => ({
        form_id: form.id,
        order_index: index + 1,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        is_required: q.is_required
      }));

      const { error: qError } = await supabase
        .from('inspection_questions')
        .insert(questionsToInsert);

      if (qError) throw qError;

      alert('Form şablonu başarıyla oluşturuldu!');
      setShowCreateInspectionFormModal(false);
      setNewInsFormTitle('');
      setNewInsFormDesc('');
      setNewInsFormClientId('');
      setNewInsFormPassword('');
      setNewInsFormQuestions([{ question_text: '', question_type: 'yes_no', is_required: true }]);
      fetchInspections();
    } catch (err: any) {
      alert('Form kaydedilirken hata: ' + err.message);
    }
  };

  const handleSaveInspectionPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsPointName.trim()) return alert('Lütfen nokta adını girin.');
    if (!newInsPointFormId) return alert('Lütfen bu noktada kullanılacak denetim formunu seçin.');

    try {
      const randToken = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

      const { error } = await supabase
        .from('inspection_points')
        .insert({
          form_id: newInsPointFormId,
          name: newInsPointName.trim(),
          location_description: newInsPointLocation.trim() || null,
          qr_token: randToken
        });

      if (error) throw error;

      alert('Denetim noktası ve QR kodu başarıyla oluşturuldu!');
      setShowCreateInspectionPointModal(false);
      setNewInsPointName('');
      setNewInsPointLocation('');
      setNewInsPointFormId('');
      fetchInspections();
    } catch (err: any) {
      alert('Nokta oluşturulurken hata: ' + err.message);
    }
  };

  const handleViewSubmissions = async (point: any) => {
    setSelectedInspectionPoint(point);
    setPointSubmissions([]);
    setExpandedSubmissionId(null);
    setSubmissionAnswers({});
    setShowSubmissionsModal(true);
    setLoadingSubmissions(true);

    try {
      const { data: subs, error: subsError } = await supabase
        .from('inspection_submissions')
        .select('*')
        .eq('point_id', point.id)
        .order('submitted_at', { ascending: false });

      if (subsError) throw subsError;
      setPointSubmissions(subs || []);

      // Bulgular rozetinin genişletmeden önce de doğru görünmesi için tüm
      // cevapları toplu olarak önceden çekiyoruz.
      const subIds = (subs || []).map(s => s.id);
      if (subIds.length > 0) {
        const { data: allAnswers, error: answersError } = await supabase
          .from('inspection_answers')
          .select('*, question:inspection_questions(question_text, question_type, order_index)')
          .in('submission_id', subIds);

        if (answersError) throw answersError;

        const grouped: Record<string, any[]> = {};
        (allAnswers || []).forEach((a: any) => {
          if (!grouped[a.submission_id]) grouped[a.submission_id] = [];
          grouped[a.submission_id].push(a);
        });
        Object.keys(grouped).forEach(subId => {
          grouped[subId].sort((a, b) => (a.question?.order_index ?? 0) - (b.question?.order_index ?? 0));
        });
        setSubmissionAnswers(grouped);
      }
    } catch (err: any) {
      alert('Gönderim geçmişi yüklenirken hata: ' + err.message);
    } finally {
      setLoadingSubmissions(false);
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

      setSubmissionAnswers(prev => ({
        ...prev,
        [submissionId]: sorted
      }));
      setExpandedSubmissionId(submissionId);
    } catch (err: any) {
      alert('Cevaplar yüklenirken hata: ' + err.message);
    }
  };

  const handleToggleFormActive = async (formId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('inspection_forms')
        .update({ is_active: !currentStatus })
        .eq('id', formId);

      if (error) throw error;
      fetchInspections();
    } catch (err: any) {
      alert('Durum güncellenirken hata: ' + err.message);
    }
  };

  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm('Bu formu silmek istediğinize emin misiniz? Form silindiğinde buna bağlı tüm noktalar, QR kodlar ve gönderilen tüm cevaplar silinecektir!')) return;
    try {
      const { error } = await supabase
        .from('inspection_forms')
        .delete()
        .eq('id', formId);

      if (error) throw error;
      fetchInspections();
    } catch (err: any) {
      alert('Form silinirken hata: ' + err.message);
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!window.confirm('Bu denetim noktasını silmek istediğinize emin misiniz? Bu noktaya ait QR kod geçersiz olacak ve geçmiş denetim verileri silinecektir.')) return;
    try {
      const { error } = await supabase
        .from('inspection_points')
        .delete()
        .eq('id', pointId);

      if (error) throw error;
      fetchInspections();
    } catch (err: any) {
      alert('Nokta silinirken hata: ' + err.message);
    }
  };

  const handleGenerateQr = (point: any) => {
    setQrPrintPoint(point);
    const domain = window.location.origin;
    const url = `${domain}/inspect/${point.qr_token}`;
    
    QRCode.toDataURL(url, { width: 300, margin: 2 })
      .then(dataUrl => {
        setQrPrintCodeUrl(dataUrl);
        setShowQrPrintModal(true);
      })
      .catch(err => {
        console.error(err);
        alert('QR kod oluşturulamadı.');
      });
  };

  const handlePrintQr = () => {
    if (!qrPrintPoint || !qrPrintCodeUrl) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Yazdır penceresi açılamadı. Tarayıcınızın pop-up engelleyicisini kontrol edin.');
      return;
    }
    
    const clientName = qrPrintPoint.form?.client?.name || '';
    const pointName = qrPrintPoint.name || '';
    const desc = qrPrintPoint.location_description || '';
    
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Kod Yazdır - ${pointName}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              text-align: center;
              margin: 0;
              padding: 40px;
              color: #1e293b;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 80vh;
            }
            .card {
              border: 3px solid #1e293b;
              border-radius: 24px;
              padding: 40px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
              box-sizing: border-box;
            }
            h1 {
              font-size: 26px;
              margin: 0 0 10px 0;
              font-weight: 800;
              color: #0f172a;
            }
            h2 {
              font-size: 20px;
              margin: 0 0 20px 0;
              color: #2ca58d;
              font-weight: 700;
            }
            .qr-container {
              margin: 30px 0;
            }
            .qr-image {
              width: 250px;
              height: 250px;
            }
            .instruction {
              font-size: 16px;
              font-weight: 600;
              margin-top: 15px;
              color: #475569;
            }
            .sub-instruction {
              font-size: 13px;
              color: #64748b;
              margin-top: 5px;
            }
            .location {
              font-size: 14px;
              background-color: #f1f5f9;
              padding: 8px 12px;
              border-radius: 8px;
              margin-top: 15px;
              font-style: italic;
              display: inline-block;
            }
            @media print {
              body {
                padding: 0;
              }
              .card {
                border: 3px solid #000;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${clientName}</h1>
            <h2>${pointName}</h2>
            
            <div class="qr-container">
              <img class="qr-image" src="${qrPrintCodeUrl}" alt="QR Code" />
            </div>
            
            <div class="instruction">Lütfen QR Kodu Mobil Cihazınızla Taratın</div>
            <div class="sub-instruction">Saha denetim formunu doldurmak ve geçmiş kayıtları incelemek için kodu okutun.</div>
            
            ${desc ? `<div class="location"><b>Konum:</b> ${desc}</div>` : ''}
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- MEVZUAT TAKİP BÖLÜMÜ STATE'LERİ ---
  const [assignedGlobalLegislations, setAssignedGlobalLegislations] = useState<any[]>([]);
  const [allGlobalRegulations, setAllGlobalRegulations] = useState<any[]>([]);
  const [importingLegId, setImportingLegId] = useState<string | null>(null);
  const [clientRegulations, setClientRegulations] = useState<any[]>([]);
  const [staffRequests, setStaffRequests] = useState<any[]>([]);
  const [legSubTab, setLegSubTab] = useState<'pool' | 'assignments' | 'calendar' | 'tracking'>('pool');
  const [selectedClientForLegTracking, setSelectedClientForLegTracking] = useState<any>(null);
  const [selfTrackingClient, setSelfTrackingClient] = useState<any>(null);

  // --- FİNANS & MALİYET MODÜLÜ STATE'LERİ ---
  const [showModuleStoreModal, setShowModuleStoreModal] = useState(false);
  const [financePayments, setFinancePayments] = useState<any[]>([]);
  const [financeExpenses, setFinanceExpenses] = useState<any[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(false);
  // Gider Yönetimi / Müşteri Ödemeleri / Finansal Özet — ortak ay/yıl filtresi
  const [financePeriodType, setFinancePeriodType] = useState<'all' | 'monthly' | 'yearly'>('all');
  const [financeSelectedMonth, setFinanceSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [financeSelectedYear, setFinanceSelectedYear] = useState(String(new Date().getFullYear()));
  // Müşteri Ödemeleri: hizmeti sonlandırılan firmaların (varsa) ödenmemiş
  // geçmiş alacakları gözden kaybolmasın diye bir kapsam filtresi.
  const [financePaymentsScope, setFinancePaymentsScope] = useState<'active' | 'terminated' | 'all'>('active');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'Ofis/Kira',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
    employee_id: ''
  });
  const [savingExpense, setSavingExpense] = useState(false);

  // Personel/Şef Gider Ekleme (dar kapsamlı, sadece kendi gönderdiklerini görür)
  const [newStaffExpense, setNewStaffExpense] = useState({
    title: '',
    category: 'Diğer',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_type: 'sirket_karti' as 'sirket_karti' | 'sirket_sahsi' | 'kisisel_odeme',
    notes: '',
  });
  const [staffExpenseReceiptFile, setStaffExpenseReceiptFile] = useState<File | null>(null);
  const [savingStaffExpense, setSavingStaffExpense] = useState(false);
  const [myStaffExpenses, setMyStaffExpenses] = useState<any[]>([]);
  const [loadingMyStaffExpenses, setLoadingMyStaffExpenses] = useState(false);
  const [updatingClientFee, setUpdatingClientFee] = useState<string | null>(null);
  const [tempClientFeeVal, setTempClientFeeVal] = useState('');
  const [togglingPaymentKey, setTogglingPaymentKey] = useState<string | null>(null);
  const [collapsedPaymentYears, setCollapsedPaymentYears] = useState<Record<string, boolean>>({});
  const [expandedPaymentClients, setExpandedPaymentClients] = useState<Record<string, boolean>>({});
  // Finansal Özet tablosu — tıklanan ay/kategori satırlarının detayını açık tutar
  const [expandedSummaryMonth, setExpandedSummaryMonth] = useState<string | null>(null);
  const [expandedSummaryCategory, setExpandedSummaryCategory] = useState<string | null>(null);
  const [showCollectedFirmsMonth, setShowCollectedFirmsMonth] = useState<string | null>(null);

  // --- ZİYARET PLANLAMA / ÇALIŞMA TAKVİMİ STATE'LERİ ---
  const [visitSchedules, setVisitSchedules] = useState<VisitSchedule[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [newVisit, setNewVisit] = useState({
    client_id: '',
    visit_date: '',
    notes: '',
  });
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitSchedule | null>(null);
  const [changeRequest, setChangeRequest] = useState({
    requested_date: '',
    reason: '',
  });
  
  const todayDate = new Date();
  const [visitCalendarYear, setVisitCalendarYear] = useState(todayDate.getFullYear());
  const [visitCalendarMonth, setVisitCalendarMonth] = useState(todayDate.getMonth()); // 0-11
  const [visitCalendarView, setVisitCalendarView] = useState<'calendar' | 'list'>('calendar');
  const [savingVisit, setSavingVisit] = useState(false);
  const [submittingChangeRequest, setSubmittingChangeRequest] = useState(false);
  
  const [selectedVisitAssignees, setSelectedVisitAssignees] = useState<any[]>([]);

  useEffect(() => {
    if (selectedVisit) {
      const fetchVisitAssignees = async () => {
        try {
          const { data, error } = await supabase
            .from('consultant_assignments')
            .select('profiles!user_id(full_name, email)')
            .eq('client_id', selectedVisit.client_id);
          if (error) throw error;
          setSelectedVisitAssignees(data?.map((d: any) => d.profiles).filter(Boolean) || []);
        } catch (err) {
          console.error('Error fetching assignees:', err);
        }
      };
      fetchVisitAssignees();
    } else {
      setSelectedVisitAssignees([]);
    }
  }, [selectedVisit]);
  
  const [showAssignClientLegModal, setShowAssignClientLegModal] = useState(false);
  const [assigningGlobalLeg, setAssigningGlobalLeg] = useState<any>(null);
  const [selectedClientIdForLeg, setSelectedClientIdForLeg] = useState('');
  const [selectedStaffIdForLeg, setSelectedStaffIdForLeg] = useState('');

  const [selectedClientRegulation, setSelectedClientRegulation] = useState<any>(null);
  const [selectedClientRegulationArticles, setSelectedClientRegulationArticles] = useState<any[]>([]);
  const [loadingLegArticles, setLoadingLegArticles] = useState(false);

  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [selectedReqClientId, setSelectedReqClientId] = useState('');
  const [reviewingRequest, setReviewingRequest] = useState<any>(null);
  const [reviewResponseNote, setReviewResponseNote] = useState('');
  const [answeringRequest, setAnsweringRequest] = useState(false);
  const [selectedReqRegulationId, setSelectedReqRegulationId] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Özel Mevzuat Ekleme (Custom Regulations for Consultants)
  const [showAddCustomLegModal, setShowAddCustomLegModal] = useState(false);
  const [legTitle, setLegTitle] = useState('');
  const [legCategory, setLegCategory] = useState('Yönetmelik');
  const [legPubDate, setLegPubDate] = useState('');
  const [legEffDate, setLegEffDate] = useState('');
  const [legRgNo, setLegRgNo] = useState('');
  const [legRgDate, setLegRgDate] = useState('');
  const [legArticles, setLegArticles] = useState<any[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [parsingPdf, setParsingPdf] = useState(false);
  const [parsingTextMode, setParsingTextMode] = useState(false);
  const [savingLegislation, setSavingLegislation] = useState(false);
  const [pendingCompanyLegislations, setPendingCompanyLegislations] = useState<any[]>([]);
  const [reviewingLegId, setReviewingLegId] = useState<string | null>(null);

  // Mevcut Durum (Current Status Notes) states
  const [editingNotesArtId, setEditingNotesArtId] = useState<string | null>(null);
  const [tempNotesVal, setTempNotesVal] = useState('');

  // --- AKSİYON TAKİP SİSTEMİ STATE'LERİ ---
  const [complianceActions, setComplianceActions] = useState<any[]>([]);
  const [articleActions, setArticleActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [selectedClientAction, setSelectedClientAction] = useState<any>(null);
  const [actionsLastSeen, setActionsLastSeen] = useState<number>(0);
  
  const [showCreateActionModal, setShowCreateActionModal] = useState(false);
  const [creatingAction, setCreatingAction] = useState(false);
  const [showCompleteActionModal, setShowCompleteActionModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedActionDetails, setSelectedActionDetails] = useState<any>(null);
  
  const [actionsFilterClient, setActionsFilterClient] = useState('');
  const [actionsFilterAssignee, setActionsFilterAssignee] = useState('');
  const [actionsFilterStatus, setActionsFilterStatus] = useState('');
  const [actionsSubTab, setActionsSubTab] = useState<'pending' | 'completed'>('pending');
  
  // Yeni Aksiyon Oluşturma Formu
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionClientId, setNewActionClientId] = useState('');
  const [newActionAssigneeId, setNewActionAssigneeId] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [newActionEmail, setNewActionEmail] = useState('');
  const [newActionClientEmails, setNewActionClientEmails] = useState<{ id: string; email: string }[]>([]);
  
  // Aksiyon Tamamlama Formu
  const [actionNotes, setActionNotes] = useState('');
  const [actionEvidenceFile, setActionEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  
  // Aksiyon Düzeltme Formu
  const [correctionComment, setCorrectionComment] = useState('');
  const [correctionDueDate, setCorrectionDueDate] = useState('');

  // Zorunlu Açıklama Modalı (Compliance Status Explanation Modal)
  const [showComplianceNoteModal, setShowComplianceNoteModal] = useState(false);
  const [complianceExpiryDate, setComplianceExpiryDate] = useState('');
  const [isComplianceExpiryless, setIsComplianceExpiryless] = useState(true);
  const [complianceNoteData, setComplianceNoteData] = useState<{
    articleId: string;
    type: 'compliant' | 'non_compliant' | 'exempt';
    articleNo: string;
    title: string;
    currentNotes?: string;
    currentExpiryDate?: string;
    currentMandatoryState?: boolean;
  } | null>(null);
  const [complianceNoteValue, setComplianceNoteValue] = useState('');
  const [savingComplianceNote, setSavingComplianceNote] = useState(false);
  const [articleFilter, setArticleFilter] = useState<string>('all');
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [selectedEvidenceDocUrl, setSelectedEvidenceDocUrl] = useState<string>('');
  const [evidenceMode, setEvidenceMode] = useState<'upload' | 'select'>('upload');
  const [legFilterClientId, setLegFilterClientId] = useState<string>('');

  // Mevzuat Maddesinden Aksiyon Açma Formu
  const [showRequestNotesModal, setShowRequestNotesModal] = useState(false);
  const [reqNotesArticleId, setReqNotesArticleId] = useState('');
  const [reqNotesClientId, setReqNotesClientId] = useState('');
  const [reqNotesAssigneeId, setReqNotesAssigneeId] = useState('');
  const [reqNotesDueDate, setReqNotesDueDate] = useState('');
  const [reqNotesDesc, setReqNotesDesc] = useState('');
  const [selectedArticleIdsForAction, setSelectedArticleIdsForAction] = useState<string[]>([]);
  const [pendingActionArticleIds, setPendingActionArticleIds] = useState<string[]>([]);

  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  // Evrak Talepleri (Danışman -> Hizmet Verilen İşletme)
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [loadingDocRequests, setLoadingDocRequests] = useState(false);
  const [docReqClientId, setDocReqClientId] = useState('');
  const [docReqTitle, setDocReqTitle] = useState('');
  const [docReqDesc, setDocReqDesc] = useState('');
  const [submittingDocReq, setSubmittingDocReq] = useState(false);
  const [docReqStatusFilter, setDocReqStatusFilter] = useState<'all' | 'pending' | 'fulfilled'>('all');

  // MSDS/SDS Takibi
  const [msdsDocuments, setMsdsDocuments] = useState<any[]>([]);
  const [loadingMsds, setLoadingMsds] = useState(false);
  const [msdsClientFilter, setMsdsClientFilter] = useState('');
  const [msdsStatusFilter, setMsdsStatusFilter] = useState<'all' | MsdsStatus>('all');

  // MSDS Düzenleme & Yenileme State'leri
  const [editingMsds, setEditingMsds] = useState<any | null>(null);
  const [msdsEditProductName, setMsdsEditProductName] = useState('');
  const [msdsEditPrimaryDate, setMsdsEditPrimaryDate] = useState('');
  const [msdsEditValidityYears, setMsdsEditValidityYears] = useState(5);
  const [msdsEditWarningDays, setMsdsEditWarningDays] = useState(30);
  const [msdsEditFile, setMsdsEditFile] = useState<File | null>(null);
  const [msdsParsing, setMsdsParsing] = useState(false);
  const [msdsSaving, setMsdsSaving] = useState(false);

  const handleStartEditMsds = (m: any) => {
    setEditingMsds(m);
    setMsdsEditProductName(m.product_name || '');
    setMsdsEditPrimaryDate(m.primary_date || '');
    setMsdsEditValidityYears(m.validity_years || 5);
    setMsdsEditWarningDays(m.warning_threshold_days || 30);
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
      console.error('MSDS PDF okuma hatası:', err.message);
    } finally {
      setMsdsParsing(false);
    }
  };

  const handleSaveMsdsEdit = async () => {
    if (!editingMsds) return;
    if (!msdsEditProductName.trim() || !msdsEditPrimaryDate) {
      alert('Lütfen Ürün Adı ve Ana Tarih alanlarını doldurun.');
      return;
    }
    setMsdsSaving(true);
    try {
      let fileUrl = editingMsds.file_url;
      let fileType = editingMsds.file_type;
      let fileSize = editingMsds.file_size;
      let originalFileName = editingMsds.original_file_name;

      if (msdsEditFile) {
        const fileExt = msdsEditFile.name.split('.').pop() || 'pdf';
        const filePath = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, msdsEditFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileType = fileExt;
        fileSize = msdsEditFile.size;
        originalFileName = msdsEditFile.name;
      }

      const expiry = computeExpiryDate(msdsEditPrimaryDate, msdsEditValidityYears);

      if (editingMsds.document_id) {
        const { error: docErr } = await supabase
          .from('documents')
          .update({
            title: msdsEditProductName.trim(),
            acquisition_date: msdsEditPrimaryDate,
            expiry_date: expiry,
            application_deadline: expiry,
            reminder_days: msdsEditWarningDays,
            file_url: fileUrl,
            file_type: fileType,
            file_size: fileSize,
          })
          .eq('id', editingMsds.document_id);
        if (docErr) console.warn('Bağlı document kaydı güncellenirken uyarı:', docErr.message);
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
          validity_years: msdsEditValidityYears,
          warning_threshold_days: msdsEditWarningDays,
          expiry_date: expiry,
          extraction_status: 'manual',
          original_file_name: originalFileName,
          file_url: fileUrl,
          file_type: fileType,
          file_size: fileSize,
        })
        .eq('id', editingMsds.id);

      if (msdsErr) throw msdsErr;

      alert('MSDS kaydı başarıyla güncellendi.');
      setEditingMsds(null);
      setMsdsEditFile(null);
      await fetchMsdsDocuments();
    } catch (err: any) {
      alert('MSDS kaydedilirken hata: ' + err.message);
    } finally {
      setMsdsSaving(false);
    }
  };

  const handleDeleteMsds = async (m: any) => {
    if (!confirm(`"${m.product_name || 'Bu MSDS'}" kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      if (m.document_id) {
        await supabase.from('documents').delete().eq('id', m.document_id);
      }
      const { error } = await supabase.from('msds_documents').delete().eq('id', m.id);
      if (error) throw error;
      alert('MSDS kaydı silindi.');
      await fetchMsdsDocuments();
    } catch (err: any) {
      alert('MSDS silinirken hata: ' + err.message);
    }
  };

  // Sunucudan zaten expiry_date'e göre sıralı gelir (bkz. fetchMsdsDocuments);
  // burada sadece firma/durum filtreleri uygulanır.
  const msdsFilteredSorted = msdsDocuments
    .filter((m: any) => !msdsClientFilter || m.client_id === msdsClientFilter)
    .filter((m: any) => msdsStatusFilter === 'all' || computeMsdsStatus(m.expiry_date, m.warning_threshold_days || 30) === msdsStatusFilter);

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgEnabledModules, setOrgEnabledModules] = useState<string[] | null>(null);
  const [currentUserPerms, setCurrentUserPerms] = useState<any>({});

  // Finans & İK modülleri — firma sahibi her girişte parolasını doğrulamalı
  // (ekranı açık bırakıp başkasının maaş/finans verisini görmesini engellemek için).
  const [financeHrUnlocked, setFinanceHrUnlocked] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthError, setReAuthError] = useState('');
  const [reAuthLoading, setReAuthLoading] = useState(false);

  // Görüşler Tab State'leri
  const [opinionLetters, setOpinionLetters] = useState<any[]>([]);
  const [loadingOpinions, setLoadingOpinions] = useState(false);
  const [opinionsFilterClientId, setOpinionsFilterClientId] = useState('');
  const [opinionsFilterYear, setOpinionsFilterYear] = useState('');

  // Tanımlamalar Tab State'leri
  const [defTabTypes, setDefTabTypes] = useState<any[]>([]);
  const [defTabLocs, setDefTabLocs] = useState<any[]>([]);
  const [rawDefs, setRawDefs] = useState<any[]>([]);
  const [selectedDefMemberId, setSelectedDefMemberId] = useState<string>('all');
  const [selectedDefTypeMemberId, setSelectedDefTypeMemberId] = useState<string>('all');
  const [newDefTypeLabel, setNewDefTypeLabel] = useState('');
  const [newDefLocLabel, setNewDefLocLabel] = useState('');
  const [savingDef, setSavingDef] = useState(false);
  const [clientNames, setClientNames] = useState<string[]>([]);

  // Modals
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    address: '',
    tax_no: '',
    phone: '',
    logo_url: '',
    latitude: null as number | null,
    longitude: null as number | null,
    service_start_date: '',
    contract_file_url: '',
    permit_stage: 'out_of_scope',
    permit_articles: [] as string[],
    kep_address: '',
    ced_status: 'out_of_scope',
    ced_articles: [] as string[],
    area_points: [] as AreaPoint[],
  });
  const [newClientArticleSearch, setNewClientArticleSearch] = useState('');

  // --- ŞUBE EKLEME STATE'LERİ ---
  // Şubenin sözleşmesi ve izin/ÇED kapsamı ana firmadan farklı olabileceği için
  // Add Client ile aynı alan setini kullanıyoruz; sadece ana firmadan kopyalanan
  // değerlerle önceden dolduruluyor (bkz. openAddBranchModal), tamamı düzenlenebilir.
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [branchParent, setBranchParent] = useState<Client | null>(null);
  const [newBranch, setNewBranch] = useState({
    name: '',
    address: '',
    tax_no: '',
    phone: '',
    logo_url: '',
    latitude: null as number | null,
    longitude: null as number | null,
    service_start_date: '',
    contract_file_url: '',
    permit_stage: 'out_of_scope',
    permit_articles: [] as string[],
    kep_address: '',
    ced_status: 'out_of_scope',
    ced_articles: [] as string[],
    area_points: [] as AreaPoint[],
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [showAddBranchMap, setShowAddBranchMap] = useState(false);
  const [uploadingBranchLogo, setUploadingBranchLogo] = useState(false);
  const [uploadingBranchContract, setUploadingBranchContract] = useState(false);
  const [branchArticleSearch, setBranchArticleSearch] = useState('');
  const [editClientArticleSearch, setEditClientArticleSearch] = useState('');

  // Change requests states
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [loadingChangeRequests, setLoadingChangeRequests] = useState(false);
  const [showClientChangeRequestModal, setShowClientChangeRequestModal] = useState(false);
  const [selectedClientForChangeRequest, setSelectedClientForChangeRequest] = useState<Client | null>(null);
  const [changeRequestNewName, setChangeRequestNewName] = useState('');
  const [changeRequestNewAddress, setChangeRequestNewAddress] = useState('');
  const [changeRequestPdfFile, setChangeRequestPdfFile] = useState<File | null>(null);
  const [submittingClientChangeRequest, setSubmittingClientChangeRequest] = useState(false);

  // Approval/Rejection states for title/address changes
  const [resolvingChangeRequestId, setResolvingChangeRequestId] = useState<string | null>(null);
  const [selectedChangeRequestForRejection, setSelectedChangeRequestForRejection] = useState<any>(null);
  const [changeRejectionReason, setChangeRejectionReason] = useState('');
  const [showChangeRejectionModal, setShowChangeRejectionModal] = useState(false);

  // Personel unvan degisikligi talepleri (staff_role_change_requests)
  const [staffRoleChangeRequests, setStaffRoleChangeRequests] = useState<any[]>([]);
  const [showRoleChangeRequestModal, setShowRoleChangeRequestModal] = useState(false);
  const [roleChangeRequestTo, setRoleChangeRequestTo] = useState('corporate_chief');
  const [roleChangeRequestReason, setRoleChangeRequestReason] = useState('');
  const [submittingRoleChangeRequest, setSubmittingRoleChangeRequest] = useState(false);

  // Required documents states
  const [defSubTab, setDefSubTab] = useState<'standard' | 'required'>('standard');
  const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
  const [loadingReqDocs, setLoadingReqDocs] = useState(false);
  const [selectedClientForReqDocs, setSelectedClientForReqDocs] = useState<string>('');
  const [allDocsForMatrix, setAllDocsForMatrix] = useState<any[]>([]);

  // Document details states for compliance matrix interaction
  const [selectedDetailDoc, setSelectedDetailDoc] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [loadingDetailDoc, setLoadingDetailDoc] = useState<boolean>(false);
  const [selectedDetailClient, setSelectedDetailClient] = useState<any>(null);
  const [askTargetUserId, setAskTargetUserId] = useState<string>('');
  const [askNote, setAskNote] = useState<string>('');
  const [askMode, setAskMode] = useState<'chat' | 'action'>('chat');
  const [askDueDate, setAskDueDate] = useState<string>('');
  const [isSubmittingAsk, setIsSubmittingAsk] = useState<boolean>(false);

  // Exempt details states
  const [selectedExemptReason, setSelectedExemptReason] = useState<string | null>(null);
  const [selectedExemptDocType, setSelectedExemptDocType] = useState<string | null>(null);
  const [selectedExemptClientName, setSelectedExemptClientName] = useState<string | null>(null);
  const [showExemptModal, setShowExemptModal] = useState<boolean>(false);

  // Missing document info states
  const [selectedMissingDocType, setSelectedMissingDocType] = useState<string | null>(null);
  const [selectedMissingClientName, setSelectedMissingClientName] = useState<string | null>(null);
  const [showMissingModal, setShowMissingModal] = useState<boolean>(false);

  // Client regulation article editing states
  const [showAddClientArticleModal, setShowAddClientArticleModal] = useState(false);
  const [showEditClientArticleModal, setShowEditClientArticleModal] = useState(false);
  const [selectedArticleForEdit, setSelectedArticleForEdit] = useState<any>(null);
  const [newArtNo, setNewArtNo] = useState('');
  const [newArtTitle, setNewArtTitle] = useState('');
  const [newArtContent, setNewArtContent] = useState('');

  const handleToggleNewClientArticle = (code: string) => {
    const current = newClient.permit_articles || [];
    const updated = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    setNewClient({ ...newClient, permit_articles: updated });
  };

  const handleToggleEditClientArticle = (code: string) => {
    if (!editingClient) return;
    const current = editingClient.permit_articles || [];
    const updated = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    setEditingClient({ ...editingClient, permit_articles: updated });
  };

  // --- ÇED DURUMU (Ek-1/Ek-2 proje listesi, Çevre İzni'nden bağımsız) ---
  const [cedCategories, setCedCategories] = useState<CedCategory[]>([]);
  const [newClientCedSearch, setNewClientCedSearch] = useState('');
  const [editClientCedSearch, setEditClientCedSearch] = useState('');
  const [newBranchCedSearch, setNewBranchCedSearch] = useState('');

  const fetchCedCategories = async () => {
    const { data, error } = await supabase
      .from('ced_project_categories')
      .select('id, stage, code, title')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('ÇED kategorileri çekilirken hata:', error.message);
      return;
    }
    setCedCategories(data || []);
  };

  // --- ÇEVRE İZİN VE LİSANS (EK-1/EK-2) FAALİYET LİSTESİ, ÇED'den bağımsız ---
  const [permitCategories, setPermitCategories] = useState<PermitCategory[]>([]);

  const fetchPermitCategories = async () => {
    const { data, error } = await supabase
      .from('environmental_permit_categories')
      .select('id, stage, code, title')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Çevre izin kategorileri çekilirken hata:', error.message);
      return;
    }
    setPermitCategories(data || []);
  };

  const handleToggleNewClientCedArticle = (code: string) => {
    const current = newClient.ced_articles || [];
    const updated = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    setNewClient({ ...newClient, ced_articles: updated });
  };

  const handleToggleEditClientCedArticle = (code: string) => {
    if (!editingClient) return;
    const current = editingClient.ced_articles || [];
    const updated = current.includes(code) ? current.filter((c: string) => c !== code) : [...current, code];
    setEditingClient({ ...editingClient, ced_articles: updated });
  };

  const handleToggleNewBranchCedArticle = (code: string) => {
    const current = newBranch.ced_articles || [];
    const updated = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    setNewBranch({ ...newBranch, ced_articles: updated });
  };

  const handleToggleNewBranchArticle = (code: string) => {
    const current = newBranch.permit_articles || [];
    const updated = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    setNewBranch({ ...newBranch, permit_articles: updated });
  };
  const [uploadingContract, setUploadingContract] = useState(false);
  const [showAddClientMap, setShowAddClientMap] = useState(false);
  const [showEditClientMap, setShowEditClientMap] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [orgStorageUsed, setOrgStorageUsed] = useState(0);
  const [memberStorage, setMemberStorage] = useState<Record<string, { bytes: number; count: number }>>({});

  // Depo Kotası Detay Modalı (sadece firma sahibi)
  const [showQuotaDetailModal, setShowQuotaDetailModal] = useState(false);
  const [quotaDetailTab, setQuotaDetailTab] = useState<'members' | 'clients' | 'documents'>('members');
  const [clientStorage, setClientStorage] = useState<{ client_id: string; client_name: string; total_bytes: number; doc_count: number }[]>([]);
  const [orgDocumentsForQuota, setOrgDocumentsForQuota] = useState<any[]>([]);
  const [loadingQuotaDetail, setLoadingQuotaDetail] = useState(false);
  const [deletingQuotaDocId, setDeletingQuotaDocId] = useState<string | null>(null);
  const [mySubEndDate, setMySubEndDate] = useState<string | null>(null);
  const [premiumSeatActive, setPremiumSeatActive] = useState(true);
  const [previousRole, setPreviousRole] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [savingManagerId, setSavingManagerId] = useState<string | null>(null);
  // Personel Kartı (sadece firma sahibi/premium_corporate görebilir, bkz. Ekip Yönetimi satırları ve PersonnelCard.tsx)
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  // Satırdaki hızlı "İşten Çıkar" ikonu için bekleyen kişi (tarih seçim modalı onaylanınca kick RPC'si çağrılır)
  const [pendingKickMember, setPendingKickMember] = useState<any>(null);
  const [kickingQuick, setKickingQuick] = useState(false);
  const [departedEmployees, setDepartedEmployees] = useState<any[]>([]);
  const [reactivatingEmployeeId, setReactivatingEmployeeId] = useState<string | null>(null);
  const [pendingReactivateMember, setPendingReactivateMember] = useState<any>(null);
  const [googleDriveQuota, setGoogleDriveQuota] = useState<{ usage: number; limit: number | null } | null>(null);
  const [loadingGoogleDriveQuota, setLoadingGoogleDriveQuota] = useState(false);
  const [savingStorageSettings, setSavingStorageSettings] = useState(false);
  const [connectingGoogleDriveOwner, setConnectingGoogleDriveOwner] = useState(false);
  const [showGoogleDriveInfo, setShowGoogleDriveInfo] = useState(false);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [clientSubView, setClientSubView] = useState<'grid' | 'personnel' | 'requests'>('grid');

  // Hizmet Dönemleri (sözleşme yenileme + yıl bazlı ücret geçmişi)
  const [servicePeriods, setServicePeriods] = useState<any[]>([]);
  const [renewingClientId, setRenewingClientId] = useState<string | null>(null);
  const [renewMode, setRenewMode] = useState<'auto' | 'custom'>('auto');
  const [renewCustomEndDate, setRenewCustomEndDate] = useState('');
  const [renewFee, setRenewFee] = useState('');
  const [savingRenewal, setSavingRenewal] = useState(false);
  const [expandedPeriodHistory, setExpandedPeriodHistory] = useState<Record<string, boolean>>({});
  const [editingPeriodDatesClientId, setEditingPeriodDatesClientId] = useState<string | null>(null);
  const [editPeriodStartDate, setEditPeriodStartDate] = useState('');
  const [editPeriodEndDate, setEditPeriodEndDate] = useState('');
  const [savingPeriodDates, setSavingPeriodDates] = useState(false);

  // Hizmet Sonlandırma
  const [terminatedClients, setTerminatedClients] = useState<Client[]>([]);
  const [loadingTerminatedClients, setLoadingTerminatedClients] = useState(false);
  const [terminatingClientId, setTerminatingClientId] = useState<string | null>(null);
  const [savingTermination, setSavingTermination] = useState(false);
  const [reactivatingClientId, setReactivatingClientId] = useState<string | null>(null);

  // Client Panel Provisioning States
  const [showClientLoginModal, setShowClientLoginModal] = useState(false);
  const [selectedClientForLogin, setSelectedClientForLogin] = useState<any>(null);
  const [clientLoginEmail, setClientLoginEmail] = useState('');
  const [clientAccounts, setClientAccounts] = useState<any[]>([]);
  const [showAddSubAccountForm, setShowAddSubAccountForm] = useState(false);
  const [loadingClientLoginInfo, setLoadingClientLoginInfo] = useState(false);
  const [savingClientLogin, setSavingClientLogin] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('evraklab_google_script_url') || '');
  const [sendingScript, setSendingScript] = useState(false);

  const getPersonnelQuota = (memberId: string) => {
    const memberAssigns = allAssignments.filter(a => a.user_id === memberId);
    let totalDays = 0;
    memberAssigns.forEach(assign => {
      const client = clients.find(c => c.id === assign.client_id);
      if (client) {
        if (client.permit_stage === 'ek1') {
          totalDays += 2;
        } else if (client.permit_stage === 'ek2') {
          totalDays += 1;
        }
      }
    });
    return totalDays;
  };

  // Ekip Yönetimi (Yönetici Paneli) State'leri
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const roleLabels: any = {
    premium_corporate: 'Çevre Danışmanlık Firma Sahibi',
    corporate_chief: 'Çevre Danışmanlık Firma Yöneticisi',
    corporate_staff: 'Çevre Danışmanlık Personeli',
    normal: 'Normal (Ekip Dışı)',
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if ((activeTab === 'settings' || activeTab === 'team' || activeTab === 'org_chart' || activeTab === 'definitions' || activeTab === 'document_matrix' || activeTab === 'legislations' || activeTab === 'inspections') && orgId) {
      fetchTeamMembers();
    }
    if (activeTab === 'team' && orgId) {
      fetchInvitations();
    }
    if ((activeTab === 'departed' || activeTab === 'finance_summary' || activeTab === 'finance_expenses') && orgId) {
      // finance_summary/finance_expenses'te de fetchlenir - ayrılan
      // personelin geçmiş gider kayıtlarında ismi "Bilinmeyen Personel"
      // olarak görünmesin diye.
      fetchDepartedEmployees();
    }
    if (activeTab === 'staff_expense_submission' && orgId) {
      fetchMyStaffExpenses();
    }
    if ((activeTab === 'definitions' || activeTab === 'document_matrix') && orgId) {
      fetchDefinitionsTab();
      fetchRequiredDocs();
      fetchAllDocsForMatrix();
    }
    if (activeTab === 'opinions' && orgId) {
      fetchOpinionLetters();
    }
    if (activeTab === 'document_requests' && orgId) {
      fetchDocumentRequests();
    }
    if (activeTab === 'msds' && orgId) {
      fetchMsdsDocuments();
    }
    if ((activeTab === 'terminated_clients' || activeTab === 'finance_summary' || activeTab === 'finance_payments') && orgId) {
      // Finans sekmelerinde de sonlandırılan firmaların (varsa) ödenmemiş
      // geçmiş alacakları görünür kalsın diye bu liste de çekilir.
      fetchTerminatedClients();
    }
    if ((activeTab === 'legislations' || activeTab === 'actions' || activeTab === 'requests') && orgId) {
      fetchConsultantLegislations();
      fetchConsultantRequests();
      fetchComplianceActions();
    }
    if (activeTab === 'inspections' && orgId) {
      fetchInspections();
    }
  }, [activeTab, orgId]);

  // Navbar rozeti için: org yüklenir yüklenmez aksiyonları ve "son görülme" zamanını çek
  useEffect(() => {
    if (orgId) {
      fetchComplianceActions();
    }
  }, [orgId]);

  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(`evraklab_actions_seen_${userId}`);
    setActionsLastSeen(stored ? parseInt(stored, 10) : 0);
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'actions' && userId) {
      const now = Date.now();
      localStorage.setItem(`evraklab_actions_seen_${userId}`, String(now));
      setActionsLastSeen(now);
    }
  }, [activeTab, userId]);

  const newActionsCount = complianceActions.filter((a) => {
    const createdMs = a.created_at ? new Date(a.created_at).getTime() : 0;
    return createdMs > actionsLastSeen;
  }).length;

  useEffect(() => {
    if (activeTab === 'legislations' && legSubTab === 'calendar' && orgId) {
      fetchVisitSchedules();
    }
  }, [activeTab, legSubTab, orgId]);

  // Şef (corporate_chief), kendisine atanan firmaların yanı sıra kendisine
  // bağlı (manager_id) personelin atandığı firmaları da görebilsin diye
  // consultant_assignments sorgularında kullanılacak user_id listesini üretir.
  const getAssignmentUserIds = async (roleParam: string, uIdParam: string): Promise<string[]> => {
    if (roleParam !== 'corporate_chief') return [uIdParam];
    const { data: subs } = await supabase.from('profiles').select('id').eq('manager_id', uIdParam);
    return [uIdParam, ...(subs?.map((s: any) => s.id) || [])];
  };

  const fetchVisitSchedules = async () => {
    if (!orgId) return;
    setLoadingVisits(true);
    try {
      let query = supabase
        .from('visit_schedules')
        .select(`
          *,
          client:consultant_clients(name),
          personnel:profiles!personnel_id(full_name)
        `)
        .eq('consultant_company_id', orgId);

      const isRestrictedRole = userRole === 'corporate_staff' || userRole === 'corporate_chief';
      const canViewAll = userRole === 'premium_corporate' || userRole === 'admin' || userRole === 'system_admin' || !!currentUserPerms?.can_view_all_clients;

      if (isRestrictedRole && !canViewAll) {
        // Fetch assigned clients from consultant_assignments
        const assignmentUserIds = await getAssignmentUserIds(userRole, userId);
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .in('user_id', assignmentUserIds);
        const cIds = assignments?.map((a) => a.client_id) || [];
        if (cIds.length > 0) {
          query = query.in('client_id', cIds);
        } else {
          setVisitSchedules([]);
          setLoadingVisits(false);
          return;
        }
      }

      const { data, error } = await query.order('visit_date', { ascending: true });
      if (error) throw error;
      setVisitSchedules(data || []);
    } catch (err: any) {
      console.error('Ziyaretler yüklenirken hata:', err.message);
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    if (!newVisit.client_id || !newVisit.visit_date) {
      alert('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    // Verify date is in the next month or future if the user is staff (personnel)
    if (!isManager) {
      const selectedDate = new Date(newVisit.visit_date);
      const today = new Date();
      const nextMonthFirstDay = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      
      selectedDate.setHours(0, 0, 0, 0);
      nextMonthFirstDay.setHours(0, 0, 0, 0);

      if (selectedDate < nextMonthFirstDay) {
        alert('Personel olarak yalnızca bir sonraki aydan (veya daha ileri bir tarihten) ziyaret talebinde bulunabilirsiniz.');
        return;
      }
    }

    setSavingVisit(true);
    try {
      const visitPayload: any = {
        consultant_company_id: orgId,
        client_id: newVisit.client_id,
        visit_date: newVisit.visit_date,
        notes: newVisit.notes || null,
        status: isManager ? 'scheduled' : 'requested',
      };

      if (!isManager) {
        visitPayload.personnel_id = userId;
      }

      const { error } = await supabase.from('visit_schedules').insert([visitPayload]);

      if (error) throw error;
      
      if (isManager) {
        alert('Ziyaret başarıyla planlandı!');
      } else {
        alert('Ziyaret talebiniz yöneticinize/firma sahibine iletildi. Onay bekliyor.');
      }
      
      setShowAddVisitModal(false);
      setNewVisit({ client_id: '', visit_date: '', notes: '' });
      fetchVisitSchedules();
    } catch (err: any) {
      alert('İşlem gerçekleştirilirken hata: ' + err.message);
    } finally {
      setSavingVisit(false);
    }
  };

  const handleDeleteVisit = async (id: string) => {
    if (!window.confirm('Bu ziyareti silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase.from('visit_schedules').delete().eq('id', id);
      if (error) throw error;
      alert('Ziyaret başarıyla silindi!');
      fetchVisitSchedules();
    } catch (err: any) {
      alert('Ziyaret silinirken hata: ' + err.message);
    }
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    if (!changeRequest.requested_date || !changeRequest.reason) {
      alert('Lütfen yeni tarih ve gerekçenizi belirtin.');
      return;
    }

    setSubmittingChangeRequest(true);
    try {
      const { error } = await supabase
        .from('visit_schedules')
        .update({
          change_request_status: 'pending',
          change_request_date: changeRequest.requested_date,
          change_request_reason: changeRequest.reason,
          personnel_id: userId, // Track who made this change request
        })
        .eq('id', selectedVisit.id);

      if (error) throw error;
      alert('Değişiklik talebiniz başarıyla firma sahibine iletildi.');
      setShowChangeRequestModal(false);
      setSelectedVisit(null);
      setChangeRequest({ requested_date: '', reason: '' });
      fetchVisitSchedules();
    } catch (err: any) {
      alert('Talep gönderilirken hata: ' + err.message);
    } finally {
      setSubmittingChangeRequest(false);
    }
  };

  const handleProcessChangeRequest = async (visitId: string, approve: boolean) => {
    const visit = visitSchedules.find(v => v.id === visitId);
    if (!visit) return;

    const action = approve ? 'onaylamak' : 'reddetmek';
    if (!window.confirm(`Bu değişiklik talebini ${action} istediğinizden emin misiniz?`)) return;

    try {
      const updates: any = {
        change_request_status: approve ? 'approved' : 'rejected',
      };
      
      if (approve && visit.change_request_date) {
        updates.visit_date = visit.change_request_date;
      }

      const { error } = await supabase
        .from('visit_schedules')
        .update(updates)
        .eq('id', visitId);

      if (error) throw error;
      alert(`Değişiklik talebi başarıyla ${approve ? 'onaylandı' : 'reddedildi'}.`);
      fetchVisitSchedules();
    } catch (err: any) {
      alert('İşlem gerçekleştirilirken hata: ' + err.message);
    }
  };

  const handleApproveNewVisit = async (visitId: string) => {
    if (!window.confirm('Bu yeni ziyaret talebini onaylayıp takvime eklemek istiyor musunuz?')) return;
    try {
      const { error } = await supabase
        .from('visit_schedules')
        .update({ status: 'scheduled' })
        .eq('id', visitId);
      if (error) throw error;
      alert('Ziyaret talebi onaylandı ve planlandı!');
      fetchVisitSchedules();
    } catch (err: any) {
      alert('İşlem sırasında hata oluştu: ' + err.message);
    }
  };

  const handleRejectNewVisit = async (visitId: string) => {
    if (!window.confirm('Bu yeni ziyaret talebini reddetmek ve silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('visit_schedules')
        .delete()
        .eq('id', visitId);
      if (error) throw error;
      alert('Ziyaret talebi reddedildi.');
      fetchVisitSchedules();
    } catch (err: any) {
      alert('İşlem sırasında hata oluştu: ' + err.message);
    }
  };

  const handleUpdateVisitStatus = async (visitId: string, newStatus: 'scheduled' | 'completed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('visit_schedules')
        .update({ status: newStatus })
        .eq('id', visitId);
      if (error) throw error;
      alert(`Ziyaret durumu başarıyla güncellendi.`);
      fetchVisitSchedules();
    } catch (err: any) {
      alert('Durum güncellenirken hata: ' + err.message);
    }
  };

  const fetchTeamMembers = async () => {
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, extra_permissions, experience_years, premium_seat_active, manager_id, avatar_url')
      .eq('organization_id', orgId);

    const sortedMembers = (members || []).sort((a, b) => {
      if (a.role === 'premium_corporate' && b.role !== 'premium_corporate') return -1;
      if (a.role !== 'premium_corporate' && b.role === 'premium_corporate') return 1;
      return 0;
    });
    setTeamMembers(sortedMembers);

    // Kota: herkes toplam kullanımı görebilsin
    supabase
      .rpc('get_org_storage_usage', { org_id: orgId })
      .then(({ data }) => setOrgStorageUsed(data || 0));

    // Kişi bazlı kırılım: sadece Yönetici (firma sahibi) görebilir
    if (userRole === 'premium_corporate') {
      supabase
        .rpc('get_org_storage_usage_by_member', { org_id: orgId })
        .then(({ data }) => {
          const map: Record<string, { bytes: number; count: number }> = {};
          (data || []).forEach((r: any) => {
            if (r.uploader_id) map[r.uploader_id] = { bytes: r.total_bytes, count: r.doc_count };
          });
          setMemberStorage(map);
        });
    }
  };

  // Ekip Yönetimi satırından, Personel Kartı'nı açmadan tek tıkla çıkarma.
  // Personel Kartı'ndaki "Şirketten Çıkar" ile aynı RPC'yi (kick_employee_with_exit_date)
  // kullanır — geçmişe dönük çıkış tarihi seçilebilir, bkz. ExitDateModal.
  const handleQuickKick = async (exitDate: string) => {
    if (!pendingKickMember) return;
    setKickingQuick(true);
    try {
      const { error } = await supabase.rpc('kick_employee_with_exit_date', {
        p_profile_id: pendingKickMember.id,
        p_org_id: orgId,
        p_exit_date: exitDate,
      });
      if (error) throw error;
      await supabase.rpc('clear_membership_notifications', { target_user_id: pendingKickMember.id });
      setPendingKickMember(null);
      fetchTeamMembers();
    } catch (err: any) {
      alert('Çıkarılırken hata oluştu: ' + err.message);
    } finally {
      setKickingQuick(false);
    }
  };

  // Ekip Yönetimi satırından, kart açmadan hızlı premium koltuk aç/kapa.
  // PersonnelCard.tsx'teki handleTogglePremiumSeat ile aynı sorgu.
  const handleQuickTogglePremium = async (member: any) => {
    const newValue = member.premium_seat_active === false;
    const { error } = await supabase.from('profiles').update({ premium_seat_active: newValue }).eq('id', member.id);
    if (error) return alert('Premium koltuk güncellenirken hata: ' + error.message);
    fetchTeamMembers();
  };

  const fetchDepartedEmployees = async () => {
    const { data, error } = await supabase
      .from('employee_details')
      .select('*, profile:profile_id(full_name, email, phone, avatar_url)')
      .eq('organization_id', orgId)
      .not('exit_date', 'is', null)
      .order('exit_date', { ascending: false });
    if (error) return console.error('fetchDepartedEmployees error:', error.message);
    setDepartedEmployees(data || []);
  };

  // Ayrılmış bir personeli geri al. Girilen tarih eski çıkış tarihinden
  // sonraysa gerçek (boşluklu) tekrar işe alım olarak yeni bir çalışma
  // dönemi açılır (bkz. reactivate_departed_employee, add_employee_
  // employment_periods.sql); değilse (veya tarih girilmezse) eski
  // kick_employee_with_exit_date'in kaydettiği role (role_before_exit)
  // ile "yanlışlıkla çıkarma" düzeltmesi olarak aynı dönem devam eder.
  const handleReactivateEmployee = async (profileId: string, rehireDate: string) => {
    setReactivatingEmployeeId(profileId);
    try {
      const { error } = await supabase.rpc('reactivate_departed_employee', {
        p_profile_id: profileId,
        p_org_id: orgId,
        p_rehire_date: rehireDate,
      });
      if (error) throw error;
      setPendingReactivateMember(null);
      alert('Personel yeniden aktif edildi.');
      await fetchDepartedEmployees();
      await fetchTeamMembers();
    } catch (err: any) {
      alert('Geri alınırken hata: ' + err.message);
    } finally {
      setReactivatingEmployeeId(null);
    }
  };

  const fetchInvitations = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_used', false)
      .order('created_at', { ascending: false });
    setInvitations(data || []);
  };

  const fetchQuotaDetail = async () => {
    if (!orgId) return;
    setLoadingQuotaDetail(true);
    try {
      const [{ data: byClient }, { data: docs }] = await Promise.all([
        supabase.rpc('get_org_storage_usage_by_client', { org_id: orgId }),
        supabase
          .from('documents')
          .select('id, title, file_size, created_at, is_indefinite, uploader:profiles!uploader_id(full_name), location_def:user_definitions!location_def_id(label)')
          .or(`organization_id.eq.${orgId},billing_org_id.eq.${orgId}`)
          .order('file_size', { ascending: false }),
      ]);
      setClientStorage(byClient || []);
      setOrgDocumentsForQuota(docs || []);
    } catch (err: any) {
      console.error('Kota detayı yüklenirken hata:', err.message);
    } finally {
      setLoadingQuotaDetail(false);
    }
  };

  const handleOpenQuotaDetail = () => {
    if (userRole !== 'premium_corporate') return;
    setShowQuotaDetailModal(true);
    fetchQuotaDetail();
  };

  const handleDeleteQuotaDocument = async (docId: string) => {
    if (!window.confirm('Bu belgeyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem kotanızda yer açar ve geri alınamaz.')) return;
    setDeletingQuotaDocId(docId);
    try {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) throw error;
      setOrgDocumentsForQuota((prev) => prev.filter((d) => d.id !== docId));
      await fetchQuotaDetail();
      await fetchTeamMembers();
    } catch (err: any) {
      alert('Belge silinirken hata: ' + err.message);
    } finally {
      setDeletingQuotaDocId(null);
    }
  };

  const groupDefinitions = (defs: any[], orgProfiles: any[]) => {
    const grouped: any[] = [];
    const labelGroups = new Map<string, any[]>();
    
    // Group by label (case-insensitive)
    defs.forEach(d => {
      if (!d.label) return;
      const key = d.label.trim().toLowerCase();
      if (!labelGroups.has(key)) {
        labelGroups.set(key, []);
      }
      labelGroups.get(key)!.push(d);
    });

    const activeMemberIds = orgProfiles.map(m => m.id);
    // Sahibin adını embed edilen "user" ilişkisinden değil, doğrudan
    // orgProfiles listesinden (user_id -> full_name) çözüyoruz; embed bazen
    // (ör. bireysel premium hesaplarda) boş dönebiliyor ve "Bilinmeyen"
    // gösteriyordu.
    const profileNameById = new Map<string, string>(
      orgProfiles.map(m => [m.id, m.full_name])
    );

    labelGroups.forEach((rows, labelKey) => {
      const rowUserIds = rows.map(r => r.user_id);
      // Check if this label covers all active team members
      const coversAll = activeMemberIds.length > 0 && activeMemberIds.every(id => rowUserIds.includes(id));

      if (coversAll) {
        grouped.push({
          id: `group:${rows.map(r => r.id).join(',')}`,
          label: rows[0].label,
          isGroup: true,
          rowIds: rows.map(r => r.id),
          ownerName: 'Tüm Ekip',
          category: rows[0].category,
          created_at: rows[0].created_at
        });
      } else {
        rows.forEach(r => {
          grouped.push({
            ...r,
            isGroup: false,
            rowIds: [r.id],
            ownerName: profileNameById.get(r.user_id) || r.user?.full_name || 'Bilinmeyen'
          });
        });
      }
    });

    return grouped.sort((a, b) => a.label.localeCompare(b.label));
  };

  const fetchDefinitionsTab = async () => {
    if (!orgId) return;
    try {
      const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', orgId);

      const { data: defs, error } = await supabase
        .from('user_definitions')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch company names to prevent deletion of registered business locations
      const { data: clientsData } = await supabase
        .from('consultant_clients')
        .select('name')
        .eq('consultant_company_id', orgId);
      setClientNames(clientsData?.map(c => c.name) || []);

      if (defs) {
        setRawDefs(defs);
        const groupedTypes = groupDefinitions(defs.filter(d => d.category === 'doc_type'), orgProfiles || []);
        const groupedLocs = groupDefinitions(defs.filter(d => d.category === 'location'), orgProfiles || []);
        setDefTabTypes(groupedTypes);
        setDefTabLocs(groupedLocs);
      }
    } catch (err: any) {
      console.error('Tanımlar çekilirken hata:', err.message);
    }
  };

  const fetchRequiredDocs = async () => {
    if (!orgId) return;
    setLoadingReqDocs(true);
    try {
      const { data, error } = await supabase
        .from('client_required_documents')
        .select('*');
      if (error) throw error;
      setRequiredDocs(data || []);
    } catch (err: any) {
      console.error('Zorunlu belgeler çekilemedi:', err);
    } finally {
      setLoadingReqDocs(false);
    }
  };

  const fetchAllDocsForMatrix = async () => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, type_def_id, location_def_id, is_archived, expiry_date, is_indefinite, file_url, title, application_deadline')
        .eq('organization_id', orgId)
        .eq('is_archived', false);
      if (error) throw error;
      setAllDocsForMatrix(data || []);
    } catch (err) {
      console.error('Matris için belgeler çekilemedi:', err);
    }
  };

  const handleShowDocumentDetail = async (docId: string, clientInfo?: any) => {
    setLoadingDetailDoc(true);
    setShowDetailModal(true);
    setSelectedDetailClient(clientInfo || null);
    
    // Default values for asking status
    setAskNote('');
    setAskMode('chat');
    setAskDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 7 days from now
    
    if (clientInfo) {
      const clientAssigns = allAssignments.filter(a => a.client_id === clientInfo.id);
      if (clientAssigns.length > 0) {
        setAskTargetUserId(clientAssigns[0].user_id);
      } else {
        setAskTargetUserId('');
      }
    } else {
      setAskTargetUserId('');
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          expiry_date,
          is_indefinite,
          file_url,
          description,
          created_at,
          acquisition_date,
          application_deadline,
          uploader_id,
          type_def_id,
          location_def_id,
          type_def:user_definitions!type_def_id(label),
          location_def:user_definitions!location_def_id(label),
          uploader:profiles!uploader_id(full_name)
        `)
        .eq('id', docId)
        .single();
      if (error) throw error;
      setSelectedDetailDoc(data);
    } catch (err: any) {
      console.error('Belge detayları getirilirken hata oluştu:', err);
      alert('Belge detayları yüklenemedi: ' + err.message);
      setShowDetailModal(false);
    } finally {
      setLoadingDetailDoc(false);
    }
  };

  const handleAskStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetailDoc || !askTargetUserId) return;
    setIsSubmittingAsk(true);
    try {
      if (askMode === 'chat') {
        const messageText = askNote.trim() || `Lütfen bu evrağın durumunu kontrol edin: ${selectedDetailDoc.title} (${selectedDetailClient?.name})`;
        const { error } = await supabase.from('company_messages').insert([
          {
            organization_id: orgId,
            sender_id: userId,
            receiver_id: askTargetUserId,
            message: messageText,
            document_id: selectedDetailDoc.id,
            document_title: selectedDetailDoc.title,
          },
        ]);
        if (error) throw error;
        alert('Durum sorusu sohbet üzerinden ilgili personele iletildi!');
      } else {
        const descText = askNote.trim() || `${selectedDetailDoc.title} belgesi için durum kontrolü talep edildi.`;
        const { error } = await supabase
          .from('compliance_actions')
          .insert({
            client_id: selectedDetailClient.id,
            article_id: null,
            title: `Evrak Durum Kontrolü: ${selectedDetailDoc.title}`,
            description: descText,
            due_date: askDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            created_by: userId,
            assigned_to: askTargetUserId,
            status: 'pending'
          });
        if (error) throw error;
        alert('Görev/Aksiyon başarıyla oluşturuldu ve personele atandı!');
        await fetchComplianceActions();
      }
      setAskNote('');
    } catch (err: any) {
      alert('İşlem gerçekleştirilirken hata oluştu: ' + err.message);
    } finally {
      setIsSubmittingAsk(false);
    }
  };

  const handleAskStatusForMissing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMissingDocType || !askTargetUserId || !selectedMissingClientName) return;
    
    const client = clients.find(c => c.name === selectedMissingClientName);
    if (!client) {
      alert('İşletme bulunamadı.');
      return;
    }

    setIsSubmittingAsk(true);
    try {
      if (askMode === 'chat') {
        const messageText = askNote.trim() || `Lütfen bu eksik evrağın durumunu kontrol edip yüklenmesini sağlayın: ${selectedMissingDocType} (${client.name})`;
        const { error } = await supabase.from('company_messages').insert([
          {
            organization_id: orgId,
            sender_id: userId,
            receiver_id: askTargetUserId,
            message: messageText,
            document_id: null,
            document_title: `Eksik Belge: ${selectedMissingDocType}`,
          },
        ]);
        if (error) throw error;
        alert('Durum sorusu sohbet üzerinden ilgili personele iletildi!');
      } else {
        const descText = askNote.trim() || `${selectedMissingDocType} belgesinin eksik olduğu tespit edilmiş ve temini talep edilmiştir.`;
        const { error } = await supabase
          .from('compliance_actions')
          .insert({
            client_id: client.id,
            article_id: null,
            title: `Eksik Belge Temini: ${selectedMissingDocType}`,
            description: descText,
            due_date: askDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            created_by: userId,
            assigned_to: askTargetUserId,
            status: 'pending'
          });
        if (error) throw error;
        alert('Görev/Aksiyon başarıyla oluşturuldu ve personele atandı!');
        await fetchComplianceActions();
      }
      setAskNote('');
      setShowMissingModal(false);
      setSelectedMissingDocType(null);
      setSelectedMissingClientName(null);
    } catch (err: any) {
      alert('İşlem gerçekleştirilirken hata oluştu: ' + err.message);
    } finally {
      setIsSubmittingAsk(false);
    }
  };

  const handleToggleRequiredDoc = async (clientId: string, type: any, makeRequired: boolean) => {
    try {
      const targetId = type.isGroup ? type.rowIds[0] : type.id;
      if (makeRequired) {
        const { error } = await supabase
          .from('client_required_documents')
          .upsert({
            client_id: clientId,
            type_def_id: targetId,
            is_exempt: false
          }, { onConflict: 'client_id,type_def_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_required_documents')
          .delete()
          .eq('client_id', clientId)
          .in('type_def_id', type.rowIds);
        if (error) throw error;
      }
      await fetchRequiredDocs();
    } catch (err: any) {
      alert('Zorunlu belge ayarı güncellenirken hata: ' + err.message);
    }
  };

  const handleToggleRequiredDocAll = async (type: any, makeRequired: boolean) => {
    if (clients.length === 0) return;
    try {
      const targetId = type.isGroup ? type.rowIds[0] : type.id;
      if (makeRequired) {
        const inserts = clients.map(c => ({
          client_id: c.id,
          type_def_id: targetId,
          is_exempt: false
        }));
        const { error } = await supabase
          .from('client_required_documents')
          .upsert(inserts, { onConflict: 'client_id,type_def_id' });
        if (error) throw error;
      } else {
        const clientIds = clients.map(c => c.id);
        const { error } = await supabase
          .from('client_required_documents')
          .delete()
          .in('client_id', clientIds)
          .in('type_def_id', type.rowIds);
        if (error) throw error;
      }
      await fetchRequiredDocs();
    } catch (err: any) {
      alert('Toplu zorunlu belge ayarı güncellenirken hata: ' + err.message);
    }
  };

  const handleAddTabDocType = async () => {
    if (!newDefTypeLabel.trim()) return;
    
    const exists = rawDefs.some(t => t.category === 'doc_type' && t.label && t.label.toLowerCase() === newDefTypeLabel.trim().toLowerCase() &&
      (selectedDefTypeMemberId === 'all' || t.user_id === selectedDefTypeMemberId)
    );
    if (exists) {
      alert(`⛔ "${newDefTypeLabel.trim()}" seçilen kapsamda zaten tanımlanmış!`);
      return;
    }

    setSavingDef(true);
    try {
      // Insert a single org-scoped row using the current user's ID.
      // organization_id ensures all org members can read it via RLS SELECT policy.
      // Inserting per-member rows would violate RLS (can only insert with own user_id).
      const targetUserId = selectedDefTypeMemberId === 'all' ? userId : selectedDefTypeMemberId;

      const { error } = await supabase
        .from('user_definitions')
        .insert({
          user_id: targetUserId,
          category: 'doc_type',
          label: newDefTypeLabel.trim(),
          organization_id: orgId
        });

      if (error) throw error;
      setNewDefTypeLabel('');
      await fetchDefinitionsTab();
    } catch (err: any) {
      alert('Belge türü eklenirken hata: ' + err.message);
    } finally {
      setSavingDef(false);
    }
  };

  const handleAddTabLocation = async () => {
    if (!newDefLocLabel.trim()) return;

    const exists = rawDefs.some(l => l.category === 'location' && l.label && l.label.toLowerCase() === newDefLocLabel.trim().toLowerCase() && 
      (selectedDefMemberId === 'all' || l.user_id === selectedDefMemberId)
    );
    if (exists) {
      alert(`⛔ "${newDefLocLabel.trim()}" seçilen kapsamda zaten tanımlanmış!`);
      return;
    }

    setSavingDef(true);
    try {
      // Insert a single org-scoped row using the current user's ID.
      // organization_id ensures all org members can read it via RLS SELECT policy.
      // Inserting per-member rows would violate RLS (can only insert with own user_id).
      const targetUserId = selectedDefMemberId === 'all' ? userId : selectedDefMemberId;

      const { error } = await supabase
        .from('user_definitions')
        .insert({
          user_id: targetUserId,
          category: 'location',
          label: newDefLocLabel.trim(),
          organization_id: orgId
        });

      if (error) throw error;

      // Bireysel premium hesaplarda "Lokasyon" tanımı, Aksiyon/Görüş/Mevzuat/
      // Zorunlu Belge gibi her yerde kullanılan "İşletme" (consultant_clients)
      // kaydına da otomatik yansır - bu hesaplarda gerçek bir müşteri firma
      // kavramı olmadığı için kendi tanımladığı lokasyon bu rolü üstlenir.
      if (userRole === 'premium_individual' && orgId) {
        const label = newDefLocLabel.trim();
        const alreadyClient = clients.some(c => c.name.toLowerCase() === label.toLowerCase());
        if (!alreadyClient) {
          await supabase.from('consultant_clients').insert({
            consultant_company_id: orgId,
            name: label,
          });
        }
        await fetchClients(orgId, userRole, userId);
      }

      setNewDefLocLabel('');
      await fetchDefinitionsTab();
    } catch (err: any) {
      alert('Lokasyon eklenirken hata: ' + err.message);
    } finally {
      setSavingDef(false);
    }
  };

  const handleDeleteTabDefinition = async (id: string) => {
    let idsToDelete: string[] = [];
    let isBusiness = false;
    let label = '';

    if (id.startsWith('group:')) {
      idsToDelete = id.substring(6).split(',');
      const firstId = idsToDelete[0];
      const match = rawDefs.find(d => d.id === firstId);
      if (match) {
        label = match.label;
      }
    } else {
      idsToDelete = [id];
      const match = rawDefs.find(d => d.id === id);
      if (match) {
        label = match.label;
      }
    }

    if (label) {
      isBusiness = clientNames.some(
        cName => cName && label && cName.trim().toLowerCase() === label.trim().toLowerCase()
      );
      if (isBusiness) {
        alert('⛔ Kayıtlı bir işletmeye ait lokasyon silinemez!');
        return;
      }
    }

    if (!window.confirm('Bu tanımı silmek istediğinize emin misiniz? Bu işlem bağlı belgeleri etkileyebilir.')) return;
    try {
      const { error } = await supabase
        .from('user_definitions')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;
      await fetchDefinitionsTab();
    } catch (err: any) {
      alert('Silme işlemi başarısız: ' + err.message);
    }
  };

  // E-posta ile ekip daveti gönderir (Google Apps Script üzerinden). Kişi sisteme
  // kayıtlıysa "davetiniz var, bildirimlerinizi kontrol edin" maili; kayıtlı
  // değilse tıklayınca kayıt olup otomatik firmaya katılacağı bir bağlantı gider.
  const sendTeamInviteEmail = async (
    targetEmail: string,
    orgName: string,
    loginLink: string,
    isNewUser: boolean
  ) => {
    try {
      const { data: scriptSetting } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'script_url')
        .maybeSingle();
      const actualScriptUrl = scriptSetting?.value;
      if (!actualScriptUrl) {
        console.warn('Davet e-postası gönderilemedi: Google Apps Script URL tanımlı değil.');
        return;
      }
      await fetch(actualScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isNewUser ? 'team_invite_register' : 'team_invite',
          email: targetEmail,
          orgName,
          loginLink,
        }),
      });
    } catch (err) {
      console.error('Davet e-postası gönderim hatası:', err);
    }
  };

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!inviteEmail.includes('@')) return alert('Geçerli bir e-posta adresi giriniz.');

    setSendingEmail(true);
    try {
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', inviteEmail)
        .eq('is_used', false)
        .maybeSingle();

      if (existingInvite) {
        alert('⚠️ Bu kullanıcıya zaten bekleyen bir davet var.');
        setSendingEmail(false);
        return;
      }

      // Kullanıcıyı Bul (sistemde kayıtlı mı, değil mi?)
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id, full_name, organization_id')
        .eq('email', inviteEmail)
        .maybeSingle();

      if (targetUser?.organization_id) {
        alert('⚠️ Bu kullanıcı zaten bir şirkete/firmaya bağlı.');
        setSendingEmail(false);
        return;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([{ code, organization_id: orgId, email: inviteEmail }]);

      if (inviteError) throw inviteError;

      const orgNameForMail = orgData?.name || 'Danışmanlık Firması';

      if (targetUser) {
        // Sisteme kayıtlı kullanıcı: uygulama içi bildirim + bilgilendirme e-postası
        await supabase.from('notifications').insert([
          {
            user_id: targetUser.id,
            title: 'Danışmanlık Firması Daveti',
            message: `${orgNameForMail} sizi ekibine katılmaya davet etti.`,
            type: 'invite',
            metadata: {
              org_id: orgId,
              org_name: orgData?.name,
              invite_code: code,
            },
          },
        ]);
        await sendTeamInviteEmail(inviteEmail, orgNameForMail, `${window.location.origin}/notifications`, false);
        alert('✅ Davet başarıyla gönderildi! Kullanıcıya uygulama içi bildirim ve e-posta iletildi.');
      } else {
        // Sistemde kayıtlı olmayan kullanıcı: kayıt olunca otomatik katılacağı bağlantı
        const registerLink = `${window.location.origin}/register?invite_org=${orgId}&invite_code=${code}&invite_email=${encodeURIComponent(inviteEmail)}`;
        await sendTeamInviteEmail(inviteEmail, orgNameForMail, registerLink, true);
        alert('✅ Davet başarıyla gönderildi! Bu e-posta sistemde kayıtlı olmadığı için kayıt bağlantısı içeren bir davet e-postası gönderildi. Kayıt olduğunda otomatik olarak firmaya katılacak.');
      }

      setInviteEmail('');
      fetchInvitations();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateCode = async () => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const { error } = await supabase
        .from('invitations')
        .insert([
          { code, organization_id: orgId, email: null, is_used: false },
        ]);
      if (error) throw error;
      alert(`✅ Davet Kodu Oluşturuldu: ${code}`);
      fetchInvitations();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!window.confirm('Bu daveti iptal etmek istiyor musunuz?')) return;
    await supabase.from('invitations').delete().eq('id', id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Kopyalandı: ' + code);
  };

  const handleAssignManager = async (memberId: string, managerId: string | null) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    setSavingManagerId(memberId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', memberId);
      if (error) throw error;
      setTeamMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, manager_id: managerId } : m)));
    } catch (err: any) {
      alert('Organizasyon şeması güncellenirken hata oluştu: ' + err.message);
    } finally {
      setSavingManagerId(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // NOT: Supabase'de 'client_assets' adında public bir bucket oluşturulmuş olmalıdır.
      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);

      if (isEditMode) {
        setEditingClient((prev: any) => ({ ...prev, logo_url: data.publicUrl }));
      } else {
        setNewClient({ ...newClient, logo_url: data.publicUrl });
      }
    } catch (err: any) {
      alert('Logo yüklenirken hata: ' + err.message + '\nLütfen Supabase panelinden "client_assets" adında public bir bucket oluşturduğunuzdan emin olun.');
    } finally {
      setUploadingLogo(false);
    }
  };
  
  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingContract(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `contract_${Math.random()}.${fileExt}`;
      const filePath = `contracts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);

      if (isEditMode) {
        setEditingClient((prev: any) => ({ ...prev, contract_file_url: data.publicUrl }));
      } else {
        setNewClient(prev => ({ ...prev, contract_file_url: data.publicUrl }));
      }
      alert('Sözleşme dosyası başarıyla yüklendi!');
    } catch (err: any) {
      alert('Sözleşme yüklenirken hata: ' + err.message);
    } finally {
      setUploadingContract(false);
    }
  };

  const handleBranchLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBranchLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('client_assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client_assets').getPublicUrl(filePath);
      setNewBranch((prev) => ({ ...prev, logo_url: data.publicUrl }));
    } catch (err: any) {
      alert('Logo yüklenirken hata: ' + err.message);
    } finally {
      setUploadingBranchLogo(false);
    }
  };

  const handleBranchContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBranchContract(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `contract_${Math.random()}.${fileExt}`;
      const filePath = `contracts/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('client_assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client_assets').getPublicUrl(filePath);
      setNewBranch((prev) => ({ ...prev, contract_file_url: data.publicUrl }));
      alert('Sözleşme dosyası başarıyla yüklendi!');
    } catch (err: any) {
      alert('Sözleşme yüklenirken hata: ' + err.message);
    } finally {
      setUploadingBranchContract(false);
    }
  };

  const handleOrgLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `org_${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);

      const newLogoUrl = data.publicUrl;

      // Hemen veritabanına kaydet
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ consultant_logo_url: newLogoUrl })
        .eq('id', orgId);

      if (dbError) throw dbError;

      setOrgData({ ...orgData, consultant_logo_url: newLogoUrl });
      alert('Danışman logosu başarıyla güncellendi!');
    } catch (err: any) {
      alert('Logo yüklenirken hata: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveOrg = async () => {
    setSavingOrg(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgData.name,
          consultant_logo_url: orgData.consultant_logo_url,
          phone: orgData.phone || null,
          email: orgData.email || null,
          address: orgData.address || null,
        })
        .eq('id', orgId);

      if (error) throw error;
      alert('Şirket ayarları başarıyla güncellendi!');
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSavingOrg(false);
    }
  };

  // Depolama sağlayıcısı Google Drive ise "Firma Ortak Alanı" kotasını biz
  // belirlemediğimiz (Google'ın kendi kotası geçerli olduğu) için, mümkünse
  // Google'ın kendi hesap kotasını (about.storageQuota) çekip gösteriyoruz;
  // alamazsak (örn. Google Workspace'te limit alanı hiç dönmeyebilir) "Sınırsız" gösteriyoruz.
  const fetchGoogleDriveQuota = async () => {
    if (!orgData?.google_drive_refresh_token || !orgData?.google_client_id || !orgData?.google_client_secret) {
      setGoogleDriveQuota(null);
      return;
    }
    setLoadingGoogleDriveQuota(true);
    try {
      const tokenRes = await fetch('/api/google-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refresh',
          client_id: orgData.google_client_id,
          client_secret: orgData.google_client_secret,
          refresh_token: orgData.google_drive_refresh_token,
        }),
      });
      const result = await tokenRes.json();
      if (!result.success) throw new Error(result.error || 'Token yenilenemedi.');
      const accessToken = result.data.access_token;

      const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!aboutRes.ok) throw new Error('Google Drive kota bilgisi alınamadı.');
      const aboutData = await aboutRes.json();
      const quota = aboutData.storageQuota;
      setGoogleDriveQuota({
        usage: Number(quota?.usage) || 0,
        limit: quota?.limit != null ? Number(quota.limit) : null,
      });
    } catch (err) {
      console.error('Google Drive kota bilgisi alınamadı:', err);
      setGoogleDriveQuota(null);
    } finally {
      setLoadingGoogleDriveQuota(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'team' && orgData?.storage_preference === 'google_drive' && orgData?.google_drive_refresh_token) {
      fetchGoogleDriveQuota();
    }
  }, [activeTab, orgData?.storage_preference, orgData?.google_drive_refresh_token]);

  const handleSaveStorageSettings = async () => {
    if (userRole !== 'premium_corporate') return;
    setSavingStorageSettings(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          storage_preference: orgData?.storage_preference || 'supabase',
          google_client_id: orgData?.google_client_id || null,
          google_client_secret: orgData?.google_client_secret || null,
          google_drive_folder_id: orgData?.google_drive_folder_id || null,
        })
        .eq('id', orgId);
      if (error) throw error;
      alert('Depolama ayarları kaydedildi.');
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSavingStorageSettings(false);
    }
  };

  // Google OAuth onay ekranını popup ile açar; App.tsx'teki genel popup
  // dinleyicisi (window.opener.postMessage) koddan döndüğünde burada yakalanıp
  // token değişimi yapılır ve organizations.google_drive_* alanlarına kaydedilir.
  // "Owner manages org chart..." trigger'ının genişletilmiş hali sayesinde
  // (bkz. allow_org_owner_manage_google_drive_settings migration) firma sahibi
  // bu yazma işlemini artık admin olmadan da yapabiliyor.
  const googleOauthRedirectUriOwner = `${window.location.origin}/`;

  const handleConnectGoogleDriveOwner = () => {
    if (!orgData?.google_client_id?.trim() || !orgData?.google_client_secret?.trim()) {
      alert('Lütfen önce Google Client ID ve Client Secret alanlarını doldurup kaydedin.');
      return;
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: orgData.google_client_id.trim(),
      redirect_uri: googleOauthRedirectUriOwner,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

    const popup = window.open(authUrl, 'google-oauth-connect-owner', 'width=520,height=680');
    if (!popup) {
      alert('Popup engellendi. Lütfen bu site için tarayıcınızda popup iznini açın.');
      return;
    }

    setConnectingGoogleDriveOwner(true);

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'GOOGLE_OAUTH_CODE') return;
      window.removeEventListener('message', handleMessage);

      const code = event.data.code;
      if (!code) {
        setConnectingGoogleDriveOwner(false);
        alert('Google yetkilendirme kodu alınamadı.');
        return;
      }

      try {
        const exchangeRes = await fetch('/api/google-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exchange',
            code,
            client_id: orgData.google_client_id.trim(),
            client_secret: orgData.google_client_secret.trim(),
            redirect_uri: googleOauthRedirectUriOwner,
          }),
        });
        const exchangeResult = await exchangeRes.json();
        if (!exchangeRes.ok || !exchangeResult.success) {
          throw new Error(exchangeResult.error || 'Google token değişimi başarısız oldu.');
        }
        const { access_token, refresh_token } = exchangeResult.data;
        if (!refresh_token) {
          throw new Error(
            'Google bir refresh token döndürmedi. Google hesabınızdaki (myaccount.google.com/permissions) ' +
            'bu uygulamaya ait mevcut izni iptal edip tekrar deneyin.'
          );
        }

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const userInfo = await userInfoRes.json();
        const connectedEmail = userInfo.email || '';

        const { error: updateErr } = await supabase
          .from('organizations')
          .update({
            storage_preference: 'google_drive',
            google_client_id: orgData.google_client_id.trim(),
            google_client_secret: orgData.google_client_secret.trim(),
            google_drive_folder_id: orgData.google_drive_folder_id?.trim() || null,
            google_drive_refresh_token: refresh_token,
            google_drive_connected_email: connectedEmail,
          })
          .eq('id', orgId);
        if (updateErr) throw updateErr;

        setOrgData({
          ...orgData,
          storage_preference: 'google_drive',
          google_drive_refresh_token: refresh_token,
          google_drive_connected_email: connectedEmail,
        });
        alert(`✅ Google Drive başarıyla bağlandı!\nBağlı hesap: ${connectedEmail}`);
      } catch (err: any) {
        alert('Google Drive bağlantı hatası: ' + err.message);
      } finally {
        setConnectingGoogleDriveOwner(false);
      }
    };

    window.addEventListener('message', handleMessage);
  };

  const handleDisconnectGoogleDriveOwner = async () => {
    if (
      !window.confirm(
        'Google Drive bağlantınızı kaldırmak istediğinize emin misiniz? ' +
        'Bağlantı kaldırıldıktan sonra yeniden bağlanana kadar belge yükleyemezsiniz.'
      )
    )
      return;
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          google_drive_refresh_token: null,
          google_drive_access_token: null,
          google_drive_connected_email: null,
        })
        .eq('id', orgId);
      if (error) throw error;
      setOrgData({ ...orgData, google_drive_refresh_token: null, google_drive_connected_email: null });
      alert('Google Drive bağlantısı kaldırıldı.');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  const openAssignModal = async (client: any) => {
    if (!canAssignClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    setSelectedClient(client);
    setShowAssignModal(true);

    try {
      // Fetch team members of the consultant company
      const { data: members, error: membersErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, extra_permissions, experience_years, premium_seat_active')
        .eq('organization_id', orgId);
      if (membersErr) throw membersErr;
      setTeamMembers(members || []);

      // Fetch current assignments for this client
      const { data: assigns, error: assignsErr } = await supabase
        .from('consultant_assignments')
        .select('user_id')
        .eq('client_id', client.id);
      if (assignsErr) throw assignsErr;
      setCurrentAssignments(assigns?.map(a => a.user_id) || []);
    } catch (err: any) {
      // Önceden hata sessizce yutuluyordu: sorgu başarısız olduğunda modal
      // boş bir "ekip üyesi yok" ekranıyla açılıyor, kullanıcıya "sayfa
      // açılmıyor" gibi görünüyordu. Artık hata görünür ve tekrar denenebilir.
      alert('Ekip/atama bilgileri yüklenirken hata oluştu: ' + err.message + '\nLütfen tekrar deneyin.');
      setShowAssignModal(false);
    }
  };

  const handleToggleAssign = async (uId: string) => {
    if (!canAssignClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      if (currentAssignments.includes(uId)) {
        // Remove assignment
        const { error } = await supabase
          .from('consultant_assignments')
          .delete()
          .eq('client_id', selectedClient.id)
          .eq('user_id', uId);
        if (error) throw error;
        setCurrentAssignments(prev => prev.filter(id => id !== uId));
        setAllAssignments(prev => prev.filter(a => !(a.client_id === selectedClient.id && a.user_id === uId)));
      } else {
        // Add assignment
        // Hem Çevre İzin hem ÇED tarafında EK-1 kapsamı aynı 3 yıl deneyim
        // şartına tabidir (bkz. mevzuat: EK-1 kapsamındaki tesisler daha
        // yüksek çevresel risk taşır); önceden sadece permit_stage kontrol
        // ediliyordu, ced_status='ek1' olan firmalar bu şarttan kaçıyordu.
        if (selectedClient?.permit_stage === 'ek1' || selectedClient?.ced_status === 'ek1') {
          const member = teamMembers.find(m => m.id === uId);
          const experience = member ? (member.experience_years || 0) : 0;
          if (experience < 3) {
            alert(`Atama Hatası: EK-1 kapsamındaki işletmelere çevre yönetimi hizmeti verecek personelin en az 3 yıl mesleki tecrübeye sahip olması gerekmektedir. Seçilen personelin deneyimi: ${experience} Yıl.`);
            return;
          }
        }

        const { error } = await supabase
          .from('consultant_assignments')
          .insert([{ client_id: selectedClient.id, user_id: uId }]);
        if (error) throw error;
        setCurrentAssignments(prev => [...prev, uId]);
        setAllAssignments(prev => [...prev, { client_id: selectedClient.id, user_id: uId }]);
      }
    } catch (err: any) {
      alert('Atama yapılırken hata: ' + err.message);
    }
  };

  const getStatusStyles = (art: any) => {
    if (!art.is_mandatory) {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 opacity-70';
    }

    const nowStr = new Date().toISOString().split('T')[0];
    const isExpired = art.expiry_date && art.expiry_date < nowStr;

    if (art.compliance_status === 'compliant') {
      if (isExpired) {
        return 'border-rose-250 dark:border-rose-800 bg-rose-50/10 dark:bg-rose-950/5 animate-compliance-blink';
      }
      return 'border-emerald-250 dark:border-emerald-800 bg-emerald-50/10 dark:bg-emerald-950/5';
    }
    if (art.compliance_status === 'non_compliant') {
      if (isExpired) {
        return 'border-rose-250 dark:border-rose-800 bg-rose-50/10 dark:bg-rose-950/5 animate-compliance-blink';
      }
      return 'border-rose-250 dark:border-rose-800 bg-rose-50/10 dark:bg-rose-950/5';
    }
    return 'border-amber-250 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-950/5';
  };

  const getContractStatus = (startDateStr: string | undefined) => {
    if (!startDateStr) return null;
    const start = new Date(startDateStr);
    // Expiry is start date + 1 year
    const expiry = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return {
      expiryDate: expiry,
      daysLeft: diffDays,
      isExpired: diffDays <= 0,
      isWarning: diffDays > 0 && diffDays <= 10
    };
  };

  // Sözleşme durumu artık sabit "service_start_date + 1 yıl" yerine, o
  // firmanın en güncel consultant_client_service_periods satırının
  // end_date'ine göre hesaplanır (bkz. add_consultant_client_service_periods.sql
  // - "Hizmet Yenile" her tıklamada ardışık yeni bir dönem ekler). Henüz hiç
  // dönemi olmayan (ör. eski/taşınmamış veri) bir firma için eski hesaba
  // (service_start_date + 1 yıl) geri düşülür.
  const getClientServiceStatus = (clientId: string, fallbackStartDate?: string | null, terminatedAt?: string | null) => {
    const isTerminated = !!terminatedAt;
    const periods = servicePeriods
      .filter((p) => p.client_id === clientId)
      .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
    if (periods.length === 0) {
      if (!fallbackStartDate) return null;
      const fallback = getContractStatus(fallbackStartDate);
      return fallback ? { ...fallback, startDate: new Date(fallbackStartDate), currentFee: 0, latestPeriod: null, isTerminated } : null;
    }
    const latest = periods[0];
    const earliest = periods[periods.length - 1];
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
      isWarning: diffDays > 0 && diffDays <= 10,
      currentFee: Number(latest.monthly_fee) || 0,
      latestPeriod: latest,
      isTerminated,
    };
  };

  const fetchUserDocuments = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, file_url')
        .eq('uploader_id', uid)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setUserDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching user documents:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserDocuments(userId);
    }
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      setUserEmail(session.user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id, extra_permissions, subscription_end_date, premium_seat_active, previous_role')
        .eq('id', session.user.id)
        .single();

        if (profile) {
        setUserRole(profile.role);
        setOrgId(profile.organization_id);
        setMySubEndDate(profile.subscription_end_date || null);
        setPremiumSeatActive(profile.premium_seat_active !== false);
        setPreviousRole(profile.previous_role || null);
        const perms = profile.extra_permissions || {};
        setCurrentUserPerms(perms);

        if (profile.organization_id) {
          supabase
            .from('organizations')
            .select('enabled_modules')
            .eq('id', profile.organization_id)
            .maybeSingle()
            .then(({ data: orgRes }) => {
              if (orgRes?.enabled_modules) {
                setOrgEnabledModules(orgRes.enabled_modules);
              }
            });
        }

        if (profile.role === 'corporate_chief') {
          if (perms.can_view_team !== false) {
            setActiveTab('team');
          } else if (perms.can_view_clients !== false) {
            setActiveTab('clients');
          } else if (perms.can_view_reports !== false) {
            setActiveTab('reports');
          } else {
            setActiveTab('clients');
          }
        }

        if (profile.role === 'corporate_staff') {
          setActiveTab('legislations');
          setLegSubTab('tracking');
        }

        if (profile.role === 'premium_individual') {
          setActiveTab('inspections');
        }

        if (profile.organization_id) {
          const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single();
          setOrgData(org);
        }

        await Promise.all([
          fetchClients(profile.organization_id, profile.role, session.user.id, perms),
          fetchReports(profile.organization_id, profile.role, session.user.id, perms),
          fetchChangeRequests(profile.organization_id, profile.role, session.user.id, perms),
          fetchCedCategories(),
          fetchPermitCategories(),
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultantLegislations = async () => {
    try {
      const { data: compLegs, error: err1 } = await supabase
        .from('company_pdf_regulations')
        .select('*, regulation:pdf_regulations(*), submitter:profiles!submitted_by(full_name)')
        .eq('company_id', orgId);

      if (err1) throw err1;
      const approvedCompLegs = (compLegs || []).filter((cl: any) => !cl.status || cl.status === 'approved');
      const pendingCompLegs = (compLegs || []).filter((cl: any) => cl.status === 'pending_approval');
      setAssignedGlobalLegislations(approvedCompLegs.map((cl: any) => cl.regulation).filter(Boolean));
      setPendingCompanyLegislations(pendingCompLegs);

      // Sadece gerçek sistem (admin) mevzuatları - company_id NULL olanlar.
      // Önceden filtre yoktu ve TÜM firmaların özel mevzuatları burada
      // (yanlışlıkla "Sistem Mevzuat Havuzu" başlığı altında) görünüyordu.
      const { data: allRegs, error: errGlobal } = await supabase
        .from('pdf_regulations')
        .select('*')
        .is('company_id', null)
        .order('created_at', { ascending: false });
      if (!errGlobal && allRegs) {
        setAllGlobalRegulations(allRegs);
      }

      const isRestrictedRole = userRole === 'corporate_staff' || userRole === 'corporate_chief';
      let clientIds: string[] = [];
      if (isRestrictedRole && !currentUserPerms?.can_view_all_clients) {
        const assignmentUserIds = await getAssignmentUserIds(userRole, userId);
        const { data: assigns } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .in('user_id', assignmentUserIds);
        clientIds = assigns?.map((a: any) => a.client_id) || [];
      } else {
        clientIds = clients.map((c: any) => c.id);
      }

      // Bireysel premium hesap, mevzuatları belirli bir lokasyon/işletmeye
      // bağlamadan "Kendim İçin" de takip edebilsin diye, kendi org'una özel,
      // gizli (normal İşletme/Lokasyon listelerinde hiç görünmeyen) bir
      // consultant_clients kaydı burada gerektiğinde oluşturulur/bulunur.
      let selfClient = selfTrackingClient;
      if (userRole === 'premium_individual' && orgId) {
        if (!selfClient) {
          const { data: existingSelf } = await supabase
            .from('consultant_clients')
            .select('*')
            .eq('consultant_company_id', orgId)
            .eq('is_self_tracking', true)
            .maybeSingle();
          if (existingSelf) {
            selfClient = existingSelf;
          } else {
            const { data: newSelf, error: selfErr } = await supabase
              .from('consultant_clients')
              .insert({ consultant_company_id: orgId, name: 'Kendim İçin', is_self_tracking: true })
              .select()
              .single();
            if (!selfErr) selfClient = newSelf;
          }
          if (selfClient) setSelfTrackingClient(selfClient);
        }
        if (selfClient && !clientIds.includes(selfClient.id)) {
          clientIds = [...clientIds, selfClient.id];
        }
      }

      if (clientIds.length > 0) {
        const { data: clientLegs, error: err2 } = await supabase
          .from('client_regulations')
          .select('*, client:consultant_clients(name), parent:pdf_regulations(id, title)')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false });
        if (err2) throw err2;
        setClientRegulations(clientLegs || []);
      } else {
        setClientRegulations([]);
      }
    } catch (err: any) {
      console.error('Mevzuatlar yüklenirken hata:', err.message);
    }
  };

  const fetchConsultantRequests = async () => {
    try {
      const isRestrictedRole = userRole === 'corporate_staff' || userRole === 'corporate_chief';
      let clientIds: string[] = [];
      if (isRestrictedRole && !currentUserPerms?.can_view_all_clients) {
        const assignmentUserIds = await getAssignmentUserIds(userRole, userId);
        const { data: assigns } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .in('user_id', assignmentUserIds);
        clientIds = assigns?.map((a: any) => a.client_id) || [];
      } else {
        clientIds = clients.map((c: any) => c.id);
      }

      let query = supabase
        .from('regulation_requests')
        .select('*, requester:profiles!requested_by(full_name, email), client:consultant_clients!client_id(name), target_regulation:pdf_regulations!target_regulation_id(title)')
        .order('created_at', { ascending: false });

      if (userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') {
        if (clientIds.length > 0) {
          query = query.or(`organization_id.eq.${orgId},client_id.in.(${clientIds.join(',')})`);
        } else {
          query = query.eq('organization_id', orgId);
        }
      } else {
        query = query.eq('requested_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStaffRequests(data || []);
    } catch (err: any) {
      console.error('Mevzuat talepleri yüklenirken hata:', err.message);
    }
  };

  // Yönetici/şef, incelediği (görüntülediği) mevzuat talebini onaylar veya reddeder
  const handleAnswerRegulationRequest = async (req: any, approve: boolean, note: string) => {
    const hasDraft = !!req.draft_regulation;
    if (approve && hasDraft && !window.confirm('Bu mevzuatı onaylayıp firma havuzunuza eklemek istediğinize emin misiniz?')) return;
    if (!approve && !window.confirm('Bu talebi reddetmek istediğinize emin misiniz?')) return;

    setAnsweringRequest(true);
    try {
      // Personelin tam metniyle gönderdiği bir mevzuat talebi onaylanıyorsa,
      // önce gerçek mevzuatı/maddelerini oluşturup firma havuzuna ekle.
      if (approve && hasDraft) {
        const draft = req.draft_regulation;
        const { data: newReg, error: regErr } = await supabase
          .from('pdf_regulations')
          .insert({
            title: draft.title,
            category: draft.category,
            publication_date: draft.publication_date || null,
            effective_date: draft.effective_date || null,
            rg_no: draft.rg_no || null,
            rg_date: draft.rg_date || null,
            company_id: orgId,
            created_by: req.requested_by
          })
          .select()
          .single();
        if (regErr) throw regErr;

        if (draft.articles && draft.articles.length > 0) {
          const artsToInsert = draft.articles.map((a: any) => ({
            regulation_id: newReg.id,
            article_no: a.article_no,
            title: a.title,
            content: a.content,
            order_index: a.order_index
          }));
          const { error: artsErr } = await supabase.from('pdf_articles').insert(artsToInsert);
          if (artsErr) throw artsErr;
        }

        const { error: poolErr } = await supabase
          .from('company_pdf_regulations')
          .insert({
            company_id: orgId,
            regulation_id: newReg.id,
            status: 'approved',
            submitted_by: req.requested_by,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString()
          });
        if (poolErr) throw poolErr;
      }

      const { error } = await supabase
        .from('regulation_requests')
        .update({
          status: approve ? 'approved' : 'rejected',
          admin_notes: note.trim() || null
        })
        .eq('id', req.id);
      if (error) throw error;

      alert(approve
        ? (hasDraft ? 'Talep onaylandı ve mevzuat firma havuzunuza eklendi.' : 'Talep onaylandı.')
        : 'Talep reddedildi.');
      setReviewingRequest(null);
      setReviewResponseNote('');
      await fetchConsultantRequests();
      if (approve && hasDraft) {
        await fetchConsultantLegislations();
      }
    } catch (err: any) {
      alert('Talep cevaplanırken hata: ' + err.message);
    } finally {
      setAnsweringRequest(false);
    }
  };

  const handleParseText = () => {
    if (!pasteText.trim()) return;
    const parsed = parseLegislationText(pasteText);
    setLegArticles(parsed);
    setPasteText('');
    setParsingTextMode(false);
    alert(`✅ Metin başarıyla ayrıştırıldı! ${parsed.length} madde bulundu. Lütfen aşağıdaki listeden inceleyin.`);
  };

  const handleParsePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingPdf(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fileData = await base64Promise;

      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileData, fileName: file.name }),
      });

      if (!response.ok) {
        throw new Error(`Sunucu hatası: ${response.statusText}`);
      }

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || 'Ayrıştırma başarısız oldu.');
      }

      const parsed = resJson.data;
      if (parsed.title) setLegTitle(parsed.title);
      if (parsed.category) setLegCategory(parsed.category);
      if (parsed.publication_date) setLegPubDate(parsed.publication_date);
      if (parsed.effective_date) setLegEffDate(parsed.effective_date);
      if (parsed.rg_no) setLegRgNo(parsed.rg_no);
      if (parsed.rg_date) setLegRgDate(parsed.rg_date);
      if (parsed.articles) setLegArticles(parsed.articles);

      alert(`✅ PDF başarıyla analiz edildi! ${parsed.articles?.length || 0} madde bulundu. Lütfen formdaki bilgileri inceleyin.`);
    } catch (err: any) {
      alert('PDF ayrıştırılamadı: ' + err.message);
    } finally {
      setParsingPdf(false);
    }
  };

  const handleAddEmptyArticle = () => {
    const nextNum = legArticles.length + 1;
    const newArt = {
      article_no: `MADDE ${nextNum}`,
      title: '',
      content: '',
      order_index: nextNum
    };
    setLegArticles([...legArticles, newArt]);
  };

  const handleUpdateArticleField = (index: number, field: string, value: string) => {
    const updated = [...legArticles];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setLegArticles(updated);
  };

  const handleDeleteArticle = (index: number) => {
    const updated = legArticles.filter((_, idx) => idx !== index).map((art, idx) => ({
      ...art,
      order_index: idx + 1
    }));
    setLegArticles(updated);
  };

  const handleMoveArticle = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === legArticles.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...legArticles];
    
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    const final = updated.map((art, idx) => ({
      ...art,
      order_index: idx + 1
    }));
    setLegArticles(final);
  };

  const handleSaveLegislation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legTitle.trim()) return alert('Lütfen mevzuat başlığını girin.');
    if (legArticles.length === 0) {
      if (!window.confirm('Bu mevzuatta hiç madde bulunmuyor. Yine de kaydetmek istiyor musunuz?')) return;
    }

    const isManagerRole = userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual';

    setSavingLegislation(true);
    try {
      if (isManagerRole) {
        // Yönetici/şef ekliyor: doğrudan havuza, onaylı olarak girer.
        const { data: newReg, error: regErr } = await supabase
          .from('pdf_regulations')
          .insert({
            title: legTitle.trim(),
            category: legCategory,
            publication_date: legPubDate || null,
            effective_date: legEffDate || null,
            rg_no: legRgNo || null,
            rg_date: legRgDate || null,
            company_id: orgId, // Associate with consultant company!
            created_by: userId
          })
          .select()
          .single();
        if (regErr) throw regErr;

        if (legArticles.length > 0) {
          const artsToInsert = legArticles.map(a => ({
            regulation_id: newReg.id,
            article_no: a.article_no,
            title: a.title,
            content: a.content,
            order_index: a.order_index
          }));
          const { error: artsErr } = await supabase
            .from('pdf_articles')
            .insert(artsToInsert);
          if (artsErr) throw artsErr;
        }

        const { error: poolErr } = await supabase
          .from('company_pdf_regulations')
          .insert({
            company_id: orgId,
            regulation_id: newReg.id,
            status: 'approved',
            submitted_by: userId,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString()
          });
        if (poolErr) throw poolErr;

        alert('✅ Özel mevzuat başarıyla havuzunuza eklendi!');
        fetchConsultantLegislations();
      } else {
        // Personel ekliyor: mevzuat havuza düşmez, yönetici/şef onayı bekleyen
        // bir mevzuat talebi olarak kaydedilir. Onaylanırsa havuza düşer.
        const draftRegulation = {
          title: legTitle.trim(),
          category: legCategory,
          publication_date: legPubDate || null,
          effective_date: legEffDate || null,
          rg_no: legRgNo || null,
          rg_date: legRgDate || null,
          articles: legArticles.map(a => ({
            article_no: a.article_no,
            title: a.title,
            content: a.content,
            order_index: a.order_index
          }))
        };

        const { error: reqErr } = await supabase
          .from('regulation_requests')
          .insert({
            title: legTitle.trim(),
            description: `Personel tarafından tam metniyle eklenen yeni mevzuat talebi (${legArticles.length} madde).`,
            requested_by: userId,
            organization_id: orgId,
            request_type: 'staff_to_owner',
            status: 'pending',
            draft_regulation: draftRegulation
          });
        if (reqErr) throw reqErr;

        alert('✅ Mevzuat talebiniz yöneticinize/şefinize gönderildi. Onaylanırsa firma havuzunuzda görünecektir.');
        fetchConsultantRequests();
      }

      setShowAddCustomLegModal(false);
      // Reset fields
      setLegTitle('');
      setLegCategory('Yönetmelik');
      setLegPubDate('');
      setLegEffDate('');
      setLegRgNo('');
      setLegRgDate('');
      setLegArticles([]);
      setPasteText('');
      setParsingTextMode(false);
    } catch (err: any) {
      alert('Kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSavingLegislation(false);
    }
  };

  // Personel tarafından eklenen ve onay bekleyen özel mevzuatı yönetici onaylar/reddeder
  const handleReviewPendingLegislation = async (companyRegId: string, approve: boolean, regulationId: string) => {
    if (!window.confirm(approve ? 'Bu mevzuatı onaylayıp firma havuzuna almak istiyor musunuz?' : 'Bu mevzuatı reddetmek istiyor musunuz? Reddedilen mevzuat havuzdan silinecektir.')) return;
    setReviewingLegId(companyRegId);
    try {
      if (approve) {
        const { error } = await supabase
          .from('company_pdf_regulations')
          .update({ status: 'approved', reviewed_by: userId, reviewed_at: new Date().toISOString() })
          .eq('id', companyRegId);
        if (error) throw error;
        alert('Mevzuat onaylandı ve firma havuzuna eklendi.');
      } else {
        const { error } = await supabase
          .from('company_pdf_regulations')
          .delete()
          .eq('id', companyRegId);
        if (error) throw error;
        // Reddedilen özel mevzuatı ve maddelerini de temizle (başka bir yerde kullanılmıyorsa)
        await supabase.from('pdf_articles').delete().eq('regulation_id', regulationId);
        await supabase.from('pdf_regulations').delete().eq('id', regulationId);
        alert('Mevzuat reddedildi ve kaldırıldı.');
      }
      await fetchConsultantLegislations();
    } catch (err: any) {
      alert('İşlem sırasında hata: ' + err.message);
    } finally {
      setReviewingLegId(null);
    }
  };

  const handleImportGlobalRegulation = async (regulationId: string) => {
    setImportingLegId(regulationId);
    try {
      const { error } = await supabase
        .from('company_pdf_regulations')
        .insert({
          company_id: orgId,
          regulation_id: regulationId
        });
      if (error) throw error;
      alert('Mevzuat başarıyla firmanızın havuzuna eklendi!');
      await fetchConsultantLegislations();
    } catch (err: any) {
      alert('Mevzuat eklenirken hata: ' + err.message);
    } finally {
      setImportingLegId(null);
    }
  };

  const handleRemoveRegulationFromCompany = async (regulationId: string) => {
    if (!window.confirm('Bu mevzuatı firmanızın havuzundan çıkarmak istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('company_pdf_regulations')
        .delete()
        .eq('company_id', orgId)
        .eq('regulation_id', regulationId);
      if (error) throw error;
      alert('Mevzuat firmanızın havuzundan çıkarıldı.');
      await fetchConsultantLegislations();
    } catch (err: any) {
      alert('Mevzuat çıkarılırken hata: ' + err.message);
    }
  };

  const handleAssignRegulationToClient = async () => {
    if (!selectedClientIdForLeg || !assigningGlobalLeg) return;
    try {
      // Check if already assigned
      const { data: existing, error: checkErr } = await supabase
        .from('client_regulations')
        .select('id')
        .eq('client_id', selectedClientIdForLeg)
        .eq('parent_regulation_id', assigningGlobalLeg.id)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existing) {
        return alert('Bu yönetmelik bu firmaya zaten atanmış!');
      }

      const { data: cr, error: err1 } = await supabase
        .from('client_regulations')
        .insert({
          client_id: selectedClientIdForLeg,
          parent_regulation_id: assigningGlobalLeg.id,
          title: assigningGlobalLeg.title,
          description: `${assigningGlobalLeg.title} - Müşteri firmaya tanımlandı.`,
          created_by: userId
        })
        .select()
        .single();
      if (err1) throw err1;

      const { data: parentArticles, error: err2 } = await supabase
        .from('pdf_articles')
        .select('*')
        .eq('regulation_id', assigningGlobalLeg.id);
      
      if (!err2 && parentArticles && parentArticles.length > 0) {
        const articlesToInsert = parentArticles.map(art => ({
          client_regulation_id: cr.id,
          parent_article_id: art.id,
          article_no: art.article_no,
          title: art.title,
          content: art.content,
          is_mandatory: true,
          order_index: art.order_index
        }));

        const { error: err3 } = await supabase
          .from('client_regulation_articles')
          .insert(articlesToInsert);
        if (err3) throw err3;
      }

      let assignBlockedMsg = '';
      if (selectedStaffIdForLeg) {
        const { data: existingAssign } = await supabase
          .from('consultant_assignments')
          .select('id')
          .eq('client_id', selectedClientIdForLeg)
          .eq('user_id', selectedStaffIdForLeg)
          .maybeSingle();

        if (!existingAssign) {
          // bkz. handleToggleAssign: EK-1 kapsamındaki işletmelere atanacak
          // personel en az 3 yıl tecrübeye sahip olmalı; bu akış (mevzuat
          // atarken personel seçme) aynı kontrolden muaf tutulmamalı.
          const legClient = clients.find(c => c.id === selectedClientIdForLeg);
          const requiresExperience = legClient?.permit_stage === 'ek1' || legClient?.ced_status === 'ek1';
          const member = teamMembers.find(m => m.id === selectedStaffIdForLeg);
          const experience = member ? (member.experience_years || 0) : 0;

          if (requiresExperience && experience < 3) {
            assignBlockedMsg = `\n\nUyarı: Personel ataması yapılmadı — EK-1 kapsamındaki işletmelere en az 3 yıl tecrübeli personel atanabilir (seçilen personelin deneyimi: ${experience} yıl).`;
          } else {
            await supabase
              .from('consultant_assignments')
              .insert({
                client_id: selectedClientIdForLeg,
                user_id: selectedStaffIdForLeg
              });
          }
        }
      }

      alert('Mevzuat işletmeye başarıyla atandı ve maddeler kopyalandı!' + assignBlockedMsg);
      setShowAssignClientLegModal(false);
      setAssigningGlobalLeg(null);
      setSelectedClientIdForLeg('');
      setSelectedStaffIdForLeg('');
      fetchConsultantLegislations();
    } catch (err: any) {
      alert('Atama yapılırken hata: ' + err.message);
    }
  };

  const fetchClientRegulationArticles = async (cr: any) => {
    setSelectedClientRegulation(cr);
    setLoadingLegArticles(true);
    try {
      const { data, error } = await supabase
        .from('client_regulation_articles')
        .select('*, updater:profiles!last_updated_by(full_name)')
        .eq('client_regulation_id', cr.id)
        .order('order_index', { ascending: true });
      if (error) throw error;

      const nowStr = new Date().toISOString().split('T')[0];
      const expiredArticles = (data || []).filter(
        (art: any) =>
          art.compliance_status === 'compliant' &&
          art.expiry_date &&
          art.expiry_date < nowStr
      );

      if (expiredArticles.length > 0) {
        const expiredIds = expiredArticles.map((art: any) => art.id);
        await supabase
          .from('client_regulation_articles')
          .update({
            compliance_status: 'non_compliant',
            current_status_notes: 'Süresi dolduğu için sistem tarafından otomatik olarak Uygun Değil durumuna getirildi.'
          })
          .in('id', expiredIds);

        const { data: updatedData, error: updatedError } = await supabase
          .from('client_regulation_articles')
          .select('*, updater:profiles!last_updated_by(full_name)')
          .eq('client_regulation_id', cr.id)
          .order('order_index', { ascending: true });

        if (!updatedError && updatedData) {
          setSelectedClientRegulationArticles(updatedData);
        } else {
          const mappedData = (data || []).map((art: any) => {
            if (expiredIds.includes(art.id)) {
              return {
                ...art,
                compliance_status: 'non_compliant',
                current_status_notes: 'Süresi dolduğu için sistem tarafından otomatik olarak Uygun Değil durumuna getirildi.'
              };
            }
            return art;
          });
          setSelectedClientRegulationArticles(mappedData);
        }
      } else {
        setSelectedClientRegulationArticles(data || []);
      }

      // Fetch compliance actions linked to articles for this client
      const { data: acts, error: errActs } = await supabase
        .from('compliance_actions')
        .select('*, assignee:profiles!assigned_to(full_name)')
        .eq('client_id', cr.client_id)
        .not('article_id', 'is', null);
      if (!errActs && acts) {
        setArticleActions(acts);
      } else {
        setArticleActions([]);
      }
    } catch (err: any) {
      console.error('Maddeler yüklenemedi:', err.message);
    } finally {
      setLoadingLegArticles(false);
    }
  };

  const handleToggleArticleMandatory = async (articleId: string, currentStatus: boolean) => {
    const art = selectedClientRegulationArticles.find(a => a.id === articleId);
    if (!art) return;
    
    if (currentStatus) {
      // Toggling to false (Hariç Tut / Muaf) -> Prompt for note
      setComplianceNoteData({
        articleId: art.id,
        type: 'exempt',
        articleNo: art.article_no,
        title: art.title || '',
        currentNotes: art.current_status_notes || '',
        currentExpiryDate: art.expiry_date || '',
        currentMandatoryState: true
      });
      setComplianceNoteValue(art.current_status_notes || '');
      setComplianceExpiryDate(art.expiry_date || '');
      setIsComplianceExpiryless(!art.expiry_date);
      setShowComplianceNoteModal(true);
    } else {
      // Toggling to true (Aktif Yap) -> Directly update without modal
      try {
        const { error } = await supabase
          .from('client_regulation_articles')
          .update({ is_mandatory: true, compliance_status: null, last_updated_by: userId })
          .eq('id', articleId);
        if (error) throw error;
        
        if (selectedClientRegulation) {
          await fetchClientRegulationArticles(selectedClientRegulation);
        }
      } catch (err: any) {
        alert('Madde güncellenirken hata: ' + err.message);
      }
    }
  };

  const handleUpdateArticleCompliance = (articleId: string, status: 'compliant' | 'non_compliant') => {
    const art = selectedClientRegulationArticles.find(a => a.id === articleId);
    if (!art) return;

    setComplianceNoteData({
      articleId: art.id,
      type: status,
      articleNo: art.article_no,
      title: art.title || '',
      currentNotes: art.current_status_notes || '',
      currentExpiryDate: art.expiry_date || '',
      currentMandatoryState: art.is_mandatory
    });
    setComplianceNoteValue(art.current_status_notes || '');
    setComplianceExpiryDate(art.expiry_date || '');
    setIsComplianceExpiryless(!art.expiry_date);
    setShowComplianceNoteModal(true);
  };

  const handleSaveComplianceNote = async () => {
    if (!complianceNoteData) return;
    if (!complianceNoteValue.trim()) {
      alert('Açıklama alanı zorunludur!');
      return;
    }
    
    setSavingComplianceNote(true);
    try {
      const { articleId, type } = complianceNoteData;
      let updateData: any = {
        current_status_notes: complianceNoteValue.trim(),
        last_updated_by: userId,
        expiry_date: isComplianceExpiryless ? null : (complianceExpiryDate || null)
      };
      
      if (type === 'compliant' || type === 'non_compliant') {
        updateData.compliance_status = type;
        updateData.is_mandatory = true;
      } else if (type === 'exempt') {
        updateData.is_mandatory = false;
        updateData.compliance_status = null;
        updateData.expiry_date = null;
      }
      
      const { error } = await supabase
        .from('client_regulation_articles')
        .update(updateData)
        .eq('id', articleId);
        
      if (error) throw error;
      
      setShowComplianceNoteModal(false);
      setComplianceNoteData(null);
      setComplianceNoteValue('');
      setComplianceExpiryDate('');
      setIsComplianceExpiryless(true);
      
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Güncelleme yapılırken hata: ' + err.message);
    } finally {
      setSavingComplianceNote(false);
    }
  };

  const handleSaveArticleNotes = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({
          current_status_notes: tempNotesVal.trim() || null,
          current_status_requested: false,
          last_updated_by: userId
        })
        .eq('id', articleId);
      if (error) throw error;
      
      setEditingNotesArtId(null);
      setTempNotesVal('');
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Mevcut durum notu kaydedilirken hata: ' + err.message);
    }
  };

  const handleCreateClientArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientRegulation) return;
    if (!newArtContent.trim()) {
      alert('Madde içeriği boş olamaz.');
      return;
    }

    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .insert({
          client_regulation_id: selectedClientRegulation.id,
          article_no: newArtNo.trim() || null,
          title: newArtTitle.trim() || null,
          content: newArtContent.trim(),
          is_mandatory: true,
          order_index: selectedClientRegulationArticles.length
        });

      if (error) throw error;
      
      alert('Madde başarıyla eklendi.');
      setShowAddClientArticleModal(false);
      setNewArtNo('');
      setNewArtTitle('');
      setNewArtContent('');
      await fetchClientRegulationArticles(selectedClientRegulation);
    } catch (err: any) {
      alert('Madde eklenirken hata oluştu: ' + err.message);
    }
  };

  const handleEditClientArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticleForEdit || !selectedClientRegulation) return;
    if (!newArtContent.trim()) {
      alert('Madde içeriği boş olamaz.');
      return;
    }

    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({
          article_no: newArtNo.trim() || null,
          title: newArtTitle.trim() || null,
          content: newArtContent.trim(),
          last_updated_by: userId
        })
        .eq('id', selectedArticleForEdit.id);

      if (error) throw error;

      alert('Madde başarıyla güncellendi.');
      setShowEditClientArticleModal(false);
      setSelectedArticleForEdit(null);
      setNewArtNo('');
      setNewArtTitle('');
      setNewArtContent('');
      await fetchClientRegulationArticles(selectedClientRegulation);
    } catch (err: any) {
      alert('Madde güncellenirken hata oluştu: ' + err.message);
    }
  };

  const handleDeleteClientArticle = async (articleId: string) => {
    if (!window.confirm('Bu maddeyi işletme mevzuatından tamamen silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      alert('Madde silindi.');
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Madde silinirken hata oluştu: ' + err.message);
    }
  };

  const handleToggleArticleForAction = (artId: string) => {
    setSelectedArticleIdsForAction(prev =>
      prev.includes(artId) ? prev.filter(id => id !== artId) : [...prev, artId]
    );
  };

  // Tek veya birden fazla madde için "aksiyon aç / mevcut durum talep et" modalını hazırlar
  const openRequestNotesModalForArticles = async (arts: any[]) => {
    if (arts.length === 0) return;

    setReqNotesArticleId(arts[0].id);
    setReqNotesClientId(selectedClientRegulation?.client_id || '');
    setPendingActionArticleIds(arts.map((a) => a.id));

    // Auto-select assignee from client assignments
    try {
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('user_id')
        .eq('client_id', selectedClientRegulation?.client_id);

      if (userRole === 'corporate_staff' || userRole === 'premium_individual') {
        setReqNotesAssigneeId(userId);
      } else if (assignments && assignments.length > 0) {
        setReqNotesAssigneeId(assignments[0].user_id);
      } else {
        setReqNotesAssigneeId('');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      if (userRole === 'corporate_staff' || userRole === 'premium_individual') {
        setReqNotesAssigneeId(userId);
      }
    }

    setReqNotesDueDate('');
    setReqNotesDesc('');
    if (arts.length === 1) {
      setNewActionTitle(`${arts[0].article_no} Mevcut Durum Talebi`);
    } else {
      setNewActionTitle(`${arts.length} Madde İçin Aksiyon (${arts.map((a) => a.article_no).join(', ')})`);
    }
    setShowRequestNotesModal(true);
  };

  const handleRequestArticleNotes = async (art: any) => {
    await openRequestNotesModalForArticles([art]);
  };

  const handleRequestNotesForSelectedArticles = async () => {
    if (selectedArticleIdsForAction.length === 0) {
      alert('Lütfen aksiyon açmak için en az bir madde seçin.');
      return;
    }
    const arts = selectedClientRegulationArticles.filter((a) => selectedArticleIdsForAction.includes(a.id));
    await openRequestNotesModalForArticles(arts);
    setSelectedArticleIdsForAction([]);
  };

  const handleOpenActionForArticle = async (art: any) => {
    setNewActionTitle(`[${art.article_no}] Aksiyon`);
    setNewActionDesc(`Bu madde için aksiyon tamamlanması gerekmektedir.\nİlgili Madde: ${art.article_no} - ${art.title || ''}`);
    setNewActionClientId(selectedClientRegulation?.client_id || '');
    setReqNotesArticleId(art.id); // Also associate this action with the article ID if saved through the normal form
    setPendingActionArticleIds([art.id]);
    
    // Auto-select assignee from client assignments
    try {
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('user_id')
        .eq('client_id', selectedClientRegulation?.client_id);
      
      if (userRole === 'corporate_staff' || userRole === 'premium_individual') {
        setNewActionAssigneeId(userId);
      } else if (assignments && assignments.length > 0) {
        setNewActionAssigneeId(assignments[0].user_id);
      } else {
        setNewActionAssigneeId('');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      if (userRole === 'corporate_staff' || userRole === 'premium_individual') {
        setNewActionAssigneeId(userId);
      }
    }
    
    setNewActionDueDate('');
    setShowCreateActionModal(true);
  };

  const fetchComplianceActions = async () => {
    if (!orgId) return;
    setLoadingActions(true);
    try {
      let query = supabase
        .from('compliance_actions')
        .select('*, client:consultant_clients(name), assignee:profiles!assigned_to(full_name), creator:profiles!created_by(full_name)');
      
      const isRestrictedRole = userRole === 'corporate_staff' || userRole === 'corporate_chief';
      
      if (isRestrictedRole && !currentUserPerms?.can_view_all_clients) {
        // Query assignments to filter by client
        const assignmentUserIds = await getAssignmentUserIds(userRole, userId);
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .in('user_id', assignmentUserIds);
        const cIds = assignments?.map((a) => a.client_id) || [];
        
        if (cIds.length > 0) {
          // Kendisine atanmış aksiyonlar + atandığı müşteriler için "firma geneli"
          // (assigned_to = null) aksiyonlar. Aynı müşteride BAŞKA bir personele
          // özel atanmış aksiyonları görmemeli.
          query = query.or(
            `assigned_to.eq.${userId},and(assigned_to.is.null,client_id.in.(${cIds.join(',')}))`
          );
        } else {
          query = query.eq('assigned_to', userId);
        }
      } else {
        // For managers, fetch actions where client is in their organization clients
        const { data: clientsData } = await supabase
          .from('consultant_clients')
          .select('id')
          .eq('consultant_company_id', orgId);
        const oClientIds = clientsData?.map((c) => c.id) || [];
        if (oClientIds.length > 0) {
          query = query.in('client_id', oClientIds);
        } else {
          setComplianceActions([]);
          setLoadingActions(false);
          return;
        }
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setComplianceActions(data || []);
    } catch (err: any) {
      console.error('Aksiyonlar yüklenirken hata:', err.message);
    } finally {
      setLoadingActions(false);
    }
  };

  const fetchOpinionLetters = async () => {
    if (!orgId) return;
    setLoadingOpinions(true);
    try {
      // Tüm personel, firmanın tüm görüşlerini (önceki dönemler dahil) görüp
      // işletme/yıl bazında filtreleyebilir.
      const { data, error } = await supabase
        .from('opinion_letters')
        .select('*, client:client_id(name), creator:created_by(full_name)')
        .eq('organization_id', orgId)
        .order('letter_date', { ascending: false });
      if (error) throw error;
      setOpinionLetters(data || []);
    } catch (err: any) {
      console.error('Görüşler yüklenirken hata:', err.message);
    } finally {
      setLoadingOpinions(false);
    }
  };

  const fetchDocumentRequests = async () => {
    if (!orgId) return;
    setLoadingDocRequests(true);
    try {
      const { data, error } = await supabase
        .from('document_requests')
        .select('*, client:client_id(name), requester:requested_by(full_name), document:document_id(file_url, title, file_type), fulfiller:fulfilled_by(full_name)')
        .eq('consultant_company_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocumentRequests(data || []);
    } catch (err: any) {
      console.error('Evrak talepleri yüklenirken hata:', err.message);
    } finally {
      setLoadingDocRequests(false);
    }
  };

  const fetchMsdsDocuments = async () => {
    if (!orgId) return;
    setLoadingMsds(true);
    try {
      let query = supabase
        .from('msds_documents')
        .select('*, client:client_id(name)')
        .eq('consultant_company_id', orgId)
        .eq('is_archived', false);

      // `clients` state zaten atama-kapsamlı (bkz. fetchClients) - kısıtlı
      // rollerde (Ahmet gibi) sadece atandığı firmaların MSDS'leri gelsin diye
      // aynı listeye göre filtrelenir.
      const isRestrictedRole = userRole === 'corporate_staff' || userRole === 'corporate_chief';
      const canViewAll = userRole === 'premium_corporate' || userRole === 'admin' || userRole === 'system_admin' || !!currentUserPerms?.can_view_all_clients;
      if (isRestrictedRole && !canViewAll) {
        const cIds = clients.map((c) => c.id);
        if (cIds.length === 0) {
          setMsdsDocuments([]);
          setLoadingMsds(false);
          return;
        }
        query = query.in('client_id', cIds);
      }

      const { data, error } = await query.order('expiry_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setMsdsDocuments(data || []);
    } catch (err: any) {
      console.error('MSDS belgeleri yüklenirken hata:', err.message);
    } finally {
      setLoadingMsds(false);
    }
  };

  const handleExportMsdsToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EvrakLab';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('MSDS-SDS Takibi', { views: [{ state: 'frozen', ySplit: 1 }] });

    sheet.columns = [
      { header: 'Firma', key: 'client', width: 28 },
      { header: 'Ürün Adı', key: 'product', width: 32 },
      { header: 'Ana Tarih', key: 'primary_date', width: 14 },
      { header: 'Kaynak Etiket', key: 'source_label', width: 22 },
      { header: 'Geçerlilik Bitiş', key: 'expiry', width: 16 },
      { header: 'Durum', key: 'status', width: 14 },
      { header: 'Kalan/Geçen Gün', key: 'days', width: 16 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    msdsFilteredSorted.forEach((m: any, idx: number) => {
      const status = computeMsdsStatus(m.expiry_date, m.warning_threshold_days || 30);
      const days = computeDaysRemaining(m.expiry_date);
      const row = sheet.addRow({
        client: m.client?.name || '—',
        product: m.product_name || '—',
        primary_date: m.primary_date || '—',
        source_label: m.primary_date_source_label || (m.primary_date_manual_override ? 'Manuel' : '—'),
        expiry: m.expiry_date || '—',
        status: STATUS_LABELS_TR[status],
        days: days === null ? '—' : days,
      });
      const zebraFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
      });
    });

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `msds-sds-takibi-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sendDocumentRequestCreatedEmail = async (email: string, clientName: string, title: string, description: string | null): Promise<boolean> => {
    if (!email) return false;
    try {
      let actualScriptUrl = scriptUrl;
      const { data: scriptSetting } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'script_url')
        .maybeSingle();
      if (scriptSetting?.value) actualScriptUrl = scriptSetting.value;
      if (!actualScriptUrl) {
        console.warn('Evrak talebi e-postası gönderilemedi: Google Apps Script URL tanımlı değil.');
        return false;
      }

      await fetch(actualScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'document_request_created',
          email,
          clientName,
          title,
          description: description || '',
          loginLink: `${window.location.origin}/login`,
        }),
      });
      return true;
    } catch (err) {
      console.error('Evrak talebi e-postası gönderilemedi:', err);
      return false;
    }
  };

  const handleCreateDocumentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docReqClientId) return alert('Lütfen hizmet verilen işletmeyi seçin.');
    if (!docReqTitle.trim()) return alert('Lütfen talep başlığını girin (ör. Güncel Mali Sigorta).');

    setSubmittingDocReq(true);
    try {
      const { data: newRequest, error } = await supabase
        .from('document_requests')
        .insert({
          client_id: docReqClientId,
          consultant_company_id: orgId,
          requested_by: userId,
          title: docReqTitle.trim(),
          description: docReqDesc.trim() || null,
        })
        .select('*, client:client_id(name, email)')
        .single();
      if (error) throw error;

      // Müşterinin giriş hesabı varsa uygulama içi bildirim gönder
      const { data: clientLogin } = await supabase
        .from('profiles')
        .select('id')
        .eq('client_id', docReqClientId)
        .eq('role', 'client')
        .maybeSingle();

      if (clientLogin?.id) {
        await supabase.from('notifications').insert([{
          user_id: clientLogin.id,
          title: 'Yeni Evrak Talebi',
          message: `${orgData?.name || 'Danışmanınız'} sizden "${newRequest.title}" belgesini talep etti.`,
          type: 'document_request',
          metadata: { request_id: newRequest.id },
        }]);
      }

      // Müşterinin kayıtlı e-posta adresine de bilgilendirme maili gönder
      if (newRequest.client?.email) {
        await sendDocumentRequestCreatedEmail(
          newRequest.client.email,
          newRequest.client.name,
          newRequest.title,
          newRequest.description
        );
      }

      alert('Evrak talebi oluşturuldu.');
      setDocReqClientId('');
      setDocReqTitle('');
      setDocReqDesc('');
      await fetchDocumentRequests();
    } catch (err: any) {
      alert('Talep oluşturulurken hata: ' + err.message);
    } finally {
      setSubmittingDocReq(false);
    }
  };

  const handleCancelDocumentRequest = async (requestId: string) => {
    if (!window.confirm('Bu evrak talebini iptal etmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('document_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) throw error;
      await fetchDocumentRequests();
    } catch (err: any) {
      alert('Talep iptal edilirken hata: ' + err.message);
    }
  };

  // Talebi karşılayan belgeyi aldıktan sonra tamamen silip kotadan yer açar.
  // Talebin kendisi "karşılandı" kaydı olarak kalır, sadece dosya kalıcı silinir.
  const handleDeleteFulfilledRequestDocument = async (request: any) => {
    if (!request.document_id) return;
    if (!window.confirm('Bu belgeyi kalıcı olarak silmek istediğinize emin misiniz? Kotanızda yer açılır ve geri alınamaz.')) return;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', request.document_id);
      if (error) throw error;
      await fetchDocumentRequests();
    } catch (err: any) {
      alert('Belge silinirken hata: ' + err.message);
    }
  };

  const handleDeleteOpinion = async (opinionId: string) => {
    if (!window.confirm('Bu görüş yazısını silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('opinion_letters')
        .delete()
        .eq('id', opinionId);
      if (error) throw error;
      await fetchOpinionLetters();
      alert('Görüş yazısı silindi.');
    } catch (err: any) {
      alert('Görüş silinirken hata: ' + err.message);
    }
  };

  const fetchClientPortalEmails = async (clientId: string) => {
    if (!clientId) {
      setNewActionClientEmails([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('client_id', clientId)
      .eq('role', 'client');
    setNewActionClientEmails((data || []).filter(a => a.email));
  };

  const sendActionNotificationEmail = async (email: string, clientName: string, actionTitle: string, dueDate: string | null, type: 'action_opened' | 'action_completed'): Promise<boolean> => {
    try {
      let actualScriptUrl = scriptUrl;
      const { data: scriptSetting } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'script_url')
        .maybeSingle();
      if (scriptSetting?.value) actualScriptUrl = scriptSetting.value;
      if (!actualScriptUrl) {
        console.warn('Aksiyon bildirim e-postası gönderilemedi: Google Apps Script URL tanımlı değil.');
        return false;
      }

      await fetch(actualScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          email,
          clientName,
          actionTitle,
          dueDate: dueDate ? new Date(dueDate).toLocaleDateString('tr-TR') : '',
          loginLink: `${window.location.origin}/login`,
        }),
      });
      return true;
    } catch (err) {
      console.error('Aksiyon bildirim e-postası gönderilemedi:', err);
      return false;
    }
  };

  const handleCreateAction = async (isArticleAction = false, articleId: string | null = null, clientId: string | null = null) => {
    const title = isArticleAction ? `${newActionTitle}` : newActionTitle.trim();
    const desc = isArticleAction ? reqNotesDesc.trim() : newActionDesc.trim();
    const cId = isArticleAction ? clientId : newActionClientId;
    const aId = isArticleAction ? reqNotesAssigneeId : newActionAssigneeId;
    const dDate = isArticleAction ? reqNotesDueDate : newActionDueDate;
    
    if (!title || !cId || !aId || !dDate || !desc) {
      alert('Lütfen tüm zorunlu alanları doldurun. Açıklama yazmadan aksiyon açılamaz.');
      return;
    }

    if (creatingAction) return;
    setCreatingAction(true);

    const clientEmail = isArticleAction ? null : (newActionEmail || null);
    const resolvedArticleId = articleId || reqNotesArticleId || null;
    const articleIds = pendingActionArticleIds.length > 0
      ? pendingActionArticleIds
      : (resolvedArticleId ? [resolvedArticleId] : null);

    try {
      const { error } = await supabase
        .from('compliance_actions')
        .insert({
          client_id: cId,
          article_id: resolvedArticleId,
          article_ids: articleIds,
          title: title,
          description: desc || null,
          due_date: dDate,
          created_by: userId,
          assigned_to: aId,
          assigned_client_email: clientEmail,
          status: 'pending'
        });

      if (error) throw error;

      // Sorumlu personele aksiyon ataması e-postası gönder
      let assigneeEmailSent = true;
      try {
        const { data: assigneeProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', aId)
          .maybeSingle();
        if (assigneeProfile?.email) {
          assigneeEmailSent = await sendActionNotificationEmail(
            assigneeProfile.email,
            assigneeProfile.full_name || 'Personel',
            title,
            dDate,
            'action_opened'
          );
        }
      } catch (mailErr) {
        console.error('Sorumlu personele aksiyon bildirim e-postası gönderilemedi:', mailErr);
        assigneeEmailSent = false;
      }

      let emailSent = true;
      if (clientEmail) {
        const clientName = clients.find(c => c.id === cId)?.name || '';
        emailSent = await sendActionNotificationEmail(clientEmail, clientName, title, dDate, 'action_opened');
      }

      if ((clientEmail && !emailSent) || !assigneeEmailSent) {
        alert('Aksiyon oluşturuldu fakat bildirim e-postalarından biri gönderilemedi. "Sistem & Ayarlar" ekranındaki Google Apps Script URL ayarını kontrol edin.');
      } else {
        alert('Aksiyon başarıyla oluşturuldu.' + (clientEmail ? ' Müşteri panelindeki ilgili e-postaya bildirim gönderildi.' : ''));
      }
      setShowCreateActionModal(false);
      setShowRequestNotesModal(false);

      setNewActionTitle('');
      setNewActionDesc('');
      setNewActionClientId('');
      setNewActionAssigneeId('');
      setNewActionDueDate('');
      setNewActionEmail('');
      setNewActionClientEmails([]);
      setReqNotesArticleId('');
      setReqNotesClientId('');
      setReqNotesAssigneeId('');
      setReqNotesDueDate('');
      setReqNotesDesc('');
      setPendingActionArticleIds([]);

      await fetchComplianceActions();

      if (isArticleAction && selectedClientRegulation) {
        if (articleIds && articleIds.length > 0) {
          await supabase
            .from('client_regulation_articles')
            .update({ current_status_requested: true })
            .in('id', articleIds);
        }
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Aksiyon oluşturulurken hata: ' + err.message);
    } finally {
      setCreatingAction(false);
    }
  };

  const handleUploadEvidence = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `evidence_${Math.random()}.${fileExt}`;
    const filePath = `evidence/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('client_assets')
      .upload(filePath, file);
      
    if (uploadError) throw uploadError;
    
    const { data } = supabase.storage
      .from('client_assets')
      .getPublicUrl(filePath);
      
    return data.publicUrl;
  };

  const handleCompleteAction = async (actionId: string, notesVal: string, file: File | null, articleId: string | null = null, selectedDocUrl: string | null = null) => {
    if (!notesVal.trim()) {
      alert('Lütfen açıklama/mevcut durum notu yazın.');
      return;
    }
    
    setUploadingEvidence(true);
    try {
      let evidenceUrl = selectedDocUrl || null;
      if (file) {
        evidenceUrl = await handleUploadEvidence(file);
      }
      
      const updates: any = {
        notes: notesVal.trim(),
        status: 'completed',
        updated_at: new Date().toISOString()
      };
      
      if (evidenceUrl) {
        updates.evidence_url = evidenceUrl;
      }
      
      const { error } = await supabase
        .from('compliance_actions')
        .update(updates)
        .eq('id', actionId);
        
      if (error) throw error;
      
      if (articleId) {
        await supabase
          .from('client_regulation_articles')
          .update({
            current_status_notes: notesVal.trim(),
            last_updated_by: userId
          })
          .eq('id', articleId);
      }

      if (selectedClientAction?.assigned_client_email) {
        await sendActionNotificationEmail(
          selectedClientAction.assigned_client_email,
          selectedClientAction.client?.name || '',
          selectedClientAction.title,
          selectedClientAction.due_date,
          'action_completed'
        );
      }

      alert('Aksiyon tamamlandı ve şef/yönetici onayına gönderildi!');
      setShowCompleteActionModal(false);
      setActionNotes('');
      setActionEvidenceFile(null);
      setSelectedClientAction(null);
      
      await fetchComplianceActions();
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Aksiyon tamamlanırken hata: ' + err.message);
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleApproveAction = async (action: any) => {
    if (!window.confirm('Bu aksiyonu ve personelin girdiği mevcut durumu onaylamak istiyor musunuz?')) return;
    
    try {
      const { error } = await supabase
        .from('compliance_actions')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', action.id);
        
      if (error) throw error;

      const linkedArticleIds = (action.article_ids && action.article_ids.length > 0)
        ? action.article_ids
        : (action.article_id ? [action.article_id] : []);
      if (linkedArticleIds.length > 0) {
        await supabase
          .from('client_regulation_articles')
          .update({
            current_status_requested: false,
            current_status_notes: action.notes,
            last_updated_by: action.assigned_to
          })
          .in('id', linkedArticleIds);
      }

      // Sorumlu personele aksiyonun kapatıldığını bildiren e-posta gönder
      if (action.assigned_to) {
        try {
          const { data: assigneeProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', action.assigned_to)
            .maybeSingle();
          if (assigneeProfile?.email) {
            await sendActionNotificationEmail(
              assigneeProfile.email,
              assigneeProfile.full_name || 'Personel',
              action.title,
              action.due_date,
              'action_completed'
            );
          }
        } catch (mailErr) {
          console.error('Aksiyon kapatma bildirim e-postası gönderilemedi:', mailErr);
        }
      }

      alert('Aksiyon başarıyla onaylandı!');
      await fetchComplianceActions();
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Onaylama işlemi sırasında hata: ' + err.message);
    }
  };

  const handleRequestCorrection = async (action: any, comment: string, newDueDate: string) => {
    if (!comment.trim() || !newDueDate) {
      alert('Lütfen düzeltme gerekçesini ve yeni son teslim tarihini girin.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('compliance_actions')
        .update({
          status: 'correction_requested',
          manager_comment: comment.trim(),
          due_date: newDueDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', action.id);
        
      if (error) throw error;
      
      alert('Düzeltme talebi başarıyla iletildi.');
      setShowCorrectionModal(false);
      setCorrectionComment('');
      setCorrectionDueDate('');
      setSelectedClientAction(null);
      
      await fetchComplianceActions();
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Düzeltme talebi iletilirken hata: ' + err.message);
    }
  };

  const handleDeleteAction = async (actionId: string, articleIds: string[] | null = null) => {
    if (!window.confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('compliance_actions')
        .delete()
        .eq('id', actionId);

      if (error) throw error;

      if (articleIds && articleIds.length > 0) {
        await supabase
          .from('client_regulation_articles')
          .update({ current_status_requested: false })
          .in('id', articleIds);
      }

      alert('Aksiyon silindi.');
      await fetchComplianceActions();
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Aksiyon silinirken hata: ' + err.message);
    }
  };

  const handleRemoveClientRegulation = async (crId: string, title: string) => {
    if (!window.confirm(`"${title}" mevzuatını bu işletmeden kaldırmak istiyor musunuz? İşletmeye ait tüm madde uyum kayıtları silinecektir.`)) return;
    try {
      const { error } = await supabase
        .from('client_regulations')
        .delete()
        .eq('id', crId);
      if (error) throw error;
      alert('Mevzuat işletmeden kaldırıldı.');
      fetchConsultantLegislations();
      if (selectedClientRegulation?.id === crId) {
        setSelectedClientRegulation(null);
        setSelectedClientRegulationArticles([]);
      }
    } catch (err: any) {
      alert('Kaldırılırken hata: ' + err.message);
    }
  };

  const handleSubmitLegislationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim() || !requestDescription.trim()) return alert('Lütfen başlık ve açıklama alanlarını doldurun.');

    try {
      setSubmittingRequest(true);
      // Admin'e talep gönderme kaldırıldı: personel/şef her zaman firma yöneticisinden (owner) talep eder.
      const reqType = 'staff_to_owner';

      const { error } = await supabase
        .from('regulation_requests')
        .insert({
          title: requestTitle.trim(),
          description: requestDescription.trim(),
          requested_by: userId,
          client_id: selectedReqClientId || null,
          organization_id: orgId,
          target_regulation_id: selectedReqRegulationId || null,
          request_type: reqType,
          status: 'pending'
        });

      if (error) throw error;
      alert('Talebiniz başarıyla iletildi!');
      setShowAddRequestModal(false);
      setRequestTitle('');
      setRequestDescription('');
      setSelectedReqClientId('');
      setSelectedReqRegulationId('');
      fetchConsultantRequests();
    } catch (err: any) {
      alert('Talep gönderilirken hata: ' + err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const fetchClients = async (oId: string, role: string, uId: string, perms?: any) => {
    if (!oId && role !== 'system_admin' && role !== 'admin') {
      setClients([]);
      setAllAssignments([]);
      return;
    }
    // Hizmeti sonlandırılan firmalar bu listede görünmez (ayrı "Hizmeti
    // Sonlandırılan Firmalar" tabında); clients state'i uygulama genelinde
    // paylaşıldığından (belge matrisi, atık yönetimi, atamalar vb.) tek
    // yerde filtrelemek her yerden otomatik olarak düşürür.
    let query = supabase.from('consultant_clients').select('*').is('service_terminated_at', null);

    // Kurumsal şef ve personel sadece atandığı firmaları görür (perm yoksa).
    const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';

    if (isRestrictedRole && !perms?.can_view_all_clients) {
      // Sadece atandığı (ve şefse, altındaki personele atanan) firmalar
      const assignmentUserIds = await getAssignmentUserIds(role, uId);
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('client_id')
        .in('user_id', assignmentUserIds);
      const cIds = assignments?.map((a) => a.client_id) || [];
      if (cIds.length > 0) {
        query = query.in('id', cIds);
      } else {
        setClients([]);
        return;
      }
    } else {
      query = query.eq('consultant_company_id', oId);
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) {
      setClients(data);
      const clientIds = data.map((c: any) => c.id);
      if (clientIds.length > 0) {
        const { data: assigns } = await supabase
          .from('consultant_assignments')
          .select('*')
          .in('client_id', clientIds);
        setAllAssignments(assigns || []);

        const { data: periods } = await supabase
          .from('consultant_client_service_periods')
          .select('*')
          .in('client_id', clientIds)
          .order('start_date', { ascending: false });
        setServicePeriods(periods || []);
      } else {
        setAllAssignments([]);
        setServicePeriods([]);
      }
    }
  };

  const fetchTerminatedClients = async () => {
    if (!orgId) return;
    setLoadingTerminatedClients(true);
    try {
      const { data, error } = await supabase
        .from('consultant_clients')
        .select('*')
        .eq('consultant_company_id', orgId)
        .not('service_terminated_at', 'is', null)
        .order('service_terminated_at', { ascending: false });
      if (error) throw error;
      setTerminatedClients(data || []);

      const clientIds = (data || []).map((c: any) => c.id);
      if (clientIds.length > 0) {
        const { data: periods } = await supabase
          .from('consultant_client_service_periods')
          .select('*')
          .in('client_id', clientIds)
          .order('start_date', { ascending: false });
        // Aktif liste ile aynı servicePeriods state'ine birleştirilir (id'ye göre tekilleştirilir)
        setServicePeriods((prev) => {
          const merged = new Map(prev.map((p: any) => [p.id, p]));
          (periods || []).forEach((p: any) => merged.set(p.id, p));
          return Array.from(merged.values());
        });
      }
    } catch (err: any) {
      console.error('Hizmeti sonlandırılan firmalar yüklenirken hata:', err.message);
    } finally {
      setLoadingTerminatedClients(false);
    }
  };

  const handleTerminateService = async (terminationDate: string) => {
    if (!terminatingClientId) return;
    setSavingTermination(true);
    try {
      const { error } = await supabase.rpc('terminate_client_service', {
        p_client_id: terminatingClientId,
        p_org_id: orgId,
        p_termination_date: terminationDate,
      });
      if (error) throw error;

      const terminatedId = terminatingClientId;
      setTerminatingClientId(null);
      setClients((prev) => prev.filter((c) => c.id !== terminatedId));
      alert('Hizmet sonlandırıldı. Firma artık "Hizmeti Sonlandırılan Firmalar" sekmesinde görünüyor.');
      await fetchClients(orgId, userRole, userId, currentUserPerms);
    } catch (err: any) {
      alert('Hizmet sonlandırılırken hata: ' + err.message);
    } finally {
      setSavingTermination(false);
    }
  };

  const handleReactivateClient = async (clientId: string) => {
    setReactivatingClientId(clientId);
    try {
      const { error } = await supabase
        .from('consultant_clients')
        .update({ service_terminated_at: null })
        .eq('id', clientId)
        .eq('consultant_company_id', orgId);
      if (error) throw error;

      setTerminatedClients((prev) => prev.filter((c) => c.id !== clientId));
      alert('Firma yeniden aktif edildi.');
      await fetchClients(orgId, userRole, userId, currentUserPerms);
    } catch (err: any) {
      alert('Yeniden aktif edilirken hata: ' + err.message);
    } finally {
      setReactivatingClientId(null);
    }
  };

  const fetchChangeRequests = async (oId?: string, role?: string, uId?: string, perms?: any) => {
    const currentOrgId = oId || orgId;
    const currentRole = role || userRole;
    const currentUserId = uId || userId;
    const currentPerms = perms || currentUserPerms;

    if (!currentOrgId) return;
    setLoadingChangeRequests(true);
    try {
      let query = supabase
        .from('client_change_requests')
        .select('*, client:client_id(name), requester:requested_by(full_name)');
      
      const isRestrictedRole = currentRole === 'corporate_staff' || currentRole === 'corporate_chief';
      if (isRestrictedRole && !currentPerms?.can_view_all_clients) {
        const assignmentUserIds = await getAssignmentUserIds(currentRole, currentUserId);
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .in('user_id', assignmentUserIds);
        const cIds = assignments?.map((a) => a.client_id) || [];
        if (cIds.length > 0) {
          query = query.or(`client_id.in.(${cIds.join(',')}),requested_by.eq.${currentUserId}`);
        } else {
          query = query.eq('requested_by', currentUserId);
        }
      } else {
        const { data: clientRecs } = await supabase
          .from('consultant_clients')
          .select('id')
          .eq('consultant_company_id', currentOrgId);
        const cIds = clientRecs?.map(c => c.id) || [];
        if (cIds.length > 0) {
          query = query.in('client_id', cIds);
        } else {
          setChangeRequests([]);
          return;
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setChangeRequests(data || []);
    } catch (err: any) {
      console.error('Değişiklik talepleri alınamadı:', err);
    } finally {
      setLoadingChangeRequests(false);
    }
  };

  const handleClientChangeRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForChangeRequest) return;
    if (!changeRequestPdfFile) {
      alert('Lütfen Ticaret Sicil Gazetesi PDF dosyasını yükleyin.');
      return;
    }
    if (!changeRequestNewName.trim() && !changeRequestNewAddress.trim()) {
      alert('Lütfen yeni ünvan veya yeni adres alanlarından en az birini doldurun.');
      return;
    }

    setSubmittingClientChangeRequest(true);
    try {
      const file = changeRequestPdfFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `gazette_${selectedClientForChangeRequest.id}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `change_requests/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);
        
      const { error: insertError } = await supabase
        .from('client_change_requests')
        .insert({
          client_id: selectedClientForChangeRequest.id,
          requested_by: userId,
          new_name: changeRequestNewName.trim() || null,
          new_address: changeRequestNewAddress.trim() || null,
          gazette_pdf_url: urlData.publicUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;
      
      alert('Değişiklik talebiniz başarıyla firma sahibine iletildi.');
      setShowClientChangeRequestModal(false);
      setSelectedClientForChangeRequest(null);
      setChangeRequestNewName('');
      setChangeRequestNewAddress('');
      setChangeRequestPdfFile(null);
      fetchChangeRequests();
    } catch (err: any) {
      alert('Talep gönderilirken hata: ' + err.message);
    } finally {
      setSubmittingClientChangeRequest(false);
    }
  };

  const handleApproveChangeRequest = async (req: any) => {
    if (!window.confirm('Bu ünvan/adres değişiklik talebini onaylamak istediğinizden emin misiniz? Resmi firma kayıtlarınız bu bilgilere göre güncellenecektir.')) return;
    setResolvingChangeRequestId(req.id);
    try {
      const { error: updateReqError } = await supabase
        .from('client_change_requests')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: userId
        })
        .eq('id', req.id);
      
      if (updateReqError) throw updateReqError;

      const updateData: any = {};
      if (req.new_name) updateData.name = req.new_name;
      if (req.new_address) updateData.address = req.new_address;

      if (Object.keys(updateData).length > 0) {
        const { error: updateClientError } = await supabase
          .from('consultant_clients')
          .update(updateData)
          .eq('id', req.client_id);

        if (updateClientError) throw updateClientError;

        // bkz. handleUpdateClient: isim değiştiyse zorunlu belge matrisinin
        // eşleşen location tanımı da güncellenmeli.
        if (req.new_name) {
          const oldName = clients.find((c) => c.id === req.client_id)?.name;
          const newName = req.new_name.trim();
          if (oldName && oldName.trim().toLowerCase() !== newName.toLowerCase()) {
            const matchingLocDef = rawDefs.find(
              (l) => l.category === 'location' && l.label && l.label.trim().toLowerCase() === oldName.trim().toLowerCase()
            );
            if (matchingLocDef) {
              await supabase.from('user_definitions').update({ label: newName }).eq('id', matchingLocDef.id);
              await fetchDefinitionsTab();
            }
          }
        }
      }

      alert('Değişiklik talebi başarıyla onaylandı ve firma bilgileri güncellendi.');
      fetchChangeRequests();
      // Also refresh the client list to show updated names
      fetchClients(orgId, userRole, userId);
    } catch (err: any) {
      alert('Hata oluştu: ' + err.message);
    } finally {
      setResolvingChangeRequestId(null);
    }
  };

  const handleRejectChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChangeRequestForRejection) return;
    if (!changeRejectionReason.trim()) {
      alert('Lütfen bir red gerekçesi belirtin.');
      return;
    }

    setResolvingChangeRequestId(selectedChangeRequestForRejection.id);
    try {
      const { error } = await supabase
        .from('client_change_requests')
        .update({
          status: 'rejected',
          rejection_reason: changeRejectionReason.trim(),
          resolved_at: new Date().toISOString(),
          resolved_by: userId
        })
        .eq('id', selectedChangeRequestForRejection.id);

      if (error) throw error;
      alert('Talep reddedildi.');
      setShowChangeRejectionModal(false);
      setSelectedChangeRequestForRejection(null);
      setChangeRejectionReason('');
      fetchChangeRequests();
    } catch (err: any) {
      alert('Hata oluştu: ' + err.message);
    } finally {
      setResolvingChangeRequestId(null);
    }
  };

  // Personel unvan degisikligi talepleri: ayni "Degisiklik Talepleri"
  // sekmesinde musteri unvan/adres talepleriyle birlikte gosterilir.
  const fetchStaffRoleChangeRequests = async (oId?: string) => {
    const currentOrgId = oId || orgId;
    if (!currentOrgId) return;
    try {
      const { data, error } = await supabase
        .from('staff_role_change_requests')
        .select('*, requester:requested_by(full_name, email)')
        .eq('organization_id', currentOrgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaffRoleChangeRequests(data || []);
    } catch (err: any) {
      console.error('Ünvan değişikliği talepleri alınamadı:', err);
    }
  };

  const handleSubmitRoleChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'premium_corporate') {
      alert('Firma sahibi kendi ünvanı için talep oluşturamaz, doğrudan Ekip sekmesinden değiştirebilirsiniz.');
      return;
    }
    setSubmittingRoleChangeRequest(true);
    try {
      const { error } = await supabase.from('staff_role_change_requests').insert({
        organization_id: orgId,
        requested_by: userId,
        from_role: userRole,
        to_role: roleChangeRequestTo,
        reason: roleChangeRequestReason.trim() || null,
        status: 'pending',
      });
      if (error) throw error;
      alert('Ünvan değişikliği talebiniz firma sahibine iletildi.');
      setShowRoleChangeRequestModal(false);
      setRoleChangeRequestReason('');
      fetchStaffRoleChangeRequests();
    } catch (err: any) {
      alert('Talep gönderilirken hata: ' + err.message);
    } finally {
      setSubmittingRoleChangeRequest(false);
    }
  };

  const handleApproveRoleChangeRequest = async (req: any) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!window.confirm(`"${req.requester?.full_name}" kullanıcısının ünvanını "${roleLabels[req.to_role] || req.to_role}" olarak değiştirmek istiyor musunuz?`)) return;
    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ role: req.to_role })
        .eq('id', req.requested_by);
      if (profErr) throw profErr;

      const { error: reqErr } = await supabase
        .from('staff_role_change_requests')
        .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: userId })
        .eq('id', req.id);
      if (reqErr) throw reqErr;

      alert('Ünvan değişikliği onaylandı.');
      fetchStaffRoleChangeRequests();
      fetchTeamMembers();
    } catch (err: any) {
      alert('Hata oluştu: ' + err.message);
    }
  };

  const handleRejectRoleChangeRequest = async (req: any) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    const reason = window.prompt('Red gerekçesi (opsiyonel):') || null;
    try {
      const { error } = await supabase
        .from('staff_role_change_requests')
        .update({ status: 'rejected', rejection_reason: reason, resolved_at: new Date().toISOString(), resolved_by: userId })
        .eq('id', req.id);
      if (error) throw error;
      alert('Talep reddedildi.');
      fetchStaffRoleChangeRequests();
    } catch (err: any) {
      alert('Hata oluştu: ' + err.message);
    }
  };

  const fetchReports = async (oId: string, role: string, uId: string, perms?: any) => {
    if (!oId && role !== 'system_admin' && role !== 'admin') {
      setReports([]);
      return;
    }
    let query = supabase
      .from('env_reports')
      .select('*, client:client_id(name), creator:creator_id(full_name)');
    
    const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';

    if (isRestrictedRole && !perms?.can_view_all_clients) {
      // Sadece atandığı (ve şefse, altındaki personele atanan) firmaların raporları
      const assignmentUserIds = await getAssignmentUserIds(role, uId);
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('client_id')
        .in('user_id', assignmentUserIds);
      const cIds = assignments?.map((a) => a.client_id) || [];
      if (cIds.length > 0) {
        query = query.in('client_id', cIds);
      } else {
        setReports([]);
        return;
      }
    } else {
      query = query.eq('consultant_company_id', oId);
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setReports(data as any);
  };

  const permitStageLabel = (stage?: string) =>
    stage === 'ek1' ? 'EK-1' : stage === 'ek2' ? 'EK-2' : 'Kapsam Dışı';

  const handleExportClientsToExcel = async () => {
    const showFee = canViewFinance;
    const rows = clients.filter((c) => !c.parent_client_id);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EvrakLab';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Hizmet Verilen İşletmeler', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Firma Adı', key: 'name', width: 30 },
      { header: 'Adres', key: 'address', width: 34 },
      { header: 'Vergi No', key: 'tax_no', width: 16 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'E-posta', key: 'email', width: 26 },
      { header: 'ÇED Durumu', key: 'ced_status', width: 16 },
      { header: 'Çevre İzin Durumu', key: 'permit_stage', width: 18 },
      ...(showFee ? [{ header: 'Aylık Ücret (TL)', key: 'monthly_fee', width: 16 }] : []),
      { header: 'Hizmet Başlangıç', key: 'service_start_date', width: 16 },
      { header: 'Hizmet Bitiş', key: 'service_end_date', width: 16 },
    ];
    const headers = sheet.columns.map((c) => String(c.header));

    // Başlık satırı stili
    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // teal-700
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F766E' } },
        left: { style: 'thin', color: { argb: 'FF0F766E' } },
        bottom: { style: 'thin', color: { argb: 'FF0F766E' } },
        right: { style: 'thin', color: { argb: 'FF0F766E' } },
      };
    });

    const stageFill = (label: string): string | null => {
      if (label === 'EK-1') return 'FFFEF3C7'; // amber-100
      if (label === 'EK-2') return 'FFD1FAE5'; // emerald-100
      return 'FFF1F5F9'; // slate-100 (Kapsam Dışı)
    };
    const stageFont = (label: string): string => {
      if (label === 'EK-1') return 'FF92400E'; // amber-800
      if (label === 'EK-2') return 'FF065F46'; // emerald-800
      return 'FF475569'; // slate-600
    };

    rows.forEach((c, idx) => {
      const cedLabel = permitStageLabel(c.ced_status);
      const permitLabel = permitStageLabel(c.permit_stage);
      const status = getClientServiceStatus(c.id, c.service_start_date, c.service_terminated_at);
      const rowData: Record<string, string | number> = {
        name: c.name,
        address: c.address || '',
        tax_no: c.tax_no || '',
        phone: c.phone || '',
        email: c.email || '',
        ced_status: cedLabel,
        permit_stage: permitLabel,
        service_start_date: c.service_start_date || '',
        service_end_date: status?.expiryDate ? status.expiryDate.toLocaleDateString('tr-TR') : '',
      };
      if (showFee) {
        rowData.monthly_fee = c.monthly_fee != null ? Number(c.monthly_fee) : 0;
      }
      const row = sheet.addRow(rowData);

      const zebraFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'; // white / slate-50
      row.eachCell((cell, colNumber) => {
        const key = sheet.getColumn(colNumber).key;
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        cell.alignment = { vertical: 'middle', horizontal: key === 'monthly_fee' ? 'right' : 'left' };
        if (key === 'ced_status' || key === 'permit_stage') {
          const label = key === 'ced_status' ? cedLabel : permitLabel;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stageFill(label)! } };
          cell.font = { bold: true, color: { argb: stageFont(label) } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraFill } };
        }
      });

      if (showFee) {
        row.getCell('monthly_fee').numFmt = '#,##0.00 "₺"';
      }
    });

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hizmet-verilen-isletmeler-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name) return;
    if (!canCreateClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }

    // İşletmeler (şube olmayan kayıtlar) arasında aynı vergi numarası tekrar edemez.
    // Şubeler bu kontrolden muaf (bkz. handleAddBranch) çünkü bir şube ana firmayla
    // aynı veya farklı bir vergi numarasına sahip olabilir.
    const trimmedTaxNo = newClient.tax_no.trim();
    if (trimmedTaxNo) {
      const duplicate = clients.find((c) => !c.parent_client_id && (c.tax_no || '').trim() === trimmedTaxNo);
      if (duplicate) {
        alert(`⛔ "${trimmedTaxNo}" vergi numarası zaten "${duplicate.name}" firmasında kayıtlı. Bir işletme için aynı vergi numarası tekrar kullanılamaz (şube eklemek istiyorsanız "Şube Ekle" butonunu kullanın).`);
        return;
      }
    }

    try {
      const { error } = await supabase.from('consultant_clients').insert([
        {
          consultant_company_id: orgId,
          name: newClient.name,
          address: newClient.address,
          tax_no: newClient.tax_no,
          phone: newClient.phone,
          logo_url: newClient.logo_url,
          created_by: userId,
          latitude: newClient.latitude || null,
          longitude: newClient.longitude || null,
          service_start_date: newClient.service_start_date || null,
          contract_file_url: newClient.contract_file_url || null,
          permit_stage: newClient.permit_stage || 'out_of_scope',
          permit_articles: newClient.permit_articles || [],
          kep_address: newClient.kep_address || null,
          ced_status: newClient.ced_status || 'out_of_scope',
          ced_articles: newClient.ced_articles || [],
          area_points: newClient.area_points.length >= 3 ? newClient.area_points : null,
          area_m2: newClient.area_points.length >= 3 ? calculatePolygonAreaM2(newClient.area_points) : null,
        },
      ]);
      if (error) throw error;

      // Zorunlu belge matrisi (bkz. defTabTypes eşleşmesi) bir belgenin
      // location_def_id etiketini işletme adıyla karşılaştırarak eşleştiriyor;
      // bu yüzden her yeni işletme için aynı adda bir "location" tanımı da
      // oluşturuluyor (personal hesaplardaki location->client senkronunun tersi).
      const clientLabel = newClient.name.trim();
      const locExists = rawDefs.some(
        (l) => l.category === 'location' && l.label && l.label.trim().toLowerCase() === clientLabel.toLowerCase()
      );
      if (!locExists) {
        await supabase.from('user_definitions').insert({
          user_id: userId,
          category: 'location',
          label: clientLabel,
          organization_id: orgId,
        });
        await fetchDefinitionsTab();
      }

      setShowAddClient(false);
      setNewClient({
        name: '',
        address: '',
        tax_no: '',
        phone: '',
        logo_url: '',
        latitude: null,
        longitude: null,
        service_start_date: '',
        contract_file_url: '',
        permit_stage: 'out_of_scope',
        permit_articles: [],
        kep_address: '',
        ced_status: 'out_of_scope',
        ced_articles: [],
        area_points: [],
      });
      setNewClientArticleSearch('');
      setNewClientCedSearch('');
      fetchClients(orgId, userRole, userId);
    } catch (err: any) {
      alert('Firma eklenirken hata: ' + err.message);
    }
  };

  const openAddBranchModal = (parent: Client) => {
    if (!canCreateClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    setBranchParent(parent);
    // Ana firmanın bilgileri başlangıç değeri olarak dolduruluyor; hepsi
    // (adres, sözleşme, izin/ÇED kapsamı dahil) şube için ayrıca düzenlenebilir.
    setNewBranch({
      name: '',
      address: parent.address || '',
      tax_no: parent.tax_no || '',
      phone: parent.phone || '',
      logo_url: parent.logo_url || '',
      latitude: parent.latitude ?? null,
      longitude: parent.longitude ?? null,
      service_start_date: parent.service_start_date || '',
      contract_file_url: parent.contract_file_url || '',
      permit_stage: parent.permit_stage || 'out_of_scope',
      permit_articles: parent.permit_articles || [],
      kep_address: parent.kep_address || '',
      ced_status: parent.ced_status || 'out_of_scope',
      ced_articles: parent.ced_articles || [],
      area_points: [], // Şube farklı bir konumda olabileceği için alan ayrıca çizilir
    });
    setBranchArticleSearch('');
    setNewBranchCedSearch('');
    setShowAddBranchModal(true);
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchParent) return;
    if (!newBranch.name.trim()) {
      alert('Lütfen şube adını girin (örn: Atölye Şube).');
      return;
    }
    if (!canCreateClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }

    // NOT: Vergi no tekilliği kontrolü kasıtlı olarak burada yok - şubeler bu
    // kontrolden muaf (bkz. handleAddClient/handleUpdateClient'taki kontrol).
    setSavingBranch(true);
    try {
      const fullName = `${branchParent.name} ${newBranch.name.trim()}`;
      const { error } = await supabase.from('consultant_clients').insert([
        {
          consultant_company_id: orgId,
          parent_client_id: branchParent.id,
          name: fullName,
          address: newBranch.address,
          phone: newBranch.phone,
          created_by: userId,
          tax_no: newBranch.tax_no,
          logo_url: newBranch.logo_url,
          latitude: newBranch.latitude || null,
          longitude: newBranch.longitude || null,
          kep_address: newBranch.kep_address || null,
          permit_stage: newBranch.permit_stage || 'out_of_scope',
          permit_articles: newBranch.permit_articles || [],
          service_start_date: newBranch.service_start_date || null,
          contract_file_url: newBranch.contract_file_url || null,
          ced_status: newBranch.ced_status || 'out_of_scope',
          ced_articles: newBranch.ced_articles || [],
          area_points: newBranch.area_points.length >= 3 ? newBranch.area_points : null,
          area_m2: newBranch.area_points.length >= 3 ? calculatePolygonAreaM2(newBranch.area_points) : null,
        },
      ]);
      if (error) throw error;

      // bkz. handleAddClient: zorunlu belge matrisinin işletme adı<->lokasyon
      // etiketi eşleşmesi için şube de aynı adda bir location tanımı alır.
      const branchLocExists = rawDefs.some(
        (l) => l.category === 'location' && l.label && l.label.trim().toLowerCase() === fullName.trim().toLowerCase()
      );
      if (!branchLocExists) {
        await supabase.from('user_definitions').insert({
          user_id: userId,
          category: 'location',
          label: fullName,
          organization_id: orgId,
        });
        await fetchDefinitionsTab();
      }

      alert(`✅ "${fullName}" şubesi başarıyla eklendi! Personel atamak için şubenin yanındaki "Personel Ata" butonunu kullanabilirsiniz.`);
      setShowAddBranchModal(false);
      setBranchParent(null);
      setNewBranch({
        name: '',
        address: '',
        tax_no: '',
        phone: '',
        logo_url: '',
        latitude: null,
        longitude: null,
        service_start_date: '',
        contract_file_url: '',
        permit_stage: 'out_of_scope',
        permit_articles: [],
        kep_address: '',
        ced_status: 'out_of_scope',
        ced_articles: [],
        area_points: [],
      });
      fetchClients(orgId, userRole, userId);
    } catch (err: any) {
      alert('Şube eklenirken hata: ' + err.message);
    } finally {
      setSavingBranch(false);
    }
  };

  const handleOpenEditModal = (client: any) => {
    if (!checkClientEditable(client)) {
      alert('Bu işletmeyi düzenleme yetkiniz bulunmamaktadır (Firma Sahibi tarafından oluşturulmuş veya oluşturulma süresi 24 saati geçmiş).');
      return;
    }
    setEditingClient({
      ...client,
      permit_stage: client.permit_stage || 'out_of_scope',
      permit_articles: Array.isArray(client.permit_articles)
        ? client.permit_articles
        : typeof client.permit_articles === 'string'
          ? JSON.parse(client.permit_articles || '[]')
          : [],
      kep_address: client.kep_address || '',
      ced_status: client.ced_status || 'out_of_scope',
      ced_articles: Array.isArray(client.ced_articles)
        ? client.ced_articles
        : typeof client.ced_articles === 'string'
          ? JSON.parse(client.ced_articles || '[]')
          : [],
      area_points: Array.isArray(client.area_points)
        ? client.area_points
        : typeof client.area_points === 'string'
          ? JSON.parse(client.area_points || '[]')
          : [],
    });
    setEditClientArticleSearch('');
    setEditClientCedSearch('');
    setShowEditClient(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.name) return;
    if (!checkClientEditable(editingClient)) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }

    // Şube olmayan (ana) işletmeler için vergi no tekilliği kontrolü. Şubeler muaf.
    if (!editingClient.parent_client_id) {
      const trimmedTaxNo = (editingClient.tax_no || '').trim();
      if (trimmedTaxNo) {
        const duplicate = clients.find(
          (c) => c.id !== editingClient.id && !c.parent_client_id && (c.tax_no || '').trim() === trimmedTaxNo
        );
        if (duplicate) {
          alert(`⛔ "${trimmedTaxNo}" vergi numarası zaten "${duplicate.name}" firmasında kayıtlı. Bir işletme için aynı vergi numarası tekrar kullanılamaz.`);
          return;
        }
      }
    }

    try {
      const { error } = await supabase
        .from('consultant_clients')
        .update({
          name: editingClient.name,
          address: editingClient.address,
          tax_no: editingClient.tax_no,
          phone: editingClient.phone,
          logo_url: editingClient.logo_url,
          latitude: editingClient.latitude || null,
          longitude: editingClient.longitude || null,
          service_start_date: editingClient.service_start_date || null,
          contract_file_url: editingClient.contract_file_url || null,
          permit_stage: editingClient.permit_stage || 'out_of_scope',
          permit_articles: editingClient.permit_articles || [],
          kep_address: editingClient.kep_address || null,
          ced_status: editingClient.ced_status || 'out_of_scope',
          ced_articles: editingClient.ced_articles || [],
          area_points: (editingClient.area_points || []).length >= 3 ? editingClient.area_points : null,
          area_m2: (editingClient.area_points || []).length >= 3 ? calculatePolygonAreaM2(editingClient.area_points) : null,
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      // bkz. handleAddClient: işletme adı değiştiyse, matris eşleşmesinin
      // bozulmaması için eşleşen location tanımının etiketi de güncellenir.
      const oldName = clients.find((c) => c.id === editingClient.id)?.name;
      const newName = editingClient.name.trim();
      if (oldName && oldName.trim().toLowerCase() !== newName.toLowerCase()) {
        const matchingLocDef = rawDefs.find(
          (l) => l.category === 'location' && l.label && l.label.trim().toLowerCase() === oldName.trim().toLowerCase()
        );
        if (matchingLocDef) {
          await supabase
            .from('user_definitions')
            .update({ label: newName })
            .eq('id', matchingLocDef.id);
          await fetchDefinitionsTab();
        }
      }

      setShowEditClient(false);
      setEditingClient(null);
      fetchClients(orgId, userRole, userId);
      alert('İşletme bilgileri başarıyla güncellendi!');
    } catch (err: any) {
      alert('Firma güncellenirken hata: ' + err.message);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!canDeleteClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!window.confirm('Bu işletmeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve işletmeye ait tüm raporlar ve atamalar silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('consultant_clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      fetchClients(orgId, userRole, userId);
      alert('İşletme başarıyla silindi.');
    } catch (err: any) {
      alert('Firma silinirken hata: ' + err.message);
    }
  };

  const handleOpenClientLoginModal = async (client: any) => {
    setSelectedClientForLogin(client);
    setClientLoginEmail('');
    setShowAddSubAccountForm(false);
    setShowClientLoginModal(true);
    setLoadingClientLoginInfo(true);

    try {
      // Bir firmaya birden fazla müşteri giriş hesabı (alt hesap) tanımlanabilir;
      // ayrıca bir personel/yönetici hesabı da bu firmanın müşteri panelini
      // görüntüleme yetkisiyle bağlanmış olabilir (role != 'client' ama client_id dolu).
      const { data: accounts } = await supabase
        .from('profiles')
        .select('id, email, login_token, created_at, role, full_name')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });

      setClientAccounts(accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientLoginInfo(false);
    }
  };

  const sendClientInviteMail = async (email: string, loginLink: string) => {
    let actualScriptUrl = scriptUrl;
    try {
      const { data: scriptSetting } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'script_url')
        .maybeSingle();
      if (scriptSetting?.value) {
        actualScriptUrl = scriptSetting.value;
        setScriptUrl(scriptSetting.value);
      }
    } catch (err) {
      console.error('Veritabanından Script URL okunamadı:', err);
    }

    if (!actualScriptUrl) {
      alert('Müşteri hesabı ve şifre kurulum bağlantısı başarıyla oluşturuldu! Google Apps Script URL henüz tanımlanmadığı için e-posta gönderilemedi. Bağlantıyı kopyalayarak manuel iletebilirsiniz.');
      return;
    }

    try {
      await fetch(actualScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          clientName: selectedClientForLogin.name,
          loginLink,
        }),
      });
      alert('Başarılı! Müşteri giriş hesabı oluşturuldu ve Google Apps Script ile şifre belirleme davet e-postası otomatik olarak gönderildi.');
    } catch (sendErr: any) {
      console.error('Mail gönderim hatası:', sendErr);
      alert('Müşteri hesabı oluşturuldu fakat Google Script maili gönderilemedi: ' + sendErr.message);
    }
  };

  const handleCreateClientLogin = async () => {
    const emailToCreate = clientLoginEmail.trim();
    if (!emailToCreate) {
      alert('E-posta alanı zorunludur.');
      return;
    }
    if (clientAccounts.some(a => (a.email || '').toLowerCase() === emailToCreate.toLowerCase())) {
      alert('Bu e-posta adresi için zaten bir müşteri hesabı tanımlı.');
      return;
    }

    // GÜVENLİK KONTROLÜ: Bu e-posta başka bir hesaba (personel/yönetici veya farklı
    // bir firmanın müşteri hesabı) ait olabilir. Aşağıdaki akış (yeni hesap), aynı
    // e-postayla eski hesabı SİLİP yerine yeni bir müşteri hesabı oluşturur — bu
    // yüzden önceden kontrol etmeden devam etmek, var olan bir hesabı yok eder.
    setSavingClientLogin(true);
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role, client_id, full_name')
        .ilike('email', emailToCreate)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.role !== 'client') {
          // Bu e-posta zaten sistemde kayıtlı bir personel/yönetici hesabına ait.
          // Yeni bir hesap açmak yerine, mevcut hesaba bu firmanın müşteri paneli
          // görüntüleme yetkisini ekleyebiliriz — şifresi/girişi değişmez.
          const confirmLink = window.confirm(
            `Bu e-posta adresi (${emailToCreate}) sistemde zaten "${existingProfile.full_name || 'isimsiz'}" adlı bir personel/yönetici hesabına ait.\n\n` +
            `Yeni bir hesap OLUŞTURULMAYACAK. Bunun yerine bu kişinin MEVCUT hesabına, "${selectedClientForLogin.name}" firmasının müşteri paneli görüntüleme yetkisi eklensin mi?\n\n` +
            `Kişi kendi mevcut şifresiyle sisteme giriş yapmaya devam edecek; sadece navbar'da "Müşteri Panelim" bağlantısıyla bu firmanın görünümüne de erişebilecek.`
          );
          if (!confirmLink) return;

          const { error: linkErr } = await supabase
            .from('profiles')
            .update({ client_id: selectedClientForLogin.id })
            .eq('id', existingProfile.id);
          if (linkErr) throw linkErr;

          setClientAccounts(prev => [...prev, {
            id: existingProfile.id,
            email: emailToCreate,
            login_token: null,
            role: existingProfile.role,
            full_name: existingProfile.full_name,
          }]);
          setClientLoginEmail('');
          setShowAddSubAccountForm(false);
          alert(`Bağlandı! "${existingProfile.full_name || emailToCreate}", artık kendi mevcut şifresiyle giriş yaptıktan sonra "${selectedClientForLogin.name}" müşteri panelini de görüntüleyebilecek.`);
          return;
        }
        if (existingProfile.client_id !== selectedClientForLogin.id) {
          alert(`Bu e-posta adresi (${emailToCreate}) zaten başka bir firmanın müşteri hesabına ait. Lütfen farklı bir e-posta kullanın.`);
          return;
        }
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // Bu e-postaya ait yetim (profili olmayan) bir auth kullanıcısı kalmışsa temizle
      try {
        await supabase.rpc('delete_client_auth_user', { client_email: emailToCreate });
      } catch (err) {
        console.warn('RPC delete_client_auth_user skipped or failed:', err);
      }

      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: emailToCreate,
        password: token,
        options: {
          data: {
            full_name: selectedClientForLogin.name,
          },
        },
      });

      if (authErr) throw authErr;
      if (!authData.user) {
        throw new Error('Kullanıcı kaydı başlatıldı fakat kullanıcı objesi alınamadı.');
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: selectedClientForLogin.name,
          email: emailToCreate,
          role: 'client',
          client_id: selectedClientForLogin.id,
          login_token: token,
          updated_at: new Date(),
        });

      if (profileErr) throw profileErr;

      // consultant_clients.email sadece görüntüleme amaçlı; ilk hesap oluşturulurken
      // henüz boşsa dolduruyoruz, sonraki alt hesaplarda üzerine yazmıyoruz.
      if (!selectedClientForLogin.email) {
        await supabase
          .from('consultant_clients')
          .update({ email: emailToCreate })
          .eq('id', selectedClientForLogin.id);
        setClients(prev => prev.map(c => c.id === selectedClientForLogin.id ? { ...c, email: emailToCreate } : c));
      }

      setClientAccounts(prev => [...prev, { id: authData.user!.id, email: emailToCreate, login_token: token }]);
      setClientLoginEmail('');
      setShowAddSubAccountForm(false);

      const loginLink = `${window.location.origin}/login?type=setup-password&email=${encodeURIComponent(emailToCreate)}&token=${token}`;
      await sendClientInviteMail(emailToCreate, loginLink);
    } catch (err: any) {
      alert('Hesap oluşturulurken hata: ' + err.message);
    } finally {
      setSavingClientLogin(false);
    }
  };

  const handleRegenerateAccountToken = async (account: any) => {
    setSavingClientLogin(true);
    try {
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ login_token: token })
        .eq('id', account.id);

      if (updateErr) throw updateErr;

      setClientAccounts(prev => prev.map(a => a.id === account.id ? { ...a, login_token: token } : a));
      alert('Yeni şifre kurulum bağlantısı başarıyla oluşturuldu!');
    } catch (err: any) {
      alert('Bağlantı oluşturulurken hata: ' + err.message);
    } finally {
      setSavingClientLogin(false);
    }
  };

  const handleDeleteClientAccount = async (account: any) => {
    const isLinkedStaffAccount = account.role && account.role !== 'client';

    if (isLinkedStaffAccount) {
      // Bu bir personel/yönetici hesabı, sadece bu firmaya olan müşteri paneli
      // bağlantısını kaldırıyoruz — hesabın kendisine (giriş, şifre) dokunulmaz.
      if (!window.confirm(`"${account.full_name || account.email}" adlı personel hesabının bu firmanın müşteri paneline erişimini kaldırmak istediğinize emin misiniz? (Kendi personel hesabı silinmeyecek.)`)) return;
      setSavingClientLogin(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ client_id: null })
          .eq('id', account.id);
        if (error) throw error;

        setClientAccounts(prev => prev.filter(a => a.id !== account.id));
        alert('Müşteri paneli bağlantısı kaldırıldı. Personel hesabı normal şekilde çalışmaya devam ediyor.');
      } catch (err: any) {
        alert('Hata: ' + err.message);
      } finally {
        setSavingClientLogin(false);
      }
      return;
    }

    if (!window.confirm(`${account.email} hesabının giriş yetkisini kaldırmak istediğinize emin misiniz?`)) return;
    setSavingClientLogin(true);
    try {
      await supabase.rpc('delete_client_auth_user', { client_email: account.email });

      // Yetim kalmaması için profil satırını da doğrudan temizle (RPC cascade etmezse diye)
      await supabase
        .from('profiles')
        .delete()
        .eq('id', account.id);

      setClientAccounts(prev => prev.filter(a => a.id !== account.id));
      alert('Giriş yetkisi kaldırıldı.');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    } finally {
      setSavingClientLogin(false);
    }
  };

  const handleSendGoogleScript = async (loginLink: string) => {
    if (!scriptUrl) {
      alert('Lütfen Google Apps Script Web App URL adresini girin.');
      return;
    }
    setSendingScript(true);
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clientLoginEmail,
          clientName: selectedClientForLogin.name,
          loginLink: loginLink
        })
      });
      localStorage.setItem('evraklab_google_script_url', scriptUrl);
      alert('E-posta başarıyla gönderildi (Google Script Web App tetiklendi)!');
    } catch (err: any) {
      alert('Google Script hatası: ' + err.message);
    } finally {
      setSendingScript(false);
    }
  };

  const getReportStatusColor = (report: Report) => {
    if (report.status !== 'completed' && !report.is_manual_upload) return 'bg-gray-100 text-gray-800 border-gray-200';

    // Daha yeni bir rapor var mı?
    const hasNewerReport = reports.some(r => 
      r.client_id === report.client_id && 
      r.report_type === report.report_type && 
      new Date(r.report_date) > new Date(report.report_date)
    );

    if (hasNewerReport) return 'bg-green-100 text-green-800 border-green-200';

    const expDate = new Date(report.expires_at);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) return 'bg-red-100 text-red-800 border-red-200'; 
    if (diffDays <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200'; 
    return 'bg-green-100 text-green-800 border-green-200'; 
  };

  const getReportStatusText = (report: Report) => {
    if (report.status !== 'completed' && !report.is_manual_upload) return 'Taslak';

    // Daha yeni bir rapor var mı?
    const hasNewerReport = reports.some(r => 
      r.client_id === report.client_id && 
      r.report_type === report.report_type && 
      new Date(r.report_date) > new Date(report.report_date)
    );

    if (hasNewerReport) return 'Tamamlandı';

    const expDate = new Date(report.expires_at);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) return 'Süresi Geçti';
    if (diffDays <= 30) return `Son ${diffDays} Gün`;
    return 'Geçerli Yüklendi';
  };

  const getMonthsSinceServiceStart = (startDateStr: string | null | undefined) => {
    if (!startDateStr) return [];
    const start = new Date(startDateStr);
    const end = new Date();
    
    const monthsList: { year: number; month: number; label: string }[] = [];
    const seen = new Set<string>();
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);
    
    let limit = 0;
    while (current <= endLimit && limit < 500) {
      limit++;
      const y = current.getFullYear();
      const m = current.getMonth() + 1;
      const key = `${y}-${m}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        monthsList.push({
          year: y,
          month: m,
          label: current.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })
        });
      }
      current.setMonth(current.getMonth() + 1);
    }
    return monthsList.reverse(); // Newest first
  };

  // --- FİNANS & MALİYET FONKSİYONLARI ---
  // Gider Yönetimi / Müşteri Ödemeleri / Finansal Özet sekmelerinde ortak
  // kullanılan ay/yıl filtresi. Veri hacmi küçük olduğu için filtre
  // client-side uygulanıyor (bkz. fetchFinanceData — tüm kayıtlar zaten tek
  // seferde çekiliyor), sorgu tarafında değişikliğe gerek yok.
  const matchesFinancePeriod = (dateStr: string | null | undefined) => {
    if (!dateStr) return financePeriodType === 'all';
    if (financePeriodType === 'all') return true;
    if (financePeriodType === 'monthly') return dateStr.slice(0, 7) === financeSelectedMonth;
    return dateStr.slice(0, 4) === financeSelectedYear;
  };

  const renderFinancePeriodSelector = () => (
    <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-2">
      <div className="flex gap-1 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
        {(['all', 'monthly', 'yearly'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFinancePeriodType(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              financePeriodType === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t === 'all' ? 'Tümü' : t === 'monthly' ? 'Aylık' : 'Yıllık'}
          </button>
        ))}
      </div>
      {financePeriodType === 'monthly' && (
        <input
          type="month"
          value={financeSelectedMonth}
          onChange={(e) => setFinanceSelectedMonth(e.target.value)}
          className="border rounded-lg p-2 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 font-bold outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
      {financePeriodType === 'yearly' && (
        <select
          value={financeSelectedYear}
          onChange={(e) => setFinanceSelectedYear(e.target.value)}
          className="border rounded-lg p-2 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 font-bold outline-none focus:ring-1 focus:ring-blue-500"
        >
          {Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}
    </div>
  );

  const fetchFinanceData = async () => {
    if (!orgId) return;
    setLoadingFinance(true);
    try {
      // client_payments bir müşteri-ay başına tek satır: uzun süredir hizmet
      // verilen çok sayıda müşteride kolayca Supabase/PostgREST'in varsayılan
      // 1000 satır yanıt sınırını aşabiliyor (aşarsa bazı müşterilerin ödeme
      // geçmişi sessizce eksik gelip "hiç ödenmemiş" gibi görünüyordu) —
      // bu yüzden tüm satırları sayfalayarak çekiyoruz.
      const allPayments: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: payErr } = await supabase
          .from('client_payments')
          .select('*')
          .eq('consultant_company_id', orgId)
          .range(from, from + PAGE_SIZE - 1);
        if (payErr) {
          console.error('Error fetching payments:', payErr);
          break;
        }
        allPayments.push(...(page || []));
        if (!page || page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setFinancePayments(allPayments);

      const { data: expData, error: expErr } = await supabase
        .from('company_expenses')
        .select('*')
        .eq('consultant_company_id', orgId)
        .order('expense_date', { ascending: false });
      if (expErr) console.error('Error fetching expenses:', expErr);
      setFinanceExpenses(expData || []);
    } catch (err: any) {
      console.error('Finans verileri çekilirken hata:', err);
    } finally {
      setLoadingFinance(false);
    }
  };

  // Artık consultant_clients.monthly_fee'yi doğrudan değiştirmez (o sütun
  // trigger ile en güncel dönemden otomatik senkronlanıyor) - bu buton sadece
  // AKTİF (süresi dolmamış) dönemin ücretini düzeltir ("bu yıl için
  // değiştirilebilinsin"). Aktif dönem yoksa (hizmet hiç başlatılmamış ya da
  // süresi dolmuş), yeni dönem açmak "Hizmet Verilen İşletmeler" sayfasındaki
  // "Hizmet Başlat/Yenile" aksiyonuna aittir - burada karıştırılmaz.
  const handleUpdateClientFee = async (clientId: string, fee: number) => {
    const status = getClientServiceStatus(clientId, clients.find((c) => c.id === clientId)?.service_start_date);
    if (!status?.latestPeriod || status.isExpired) {
      alert('Bu firma için aktif bir hizmet dönemi yok. Önce "Hizmet Verilen İşletmeler" sayfasından "Hizmet Başlat/Yenile" ile bir dönem açın.');
      return;
    }
    try {
      const { error } = await supabase
        .from('consultant_client_service_periods')
        .update({ monthly_fee: fee })
        .eq('id', status.latestPeriod.id);
      if (error) throw error;

      setServicePeriods((prev) => prev.map((p) => (p.id === status.latestPeriod.id ? { ...p, monthly_fee: fee } : p)));
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, monthly_fee: fee } : c)));
      setUpdatingClientFee(null);
      alert('Müşteri aylık ücreti başarıyla güncellendi! Alacaklar (Finans) otomatik güncellendi.');
    } catch (err: any) {
      alert('Ücret güncellenirken hata: ' + err.message);
    }
  };

  // Firma sahibinin (ve admin/system_admin) mevcut (en güncel) hizmet
  // dönemini serbestçe düzenlemesi için: "Hizmet Yenile" her zaman yeni bir
  // dönem EKLER, bu ise var olan son dönemin başlangıç/bitiş tarihini
  // manuel olarak düzeltir - örn. gerçekte 1 yıl uzatılmış ama sisteme geç
  // işlenmiş bir sözleşmeyi doğru tarihe çekmek, ya da yanlış girilen bir
  // bitiş tarihini erkene almak için.
  const handleUpdateClientPeriodDates = async (clientId: string, newStart: string, newEnd: string) => {
    const periods = servicePeriods
      .filter((p) => p.client_id === clientId)
      .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
    const latest = periods[0];
    const previous = periods[1];
    if (!latest) {
      alert('Bu firma için düzenlenecek bir hizmet dönemi yok.');
      return;
    }
    if (!newStart || !newEnd) {
      alert('Lütfen başlangıç ve bitiş tarihlerini girin.');
      return;
    }
    if (newEnd <= newStart) {
      alert('Bitiş tarihi, başlangıç tarihinden sonra olmalıdır.');
      return;
    }
    if (previous && newStart < previous.end_date) {
      alert(`Başlangıç tarihi, önceki dönemin bitişinden (${new Date(previous.end_date).toLocaleDateString('tr-TR')}) sonra olmalıdır.`);
      return;
    }
    setSavingPeriodDates(true);
    try {
      const { error } = await supabase
        .from('consultant_client_service_periods')
        .update({ start_date: newStart, end_date: newEnd })
        .eq('id', latest.id);
      if (error) throw error;

      setServicePeriods((prev) => prev.map((p) => (p.id === latest.id ? { ...p, start_date: newStart, end_date: newEnd } : p)));
      if (periods.length === 1) {
        setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, service_start_date: newStart } : c)));
      }
      setEditingPeriodDatesClientId(null);
      alert('Sözleşme başlangıç/bitiş tarihi güncellendi! Alacaklar (Finans) otomatik güncellendi.');
    } catch (err: any) {
      alert('Tarih güncellenirken hata: ' + err.message);
    } finally {
      setSavingPeriodDates(false);
    }
  };

  const handleRenewClientService = async (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const feeValue = parseFloat(renewFee);
    if (isNaN(feeValue) || feeValue <= 0) {
      alert('Lütfen bu dönem için geçerli bir aylık ücret girin.');
      return;
    }

    const status = getClientServiceStatus(clientId, client.service_start_date);
    const latest = status?.latestPeriod;

    let newStart: Date;
    if (latest) {
      newStart = new Date(latest.end_date);
      newStart.setDate(newStart.getDate() + 1);
    } else if (client.service_start_date) {
      newStart = new Date(client.service_start_date);
    } else {
      newStart = new Date();
      newStart.setHours(0, 0, 0, 0);
    }

    let newEnd: Date;
    if (renewMode === 'auto') {
      newEnd = new Date(newStart);
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      if (!renewCustomEndDate) {
        alert('Lütfen bir bitiş tarihi seçin.');
        return;
      }
      newEnd = new Date(renewCustomEndDate);
      if (newEnd <= newStart) {
        alert('Bitiş tarihi, dönem başlangıcından (' + newStart.toLocaleDateString('tr-TR') + ') sonra olmalıdır.');
        return;
      }
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    setSavingRenewal(true);
    try {
      const { data: newPeriod, error } = await supabase
        .from('consultant_client_service_periods')
        .insert({
          client_id: clientId,
          consultant_company_id: orgId,
          start_date: toIso(newStart),
          end_date: toIso(newEnd),
          monthly_fee: feeValue,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;

      setServicePeriods((prev) => [newPeriod, ...prev]);
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, monthly_fee: feeValue, service_start_date: c.service_start_date || toIso(newStart) } : c)));
      setRenewingClientId(null);
      setRenewFee('');
      setRenewCustomEndDate('');
      setRenewMode('auto');
      alert(`Hizmet ${toIso(newEnd)} tarihine kadar uzatıldı. Alacaklar (Finans) otomatik güncellendi.`);
    } catch (err: any) {
      alert('Hizmet yenilenirken hata: ' + err.message);
    } finally {
      setSavingRenewal(false);
    }
  };

  const handleTogglePaymentStatus = async (clientId: string, year: number, month: number, isPaid: boolean, amount: number) => {
    const key = `${clientId}-${year}-${month}`;
    setTogglingPaymentKey(key);
    try {
      if (isPaid) {
        const existing = financePayments.find(p => p.client_id === clientId && p.year === year && p.month === month);
        if (existing) {
          const { error } = await supabase
            .from('client_payments')
            .update({ is_paid: true, payment_date: new Date().toISOString().split('T')[0] })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('client_payments')
            .insert({
              client_id: clientId,
              consultant_company_id: orgId,
              year,
              month,
              amount,
              is_paid: true,
              payment_date: new Date().toISOString().split('T')[0]
            });
          if (error) throw error;
        }
      } else {
        const existing = financePayments.find(p => p.client_id === clientId && p.year === year && p.month === month);
        if (existing) {
          const { error } = await supabase
            .from('client_payments')
            .update({ is_paid: false, payment_date: null })
            .eq('id', existing.id);
          if (error) throw error;
        }
      }
      await fetchFinanceData();
    } catch (err: any) {
      alert('Ödeme durumu güncellenirken hata: ' + err.message);
    } finally {
      setTogglingPaymentKey(null);
    }
  };

  const handleSaveExpense = async () => {
    if (!newExpense.title.trim() || !newExpense.amount) {
      alert('Lütfen başlık ve tutar giriniz!');
      return;
    }
    setSavingExpense(true);
    try {
      const { error } = await supabase
        .from('company_expenses')
        .insert({
          consultant_company_id: orgId,
          title: newExpense.title.trim(),
          category: newExpense.category,
          amount: parseFloat(newExpense.amount),
          expense_date: newExpense.expense_date,
          notes: newExpense.notes.trim() || null,
          employee_id: newExpense.category === 'Maaş/Personel' && newExpense.employee_id ? newExpense.employee_id : null
        });
      if (error) throw error;

      setShowAddExpenseModal(false);
      setNewExpense({
        title: '',
        category: 'Ofis/Kira',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: '',
        employee_id: ''
      });
      await fetchFinanceData();
      alert('Gider kaydı başarıyla eklendi!');
    } catch (err: any) {
      alert('Gider kaydedilirken hata: ' + err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Bu gider kaydını silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('company_expenses')
        .delete()
        .eq('id', expenseId);
      if (error) throw error;
      await fetchFinanceData();
      alert('Gider kaydı silindi.');
    } catch (err: any) {
      alert('Gider silinirken hata: ' + err.message);
    }
  };

  // Yönetici, personel/şefin gönderdiği bir gideri onaylar - onaylanan gider
  // artık gönderen kişi tarafından silinemez (bkz. RLS: "Staff delete own
  // unapproved expenses" sadece approved_at IS NULL iken izin veriyor).
  const handleApproveExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('company_expenses')
        .update({ approved_at: new Date().toISOString(), approved_by: userId })
        .eq('id', expenseId);
      if (error) throw error;
      await fetchFinanceData();
    } catch (err: any) {
      alert('Onaylanırken hata: ' + err.message);
    }
  };

  // Personel/şef, kendi gönderdiği ama henüz onaylanmamış bir gideri (ör.
  // yanlışlıkla eklediyse) silebilir - RLS bu işlemi zaten submitted_by=kendisi
  // VE approved_at IS NULL ile sınırlıyor, burada sadece UI onayı alınır.
  const handleDeleteMyStaffExpense = async (expenseId: string) => {
    if (!window.confirm('Bu gideri silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase.from('company_expenses').delete().eq('id', expenseId);
      if (error) throw error;
      await fetchMyStaffExpenses();
    } catch (err: any) {
      alert('Silinirken hata: ' + err.message);
    }
  };

  // Personel/Şef Gider Ekleme - sadece kendi gönderdiği kayıtları çeker
  // (RLS zaten corporate_staff için submitted_by=auth.uid() ile sınırlıyor;
  // corporate_chief'in tam erişimi var ama burada da kendi listesini görür).
  const fetchMyStaffExpenses = async () => {
    if (!userId) return;
    setLoadingMyStaffExpenses(true);
    try {
      const { data, error } = await supabase
        .from('company_expenses')
        .select('*')
        .eq('submitted_by', userId)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setMyStaffExpenses(data || []);
    } catch (err: any) {
      console.error('Giderlerim yüklenirken hata:', err.message);
    } finally {
      setLoadingMyStaffExpenses(false);
    }
  };

  const handleSaveStaffExpense = async () => {
    if (!newStaffExpense.title.trim() || !newStaffExpense.amount) {
      alert('Lütfen açıklama ve tutar giriniz.');
      return;
    }
    setSavingStaffExpense(true);
    try {
      let receiptUrl: string | null = null;
      if (staffExpenseReceiptFile) {
        const fileExt = staffExpenseReceiptFile.name.split('.').pop() || 'pdf';
        const filePath = `expense-receipts/${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, staffExpenseReceiptFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        receiptUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('company_expenses').insert({
        consultant_company_id: orgId,
        title: newStaffExpense.title.trim(),
        category: newStaffExpense.category,
        amount: parseFloat(newStaffExpense.amount),
        expense_date: newStaffExpense.expense_date,
        notes: newStaffExpense.notes.trim() || null,
        payment_type: newStaffExpense.payment_type,
        receipt_url: receiptUrl,
        submitted_by: userId,
        is_auto_salary: false,
      });
      if (error) throw error;

      setNewStaffExpense({
        title: '',
        category: 'Diğer',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_type: 'sirket_karti',
        notes: '',
      });
      setStaffExpenseReceiptFile(null);
      await fetchMyStaffExpenses();
      alert('Gider kaydınız başarıyla eklendi.');
    } catch (err: any) {
      alert('Gider kaydedilirken hata: ' + err.message);
    } finally {
      setSavingStaffExpense(false);
    }
  };

  useEffect(() => {
    if (orgId && ['finance_summary', 'finance_payments', 'finance_expenses'].includes(activeTab)) {
      fetchFinanceData();
    }
  }, [orgId, activeTab]);

  const getModuleForTab = (tab: string): 'operations' | 'compliance' | 'actions' | 'documents' | 'finance' | 'hr' | 'settings' => {
    if (['clients', 'terminated_clients', 'inspections', 'waste'].includes(tab)) return 'operations';
    if (['legislations', 'requests'].includes(tab)) return 'compliance';
    if (tab === 'actions') return 'actions';
    if (['reports', 'document_matrix', 'document_requests', 'msds', 'opinions', 'definitions'].includes(tab)) return 'documents';
    if (['finance_summary', 'finance_payments', 'finance_expenses', 'staff_expense_submission'].includes(tab)) return 'finance';
    if (['team', 'org_chart', 'evaluations', 'departed'].includes(tab)) return 'hr';
    return 'settings';
  };
  const activeModule = getModuleForTab(activeTab);

  // Finans & İK modüllerine her girişte firma sahibinin hesap parolasını
  // tekrar sorar (ekran açık kalıp başkasının maaş/finans verisini görmesini
  // engellemek için). Sadece firma sahibi (premium_corporate) için geçerli.
  useEffect(() => {
    if (activeModule !== 'finance' && activeModule !== 'hr') {
      setFinanceHrUnlocked(false);
      setReAuthPassword('');
      setReAuthError('');
    }
  }, [activeModule]);

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

  const panelTitle =
    userRole === 'corporate_chief'
      ? 'Şef Paneli'
      : userRole === 'corporate_staff'
        ? 'Danışman İşlemleri'
        : 'Yönetici Paneli';

  const isAdminOrChief = userRole === 'admin' || userRole === 'system_admin' || userRole === 'corporate_chief' || userRole === 'premium_corporate';
  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual' || userRole === 'admin' || userRole === 'system_admin';
  
  // Granular Permissions for Chief / Staff / Admins
  const canViewClients = userRole === 'premium_corporate' || userRole === 'corporate_staff' || userRole === 'admin' || userRole === 'system_admin' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_clients !== false);
  const canCreateClients = userRole === 'premium_corporate' || userRole === 'admin' || userRole === 'system_admin' || (userRole === 'corporate_chief' && currentUserPerms?.can_create_clients);
  const canEditClients = userRole === 'premium_corporate' || userRole === 'admin' || userRole === 'system_admin' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients);
  const canAssignClients = userRole === 'premium_corporate' || userRole === 'admin' || userRole === 'system_admin' || (userRole === 'corporate_chief' && currentUserPerms?.can_assign_clients);
  const canDeleteClients = userRole === 'premium_corporate' || userRole === 'admin' || userRole === 'system_admin' || (userRole === 'corporate_chief' && currentUserPerms?.can_delete_clients);
  const canViewReports = userRole === 'premium_corporate' || userRole === 'corporate_staff' || userRole === 'admin' || userRole === 'system_admin' || userRole === 'premium_individual' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_reports !== false);
  const canViewTeam = userRole === 'premium_corporate' || userRole === 'corporate_staff' || userRole === 'admin' || userRole === 'system_admin' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_team !== false);
  // Şahsi belge yükleme yetkisini personele Yönetici'nin yanı sıra Şef de verebilir/kaldırabilir.
  const canManageStaffDocPerm = userRole === 'premium_corporate' || userRole === 'corporate_chief';




  const checkClientEditable = (client: Client) => {
    if (userRole === 'premium_corporate' || userRole === 'admin') return true;
    if (userRole === 'corporate_chief') {
      if (currentUserPerms?.can_edit_clients) return true;
      if (client.created_by === userId && client.created_at) {
        const diffMs = Date.now() - new Date(client.created_at).getTime();
        return diffMs < 24 * 60 * 60 * 1000;
      }
    }
    return false;
  };

  // Finans & İK modüllerine her girişte firma sahibinin hesap parolasını
  // tekrar sorar (ekran açık kalıp başkasının maaş/finans verisini görmesini
  // engellemek için). Sadece firma sahibi (premium_corporate) için geçerli.
  const requiresFinanceHrReAuth = userRole === 'premium_corporate' && (activeModule === 'finance' || activeModule === 'hr') && !financeHrUnlocked;

  const handleFinanceHrReAuth = async () => {
    if (!reAuthPassword) return;
    setReAuthLoading(true);
    setReAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: userEmail, password: reAuthPassword });
      if (error) {
        setReAuthError('Parola hatalı. Lütfen tekrar deneyin.');
        return;
      }
      setFinanceHrUnlocked(true);
      setReAuthPassword('');
    } finally {
      setReAuthLoading(false);
    }
  };

  const selectModule = (moduleName: 'operations' | 'compliance' | 'actions' | 'documents' | 'finance' | 'hr' | 'settings') => {
    if (moduleName === 'operations') {
      if (canViewClients) {
        setActiveTab('clients');
      } else {
        setActiveTab('inspections');
      }
    } else if (moduleName === 'compliance') {
      setActiveTab('legislations');
    } else if (moduleName === 'actions') {
      setActiveTab('actions');
    } else if (moduleName === 'documents') {
      setActiveTab('reports');
    } else if (moduleName === 'finance') {
      // Personel/şef finance_summary'yi göremez (canViewFinance=false) - o
      // sekmeye zorlarsak içerik alanı boş kalır ("sayfa açılmıyor" hatası).
      // Onlar için tek görebildikleri "Gider Ekle" sekmesine gidilir.
      if (canViewFinance) {
        setActiveTab('finance_summary');
      } else {
        setActiveTab('staff_expense_submission');
      }
    } else if (moduleName === 'hr') {
      if (canViewTeam) {
        setActiveTab('team');
      } else {
        setActiveTab('evaluations');
      }
    } else if (moduleName === 'settings') {
      setActiveTab('settings');
    }
  };

  const canViewFinance = ['premium_corporate', 'corporate_chief', 'corporate_staff', 'admin', 'system_admin'].includes(userRole);

  const modules = [
    {
      id: 'operations',
      label: 'Operasyon & İşletmeler',
      icon: <Building size={18} />,
      tabs: [
        { id: 'clients', label: 'Hizmet Verilen İşletmeler', icon: <Building size={14} />, show: canViewClients && isModuleEnabled('clients', orgEnabledModules, userRole, 'operations') },
        { id: 'terminated_clients', label: 'Hizmeti Sonlandırılan Firmalar', icon: <XCircle size={14} />, show: canViewFinance && isModuleEnabled('terminated_clients', orgEnabledModules, userRole, 'operations') },
        { id: 'inspections', label: 'Saha QR Denetimleri', icon: <QrCode size={14} />, show: isModuleEnabled('inspections', orgEnabledModules, userRole, 'operations') },
        { id: 'waste', label: 'Atık Yönetimi', icon: <Trash2 size={14} />, show: isModuleEnabled('waste', orgEnabledModules, userRole, 'operations') },
      ].filter(t => t.show)
    },
    {
      id: 'compliance',
      label: 'Yasal Uyum & Takip',
      icon: <Scale size={18} />,
      tabs: [
        { id: 'legislations', label: 'Mevzuat Takip', icon: <Scale size={14} />, show: isModuleEnabled('legislations', orgEnabledModules, userRole, 'compliance') },
        { id: 'requests', label: 'Mevzuat Talepleri', icon: <Bell size={14} />, show: isModuleEnabled('requests', orgEnabledModules, userRole, 'compliance') },
      ].filter(t => t.show)
    },
    {
      id: 'actions',
      label: 'Aksiyon Takip',
      icon: <CheckCircle size={18} />,
      tabs: [
        { id: 'actions', label: 'Aksiyon Takip', icon: <CheckCircle size={14} />, show: isModuleEnabled('actions', orgEnabledModules, userRole, 'compliance') },
      ].filter(t => t.show)
    },
    {
      id: 'documents',
      label: 'Dokümantasyon',
      icon: <FileText size={18} />,
      tabs: [
        { id: 'reports', label: 'Aylık & Yıllık Raporlar', icon: <FileText size={14} />, show: canViewReports && isModuleEnabled('reports', orgEnabledModules, userRole, 'documents') },
        { id: 'document_matrix', label: 'Zorunlu Belge Matrisi', icon: <Table size={14} />, show: isModuleEnabled('document_matrix', orgEnabledModules, userRole, 'documents') },
        { id: 'document_requests', label: 'Evrak Talepleri', icon: <Inbox size={14} />, show: isModuleEnabled('document_requests', orgEnabledModules, userRole, 'documents') },
        { id: 'msds', label: 'MSDS/SDS Takibi', icon: <FlaskConical size={14} />, show: isModuleEnabled('msds', orgEnabledModules, userRole, 'documents') },
        { id: 'opinions', label: 'Görüşler', icon: <PenLine size={14} />, show: isModuleEnabled('opinions', orgEnabledModules, userRole, 'compliance') },
        {
          id: 'definitions',
          label: 'Belge & Şablon Tanımları',
          icon: <SettingsIcon size={14} />,
          show: (userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual' || userRole === 'corporate_staff') && isModuleEnabled('definitions', orgEnabledModules, userRole, 'documents')
        },
      ].filter(t => t.show)
    },
    {
      id: 'finance',
      label: 'Finans & Maliyet',
      icon: <PieChart size={18} />,
      tabs: [
        { id: 'finance_summary', label: 'Finansal Özet', icon: <PieChart size={14} />, show: canViewFinance && isModuleEnabled('finance', orgEnabledModules, userRole, 'finance') },
        { id: 'finance_payments', label: 'Müşteri Ödemeleri', icon: <CheckCircle size={14} />, show: canViewFinance && isModuleEnabled('finance', orgEnabledModules, userRole, 'finance') },
        { id: 'finance_expenses', label: 'Gider Yönetimi', icon: <Trash2 size={14} />, show: canViewFinance && isModuleEnabled('finance', orgEnabledModules, userRole, 'finance') },
        { id: 'staff_expense_submission', label: 'Gider Ekle', icon: <PlusCircle size={14} />, show: (userRole === 'corporate_staff' || userRole === 'corporate_chief') && isModuleEnabled('finance', orgEnabledModules, userRole, 'finance') },
      ].filter(t => t.show)
    },
    {
      id: 'hr',
      label: 'İnsan Kaynakları',
      icon: <Users size={18} />,
      tabs: [
        { id: 'team', label: 'Ekip Yönetimi', icon: <Users size={14} />, show: canViewTeam && isModuleEnabled('team', orgEnabledModules, userRole, 'hr') },
        { id: 'org_chart', label: 'Organizasyon Şeması', icon: <Network size={14} />, show: canViewTeam && isModuleEnabled('org_chart', orgEnabledModules, userRole, 'hr') },
        {
          id: 'evaluations',
          label: 'Çalışan Değerlendirmeleri',
          icon: <Star size={14} />,
          show: ['premium_corporate', 'corporate_chief', 'admin', 'system_admin'].includes(userRole) && isModuleEnabled('evaluations', orgEnabledModules, userRole, 'hr')
        },
        { id: 'departed', label: 'Ayrılan Personeller', icon: <LogOut size={14} />, show: userRole === 'premium_corporate' && isModuleEnabled('departed', orgEnabledModules, userRole, 'hr') },
      ].filter(t => t.show)
    },
    {
      id: 'settings',
      label: 'Sistem & Ayarlar',
      icon: <SettingsIcon size={18} />,
      tabs: [
        { id: 'settings', label: 'Şirket Ayarları', icon: <SettingsIcon size={14} />, show: userRole === 'premium_corporate' },
        { id: 'storage_settings', label: 'Depolama Ayarları', icon: <HardDrive size={14} />, show: userRole === 'premium_corporate' },
      ].filter(t => t.show)
    }
  ].filter(m => m.tabs.length > 0);

  const renderDocumentMatrix = () => {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl">
            <Table size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Zorunlu Belge Matrisi</h2>
            <p className="text-xs text-gray-400">İşletmelerinizin zorunlu belgelerinin güncel durum tablosu</p>
          </div>
        </div>

        {defTabTypes.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400 italic">
            Henüz tanımlı belge türü bulunmamaktadır. Lütfen önce <strong>"Dokümantasyon"</strong> altındaki <strong>"Belge & Şablon Tanımları"</strong> sekmesinden belge türlerini tanımlayın.
          </div>
        ) : (
          <div className="space-y-4">
            {requiredDocs.length === 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-xl text-xs flex items-start gap-2.5">
                <span className="text-sm">ℹ️</span>
                <div>
                  <span className="font-bold">Henüz zorunlu belge ataması yapılmamıştır.</span> Matristeki tüm hücreler varsayılan olarak "-" (gerekli değil) şeklinde görünmektedir. İşletmeler için hangi belgelerin zorunlu tutulacağını belirlemek amacıyla <strong>"Dokümantasyon"</strong> modülü altındaki <strong>"Belge & Şablon Tanımları"</strong> sekmesine giderek "Zorunlu Belgeler Şablonu"nu düzenleyebilirsiniz.
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-gray-150 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900 border-b border-gray-150 dark:border-slate-700 text-gray-600 dark:text-gray-400 uppercase font-semibold">
                    <th className="p-4 font-bold border-r border-gray-150 dark:border-slate-700 sticky left-0 bg-gray-50 dark:bg-slate-900 z-10">İşletme Adı</th>
                    {defTabTypes.map(type => (
                      <th key={type.id} className="p-4 text-center min-w-[150px] font-bold">{type.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-slate-700">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={100} className="p-8 text-center text-gray-450 italic">Kayıtlı işletme bulunamadı.</td>
                    </tr>
                  ) : (
                    clients.map(client => {
                      return (
                        <tr key={client.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-4 font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-150 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-800 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{client.name}</td>
                          {defTabTypes.map(type => {
                            const reqConf = requiredDocs.find(rd => rd.client_id === client.id && type.rowIds.includes(rd.type_def_id));
                            if (!reqConf) {
                              return (
                                <td key={type.id} className="p-4 text-center text-gray-300 dark:text-slate-600 font-medium">-</td>
                              );
                            }

                            if (reqConf.is_exempt) {
                              return (
                                <td key={type.id} className="p-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedExemptReason(reqConf.exempt_reason || 'Belirtilmedi');
                                      setSelectedExemptDocType(type.label);
                                      setSelectedExemptClientName(client.name);
                                      setShowExemptModal(true);
                                    }}
                                    className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-full hover:bg-blue-100 transition cursor-pointer"
                                    title={`Muafiyet Nedeni: ${reqConf.exempt_reason || 'Belirtilmedi'}`}
                                  >
                                    MUAF
                                  </button>
                                </td>
                              );
                            }

                            // Check if uploaded
                            const matchingDoc = allDocsForMatrix.find(d => type.rowIds.includes(d.type_def_id) && rawDefs.some(rd => rd.id === d.location_def_id && rd.label && rd.label.trim().toLowerCase() === client.name.trim().toLowerCase()));

                            if (matchingDoc) {
                              const isIndefinite = matchingDoc.is_indefinite || !matchingDoc.expiry_date;
                              const expiryDate = matchingDoc.expiry_date;
                              const today = new Date().toISOString().split('T')[0];
                              const isExpired = !isIndefinite && expiryDate && expiryDate < today;

                              if (isExpired) {
                                return (
                                  <td key={type.id} className="p-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleShowDocumentDetail(matchingDoc.id, client)}
                                      className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900 rounded-full hover:bg-amber-100 transition cursor-pointer font-black"
                                    >
                                      SÜRESİ GEÇTİ
                                    </button>
                                  </td>
                                );
                              } else {
                                // Son başvuru tarihine 30 gün kala kontrolü (Aylık raporlar hariç)
                                const isMonthlyReport = type.label.toLowerCase().includes('aylık') || type.label.toLowerCase().includes('aylik');
                                const isApproaching = false; // logic matches lower block

                                return (
                                  <td key={type.id} className="p-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleShowDocumentDetail(matchingDoc.id, client)}
                                      className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-405 border border-emerald-200 dark:border-emerald-900 rounded-full hover:bg-emerald-100 transition cursor-pointer font-black"
                                    >
                                      GEÇERLİ
                                    </button>
                                  </td>
                                );
                              }
                            }

                            return (
                              <td key={type.id} className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMissingDocType(type.label);
                                    setSelectedMissingClientName(client.name);
                                    setShowMissingModal(true);
                                  }}
                                  className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-full animate-pulse hover:bg-rose-100 transition cursor-pointer"
                                >
                                  EKSİK
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const isOrgDateValid = !!orgData?.subscription_end_date && new Date(orgData.subscription_end_date) > new Date();
  const isPremiumActive = userRole === 'admin' || userRole === 'system_admin' ||
    (userRole === 'premium_individual'
      ? (!!mySubEndDate && new Date(mySubEndDate) > new Date())
      : (isOrgDateValid && premiumSeatActive));
  const seatInactive = !isPremiumActive && isOrgDateValid && !premiumSeatActive;
  // Şirket aboneliği tamamen sona erince check_and_downgrade_subscriptions()
  // sahibin rolünü de 'normal'a düşürüyor (previous_role'da saklıyor). Yenileme
  // linkini/mesajını hâlâ gerçek sahibe göstermek için "eski rol"ü de sayıyoruz.
  const isOwnerEffective =
    userRole === 'premium_corporate' ||
    (userRole === 'normal' && previousRole === 'premium_corporate');

  return (
    <div className="space-y-6">
      {!isPremiumActive && orgData && (
        seatInactive ? (
          <div className="print-hidden bg-gradient-to-r from-gray-600 to-slate-500 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle size={22} className="shrink-0" />
              <div>
                <p className="font-bold text-sm">Premiumsuz Hesap</p>
                <p className="text-xs text-white/90">Kota sayısı uygun değil. Hesabınızın premium erişimi firma sahibiniz tarafından pasif hale getirildi. Lütfen firma sahibinizle iletişime geçiniz.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="print-hidden bg-gradient-to-r from-rose-600 to-orange-500 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle size={22} className="shrink-0" />
              <div>
                <p className="font-bold text-sm">Premium süresi doldu!</p>
                <p className="text-xs text-white/90">
                  {isOwnerEffective
                    ? 'Lütfen paket yenilemesi yapın. Yenileme yapılmadan yeni belge, rapor veya görüş oluşturamazsınız.'
                    : 'Yenileme yapılmadan yeni belge, rapor veya görüş oluşturamazsınız. Lütfen firma sahibinizle iletişime geçiniz.'}
                </p>
              </div>
            </div>
            {isOwnerEffective && (
              <Link
                to="/pricing"
                className="bg-white text-rose-700 px-4 py-2 rounded-lg font-bold text-xs whitespace-nowrap hover:bg-rose-50 transition shrink-0"
              >
                Paketi Yenile
              </Link>
            )}
          </div>
        )
      )}

      {/* Premium süresi dolduysa panelin geri kalanı bulanık ve etkileşimsiz gösterilir */}
      <div className={!isPremiumActive && orgData ? 'pointer-events-none select-none blur-[3px] opacity-70 space-y-6' : 'space-y-6'}>

      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="text-blue-600" /> {panelTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">İşletmelerinizi ve raporları yönetin.</p>
        </div>
          <div className="flex items-center gap-2">
            {activeTab === 'clients' && canCreateClients && (
              <button
                onClick={() => setShowAddClient(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus size={18} /> Yeni İşletme
              </button>
            )}
          {activeTab === 'reports' && (
            isPremiumActive ? (
              <Link
                to="/consultant/reports/add"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
              >
                <FileText size={18} /> Rapor Oluştur
              </Link>
            ) : (
              <Link
                to="/pricing"
                title="Rapor oluşturmak için premium paketinizi yenilemeniz gerekiyor"
                className="flex items-center gap-2 bg-gray-300 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-4 py-2 rounded-lg cursor-pointer"
              >
                <Lock size={16} /> Rapor Oluştur (Premium Gerekli)
              </Link>
            )
          )}
          {['premium_corporate', 'admin', 'system_admin'].includes(userRole) && (
            <button
              onClick={() => setShowModuleStoreModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag size={15} /> ⚡ Ekstra Modül Satın Al
            </button>
          )}
        </div>
      </div>

      {/* Modüller (Ana Kategoriler) */}
      {/* Mobilde tüm modüller sığmıyor; sağdaki fade, çubuğun kaydırılabilir
          olduğunu görsel olarak belli eder (aksi halde son etiket ekran
          kenarında keskin biçimde kesilip "bozuk" görünüyordu). */}
      <div className="relative">
        <div className="bg-slate-100/80 dark:bg-slate-900/50 p-2 rounded-2xl border border-gray-200 dark:border-slate-800 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
          {modules.filter(m => m.tabs.some(t => t.show)).map((mod) => {
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => selectModule(mod.id as any)}
                className={`relative px-5 py-3 text-xs font-bold rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10 scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {mod.icon}
                <span>{mod.label}</span>
                {mod.id === 'actions' && newActionsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                    {newActionsCount > 99 ? '99+' : newActionsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-slate-100 dark:from-slate-900 to-transparent sm:hidden" />
      </div>

      {/* Alt Sayfalar / Modül Sekmeleri (Yalnızca 1'den fazla gösterilebilir sekme varsa) */}
      {(() => {
        const currentMod = modules.find(m => m.id === activeModule);
        const visibleTabs = currentMod?.tabs.filter(t => t.show) || [];
        if (visibleTabs.length <= 1) return null;

        return (
          <div className="flex border-b border-gray-250 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm gap-1.5 flex-wrap">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      {requiresFinanceHrReAuth && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 flex flex-col items-center text-center animate-fadeIn max-w-md mx-auto">
          <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 p-4 rounded-2xl mb-4">
            <Lock size={28} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Bu alan parola ile korunuyor</h3>
          <p className="text-xs text-slate-500 mt-1.5 mb-5">
            {activeModule === 'finance' ? 'Finans & Maliyet' : 'İnsan Kaynakları'} bölümüne her girişte hesap parolanızı
            tekrar girmeniz isteniyor — böylece ekranınız açık kalsa bile bu hassas verileri sadece siz görebilirsiniz.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); handleFinanceHrReAuth(); }}
            className="w-full space-y-3"
          >
            <input
              type="password"
              autoFocus
              required
              placeholder="Hesap parolanız"
              value={reAuthPassword}
              onChange={(e) => { setReAuthPassword(e.target.value); setReAuthError(''); }}
              className="w-full p-3 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200 text-center"
            />
            {reAuthError && <p className="text-xs font-bold text-rose-600">{reAuthError}</p>}
            <button
              type="submit"
              disabled={reAuthLoading || !reAuthPassword}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
            >
              {reAuthLoading ? <Loader className="animate-spin" size={14} /> : <Lock size={14} />}
              Doğrula ve Devam Et
            </button>
          </form>
        </div>
      )}


      {activeTab === 'clients' && (
        <div className="space-y-6">
          <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm gap-2 flex-wrap">
            <button
              onClick={() => setClientSubView('grid')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                clientSubView === 'grid'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-400'
              }`}
            >
              Tüm İşletmeler
            </button>
            <button
              onClick={() => {
                setClientSubView('personnel');
                if (teamMembers.length === 0) fetchTeamMembers();
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                clientSubView === 'personnel'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-400'
              }`}
            >
              Personel Atamaları (Kota ve İşletmeler)
            </button>
            <button
              onClick={() => {
                setClientSubView('requests');
                fetchChangeRequests();
                fetchStaffRoleChangeRequests();
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                clientSubView === 'requests'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-400'
              }`}
            >
              Değişiklik Talepleri (Ünvan & Adres)
            </button>
          </div>

          {clientSubView === 'grid' ? (
            <>
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                Toplam <span className="text-blue-600 dark:text-blue-400">{clients.filter((c) => !c.parent_client_id).length}</span> işletmeye hizmet veriliyor
                {clients.some((c) => c.parent_client_id) && (
                  <span className="text-gray-400 font-normal"> ({clients.filter((c) => c.parent_client_id).length} şube dahil değil)</span>
                )}
              </span>
              <button
                onClick={handleExportClientsToExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
              >
                <Download size={14} /> Excel'e Aktar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => {
                const branches = clients.filter((c) => c.parent_client_id === client.id);
                const parentOfBranch = client.parent_client_id ? clients.find((c) => c.id === client.parent_client_id) : null;
                const cardStatus = getClientServiceStatus(client.id, client.service_start_date, client.service_terminated_at);
                const isContractExpired = !!cardStatus && !cardStatus.isTerminated && cardStatus.isExpired;
                const isContractWarning = !!cardStatus && !cardStatus.isTerminated && !cardStatus.isExpired && cardStatus.daysLeft <= 30;
                const cardBorderClass = isContractExpired
                  ? 'border-2 border-rose-400 dark:border-rose-600'
                  : isContractWarning
                  ? 'border-2 border-amber-400 dark:border-amber-600'
                  : 'border border-gray-200 dark:border-slate-700';
                return (
                <div
                  key={client.id}
                  className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm hover:shadow-md transition ${cardBorderClass}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {client.logo_url ? (
                        <img src={client.logo_url} alt="Logo" className="w-12 h-12 rounded-lg object-contain border" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          <Building size={24} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{client.name}</h3>
                        <p className="text-xs text-gray-500">Vergi No: {client.tax_no || 'Belirtilmemiş'}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {parentOfBranch && (
                            <span
                              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50 uppercase flex items-center gap-1"
                              title={`${parentOfBranch.name} firmasının şubesi`}
                            >
                              <GitBranch size={10} /> Şube · {parentOfBranch.name}
                            </span>
                          )}
                          {client.permit_stage === 'ek1' ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/50 uppercase">
                              Çevre İzin EK-1
                            </span>
                          ) : client.permit_stage === 'ek2' ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/50 uppercase">
                              Çevre İzin EK-2
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-655 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 uppercase">
                              Çevre İzin Kapsam Dışı
                            </span>
                          )}
                          {client.ced_status === 'ek1' ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50 uppercase">
                              ÇED EK-1
                            </span>
                          ) : client.ced_status === 'ek2' ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50 uppercase">
                              ÇED EK-2
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-655 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 uppercase">
                              ÇED Kapsam Dışı
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p className="line-clamp-2"><span className="font-medium">Adres:</span> {client.address}</p>
                    <p><span className="font-medium">Tel:</span> {client.phone}</p>
                    {client.kep_address && <p><span className="font-medium">KEP:</span> {client.kep_address}</p>}
                    {(client.area_m2 || (client.area_points && client.area_points.length >= 3)) && (
                      <p className="text-teal-600 dark:text-teal-400 font-medium">
                        Alan: {formatArea(client.area_m2 || calculatePolygonAreaM2(client.area_points || []))}
                      </p>
                    )}
                    {client.permit_stage !== 'out_of_scope' && (() => {
                      const articlesArray = Array.isArray(client.permit_articles)
                        ? client.permit_articles
                        : typeof client.permit_articles === 'string'
                          ? JSON.parse(client.permit_articles || '[]')
                          : [];
                      if (articlesArray.length === 0) return null;
                      return (
                        <div className="text-xs pt-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-350">Maddeler:</span>{' '}
                          <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono font-bold text-blue-600 dark:text-blue-400 max-w-full inline-block truncate" title={articlesArray.join(', ')}>
                            {articlesArray.join(', ')}
                          </span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const status = cardStatus;
                      const periods = servicePeriods
                        .filter((p) => p.client_id === client.id)
                        .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
                      const isHistoryOpen = !!expandedPeriodHistory[client.id];
                      const isRenewing = renewingClientId === client.id;

                      return (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sözleşme Durumu</span>
                            {!status ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">
                                Hizmet Başlatılmadı
                              </span>
                            ) : status.isTerminated ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">
                                Hizmet Sonlandırıldı
                              </span>
                            ) : isContractExpired ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50 uppercase">
                                Süresi Geçti
                              </span>
                            ) : isContractWarning ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 uppercase animate-pulse">
                                Son {status.daysLeft} Gün
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50 uppercase">
                                {status.daysLeft} Gün Kaldı
                              </span>
                            )}
                          </div>

                          {status && (
                            <div className="flex justify-between items-center text-[11px] text-gray-500">
                              <span>Başlangıç: <b>{status.startDate.toLocaleDateString('tr-TR')}</b></span>
                              <span className="flex items-center gap-1.5">
                                Bitiş: <b>{status.expiryDate.toLocaleDateString('tr-TR')}</b>
                                {canViewFinance && status.latestPeriod && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPeriodDatesClientId(client.id);
                                      setEditPeriodStartDate(status.latestPeriod.start_date);
                                      setEditPeriodEndDate(status.latestPeriod.end_date);
                                    }}
                                    className="text-blue-500 hover:text-blue-700"
                                    title="Sözleşme başlangıç/bitiş tarihini düzenle"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                )}
                              </span>
                            </div>
                          )}
                          {editingPeriodDatesClientId === client.id && (
                            <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/40 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Başlangıç</label>
                                  <input
                                    type="date"
                                    value={editPeriodStartDate}
                                    onChange={(e) => setEditPeriodStartDate(e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Bitiş</label>
                                  <input
                                    type="date"
                                    value={editPeriodEndDate}
                                    onChange={(e) => setEditPeriodEndDate(e.target.value)}
                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-[11px]"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => setEditingPeriodDatesClientId(null)}
                                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                >
                                  İptal
                                </button>
                                <button
                                  type="button"
                                  disabled={savingPeriodDates}
                                  onClick={() => handleUpdateClientPeriodDates(client.id, editPeriodStartDate, editPeriodEndDate)}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                >
                                  {savingPeriodDates ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                              </div>
                            </div>
                          )}
                          {status && canViewFinance && (
                            <div className="flex justify-between text-[11px] text-gray-500">
                              <span>Bu Dönem Ücreti:</span>
                              <b className="text-gray-800 dark:text-slate-200">{status.currentFee.toLocaleString('tr-TR')} TL/ay</b>
                            </div>
                          )}

                          {client.contract_file_url && (
                            <div className="pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-700 flex justify-end">
                              <a
                                href={client.contract_file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-bold flex items-center gap-1 transition"
                              >
                                Sözleşme Nüshası ↗
                              </a>
                            </div>
                          )}

                          {canViewFinance && (
                            <div className="pt-1.5 border-t border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (periods.length === 0) return;
                                  setExpandedPeriodHistory((prev) => ({ ...prev, [client.id]: !isHistoryOpen }));
                                }}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                disabled={periods.length === 0}
                              >
                                {periods.length > 0 ? `Dönem Geçmişi (${periods.length}) ${isHistoryOpen ? '▲' : '▼'}` : ''}
                              </button>
                              <div className="flex items-center gap-3">
                                {status && (
                                  <button
                                    type="button"
                                    onClick={() => setTerminatingClientId(client.id)}
                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                                  >
                                    Hizmet Sonlandır
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenewingClientId(isRenewing ? null : client.id);
                                    setRenewMode('auto');
                                    setRenewCustomEndDate('');
                                    setRenewFee(status ? String(status.currentFee) : '');
                                  }}
                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  {isRenewing ? 'Vazgeç' : status ? 'Hizmet Yenile' : 'Hizmet Başlat'}
                                </button>
                              </div>
                            </div>
                          )}

                          {isHistoryOpen && periods.length > 0 && (
                            <div className="space-y-1 pt-1">
                              {periods.map((p) => (
                                <div key={p.id} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950/30 rounded-lg px-2 py-1 border border-slate-100 dark:border-slate-800">
                                  <span>{new Date(p.start_date).toLocaleDateString('tr-TR')} – {new Date(p.end_date).toLocaleDateString('tr-TR')}</span>
                                  <b className="text-slate-700 dark:text-slate-300">{Number(p.monthly_fee).toLocaleString('tr-TR')} TL/ay</b>
                                </div>
                              ))}
                            </div>
                          )}

                          {isRenewing && (
                            <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-slate-700 space-y-2">
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setRenewMode('auto')}
                                  className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border ${renewMode === 'auto' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                                >
                                  1 Yıl Uzat (Otomatik)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRenewMode('custom')}
                                  className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border ${renewMode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                                >
                                  Özel Bitiş Tarihi
                                </button>
                              </div>
                              {renewMode === 'custom' && (
                                <input
                                  type="date"
                                  value={renewCustomEndDate}
                                  onChange={(e) => setRenewCustomEndDate(e.target.value)}
                                  className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              )}
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Bu Dönem İçin Aylık Ücret (TL) *</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={renewFee}
                                  onChange={(e) => setRenewFee(e.target.value)}
                                  placeholder="ör. 6500"
                                  className="w-full border rounded-lg px-2 py-1.5 text-[11px] bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRenewClientService(client.id)}
                                disabled={savingRenewal}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                              >
                                {savingRenewal ? 'Kaydediliyor...' : 'Kaydet ve Uzat'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {branches.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-slate-700 space-y-1.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <GitBranch size={11} /> Şubeler ({branches.length})
                        </span>
                        {branches.map((branch) => (
                          <div
                            key={branch.id}
                            className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg px-2.5 py-1.5"
                          >
                            <span className="font-semibold text-xs text-gray-700 dark:text-slate-300 truncate" title={branch.name}>
                              {branch.name}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {canAssignClients && (
                                <button
                                  onClick={() => openAssignModal(branch)}
                                  title="Personel Ata"
                                  className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded"
                                >
                                  <User size={12} />
                                </button>
                              )}
                              {checkClientEditable(branch) && (
                                <button
                                  onClick={() => handleOpenEditModal(branch)}
                                  title="Şubeyi Düzenle"
                                  className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                              {canDeleteClients && (
                                <button
                                  onClick={() => handleDeleteClient(branch.id)}
                                  title="Şubeyi Sil"
                                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {(canDeleteClients || checkClientEditable(client) || canAssignClients || true) && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {checkClientEditable(client) && (
                          <button 
                            onClick={() => handleOpenEditModal(client)}
                            className="text-amber-600 hover:underline text-sm flex items-center gap-1 font-medium"
                          >
                            <Edit2 size={14} /> Düzenle
                          </button>
                        )}
                        {canDeleteClients && (
                          <button 
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-red-600 hover:underline text-sm flex items-center gap-1 font-medium"
                          >
                            <Trash2 size={14} /> Sil
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedClientForChangeRequest(client);
                            setChangeRequestNewName(client.name);
                            setChangeRequestNewAddress(client.address);
                            setChangeRequestPdfFile(null);
                            setShowClientChangeRequestModal(true);
                          }}
                          className="text-purple-650 hover:underline text-sm flex items-center gap-1 font-medium"
                        >
                          <RefreshCw size={14} /> Ünvan/Adres Talebi
                        </button>
                        <button 
                          onClick={() => handleOpenClientLoginModal(client)}
                          className="text-teal-600 hover:underline text-sm flex items-center gap-1 font-medium"
                        >
                          <User size={14} /> Müşteri Girişi
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {canCreateClients && (
                          <button
                            onClick={() => openAddBranchModal(client)}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <GitBranchPlus size={13} /> Şube Ekle
                          </button>
                        )}
                        {canAssignClients && (
                          <button
                            onClick={() => openAssignModal(client)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                          >
                            Personel Ata
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            </>
          ) : clientSubView === 'personnel' ? (
            <div className="space-y-6">
              {teamMembers
                .filter(member => member.role !== 'normal' && (userRole !== 'corporate_staff' || member.id === userId))
                .map(member => {
                  const assigned = allAssignments
                    .filter(a => a.user_id === member.id)
                    .map(a => clients.find(c => c.id === a.client_id))
                    .filter(Boolean);

                  const totalDays = getPersonnelQuota(member.id);
                  const percentage = Math.min((totalDays / 16) * 100, 100);
                  const isExceeded = totalDays > 16;

                  return (
                    <div key={member.id} className="p-6 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/40 flex items-center justify-center font-bold text-sm uppercase">
                            {member.full_name?.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-gray-950 dark:text-white text-base flex items-center gap-2">
                              {member.full_name}
                              <span className="text-[10px] font-normal px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 uppercase">
                                {roleLabels[member.role] || member.role}
                              </span>
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {member.email} • <span className="font-bold text-slate-600 dark:text-slate-350">Deneyim: {member.experience_years || 0} Yıl</span>
                            </p>
                          </div>
                        </div>

                        <div className="w-full md:w-64 space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-500">İş Günü Kotası</span>
                            <span className={isExceeded ? "text-rose-600 dark:text-rose-455 font-black" : "text-gray-750 dark:text-gray-300 font-black"}>
                              {totalDays} / 16 Gün ({((totalDays / 16) * 100).toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${percentage}%` }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                isExceeded 
                                  ? 'bg-rose-500' 
                                  : totalDays > 12 
                                    ? 'bg-amber-500' 
                                    : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sorumlu Olduğu İşletmeler ({assigned.length})</h5>
                        {assigned.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {assigned.map((client: any) => (
                              <div key={client.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  {client.logo_url ? (
                                    <img src={client.logo_url} alt="Logo" className="w-8 h-8 rounded object-contain border bg-white" />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-400">
                                      <Building size={16} />
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-250 line-clamp-1">{client.name}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {client.permit_stage === 'ek1' ? (
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/50 uppercase">
                                          EK-1 (2 Gün)
                                        </span>
                                      ) : client.permit_stage === 'ek2' ? (
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-455 dark:border-amber-900/50 uppercase">
                                          EK-2 (1 Gün)
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-gray-50 text-gray-600 border border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 uppercase">
                                          Kapsam Dışı
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Bu personele henüz bir işletme atanmamış.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
              <div className="border-b pb-3">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                  <RefreshCw size={18} className="text-purple-600" /> Ünvan & Adres Değişikliği Talepleri
                </h3>
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  İşletmelerin resmi ünvan veya adres güncellemeleri için gönderilen talepleri görüntüleyin. Bu talepler onaylandığında resmi kayıtlar otomatik güncellenir.
                </p>
              </div>

              {loadingChangeRequests ? (
                <div className="flex justify-center items-center py-12 text-xs text-gray-500 gap-2">
                  <Loader className="animate-spin" size={14} /> Yükleniyor...
                </div>
              ) : changeRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 italic bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
                  Henüz gönderilmiş bir değişiklik talebi bulunmuyor.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {changeRequests.map((req) => (
                    <div key={req.id} className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/10 dark:border-slate-800 space-y-3 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{req.client?.name}</span>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Talep Eden: <b>{req.requester?.full_name || 'Bilinmeyen'}</b>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900'
                            : req.status === 'approved'
                            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900'
                            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900'
                        }`}>
                          {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                        </span>
                      </div>

                      <div className="space-y-1.5 p-2.5 rounded bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800">
                        {req.new_name && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">Talep Edilen Yeni Ünvan</span>
                            <span className="text-gray-700 dark:text-gray-300 font-semibold">{req.new_name}</span>
                          </div>
                        )}
                        {req.new_address && (
                          <div className={req.new_name ? "pt-1.5 border-t border-dashed border-gray-150 dark:border-slate-800" : ""}>
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">Talep Edilen Yeni Adres</span>
                            <span className="text-gray-700 dark:text-gray-300 font-semibold block whitespace-pre-wrap">{req.new_address}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200 dark:border-slate-800 text-[10px]">
                        <a 
                          href={req.gazette_pdf_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                        >
                          Gazete PDF'i ↗
                        </a>
                        <span className="text-gray-400">{new Date(req.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>

                      {req.status === 'rejected' && req.rejection_reason && (
                        <div className="p-2 bg-red-50/50 dark:bg-red-950/10 text-red-800 dark:text-red-350 rounded border border-red-100 dark:border-red-900/35">
                          <span className="font-bold text-[9px] block uppercase">Red Gerekçesi</span>
                          <p className="italic">{req.rejection_reason}</p>
                        </div>
                      )}

                      {req.status === 'pending' && isManager && (
                        <div className="flex gap-2 pt-2 border-t border-dashed border-gray-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleApproveChangeRequest(req)}
                            disabled={resolvingChangeRequestId === req.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-2 rounded transition shadow-sm text-center text-xs disabled:opacity-50 cursor-pointer"
                          >
                            {resolvingChangeRequestId === req.id ? 'İşleniyor...' : 'Onayla'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChangeRequestForRejection(req);
                              setChangeRejectionReason('');
                              setShowChangeRejectionModal(true);
                            }}
                            disabled={resolvingChangeRequestId === req.id}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-2 rounded transition border border-red-500 text-center text-xs disabled:opacity-50 cursor-pointer"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="border-b pb-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                <User size={18} className="text-purple-600" /> Personel Ünvan Değişikliği Talepleri
              </h3>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                Ekip üyelerinin kendi ünvanları için gönderdiği değişiklik talepleri. Onaylandığında ilgili kullanıcının rolü doğrudan güncellenir.
              </p>
            </div>

            {staffRoleChangeRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 italic bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
                Henüz gönderilmiş bir ünvan değişikliği talebi bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffRoleChangeRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/10 dark:border-slate-800 space-y-2 text-xs">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{req.requester?.full_name || 'Bilinmeyen'}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{req.requester?.email}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-semibold">{roleLabels[req.from_role] || req.from_role}</span>
                      <span>→</span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-semibold">{roleLabels[req.to_role] || req.to_role}</span>
                    </div>
                    {req.reason && <p className="text-gray-600 dark:text-gray-400 italic">"{req.reason}"</p>}
                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-200 dark:border-slate-700">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' :
                        req.status === 'rejected' ? 'bg-red-50 text-red-600 dark:bg-red-950/30' :
                        'bg-amber-50 text-amber-700 dark:bg-amber-950/30'
                      }`}>
                        {req.status === 'approved' ? 'Onaylandı' : req.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                      </span>
                      {req.status === 'pending' && userRole === 'premium_corporate' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleApproveRoleChangeRequest(req)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2 rounded text-[10px]">Onayla</button>
                          <button onClick={() => handleRejectRoleChangeRequest(req)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-[10px]">Reddet</button>
                        </div>
                      )}
                    </div>
                    {req.status === 'rejected' && req.rejection_reason && (
                      <p className="text-[10px] text-red-500 italic">Gerekçe: {req.rejection_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Yöneticiler için Alt Sekmeler */}
          {isManager && (
            <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700 gap-2 mb-4">
              <button
                onClick={() => setReportsSubView('monthly')}
                className={`flex items-center gap-2 py-2 px-4 text-xs font-bold rounded-lg transition ${
                  reportsSubView === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
                }`}
              >
                Aylık Değerlendirme Raporları
              </button>
              <button
                onClick={() => setReportsSubView('yearly')}
                className={`flex items-center gap-2 py-2 px-4 text-xs font-bold rounded-lg transition ${
                  reportsSubView === 'yearly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
                }`}
              >
                Yıllık İç Tetkik Raporları
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşletme</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rapor Türü</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Oluşturan</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Islak İmza</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {(() => {
                    const filteredReports = reports.filter((report) => {
                      if (isManager) {
                        return report.report_type === reportsSubView;
                      }
                      return true;
                    });

                    if (filteredReports.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-500">
                            Rapor bulunamadı.
                          </td>
                        </tr>
                      );
                    }

                    return filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                        <td className="p-4 text-sm font-medium">{report.client?.name}</td>
                        <td className="p-4 text-sm">
                          {report.report_type === 'monthly' ? 'Aylık Değerlendirme' : 'Yıllık İç Tetkik'}
                        </td>
                        <td className="p-4 text-sm">
                          {new Date(report.report_date).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="p-4 text-sm">{report.creator?.full_name || 'Bilinmiyor'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getReportStatusColor(report)}`}>
                            {getReportStatusColor(report).includes('green') && <CheckCircle size={12} />}
                            {getReportStatusColor(report).includes('yellow') && <Clock size={12} />}
                            {getReportStatusColor(report).includes('red') && <AlertCircle size={12} />}
                            {getReportStatusText(report)}
                          </span>
                        </td>
                        <td className="p-4">
                          {(report as any).wet_signature_url ? (
                            <a
                              href={(report as any).wet_signature_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition"
                            >
                              <CheckCircle size={12} /> Islak İmzalı
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200">
                              <AlertCircle size={12} /> İmzalanmadı
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <Link
                            to={`/consultant/reports/${report.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg inline-flex"
                          >
                            <Eye size={18} />
                          </Link>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && orgData && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
          {/* Şirket Bilgileri */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600">
              <Building size={20} /> Şirket Bilgileri ve Rapor Ayarları
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">Şirket Ünvanı (Raporlarda Görünen)</label>
                <input
                  type="text"
                  value={orgData.name || ''}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700"
                  placeholder="Örn: EvrakLab Danışmanlık Ltd. Şti."
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Şirket Logosu</label>
                <p className="text-xs text-gray-500 mb-3">Raporların üst kısmında danışman firma logosu olarak görünecektir.</p>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 border rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                    {orgData.consultant_logo_url ? (
                      <img src={orgData.consultant_logo_url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building size={48} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition text-sm font-bold">
                      <Upload size={16} /> {uploadingLogo ? 'Yükleniyor...' : 'Logoyu Değiştir'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleOrgLogoUpload} disabled={uploadingLogo} />
                    </label>
                    <p className="text-[10px] text-gray-400">Önerilen boyut: 200x100px. Arka planı şeffaf PNG önerilir.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Şirket Telefonu</label>
                  <input
                    type="tel"
                    value={orgData.phone || ''}
                    onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                    className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0212 000 00 00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Şirket E-postası</label>
                  <input
                    type="email"
                    value={orgData.email || ''}
                    onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                    className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="info@firmaniz.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Şirket Adresi</label>
                <textarea
                  rows={2}
                  value={orgData.address || ''}
                  onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                  className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Şirket açık adresi..."
                />
              </div>

            </div>

            {/* Kaydet Butonu */}
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700 mt-4">
              <button
                onClick={handleSaveOrg}
                disabled={savingOrg}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
              >
                {savingOrg ? 'Kaydediliyor...' : '💾 Şirket Bilgilerini Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'storage_settings' && orgData && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600">
              <HardDrive size={20} /> Depolama Ayarları
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Belgeleriniz Nerede Saklansın?</label>
                <select
                  value={orgData.storage_preference || 'supabase'}
                  onChange={(e) => setOrgData({ ...orgData, storage_preference: e.target.value })}
                  className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 font-semibold"
                >
                  <option value="supabase">EvrakLab Sistem Depolaması (Varsayılan)</option>
                  <option value="google_drive">Kendi Google Drive'ım</option>
                </select>
              </div>

              {orgData.storage_preference === 'google_drive' && (
                <div className="space-y-4 pt-2">
                  {orgData.google_drive_connected_email ? (
                    <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-sm">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Check size={14} /> Bağlı: {orgData.google_drive_connected_email}
                      </span>
                      <button
                        type="button"
                        onClick={handleDisconnectGoogleDriveOwner}
                        className="text-red-600 text-xs font-bold hover:underline shrink-0"
                      >
                        Bağlantıyı Kaldır
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 font-semibold leading-relaxed">
                      ⚠️ Bağlantı henüz tamamlanmadı. Bağlantı kurulana kadar ekibiniz belge yükleyemez.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Google Client ID</label>
                    <input
                      type="text"
                      value={orgData.google_client_id || ''}
                      onChange={(e) => setOrgData({ ...orgData, google_client_id: e.target.value })}
                      className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 text-sm"
                      placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Google Client Secret</label>
                    <input
                      type="password"
                      value={orgData.google_client_secret || ''}
                      onChange={(e) => setOrgData({ ...orgData, google_client_secret: e.target.value })}
                      className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 text-sm"
                      placeholder="GOCSPX-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Drive Klasör ID (Opsiyonel)</label>
                    <input
                      type="text"
                      value={orgData.google_drive_folder_id || ''}
                      onChange={(e) => setOrgData({ ...orgData, google_drive_folder_id: e.target.value })}
                      className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700 text-sm"
                      placeholder="Boş bırakılırsa Drive'ın ana dizini kullanılır"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleSaveStorageSettings}
                      disabled={savingStorageSettings}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50"
                    >
                      {savingStorageSettings ? 'Kaydediliyor...' : '💾 Alanları Kaydet'}
                    </button>
                    <button
                      onClick={handleConnectGoogleDriveOwner}
                      disabled={connectingGoogleDriveOwner}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition"
                    >
                      {connectingGoogleDriveOwner
                        ? 'Bağlanıyor...'
                        : orgData.google_drive_connected_email
                          ? 'Yeniden Bağla'
                          : "Google Drive'a Bağlan"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Google Cloud Console'da bu OAuth istemcisinin "Yetkilendirilmiş yeniden yönlendirme URI'leri" alanına şunu ekleyin:{' '}
                    <span className="font-mono select-all">{googleOauthRedirectUriOwner}</span>
                  </p>

                  {/* Bilgi: adım adım nasıl bulunur */}
                  <div className="border border-blue-100 dark:border-blue-900 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowGoogleDriveInfo(!showGoogleDriveInfo)}
                      className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-bold"
                    >
                      <span className="flex items-center gap-1.5"><HelpCircle size={14} /> Bu alanları nereden bulacağımı adım adım göster</span>
                      {showGoogleDriveInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showGoogleDriveInfo && (
                      <div className="p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed bg-white dark:bg-slate-900">
                        <p><b>1.</b> <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google Cloud Console</a>'a girin, üstten yeni bir proje oluşturun (veya mevcut bir projeyi seçin).</p>
                        <p><b>2.</b> Sol menüden "API'ler ve Hizmetler &gt; Kitaplık" bölümüne girin, "Google Drive API" araması yapıp etkinleştirin.</p>
                        <p><b>3.</b> "API'ler ve Hizmetler &gt; OAuth izin ekranı" bölümünden bir onay ekranı (Kullanıcı Tipi: Dış/External) oluşturun, uygulama adı ve destek e-postanızı girin.</p>
                        <p><b>4.</b> "API'ler ve Hizmetler &gt; Kimlik Bilgileri" bölümüne girin, "Kimlik Bilgisi Oluştur &gt; OAuth istemci kimliği" seçin, uygulama türü olarak "Web uygulaması" seçin.</p>
                        <p><b>5.</b> "Yetkilendirilmiş yeniden yönlendirme URI'leri" alanına yukarıda gösterilen adresi (<span className="font-mono">{googleOauthRedirectUriOwner}</span>) ekleyin ve kaydedin.</p>
                        <p><b>6.</b> Oluşturulan istemcinin "İstemci Kimliği" (Client ID) ve "İstemci Gizli Anahtarı" (Client Secret) değerlerini yukarıdaki alanlara yapıştırın.</p>
                        <p><b>7.</b> (Opsiyonel) Belgelerinizin belirli bir klasöre gitmesini istiyorsanız, Google Drive'da o klasörü açın; tarayıcı adres çubuğundaki linkte <span className="font-mono">/folders/</span> sonrasındaki uzun kodu kopyalayıp "Drive Klasör ID" alanına yapıştırın.</p>
                        <p><b>8.</b> Alanları kaydedip "Google Drive'a Bağlan" butonuna basın, açılan pencerede belgelerinin saklanmasını istediğiniz Google hesabınızla giriş yapıp izin verin.</p>
                      </div>
                    )}
                  </div>

                  <div className="text-center pt-2 border-t border-gray-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Bu adımları kendiniz tamamlayamıyor musunuz?</p>
                    <Link
                      to="/support"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                    >
                      Destek Modülünden Adminden Yardım İsteyin →
                    </Link>
                  </div>
                </div>
              )}

              {orgData.storage_preference !== 'google_drive' && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveStorageSettings}
                    disabled={savingStorageSettings}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
                  >
                    {savingStorageSettings ? 'Kaydediliyor...' : '💾 Depolama Ayarını Kaydet'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && !requiresFinanceHrReAuth && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ekip Listesi */}
            <div className={`${userRole === 'premium_corporate' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700`}>
              <h3 className="font-bold text-gray-700 dark:text-white mb-4 flex items-center gap-2 text-lg">
                <Users className="text-blue-600" /> Ekip ve Bekleyen Kodlar
              </h3>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                  Kota: {teamMembers.length}/{orgData?.member_limit || 5}
                </span>
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                    orgData?.premium_seat_limit != null
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                      : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-900 dark:border-slate-700'
                  }`}
                >
                  <Crown size={12} />
                  Premium Kota:{' '}
                  {orgData?.premium_seat_limit != null
                    ? `${teamMembers.filter((m) => m.role !== 'normal' && m.premium_seat_active !== false).length}/${orgData.premium_seat_limit}`
                    : 'Sınırsız'}
                </span>
              </div>

              {(() => {
                if (orgData?.storage_preference === 'google_drive') {
                  // Kota bizim değil Google'ın kontrolünde: mümkünse Google'ın
                  // kendi hesap kotasını gösteriyoruz, alamazsak "Sınırsız" gösteriyoruz.
                  const hasRealQuota = googleDriveQuota && googleDriveQuota.limit != null;
                  const gPercent = hasRealQuota
                    ? Math.min(100, (googleDriveQuota!.usage / googleDriveQuota!.limit!) * 100)
                    : 0;
                  const gCritical = hasRealQuota && gPercent >= 90;
                  return (
                    <div className="mb-4 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                          <HardDrive size={13} /> Depolama Kotası (Google Drive)
                        </span>
                        <span className={`text-xs font-bold ${gCritical ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
                          {loadingGoogleDriveQuota
                            ? 'Yükleniyor...'
                            : hasRealQuota
                              ? `${formatBytes(googleDriveQuota!.usage)} / ${formatBytes(googleDriveQuota!.limit!)}`
                              : googleDriveQuota
                                ? `${formatBytes(googleDriveQuota.usage)} / Sınırsız`
                                : 'Sınırsız'}
                        </span>
                      </div>
                      {hasRealQuota && (
                        <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${gPercent}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${
                              gCritical ? 'bg-red-500' : gPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                        Belgeleriniz Google Drive'ınızda tutulduğu için kota limiti tarafımızca belirlenmez, Google hesabınızın kendi kotasına tabidir.
                      </div>
                    </div>
                  );
                }

                const storageLimit = orgData?.storage_limit || 524288000;
                const storagePercent = Math.min(100, (orgStorageUsed / storageLimit) * 100);
                const isStorageCritical = storagePercent >= 90;
                return (
                  <div
                    onClick={handleOpenQuotaDetail}
                    className={`mb-4 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700 ${
                      userRole === 'premium_corporate' ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                        <HardDrive size={13} /> Depolama Kotası (Firma Ortak Alanı)
                      </span>
                      <span className={`text-xs font-bold ${isStorageCritical ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatBytes(orgStorageUsed)} / {formatBytes(storageLimit)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${storagePercent}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          isStorageCritical ? 'bg-red-500' : storagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    {userRole === 'premium_corporate' && (
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 flex items-center gap-1">
                        <Eye size={10} /> Detaylı döküm için tıklayın
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-4">
                {/* Üyeler */}
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className={`p-4 rounded-xl border flex flex-col gap-3 hover:shadow-sm transition ${
                      member.role !== 'normal' && member.premium_seat_active === false
                        ? 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 grayscale opacity-70'
                        : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0 ${
                          member.role === 'premium_corporate'
                            ? 'bg-rose-600 text-white'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-950/30'
                        }`}>
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                          ) : (
                            member.full_name?.charAt(0) || <User size={20} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 dark:text-white flex flex-wrap items-center gap-2">
                            {member.full_name}
                            <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-semibold ${
                              member.role === 'premium_corporate'
                                ? 'bg-rose-50 text-rose-700 border-rose-250 font-bold'
                                : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900'
                            }`}>
                              {roleLabels[member.role] || member.role}
                            </span>
                            {member.role !== 'normal' && (
                              member.premium_seat_active === false ? (
                                <span className="text-[10px] px-2 py-0.5 rounded border uppercase bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-900 dark:border-slate-700 flex items-center gap-1">
                                  <XCircle size={11} /> Premium Yok
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded border uppercase bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 flex items-center gap-1">
                                  <Crown size={11} /> Premium
                                </span>
                              )
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                        </div>
                      </div>
                      
                      {userRole === 'premium_corporate' && member.id !== userId && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedPersonnelId(member.id)}
                            className="text-xs bg-slate-100 text-slate-600 p-2 rounded border border-slate-200 hover:bg-slate-200 transition dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                            title="Personel Kartı"
                          >
                            <User size={14} />
                          </button>
                          {member.role !== 'normal' && (
                            <button
                              onClick={() => handleQuickTogglePremium(member)}
                              className={`text-xs p-2 rounded border transition ${
                                member.premium_seat_active === false
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 dark:bg-slate-900 dark:border-slate-700'
                              }`}
                              title={member.premium_seat_active === false ? 'Premium Ver' : 'Premium Al'}
                            >
                              <Crown size={14} />
                            </button>
                          )}
                          {member.role !== 'premium_corporate' && (
                            <button
                              onClick={() => setPendingKickMember(member)}
                              className="text-xs bg-red-50 text-red-600 p-2 rounded border border-red-100 hover:bg-red-100 transition dark:bg-red-950/20 dark:border-red-900"
                              title="İşten Çıkar"
                            >
                              <LogOut size={14} />
                            </button>
                          )}
                        </div>
                      )}
                      {userRole !== 'premium_corporate' && member.id === userId && (
                        <button
                          onClick={() => {
                            setRoleChangeRequestTo(member.role === 'corporate_chief' ? 'corporate_staff' : 'corporate_chief');
                            setRoleChangeRequestReason('');
                            setShowRoleChangeRequestModal(true);
                          }}
                          className="text-xs bg-purple-50 text-purple-700 px-3 py-2 rounded border border-purple-200 hover:bg-purple-100 transition dark:bg-purple-950/20 dark:border-purple-900 dark:text-purple-400 font-bold"
                        >
                          Ünvan Değişikliği Talep Et
                        </button>
                      )}
                    </div>

                  </div>
                ))}

                {/* Bekleyen Davetler */}
                {userRole === 'premium_corporate' && invitations.map((i) => (
                  <div key={i.id} className="p-4 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20 flex justify-between items-center opacity-90">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 shadow-sm border dark:border-slate-700">
                        {i.email ? <Mail size={20} /> : <FileText size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-purple-900 dark:text-purple-300 text-sm">
                          {i.email ? i.email : 'Manuel Kod'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 font-mono tracking-wider">
                            {i.code}
                          </span>
                          <span className="text-[10px] text-purple-500 dark:text-purple-400">
                            {i.email ? '(E-posta Daveti)' : '(Manuel Kod)'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyCode(i.code)}
                        className="p-2 bg-white dark:bg-slate-800 rounded border hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
                        title="Kopyala"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(i.id)}
                        className="p-2 bg-white dark:bg-slate-800 rounded border hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500"
                        title="İptal Et"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {teamMembers.length <= 1 && (userRole !== 'premium_corporate' || invitations.length === 0) && (
                  <div className="text-center text-gray-400 dark:text-gray-500 py-8 italic">
                    Henüz ekip üyesi yok.
                  </div>
                )}
              </div>
            </div>

            {/* Davet Paneli (Sağ Kolon) */}
            {userRole === 'premium_corporate' && (
              <div className="space-y-6">
                {/* Kişi Bazlı Kota Kullanımı */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-gray-700 dark:text-white mb-3 flex items-center gap-2 text-sm">
                    <HardDrive size={16} /> Kişi Bazlı Kota Kullanımı
                  </h3>
                  {Object.keys(memberStorage).length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">Henüz belge yükleyen olmadı.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {teamMembers
                        .filter((m) => memberStorage[m.id])
                        .sort((a, b) => (memberStorage[b.id]?.bytes || 0) - (memberStorage[a.id]?.bytes || 0))
                        .map((m) => {
                          const usage = memberStorage[m.id];
                          const sharePercent = orgStorageUsed > 0 ? (usage.bytes / orgStorageUsed) * 100 : 0;
                          return (
                            <div key={m.id}>
                              <div className="flex justify-between items-center text-xs mb-0.5">
                                <span className="font-bold text-gray-600 dark:text-gray-300 truncate">{m.full_name || m.email}</span>
                                <span className="text-gray-400 dark:text-gray-500">{formatBytes(usage.bytes)} · {usage.count} belge</span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, sharePercent)}%` }}
                                  className="h-full rounded-full bg-blue-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* E-posta ile davet */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <Mail size={18} /> E-Posta ile Davet
                  </h3>
                  <form onSubmit={handleSendEmailInvite} className="space-y-2">
                    <input
                      type="email"
                      required
                      placeholder="personel@sirket.com"
                      className="w-full border p-2 rounded-lg text-sm outline-none focus:border-blue-500 dark:bg-slate-900 dark:border-slate-700"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button
                      disabled={sendingEmail}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {sendingEmail ? 'Gönderiliyor...' : 'Davet Gönder'}
                    </button>
                  </form>
                </div>

                {/* Manuel Kod */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-purple-800 dark:text-purple-400 mb-3 flex items-center gap-2">
                    <FileText size={18} /> Manuel Kod Üret
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Bu kodu personele verin. Personel "Ayarlar" sayfasından bu kodu girerek gruba katılabilir.
                  </p>
                  <button
                    onClick={handleCreateCode}
                    className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 transition"
                  >
                    Kod Oluştur
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {activeTab === 'departed' && !requiresFinanceHrReAuth && (
        <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <h3 className="font-bold text-gray-700 dark:text-white mb-1 flex items-center gap-2 text-lg">
              <LogOut className="text-rose-600" /> Ayrılan Personeller
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Bu kişiler artık ekibinizin bir parçası değil. "Geri Al" ile, gerçek işe başlangıç tarihini girerek tekrar ekibe ekleyebilirsiniz — ayrılış ile yeni başlangıç arasındaki aylara maaş gideri üretilmez.
            </p>
            {departedEmployees.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Ayrılan personel bulunmuyor.</p>
            ) : (
              <div className="space-y-2">
                {departedEmployees.map((d) => {
                  const months = d.hire_date
                    ? Math.max(0, Math.round((new Date(d.exit_date).getTime() - new Date(d.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
                    : null;
                  return (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs uppercase text-slate-500 shrink-0 overflow-hidden">
                          {d.profile?.avatar_url ? (
                            <img src={d.profile.avatar_url} alt={d.profile?.full_name} className="w-full h-full object-cover" />
                          ) : (
                            d.profile?.full_name?.charAt(0) || <User size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-700 dark:text-white text-sm truncate">{d.profile?.full_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {d.profile?.email}
                            {d.position ? ` — ${d.position}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0 space-y-1.5">
                        <div className="text-gray-500 dark:text-gray-400">
                          {d.hire_date ? new Date(d.hire_date).toLocaleDateString('tr-TR') : '?'} →{' '}
                          <span className="font-bold text-rose-600">{new Date(d.exit_date).toLocaleDateString('tr-TR')}</span>
                        </div>
                        {months != null && <div className="text-slate-400">{months} ay çalıştı</div>}
                        {userRole === 'premium_corporate' && (
                          <button
                            type="button"
                            onClick={() => setPendingReactivateMember(d)}
                            disabled={reactivatingEmployeeId === d.profile_id}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
                          >
                            {reactivatingEmployeeId === d.profile_id ? 'İşleniyor...' : 'Geri Al'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'org_chart' && !requiresFinanceHrReAuth && (() => {
        const owner = teamMembers.find((m) => m.role === 'premium_corporate');
        const chiefs = teamMembers.filter((m) => m.role === 'corporate_chief');
        const staff = teamMembers.filter((m) => m.role === 'corporate_staff');
        const canEditOrgChart = userRole === 'premium_corporate';
        const staffUnderChief = (chiefId: string) => staff.filter((s) => s.manager_id === chiefId);
        const unassignedStaff = staff.filter((s) => !s.manager_id || !chiefs.some((c) => c.id === s.manager_id));

        const AssignSelect = ({ member }: { member: any }) => (
          <select
            value={member.manager_id && chiefs.some((c) => c.id === member.manager_id) ? member.manager_id : ''}
            onChange={(e) => handleAssignManager(member.id, e.target.value || null)}
            disabled={savingManagerId === member.id}
            className="text-[10px] border rounded px-1 py-1 dark:bg-slate-900 dark:border-slate-700 disabled:opacity-50"
          >
            <option value="">Doğrudan Firma Sahibi</option>
            {chiefs.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        );

        return (
          <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4 mb-6">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Network size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">Organizasyon Şeması</h3>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
                    Ekibinizin hiyerarşik yapısını görüntüleyin{canEditOrgChart ? ' ve personeli şeflere atayın' : ''}.
                  </p>
                </div>
              </div>

              {owner && (
                <div className="flex justify-center mb-8">
                  <div className="px-5 py-3 rounded-xl bg-rose-600 text-white font-bold shadow-md flex items-center gap-2 text-sm">
                    <Crown size={16} /> {owner.full_name}
                    <span className="text-[10px] font-semibold opacity-80 uppercase">Firma Sahibi</span>
                  </div>
                </div>
              )}

              {chiefs.length === 0 ? (
                <div className="text-center text-xs text-gray-400 italic p-8 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                  Henüz bir şef/yönetici bulunmuyor. Ekip üyelerinden birine "Çevre Danışmanlık Firma Yöneticisi" ünvanı verildiğinde,
                  personeli o şefe bağlayabilirsiniz.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {chiefs.map((chief) => (
                    <div
                      key={chief.id}
                      className="border-2 border-purple-200 dark:border-purple-900 rounded-xl p-4 bg-purple-50/40 dark:bg-purple-950/10"
                    >
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-purple-200 dark:border-purple-900">
                        <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 overflow-hidden">
                          {chief.avatar_url ? (
                            <img src={chief.avatar_url} alt={chief.full_name} className="w-full h-full object-cover" />
                          ) : (
                            chief.full_name?.charAt(0) || <User size={16} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{chief.full_name}</div>
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold">Firma Yöneticisi (Şef)</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {staffUnderChief(chief.id).length === 0 && (
                          <div className="text-[11px] text-gray-400 italic p-2">Bu yöneticiye bağlı personel yok.</div>
                        )}
                        {staffUnderChief(chief.id).map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-100 dark:border-slate-700"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/30 flex items-center justify-center font-bold text-[10px] uppercase shrink-0 overflow-hidden">
                                {s.avatar_url ? (
                                  <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  s.full_name?.charAt(0) || <User size={12} />
                                )}
                              </div>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.full_name}</span>
                            </div>
                            {canEditOrgChart && <AssignSelect member={s} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unassignedStaff.length > 0 && (
                <div className="mt-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase">
                    Doğrudan Firma Sahibine Bağlı Personel
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {unassignedStaff.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg p-2 border border-gray-100 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/30 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                            {s.full_name?.charAt(0) || <User size={12} />}
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.full_name}</span>
                        </div>
                        {canEditOrgChart && chiefs.length > 0 && <AssignSelect member={s} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'definitions' && (
        <div className="space-y-6 animate-fadeIn pb-12">
          {/* Sub tabs configuration for Managers/Sahip */}
          {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && (
            <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 gap-2 mb-6">
              <button
                onClick={() => setDefSubTab('standard')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  defSubTab === 'standard'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Standart Tanımlamalar
              </button>
              <button
                onClick={() => setDefSubTab('required')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  defSubTab === 'required'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Zorunlu Belgeler Şablonu
              </button>
            </div>
          )}

          {/* Subtab Standard / Default (Also shown if corporate_staff) */}
          {(defSubTab === 'standard' || userRole === 'corporate_staff') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* BELGE TÜRLERİ */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Tag size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Belge Türleri</h2>
                    <p className="text-xs text-gray-400">Ekip üyeleri veya tüm ekip için belge türlerini yönetin</p>
                  </div>
                </div>

                {/* Yeni Belge Türü Ekle Formu (Only for managers) */}
                {userRole !== 'corporate_staff' && (
                  <div className="bg-gray-50 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-200/60 dark:border-slate-700/60 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Belge Türü Adı</label>
                        <input
                          type="text"
                          placeholder="Örn: Çevre İzin Belgesi, Atık Beyanı..."
                          value={newDefTypeLabel}
                          onChange={(e) => setNewDefTypeLabel(e.target.value)}
                          className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ekip Üyesi Seçimi</label>
                        <select
                          value={selectedDefTypeMemberId}
                          onChange={(e) => setSelectedDefTypeMemberId(e.target.value)}
                          className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        >
                          <option value="all">Tüm Ekip (Ortak Tanım)</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name} ({roleLabels[m.role] || m.role})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      disabled={savingDef}
                      onClick={handleAddTabDocType}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-100 dark:shadow-none"
                    >
                      {savingDef ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />} Belge Türü Ekle
                    </button>
                  </div>
                )}

                {/* Belge Türleri Listesi */}
                <div className="max-h-[350px] overflow-y-auto border border-gray-100 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700">
                  {defTabTypes.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 italic">Tanımlı belge türü bulunamadı.</div>
                  ) : (
                    defTabTypes.map((type) => (
                      <div key={type.id} className="p-3.5 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 transition group">
                        <div>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{type.label}</span>
                          <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <User size={10} /> Sahibi: {type.ownerName || 'Bilinmeyen'}
                          </div>
                        </div>
                        {userRole !== 'corporate_staff' && (
                          <button
                            onClick={() => handleDeleteTabDefinition(type.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* LOKASYON TANIMLARI / ATANAN İŞLETMELERİM */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
                {userRole === 'corporate_staff' ? (
                  <>
                    <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <Building size={22} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Atanan İşletmelerim</h2>
                        <p className="text-xs text-gray-400">Danışmanlık hizmeti vermekle görevlendirildiğiniz işletmeler</p>
                      </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto border border-gray-100 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700">
                      {clients.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400 italic">Atanmış işletmeniz bulunmamaktadır.</div>
                      ) : (
                        clients.map((c) => (
                          <div key={c.id} className="p-4 bg-gray-50/50 dark:bg-slate-900/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 transition">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.name}</span>
                                <div className="text-xs text-gray-400 mt-1 flex flex-col gap-1">
                                  <span>📍 {c.address || 'Adres belirtilmedi'}</span>
                                  <span>💳 Vergi No: {c.tax_no || 'Belirtilmedi'}</span>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 rounded-full">
                                Atandı
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <MapPin size={22} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Lokasyon & İşletme Tanımları</h2>
                        <p className="text-xs text-gray-400">Ekip üyeleri veya tüm ekip için lokasyonları yönetin</p>
                      </div>
                    </div>

                    {/* Yeni Lokasyon Ekle Formu */}
                    <div className="bg-gray-50 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-200/60 dark:border-slate-700/60 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lokasyon Adı</label>
                          <input
                            type="text"
                            placeholder="Örn: A Şubesi, Merkez Saha..."
                            value={newDefLocLabel}
                            onChange={(e) => setNewDefLocLabel(e.target.value)}
                            className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ekip Üyesi Seçimi</label>
                          <select
                            value={selectedDefMemberId}
                            onChange={(e) => setSelectedDefMemberId(e.target.value)}
                            className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          >
                            <option value="all">Tüm Ekip (Ortak Tanım)</option>
                            {teamMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.full_name} ({roleLabels[m.role] || m.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        disabled={savingDef}
                        onClick={handleAddTabLocation}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 dark:shadow-none"
                      >
                        {savingDef ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />} Lokasyon Ekle
                      </button>
                    </div>

                    {/* Lokasyonlar Listesi */}
                    <div className="max-h-[350px] overflow-y-auto border border-gray-100 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700">
                      {defTabLocs.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400 italic">Tanımlı lokasyon bulunamadı.</div>
                      ) : (
                        defTabLocs.map((loc) => {
                          const isBusiness = clientNames.some(
                            cName => cName && loc.label && cName.trim().toLowerCase() === loc.label.trim().toLowerCase()
                          );
                          return (
                            <div key={loc.id} className="p-3.5 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 transition group">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{loc.label}</span>
                                  {isBusiness && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                      İşletme
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                  <User size={10} /> Sahibi: {loc.ownerName || 'Bilinmeyen'}
                                </div>
                              </div>
                              {!isBusiness && (
                                <button
                                  onClick={() => handleDeleteTabDefinition(loc.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                  title="Sil"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Subtab Required Documents (Only for owners/chiefs) */}
          {userRole !== 'corporate_staff' && defSubTab === 'required' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* İşletme Seçim Paneli */}
              <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Building size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{userRole === 'premium_individual' ? 'Lokasyon Seçimi' : 'İşletme Seçimi'}</h2>
                    <p className="text-xs text-gray-400">{userRole === 'premium_individual' ? 'Hangi lokasyona zorunlu belge atayacağınızı seçin' : 'Hangi işletmeye zorunlu belge atayacağınızı seçin'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">{userRole === 'premium_individual' ? 'Lokasyon' : 'İşletme'}</label>
                  <select
                    value={selectedClientForReqDocs}
                    onChange={(e) => setSelectedClientForReqDocs(e.target.value)}
                    className="w-full p-3 border rounded-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white font-semibold"
                  >
                    <option value="">{userRole === 'premium_individual' ? '-- Lokasyon Seçin --' : '-- İşletme Seçin --'}</option>
                    <option value="all">{userRole === 'premium_individual' ? 'Tüm Lokasyonlar (Ortak Tanım)' : 'Tüm İşletmeler (Ortak Tanım)'}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Zorunlu Belgeler Seçim Listesi */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-xl">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Zorunlu Belge Listesi</h2>
                      <p className="text-xs text-gray-400">Seçilen kapsam için zorunlu kılınan belge türlerini işaretleyin</p>
                    </div>
                  </div>
                </div>

                {!selectedClientForReqDocs ? (
                  <div className="text-center py-12 text-sm text-gray-400 italic">
                    {userRole === 'premium_individual' ? 'Lütfen zorunlu belgeleri düzenlemek için sol panelden bir lokasyon seçin.' : 'Lütfen zorunlu belgeleri düzenlemek için sol panelden bir işletme seçin.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs font-semibold px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg">
                      Seçilen Hedef: <span className="font-bold">{selectedClientForReqDocs === 'all' ? (userRole === 'premium_individual' ? 'Tüm Lokasyonlar (Ortak Tanım)' : 'Tüm İşletmeler (Ortak Tanım)') : (clients.find(c => c.id === selectedClientForReqDocs)?.name || '')}</span>
                    </div>

                    <div className="border border-gray-100 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                      {defTabTypes.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400 italic">Henüz tanımlı belge türü bulunmamaktadır. Lütfen önce standart tanımlamalardan belge türü ekleyin.</div>
                      ) : (
                        defTabTypes.map((type) => {
                          let isChecked = false;
                          let isPartiallyChecked = false;

                          if (selectedClientForReqDocs === 'all') {
                            const count = requiredDocs.filter(rd => type.rowIds.includes(rd.type_def_id)).length;
                            isChecked = count === clients.length && clients.length > 0;
                            isPartiallyChecked = count > 0 && count < clients.length;
                          } else {
                            isChecked = requiredDocs.some(rd => rd.client_id === selectedClientForReqDocs && type.rowIds.includes(rd.type_def_id));
                          }

                          return (
                            <label
                              key={type.id}
                              className="flex items-center justify-between p-4 bg-gray-50/20 dark:bg-slate-900/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  ref={el => {
                                    if (el) {
                                      el.indeterminate = isPartiallyChecked;
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (selectedClientForReqDocs === 'all') {
                                      handleToggleRequiredDocAll(type, e.target.checked);
                                    } else {
                                      handleToggleRequiredDoc(selectedClientForReqDocs, type, e.target.checked);
                                    }
                                  }}
                                  className="w-4.5 h-4.5 text-indigo-600 bg-gray-150 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{type.label}</span>
                              </div>
                              {isPartiallyChecked && (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900 rounded-full">
                                  Bazı İşletmelerde
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {activeTab === 'document_matrix' && (
        renderDocumentMatrix()
      )}

      {/* EVRAK TALEPLERİ TAB */}
      {activeTab === 'document_requests' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
              <Inbox className="text-blue-600" size={22} /> Evrak Talepleri
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-medium">
              Hizmet verdiğiniz bir işletmeden serbest metinli bir belge talep edin (ör. "Güncel Mali Sigorta"). Talep, müşteri panelinde bildirim olarak görünür; müşteri belgeyi yükleyince burada karşılandı olarak işaretlenir ve indirebilirsiniz.
            </p>
            <form onSubmit={handleCreateDocumentRequest} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">İşletme *</label>
                <select
                  required
                  value={docReqClientId}
                  onChange={(e) => setDocReqClientId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- İşletme Seçin --</option>
                  {clients.filter((c: any) => !c.parent_client_id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Talep Başlığı *</label>
                <input
                  type="text"
                  required
                  placeholder="ör. Güncel Mali Sigorta"
                  value={docReqTitle}
                  onChange={(e) => setDocReqTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama</label>
                <input
                  type="text"
                  placeholder="Opsiyonel not"
                  value={docReqDesc}
                  onChange={(e) => setDocReqDesc(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={submittingDocReq}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md transition disabled:opacity-50 h-[38px]"
              >
                {submittingDocReq ? 'Gönderiliyor...' : 'Talep Oluştur'}
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-sm text-gray-700 dark:text-gray-200">Talep Listesi</h3>
              <div className="flex gap-1.5">
                {(['all', 'pending', 'fulfilled'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setDocReqStatusFilter(s)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                      docReqStatusFilter === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                    }`}
                  >
                    {s === 'all' ? 'Tümü' : s === 'pending' ? 'Bekliyor' : 'Karşılandı'}
                  </button>
                ))}
              </div>
            </div>

            {loadingDocRequests ? (
              <div className="py-10 text-center text-xs text-gray-400">Yükleniyor...</div>
            ) : (
              (() => {
                const filtered = documentRequests.filter((r) => docReqStatusFilter === 'all' || r.status === docReqStatusFilter);
                if (filtered.length === 0) {
                  return <div className="py-10 text-center text-xs text-gray-400 italic">Bu filtreye uyan evrak talebi yok.</div>;
                }
                return (
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filtered.map((r) => (
                      <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800 dark:text-white">{r.title}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                              r.status === 'fulfilled'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
                                : r.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:border-slate-700'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 animate-pulse'
                            }`}>
                              {r.status === 'fulfilled' ? 'Karşılandı' : r.status === 'cancelled' ? 'İptal' : 'Bekliyor'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <b className="text-gray-700 dark:text-gray-300">{r.client?.name}</b>
                            {r.description && <> · {r.description}</>}
                            {' '}· {new Date(r.created_at).toLocaleDateString('tr-TR')} · Talep eden: {r.requester?.full_name || '—'}
                          </div>
                          {r.status === 'fulfilled' && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                              {r.fulfiller?.full_name || 'Müşteri'} tarafından {r.fulfilled_at ? new Date(r.fulfilled_at).toLocaleDateString('tr-TR') : ''} tarihinde yüklendi.
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.status === 'fulfilled' && r.document?.file_url && (
                            <>
                              <a
                                href={r.document.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                <Download size={13} /> İndir
                              </a>
                              <button
                                onClick={() => handleDeleteFulfilledRequestDocument(r)}
                                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 dark:bg-red-950/20 dark:border-red-900 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                title="Belgeyi alıp inceledikten sonra silerek kotanızda yer açın"
                              >
                                <Trash2 size={13} /> Sil (Kota Boşalt)
                              </button>
                            </>
                          )}
                          {r.status === 'fulfilled' && !r.document?.file_url && (
                            <span className="text-[11px] text-gray-400 italic">Belge silinmiş (kota için)</span>
                          )}
                          {r.status === 'pending' && (
                            <button
                              onClick={() => handleCancelDocumentRequest(r.id)}
                              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 dark:bg-red-950/20 dark:border-red-900 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                            >
                              <XCircle size={13} /> İptal
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* MSDS/SDS TAKİBİ TAB */}
      {activeTab === 'msds' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FlaskConical className="text-teal-600" size={22} /> MSDS/SDS Takibi
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                Atandığınız işletmeler için toplu yüklenen Malzeme Güvenlik Bilgi Formlarının (MSDS/SDS) geçerlilik durumunu takip edin.
              </p>
            </div>
            <Link
              to="/consultant/msds/add"
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus size={16} /> Yeni Toplu MSDS Yükle
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['expired', 'approaching', 'valid', 'unknown'] as MsdsStatus[]).map((s) => {
              const count = msdsDocuments.filter(
                (m: any) => computeMsdsStatus(m.expiry_date, m.warning_threshold_days || 30) === s
              ).length;
              return (
                <div
                  key={s}
                  className={`rounded-xl border p-4 ${STATUS_BADGE_CLASSES_MSDS[s]}`}
                >
                  <div className="text-2xl font-black">{count}</div>
                  <div className="text-[11px] font-bold uppercase">{STATUS_LABELS_TR[s]}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={msdsClientFilter}
                  onChange={(e) => setMsdsClientFilter(e.target.value)}
                  className="p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-300"
                >
                  <option value="">Tüm İşletmeler</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  {(['all', 'expired', 'approaching', 'valid'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setMsdsStatusFilter(s)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                        msdsStatusFilter === s
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                      }`}
                    >
                      {s === 'all' ? 'Tümü' : STATUS_LABELS_TR[s]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleExportMsdsToExcel}
                disabled={msdsFilteredSorted.length === 0}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                <Download size={13} /> Excel'e Aktar
              </button>
            </div>

            {loadingMsds ? (
              <div className="py-10 text-center text-xs text-gray-400">Yükleniyor...</div>
            ) : msdsFilteredSorted.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 italic">Bu filtreye uyan MSDS/SDS kaydı yok.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase text-slate-500 dark:text-slate-400">
                      <th className="text-left px-4 py-2.5 font-bold">Firma</th>
                      <th className="text-left px-4 py-2.5 font-bold">Ürün Adı</th>
                      <th className="text-left px-4 py-2.5 font-bold">Ana Tarih</th>
                      <th className="text-left px-4 py-2.5 font-bold">Geçerlilik Bitiş</th>
                      <th className="text-left px-4 py-2.5 font-bold">Durum</th>
                      <th className="text-left px-4 py-2.5 font-bold">Kalan/Geçen Gün</th>
                      <th className="text-right px-4 py-2.5 font-bold">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {msdsFilteredSorted.map((m: any) => {
                      const status = computeMsdsStatus(m.expiry_date, m.warning_threshold_days || 30);
                      const days = computeDaysRemaining(m.expiry_date);
                      return (
                        <tr key={m.id}>
                          <td className="px-4 py-2.5 font-bold text-gray-700 dark:text-gray-200">{m.client?.name || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{m.product_name || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                            {m.primary_date || '—'}
                            {m.primary_date_source_label && (
                              <span className="text-[10px] text-gray-400 block">{m.primary_date_source_label}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{m.expiry_date || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${STATUS_BADGE_CLASSES_MSDS[status]}`}>
                              {STATUS_LABELS_TR[status]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                            {days === null ? '—' : days >= 0 ? `${days} gün kaldı` : `${Math.abs(days)} gün geçti`}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {m.file_url && (
                                <a
                                  href={m.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Dosyayı İncele"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              <button
                                onClick={() => handleStartEditMsds(m)}
                                title="Düzenle / Yenile"
                                className="flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 dark:hover:bg-teal-900/50 px-2 py-1 rounded-lg transition"
                              >
                                <Edit2 size={13} /> Düzenle
                              </button>
                              <button
                                onClick={() => handleDeleteMsds(m)}
                                title="Sil"
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MSDS DÜZENLEME & YENİLEME MODALI */}
          {editingMsds && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 max-w-lg w-full overflow-hidden p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-700 pb-3">
                  <h3 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <FlaskConical className="text-teal-600" size={20} /> MSDS Düzenle / Yenile
                  </h3>
                  <button
                    onClick={() => setEditingMsds(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Ürün Adı</label>
                    <input
                      type="text"
                      value={msdsEditProductName}
                      onChange={(e) => setMsdsEditProductName(e.target.value)}
                      placeholder="Örn. Solvent Bazlı Astar"
                      className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Ana Tarih (Yayın/Revizyon)</label>
                      <input
                        type="date"
                        value={msdsEditPrimaryDate}
                        onChange={(e) => setMsdsEditPrimaryDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Geçerlilik Süresi (Yıl)</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={msdsEditValidityYears}
                        onChange={(e) => setMsdsEditValidityYears(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  {/* Yeni Dosya Yükleme / Revizyon */}
                  <div className="border border-dashed border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 p-3.5 rounded-xl space-y-2">
                    <label className="block font-bold text-teal-800 dark:text-teal-300">
                      Yeni MSDS PDF Dosyası Yükle (Revizyon/Yenileme)
                    </label>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Ürünün yeni versiyon MSDS belgesi geldiyse PDF dosyasını seçerek dosya ve tarihleri otomatik yenileyebilirsiniz.
                    </p>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleMsdsFileSelect(e.target.files[0]);
                        }
                      }}
                      className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                    />
                    {msdsParsing && (
                      <div className="flex items-center gap-1.5 text-teal-600 text-xs font-medium pt-1">
                        <Loader size={14} className="animate-spin" /> Yeni PDF ayrıştırılıyor ve veriler okunuyor...
                      </div>
                    )}
                    {msdsEditFile && !msdsParsing && (
                      <div className="text-[11px] text-emerald-600 font-bold pt-1 flex items-center gap-1">
                        <CheckCircle size={13} /> Seçilen yeni dosya: {msdsEditFile.name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700 pt-3">
                  <button
                    onClick={() => setEditingMsds(null)}
                    className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold transition text-xs"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveMsdsEdit}
                    disabled={msdsSaving || msdsParsing}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold transition text-xs shadow-sm disabled:opacity-50"
                  >
                    {msdsSaving ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />} Güncelle & Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GÖRÜŞLER TAB */}
      {activeTab === 'opinions' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <PenLine className="text-purple-600" size={22} /> Görüşler
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                Firmanın tüm görüş taslaklarını (önceki dönemler dahil) işletme ve yıla göre filtreleyerek inceleyebilirsiniz.
              </p>
            </div>
            {isPremiumActive ? (
              <Link
                to="/consultant/opinions/add"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus size={16} /> Yeni Görüş Hazırla
              </Link>
            ) : (
              <Link
                to="/pricing"
                title="Görüş hazırlamak için premium paketinizi yenilemeniz gerekiyor"
                className="bg-gray-300 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <Lock size={14} /> Yeni Görüş Hazırla (Premium Gerekli)
              </Link>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={opinionsFilterClientId}
                onChange={(e) => setOpinionsFilterClientId(e.target.value)}
                className="p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="">Tüm İşletmeler</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={opinionsFilterYear}
                onChange={(e) => setOpinionsFilterYear(e.target.value)}
                className="p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none text-[11px] font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="">Tüm Yıllar</option>
                {Array.from(new Set(opinionLetters.map((l) => new Date(l.letter_date).getFullYear())))
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
              </select>
            </div>

            {(() => {
              const filteredOpinions = opinionLetters.filter((l) => {
                if (opinionsFilterClientId && l.client_id !== opinionsFilterClientId) return false;
                if (opinionsFilterYear && String(new Date(l.letter_date).getFullYear()) !== opinionsFilterYear) return false;
                return true;
              });

              if (loadingOpinions) {
                return (
                  <div className="flex justify-center items-center py-16 text-xs text-gray-500 gap-2">
                    <Loader className="animate-spin" size={16} /> Görüşler yükleniyor...
                  </div>
                );
              }
              if (filteredOpinions.length === 0) {
                return <p className="text-center py-12 text-xs text-gray-400 italic">Filtreye uygun görüş bulunamadı.</p>;
              }

              return (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredOpinions.map((letter) => {
                  const statusLabel = letter.status === 'approved' ? 'Onaylandı' : letter.status === 'rejected' ? 'Reddedildi' : 'Onay Bekliyor';
                  const statusColor = letter.status === 'approved'
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400'
                    : letter.status === 'rejected'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400';
                  return (
                    <div key={letter.id} className="py-4 flex justify-between items-center gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{letter.subject}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${statusColor}`}>{statusLabel}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          İşletme: <b>{letter.client?.name}</b> · Kurum: <b>{letter.institution_name}</b>
                          {letter.status !== 'rejected' && letter.sequence_no && (
                            <> · Sayı: <b>{new Date(letter.letter_date).getFullYear()}-{String(letter.sequence_no).padStart(2, '0')}</b></>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">
                          Hazırlayan: {letter.creator?.full_name || 'Bilinmeyen'} · Tarih: {new Date(letter.letter_date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/consultant/opinions/${letter.id}`}
                          className="text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-purple-200 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                        >
                          Görüntüle
                        </Link>
                        {(isManager || letter.created_by === userId) && (
                          <button
                            onClick={() => handleDeleteOpinion(letter.id)}
                            className="text-red-500 hover:text-red-700 cursor-pointer transition p-1.5"
                            title="Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* LEGISLATIONS TAB */}
      {activeTab === 'legislations' && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Scale className="text-teal-600" /> Mevzuat Takip
              </h2>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                Yönetmelik ve kanunları inceleyin, hizmet verdiğiniz işletmelere atama yapın ve maddeleri özelleştirin.
              </p>
            </div>
            {legSubTab === 'pool' && userRole !== 'premium_corporate' && userRole !== 'premium_individual' && (
              <button
                onClick={() => {
                  setSelectedReqClientId('');
                  setSelectedReqRegulationId('');
                  setRequestTitle('');
                  setRequestDescription('');
                  setShowAddRequestModal(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
              >
                <PlusCircle size={16} /> Yöneticimden Mevzuat Talep Et
              </button>
            )}
          </div>

          {/* Alt Sekmeler Menüsü */}
          <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-700 gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setLegSubTab('pool')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                legSubTab === 'pool'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <BookOpen size={14} /> Mevzuat Havuzu (Sistem & Firma)
            </button>
            {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual' || userRole === 'admin') && (
              <button
                onClick={() => setLegSubTab('assignments')}
                className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                  legSubTab === 'assignments'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
                }`}
              >
                <Building size={14} /> İşletme Atamaları
              </button>
            )}
            <button
              onClick={() => {
                setLegSubTab('tracking');
                setSelectedClientForLegTracking(null);
                setSelectedClientRegulation(null);
                setSelectedClientRegulationArticles([]);
              }}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                legSubTab === 'tracking'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <Scale size={14} /> Mevzuat Takip
            </button>
            <button
              onClick={() => setLegSubTab('calendar')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                legSubTab === 'calendar'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <Calendar size={14} /> Ziyaret Takvimi
            </button>
          </div>

          <div className="animate-fadeIn">
            {/* 1. SEKME: MEVZUAT HAVUZU */}
            {legSubTab === 'pool' && (
              <div className={`grid grid-cols-1 gap-6 ${userRole === 'corporate_staff' ? '' : 'lg:grid-cols-2'}`}>
                {/* Sistem Mevzuat Havuzu - admin genel havuzu, personelden gizli */}
                {userRole !== 'corporate_staff' && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2 border-b pb-2 border-gray-100 dark:border-slate-700">
                    <BookOpen size={18} className="text-blue-600" />
                    Sistem Mevzuat Havuzu (Admin Yüklemeleri)
                  </h3>
                  
                  <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto pr-1">
                    {allGlobalRegulations.length === 0 ? (
                      <p className="text-center py-6 text-xs text-gray-400 italic">
                        Sistem havuzunda henüz mevzuat bulunmuyor.
                      </p>
                    ) : (
                      allGlobalRegulations.map(leg => {
                        const isImported = assignedGlobalLegislations.some(al => al.id === leg.id);
                        return (
                          <div key={leg.id} className="py-3.5 flex justify-between items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border border-blue-100 dark:border-blue-900">
                                  {leg.category}
                                </span>
                                <span className="font-bold text-sm text-gray-800 dark:text-gray-250">{leg.title}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-1">
                                {leg.rg_no && <span className="mr-2">RG No: <b>{leg.rg_no}</b></span>}
                                {leg.rg_date && <span>RG Tarihi: <b>{new Date(leg.rg_date).toLocaleDateString()}</b></span>}
                              </div>
                            </div>
                            <div>
                              {isImported ? (
                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-bold bg-green-50 dark:bg-green-950/20 px-2.5 py-1.5 rounded-lg border border-green-200 dark:border-green-900">
                                  <Check size={14} /> Havuzumuzda
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleImportGlobalRegulation(leg.id)}
                                  disabled={importingLegId === leg.id}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow disabled:opacity-50 whitespace-nowrap"
                                >
                                  {importingLegId === leg.id ? 'Ekleniyor...' : 'Firmamıza Ekle'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                )}

                {/* Firma Mevzuat Havuzu */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                      <BookOpen size={18} className="text-teal-600" />
                      Firma Mevzuat Havuzu (Bizim Havuzumuz)
                    </h3>
                    <button
                      onClick={() => {
                        setLegTitle('');
                        setLegCategory('Yönetmelik');
                        setLegPubDate('');
                        setLegEffDate('');
                        setLegRgNo('');
                        setLegRgDate('');
                        setLegArticles([]);
                        setPasteText('');
                        setParsingTextMode(false);
                        setShowAddCustomLegModal(true);
                      }}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition shadow-sm"
                    >
                      <Plus size={10} />
                      {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') ? 'Özel Mevzuat Ekle' : 'Mevzuat Talebi Oluştur (Yeni Mevzuat)'}
                    </button>
                  </div>

                  {/* Yönetici/şef için onay bekleyen (personel tarafından eklenen) özel mevzuatlar */}
                  {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && pendingCompanyLegislations.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 space-y-2">
                      <h4 className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                        ⚠️ Onay Bekleyen Özel Mevzuatlar ({pendingCompanyLegislations.length})
                      </h4>
                      {pendingCompanyLegislations.map((cl: any) => (
                        <div key={cl.id} className="flex justify-between items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                          <div>
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{cl.regulation?.title}</div>
                            <div className="text-[10px] text-gray-400">Ekleyen: <b>{cl.submitter?.full_name || 'Personel'}</b></div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              disabled={reviewingLegId === cl.id}
                              onClick={() => handleReviewPendingLegislation(cl.id, true, cl.regulation_id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                            >
                              Onayla
                            </button>
                            <button
                              disabled={reviewingLegId === cl.id}
                              onClick={() => handleReviewPendingLegislation(cl.id, false, cl.regulation_id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition border border-red-200 disabled:opacity-50"
                            >
                              Reddet
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto pr-1">
                    {assignedGlobalLegislations.length === 0 ? (
                      <p className="text-center py-6 text-xs text-gray-400 italic">
                        Firmanıza tanımlanmış global mevzuat bulunmuyor. Sistem havuzundan ekleme yapabilirsiniz.
                      </p>
                    ) : (
                      assignedGlobalLegislations.map(leg => (
                        <div key={leg.id} className="py-3.5 flex justify-between items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border border-teal-100 dark:border-teal-900">
                                {leg.category}
                              </span>
                              <span className="font-bold text-sm text-gray-800 dark:text-gray-250">{leg.title}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1">
                              {leg.rg_no && <span className="mr-2">RG No: <b>{leg.rg_no}</b></span>}
                              {leg.rg_date && <span>RG Tarihi: <b>{new Date(leg.rg_date).toLocaleDateString()}</b></span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(userRole === 'premium_corporate' || userRole === 'premium_individual' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients)) && (
                              <>
                                <button
                                  onClick={() => {
                                    setAssigningGlobalLeg(leg);
                                    setSelectedClientIdForLeg('');
                                    setSelectedStaffIdForLeg('');
                                    setShowAssignClientLegModal(true);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow whitespace-nowrap"
                                >
                                  İşletmeye Ata
                                </button>
                                <button
                                  onClick={() => handleRemoveRegulationFromCompany(leg.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400 whitespace-nowrap"
                                >
                                  Havuzdan Çıkar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {legSubTab === 'assignments' && (
              <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between gap-4 border-b pb-2 border-gray-150 dark:border-slate-700 flex-wrap">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                      <Building size={18} className="text-blue-600" />
                      İşletmelere Atanan Mevzuatlar
                    </h3>
                    <select
                      value={legFilterClientId}
                      onChange={(e) => setLegFilterClientId(e.target.value)}
                      className="p-1.5 rounded-lg border bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-xs font-semibold text-slate-700 dark:text-slate-350 max-w-[200px]"
                    >
                      <option value="">Tüm İşletmeler (Filtrele)</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      {selfTrackingClient && (
                        <option value={selfTrackingClient.id}>👤 Kendim İçin</option>
                      )}
                    </select>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto pr-1">
                    {(() => {
                      const filteredClientRegulations = legFilterClientId
                        ? clientRegulations.filter(cr => cr.client_id === legFilterClientId)
                        : clientRegulations;

                      if (filteredClientRegulations.length === 0) {
                        return (
                          <p className="text-center py-6 text-xs text-gray-400 italic">
                            Seçili filtreye veya kriterlere uygun atanan mevzuat bulunamadı.
                          </p>
                        );
                      }

                      return filteredClientRegulations.map(cr => (
                        <div key={cr.id} className="py-3.5 flex justify-between items-center gap-4 animate-fadeIn">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-850 dark:text-gray-200">{cr.title}</span>
                              <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border border-teal-100 dark:border-teal-900">
                                {cr.client_id === selfTrackingClient?.id ? '👤 Kendim İçin' : (cr.client?.name || 'Bilinmeyen İşletme')}
                              </span>
                            </div>
                            {cr.description && (
                              <p className="text-xs text-gray-450 dark:text-gray-500 mt-1">{cr.description}</p>
                            )}
                            <div className="text-[10px] text-gray-400 mt-1">
                              Atanma Tarihi: <b>{new Date(cr.created_at).toLocaleDateString()}</b>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(userRole === 'premium_corporate' || userRole === 'premium_individual' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients)) && (
                              <button
                                onClick={() => handleRemoveClientRegulation(cr.id, cr.title)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400"
                              >
                                Kaldır
                              </button>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* 4. SEKME: MEVZUAT TAKİP (PERSONEL / FİRMA BAZLI) */}
            {legSubTab === 'tracking' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Kolon: Hizmet Verilen İşletmeler */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-250 text-sm flex items-center gap-2 border-b pb-2 border-gray-100 dark:border-slate-700">
                    <Building size={16} className="text-teal-600" />
                    Hizmet Verilen İşletmeler
                  </h3>
                  
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {clients.length === 0 && !selfTrackingClient ? (
                      <p className="text-center py-6 text-xs text-gray-400 italic">
                        Atanmış işletmeniz bulunmuyor.
                      </p>
                    ) : (
                      <>
                      {clients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedClientForLegTracking(c);
                            setSelectedClientRegulation(null);
                            setSelectedClientRegulationArticles([]);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                            selectedClientForLegTracking?.id === c.id
                              ? 'bg-teal-50/50 border-teal-500 dark:bg-teal-950/20 text-teal-800 dark:text-teal-400 font-bold shadow-sm'
                              : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/50 dark:bg-slate-900/30 dark:border-slate-800 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-350'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {c.logo_url ? (
                              <img src={c.logo_url} alt="Logo" className="w-8 h-8 rounded object-contain bg-white border" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-gray-200 dark:bg-slate-800 flex items-center justify-center text-gray-400">
                                <Building size={14} />
                              </div>
                            )}
                            <span className="text-xs truncate max-w-[150px]">{c.name}</span>
                          </div>
                          <ChevronRight size={14} className={selectedClientForLegTracking?.id === c.id ? 'text-teal-600' : 'text-gray-400'} />
                        </button>
                      ))}
                      {selfTrackingClient && (
                        <button
                          key={selfTrackingClient.id}
                          onClick={() => {
                            setSelectedClientForLegTracking(selfTrackingClient);
                            setSelectedClientRegulation(null);
                            setSelectedClientRegulationArticles([]);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                            selectedClientForLegTracking?.id === selfTrackingClient.id
                              ? 'bg-teal-50/50 border-teal-500 dark:bg-teal-950/20 text-teal-800 dark:text-teal-400 font-bold shadow-sm'
                              : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/50 dark:bg-slate-900/30 dark:border-slate-800 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-350'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-500">
                              <User size={14} />
                            </div>
                            <span className="text-xs truncate max-w-[150px] font-bold">Kendim İçin</span>
                          </div>
                          <ChevronRight size={14} className={selectedClientForLegTracking?.id === selfTrackingClient.id ? 'text-teal-600' : 'text-gray-400'} />
                        </button>
                      )}
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Kolon: Seçili İşletmenin Mevzuatları */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-250 text-sm flex items-center gap-2 border-b pb-2 border-gray-100 dark:border-slate-700">
                    <BookOpen size={16} className="text-teal-600" />
                    İşletme Mevzuatları
                  </h3>

                  {!selectedClientForLegTracking ? (
                    <div className="p-8 text-center text-xs text-gray-400 italic">
                      Mevzuatları listelemek için lütfen sol panelden bir işletme seçin.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {(() => {
                        const regs = clientRegulations.filter(r => r.client_id === selectedClientForLegTracking.id);
                        if (regs.length === 0) {
                          return (
                            <p className="text-center py-6 text-xs text-gray-400 italic">
                              Bu işletmeye atanmış mevzuat bulunmuyor.
                            </p>
                          );
                        }
                        return regs.map((cr) => (
                          <button
                            key={cr.id}
                            onClick={() => fetchClientRegulationArticles(cr)}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                              selectedClientRegulation?.id === cr.id
                                ? 'bg-teal-50/50 border-teal-500 dark:bg-teal-950/20 text-teal-850 dark:text-teal-400 font-bold shadow-sm'
                                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/50 dark:bg-slate-900/30 dark:border-slate-800 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-355'
                            }`}
                          >
                            <div className="text-xs line-clamp-2 leading-relaxed">{cr.title}</div>
                            <div className="text-[10px] text-gray-400">Atanma: {new Date(cr.created_at).toLocaleDateString()}</div>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Kolon: Seçili Mevzuatın Maddeleri & Uyum Durumu */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-gray-105 dark:border-slate-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-250 text-sm flex items-center gap-2">
                      <Scale size={16} className="text-teal-600" />
                      Maddeler & Uyum
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedClientRegulation && (userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && (
                        <button
                          type="button"
                          onClick={handleRequestNotesForSelectedArticles}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition shadow-sm cursor-pointer"
                          title="Seçilen tüm maddeler için tek bir aksiyon oluştur"
                        >
                          📌 Seçilenler İçin Aksiyon Aç ({selectedArticleIdsForAction.length})
                        </button>
                      )}
                      {selectedClientRegulation && (userRole === 'premium_corporate' || userRole === 'premium_individual' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewArtNo('');
                            setNewArtTitle('');
                            setNewArtContent('');
                            setShowAddClientArticleModal(true);
                          }}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition shadow-sm cursor-pointer"
                        >
                          <Plus size={10} /> Madde Ekle
                        </button>
                      )}
                    </div>
                  </div>

                  {!selectedClientRegulation ? (
                    <div className="p-8 text-center text-xs text-gray-400 italic">
                      Maddeleri görmek ve uyum durumlarını yönetmek için ortadaki listeden bir mevzuat seçin.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750 flex flex-col gap-2">
                        <div>
                          <div className="text-slate-400 uppercase tracking-wide">Seçili Mevzuat:</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{selectedClientRegulation.title}</div>
                        </div>
                        <div className="pt-2 border-t border-slate-200/20 dark:border-slate-700 flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Madde Filtresi:</label>
                          <select
                            value={articleFilter}
                            onChange={(e) => setArticleFilter(e.target.value)}
                            className="p-1 rounded-lg border bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-[10px] font-bold text-slate-700 dark:text-slate-350"
                          >
                            <option value="all">Tüm Maddeler</option>
                            <option value="missing_notes">Mevcut Durumu Eksik</option>
                            <option value="requested">Talep Edilenler</option>
                            <option value="compliant">Uyum: Uygun</option>
                            <option value="non_compliant">Uyum: Uygun Değil</option>
                            <option value="exempt">Uyum: Hariç Tutulanlar</option>
                          </select>
                        </div>
                      </div>

                      {loadingLegArticles ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader className="animate-spin text-teal-600" size={24} />
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                          {(() => {
                            const filtered = selectedClientRegulationArticles.filter((art) => {
                              if (articleFilter === 'missing_notes') {
                                return !art.current_status_notes || !art.current_status_notes.trim();
                              }
                              if (articleFilter === 'requested') {
                                return art.current_status_requested === true;
                              }
                              if (articleFilter === 'compliant') {
                                return art.is_mandatory && art.compliance_status === 'compliant';
                              }
                              if (articleFilter === 'non_compliant') {
                                return art.is_mandatory && art.compliance_status === 'non_compliant';
                              }
                              if (articleFilter === 'exempt') {
                                return !art.is_mandatory;
                              }
                              return true;
                            });

                            if (filtered.length === 0) {
                              return (
                                <p className="text-center text-xs text-gray-400 italic py-6">
                                  Filtreye uygun madde bulunamadı.
                                </p>
                              );
                            }

                            return filtered.map((art) => (
                              <div
                                key={art.id}
                                className={`p-4 rounded-xl border transition shadow-sm bg-white dark:bg-slate-800 ${getStatusStyles(art)}`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && (
                                        <input
                                          type="checkbox"
                                          checked={selectedArticleIdsForAction.includes(art.id)}
                                          onChange={() => handleToggleArticleForAction(art.id)}
                                          title="Aksiyon açmak için seç"
                                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      )}
                                      <div className="font-bold text-xs text-slate-755 dark:text-slate-200">
                                        {art.article_no} {art.title ? `- ${art.title}` : ''}
                                      </div>
                                      {(userRole === 'premium_corporate' || userRole === 'premium_individual' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients)) && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedArticleForEdit(art);
                                              setNewArtNo(art.article_no || '');
                                              setNewArtTitle(art.title || '');
                                              setNewArtContent(art.content || '');
                                              setShowEditClientArticleModal(true);
                                            }}
                                            className="text-blue-500 hover:text-blue-700 transition cursor-pointer"
                                            title="Düzenle"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteClientArticle(art.id)}
                                            className="text-red-500 hover:text-red-700 transition cursor-pointer"
                                            title="Sil"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {art.updater?.full_name && (
                                      <div className="text-[10px] text-slate-500 mt-1">
                                        Son Güncelleyen: <b>{art.updater.full_name}</b>
                                      </div>
                                    )}

                                    {art.is_mandatory && (
                                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                        <span>Geçerlilik Süresi:</span>
                                        <span className="font-extrabold text-teal-650 dark:text-teal-400">
                                          {art.expiry_date ? new Date(art.expiry_date).toLocaleDateString('tr-TR') : 'Süresiz'}
                                        </span>
                                        {art.expiry_date && art.expiry_date < new Date().toISOString().split('T')[0] && (
                                          <span className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-200 uppercase animate-pulse">
                                            Süresi Geçti!
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {art.current_status_requested && (
                                      <div className="mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                        ⚠️ Mevcut Durum Notu Girişi Talep Edildi
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-col md:flex-row gap-2 shrink-0 items-center md:items-center w-full md:w-auto justify-end">
                                    {art.is_mandatory ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleUpdateArticleCompliance(art.id, 'compliant')}
                                          className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-200 shadow-sm ${
                                            art.compliance_status === 'compliant'
                                              ? 'bg-emerald-600 border-transparent text-white shadow-emerald-600/10'
                                              : 'bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/20 hover:border-emerald-200'
                                          }`}
                                        >
                                          <CheckCircle size={12} />
                                          Uygun
                                        </button>
                                        <button
                                          onClick={() => handleUpdateArticleCompliance(art.id, 'non_compliant')}
                                          className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-200 shadow-sm ${
                                            art.compliance_status === 'non_compliant'
                                              ? 'bg-rose-600 border-transparent text-white shadow-rose-600/10'
                                              : 'bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50/20 hover:border-rose-200'
                                          }`}
                                        >
                                          <AlertCircle size={12} />
                                          Uygun Değil
                                        </button>
                                        <button
                                          onClick={() => handleToggleArticleMandatory(art.id, art.is_mandatory)}
                                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-purple-600 hover:bg-purple-50/30 hover:border-purple-200 transition-all duration-200"
                                        >
                                          Hariç Tut
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-250/50 dark:border-slate-800">
                                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold px-2 py-0.5 rounded-lg">Hariç Tutuldu (Muaf)</span>
                                        <button
                                          onClick={() => handleToggleArticleMandatory(art.id, art.is_mandatory)}
                                          className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-1 shadow-sm shadow-purple-600/20"
                                        >
                                          <Plus size={12} />
                                          Aktif Yap
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap mt-2">{art.content}</p>

                                {/* Aksiyon durumu: kısa gösterge - detaylar & sonuç sadece Aksiyon Takip sekmesinde */}
                                {art.is_mandatory && (() => {
                                  const artAction = articleActions.find((a: any) => a.article_id === art.id || (Array.isArray(a.article_ids) && a.article_ids.includes(art.id)));
                                  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual';

                                  if (artAction) {
                                    return (
                                      <div className="pt-2.5 mt-2 border-t border-gray-150 dark:border-slate-850 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                            artAction.status === 'pending'
                                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                                              : artAction.status === 'completed'
                                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400'
                                              : artAction.status === 'correction_requested'
                                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400'
                                              : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400'
                                          }`}>
                                            {artAction.status === 'pending' && 'Aksiyon Bekliyor'}
                                            {artAction.status === 'completed' && 'Onay Bekliyor'}
                                            {artAction.status === 'correction_requested' && 'Düzeltme İstendi'}
                                            {artAction.status === 'approved' && 'Onaylandı'}
                                          </span>
                                          <span className="text-[10px] text-gray-500 font-medium">
                                            Son Tarih: <b>{new Date(artAction.due_date).toLocaleDateString('tr-TR')}</b>
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionsFilterClient(selectedClientRegulation?.client_id || '');
                                            setActiveTab('actions');
                                          }}
                                          className="text-[10px] font-bold text-teal-650 hover:underline"
                                        >
                                          Aksiyon Takip'te Görüntüle →
                                        </button>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="pt-2 mt-2 border-t border-gray-150 dark:border-slate-800 flex gap-2 justify-end">
                                        {isManager ? (
                                          <button
                                            onClick={() => handleRequestArticleNotes(art)}
                                            className="text-[9px] font-bold text-teal-650 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:text-teal-400 border border-teal-200 dark:border-teal-900/50 px-2 py-1 rounded cursor-pointer"
                                          >
                                            Durum Girişi Talep Et
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleOpenActionForArticle(art)}
                                            className="text-[9px] font-bold text-teal-650 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:text-teal-400 border border-teal-200 dark:border-teal-900/50 px-2 py-1 rounded cursor-pointer"
                                          >
                                            Durum Bildir
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* 3. SEKME: ZİYARET TAKVİMİ */}
            {legSubTab === 'calendar' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Takvim Üst Kontrolleri */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (visitCalendarMonth === 0) {
                          setVisitCalendarMonth(11);
                          setVisitCalendarYear(prev => prev - 1);
                        } else {
                          setVisitCalendarMonth(prev => prev - 1);
                        }
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition"
                    >
                      &larr; Önceki Ay
                    </button>
                    <span className="font-bold text-base text-slate-800 dark:text-slate-100 min-w-[120px] text-center capitalize">
                      {new Date(visitCalendarYear, visitCalendarMonth).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (visitCalendarMonth === 11) {
                          setVisitCalendarMonth(0);
                          setVisitCalendarYear(prev => prev + 1);
                        } else {
                          setVisitCalendarMonth(prev => prev + 1);
                        }
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition"
                    >
                      Sonraki Ay &rarr;
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    {/* Görünüm Değiştirici */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setVisitCalendarView('calendar')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                          visitCalendarView === 'calendar'
                            ? 'bg-white dark:bg-slate-800 text-teal-650 dark:text-teal-400 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                      >
                        Takvim Görünümü
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisitCalendarView('list')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                          visitCalendarView === 'list'
                            ? 'bg-white dark:bg-slate-800 text-teal-650 dark:text-teal-400 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                        }`}
                      >
                        Liste Görünümü
                      </button>
                    </div>

                    {isManager ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewVisit({ client_id: '', personnel_id: '', visit_date: '', notes: '' });
                          setShowAddVisitModal(true);
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm ml-auto md:ml-0"
                      >
                        <PlusCircle size={15} /> Yeni Ziyaret Planla
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNewVisit({ client_id: '', personnel_id: userId, visit_date: '', notes: '' });
                          setShowAddVisitModal(true);
                        }}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm ml-auto md:ml-0"
                      >
                        <PlusCircle size={15} /> Ziyaret Talep Et
                      </button>
                    )}
                  </div>
                </div>

                {/* Yeni Ziyaret Talepleri (Yalnızca Yöneticilere) */}
                {isManager && visitSchedules.some(v => v.status === 'requested') && (
                  <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50 p-6 rounded-xl space-y-4 animate-fadeIn mb-6">
                    <h3 className="font-bold text-teal-850 dark:text-teal-400 text-sm flex items-center gap-2">
                      <AlertCircle size={18} className="text-teal-650" /> Bekleyen Yeni Ziyaret Talepleri
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visitSchedules
                        .filter(v => v.status === 'requested')
                        .map(visit => (
                          <div key={visit.id} className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-teal-100 dark:border-teal-900/30 shadow-sm flex flex-col justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{visit.client?.name}</span>
                                <span className="text-[10px] bg-teal-100 text-teal-850 dark:bg-teal-950 dark:text-teal-300 font-bold px-2 py-0.5 rounded">Yeni Ziyaret Talebi</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                Talep Eden: <b>{visit.personnel?.full_name || 'Personel'}</b>
                              </p>
                              <div className="text-xs pt-1">
                                Talep Edilen Tarih: <b className="text-teal-650 dark:text-teal-400">{new Date(visit.visit_date).toLocaleDateString('tr-TR')}</b>
                              </div>
                              {visit.notes && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded italic mt-1.5 border border-slate-100 dark:border-slate-800">
                                  &ldquo;{visit.notes}&rdquo;
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 justify-end pt-2 border-t border-dashed border-gray-150 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => handleRejectNewVisit(visit.id)}
                                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                Reddet
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApproveNewVisit(visit.id)}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                Onayla ve Planla
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Değişiklik Talepleri (Yalnızca Yöneticilere) */}
                {isManager && visitSchedules.some(v => v.change_request_status === 'pending') && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-amber-800 dark:text-amber-400 text-sm flex items-center gap-2">
                      <AlertCircle size={18} /> Bekleyen Ziyaret Değişiklik Talepleri
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visitSchedules
                        .filter(v => v.change_request_status === 'pending')
                        .map(visit => (
                          <div key={visit.id} className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm flex flex-col justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{visit.client?.name}</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold px-2 py-0.5 rounded">Talep Beklemede</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                Talep Eden: <b>{visit.personnel?.full_name}</b>
                              </p>
                              <div className="text-xs pt-1">
                                Planlanan: <b className="text-slate-650 dark:text-slate-350">{new Date(visit.visit_date).toLocaleDateString('tr-TR')}</b>
                              </div>
                              <div className="text-xs">
                                Talep Edilen Tarih: <b className="text-teal-650 dark:text-teal-400">{new Date(visit.change_request_date!).toLocaleDateString('tr-TR')}</b>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded italic mt-1.5 border border-slate-100 dark:border-slate-800">
                                &ldquo;{visit.change_request_reason}&rdquo;
                              </p>
                            </div>
                            <div className="flex gap-2 justify-end pt-2 border-t border-dashed border-gray-150 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => handleProcessChangeRequest(visit.id, false)}
                                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                Reddet
                              </button>
                              <button
                                type="button"
                                onClick={() => handleProcessChangeRequest(visit.id, true)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                Onayla ve Güncelle
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* YÜKLENİYOR DURUMU */}
                {loadingVisits ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
                    <Loader className="animate-spin text-teal-600" size={32} />
                    <span className="text-sm font-medium">Ziyaret takvimi yükleniyor...</span>
                  </div>
                ) : (
                  <>
                    {/* TAKVİM GÖRÜNÜMÜ */}
                    {visitCalendarView === 'calendar' && (() => {
                      const firstDayOfMonth = new Date(visitCalendarYear, visitCalendarMonth, 1).getDay();
                      const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                      const daysInMonth = new Date(visitCalendarYear, visitCalendarMonth + 1, 0).getDate();
                      const gridCells = [];
                      
                      const prevMonthDate = new Date(visitCalendarYear, visitCalendarMonth, 0);
                      const prevMonthDays = prevMonthDate.getDate();
                      for (let i = startOffset - 1; i >= 0; i--) {
                        gridCells.push({
                          day: prevMonthDays - i,
                          isCurrentMonth: false,
                          dateStr: `${visitCalendarYear}-${String(visitCalendarMonth === 0 ? 12 : visitCalendarMonth).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`
                        });
                      }

                      for (let i = 1; i <= daysInMonth; i++) {
                        const monthStr = String(visitCalendarMonth + 1).padStart(2, '0');
                        const dayStr = String(i).padStart(2, '0');
                        gridCells.push({
                          day: i,
                          isCurrentMonth: true,
                          dateStr: `${visitCalendarYear}-${monthStr}-${dayStr}`
                        });
                      }

                      const remainingCells = 42 - gridCells.length;
                      for (let i = 1; i <= remainingCells; i++) {
                        gridCells.push({
                          day: i,
                          isCurrentMonth: false,
                          dateStr: `${visitCalendarYear}-${String(visitCalendarMonth === 11 ? 1 : visitCalendarMonth + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`
                        });
                      }

                      const weekDays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
                      
                      return (
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            {weekDays.map(d => (
                              <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {d}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-slate-800 bg-slate-50/20">
                            {gridCells.map((cell, idx) => {
                              const cellVisits = visitSchedules.filter(v => v.visit_date === cell.dateStr);
                              const todayStr = new Date().toISOString().split('T')[0];
                              const isToday = cell.dateStr === todayStr;

                              return (
                                <div
                                  key={idx}
                                  className={`min-h-[120px] p-2 space-y-1 transition duration-150 relative ${
                                    cell.isCurrentMonth
                                      ? 'bg-white dark:bg-slate-850'
                                      : 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-400 dark:text-slate-650'
                                  } ${isToday ? 'ring-2 ring-inset ring-teal-500 dark:ring-teal-400/50 bg-teal-50/10 dark:bg-teal-950/10' : ''}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${
                                      isToday 
                                        ? 'bg-teal-600 text-white' 
                                        : cell.isCurrentMonth 
                                          ? 'text-slate-800 dark:text-slate-200' 
                                          : 'text-slate-400 dark:text-slate-600'
                                    }`}>
                                      {cell.day}
                                    </span>
                                    {isToday && (
                                      <span className="text-[9px] uppercase tracking-wide text-teal-600 dark:text-teal-400 font-bold">Bugün</span>
                                    )}
                                  </div>

                                  <div className="space-y-1.5 overflow-y-auto max-h-[85px] scrollbar-thin">
                                    {cellVisits.map(visit => {
                                      const isPending = visit.change_request_status === 'pending';
                                      const isDone = visit.status === 'completed';
                                      const isCancelled = visit.status === 'cancelled';
                                      
                                      let statusColor = 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50';
                                      if (isPending) statusColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50';
                                      if (isDone) statusColor = 'bg-green-50 text-green-700 border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50';
                                      if (isCancelled) statusColor = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800';

                                      return (
                                        <div
                                          key={visit.id}
                                          onClick={() => {
                                            setSelectedVisit(visit);
                                            setChangeRequest({ requested_date: '', reason: '' });
                                          }}
                                          className={`p-1.5 rounded-lg border text-[10px] font-bold cursor-pointer hover:shadow-sm transition ${statusColor} line-clamp-2`}
                                          title={`${visit.client?.name} (${visit.personnel?.full_name})`}
                                        >
                                          <div className="line-clamp-1">{visit.client?.name}</div>
                                          {visit.personnel?.full_name && (
                                            <div className="text-[8px] opacity-75 font-normal line-clamp-1">Talep Eden: {visit.personnel.full_name}</div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* LİSTE GÖRÜNÜMÜ */}
                    {visitCalendarView === 'list' && (() => {
                      const filteredVisits = visitSchedules.filter(v => {
                        const d = new Date(v.visit_date);
                        return d.getFullYear() === visitCalendarYear && d.getMonth() === visitCalendarMonth;
                      });

                      return (
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
                                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih</th>
                                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">İşletme</th>
                                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Talep Eden</th>
                                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Açıklama/Notlar</th>
                                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Durum</th>
                                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">İşlemler</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {filteredVisits.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-xs text-gray-400 italic">
                                      Bu ay için planlanmış herhangi bir ziyaret bulunmuyor.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredVisits.map(visit => {
                                    const isPending = visit.change_request_status === 'pending';
                                    return (
                                      <tr key={visit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 text-xs">
                                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                          {new Date(visit.visit_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                                        </td>
                                        <td className="p-4 font-bold text-teal-650 dark:text-teal-400">
                                          {visit.client?.name}
                                        </td>
                                        <td className="p-4 font-medium text-slate-700 dark:text-slate-355">
                                          {visit.personnel?.full_name || '-'}
                                        </td>
                                        <td className="p-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={visit.notes}>
                                          {visit.notes || '-'}
                                        </td>
                                        <td className="p-4 space-y-1">
                                          <div className="flex gap-2 items-center flex-wrap">
                                            {visit.status === 'completed' ? (
                                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-150 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50 uppercase">Tamamlandı</span>
                                            ) : visit.status === 'cancelled' ? (
                                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-650 border border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800 uppercase">İptal Edildi</span>
                                            ) : (
                                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-150 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50 uppercase">Planlandı</span>
                                            )}
                                            {isPending && (
                                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 uppercase animate-pulse">Talep Var</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-4 text-right">
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedVisit(visit);
                                                setChangeRequest({ requested_date: '', reason: '' });
                                              }}
                                              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                                            >
                                              Detay
                                            </button>
                                            {isManager && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteVisit(visit.id)}
                                                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 px-2 py-1 rounded-md text-xs font-bold text-red-650 dark:text-red-400 transition"
                                                title="Ziyareti Sil"
                                              >
                                                Sil
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* GÖNDERİLEN MEVZUAT TALEPLERİ */}
      {activeTab === 'requests' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                <Bell className="text-teal-600" size={24} /> Gönderilen Mevzuat Talepleri
              </h2>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400 font-medium">
                Firma içinden yöneticinize iletilen mevzuat ve güncelleme taleplerini buradan inceleyebilirsiniz.
              </p>
            </div>
            {userRole !== 'premium_corporate' && userRole !== 'premium_individual' && (
              <button
                onClick={() => {
                  setSelectedReqClientId('');
                  setSelectedReqRegulationId('');
                  setRequestTitle('');
                  setRequestDescription('');
                  setShowAddRequestModal(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <PlusCircle size={16} /> Yöneticimden Mevzuat Talep Et
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
            <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto pr-1">
              {staffRequests.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400 italic">
                  Henüz iletilmiş bir mevzuat talebi bulunmuyor.
                </p>
              ) : (
                staffRequests.map((req) => (
                  <div key={req.id} className="py-4 flex justify-between items-start gap-4 animate-fadeIn">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-850 dark:text-gray-200">{req.title}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                          req.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                            : req.status === 'approved'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900'
                        }`}>
                          {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                        </span>
                        <span className="text-[10px] text-gray-450 dark:text-gray-500 bg-gray-50 dark:bg-slate-900/50 px-2 py-0.5 rounded border border-gray-150 dark:border-slate-750">
                          {req.request_type === 'owner_to_admin' ? 'Admin Talebi' : 'Firma İçi Talep'}
                        </span>
                        {req.draft_regulation && (
                          <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/20 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-900">
                            📄 Tam Mevzuat Metni Ekli ({req.draft_regulation.articles?.length || 0} madde)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{req.description}</p>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-3 pt-1">
                        <span>Talep Eden: <b>{req.requester?.full_name || 'Bilinmeyen'} ({req.requester?.email})</b></span>
                        {req.client?.name && <span>İşletme: <b>{req.client.name}</b></span>}
                        {req.target_regulation?.title && <span>İlgili Mevzuat: <b>{req.target_regulation.title}</b></span>}
                        <span>Tarih: <b>{new Date(req.created_at).toLocaleDateString()}</b></span>
                      </div>
                      {req.admin_notes && (
                        <div className="text-xs bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-150 dark:border-slate-750 text-slate-750 dark:text-slate-300 mt-2">
                          <b>Not:</b> {req.admin_notes}
                        </div>
                      )}
                    </div>
                    {(req.status === 'pending' || req.draft_regulation) && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setReviewingRequest(req);
                            setReviewResponseNote('');
                          }}
                          className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Eye size={12} /> İncele{req.status === 'pending' && (userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') ? ' ve Cevapla' : ''}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. SEKME: AKSİYON TAKİP SİSTEMİ */}
      {activeTab === 'actions' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & New Action Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                <CheckCircle className="text-teal-600" size={24} /> Aksiyon Takip Sistemi
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                Mevzuat maddelerine ait mevcut durum taleplerini ve genel firma aksiyonlarını buradan takip edebilirsiniz.
              </p>
            </div>
            {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && (
              <button
                onClick={() => {
                  setNewActionTitle('');
                  setNewActionDesc('');
                  setNewActionClientId('');
                  setNewActionAssigneeId(userRole === 'premium_individual' ? userId : '');
                  setReqNotesAssigneeId('');
                  setReqNotesDueDate('');
                  setReqNotesArticleId('');
                  setPendingActionArticleIds([]);
                  setShowCreateActionModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 whitespace-nowrap self-stretch sm:self-auto justify-center"
              >
                <Plus size={16} /> Yeni Aksiyon Oluştur
              </button>
            )}
          </div>

          {/* Bekleyen / Tamamlanan Sekmeleri */}
          <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-700 gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActionsSubTab('pending')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                actionsSubTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <Clock size={14} /> Bekleyen Aksiyonlar
            </button>
            <button
              onClick={() => setActionsSubTab('completed')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                actionsSubTab === 'completed'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <CheckCircle size={14} /> Tamamlanan Aksiyonlar
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Müşteri Firma</label>
              <select
                className="w-full p-2 text-xs rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none border-slate-200"
                value={actionsFilterClient}
                onChange={(e) => setActionsFilterClient(e.target.value)}
              >
                <option value="">Tüm Firmalar</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Sorumlu Personel</label>
              <select
                className="w-full p-2 text-xs rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none border-slate-200"
                value={actionsFilterAssignee}
                onChange={(e) => setActionsFilterAssignee(e.target.value)}
              >
                <option value="">Tüm Personel</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Durum</label>
              <select
                className="w-full p-2 text-xs rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none border-slate-200"
                value={actionsFilterStatus}
                onChange={(e) => setActionsFilterStatus(e.target.value)}
              >
                <option value="">Tüm Durumlar</option>
                <option value="pending">Aksiyon Bekliyor (Açık)</option>
                <option value="completed">Onay Bekliyor</option>
                <option value="correction_requested">Düzeltme İstendi</option>
                <option value="approved">Onaylandı</option>
              </select>
            </div>
          </div>

          {/* Actions List Grid */}
          {loadingActions ? (
            <div className="flex items-center justify-center p-12">
              <Loader className="animate-spin text-teal-600" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(() => {
                const filtered = complianceActions.filter((act) => {
                  if (actionsFilterClient && act.client_id !== actionsFilterClient) return false;
                  if (actionsFilterAssignee && act.assigned_to !== actionsFilterAssignee) return false;
                  if (actionsFilterStatus && act.status !== actionsFilterStatus) return false;
                  return true;
                });

                const activeList = filtered.filter((act) =>
                  actionsSubTab === 'pending' ? act.status !== 'approved' : act.status === 'approved'
                );

                if (activeList.length === 0) {
                  return (
                    <div className="md:col-span-2 bg-white dark:bg-slate-800 p-12 rounded-2xl border border-gray-200 dark:border-slate-700 text-center text-gray-500">
                      <CheckCircle className="mx-auto mb-3 opacity-20" size={48} />
                      <p className="font-bold">
                        {actionsSubTab === 'pending' ? 'Bekleyen aksiyon bulunmuyor.' : 'Tamamlanan aksiyon bulunmuyor.'}
                      </p>
                    </div>
                  );
                }

                return activeList.map((act) => {
                  const isAssignee = act.assigned_to === userId;
                  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual';
                  const isCreator = act.created_by === userId;
                  
                  return (
                    <div
                      key={act.id}
                      className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition relative overflow-hidden"
                    >
                      {/* Top info and status badge */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-wider">
                              {act.client?.name || 'Bilinmeyen Firma'}
                            </span>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                              {act.title}
                            </h3>
                          </div>
                          
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                            act.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20'
                              : act.status === 'completed'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20'
                              : act.status === 'correction_requested'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20'
                              : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20'
                          }`}>
                            {act.status === 'pending' ? 'Bekliyor' :
                             act.status === 'completed' ? 'Onay Bekliyor' :
                             act.status === 'correction_requested' ? 'Düzeltme İstendi' : 'Onaylandı'}
                          </span>
                        </div>

                        {/* Article link indicator if applicable */}
                        {act.article_id && (
                          <div className="text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-350 px-2 py-1 rounded w-fit font-bold">
                            📋 Mevzuat Maddesi Bağlantılı
                          </div>
                        )}

                        {/* Assigned client-portal email indicator */}
                        {act.assigned_client_email && (
                          <div className="text-[10px] bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/40 px-2 py-1 rounded w-fit font-bold">
                            📧 Müşteri Panelinde Görünür: {act.assigned_client_email}
                          </div>
                        )}

                        {/* Correction Comment */}
                        {act.status === 'correction_requested' && act.manager_comment && (
                          <div className="bg-rose-50/50 dark:bg-rose-950/10 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-350">
                            <div className="font-bold text-[9px] uppercase tracking-wide mb-0.5">Düzeltme Gerekçesi:</div>
                            <p className="italic">{act.manager_comment}</p>
                          </div>
                        )}

                        {/* Staff Notes and Document Submission */}
                        {(act.status === 'completed' || act.status === 'approved' || act.notes) && (
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Personel Açıklaması</div>
                            <p className="text-slate-750 dark:text-slate-350 whitespace-pre-wrap">{act.notes}</p>
                            {act.evidence_url && (
                              <div className="pt-2 mt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-bold">Yüklenen Belge:</span>
                                <a
                                  href={act.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline font-bold"
                                >
                                  Belgeyi Gör ↗
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom action bar & metadata */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 space-y-0.5">
                          <div>Sorumlu: <b>{act.assignee?.full_name || (act.assigned_to ? 'Bilinmeyen' : '🏢 Tüm Ekip / Firma Geneli')}</b></div>
                          <div>Atayan: <b>{act.creator?.full_name || 'Yönetici'}</b></div>
                          <div>Son Gün: <b className={act.status !== 'approved' && new Date(act.due_date) < new Date() ? 'text-red-500 font-bold' : ''}>{new Date(act.due_date).toLocaleDateString('tr-TR')}</b></div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedActionDetails(act);
                              setShowDetailsModal(true);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg transition hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            Detay
                          </button>

                          {(act.status === 'pending' || act.status === 'correction_requested') && isAssignee && (
                            <button
                              onClick={() => {
                                setSelectedClientAction(act);
                                setActionNotes(act.notes || '');
                                setActionEvidenceFile(null);
                                setShowCompleteActionModal(true);
                              }}
                              className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                            >
                              {act.status === 'correction_requested' ? 'Düzelt ve Tamamla' : 'Aksiyonu Tamamla'}
                            </button>
                          )}

                          {act.status === 'completed' && (isManager || isCreator) && (
                            <>
                              <button
                                onClick={() => handleApproveAction(act)}
                                className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                              >
                                Onayla
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedClientAction(act);
                                  setCorrectionDueDate(act.due_date || '');
                                  setCorrectionComment('');
                                  setShowCorrectionModal(true);
                                }}
                                className="border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                              >
                                Düzeltme İste
                              </button>
                            </>
                          )}

                          {(isManager || isCreator) && (
                            <button
                              onClick={() => handleDeleteAction(act.id, (act.article_ids && act.article_ids.length > 0) ? act.article_ids : (act.article_id ? [act.article_id] : null))}
                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* --- HİZMETİ SONLANDIRILAN FİRMALAR TAB PANELİ --- */}
      {activeTab === 'terminated_clients' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
              <XCircle className="text-rose-600" size={22} /> Hizmeti Sonlandırılan Firmalar
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Bu firmalarla hizmet ilişkisi sonlandırılmıştır (salt görüntüleme). Sonlandırma tarihinden sonrası için ödeme/alacak kaydı oluşturulmaz. Yeniden hizmet vermeye başlamak için "Yeniden Aktif Et"i kullanın.
            </p>
          </div>

          {loadingTerminatedClients ? (
            <div className="py-10 text-center text-xs text-gray-400">Yükleniyor...</div>
          ) : terminatedClients.length === 0 ? (
            <div className="py-14 text-center text-xs text-gray-400 italic bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl">
              Hizmeti sonlandırılan bir firma yok.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {terminatedClients.map((client) => {
                const lastPeriod = servicePeriods
                  .filter((p) => p.client_id === client.id)
                  .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0];
                return (
                  <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-800 dark:text-slate-200">{client.name}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">
                        Sonlandırıldı
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 space-y-0.5">
                      <div>Hizmet Başlangıcı: <b className="text-gray-700 dark:text-slate-300">{client.service_start_date ? new Date(client.service_start_date).toLocaleDateString('tr-TR') : '-'}</b></div>
                      <div>Sonlandırma Tarihi: <b className="text-rose-600 dark:text-rose-400">{client.service_terminated_at ? new Date(client.service_terminated_at).toLocaleDateString('tr-TR') : '-'}</b></div>
                      {lastPeriod && (
                        <div>Son Dönem Ücreti: <b className="text-gray-700 dark:text-slate-300">{Number(lastPeriod.monthly_fee).toLocaleString('tr-TR')} TL/ay</b></div>
                      )}
                    </div>
                    {canViewFinance && (
                      <button
                        type="button"
                        onClick={() => handleReactivateClient(client.id)}
                        disabled={reactivatingClientId === client.id}
                        className="mt-2 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
                      >
                        {reactivatingClientId === client.id ? 'İşleniyor...' : 'Yeniden Aktif Et'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- ATIK YÖNETİMİ TAB PANELİ --- */}
      {activeTab === 'waste' && (
        <div className="animate-fadeIn">
          <WasteManagement />
        </div>
      )}

      {/* --- SAHA QR DENETİMLERİ TAB PANELİ --- */}
      {activeTab === 'inspections' && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <QrCode className="text-teal-600" /> Saha QR Denetimleri
              </h2>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                Tesis noktalarına QR kodları tanımlayın ve tesis personeli tarafından doldurulan formları periyodik takip edin.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewInsFormTitle('');
                  setNewInsFormDesc('');
                  setNewInsFormClientId('');
                  setNewInsFormQuestions([{ question_text: '', question_type: 'yes_no', is_required: true }]);
                  setShowCreateInspectionFormModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
              >
                <PlusCircle size={16} /> Yeni Form Tasarla
              </button>
              <button
                onClick={() => {
                  setNewInsPointName('');
                  setNewInsPointLocation('');
                  setNewInsPointFormId('');
                  setShowCreateInspectionPointModal(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
              >
                <PlusCircle size={16} /> Yeni Nokta & QR Tanımla
              </button>
            </div>
          </div>

          <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-700 gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setInspectionsSubTab('points')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                inspectionsSubTab === 'points'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <MapPin size={14} /> Denetim Noktaları & QR Kodlar ({inspectionPoints.length})
            </button>
            <button
              onClick={() => setInspectionsSubTab('forms')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                inspectionsSubTab === 'forms'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <FileText size={14} /> Form Şablonları ({inspectionForms.length})
            </button>
            <button
              onClick={() => setInspectionsSubTab('analytics')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                inspectionsSubTab === 'analytics'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <PieChart size={14} /> Analiz & Raporlama
            </button>
          </div>

          {loadingInspections ? (
            <div className="flex items-center justify-center p-12">
              <Loader className="animate-spin text-teal-600" size={32} />
            </div>
          ) : (
            <div className="animate-fadeIn">
              {/* POINTS TAB */}
              {inspectionsSubTab === 'points' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşletme</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nokta Adı</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lokasyon / Açıklama</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanılan Form</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">QR Kod</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Denetimler</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {inspectionPoints.map((point) => (
                          <tr key={point.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                            <td className="p-4 text-sm font-medium text-gray-900 dark:text-white">
                              {point.form?.client?.name || '-'}
                            </td>
                            <td className="p-4 text-sm font-semibold text-teal-600 dark:text-teal-400">
                              {point.name}
                            </td>
                            <td className="p-4 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                              {point.location_description || <span className="italic text-gray-300">Belirtilmemiş</span>}
                            </td>
                            <td className="p-4 text-sm text-gray-700 dark:text-gray-300">
                              {point.form?.title || '-'}
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleGenerateQr(point)}
                                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-655 p-2 rounded-lg text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 text-xs font-bold transition"
                                title="QR Kodu Yazdır"
                              >
                                <QrCode size={14} /> Yazdır / Görüntüle
                              </button>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleViewSubmissions(point)}
                                className="bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:hover:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-teal-200 dark:border-teal-900 inline-flex items-center gap-1 transition"
                              >
                                <Eye size={12} /> Yanıtları Gör
                              </button>
                            </td>
                            <td className="p-4 text-sm">
                              <button
                                onClick={() => handleDeletePoint(point.id)}
                                className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition inline-flex"
                                title="Noktayı Sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {inspectionPoints.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-500 italic text-xs">
                              Kayıtlı denetim noktası bulunmamaktadır. Sağ üstten yeni bir nokta tanımlayabilirsiniz.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* FORMS TAB */}
              {inspectionsSubTab === 'forms' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşletme</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Form Başlığı</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                          <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {inspectionForms.map((form) => (
                          <tr key={form.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                            <td className="p-4 text-sm font-medium text-gray-900 dark:text-white">
                              {form.client?.name || '-'}
                            </td>
                            <td className="p-4 text-sm font-bold text-gray-800 dark:text-gray-200">
                              {form.title}
                            </td>
                            <td className="p-4 text-xs text-gray-500 dark:text-gray-400 max-w-[250px] truncate">
                              {form.description || <span className="italic text-gray-300">Açıklama yok</span>}
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleToggleFormActive(form.id, form.is_active)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                                  form.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                              >
                                {form.is_active ? 'Aktif' : 'Pasif'}
                              </button>
                            </td>
                            <td className="p-4 text-xs text-gray-500">
                              {new Date(form.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="p-4 text-sm">
                              <button
                                onClick={() => handleDeleteForm(form.id)}
                                className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition inline-flex"
                                title="Formu Sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {inspectionForms.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500 italic text-xs">
                              Kayıtlı denetim formu bulunmamaktadır. Sağ üstten yeni bir form şablonu tasarlayabilirsiniz.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ANALYTICS TAB */}
              {inspectionsSubTab === 'analytics' && (
                <InspectionAnalytics inspectionForms={inspectionForms} supabase={supabase} />
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'evaluations' && !requiresFinanceHrReAuth && ['premium_corporate', 'corporate_chief', 'admin', 'system_admin'].includes(userRole) && (
        <EvaluationPanel />
      )}

      {/* ==========================================
         FINANCE & COSTS TABS RENDER
         ========================================== */}
      {activeTab === 'finance_summary' && canViewFinance && !requiresFinanceHrReAuth && (
        <div className="space-y-6">
          {/* Top-level Finance Dashboard Cards */}
          {(() => {
            const totalCollected = financePayments
              .filter(p => p.is_paid)
              .reduce((sum, p) => sum + Number(p.amount), 0);

            // Hak edilen gelir artık her ay için var olan client_payments
            // satırlarının (dönem ücretine göre otomatik üretilmiş, bkz.
            // generate_missing_client_payments) toplamıdır - canlı monthly_fee
            // ile geçmişe dönük yeniden hesaplanmaz. Hizmeti sonlandırılan
            // firmalar da dahildir - sonlandırma tarihine kadarki ödenmemiş
            // alacakları hâlâ gerçek bir borç, gözden kaybolmamalı.
            const visibleClientIds = new Set([...clients, ...terminatedClients].map((c) => c.id));
            const totalExpected = financePayments
              .filter((p) => visibleClientIds.has(p.client_id))
              .reduce((sum, p) => sum + Number(p.amount), 0);

            const totalUnpaid = Math.max(0, totalExpected - totalCollected);
            const totalExpenses = financeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
            const netProfit = totalCollected - totalExpenses;
            
            return (
              <div className="space-y-6 animate-fadeIn">
                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Tahsil Edilen</span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-450 block mt-1">
                        {totalCollected.toLocaleString('tr-TR')} TL
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5 block">Ödenen faturalar toplamı</span>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 p-3 rounded-2xl">
                      <CheckCircle size={24} />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bekleyen Tahsilat</span>
                      <span className="text-xl font-black text-amber-600 dark:text-amber-400 block mt-1">
                        {totalUnpaid.toLocaleString('tr-TR')} TL
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5 block">Vadesi gelen ödenmemiş toplam</span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 p-3 rounded-2xl">
                      <Clock size={24} />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Giderler</span>
                      <span className="text-xl font-black text-rose-600 dark:text-rose-455 block mt-1">
                        {totalExpenses.toLocaleString('tr-TR')} TL
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5 block">Girilen tüm şirket giderleri</span>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 p-3 rounded-2xl">
                      <Trash2 size={24} />
                    </div>
                  </div>

                  <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between ${
                    netProfit >= 0 ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'
                  }`}>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Kar / Zarar</span>
                      <span className={`text-xl font-black block mt-1 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-400'}`}>
                        {netProfit.toLocaleString('tr-TR')} TL
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5 block">Tahsil edilen - Giderler</span>
                    </div>
                    <div className={`p-3 rounded-2xl ${netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600'}`}>
                      <PieChart size={24} />
                    </div>
                  </div>
                </div>

                {/* Monthly Financial Breakdown */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-750 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <PieChart className="text-blue-600" size={18} /> Aylık Finansal Özet Tablosu
                  </h3>

                  <div className="mb-4">{renderFinancePeriodSelector()}</div>

                  {loadingFinance ? (
                    <div className="flex justify-center py-12">
                      <Loader className="animate-spin text-blue-600" size={24} />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-150 dark:border-slate-750 text-slate-400 font-bold uppercase tracking-wider">
                            <th className="pb-3 font-bold">Dönem (Ay / Yıl)</th>
                            <th className="pb-3 font-bold">Hak Edilen Gelir</th>
                            <th className="pb-3 font-bold">Tahsil Edilen (Ödenen)</th>
                            <th className="pb-3 font-bold">Bekleyen Tahsilat</th>
                            <th className="pb-3 font-bold">Aylık Giderler</th>
                            <th className="pb-3 font-bold">Net Durum</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-750/30 text-slate-700 dark:text-slate-300 font-medium">
                          {(() => {
                            const monthsList: { year: number, month: number, label: string }[] = [];
                            if (financePeriodType === 'monthly') {
                              const [y, m] = financeSelectedMonth.split('-').map(Number);
                              const d = new Date(y, m - 1, 1);
                              monthsList.push({ year: y, month: m, label: d.toLocaleString('tr-TR', { month: 'long', year: 'numeric' }) });
                            } else if (financePeriodType === 'yearly') {
                              const y = parseInt(financeSelectedYear);
                              for (let m = 12; m >= 1; m--) {
                                const d = new Date(y, m - 1, 1);
                                monthsList.push({ year: y, month: m, label: d.toLocaleString('tr-TR', { month: 'long', year: 'numeric' }) });
                              }
                            } else {
                              // Tümü: son 12 ay (varsayılan davranış korunuyor)
                              const dateCursor = new Date();
                              for (let i = 0; i < 12; i++) {
                                monthsList.push({
                                  year: dateCursor.getFullYear(),
                                  month: dateCursor.getMonth() + 1,
                                  label: dateCursor.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })
                                });
                                dateCursor.setMonth(dateCursor.getMonth() - 1);
                              }
                            }

                            // Hizmeti sonlandırılan firmalar da dahil - sonlandırma
                            // tarihine kadarki ödenmemiş alacakları gerçek bir borç.
                            const allClientsForMonths = [...clients, ...terminatedClients];
                            const visibleClientIdsForMonths = new Set(allClientsForMonths.map((c) => c.id));
                            const clientNameById = new Map(allClientsForMonths.map((c) => [c.id, c.name]));

                            return monthsList.map(item => {
                              // Hak edilen gelir artık o ay için var olan
                              // client_payments satırlarının toplamı - dönem
                              // ücretine göre otomatik üretildiği için canlı
                              // monthly_fee'yi geçmişe dönük uygulamaz.
                              const paymentsInMonth = financePayments.filter(
                                p => visibleClientIdsForMonths.has(p.client_id) && p.year === item.year && p.month === item.month
                              );
                              const expectedInMonth = paymentsInMonth.reduce((sum, p) => sum + Number(p.amount), 0);

                              const collectedInMonth = paymentsInMonth
                                .filter(p => p.is_paid)
                                .reduce((sum, p) => sum + Number(p.amount), 0);

                              const unpaidInMonth = Math.max(0, expectedInMonth - collectedInMonth);

                              // Bu ay için hangi firmaların tahsilatı bekliyor -
                              // ay detayı açılınca gösterilir.
                              const pendingFirmsInMonth = paymentsInMonth
                                .filter(p => !p.is_paid && Number(p.amount) > 0)
                                .map(p => ({
                                  clientId: p.client_id,
                                  name: clientNameById.get(p.client_id) || 'Bilinmeyen Firma',
                                  amount: Number(p.amount),
                                  isTerminated: terminatedClients.some((c) => c.id === p.client_id),
                                }))
                                .sort((a, b) => b.amount - a.amount);

                              const collectedFirmsInMonth = paymentsInMonth
                                .filter(p => p.is_paid)
                                .map(p => ({
                                  clientId: p.client_id,
                                  name: clientNameById.get(p.client_id) || 'Bilinmeyen Firma',
                                  amount: Number(p.amount),
                                  isTerminated: terminatedClients.some((c) => c.id === p.client_id),
                                }))
                                .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

                              const expensesInMonth = financeExpenses
                                .filter(e => {
                                  const d = new Date(e.expense_date);
                                  return d.getFullYear() === item.year && (d.getMonth() + 1) === item.month;
                                })
                                .reduce((sum, e) => sum + Number(e.amount), 0);

                              const netInMonth = collectedInMonth - expensesInMonth;

                              if (expectedInMonth === 0 && expensesInMonth === 0) return null;

                              const monthKey = `${item.year}-${item.month}`;
                              const isMonthExpanded = expandedSummaryMonth === monthKey;

                              const monthExpenses = financeExpenses.filter((e) => {
                                const d = new Date(e.expense_date);
                                return d.getFullYear() === item.year && (d.getMonth() + 1) === item.month;
                              });
                              const categoryBreakdown: { category: string; total: number; count: number }[] = [];
                              monthExpenses.forEach((e) => {
                                const cat = e.category || 'Diğer';
                                const row = categoryBreakdown.find((r) => r.category === cat);
                                if (row) {
                                  row.total += Number(e.amount);
                                  row.count += 1;
                                } else {
                                  categoryBreakdown.push({ category: cat, total: Number(e.amount), count: 1 });
                                }
                              });
                              categoryBreakdown.sort((a, b) => b.total - a.total);

                              return (
                                <React.Fragment key={monthKey}>
                                  <tr
                                    onClick={() => {
                                      setExpandedSummaryMonth(isMonthExpanded ? null : monthKey);
                                      setExpandedSummaryCategory(null);
                                    }}
                                    className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer"
                                  >
                                    <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">
                                      <div className="flex items-center gap-1.5">
                                        {isMonthExpanded ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                                        {item.label}
                                      </div>
                                    </td>
                                    <td className="py-3.5 text-slate-600">{expectedInMonth.toLocaleString('tr-TR')} TL</td>
                                    <td className="py-3.5 text-emerald-600 dark:text-emerald-450 font-bold">{collectedInMonth.toLocaleString('tr-TR')} TL</td>
                                    <td className="py-3.5 text-amber-600 font-bold">{unpaidInMonth.toLocaleString('tr-TR')} TL</td>
                                    <td className="py-3.5 text-rose-600 font-bold">{expensesInMonth.toLocaleString('tr-TR')} TL</td>
                                    <td className="py-3.5 font-black">
                                      <span className={netInMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                        {netInMonth >= 0 ? '+' : ''}{netInMonth.toLocaleString('tr-TR')} TL
                                      </span>
                                    </td>
                                  </tr>
                                  {isMonthExpanded && (
                                    <tr className="bg-slate-50/70 dark:bg-slate-900/30">
                                      <td colSpan={6} className="py-3 px-4 space-y-4">
                                        <div>
                                          <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                            Gelir Detayı — {expectedInMonth.toLocaleString('tr-TR')} TL hak edilen, {collectedInMonth.toLocaleString('tr-TR')} TL tahsil edildi
                                            {unpaidInMonth > 0 && `, ${unpaidInMonth.toLocaleString('tr-TR')} TL bekliyor`}
                                          </h4>
                                          {pendingFirmsInMonth.length === 0 ? (
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Bu ay için bekleyen tahsilat yok - tamamı tahsil edildi.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {pendingFirmsInMonth.map((f) => (
                                                <div key={f.clientId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/40">
                                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    {f.name}
                                                    {f.isTerminated && (
                                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">Sonlandırıldı</span>
                                                    )}
                                                  </span>
                                                  <span className="text-xs font-bold text-amber-600">{f.amount.toLocaleString('tr-TR')} TL bekliyor</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {collectedFirmsInMonth.length > 0 && (
                                            <div className="mt-2">
                                              <button
                                                type="button"
                                                onClick={(ev) => {
                                                  ev.stopPropagation();
                                                  setShowCollectedFirmsMonth(showCollectedFirmsMonth === monthKey ? null : monthKey);
                                                }}
                                                className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                              >
                                                {showCollectedFirmsMonth === monthKey ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                Tahsil Edilenleri Göster ({collectedFirmsInMonth.length})
                                              </button>
                                              {showCollectedFirmsMonth === monthKey && (
                                                <div className="space-y-1.5 mt-2">
                                                  {collectedFirmsInMonth.map((f) => (
                                                    <div key={f.clientId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/40">
                                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                        {f.name}
                                                        {f.isTerminated && (
                                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">Sonlandırıldı</span>
                                                        )}
                                                      </span>
                                                      <span className="text-xs font-bold text-emerald-600">{f.amount.toLocaleString('tr-TR')} TL ödendi</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        <div>
                                          <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Gider Detayı</h4>
                                        {categoryBreakdown.length === 0 ? (
                                          <p className="text-[11px] text-slate-400 italic">Bu ay için gider kaydı yok.</p>
                                        ) : (
                                          <div className="space-y-1.5">
                                            {categoryBreakdown.map((cat) => {
                                              const isSalary = cat.category === 'Maaş/Personel';
                                              const isCatExpanded = expandedSummaryCategory === cat.category;
                                              const catExpenses = monthExpenses.filter((e) => (e.category || 'Diğer') === cat.category);
                                              const employeeBreakdown = isSalary
                                                ? (() => {
                                                    const byEmployee: { employeeId: string; name: string; total: number }[] = [];
                                                    catExpenses.forEach((e) => {
                                                        const empId = e.employee_id || 'unassigned';
                                                        // Ayrılan personel artık teamMembers'ta (organization_id null
                                                        // olduğu için) görünmez - geçmiş maaş gideri kaydı için ismi
                                                        // departedEmployees'ten aranır, "Bilinmeyen Personel" yerine.
                                                        const name = e.employee_id
                                                          ? (
                                                              teamMembers.find((m) => m.id === e.employee_id)?.full_name ||
                                                              departedEmployees.find((d) => d.profile_id === e.employee_id)?.profile?.full_name ||
                                                              'Bilinmeyen Personel'
                                                            )
                                                          : 'Genel / Kişiye Özel Olmayan';
                                                        const row = byEmployee.find((r) => r.employeeId === empId);
                                                        if (row) row.total += Number(e.amount);
                                                        else byEmployee.push({ employeeId: empId, name, total: Number(e.amount) });
                                                      });
                                                    return byEmployee.sort((a, b) => b.total - a.total);
                                                  })()
                                                : [];

                                              return (
                                                <div key={cat.category}>
                                                  <button
                                                    type="button"
                                                    onClick={(ev) => {
                                                      ev.stopPropagation();
                                                      setExpandedSummaryCategory(isCatExpanded ? null : cat.category);
                                                    }}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-left cursor-pointer hover:border-blue-300 dark:hover:border-blue-800"
                                                  >
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                      {isCatExpanded ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                                                      {cat.category}
                                                      {cat.count > 1 && (
                                                        <span className="text-[9px] font-black text-slate-400">({cat.count} kayıt)</span>
                                                      )}
                                                    </span>
                                                    <span className="text-xs font-bold text-rose-600">{cat.total.toLocaleString('tr-TR')} TL</span>
                                                  </button>
                                                  {isCatExpanded && (
                                                    <div className="mt-1.5 ml-4 space-y-1">
                                                      {isSalary ? (
                                                        employeeBreakdown.map((row) => (
                                                          <div
                                                            key={row.employeeId}
                                                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 text-[11px]"
                                                          >
                                                            <span className="font-bold text-slate-600 dark:text-slate-400">{row.name}</span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300">{row.total.toLocaleString('tr-TR')} TL</span>
                                                          </div>
                                                        ))
                                                      ) : (
                                                        catExpenses.map((e) => (
                                                          <div
                                                            key={e.id}
                                                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 text-[11px]"
                                                          >
                                                            <span className="flex flex-col">
                                                              <span className="font-bold text-slate-600 dark:text-slate-400">{e.title}</span>
                                                              <span className="text-[9px] font-bold text-slate-400">
                                                                {new Date(e.expense_date).toLocaleDateString('tr-TR')}
                                                                {e.submitted_by && (
                                                                  ` · ${teamMembers.find((m) => m.id === e.submitted_by)?.full_name ||
                                                                    departedEmployees.find((d) => d.profile_id === e.submitted_by)?.profile?.full_name ||
                                                                    'Bilinmeyen Personel'}`
                                                                )}
                                                              </span>
                                                            </span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{Number(e.amount).toLocaleString('tr-TR')} TL</span>
                                                          </div>
                                                        ))
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'finance_payments' && canViewFinance && !requiresFinanceHrReAuth && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold text-slate-750 dark:text-slate-200 flex items-center gap-2">
              <CheckCircle className="text-blue-600" size={18} /> Müşteri Aylık Ödeme Takibi
            </h3>
            <p className="text-xs text-slate-500 mt-1">İşletmelerin aylık sözleşme tutarlarını yönetin ve ödeme geçmişini denetleyin.</p>
          </div>

          {renderFinancePeriodSelector()}

          <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 w-fit">
            {([
              { key: 'active', label: 'Aktif Firmalar' },
              { key: 'terminated', label: 'Sonlandırılan Firmalar' },
              { key: 'all', label: 'Tümü' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFinancePaymentsScope(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  financePaymentsScope === opt.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-150 dark:border-slate-750 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 font-bold">Müşteri / İşletme</th>
                  <th className="pb-3 font-bold">Hizmet Başlangıcı</th>
                  <th className="pb-3 font-bold w-48">Aylık Ücret (Matrah)</th>
                  <th className="pb-3 font-bold">Güncel Hizmet Geçerlilik Tarihi</th>
                  <th className="pb-3 font-bold text-right">Ödeme Takvimi & Durumu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-750/30 text-slate-700 dark:text-slate-300 font-medium">
                {(financePaymentsScope === 'active' ? clients : financePaymentsScope === 'terminated' ? terminatedClients : [...clients, ...terminatedClients]).map((client) => {
                  // Sonlandırılan bir firma için "vadesi gelen" ay listesi
                  // sonlandırma tarihinde durur - sonrası için zaten hiç borç
                  // üretilmiyor, "0 TL / ödenmedi" gibi anlamsız satırlar gösterilmesin.
                  // Cari ay (henüz tamamlanmamış) da hariç tutulur - alacak
                  // üretici fonksiyon (generate_missing_client_payments) da
                  // aynı şekilde bu ayı henüz üretmiyor; dahil edilirse hiç
                  // satırı olmadığı için her zaman "ödenmedi" gibi görünüp
                  // N/M oranını gerçekte vadesi gelmemiş bir ayla şişiriyordu.
                  const now = new Date();
                  const monthsList = getMonthsSinceServiceStart(client.service_start_date)
                    .filter((item) => matchesFinancePeriod(`${item.year}-${String(item.month).padStart(2, '0')}`))
                    .filter((item) => item.year < now.getFullYear() || (item.year === now.getFullYear() && item.month < now.getMonth() + 1))
                    .filter((item) => {
                      if (!client.service_terminated_at) return true;
                      const term = new Date(client.service_terminated_at);
                      return item.year < term.getFullYear() || (item.year === term.getFullYear() && item.month <= term.getMonth() + 1);
                    });
                  const isEditing = updatingClientFee === client.id;
                  // Blanket cari monthly_fee yerine, o ayı kapsayan dönemin
                  // ücretini (ya da zaten üretilmiş client_payments satırının
                  // tutarını) kullan - geçmiş aylar kendi dönem ücretinde kalır.
                  const getAmountForMonth = (year: number, month: number) => {
                    const existing = financePayments.find(p => p.client_id === client.id && p.year === year && p.month === month);
                    if (existing) return Number(existing.amount);
                    const monthDate = new Date(year, month - 1, 1);
                    const period = servicePeriods.find(
                      (p) => p.client_id === client.id && new Date(p.start_date) <= monthDate && new Date(p.end_date) > monthDate
                    );
                    // O ayı kapsayan bir dönem yoksa (sözleşme o ay için hiç
                    // yenilenmemiş/sonlandırılmış), bayat cari ücrete geri
                    // düşmek yerine 0 gösterilir - aksi halde geçersiz bir
                    // ay için yanlış bir tutar/borç ima edilmiş olurdu.
                    return period ? Number(period.monthly_fee) : 0;
                  };

                  const isMonthPaid = (year: number, month: number) =>
                    financePayments.find(p => p.client_id === client.id && p.year === year && p.month === month)?.is_paid || false;

                  const paidCount = monthsList.filter(item => isMonthPaid(item.year, item.month)).length;
                  const unpaidCount = monthsList.length - paidCount;
                  const paidPct = monthsList.length > 0 ? Math.round((paidCount / monthsList.length) * 100) : 0;
                  const unpaidTotal = monthsList
                    .filter((item) => !isMonthPaid(item.year, item.month))
                    .reduce((sum, item) => sum + getAmountForMonth(item.year, item.month), 0);

                  const monthsByYear = new Map<number, typeof monthsList>();
                  monthsList.forEach(item => {
                    if (!monthsByYear.has(item.year)) monthsByYear.set(item.year, []);
                    monthsByYear.get(item.year)!.push(item);
                  });
                  const paymentYears = Array.from(monthsByYear.keys()).sort((a, b) => b - a);
                  const currentYear = new Date().getFullYear();

                  const isExpanded = !!expandedPaymentClients[client.id];
                  const serviceStatus = getClientServiceStatus(client.id, client.service_start_date, client.service_terminated_at);

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 align-top">
                      <td className="py-4">
                        <button
                          type="button"
                          onClick={() => setExpandedPaymentClients(prev => ({ ...prev, [client.id]: !isExpanded }))}
                          className="flex items-center gap-1.5 text-left group"
                          title={isExpanded ? 'Ödeme takvimini gizle' : 'Ödeme takvimini görmek için tıklayın'}
                        >
                          {isExpanded ? (
                            <ChevronDown size={13} className="text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight size={13} className="text-slate-400 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold text-slate-850 dark:text-slate-200 text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                              {client.name}
                              {client.service_terminated_at && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">Sonlandırıldı</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{client.email || 'Telefon/E-posta girilmemiş'}</div>
                          </div>
                        </button>
                      </td>
                      <td className="py-4 text-slate-500 font-bold">
                        {client.service_start_date ? new Date(client.service_start_date).toLocaleDateString('tr-TR') : '-'}
                      </td>
                      <td className="py-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-24 p-1 text-xs border rounded outline-none"
                              value={tempClientFeeVal}
                              onChange={(e) => setTempClientFeeVal(e.target.value)}
                              placeholder="Tutar"
                            />
                            <button
                              onClick={() => handleUpdateClientFee(client.id, parseFloat(tempClientFeeVal) || 0)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-bold"
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => setUpdatingClientFee(null)}
                              className="bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-655"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                              {(Number(client.monthly_fee) || 0).toLocaleString('tr-TR')} TL
                            </span>
                            <button
                              onClick={() => {
                                setUpdatingClientFee(client.id);
                                setTempClientFeeVal(String(client.monthly_fee || 0));
                              }}
                              className="text-blue-500 hover:text-blue-700 cursor-pointer"
                              title="Ücreti Düzenle"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        {!serviceStatus ? (
                          <span className="text-slate-400 italic text-[11px]">Hizmet başlatılmadı</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{serviceStatus.expiryDate.toLocaleDateString('tr-TR')}</span>
                            {serviceStatus.isTerminated ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase">Sonlandırıldı</span>
                            ) : serviceStatus.isExpired ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50 uppercase">Süresi Geçti</span>
                            ) : serviceStatus.isWarning ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 uppercase">Son {serviceStatus.daysLeft} Gün</span>
                            ) : (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50 uppercase">Geçerli</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {monthsList.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">Hizmet başlangıç tarihi belirtilmemiş.</span>
                        ) : (
                          <div className="inline-block text-left min-w-72 max-w-sm">
                            {/* Özet: ödenen ay oranı ve bekleyen tutar (firma adına tıklayınca detay açılır) */}
                            <button
                              type="button"
                              onClick={() => setExpandedPaymentClients(prev => ({ ...prev, [client.id]: !isExpanded }))}
                              className={`w-full flex items-center justify-between gap-3 pb-2 ${isExpanded ? 'mb-2 border-b border-slate-100 dark:border-slate-800' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${paidPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${paidPct}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                                  {paidCount}/{monthsList.length} ödendi
                                </span>
                              </div>
                              {unpaidCount > 0 && (
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                  {unpaidTotal.toLocaleString('tr-TR')} TL bekliyor
                                </span>
                              )}
                            </button>

                            {!isExpanded && (
                              <span className="text-[10px] text-slate-400 italic">Detaylar için firma adına tıklayın</span>
                            )}

                            {/* Yıllara göre gruplanmış, tıklanabilir ay etiketleri */}
                            {isExpanded && (
                            <div className="space-y-2">
                              {paymentYears.map(year => {
                                const yearMonths = monthsByYear.get(year)!;
                                const yearPaid = yearMonths.filter(item => isMonthPaid(item.year, item.month)).length;
                                const collapseKey = `${client.id}-${year}`;
                                const collapsed = collapsedPaymentYears[collapseKey] ?? (year !== currentYear);

                                return (
                                  <div key={year}>
                                    <button
                                      type="button"
                                      onClick={() => setCollapsedPaymentYears(prev => ({ ...prev, [collapseKey]: !collapsed }))}
                                      className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    >
                                      {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                      {year}
                                      <span className="text-slate-350 dark:text-slate-600 font-bold">({yearPaid}/{yearMonths.length})</span>
                                    </button>

                                    {!collapsed && (
                                      <div className="flex flex-wrap gap-1.5 mt-1.5 justify-end">
                                        {yearMonths.map(item => {
                                          const isPaid = isMonthPaid(item.year, item.month);
                                          const toggleKey = `${client.id}-${item.year}-${item.month}`;
                                          const isToggling = togglingPaymentKey === toggleKey;

                                          return (
                                            <button
                                              key={toggleKey}
                                              type="button"
                                              disabled={isToggling}
                                              onClick={() => handleTogglePaymentStatus(client.id, item.year, item.month, !isPaid, getAmountForMonth(item.year, item.month))}
                                              title={`${item.label} — ${isPaid ? 'Ödendi. Geri almak için tıklayın.' : 'Ödenmedi. Ödendi olarak işaretlemek için tıklayın.'}`}
                                              className={`flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                                                isPaid
                                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                                                  : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400'
                                              } ${isToggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                            >
                                              {isToggling ? (
                                                <RefreshCw size={10} className="animate-spin" />
                                              ) : isPaid ? (
                                                <Check size={10} />
                                              ) : (
                                                <XCircle size={10} />
                                              )}
                                              {TR_MONTH_SHORT[item.month - 1]} {String(item.year).slice(2)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'finance_expenses' && canViewFinance && !requiresFinanceHrReAuth && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-slate-750 dark:text-slate-200 flex items-center gap-2">
                <Trash2 className="text-blue-600" size={18} /> Şirket Giderleri Listesi
              </h3>
              <p className="text-xs text-slate-500 mt-1">Danışmanlık ofisinin aylık giderlerini girin ve net kâr oranınızı optimize edin.</p>
            </div>
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> Yeni Gider Ekle
            </button>
          </div>

          {renderFinancePeriodSelector()}

          {loadingFinance ? (
            <div className="flex justify-center py-12">
              <Loader className="animate-spin text-blue-600" size={24} />
            </div>
          ) : financeExpenses.filter((exp) => matchesFinancePeriod(exp.expense_date)).length === 0 ? (
            <div className="text-center text-slate-400 italic text-sm py-12">
              {financeExpenses.length === 0
                ? 'Henüz herhangi bir gider kaydı eklenmemiş. "Yeni Gider Ekle" butonuna basarak başlayabilirsiniz.'
                : 'Seçilen dönemde gider kaydı yok.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-750 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 font-bold">Gider Açıklaması</th>
                    <th className="pb-3 font-bold">Kategori</th>
                    <th className="pb-3 font-bold">Tutar</th>
                    <th className="pb-3 font-bold">Gider Tarihi</th>
                    <th className="pb-3 font-bold">Gönderen / Ödeme Türü</th>
                    <th className="pb-3 font-bold">Notlar</th>
                    <th className="pb-3 font-bold text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-750/30 text-slate-700 dark:text-slate-300 font-medium">
                  {financeExpenses.filter((exp) => matchesFinancePeriod(exp.expense_date)).map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                      <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {exp.title}
                        {exp.employee_id && (
                          <div className="text-[10px] font-bold text-blue-500 dark:text-blue-400 mt-0.5 normal-case">
                            {teamMembers.find((m) => m.id === exp.employee_id)?.full_name ||
                              departedEmployees.find((d) => d.profile_id === exp.employee_id)?.profile?.full_name ||
                              'Bilinmeyen Personel'}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                          exp.category === 'Maaş/Personel'
                            ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 border-blue-100'
                            : exp.category === 'Ofis/Kira'
                            ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 border-teal-100'
                            : exp.category === 'Yol/Ulaşım'
                            ? 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 border-amber-100'
                            : exp.category === 'Yazılım/Lisans'
                            ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 border-purple-100'
                            : exp.category === 'Vergi/Harç'
                            ? 'bg-orange-50 dark:bg-orange-955/20 text-orange-600 border-orange-100'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 border-slate-200'
                        }`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 text-rose-600 font-bold">
                        {Number(exp.amount).toLocaleString('tr-TR')} TL
                      </td>
                      <td className="py-3.5 text-slate-500 font-bold">
                        {new Date(exp.expense_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-3.5">
                        {exp.submitted_by ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 dark:text-slate-300 font-bold">
                              {teamMembers.find((m) => m.id === exp.submitted_by)?.full_name ||
                                departedEmployees.find((d) => d.profile_id === exp.submitted_by)?.profile?.full_name ||
                                'Bilinmeyen Personel'}
                            </span>
                            {exp.payment_type && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 uppercase whitespace-nowrap">
                                {PAYMENT_TYPE_LABELS[exp.payment_type] || exp.payment_type}
                              </span>
                            )}
                            {exp.receipt_url && (
                              <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700" title="Dekont/Fiş">
                                <ExternalLink size={12} />
                              </a>
                            )}
                            {exp.approved_at ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 uppercase whitespace-nowrap">Onaylandı</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApproveExpense(exp.id)}
                                className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 uppercase whitespace-nowrap hover:bg-amber-100 dark:hover:bg-amber-950/40 transition"
                                title="Onaylayınca personel bu gideri artık silemez"
                              >
                                Onayla
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-400 max-w-xs truncate" title={exp.notes}>
                        {exp.notes || '-'}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-red-500 hover:text-red-700 cursor-pointer transition p-1"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- PERSONEL/ŞEF GİDER EKLEME (dar kapsamlı) --- */}
      {activeTab === 'staff_expense_submission' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
              <PlusCircle className="text-blue-600" size={22} /> Gider Ekle
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 font-medium">
              Şirket adına ya da kendi cebinizden yaptığınız bir harcamayı buradan girin. Girdiğiniz gider, o ayın gider kaydına otomatik eklenir ve Finansal Özet'e yansır.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Açıklama *</label>
                <input
                  type="text"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  placeholder="Örn: Müşteri ziyareti yakıt gideri"
                  value={newStaffExpense.title}
                  onChange={(e) => setNewStaffExpense((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Tarih *</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    value={newStaffExpense.expense_date}
                    onChange={(e) => setNewStaffExpense((prev) => ({ ...prev, expense_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Tutar (TL) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    placeholder="0.00"
                    value={newStaffExpense.amount}
                    onChange={(e) => setNewStaffExpense((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Kategori</label>
                  <select
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    value={newStaffExpense.category}
                    onChange={(e) => setNewStaffExpense((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Ofis/Kira">Ofis / Kira</option>
                    <option value="Yol/Ulaşım">Yol / Ulaşım</option>
                    <option value="Yazılım/Lisans">Yazılım / Lisans</option>
                    <option value="Vergi/Harç">Vergi / Harç</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Ödeme Türü *</label>
                  <select
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    value={newStaffExpense.payment_type}
                    onChange={(e) => setNewStaffExpense((prev) => ({ ...prev, payment_type: e.target.value as typeof prev.payment_type }))}
                  >
                    <option value="sirket_karti">{PAYMENT_TYPE_LABELS.sirket_karti}</option>
                    <option value="sirket_sahsi">{PAYMENT_TYPE_LABELS.sirket_sahsi}</option>
                    <option value="kisisel_odeme">{PAYMENT_TYPE_LABELS.kisisel_odeme}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Dekont / Fiş (opsiyonel)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setStaffExpenseReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 dark:text-slate-300"
                />
                {staffExpenseReceiptFile && (
                  <span className="text-[11px] text-emerald-600 block mt-1">{staffExpenseReceiptFile.name} seçildi</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Not</label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  value={newStaffExpense.notes}
                  onChange={(e) => setNewStaffExpense((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <button
                onClick={handleSaveStaffExpense}
                disabled={savingStaffExpense}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingStaffExpense ? <Loader size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                {savingStaffExpense ? 'Kaydediliyor...' : 'Gideri Kaydet'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Gönderdiğim Giderler</h3>
            </div>
            {loadingMyStaffExpenses ? (
              <div className="py-8 text-center text-xs text-gray-400">Yükleniyor...</div>
            ) : myStaffExpenses.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 italic">Henüz gider göndermediniz.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {myStaffExpenses.map((exp) => (
                  <div key={exp.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-xs text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                        {exp.title}
                        {exp.approved_at ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 uppercase">Onaylandı</span>
                        ) : (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 uppercase">Onay Bekliyor</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                        {new Date(exp.expense_date).toLocaleDateString('tr-TR')} · {exp.category} · {PAYMENT_TYPE_LABELS[exp.payment_type] || exp.payment_type}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-rose-600">{Number(exp.amount).toLocaleString('tr-TR')} TL</span>
                      {exp.receipt_url && (
                        <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700" title="Dekont/Fiş">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      {!exp.approved_at && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMyStaffExpense(exp.id)}
                          className="text-red-500 hover:text-red-700 cursor-pointer transition p-1"
                          title="Sil (yanlışlıkla eklediysem)"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- YENİ: GİDER EKLEME MODALİ --- */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Trash2 size={18} />
                  Yeni Gider Kaydı Oluştur
                </h3>
              </div>
              <button 
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white transition"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Gider Başlığı / Açıklama *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  placeholder="Örn: Haziran Ofis Kirası"
                  value={newExpense.title}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Kategori *</label>
                  <select
                    required
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Ofis/Kira">Ofis / Kira</option>
                    <option value="Maaş/Personel">Maaş / Personel</option>
                    <option value="Yol/Ulaşım">Yol / Ulaşım</option>
                    <option value="Yazılım/Lisans">Yazılım / Lisans</option>
                    <option value="Vergi/Harç">Vergi / Harç</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Tutar (TL) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                    placeholder="Tutar girin"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>

              {newExpense.category === 'Maaş/Personel' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Personel (Opsiyonel)</label>
                  <select
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                    value={newExpense.employee_id}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, employee_id: e.target.value }))}
                  >
                    <option value="">-- Belirli bir personele bağlama --</option>
                    {teamMembers.filter(m => m.role !== 'normal').map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Bir personel seçerseniz bu gider, o personelin kartındaki "Personel Giderleri" listesinde de görünür.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Gider Tarihi *</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">Notlar (Opsiyonel)</label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  placeholder="Ek notlar varsa buraya yazabilirsiniz..."
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  disabled={savingExpense}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveExpense}
                  disabled={savingExpense || !newExpense.title.trim() || !newExpense.amount}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                >
                  {savingExpense ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* --- FORM OLUŞTURMA MODALI --- */}
      {showCreateInspectionFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText size={20} />
                  Yeni Denetim Formu Tasarla
                </h3>
                <p className="text-xs opacity-80">Sahada personellerin dolduracağı evet/hayır sorularından oluşan kontrol listesi</p>
              </div>
              <button 
                onClick={() => setShowCreateInspectionFormModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveInspectionForm} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Müşteri İşletme *</label>
                  <select
                    required
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-330 border-slate-200"
                    value={newInsFormClientId}
                    onChange={(e) => setNewInsFormClientId(e.target.value)}
                  >
                    <option value="">-- İşletme Seçin --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Yönergeler</label>
                <textarea
                  rows={2}
                  placeholder="Personelin formu doldururken dikkat etmesi gereken kurallar varsa belirtin..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200 resize-none"
                  value={newInsFormDesc}
                  onChange={(e) => setNewInsFormDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Form Giriş Şifresi (Opsiyonel)</label>
                <input
                  type="password"
                  placeholder="Sahada bu formu dolduracak personellerin girmesi gereken şifre (boş bırakılırsa şifresiz açılır)"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newInsFormPassword}
                  onChange={(e) => setNewInsFormPassword(e.target.value)}
                />
              </div>

              {/* Questions Area */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center border-b pb-2 border-gray-100 dark:border-slate-700">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle size={16} className="text-blue-600" />
                    Form Soruları
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setNewInsFormQuestions([
                        ...newInsFormQuestions,
                        { question_text: '', question_type: 'yes_no', is_required: true }
                      ]);
                    }}
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
                          className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
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
                          className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none text-slate-850 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 font-semibold"
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
                        <label className="flex items-center gap-1.5 text-xs text-gray-655 dark:text-gray-400 font-semibold cursor-pointer select-none">
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
                            onClick={() => {
                              setNewInsFormQuestions(newInsFormQuestions.filter((_, i) => i !== idx));
                            }}
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
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg"
                >
                  Form Şablonunu Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NOKTA OLUŞTURMA MODALI --- */}
      {showCreateInspectionPointModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <PlusCircle size={18} className="text-teal-655" />
                Yeni Denetim Noktası ve QR Tanımla
              </h3>
              <button 
                onClick={() => setShowCreateInspectionPointModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-655 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInspectionPoint} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Kullanılacak Form Şablonu *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-bold text-sm text-slate-700 dark:text-slate-350 border-slate-200"
                  value={newInsPointFormId}
                  onChange={(e) => setNewInsPointFormId(e.target.value)}
                >
                  <option value="">-- Form Seçin --</option>
                  {inspectionForms.filter(f => f.is_active).map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.client?.name} - {form.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Sadece aktif form şablonları listelenir.</p>
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
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-teal-100"
                >
                  Noktayı ve QR Oluştur
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateInspectionPointModal(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- GÖNDERİMLERİ İNCELEME MODALI --- */}
      {showSubmissionsModal && selectedInspectionPoint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-teal-600 text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Clock size={20} />
                  Denetim Gönderim Geçmişi
                </h3>
                <p className="text-xs opacity-90">
                  {selectedInspectionPoint.form?.client?.name} — {selectedInspectionPoint.name}
                  {selectedInspectionPoint.location_description && ` (${selectedInspectionPoint.location_description})`}
                </p>
              </div>
              <button
                onClick={() => setShowSubmissionsModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {!loadingSubmissions && pointSubmissions.length > 0 && (() => {
              const totalFindings = pointSubmissions.reduce((sum, sub) => {
                const answers = submissionAnswers[sub.id] || [];
                return sum + answers.filter(a => (a.question?.question_type === 'yes_no' || a.question?.question_type === 'compliant') && a.answer_bool === false).length;
              }, 0);
              return (
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-gray-100 dark:border-slate-700 flex gap-6 text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-300">{pointSubmissions.length} Toplam Form Gönderimi</span>
                  {totalFindings > 0 ? (
                    <span className="font-black text-red-600 dark:text-red-400">⚠️ {totalFindings} Toplam Uyumsuz Bulgu</span>
                  ) : (
                    <span className="font-black text-emerald-600 dark:text-emerald-400">✅ Tüm Gönderimler Uyumlu</span>
                  )}
                </div>
              );
            })()}

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {loadingSubmissions ? (
                <div className="flex justify-center py-12">
                  <Loader className="animate-spin text-teal-600" size={24} />
                </div>
              ) : pointSubmissions.length === 0 ? (
                <div className="text-center text-slate-400 italic text-sm py-12">
                  Bu denetim noktasına ait henüz herhangi bir form doldurulmamış.
                </div>
              ) : (
                <div className="space-y-3">
                  {pointSubmissions.map((sub) => {
                    const isExpanded = expandedSubmissionId === sub.id;
                    const answers = submissionAnswers[sub.id] || [];
                    const answersCount = answers.length;
                    const nonCompliantCount = answers.filter(a => a.answer_bool === false && a.question?.question_type !== 'text').length;

                    return (
                      <div key={sub.id} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/30">
                        {/* Summary Header */}
                        <div 
                          onClick={() => handleViewSubmissionAnswers(sub.id)}
                          className="p-4 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 flex justify-between items-center gap-4 cursor-pointer transition select-none"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-500">Gönderen Personel</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                              {sub.submitted_by_name ? `${sub.submitted_by_name} ${sub.submitted_by_surname || ''}`.trim() : <span className="italic font-normal text-slate-400">Anonim Saha Personeli</span>}
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-xs font-semibold text-slate-500">Tarih / Saat</div>
                            <div className="text-sm text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                              {new Date(sub.submitted_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-semibold text-slate-500">Bulgular</div>
                            <div className="mt-0.5">
                              {nonCompliantCount > 0 ? (
                                <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  ⚠️ {nonCompliantCount} Uyumsuz Madde
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-250 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  ✅ Tam Uyumlu
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Detailed answers drop-down */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900/10 space-y-4 animate-fadeIn">
                            {/* General notes */}
                            {sub.general_notes && (
                              <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3.5 text-xs text-amber-900 dark:text-amber-350">
                                <span className="font-extrabold uppercase text-[9px] tracking-wide block mb-1">Saha Tespitleri / Genel Notlar:</span>
                                <p className="leading-relaxed whitespace-pre-wrap">{sub.general_notes}</p>
                              </div>
                            )}

                            {/* Question answers list */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verilen Cevaplar</h4>
                              
                              {answersCount === 0 ? (
                                <div className="flex justify-center py-4">
                                  <Loader className="animate-spin text-teal-600" size={18} />
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/20">
                                  {answers.map((ans, aIdx) => (
                                    <div key={ans.id} className="p-3 flex justify-between items-center gap-4 text-xs bg-white dark:bg-slate-900">
                                      <div className="flex items-start gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center shrink-0 border">
                                          {aIdx + 1}
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                          {ans.question?.question_text}
                                        </span>
                                      </div>

                                      <div className="shrink-0 font-bold">
                                        {ans.question?.question_type === 'yes_no' && (
                                          ans.answer_bool ? (
                                            <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-100">EVET</span>
                                          ) : (
                                            <span className="text-red-600 bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded-lg border border-red-100">HAYIR</span>
                                          )
                                        )}

                                        {ans.question?.question_type === 'compliant' && (
                                          ans.answer_bool ? (
                                            <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-100">UYGUN</span>
                                          ) : (
                                            <span className="text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-100">UYGUN DEĞİL</span>
                                          )
                                        )}

                                        {ans.question?.question_type === 'text' && (
                                          <div className="text-right text-slate-700 dark:text-slate-300 font-medium max-w-xs truncate">
                                            {ans.answer_text || <span className="italic text-gray-300">Boş bırakılmış</span>}
                                          </div>
                                        )}

                                        {ans.question?.question_type === 'rating' && (
                                          <span className="text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 rounded-lg border border-blue-100">
                                            ⭐ {ans.answer_text} / 5
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t flex justify-end">
              <button 
                onClick={() => setShowSubmissionsModal(false)}
                className="bg-slate-200 dark:bg-slate-750 text-slate-700 dark:text-slate-200 px-6 py-2 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DEPOLAMA KOTASI DETAY MODALI --- */}
      {showQuotaDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-100 dark:border-slate-700 animate-scaleIn flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white rounded-t-2xl shrink-0">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <HardDrive size={20} /> Depolama Kotası Detayı
                </h3>
                <p className="text-xs opacity-80">
                  {formatBytes(orgStorageUsed)} / {formatBytes(orgData?.storage_limit || 524288000)} kullanılıyor
                </p>
              </div>
              <button onClick={() => setShowQuotaDetailModal(false)} className="p-1 hover:bg-white/10 rounded-full text-white transition">
                <X size={22} />
              </button>
            </div>

            <div className="flex gap-1.5 p-3 border-b border-gray-100 dark:border-slate-700 shrink-0">
              {([
                { id: 'members', label: 'Kişi Bazlı' },
                { id: 'clients', label: 'Firma Bazlı' },
                { id: 'documents', label: 'Tüm Belgeler' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setQuotaDetailTab(t.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                    quotaDetailTab === t.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingQuotaDetail ? (
                <div className="py-16 text-center text-xs text-gray-400">Yükleniyor...</div>
              ) : quotaDetailTab === 'members' ? (
                Object.keys(memberStorage).length === 0 ? (
                  <div className="py-16 text-center text-xs text-gray-400 italic">Henüz belge yükleyen olmadı.</div>
                ) : (
                  <div className="space-y-3">
                    {teamMembers
                      .filter((m) => memberStorage[m.id])
                      .sort((a, b) => (memberStorage[b.id]?.bytes || 0) - (memberStorage[a.id]?.bytes || 0))
                      .map((m) => {
                        const usage = memberStorage[m.id];
                        const sharePercent = orgStorageUsed > 0 ? (usage.bytes / orgStorageUsed) * 100 : 0;
                        return (
                          <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-bold text-gray-700 dark:text-gray-200">{m.full_name || m.email}</span>
                              <span className="text-gray-400 dark:text-gray-500">{formatBytes(usage.bytes)} · {usage.count} belge</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div style={{ width: `${Math.min(100, sharePercent)}%` }} className="h-full rounded-full bg-blue-500" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )
              ) : quotaDetailTab === 'clients' ? (
                clientStorage.length === 0 ? (
                  <div className="py-16 text-center text-xs text-gray-400 italic">
                    Hiçbir işletme adına (lokasyon eşleşmesiyle) belge yüklenmemiş.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clientStorage.map((c) => {
                      const sharePercent = orgStorageUsed > 0 ? (c.total_bytes / orgStorageUsed) * 100 : 0;
                      return (
                        <div key={c.client_id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                              <Building size={12} className="text-gray-400" /> {c.client_name}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500">{formatBytes(c.total_bytes)} · {c.doc_count} belge</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div style={{ width: `${Math.min(100, sharePercent)}%` }} className="h-full rounded-full bg-purple-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : orgDocumentsForQuota.length === 0 ? (
                <div className="py-16 text-center text-xs text-gray-400 italic">Kotayı kullanan belge bulunamadı.</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {orgDocumentsForQuota.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-gray-800 dark:text-slate-200 truncate">{doc.title}</div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                          {doc.uploader?.full_name || 'Bilinmeyen'}
                          {doc.location_def?.label && <> · {doc.location_def.label}</>}
                          {' '}· {new Date(doc.created_at).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{formatBytes(doc.file_size || 0)}</span>
                        <button
                          onClick={() => handleDeleteQuotaDocument(doc.id)}
                          disabled={deletingQuotaDocId === doc.id}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition disabled:opacity-40"
                          title="Belgeyi Sil (Kota Boşalt)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- QR KOD YAZDIRMA / GÖRÜNTÜLEME MODALI --- */}
      {showQrPrintModal && qrPrintPoint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn text-center">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5 text-lg">
                <QrCode size={18} className="text-blue-600" />
                QR Kod Etiketi
              </h3>
              <button 
                onClick={() => {
                  setShowQrPrintModal(false);
                  setQrPrintPoint(null);
                  setQrPrintCodeUrl('');
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-655 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4 flex flex-col items-center">
              <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750 w-full text-left">
                <div className="text-slate-400 uppercase tracking-wide">İşletme:</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{qrPrintPoint.form?.client?.name}</div>
                <div className="text-slate-400 uppercase tracking-wide mt-2">Denetim Noktası:</div>
                <div className="font-bold text-teal-655 dark:text-teal-400 text-sm mt-0.5">{qrPrintPoint.name}</div>
              </div>

              {qrPrintCodeUrl && (
                <div className="p-4 bg-white rounded-xl border shadow-sm">
                  <img src={qrPrintCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              )}

              <p className="text-[10px] text-gray-500 max-w-[250px]">
                Bu QR kodunu yazdırıp sahada ilgili denetim noktasına yapıştırabilirsiniz. Personel bu kodu okutarak formu anında doldurabilir.
              </p>

              <div className="flex gap-3 w-full pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  onClick={handlePrintQr}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-100"
                >
                  💾 Yazdır (Print)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowQrPrintModal(false);
                    setQrPrintPoint(null);
                    setQrPrintCodeUrl('');
                  }}
                  className="flex-1 border border-slate-200 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: MEVZUAT MADDESİNDEN MEVCUT DURUM TALEP ETME MODALI --- */}
      {showRequestNotesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <Clock size={18} className="text-amber-600" />
                Mevcut Durum Talep Et
              </h3>
              <button 
                onClick={() => setShowRequestNotesModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750">
                <div className="text-slate-400 uppercase tracking-wide">{pendingActionArticleIds.length > 1 ? 'Seçili Maddeler:' : 'Seçili Madde:'}</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{newActionTitle}</div>
              </div>
              {pendingActionArticleIds.length > 1 && (
                <div className="text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 rounded-xl p-2.5 font-bold">
                  📌 Bu aksiyon {pendingActionArticleIds.length} madde ile ilişkilendirilecek.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sorumlu Personel *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={reqNotesAssigneeId}
                  onChange={(e) => setReqNotesAssigneeId(e.target.value)}
                  disabled={userRole === 'corporate_staff' || userRole === 'premium_individual'}
                >
                  {(userRole === 'corporate_staff' || userRole === 'premium_individual') ? (
                    <option value={userId}>Kendim ({teamMembers.find(m => m.id === userId)?.full_name || 'Ben'})</option>
                  ) : (
                    <>
                      <option value="">-- Personel Seçin --</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Son Tarih *</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={reqNotesDueDate}
                  onChange={(e) => setReqNotesDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Gerekçe *</label>
                <textarea
                  required
                  rows={3}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  placeholder="Bu madde için aksiyon açma gerekçesini yazın... (zorunlu)"
                  value={reqNotesDesc}
                  onChange={(e) => setReqNotesDesc(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestNotesModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateAction(true, reqNotesArticleId, reqNotesClientId)}
                  disabled={!reqNotesDesc.trim() || creatingAction}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creatingAction ? 'Gönderiliyor...' : 'Talep Et'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

              {/* --- YENİ: ZORUNLU MEVCUT DURUM / AÇIKLAMA GİRİŞ MODALI --- */}
      {showComplianceNoteModal && complianceNoteData && (() => {
        const type = complianceNoteData.type;
        
        let themeColor = 'teal';
        let statusText = '';
        let inputLabel = '';
        let placeholderText = '';
        let gradientHeader = 'from-teal-500 to-cyan-600';
        let alertBg = 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/30';
        let alertText = 'text-teal-700 dark:text-teal-400';
        let accentRing = 'focus:ring-teal-500 focus:border-teal-500';
        let submitBtnBg = 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20';

        if (type === 'compliant') {
          themeColor = 'emerald';
          statusText = 'Uygun (Aktif)';
          inputLabel = 'Mevcut Durum Açıklaması *';
          placeholderText = 'Bu madde için firmanın mevcut durumunu, alınan önlemleri detaylıca yazın...';
          gradientHeader = 'from-emerald-500 to-teal-600';
          alertBg = 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30';
          alertText = 'text-emerald-700 dark:text-emerald-400';
          accentRing = 'focus:ring-emerald-500 focus:border-emerald-500';
          submitBtnBg = 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20';
        } else if (type === 'non_compliant') {
          themeColor = 'rose';
          statusText = 'Uygun Değil (Aktif)';
          inputLabel = 'Neden Uygun Değil? *';
          placeholderText = 'Maddenin neden uygun olmadığını, eksiklikleri detaylıca açıklayın...';
          gradientHeader = 'from-rose-500 to-red-600';
          alertBg = 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30';
          alertText = 'text-rose-700 dark:text-rose-400';
          accentRing = 'focus:ring-rose-500 focus:border-rose-500';
          submitBtnBg = 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20';
        } else {
          statusText = 'Hariç Tutuldu (Muaf)';
          inputLabel = 'Neden Hariç Tutuldu? *';
          placeholderText = 'Bu maddenin bu firma için neden hariç tutulduğunu (muafiyet gerekçesini) yazın...';
          gradientHeader = 'from-teal-600 to-indigo-600';
          alertBg = 'bg-slate-50/50 dark:bg-slate-905/20 border-slate-200 dark:border-slate-700';
          alertText = 'text-slate-700 dark:text-slate-300';
          accentRing = 'focus:ring-teal-500 focus:border-teal-500';
          submitBtnBg = 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20';
        }

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-700 animate-scaleIn">
              {/* Header Gradient */}
              <div className={`bg-gradient-to-r ${gradientHeader} p-6 text-white flex justify-between items-center`}>
                <div className="flex items-center gap-2.5">
                  <Scale size={22} className="text-white animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-base tracking-wide">Durum Açıklaması Zorunludur</h3>
                    <p className="text-[10px] text-white/80 font-medium mt-0.5">Uyum durumu değişikliği gerekçe girişi gerektirir.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowComplianceNoteModal(false);
                    setComplianceNoteData(null);
                    setComplianceNoteValue('');
                  }}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* İlgili Madde Detay Kutusu */}
                <div className={`p-4 rounded-2xl border ${alertBg} space-y-2`}>
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Yükümlülük Maddesi</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                      {complianceNoteData.articleNo} {complianceNoteData.title ? `- ${complianceNoteData.title}` : ''}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Seçilen Yeni Durum:</span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${alertText} ${alertBg.replace('border-', 'border-').replace('/50', '/90')}`}>
                      {statusText}
                    </span>
                  </div>
                </div>

                {/* Form Inputu */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    {inputLabel}
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder={placeholderText}
                    className={`w-full p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none transition ${accentRing} font-medium text-xs text-slate-800 dark:text-slate-250 leading-relaxed shadow-sm`}
                    value={complianceNoteValue}
                    onChange={(e) => setComplianceNoteValue(e.target.value)}
                  />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium block">
                    * Uyum geçmişinin şeffaf takibi için gerekçe girmek kanunen zorunludur.
                  </span>
                </div>
                {/* Geçerlilik Süresi (Validity Date) Girişi */}
                {type !== 'exempt' && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                        Geçerlilik Süresi
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-750 dark:hover:text-slate-350 select-none">
                        <input
                          type="checkbox"
                          checked={isComplianceExpiryless}
                          onChange={(e) => {
                            setIsComplianceExpiryless(e.target.checked);
                            if (e.target.checked) setComplianceExpiryDate('');
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-700"
                        />
                        Süresiz (Geçerlilik Tarihi Yok)
                      </label>
                    </div>

                    {!isComplianceExpiryless && (
                      <div className="space-y-1.5 animate-fadeIn">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold block uppercase">
                          Son Geçerlilik Tarihi Seçin
                        </span>
                        <input
                          type="date"
                          required={!isComplianceExpiryless}
                          value={complianceExpiryDate}
                          onChange={(e) => setComplianceExpiryDate(e.target.value)}
                          className={`w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none transition ${accentRing} font-bold text-xs text-slate-800 dark:text-slate-200`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-3 justify-end pt-2 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => {
                      setShowComplianceNoteModal(false);
                      setComplianceNoteData(null);
                      setComplianceNoteValue('');
                    }}
                    disabled={savingComplianceNote}
                    className="px-5 py-2.5 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300 border-slate-200 dark:border-slate-700"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveComplianceNote}
                    disabled={savingComplianceNote || !complianceNoteValue.trim()}
                    className={`px-5 py-2.5 ${submitBtnBg} text-white rounded-xl text-xs font-bold transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {savingComplianceNote ? 'Kaydediliyor...' : 'Kaydet ve Güncelle'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- YENİ: GENEL AKSİYON OLUŞTURMA MODALI --- */}
      {showCreateActionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <PlusCircle size={18} className="text-blue-600" />
                Yeni Aksiyon Tanımla
              </h3>
              <button 
                onClick={() => setShowCreateActionModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Aksiyon Başlığı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Atık Sahası Havalandırma Kontrolü"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">{userRole === 'premium_individual' ? 'Lokasyon *' : 'Hedef Müşteri Firma *'}</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionClientId}
                  onChange={(e) => {
                    setNewActionClientId(e.target.value);
                    setNewActionEmail('');
                    fetchClientPortalEmails(e.target.value);
                  }}
                >
                  <option value="">{userRole === 'premium_individual' ? '-- Lokasyon Seçin --' : '-- Müşteri Seçin --'}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Müşteri Panelinde Bildirilecek E-posta</label>
                <select
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionEmail}
                  onChange={(e) => setNewActionEmail(e.target.value)}
                  disabled={!newActionClientId}
                >
                  <option value="">-- Genel (Tüm Yetkililer Görsün) --</option>
                  {newActionClientEmails.map((a) => (
                    <option key={a.id} value={a.email}>{a.email}</option>
                  ))}
                </select>
                {newActionClientId && newActionClientEmails.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">Bu firma için tanımlı müşteri giriş hesabı bulunamadı. "Müşteri Girişi" ile önce bir hesap oluşturabilirsiniz.</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Bir e-posta seçerseniz, aksiyon o kişiye özel gösterilir ve açıldığında/tamamlandığında kendisine bildirim e-postası gönderilir.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sorumlu Personel *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionAssigneeId}
                  onChange={(e) => setNewActionAssigneeId(e.target.value)}
                  disabled={userRole === 'corporate_staff' || userRole === 'premium_individual'}
                >
                  {(userRole === 'corporate_staff' || userRole === 'premium_individual') ? (
                    <option value={userId}>Kendim ({teamMembers.find(m => m.id === userId)?.full_name || 'Ben'})</option>
                  ) : (
                    <>
                      <option value="">-- Personel Seçin --</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Son Tarih *</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Detaylar *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Yapılması gereken işin detaylı açıklamasını girin... (zorunlu)"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowCreateActionModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleCreateAction(false, null, null)}
                  disabled={!newActionDesc.trim() || creatingAction}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creatingAction ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: AKSİYON TAMAMLAMA MODALI --- */}
      {showCompleteActionModal && selectedClientAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <CheckCircle size={18} className="text-teal-600" />
                Aksiyonu Tamamla
              </h3>
              <button 
                onClick={() => setShowCompleteActionModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750">
                <div className="text-slate-400 uppercase tracking-wide">Aksiyon:</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{selectedClientAction.title}</div>
                {selectedClientAction.description && (
                  <div className="mt-1.5 text-gray-500">{selectedClientAction.description}</div>
                )}
              </div>

              {/* Düzeltme Talebi Yorumu */}
              {selectedClientAction.status === 'correction_requested' && selectedClientAction.manager_comment && (
                <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs">
                  <div className="font-bold text-[9px] text-rose-800 dark:text-rose-400 uppercase tracking-wide">Düzeltme Talebi Gerekçesi:</div>
                  <p className="text-rose-800 dark:text-rose-350 italic mt-0.5">{selectedClientAction.manager_comment}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Mevcut Durum / Açıklama *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Yapılan işlemler, firmanın güncel durumu ve açıklamalarınızı detaylıca yazın..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Kanıt / Ek Belge</label>
                <div className="flex border-b border-gray-200 dark:border-slate-700 mb-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setEvidenceMode('upload')}
                    className={`py-1.5 px-3 font-semibold transition border-b-2 ${evidenceMode === 'upload' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-450'}`}
                  >
                    Yeni Belge Yükle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceMode('select');
                      if (userId) fetchUserDocuments(userId);
                    }}
                    className={`py-1.5 px-3 font-semibold transition border-b-2 ${evidenceMode === 'select' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-450'}`}
                  >
                    Evraklarımdan Seç
                  </button>
                </div>

                {evidenceMode === 'upload' ? (
                  <input
                    type="file"
                    onChange={(e) => setActionEvidenceFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                  />
                ) : (
                  <select
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-bold text-xs text-slate-700 dark:text-slate-350 border-slate-200"
                    value={selectedEvidenceDocUrl}
                    onChange={(e) => setSelectedEvidenceDocUrl(e.target.value)}
                  >
                    <option value="">-- Evrak Seçin --</option>
                    {userDocuments.map(d => (
                      <option key={d.id} value={d.file_url}>{d.title}{d.location_def?.label ? ` (${d.location_def.label})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowCompleteActionModal(false)}
                  disabled={uploadingEvidence}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleCompleteAction(selectedClientAction.id, actionNotes, evidenceMode === 'upload' ? actionEvidenceFile : null, selectedClientAction.article_id, evidenceMode === 'select' ? selectedEvidenceDocUrl : null)}
                  disabled={uploadingEvidence}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {uploadingEvidence ? 'Yükleniyor...' : 'Aksiyonu Gönder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: AKSİYON DÜZELTME TALEP ETME MODALI --- */}
      {showCorrectionModal && selectedClientAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <AlertCircle size={18} className="text-rose-600" />
                Düzeltme Talep Et
              </h3>
              <button 
                onClick={() => setShowCorrectionModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750">
                <div className="text-slate-400 uppercase tracking-wide">Aksiyon:</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{selectedClientAction.title}</div>
                <div className="text-slate-400 uppercase tracking-wide mt-2">Personel Notu:</div>
                <div className="text-slate-755 dark:text-slate-350">{selectedClientAction.notes}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Düzeltme Gerekçesi / Yorum *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Personelin hangi alanları düzeltmesi gerektiğini, eksik veya hatalı noktaları yazın..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-rose-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  value={correctionComment}
                  onChange={(e) => setCorrectionComment(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Yeni Son Tarih *</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-rose-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={correctionDueDate}
                  onChange={(e) => setCorrectionDueDate(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleRequestCorrection(selectedClientAction, correctionComment, correctionDueDate)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Düzeltme İsteğini Gönder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: MEVZUAT FİRMA/İŞLETME ATAMA MODALI --- */}
      {showAssignClientLegModal && assigningGlobalLeg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <Building size={18} className="text-blue-600" />
                Müşteri Firmaya Mevzuat Ata
              </h3>
              <button 
                onClick={() => setShowAssignClientLegModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750">
                <div className="text-slate-400 uppercase tracking-wide">Atanacak Mevzuat:</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{assigningGlobalLeg.title}</div>
                <div className="text-teal-600 font-bold mt-0.5 uppercase">{assigningGlobalLeg.category}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Hedef İşletme Seçin</label>
                <select
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={selectedClientIdForLeg}
                  onChange={(e) => setSelectedClientIdForLeg(e.target.value)}
                >
                  <option value="">-- Müşteri Seçin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {selfTrackingClient && (
                    <option value={selfTrackingClient.id}>👤 Kendim İçin (Lokasyon Bağımsız)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sorumlu Personel Seçin (Opsiyonel)</label>
                <select
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={selectedStaffIdForLeg}
                  onChange={(e) => setSelectedStaffIdForLeg(e.target.value)}
                >
                  <option value="">-- Personel Seçin --</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  onClick={handleAssignRegulationToClient}
                  disabled={!selectedClientIdForLeg}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:shadow-none"
                >
                  Atamayı Kaydet
                </button>
                <button
                  onClick={() => setShowAssignClientLegModal(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: MEVZUAT TALEP ETME MODALI --- */}
      {showAddRequestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <PlusCircle size={18} className="text-teal-600" />
                Mevzuat Talebi Oluştur
              </h3>
              <button 
                onClick={() => setShowAddRequestModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitLegislationRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Hangi İşletme İçin? (Opsiyonel)</label>
                <select
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-medium text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={selectedReqClientId}
                  onChange={(e) => setSelectedReqClientId(e.target.value)}
                >
                  <option value="">-- İşletme Seçin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Hangi Mevzuat Güncellenecek? (Opsiyonel)</label>
                <select
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-medium text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={selectedReqRegulationId}
                  onChange={(e) => setSelectedReqRegulationId(e.target.value)}
                >
                  <option value="">-- Mevzuat Seçin --</option>
                  {assignedGlobalLegislations.map((leg) => (
                    <option key={leg.id} value={leg.id}>
                      {leg.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Talep Başlığı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Yeni Atık Yönetimi Yönetmeliği"
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-300 border-slate-200"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Detaylar *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Lütfen talebinizin detaylarını veya mevzuatın linkini buraya yazın..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-xs text-slate-700 dark:text-slate-300 font-medium resize-none"
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:shadow-none"
                >
                  {submittingRequest ? <Loader size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                  Talebi Gönder
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRequestModal(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mevzuat Talebi İnceleme Modalı */}
      {reviewingRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 border border-slate-100 dark:border-slate-700 animate-fadeIn flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <Eye size={18} className="text-teal-600" />
                Mevzuat Talebini İncele
              </h3>
              <button
                onClick={() => {
                  setReviewingRequest(null);
                  setReviewResponseNote('');
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-2 flex-1">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-150 dark:border-slate-750 space-y-1.5 text-xs">
                <div className="font-bold text-sm text-slate-850 dark:text-slate-200">{reviewingRequest.title}</div>
                <div className="text-gray-500 dark:text-gray-400">
                  Talep Eden: <b>{reviewingRequest.requester?.full_name || 'Bilinmeyen'}</b> ({reviewingRequest.requester?.email})
                </div>
                {reviewingRequest.client?.name && (
                  <div className="text-gray-500 dark:text-gray-400">İşletme: <b>{reviewingRequest.client.name}</b></div>
                )}
                {reviewingRequest.target_regulation?.title && (
                  <div className="text-gray-500 dark:text-gray-400">İlgili Mevzuat: <b>{reviewingRequest.target_regulation.title}</b></div>
                )}
                <div className="text-gray-500 dark:text-gray-400">Tarih: <b>{new Date(reviewingRequest.created_at).toLocaleDateString()}</b></div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Talep Açıklaması</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-150 dark:border-slate-750">
                  {reviewingRequest.description || '—'}
                </p>
              </div>

              {reviewingRequest.draft_regulation && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-teal-50/50 dark:bg-teal-950/10 border border-teal-100 dark:border-teal-900/30 rounded-xl p-3">
                    <div><span className="text-[9px] font-bold text-teal-700 dark:text-teal-400 uppercase block">Kategori</span>{reviewingRequest.draft_regulation.category || '—'}</div>
                    <div><span className="text-[9px] font-bold text-teal-700 dark:text-teal-400 uppercase block">Yayın Tarihi</span>{reviewingRequest.draft_regulation.publication_date ? new Date(reviewingRequest.draft_regulation.publication_date).toLocaleDateString() : '—'}</div>
                    <div><span className="text-[9px] font-bold text-teal-700 dark:text-teal-400 uppercase block">RG No</span>{reviewingRequest.draft_regulation.rg_no || '—'}</div>
                    <div><span className="text-[9px] font-bold text-teal-700 dark:text-teal-400 uppercase block">RG Tarihi</span>{reviewingRequest.draft_regulation.rg_date ? new Date(reviewingRequest.draft_regulation.rg_date).toLocaleDateString() : '—'}</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                      Mevzuat Maddeleri ({reviewingRequest.draft_regulation.articles?.length || 0} Adet) — Onaylamadan önce içeriği uygunluk açısından kontrol edin
                    </div>
                    <div className="border border-slate-150 dark:border-slate-750 rounded-xl divide-y max-h-72 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/30 p-2 space-y-2">
                      {(reviewingRequest.draft_regulation.articles || []).map((art: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {art.article_no} {art.title ? `- ${art.title}` : ''}
                          </div>
                          <p className="text-slate-600 dark:text-slate-350 whitespace-pre-wrap leading-relaxed">{art.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {reviewingRequest.admin_notes && (
                <div className="text-xs bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-150 dark:border-slate-750 text-slate-750 dark:text-slate-300">
                  <b>Önceki Not:</b> {reviewingRequest.admin_notes}
                </div>
              )}

              {reviewingRequest.status === 'pending' && (userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Onay/Red Notu (Opsiyonel)</label>
                  <textarea
                    rows={3}
                    placeholder="Personele iletilecek notunuzu buraya yazabilirsiniz..."
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-xs text-slate-700 dark:text-slate-300 font-medium resize-none"
                    value={reviewResponseNote}
                    onChange={(e) => setReviewResponseNote(e.target.value)}
                  />
                </div>
              )}
            </div>

            {reviewingRequest.status === 'pending' && (userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') && (
              <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  disabled={answeringRequest}
                  onClick={() => handleAnswerRegulationRequest(reviewingRequest, true, reviewResponseNote)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  <Check size={16} /> {answeringRequest ? 'İşleniyor...' : (reviewingRequest.draft_regulation ? 'Onayla ve Havuza Ekle' : 'Onayla')}
                </button>
                <button
                  type="button"
                  disabled={answeringRequest}
                  onClick={() => handleAnswerRegulationRequest(reviewingRequest, false, reviewResponseNote)}
                  className="flex-1 border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  <XCircle size={16} /> Reddet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Personnel Modal */}
      {showAssignModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white">
              <div>
                <h2 className="text-lg font-bold">Personel Ata</h2>
                <p className="text-xs opacity-80">{selectedClient.name}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="hover:rotate-90 transition-transform">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">Bu işletmeden sorumlu olacak personelleri seçin:</p>
              <div className="space-y-2">
                {teamMembers.map(member => (
                  <label key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {member.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold flex items-center gap-1.5">
                          {member.full_name}
                          {member.role !== 'normal' && (() => {
                            const totalDays = getPersonnelQuota(member.id);
                            const isExceeded = totalDays > 16;
                            return (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                isExceeded 
                                  ? 'bg-rose-50 text-rose-705 border-rose-200' 
                                  : totalDays > 12 
                                    ? 'bg-amber-50 text-amber-705 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-705 border-emerald-200'
                              }`}>
                                Kota: {totalDays}/16g
                              </span>
                            );
                          })()}
                        </p>
                        <p className="text-[10px] text-gray-400">{member.email}</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={currentAssignments.includes(member.id)}
                      onChange={() => handleToggleAssign(member.id)}
                    />
                  </label>
                ))}
                {teamMembers.length === 0 && (
                  <p className="text-center text-gray-400 py-4 italic">Henüz ekip üyesi bulunmuyor.</p>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t flex justify-end">
              <button 
                onClick={() => setShowAssignModal(false)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Yeni İşletme Ekle</h2>
              <button onClick={() => setShowAddClient(false)} className="text-gray-400 hover:text-gray-600">
                X
              </button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ünvanı *</label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vergi No</label>
                <input
                  type="text"
                  value={newClient.tax_no}
                  onChange={(e) => setNewClient({ ...newClient, tax_no: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Adres</label>
                <textarea
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <input
                  type="text"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">KEP Adresi</label>
                <input
                  type="text"
                  value={newClient.kep_address || ''}
                  onChange={(e) => setNewClient({ ...newClient, kep_address: e.target.value })}
                  placeholder="örnek@hs01.kep.tr"
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Çevre İzin/Lisans Kapsamı</label>
                <select
                  value={newClient.permit_stage}
                  onChange={(e) => {
                    const stage = e.target.value;
                    setNewClient({ ...newClient, permit_stage: stage, permit_articles: [] });
                    setNewClientArticleSearch('');
                  }}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 bg-white dark:text-white"
                >
                  <option value="out_of_scope">Kapsam Dışı</option>
                  <option value="ek1">EK-1 (Çevreye Kirletici Etkisi Yüksek Tesisler)</option>
                  <option value="ek2">EK-2 (Çevreye Kirletici Etkisi Olan Tesisler)</option>
                </select>
              </div>

              {(newClient.permit_stage === 'ek1' || newClient.permit_stage === 'ek2') && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      İzin/Lisans Maddeleri ({newClient.permit_articles.length} Seçildi)
                    </label>
                    {newClient.permit_articles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewClient({ ...newClient, permit_articles: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Maddelerde ara (örn: Enerji, 1.1)..."
                    value={newClientArticleSearch}
                    onChange={(e) => setNewClientArticleSearch(e.target.value)}
                    className="w-full border rounded-lg p-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                  />
                  <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded p-1 space-y-1 bg-white dark:bg-slate-950">
                    {(() => {
                      const articlesList = permitCategories.filter(c => c.stage === (newClient.permit_stage || 'ek1'));
                      const filtered = articlesList.filter(art =>
                        art.code.toLowerCase().includes(newClientArticleSearch.toLowerCase()) ||
                        art.title.toLowerCase().includes(newClientArticleSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <p className="text-center text-xs text-gray-450 py-2 italic">Eşleşen madde bulunamadı.</p>;
                      }
                      return filtered.map((art) => {
                        const isChecked = newClient.permit_articles.includes(art.code);
                        return (
                          <label
                            key={art.code}
                            className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleNewClientArticle(art.code)}
                              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span>
                              <strong className="text-blue-700 dark:text-blue-400 mr-1">{art.code}</strong>
                              {art.title}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">ÇED Durumu</label>
                <select
                  value={newClient.ced_status}
                  onChange={(e) => {
                    setNewClient({ ...newClient, ced_status: e.target.value, ced_articles: [] });
                    setNewClientCedSearch('');
                  }}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 bg-white dark:text-white"
                >
                  <option value="out_of_scope">Kapsam Dışı</option>
                  <option value="ek1">EK-1 (ÇED Uygulanacak Projeler)</option>
                  <option value="ek2">EK-2 (ÇED Ön İnceleme ve Değerlendirmeye Tabi Projeler)</option>
                </select>
              </div>

              {(newClient.ced_status === 'ek1' || newClient.ced_status === 'ek2') && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      ÇED Proje Kategorileri ({newClient.ced_articles.length} Seçildi)
                    </label>
                    {newClient.ced_articles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewClient({ ...newClient, ced_articles: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Maddelerde ara (örn: rafineri, 4)..."
                    value={newClientCedSearch}
                    onChange={(e) => setNewClientCedSearch(e.target.value)}
                    className="w-full border rounded-lg p-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                  />
                  <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded p-1 space-y-1 bg-white dark:bg-slate-950">
                    {(() => {
                      const articlesList = cedCategories.filter((c) => c.stage === newClient.ced_status);
                      const filtered = articlesList.filter(art =>
                        art.code.toLowerCase().includes(newClientCedSearch.toLowerCase()) ||
                        art.title.toLowerCase().includes(newClientCedSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        if (articlesList.length === 0) {
                          return (
                            <p className="text-center text-xs text-amber-600 py-3 px-2 italic">
                              Bu liste henüz boş görünüyor. Sistem admininin "add_ced_status_and_admin_lists.sql" dosyasını veritabanında çalıştırması gerekebilir.
                            </p>
                          );
                        }
                        return <p className="text-center text-xs text-gray-450 py-2 italic">Eşleşen madde bulunamadı.</p>;
                      }
                      return filtered.map((art) => {
                        const isChecked = newClient.ced_articles.includes(art.code);
                        return (
                          <label
                            key={art.code}
                            className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                              isChecked
                                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleNewClientCedArticle(art.code)}
                              className="mt-0.5 w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                            />
                            <span>
                              <strong className="text-teal-700 dark:text-teal-400 mr-1">{art.code}</strong>
                              {art.title}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Hizmet Başlangıç Tarihi</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm font-medium"
                    value={newClient.service_start_date}
                    onChange={(e) => setNewClient({ ...newClient, service_start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Sözleşme Dosyası (.pdf, görsel)</label>
                  <div className="flex items-center gap-2">
                    {newClient.contract_file_url ? (
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border w-full justify-between">
                        <a href={newClient.contract_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[180px]">
                          Sözleşmeyi Gör ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => setNewClient({ ...newClient, contract_file_url: '' })}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          Sil
                        </button>
                      </div>
                    ) : (
                      <label className="w-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                        <Upload size={14} className="text-gray-400 mr-1.5" />
                        <span className="text-xs text-gray-500 font-medium">
                          {uploadingContract ? 'Yükleniyor...' : 'Sözleşme Yükle'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) => handleContractUpload(e, false)}
                          disabled={uploadingContract}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konum Koordinatları</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Enlem (Latitude)"
                    value={newClient.latitude !== null ? newClient.latitude : ''}
                    onChange={(e) => setNewClient({ ...newClient, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-1/2 border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Boylam (Longitude)"
                    value={newClient.longitude !== null ? newClient.longitude : ''}
                    onChange={(e) => setNewClient({ ...newClient, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-1/2 border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddClientMap(true)}
                  className="w-full bg-[#2ca58d] hover:bg-[#238c75] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <MapPin size={14} /> Haritadan Konum Seç
                </button>
                {newClient.area_points.length >= 3 && (
                  <p className="text-[11px] text-teal-600 font-bold mt-1">
                    ✓ İşletme alanı çizildi: {formatArea(calculatePolygonAreaM2(newClient.area_points))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Firma Logosu (Opsiyonel)</label>
                <div className="flex items-center gap-4">
                  {newClient.logo_url ? (
                    <div className="relative">
                      <img src={newClient.logo_url} alt="Önizleme" className="w-16 h-16 rounded border object-contain bg-gray-50" />
                      <button
                        type="button"
                        onClick={() => setNewClient({...newClient, logo_url: ''})}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition">
                      <Upload className="text-gray-400 mb-2" size={24} />
                      <span className="text-xs text-gray-500">{uploadingLogo ? 'Yükleniyor...' : 'Bilgisayardan Seç'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                  )}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddClient(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranchModal && branchParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <GitBranchPlus size={20} className="text-teal-600" /> Şube Ekle
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-bold">{branchParent.name}</span> firmasına yeni bir şube ekleniyor. Bilgiler ana firmadan kopyalandı, dilediğiniz alanı değiştirebilirsiniz.
                </p>
              </div>
              <button onClick={() => setShowAddBranchModal(false)} className="text-gray-400 hover:text-gray-600">
                X
              </button>
            </div>
            <form onSubmit={handleAddBranch} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Şube Adı *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="örn: Atölye Şube"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  İşletme adı olarak kaydedilecek: <span className="font-bold text-gray-600 dark:text-gray-300">{branchParent.name} {newBranch.name || '...'}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vergi No</label>
                <input
                  type="text"
                  value={newBranch.tax_no}
                  onChange={(e) => setNewBranch({ ...newBranch, tax_no: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Şubeler için vergi no tekillik kontrolü uygulanmaz; ana firmayla aynı veya farklı bir numara girebilirsiniz.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Şube Adresi</label>
                <textarea
                  value={newBranch.address}
                  onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                  placeholder="Ana firmadan farklıysa şubenin adresini girin"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Şube Telefonu</label>
                <input
                  type="text"
                  value={newBranch.phone}
                  onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">KEP Adresi</label>
                <input
                  type="text"
                  value={newBranch.kep_address}
                  onChange={(e) => setNewBranch({ ...newBranch, kep_address: e.target.value })}
                  placeholder="örnek@hs01.kep.tr"
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Çevre İzin/Lisans Kapsamı</label>
                <select
                  value={newBranch.permit_stage}
                  onChange={(e) => {
                    setNewBranch({ ...newBranch, permit_stage: e.target.value, permit_articles: [] });
                    setBranchArticleSearch('');
                  }}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 bg-white dark:text-white"
                >
                  <option value="out_of_scope">Kapsam Dışı</option>
                  <option value="ek1">EK-1 (Çevreye Kirletici Etkisi Yüksek Tesisler)</option>
                  <option value="ek2">EK-2 (Çevreye Kirletici Etkisi Olan Tesisler)</option>
                </select>
              </div>

              {(newBranch.permit_stage === 'ek1' || newBranch.permit_stage === 'ek2') && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      İzin/Lisans Maddeleri ({newBranch.permit_articles.length} Seçildi)
                    </label>
                    {newBranch.permit_articles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewBranch({ ...newBranch, permit_articles: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Maddelerde ara (örn: Enerji, 1.1)..."
                    value={branchArticleSearch}
                    onChange={(e) => setBranchArticleSearch(e.target.value)}
                    className="w-full border rounded-lg p-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                  />
                  <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded p-1 space-y-1 bg-white dark:bg-slate-950">
                    {(() => {
                      const articlesList = permitCategories.filter(c => c.stage === (newBranch.permit_stage || 'ek1'));
                      const filtered = articlesList.filter(art =>
                        art.code.toLowerCase().includes(branchArticleSearch.toLowerCase()) ||
                        art.title.toLowerCase().includes(branchArticleSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <p className="text-center text-xs text-gray-450 py-2 italic">Eşleşen madde bulunamadı.</p>;
                      }
                      return filtered.map((art) => {
                        const isChecked = newBranch.permit_articles.includes(art.code);
                        return (
                          <label
                            key={art.code}
                            className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleNewBranchArticle(art.code)}
                              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span>
                              <strong className="text-blue-700 dark:text-blue-400 mr-1">{art.code}</strong>
                              {art.title}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">ÇED Durumu</label>
                <select
                  value={newBranch.ced_status}
                  onChange={(e) => {
                    setNewBranch({ ...newBranch, ced_status: e.target.value, ced_articles: [] });
                    setNewBranchCedSearch('');
                  }}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 bg-white dark:text-white"
                >
                  <option value="out_of_scope">Kapsam Dışı</option>
                  <option value="ek1">EK-1 (ÇED Uygulanacak Projeler)</option>
                  <option value="ek2">EK-2 (ÇED Ön İnceleme ve Değerlendirmeye Tabi Projeler)</option>
                </select>
              </div>

              {(newBranch.ced_status === 'ek1' || newBranch.ced_status === 'ek2') && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      ÇED Proje Kategorileri ({newBranch.ced_articles.length} Seçildi)
                    </label>
                    {newBranch.ced_articles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewBranch({ ...newBranch, ced_articles: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Maddelerde ara (örn: rafineri, 4)..."
                    value={newBranchCedSearch}
                    onChange={(e) => setNewBranchCedSearch(e.target.value)}
                    className="w-full border rounded-lg p-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                  />
                  <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded p-1 space-y-1 bg-white dark:bg-slate-950">
                    {(() => {
                      const articlesList = cedCategories.filter((c) => c.stage === newBranch.ced_status);
                      const filtered = articlesList.filter(art =>
                        art.code.toLowerCase().includes(newBranchCedSearch.toLowerCase()) ||
                        art.title.toLowerCase().includes(newBranchCedSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        if (articlesList.length === 0) {
                          return (
                            <p className="text-center text-xs text-amber-600 py-3 px-2 italic">
                              Bu liste henüz boş görünüyor. Sistem admininin "add_ced_status_and_admin_lists.sql" dosyasını veritabanında çalıştırması gerekebilir.
                            </p>
                          );
                        }
                        return <p className="text-center text-xs text-gray-450 py-2 italic">Eşleşen madde bulunamadı.</p>;
                      }
                      return filtered.map((art) => {
                        const isChecked = newBranch.ced_articles.includes(art.code);
                        return (
                          <label
                            key={art.code}
                            className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                              isChecked
                                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleNewBranchCedArticle(art.code)}
                              className="mt-0.5 w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                            />
                            <span>
                              <strong className="text-teal-700 dark:text-teal-400 mr-1">{art.code}</strong>
                              {art.title}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Hizmet Başlangıç Tarihi</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm font-medium"
                    value={newBranch.service_start_date}
                    onChange={(e) => setNewBranch({ ...newBranch, service_start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Sözleşme Dosyası (.pdf, görsel)</label>
                  <div className="flex items-center gap-2">
                    {newBranch.contract_file_url ? (
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border w-full justify-between">
                        <a href={newBranch.contract_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[180px]">
                          Sözleşmeyi Gör ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => setNewBranch({ ...newBranch, contract_file_url: '' })}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          Sil
                        </button>
                      </div>
                    ) : (
                      <label className="w-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                        <Upload size={14} className="text-gray-400 mr-1.5" />
                        <span className="text-xs text-gray-500 font-medium">
                          {uploadingBranchContract ? 'Yükleniyor...' : 'Sözleşme Yükle'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={handleBranchContractUpload}
                          disabled={uploadingBranchContract}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konum Koordinatları</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Enlem (Latitude)"
                    value={newBranch.latitude !== null ? newBranch.latitude : ''}
                    onChange={(e) => setNewBranch({ ...newBranch, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-1/2 border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Boylam (Longitude)"
                    value={newBranch.longitude !== null ? newBranch.longitude : ''}
                    onChange={(e) => setNewBranch({ ...newBranch, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-1/2 border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddBranchMap(true)}
                  className="w-full bg-[#2ca58d] hover:bg-[#238c75] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <MapPin size={14} /> Haritadan Konum Seç
                </button>
                {newBranch.area_points.length >= 3 && (
                  <p className="text-[11px] text-teal-600 font-bold mt-1">
                    ✓ İşletme alanı çizildi: {formatArea(calculatePolygonAreaM2(newBranch.area_points))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Şube Logosu (Opsiyonel)</label>
                <div className="flex items-center gap-4">
                  {newBranch.logo_url ? (
                    <div className="relative">
                      <img src={newBranch.logo_url} alt="Önizleme" className="w-16 h-16 rounded border object-contain bg-gray-50" />
                      <button
                        type="button"
                        onClick={() => setNewBranch({ ...newBranch, logo_url: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition">
                      <Upload className="text-gray-400 mb-2" size={24} />
                      <span className="text-xs text-gray-500">{uploadingBranchLogo ? 'Yükleniyor...' : 'Bilgisayardan Seç'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleBranchLogoUpload} disabled={uploadingBranchLogo} />
                    </label>
                  )}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingBranch}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
                >
                  {savingBranch ? 'Kaydediliyor...' : 'Şubeyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddBranchMap && (
        <MapPickerModal
          isOpen={showAddBranchMap}
          onClose={() => setShowAddBranchMap(false)}
          initialLat={newBranch.latitude}
          initialLng={newBranch.longitude}
          initialAreaPoints={newBranch.area_points}
          onSelect={(lat, lng, addressVal, areaPointsVal) => {
            setNewBranch((prev) => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              address: prev.address || addressVal || '',
              area_points: areaPointsVal || [],
            }));
            setShowAddBranchMap(false);
          }}
        />
      )}

      {/* Edit Client Modal */}
      {showEditClient && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">İşletme Bilgilerini Düzenle</h2>
              <button 
                onClick={() => {
                  setShowEditClient(false);
                  setEditingClient(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>
            <form onSubmit={handleUpdateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ünvanı *</label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vergi No</label>
                <input
                  type="text"
                  value={editingClient.tax_no || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, tax_no: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Adres</label>
                <textarea
                  value={editingClient.address || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <input
                  type="text"
                  value={editingClient.phone || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">KEP Adresi</label>
                <input
                  type="text"
                  value={editingClient.kep_address || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, kep_address: e.target.value })}
                  placeholder="örnek@hs01.kep.tr"
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Çevre İzin/Lisans Kapsamı</label>
                <select
                  value={editingClient.permit_stage || 'out_of_scope'}
                  onChange={(e) => {
                    const stage = e.target.value;
                    setEditingClient({ ...editingClient, permit_stage: stage, permit_articles: [] });
                    setEditClientArticleSearch('');
                  }}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 bg-white dark:text-white"
                >
                  <option value="out_of_scope">Kapsam Dışı</option>
                  <option value="ek1">EK-1 (Çevreye Kirletici Etkisi Yüksek Tesisler)</option>
                  <option value="ek2">EK-2 (Çevreye Kirletici Etkisi Olan Tesisler)</option>
                </select>
              </div>

              {(editingClient.permit_stage === 'ek1' || editingClient.permit_stage === 'ek2') && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      İzin/Lisans Maddeleri ({(editingClient.permit_articles || []).length} Seçildi)
                    </label>
                    {(editingClient.permit_articles || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditingClient({ ...editingClient, permit_articles: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Maddelerde ara (örn: Enerji, 1.1)..."
                    value={editClientArticleSearch}
                    onChange={(e) => setEditClientArticleSearch(e.target.value)}
                    className="w-full border rounded-lg p-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                  />
                  <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded p-1 space-y-1 bg-white dark:bg-slate-950">
                    {(() => {
                      const articlesList = permitCategories.filter(c => c.stage === (editingClient.permit_stage || 'ek1'));
                      const filtered = articlesList.filter(art =>
                        art.code.toLowerCase().includes(editClientArticleSearch.toLowerCase()) ||
                        art.title.toLowerCase().includes(editClientArticleSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <p className="text-center text-xs text-gray-455 py-2 italic">Eşleşen madde bulunamadı.</p>;
                      }
                      return filtered.map((art) => {
                        const isChecked = (editingClient.permit_articles || []).includes(art.code);
                        return (
                          <label
                            key={art.code}
                            className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleEditClientArticle(art.code)}
                              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span>
                              <strong className="text-blue-700 dark:text-blue-400 mr-1">{art.code}</strong>
                              {art.title}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">ÇED Durumu</label>
                <select
                  value={editingClient.ced_status || 'out_of_scope'}
                  onChange={(e) => {
                    setEditingClient({ ...editingClient, ced_status: e.target.value, ced_articles: [] });
                    setEditClientCedSearch('');
                  }}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 bg-white dark:text-white"
                >
                  <option value="out_of_scope">Kapsam Dışı</option>
                  <option value="ek1">EK-1 (ÇED Uygulanacak Projeler)</option>
                  <option value="ek2">EK-2 (ÇED Ön İnceleme ve Değerlendirmeye Tabi Projeler)</option>
                </select>
              </div>

              {(editingClient.ced_status === 'ek1' || editingClient.ced_status === 'ek2') && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      ÇED Proje Kategorileri ({(editingClient.ced_articles || []).length} Seçildi)
                    </label>
                    {(editingClient.ced_articles || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditingClient({ ...editingClient, ced_articles: [] })}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Maddelerde ara (örn: rafineri, 4)..."
                    value={editClientCedSearch}
                    onChange={(e) => setEditClientCedSearch(e.target.value)}
                    className="w-full border rounded-lg p-1.5 text-xs dark:bg-slate-800 dark:border-slate-700"
                  />
                  <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded p-1 space-y-1 bg-white dark:bg-slate-950">
                    {(() => {
                      const articlesList = cedCategories.filter((c) => c.stage === editingClient.ced_status);
                      const filtered = articlesList.filter(art =>
                        art.code.toLowerCase().includes(editClientCedSearch.toLowerCase()) ||
                        art.title.toLowerCase().includes(editClientCedSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        if (articlesList.length === 0) {
                          return (
                            <p className="text-center text-xs text-amber-600 py-3 px-2 italic">
                              Bu liste henüz boş görünüyor. Sistem admininin "add_ced_status_and_admin_lists.sql" dosyasını veritabanında çalıştırması gerekebilir.
                            </p>
                          );
                        }
                        return <p className="text-center text-xs text-gray-450 py-2 italic">Eşleşen madde bulunamadı.</p>;
                      }
                      return filtered.map((art) => {
                        const isChecked = (editingClient.ced_articles || []).includes(art.code);
                        return (
                          <label
                            key={art.code}
                            className={`flex items-start gap-2 p-1.5 rounded cursor-pointer text-xs transition ${
                              isChecked
                                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleEditClientCedArticle(art.code)}
                              className="mt-0.5 w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                            />
                            <span>
                              <strong className="text-teal-700 dark:text-teal-400 mr-1">{art.code}</strong>
                              {art.title}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Hizmet Başlangıç Tarihi</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm font-medium"
                    value={editingClient.service_start_date || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, service_start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Sözleşme Dosyası (.pdf, görsel)</label>
                  <div className="flex items-center gap-2">
                    {editingClient.contract_file_url ? (
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border w-full justify-between">
                        <a href={editingClient.contract_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[180px]">
                          Sözleşmeyi Gör ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => setEditingClient({ ...editingClient, contract_file_url: '' })}
                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          Sil
                        </button>
                      </div>
                    ) : (
                      <label className="w-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition">
                        <Upload size={14} className="text-gray-400 mr-1.5" />
                        <span className="text-xs text-gray-500 font-medium">
                          {uploadingContract ? 'Yükleniyor...' : 'Sözleşme Yükle'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) => handleContractUpload(e, true)}
                          disabled={uploadingContract}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konum Koordinatları</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Enlem (Latitude)"
                    value={editingClient.latitude !== null && editingClient.latitude !== undefined ? editingClient.latitude : ''}
                    onChange={(e) => setEditingClient({ ...editingClient, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-1/2 border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Boylam (Longitude)"
                    value={editingClient.longitude !== null && editingClient.longitude !== undefined ? editingClient.longitude : ''}
                    onChange={(e) => setEditingClient({ ...editingClient, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-1/2 border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditClientMap(true)}
                  className="w-full bg-[#2ca58d] hover:bg-[#238c75] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <MapPin size={14} /> Haritadan Konum Seç
                </button>
                {(editingClient.area_points || []).length >= 3 && (
                  <p className="text-[11px] text-teal-600 font-bold mt-1">
                    ✓ İşletme alanı çizildi: {formatArea(calculatePolygonAreaM2(editingClient.area_points))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Firma Logosu (Opsiyonel)</label>
                <div className="flex items-center gap-4">
                  {editingClient.logo_url ? (
                    <div className="relative">
                      <img src={editingClient.logo_url} alt="Önizleme" className="w-16 h-16 rounded border object-contain bg-gray-50" />
                      <button 
                        type="button"
                        onClick={() => setEditingClient({...editingClient, logo_url: ''})}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition">
                      <span className="text-xs text-gray-500">{uploadingLogo ? 'Yükleniyor...' : 'Bilgisayardan Seç'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, true)} disabled={uploadingLogo} />
                    </label>
                  )}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClient(false);
                    setEditingClient(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {showClientChangeRequestModal && selectedClientForChangeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Ünvan / Adres Değişikliği Talebi</h2>
              <button 
                onClick={() => {
                  setShowClientChangeRequestModal(false);
                  setSelectedClientForChangeRequest(null);
                }} 
                className="text-gray-400 hover:text-gray-605 dark:text-gray-300"
              >
                X
              </button>
            </div>
            <form onSubmit={handleClientChangeRequestSubmit} className="p-6 space-y-4">
              <div className="text-xs p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200/50">
                <b>Mevcut Bilgiler:</b>
                <div className="mt-1">Ünvan: {selectedClientForChangeRequest.name}</div>
                <div>Adres: {selectedClientForChangeRequest.address || 'Belirtilmemiş'}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Yeni Ünvan (Değişmeyecekse boş bırakın)</label>
                <input
                  type="text"
                  value={changeRequestNewName}
                  onChange={(e) => setChangeRequestNewName(e.target.value)}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                  placeholder={selectedClientForChangeRequest.name}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Yeni Adres (Değişmeyecekse boş bırakın)</label>
                <textarea
                  value={changeRequestNewAddress}
                  onChange={(e) => setChangeRequestNewAddress(e.target.value)}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                  placeholder={selectedClientForChangeRequest.address}
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ticaret Sicil Gazetesi PDF *</label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setChangeRequestPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowClientChangeRequestModal(false);
                    setSelectedClientForChangeRequest(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 dark:text-gray-300 dark:border-slate-750"
                  disabled={submittingClientChangeRequest}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={submittingClientChangeRequest}
                >
                  {submittingClientChangeRequest ? 'Talep Gönderiliyor...' : 'Talep Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showRoleChangeRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Ünvan Değişikliği Talebi</h2>
              <button
                onClick={() => setShowRoleChangeRequestModal(false)}
                className="text-gray-400 hover:text-gray-605 dark:text-gray-300"
              >
                X
              </button>
            </div>
            <form onSubmit={handleSubmitRoleChangeRequest} className="p-6 space-y-4">
              <div className="text-xs p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 rounded-lg border border-purple-200/50">
                Mevcut ünvanınız: <b>{roleLabels[userRole] || userRole}</b>. Talebiniz firma sahibine iletilir, onaylanırsa ünvanınız değişir.
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Talep Edilen Ünvan</label>
                <select
                  value={roleChangeRequestTo}
                  onChange={(e) => setRoleChangeRequestTo(e.target.value)}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="corporate_chief">Çevre Danışmanlık Firma Yöneticisi (Şef)</option>
                  <option value="corporate_staff">Çevre Danışmanlık Personeli</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gerekçe (opsiyonel)</label>
                <textarea
                  value={roleChangeRequestReason}
                  onChange={(e) => setRoleChangeRequestReason(e.target.value)}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                  placeholder="Örn: 2 yıldır ekibi yönetiyorum, şef ünvanı talep ediyorum."
                ></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoleChangeRequestModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 dark:text-gray-300 dark:border-slate-750"
                  disabled={submittingRoleChangeRequest}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={submittingRoleChangeRequest}
                >
                  {submittingRoleChangeRequest ? 'Gönderiliyor...' : 'Talep Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- YENİ: ÖZEL MEVZUAT EKLEME MODALİ --- */}
      {showAddCustomLegModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 border border-slate-100 dark:border-slate-700 animate-fadeIn flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <BookOpen size={18} className="text-teal-600" />
                {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual')
                  ? 'Yeni Özel Mevzuat & Yönetmelik Ekle'
                  : 'Yeni Mevzuat Talebi (Yöneticinizin Onayına Gönderilecek)'}
              </h3>
              <button 
                onClick={() => setShowAddCustomLegModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-650 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLegislation} className="overflow-y-auto space-y-6 pr-2 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Mevzuat / Yönetmelik Başlığı *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: BCD İşletmesi Özel İSG Prosedürü"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-350 border-slate-200"
                    value={legTitle}
                    onChange={(e) => setLegTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Kategori</label>
                  <select
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-350 border-slate-200"
                    value={legCategory}
                    onChange={(e) => setLegCategory(e.target.value)}
                  >
                    <option value="Yönetmelik">Yönetmelik</option>
                    <option value="Kanun">Kanun</option>
                    <option value="Yönerge">Yönerge</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Yayın Tarihi</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-350 border-slate-200"
                    value={legPubDate}
                    onChange={(e) => setLegPubDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">Yürürlük Tarihi</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-350 border-slate-200"
                    value={legEffDate}
                    onChange={(e) => setLegEffDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">RG No</label>
                  <input
                    type="text"
                    placeholder="Örn: RG-12345"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-350 border-slate-200"
                    value={legRgNo}
                    onChange={(e) => setLegRgNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1.5 uppercase">RG Tarihi</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 text-sm font-semibold text-slate-700 dark:text-slate-350 border-slate-200"
                    value={legRgDate}
                    onChange={(e) => setLegRgDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Maddeleri Ayrıştırma Bölümü */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-150 dark:border-slate-750 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <PlusCircle size={16} className="text-teal-650" />
                      Maddeleri Otomatik Ayrıştır
                    </h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500">
                      Mevzuat metnini yapıştırarak ya da PDF yükleyerek "MADDE X" şeklinde otomatik ayrıştırabilirsiniz.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setParsingTextMode(!parsingTextMode)}
                      className="text-[11px] font-bold text-slate-700 hover:bg-slate-100 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition"
                    >
                      {parsingTextMode ? 'Kapat' : 'Metin Yapıştır'}
                    </button>
                    <label className="text-[11px] font-bold text-white hover:bg-teal-700 bg-teal-600 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1">
                      <Upload size={12} />
                      {parsingPdf ? 'PDF Ayrıştırılıyor...' : 'PDF Yükle'}
                      <input
                        type="file"
                        accept=".pdf"
                        disabled={parsingPdf}
                        onChange={handleParsePdf}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {parsingTextMode && (
                  <div className="space-y-2 animate-fadeIn">
                    <textarea
                      rows={6}
                      placeholder="Mevzuat metnini buraya yapıştırın (Örn: MADDE 1 - Bu yönetmeliğin amacı...)"
                      className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 outline-none resize-none font-mono"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleParseText}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                    >
                      Metni Ayrıştır
                    </button>
                  </div>
                )}
              </div>

              {/* Maddeler Listesi Önizleme / Düzenleme */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                    Mevzuat Maddeleri ({legArticles.length} Adet)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddEmptyArticle}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition shadow-sm"
                  >
                    <PlusCircle size={13} /> Manuel Madde Ekle
                  </button>
                </div>

                {legArticles.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/20 text-xs text-slate-400 italic">
                    Henüz madde eklenmedi. Yukarıdan PDF/Metin ayrıştırabilir veya "Manuel Madde Ekle" butonu ile elle maddeleri girmeye başlayabilirsiniz.
                  </div>
                ) : (
                  <div className="border border-slate-150 dark:border-slate-750 rounded-2xl divide-y max-h-80 overflow-y-auto bg-slate-50/20 p-2 space-y-3">
                    {legArticles.map((art, idx) => (
                      <div key={idx} className="p-3.5 space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm relative group">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <div className="md:col-span-3">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Madde No</label>
                            <input
                              type="text"
                              required
                              placeholder="Örn: MADDE 1"
                              className="w-full p-2 rounded-lg border bg-white dark:bg-slate-850 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 outline-none focus:ring-1 focus:ring-teal-500"
                              value={art.article_no}
                              onChange={(e) => handleUpdateArticleField(idx, 'article_no', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-6">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Madde Başlığı</label>
                            <input
                              type="text"
                              placeholder="Örn: Amaç ve Kapsam"
                              className="w-full p-2 rounded-lg border bg-white dark:bg-slate-850 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 outline-none focus:ring-1 focus:ring-teal-500"
                              value={art.title}
                              onChange={(e) => handleUpdateArticleField(idx, 'title', e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-3 flex items-center justify-end gap-1.5 pt-4">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveArticle(idx, 'up')}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-500 transition"
                              title="Yukarı Taşı"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === legArticles.length - 1}
                              onClick={() => handleMoveArticle(idx, 'down')}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded-lg text-slate-500 transition"
                              title="Aşağı Taşı"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteArticle(idx)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded-lg transition ml-2"
                              title="Maddeyi Sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Madde Metni / İçeriği</label>
                          <textarea
                            required
                            rows={3}
                            placeholder="Madde metnini buraya giriniz..."
                            className="w-full p-2 rounded-lg border bg-white dark:bg-slate-850 dark:border-slate-700 text-xs text-slate-650 dark:text-slate-300 border-slate-200 outline-none resize-y focus:ring-1 focus:ring-teal-500 font-medium"
                            value={art.content}
                            onChange={(e) => handleUpdateArticleField(idx, 'content', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-750">
                <button
                  type="submit"
                  disabled={savingLegislation}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:shadow-none text-sm"
                >
                  {savingLegislation ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                  {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual') ? 'Kaydet & Havuza Ekle' : 'Onaya Gönder'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCustomLegModal(false)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- YENİ: AKSİYON DETAY MODALI --- */}
      {showDetailsModal && selectedActionDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-lg">
                <CheckCircle size={18} className="text-teal-600" />
                Aksiyon Ayrıntıları
              </h3>
              <button 
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedActionDetails(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Firma Adı</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedActionDetails.client?.name || 'Genel / Belirtilmemiş'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Aksiyon Başlığı</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedActionDetails.title}</span>
              </div>

              {selectedActionDetails.description && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Açıklama / Detaylar</span>
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 whitespace-pre-wrap leading-relaxed mt-1">
                    {selectedActionDetails.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Sorumlu Personel</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedActionDetails.assignee?.full_name ||
                      (selectedActionDetails.assigned_to ? 'Atanmamış' : '🏢 Tüm Ekip / Firma Geneli')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Oluşturan / Atayan</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedActionDetails.creator?.full_name || 'Yönetici'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Son Tarih</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {selectedActionDetails.due_date ? new Date(selectedActionDetails.due_date).toLocaleDateString('tr-TR') : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Güncel Durum</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase mt-1 inline-block ${
                    selectedActionDetails.status === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : selectedActionDetails.status === 'completed'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : selectedActionDetails.status === 'correction_requested'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {selectedActionDetails.status === 'pending' ? 'Bekliyor' :
                     selectedActionDetails.status === 'completed' ? 'Onay Bekliyor' :
                     selectedActionDetails.status === 'correction_requested' ? 'Düzeltme İstendi' : 'Onaylandı (Tamamlandı)'}
                  </span>
                </div>
              </div>

              {/* Personel Notları ve Yüklenen Kanıt */}
              {(selectedActionDetails.notes || selectedActionDetails.evidence_url) && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Personel Kanıt Bildirimi</div>
                  {selectedActionDetails.notes && (
                    <p className="text-xs text-slate-700 dark:text-slate-355 whitespace-pre-wrap">{selectedActionDetails.notes}</p>
                  )}
                  {selectedActionDetails.evidence_url && (
                    <a
                      href={selectedActionDetails.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-teal-600 dark:text-teal-400 font-bold hover:underline block"
                    >
                      Yüklenen Kanıt Dosyasını Aç (PDF/Resim) ↗
                    </a>
                  )}
                </div>
              )}

              {/* Düzeltme Yorumu */}
              {selectedActionDetails.status === 'correction_requested' && selectedActionDetails.manager_comment && (
                <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  <span className="font-bold text-[9px] text-rose-800 uppercase tracking-wide block">Düzeltme Talebi Gerekçesi</span>
                  <p className="text-xs text-rose-800 dark:text-rose-350 italic mt-0.5">{selectedActionDetails.manager_comment}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700 mt-4">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedActionDetails(null);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold transition text-slate-700 dark:text-slate-200 rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ ZİYARET EKLEME MODALİ */}
      {showAddVisitModal && (() => {
        const assignedClients = isManager 
          ? clients 
          : clients.filter(c => allAssignments.some(a => a.client_id === c.id && a.user_id === userId));

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 border-b pb-2 flex items-center gap-2">
                <Calendar size={18} className="text-teal-600" /> {isManager ? 'Yeni Ziyaret Planla' : 'Ziyaret Talebi Gönder'}
              </h3>
              <form onSubmit={handleCreateVisit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Hizmet Verilecek İşletme</label>
                  <select
                    required
                    value={newVisit.client_id}
                    onChange={(e) => setNewVisit({ ...newVisit, client_id: e.target.value })}
                    className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    <option value="">İşletme Seçin...</option>
                    {assignedClients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>


                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">
                    {isManager ? 'Ziyaret Tarihi' : 'Talep Edilen Ziyaret Tarihi (Sonraki Aylar)'}
                  </label>
                  <input
                    required
                    type="date"
                    value={newVisit.visit_date}
                    onChange={(e) => setNewVisit({ ...newVisit, visit_date: e.target.value })}
                    className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">
                    {isManager ? 'Açıklama / Notlar' : 'Talep Gerekçesi / Notlar'}
                  </label>
                  <textarea
                    rows={3}
                    value={newVisit.notes}
                    onChange={(e) => setNewVisit({ ...newVisit, notes: e.target.value })}
                    placeholder={isManager ? "Ziyarete ilişkin notlar ekleyin..." : "Bu ziyareti neden bu tarihte yapmak istediğinizi açıklayın..."}
                    className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm outline-none resize-none focus:ring-1 focus:ring-teal-500"
                  ></textarea>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-700 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddVisitModal(false)}
                    className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={savingVisit}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {savingVisit ? 'Kaydediliyor...' : (isManager ? 'Ziyareti Planla' : 'Talep Gönder')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ZİYARET DETAY / İŞLEMLER MODALİ */}
      {selectedVisit && !showChangeRequestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn space-y-4">
            <div className="flex justify-between items-start border-b pb-2">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Calendar size={18} className="text-teal-650" /> Ziyaret Detayları
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wide">İşletme</span>
                <p className="text-sm font-bold text-slate-850 dark:text-slate-100">{selectedVisit.client?.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wide">Tarih</span>
                  <p className="font-bold text-slate-700 dark:text-slate-200">
                    {new Date(selectedVisit.visit_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wide">Durum</span>
                  <div>
                    {selectedVisit.status === 'completed' ? (
                      <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 uppercase">Tamamlandı</span>
                    ) : selectedVisit.status === 'cancelled' ? (
                      <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-450 uppercase">İptal Edildi</span>
                    ) : (
                      <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 uppercase">Planlandı</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wide">Firmaya Atanan Personeller</span>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {selectedVisitAssignees.map((a: any) => a.full_name).join(', ') || 'Bu firmaya atanan personel bulunmuyor.'}
                </p>
              </div>

              {selectedVisit.notes && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wide">Notlar</span>
                  <p className="text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">{selectedVisit.notes}</p>
                </div>
              )}

              {/* Değişiklik Talebi Durumu */}
              {selectedVisit.change_request_status !== 'none' && (
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-750">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-400 uppercase tracking-wide">Değişiklik Talebi</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                      selectedVisit.change_request_status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : selectedVisit.change_request_status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedVisit.change_request_status === 'pending' ? 'Beklemede' : selectedVisit.change_request_status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                    </span>
                  </div>
                  {selectedVisit.change_request_status === 'pending' && selectedVisit.personnel?.full_name && (
                    <p className="text-[10px] text-slate-500 mb-1">Talep Eden: <b>{selectedVisit.personnel.full_name}</b></p>
                  )}
                  {selectedVisit.change_request_date && (
                    <p className="text-[10px] text-slate-500">Önerilen Tarih: <b>{new Date(selectedVisit.change_request_date).toLocaleDateString('tr-TR')}</b></p>
                  )}
                  {selectedVisit.change_request_reason && (
                    <p className="text-[10px] text-slate-550 dark:text-slate-400 italic mt-0.5">&ldquo;{selectedVisit.change_request_reason}&rdquo;</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-between pt-3 border-t border-gray-150 dark:border-slate-700">
              <div className="flex gap-2">
                {/* Manager actions: Complete, Cancel, Delete */}
                {isManager ? (
                  <>
                    {selectedVisit.status === 'scheduled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateVisitStatus(selectedVisit.id, 'completed');
                            setSelectedVisit(null);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                        >
                          Tamamlandı Yap
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateVisitStatus(selectedVisit.id, 'cancelled');
                            setSelectedVisit(null);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-205 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                        >
                          İptal Et
                        </button>
                      </>
                    )}
                    {selectedVisit.status !== 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateVisitStatus(selectedVisit.id, 'scheduled');
                          setSelectedVisit(null);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                      >
                        Yeniden Planla
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteVisit(selectedVisit.id);
                        setSelectedVisit(null);
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                    >
                      Sil
                    </button>
                  </>
                ) : (
                  /* Staff actions: Submit change request */
                  selectedVisit.status === 'scheduled' && selectedVisit.change_request_status !== 'pending' && (
                    <button
                      type="button"
                      onClick={() => setShowChangeRequestModal(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition"
                    >
                      Tarih Değişikliği Talep Et
                    </button>
                  )
                )}
              </div>
              
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="px-4 py-1.5 border rounded-lg text-slate-600 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TARİH DEĞİŞİKLİĞİ TALEP MODALİ */}
      {showChangeRequestModal && selectedVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 border-b pb-2 flex items-center gap-2">
              <Calendar className="text-amber-600" size={18} /> Ziyaret Tarihi Değişiklik Talebi
            </h3>
            <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border text-xs text-slate-650 dark:text-slate-350">
                <p>Müşteri: <b>{selectedVisit.client?.name}</b></p>
                <p className="mt-1">Şu Anki Tarih: <b>{new Date(selectedVisit.visit_date).toLocaleDateString('tr-TR')}</b></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Talep Edilen Yeni Tarih</label>
                <input
                  required
                  type="date"
                  value={changeRequest.requested_date}
                  onChange={(e) => setChangeRequest({ ...changeRequest, requested_date: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Değişiklik Gerekçesi</label>
                <textarea
                  required
                  rows={4}
                  value={changeRequest.reason}
                  onChange={(e) => setChangeRequest({ ...changeRequest, reason: e.target.value })}
                  placeholder="Bu ziyaret tarihini neden değiştirmek istediğinizi açıklayın..."
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm outline-none resize-none focus:ring-1 focus:ring-teal-500"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-700 justify-end">
                <button
                  type="button"
                  onClick={() => setShowChangeRequestModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submittingChangeRequest}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {submittingChangeRequest ? 'İletiliyor...' : 'Talebi Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MapPickerModal
        isOpen={showAddClientMap}
        onClose={() => setShowAddClientMap(false)}
        initialLat={newClient.latitude}
        initialLng={newClient.longitude}
        initialAreaPoints={newClient.area_points}
        onSelect={(latVal, lngVal, addressVal, areaPointsVal) => {
          setNewClient(prev => ({
            ...prev,
            latitude: latVal,
            longitude: lngVal,
            address: prev.address || addressVal || '',
            area_points: areaPointsVal || [],
          }));
          setShowAddClientMap(false);
        }}
      />

      <MapPickerModal
        isOpen={showEditClientMap}
        onClose={() => setShowEditClientMap(false)}
        initialLat={editingClient?.latitude}
        initialLng={editingClient?.longitude}
        initialAreaPoints={editingClient?.area_points}
        onSelect={(latVal, lngVal, addressVal, areaPointsVal) => {
          setEditingClient(prev => ({
            ...prev,
            latitude: latVal,
            longitude: lngVal,
            address: prev.address || addressVal || '',
            area_points: areaPointsVal || [],
          }));
          setShowEditClientMap(false);
        }}
      />

      {/* BELGE DETAY MODALİ */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn space-y-4">
            <div className="flex justify-between items-start border-b border-gray-150 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                  <FileText size={18} className="text-teal-650" /> Belge Detayları
                </h3>
                {selectedDetailDoc && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedDetailDoc.title}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedDetailDoc(null);
                }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            {loadingDetailDoc || !selectedDetailDoc ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader className="animate-spin text-teal-600" size={24} />
                <span className="text-xs text-gray-450">Belge bilgileri yükleniyor...</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-slate-900/55 rounded-xl border border-gray-150 dark:border-slate-700 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Belge Tipi / Kategori</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedDetailDoc.type_def?.label || 'Belirtilmedi'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Lokasyon / İşletme</span>
                      <span className="font-bold text-slate-850 dark:text-slate-200">
                        {selectedDetailDoc.location_def?.label || 'Belirtilmedi'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-150 dark:border-slate-700 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Alınma Tarihi</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {selectedDetailDoc.acquisition_date ? new Date(selectedDetailDoc.acquisition_date).toLocaleDateString('tr-TR') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Bitiş Tarihi</span>
                      <span className={`font-semibold ${
                        !selectedDetailDoc.is_indefinite && selectedDetailDoc.expiry_date && new Date(selectedDetailDoc.expiry_date) < new Date()
                          ? 'text-rose-600 font-bold'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}>
                        {selectedDetailDoc.is_indefinite ? 'Süresiz' : (selectedDetailDoc.expiry_date ? new Date(selectedDetailDoc.expiry_date).toLocaleDateString('tr-TR') : '-')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Son Başvuru Tarihi</span>
                      <span className="font-semibold text-orange-600">
                        {selectedDetailDoc.application_deadline ? new Date(selectedDetailDoc.application_deadline).toLocaleDateString('tr-TR') : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Açıklama</span>
                  <p className="text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                    {selectedDetailDoc.description || 'Bu belge için herhangi bir açıklama girilmemiş.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-slate-700 pt-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Yükleyen Kişi</span>
                    <span className="font-bold text-slate-850 dark:text-slate-200">
                      {selectedDetailDoc.uploader?.full_name || 'Bilinmiyor'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Oluşturulma Zamanı</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      {selectedDetailDoc.created_at ? new Date(selectedDetailDoc.created_at).toLocaleString('tr-TR') : '-'}
                    </span>
                  </div>
                </div>

                {selectedDetailDoc.file_url ? (
                  <div className="pt-3">
                    <a
                      href={selectedDetailDoc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/50 rounded-xl font-bold transition text-xs"
                    >
                      <Eye size={16} /> Belgeyi Görüntüle / İndir <ExternalLink size={14} />
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-2 text-gray-400 bg-gray-50 dark:bg-slate-900/50 border rounded-xl italic">
                    Belgeye ait yüklenmiş dosya bulunmamaktadır.
                  </div>
                )}

                {/* Durum Sor / Görevlendir Paneli (Sadece Yöneticiler için ve eğer işletme seçilmişse) */}
                {isManager && selectedDetailClient && (
                  <div className="border-t border-gray-150 dark:border-slate-700 pt-4 mt-3 space-y-3">
                    <h4 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 text-sm">
                      <Send size={14} className="text-blue-500" />
                      Personele Durumu Sor / Görevlendir ({selectedDetailClient.name})
                    </h4>
                    
                    <form onSubmit={handleAskStatus} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Muhatap Personel</label>
                          <select
                            value={askTargetUserId}
                            onChange={(e) => setAskTargetUserId(e.target.value)}
                            className="w-full border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            required
                          >
                            <option value="">Personel Seçin...</option>
                            {teamMembers.map((member) => {
                              const isAssigned = allAssignments.some(a => a.client_id === selectedDetailClient.id && a.user_id === member.id);
                              return (
                                <option key={member.id} value={member.id}>
                                  {member.full_name} {isAssigned ? '(Atanmış)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">İletişim Kanalı</label>
                          <select
                            value={askMode}
                            onChange={(e) => setAskMode(e.target.value as 'chat' | 'action')}
                            className="w-full border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="chat">Sohbet (Chat) Üzerinden Sor</option>
                            <option value="action">Yeni Aksiyon/Görev Aç</option>
                          </select>
                        </div>
                      </div>

                      {askMode === 'action' && (
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Termin Tarihi (Son Gün)</label>
                          <input
                            type="date"
                            value={askDueDate}
                            onChange={(e) => setAskDueDate(e.target.value)}
                            className="w-full border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Not / Açıklama</label>
                        <textarea
                          rows={2}
                          value={askNote}
                          onChange={(e) => setAskNote(e.target.value)}
                          placeholder={askMode === 'chat' 
                            ? `Lütfen bu evrağın durumunu kontrol edin: ${selectedDetailDoc.title}` 
                            : `Bu evrak için aksiyon talep edildi.`}
                          className="w-full border rounded-xl p-2.5 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingAsk || !askTargetUserId}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-xs disabled:opacity-55 cursor-pointer"
                      >
                        {isSubmittingAsk ? 'Gönderiliyor...' : (askMode === 'chat' ? 'Sohbete İlet ve Sor' : 'Aksiyon Oluştur ve Ata')}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-150 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedDetailDoc(null);
                }}
                className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MUAFİYET DETAY MODALİ */}
      {showExemptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn space-y-4">
            <div className="flex justify-between items-start border-b border-gray-150 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle size={18} className="text-blue-600" /> Muafiyet Bilgisi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowExemptModal(false);
                  setSelectedExemptReason(null);
                  setSelectedExemptDocType(null);
                  setSelectedExemptClientName(null);
                }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">İşletme Adı</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedExemptClientName}</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Belge Tipi</span>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedExemptDocType}</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Durum</span>
                <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-full mt-1">
                  MUAF
                </span>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Muafiyet Nedeni</span>
                <p className="text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap italic">
                  {selectedExemptReason || 'Gerekçe belirtilmemiş.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-150 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowExemptModal(false);
                  setSelectedExemptReason(null);
                  setSelectedExemptDocType(null);
                  setSelectedExemptClientName(null);
                }}
                className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EKSİK BELGE BİLGİ MODALİ */}
      {showMissingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn space-y-4">
            <div className="flex justify-between items-start border-b border-gray-150 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-600" /> Eksik Belge Bilgisi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMissingModal(false);
                  setSelectedMissingDocType(null);
                  setSelectedMissingClientName(null);
                }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">İşletme Adı</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedMissingClientName}</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Talep Edilen Belge Tipi</span>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedMissingDocType}</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Mevcut Durum</span>
                <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-full animate-pulse mt-1">
                  EKSİK
                </span>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
                <p className="text-slate-600 dark:text-slate-350 leading-relaxed">
                  Sistemde bu işletme için tanımlanmış geçerli bir <b>{selectedMissingDocType}</b> belgesi bulunamamıştır.
                </p>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  Belgeyi eklemek için "Evraklar" sayfasına giderek, bu işletme (lokasyon) adına ve ilgili belge tipine uygun yeni bir evrak kaydı oluşturabilirsiniz.
                </p>
              </div>
            </div>

            {isManager && (
              <div className="border-t border-gray-150 dark:border-slate-700 pt-4 mt-3 space-y-3">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 text-sm">
                  <Send size={14} className="text-blue-500" />
                  Personele Durumu Sor / Görevlendir
                </h4>
                
                <form onSubmit={handleAskStatusForMissing} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Muhatap Personel</label>
                      <select
                        value={askTargetUserId}
                        onChange={(e) => setAskTargetUserId(e.target.value)}
                        className="w-full border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                        required
                      >
                        <option value="">Personel Seçin...</option>
                        {teamMembers.map((member) => {
                          const clientObj = clients.find(c => c.name === selectedMissingClientName);
                          const isAssigned = clientObj ? allAssignments.some(a => a.client_id === clientObj.id && a.user_id === member.id) : false;
                          return (
                            <option key={member.id} value={member.id}>
                              {member.full_name} {isAssigned ? '(Atanmış)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">İletişim Kanalı</label>
                      <select
                        value={askMode}
                        onChange={(e) => setAskMode(e.target.value as 'chat' | 'action')}
                        className="w-full border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                      >
                        <option value="chat">Sohbet (Chat) Üzerinden Sor</option>
                        <option value="action">Yeni Aksiyon/Görev Aç</option>
                      </select>
                    </div>
                  </div>

                  {askMode === 'action' && (
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Termin Tarihi (Son Gün)</label>
                      <input
                        type="date"
                        value={askDueDate}
                        onChange={(e) => setAskDueDate(e.target.value)}
                        className="w-full border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">Not / Açıklama</label>
                    <textarea
                      rows={2}
                      value={askNote}
                      onChange={(e) => setAskNote(e.target.value)}
                      placeholder={askMode === 'chat' 
                        ? `Lütfen bu eksik evrağın durumunu kontrol edip yüklenmesini sağlayın: ${selectedMissingDocType}` 
                        : `Bu eksik evrağın temin edilmesi talep edilmiştir.`}
                      className="w-full border rounded-xl p-2.5 bg-white dark:bg-slate-900 dark:border-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAsk || !askTargetUserId}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-xs disabled:opacity-55 cursor-pointer"
                  >
                    {isSubmittingAsk ? 'Gönderiliyor...' : (askMode === 'chat' ? 'Sohbete İlet ve Sor' : 'Aksiyon Oluştur ve Ata')}
                  </button>
                </form>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-150 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowMissingModal(false);
                  setSelectedMissingDocType(null);
                  setSelectedMissingClientName(null);
                }}
                className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REDDETME AÇIKLAMASI MODALİ */}
      {showChangeRejectionModal && selectedChangeRequestForRejection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn">
            <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 mb-4 border-b pb-2 flex items-center gap-2">
              <XCircle className="text-rose-600" size={18} /> Değişiklik Talebini Reddet
            </h3>
            <form onSubmit={handleRejectChangeRequest} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border text-xs text-slate-650 dark:text-slate-350">
                <p>İşletme: <b>{selectedChangeRequestForRejection.client?.name}</b></p>
                {selectedChangeRequestForRejection.new_name && (
                  <p className="mt-1">Talep Edilen Yeni Ünvan: <b>{selectedChangeRequestForRejection.new_name}</b></p>
                )}
                {selectedChangeRequestForRejection.new_address && (
                  <p className="mt-1">Talep Edilen Yeni Adres: <b>{selectedChangeRequestForRejection.new_address}</b></p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Reddetme Gerekçesi</label>
                <textarea
                  required
                  rows={4}
                  value={changeRejectionReason}
                  onChange={(e) => setChangeRejectionReason(e.target.value)}
                  placeholder="Bu değişiklik talebini neden reddettiğinizi açıklayın..."
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 text-sm outline-none resize-none focus:ring-1 focus:ring-teal-500"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-700 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeRejectionModal(false);
                    setSelectedChangeRequestForRejection(null);
                    setChangeRejectionReason('');
                  }}
                  className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={resolvingChangeRequestId === selectedChangeRequestForRejection.id}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {resolvingChangeRequestId === selectedChangeRequestForRejection.id ? 'İşleniyor...' : 'Talebi Reddet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İŞLETME MEVZUATI YENİ MADDE EKLEME MODALİ */}
      {showAddClientArticleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-start border-b border-gray-150 dark:border-slate-700 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <PlusCircle className="text-teal-650" size={18} /> Yeni Mevzuat Maddesi Ekle
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddClientArticleModal(false);
                  setNewArtNo('');
                  setNewArtTitle('');
                  setNewArtContent('');
                }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateClientArticle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Madde No (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Madde 1, Ek Madde 2"
                  value={newArtNo}
                  onChange={(e) => setNewArtNo(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Başlık (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: Amaç ve Kapsam"
                  value={newArtTitle}
                  onChange={(e) => setNewArtTitle(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Madde İçeriği (*)</label>
                <textarea
                  required
                  rows={6}
                  value={newArtContent}
                  onChange={(e) => setNewArtContent(e.target.value)}
                  placeholder="Mevzuat maddesi veya bent metnini buraya girin..."
                  className="w-full border rounded-lg p-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none resize-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-white"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-700 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddClientArticleModal(false);
                    setNewArtNo('');
                    setNewArtTitle('');
                    setNewArtContent('');
                  }}
                  className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Madde Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İŞLETME MEVZUATI MADDE DÜZENLEME MODALİ */}
      {showEditClientArticleModal && selectedArticleForEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-start border-b border-gray-150 dark:border-slate-700 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <Edit2 className="text-teal-650" size={18} /> Mevzuat Maddesini Düzenle
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditClientArticleModal(false);
                  setSelectedArticleForEdit(null);
                  setNewArtNo('');
                  setNewArtTitle('');
                  setNewArtContent('');
                }}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditClientArticle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Madde No (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Madde 1, Ek Madde 2"
                  value={newArtNo}
                  onChange={(e) => setNewArtNo(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Başlık (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: Amaç ve Kapsam"
                  value={newArtTitle}
                  onChange={(e) => setNewArtTitle(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 dark:text-slate-400 mb-1 uppercase">Madde İçeriği (*)</label>
                <textarea
                  required
                  rows={6}
                  value={newArtContent}
                  onChange={(e) => setNewArtContent(e.target.value)}
                  placeholder="Mevzuat maddesi veya bent metnini buraya girin..."
                  className="w-full border rounded-lg p-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none resize-none focus:ring-1 focus:ring-teal-500 text-slate-800 dark:text-white"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-700 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClientArticleModal(false);
                    setSelectedArticleForEdit(null);
                    setNewArtNo('');
                    setNewArtTitle('');
                    setNewArtContent('');
                  }}
                  className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MÜŞTERİ PANELİ GİRİŞ HESABI YÖNETİM MODALİ */}
      {showClientLoginModal && selectedClientForLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 border border-slate-100 dark:border-slate-700 shadow-2xl animate-scaleIn text-gray-800 dark:text-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-150 dark:border-slate-700 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-855 dark:text-slate-100 flex items-center gap-2">
                <User className="text-teal-650" size={18} /> Müşteri Paneli Giriş Yetkisi
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowClientLoginModal(false);
                  setSelectedClientForLogin(null);
                  setClientLoginEmail('');
                  setShowAddSubAccountForm(false);
                }}
                className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {loadingClientLoginInfo ? (
              <div className="py-10 text-center text-xs text-gray-500">
                Hesap durumu kontrol ediliyor...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/30 p-3.5 rounded-xl text-xs text-teal-850 dark:text-teal-400 leading-relaxed">
                  İşletme yetkilileri bu hesapları kullanarak EvrakLab sistemine giriş yapabilir ve sadece kendi firması olan <b>{selectedClientForLogin.name}</b> verilerini görüntüleyebilir. Aynı firma için birden fazla yetkiliye ayrı giriş hesabı tanımlayabilirsiniz.
                </div>

                {clientAccounts.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-655 dark:text-slate-400 uppercase">
                      Tanımlı Giriş Hesapları ({clientAccounts.length})
                    </label>
                    {clientAccounts.map((account) => {
                      const isLinkedStaffAccount = account.role && account.role !== 'client';
                      if (isLinkedStaffAccount) {
                        return (
                          <div key={account.id} className="border border-teal-200 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/10 rounded-xl p-3.5 space-y-2">
                            <div className="flex justify-between items-center gap-2">
                              <div>
                                <span className="font-bold text-sm text-slate-850 dark:text-white">{account.full_name || account.email}</span>
                                <div className="text-[10px] text-slate-500 break-all">{account.email}</div>
                              </div>
                              <button
                                type="button"
                                disabled={savingClientLogin}
                                onClick={() => handleDeleteClientAccount(account)}
                                title="Müşteri Paneli Bağlantısını Kaldır"
                                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-900/30 rounded-lg px-2.5 py-2">
                              👤 Bu, sistemde kayıtlı bir personel/yönetici hesabı ({roleLabels[account.role] || account.role}). Kendi mevcut şifresiyle giriş yapar ve navbar'daki "Müşteri Panelim" bağlantısıyla bu firmanın panelini de görüntüleyebilir.
                            </div>
                          </div>
                        );
                      }

                      const hasToken = !!account.login_token;
                      const loginLink = window.location.origin + '/login?type=setup-password&email=' + encodeURIComponent(account.email) + '&token=' + account.login_token;
                      return (
                        <div key={account.id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-bold text-sm text-slate-850 dark:text-white break-all">{account.email}</span>
                            <button
                              type="button"
                              disabled={savingClientLogin}
                              onClick={() => handleDeleteClientAccount(account)}
                              title="Hesabı Sil"
                              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {!hasToken ? (
                            <div className="space-y-2.5">
                              <div className="bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-200 dark:border-emerald-900/30 p-3 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-semibold">
                                🟢 Bu hesap aktiftir ve şifresi kullanıcı tarafından belirlenmiştir.
                              </div>
                              <button
                                type="button"
                                disabled={savingClientLogin}
                                onClick={() => handleRegenerateAccountToken(account)}
                                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                🔑 Yeni Şifre Kurulum Bağlantısı Oluştur
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/30 p-3 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                                🟠 Şifre belirleme bağlantısı bekleniyor.
                              </div>
                              <textarea
                                readOnly
                                value={loginLink}
                                rows={2}
                                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                className="w-full border rounded-lg p-2 bg-slate-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-xs font-mono font-semibold outline-none focus:ring-1 focus:ring-teal-500 text-slate-700 dark:text-slate-300"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(loginLink);
                                    alert('Kurulum bağlantısı panoya kopyalandı!');
                                  }}
                                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold py-2 px-3 rounded-lg transition border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                  📋 Bağlantıyı Kopyala
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const subject = encodeURIComponent('EvrakLab Müşteri Portalı Şifre Belirleme Bağlantısı - ' + selectedClientForLogin.name);
                                    const body = encodeURIComponent('Merhaba,\n\nEvrakLab sistemindeki müşteri panelinizin şifresini belirlemek için lütfen aşağıdaki şifre kurulum bağlantısını kullanın:\n\n' + loginLink + '\n\nŞifrenizi oluşturduktan sonra ana sayfadaki "Müşteri Girişi" sekmesinden e-posta adresiniz ve belirlediğiniz şifre ile giriş yapabilirsiniz.\n\nİyi çalışmalar dileriz.');
                                    window.open('mailto:' + account.email + '?subject=' + subject + '&body=' + body);
                                  }}
                                  className="flex-1 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:hover:bg-teal-955/40 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900/30 text-xs font-bold py-2 px-3 rounded-lg transition"
                                >
                                  📧 Mail ile Gönder
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {clientAccounts.length === 0 || showAddSubAccountForm ? (
                  <div className={clientAccounts.length > 0 ? 'border-t border-dashed border-gray-200 dark:border-slate-700 pt-4 space-y-3' : 'space-y-3'}>
                    {clientAccounts.length > 0 && (
                      <label className="block text-xs font-bold text-slate-655 dark:text-slate-400 uppercase">Yeni Alt Müşteri Hesabı Ekle</label>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-655 dark:text-slate-400 mb-1 uppercase">Müşteri Kullanıcı Adı (E-posta)</label>
                      <input
                        type="email"
                        required
                        value={clientLoginEmail}
                        onChange={(e) => setClientLoginEmail(e.target.value)}
                        placeholder="ornek@firma.com"
                        className="w-full border rounded-lg p-2.5 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-1 focus:ring-teal-500 text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-955/20 border border-blue-200 dark:border-blue-900/30 p-3 rounded-xl text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      ⚙️ E-posta adresi yazıp <b>"Giriş Hesabı & Şifre Kurulumu Başlat"</b> butonuna basın. Sistem müşteri için özel bir davet linki üretecektir.
                    </div>
                    <div className="flex gap-2">
                      {clientAccounts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddSubAccountForm(false);
                            setClientLoginEmail('');
                          }}
                          className="flex-1 px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          Vazgeç
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={savingClientLogin}
                        onClick={handleCreateClientLogin}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        {savingClientLogin ? 'Gönderiliyor...' : (clientAccounts.length > 0 ? 'Alt Hesabı Oluştur ve Davet Gönder' : 'Giriş Hesabı & Şifre Kurulumu Başlat')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddSubAccountForm(true)}
                    className="w-full border border-dashed border-teal-300 dark:border-teal-800 text-teal-650 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Yeni Alt Müşteri Hesabı Ekle
                  </button>
                )}

                <div className="border-t border-dashed border-gray-200 dark:border-slate-700 pt-3.5">
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    ℹ️ Davet e-postalarının otomatik gönderilebilmesi için Google Apps Script Web App URL adresinin sistemde tanımlı olması gerekir. Bu ayar artık <b>Admin Paneli → E-Posta Ayarları</b> sayfasından merkezi olarak yönetilmektedir.
                  </p>
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-150 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClientLoginModal(false);
                      setSelectedClientForLogin(null);
                      setClientLoginEmail('');
                      setShowAddSubAccountForm(false);
                    }}
                    className="px-4 py-2 border rounded-lg text-slate-650 dark:text-slate-350 text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPersonnelId && orgId && (
        <PersonnelCard
          personnelId={selectedPersonnelId}
          orgId={orgId}
          viewerRole={userRole}
          clients={clients}
          onMemberChanged={fetchTeamMembers}
          onClose={() => setSelectedPersonnelId(null)}
        />
      )}

      {pendingKickMember && (
        <ExitDateModal
          memberName={pendingKickMember.full_name}
          loading={kickingQuick}
          onConfirm={handleQuickKick}
          onCancel={() => setPendingKickMember(null)}
        />
      )}

      {pendingReactivateMember && (
        <RehireDateModal
          memberName={pendingReactivateMember.profile?.full_name || ''}
          loading={reactivatingEmployeeId === pendingReactivateMember.profile_id}
          onConfirm={(rehireDate) => handleReactivateEmployee(pendingReactivateMember.profile_id, rehireDate)}
          onCancel={() => setPendingReactivateMember(null)}
        />
      )}

      {terminatingClientId && (
        <TerminateServiceModal
          clientName={clients.find((c) => c.id === terminatingClientId)?.name || ''}
          loading={savingTermination}
          onConfirm={handleTerminateService}
          onCancel={() => setTerminatingClientId(null)}
        />
      )}

      {/* EKSTRA MODÜL SATIN ALMA MODALİ */}
      {showModuleStoreModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <span className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <ShoppingBag size={18} className="text-purple-600" /> Şirket Ekstra Paket & Modül Mağazası
              </span>
              <button
                onClick={() => setShowModuleStoreModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>
            <ModuleStore
              organizationId={orgId}
              userRole={userRole}
              onModulesUpdated={() => {
                fetchCompanies();
              }}
              onClose={() => setShowModuleStoreModal(false)}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
