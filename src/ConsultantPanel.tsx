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
  Check,
  XCircle,
  PlusCircle,
  Bell,
  QrCode,
  HelpCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { MapPickerModal } from './MapPickerModal';
import { Link } from 'react-router-dom';
import { extractTextFromPdf } from './localScanner';

function formatArticleContent(content: string): string {
  // Clean multiple spaces
  let text = content.replace(/[ \t]+/g, ' ').trim();
  
  // Format paragraphs/bents with newlines
  text = text.replace(/ \(([0-9]+)\)/g, '\n($1)');
  text = text.replace(/ ([a-zçğıöşü])\)/gi, '\n$1)');
  text = text.replace(/ ([0-9]+)\)/g, '\n$1)');
  
  return text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

function parseLegislationText(text: string) {
  // Regex to find "MADDE 1", "GEÇİCİ MADDE 2", etc.
  const regex = /\b(MADDE|GEÇİCİ\s+MADDE|Geçici\s+Madde|Madde)\s+(\d+)\b/gi;
  const articles: any[] = [];
  
  const matches: { index: number; length: number; prefix: string; num: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      prefix: match[1],
      num: match[2]
    });
  }
  
  // Helper to extract bents from an article content
  const extractBents = (articleNo: string, articleTitle: string, rawContent: string, startOrderIndex: number) => {
    // Split text into lines
    const lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    const bents: any[] = [];
    
    let currentPara = ''; // e.g. "(1)"
    let currentSub = '';  // e.g. "a)"
    let currentBentText = '';
    let currentBentKey = '';
    
    const pushCurrentBent = () => {
      if (currentBentText.trim()) {
        const key = currentBentKey || articleNo;
        bents.push({
          article_no: key,
          title: articleTitle,
          content: currentBentText.trim(),
        });
      }
    };
    
    for (const line of lines) {
      // Check if line starts with paragraph number, e.g., (1) or (12)
      const paraMatch = line.match(/^(\([0-9]+\))\s*(.*)/);
      // Check if line starts with letter, e.g., a) or ç)
      const letterMatch = line.match(/^([a-zçğıöşüA-Z]\))\s*(.*)/);
      // Check if line starts with number dot or number parenthese, e.g. 1) or 1.
      const numMatch = line.match(/^([0-9]+[\)\.])\s*(.*)/);
      
      if (paraMatch) {
        pushCurrentBent();
        currentPara = paraMatch[1];
        currentSub = '';
        currentBentKey = `${articleNo} ${currentPara}`;
        currentBentText = line; // Include the marker in content
      } else if (letterMatch) {
        pushCurrentBent();
        currentSub = letterMatch[1];
        currentBentKey = `${articleNo} ${currentPara ? currentPara + ' ' : ''}${currentSub}`;
        currentBentText = line;
      } else if (numMatch) {
        pushCurrentBent();
        currentSub = numMatch[1];
        currentBentKey = `${articleNo} ${currentPara ? currentPara + ' ' : ''}${currentSub}`;
        currentBentText = line;
      } else {
        // Continuation of previous bent
        if (bents.length === 0 && !currentBentText) {
          // If we haven't started any bent, treat this as part of the main article text
          currentBentKey = articleNo;
          currentBentText = line;
        } else {
          currentBentText += '\n' + line;
        }
      }
    }
    pushCurrentBent();
    
    // Fallback if no bents found
    if (bents.length === 0) {
      bents.push({
        article_no: articleNo,
        title: articleTitle,
        content: rawContent,
      });
    }
    
    return bents;
  };

  if (matches.length === 0) {
    if (text.trim()) {
      const parsedBents = extractBents('Madde 1', 'Genel Hükümler', text.trim(), 1);
      parsedBents.forEach((b, idx) => {
        articles.push({
          ...b,
          order_index: idx + 1
        });
      });
    }
    return articles;
  }
  
  let orderCounter = 1;
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const rawContent = text.substring(currentMatch.index + currentMatch.length, nextIndex).trim();
    
    let articleNo = `${currentMatch.prefix} ${currentMatch.num}`;
    let title = articleNo;
    let content = rawContent;
    
    // Search for first paragraph marker like (1) or a) to separate title from content
    const paraIndex = rawContent.search(/(?:\([0-9]+\)|^[a-zçğıöşü]\)|^[0-9]+\))/i);
    if (paraIndex > 0) {
      const potentialTitle = rawContent.substring(0, paraIndex).replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();
      if (potentialTitle && potentialTitle.length < 150) {
        title = potentialTitle;
        content = rawContent.substring(paraIndex).trim();
      }
    } else {
      const lines = rawContent.split('\n');
      if (lines.length > 1 && lines[0].trim().length < 100 && !lines[0].includes('(')) {
        title = lines[0].trim().replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');
        content = lines.slice(1).join('\n').trim();
      }
    }
    
    content = formatArticleContent(content);
    
    const parsedBents = extractBents(articleNo, title, content, orderCounter);
    parsedBents.forEach(b => {
      articles.push({
        ...b,
        order_index: orderCounter++
      });
    });
  }
  
  return articles;
}

interface Client {
  id: string;
  name: string;
  address: string;
  tax_no: string;
  phone: string;
  logo_url: string;
  created_by?: string;
  created_at?: string;
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

export default function ConsultantPanel() {
  const [activeTab, setActiveTab] = useState<'clients' | 'reports' | 'settings' | 'team' | 'definitions' | 'legislations' | 'requests' | 'actions' | 'inspections'>('clients');

  // --- SAHA QR DENETİM MODÜLÜ STATE'LERİ ---
  const [inspectionsSubTab, setInspectionsSubTab] = useState<'points' | 'forms'>('points');
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
        .select('*, question:inspection_questions(question_text, question_type)')
        .eq('submission_id', submissionId);

      if (answersError) throw answersError;

      setSubmissionAnswers(prev => ({
        ...prev,
        [submissionId]: answers || []
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
  const [legSubTab, setLegSubTab] = useState<'pool' | 'assignments'>('pool');
  
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

  // Mevcut Durum (Current Status Notes) states
  const [editingNotesArtId, setEditingNotesArtId] = useState<string | null>(null);
  const [tempNotesVal, setTempNotesVal] = useState('');

  // --- AKSİYON TAKİP SİSTEMİ STATE'LERİ ---
  const [complianceActions, setComplianceActions] = useState<any[]>([]);
  const [articleActions, setArticleActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [selectedClientAction, setSelectedClientAction] = useState<any>(null);
  
  const [showCreateActionModal, setShowCreateActionModal] = useState(false);
  const [showCompleteActionModal, setShowCompleteActionModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedActionDetails, setSelectedActionDetails] = useState<any>(null);
  
  const [actionsFilterClient, setActionsFilterClient] = useState('');
  const [actionsFilterAssignee, setActionsFilterAssignee] = useState('');
  const [actionsFilterStatus, setActionsFilterStatus] = useState('');
  
  // Yeni Aksiyon Oluşturma Formu
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionClientId, setNewActionClientId] = useState('');
  const [newActionAssigneeId, setNewActionAssigneeId] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  
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

  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [currentUserPerms, setCurrentUserPerms] = useState<any>({});

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
  });
  const [showAddClientMap, setShowAddClientMap] = useState(false);
  const [showEditClientMap, setShowEditClientMap] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);

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
    if ((activeTab === 'settings' || activeTab === 'team' || activeTab === 'definitions' || activeTab === 'legislations' || activeTab === 'inspections') && orgId) {
      fetchTeamMembers();
    }
    if (activeTab === 'team' && orgId) {
      fetchInvitations();
    }
    if (activeTab === 'definitions' && orgId) {
      fetchDefinitionsTab();
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

  const fetchTeamMembers = async () => {
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, extra_permissions')
      .eq('organization_id', orgId);
    
    const sortedMembers = (members || []).sort((a, b) => {
      if (a.role === 'premium_corporate' && b.role !== 'premium_corporate') return -1;
      if (a.role !== 'premium_corporate' && b.role === 'premium_corporate') return 1;
      return 0;
    });
    setTeamMembers(sortedMembers);
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
            ownerName: r.user?.full_name || 'Bilinmeyen'
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
        .select('id')
        .eq('organization_id', orgId);

      const { data: defs, error } = await supabase
        .from('user_definitions')
        .select('*, user:profiles!user_id(full_name)')
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
      let targetUserIds: string[] = [];
      if (selectedDefTypeMemberId === 'all') {
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', orgId);
        targetUserIds = orgProfiles?.map(p => p.id) || [];
      } else {
        targetUserIds = [selectedDefTypeMemberId];
      }

      if (targetUserIds.length === 0) return;

      const inserts = targetUserIds.map(uid => ({
        user_id: uid,
        category: 'doc_type',
        label: newDefTypeLabel.trim(),
        organization_id: orgId
      }));

      const { error } = await supabase
        .from('user_definitions')
        .insert(inserts);

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
      let targetUserIds: string[] = [];
      if (selectedDefMemberId === 'all') {
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', orgId);
        targetUserIds = orgProfiles?.map(p => p.id) || [];
      } else {
        targetUserIds = [selectedDefMemberId];
      }

      if (targetUserIds.length === 0) return;

      const inserts = targetUserIds.map(uid => ({
        user_id: uid,
        category: 'location',
        label: newDefLocLabel.trim(),
        organization_id: orgId
      }));

      const { error } = await supabase
        .from('user_definitions')
        .insert(inserts);

      if (error) throw error;
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

      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, organization_id')
        .eq('email', inviteEmail)
        .single();

      if (userError || !targetUser) {
        alert('❌ Kullanıcı Bulunamadı! (Sisteme kayıtlı olması gerekir)');
        setSendingEmail(false);
        return;
      }
      if (targetUser.organization_id) {
        alert('⚠️ Bu kullanıcı zaten bir şirkete/firmaya bağlı.');
        setSendingEmail(false);
        return;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([{ code, organization_id: orgId, email: inviteEmail }]);

      if (inviteError) throw inviteError;

      await supabase.from('notifications').insert([
        {
          user_id: targetUser.id,
          title: 'Danışmanlık Firması Daveti',
          message: `${orgData?.name || 'Danışmanlık Firması'} sizi ekibine katılmaya davet etti.`,
          type: 'invite',
          metadata: {
            org_id: orgId,
            org_name: orgData?.name,
            invite_code: code,
          },
        },
      ]);

      alert(`✅ Davet başarıyla gönderildi!`);
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

  const handleKick = async (id: string, role: string) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (role === 'premium_corporate') return alert('Yöneticiyi silemezsiniz.');
    if (window.confirm('Bu personeli şirketten çıkarmak istiyor musunuz?')) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ organization_id: null, role: 'normal' })
          .eq('id', id);
        if (error) throw error;
        setTeamMembers((prev) => prev.filter((m) => m.id !== id));
      } catch (err: any) {
        alert('Çıkarılırken hata oluştu: ' + err.message);
      }
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      const updates: any = { role };
      if (role === 'normal') {
        updates.organization_id = null;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', memberId);

      if (error) throw error;
      alert('Kullanıcı rolü başarıyla güncellendi.');
      fetchTeamMembers();
    } catch (err: any) {
      alert('Rol güncellenemedi: ' + err.message);
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

  const openAssignModal = async (client: any) => {
    if (!canAssignClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    setSelectedClient(client);
    setShowAssignModal(true);
    
    // Fetch team members of the consultant company
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', orgId);
    setTeamMembers(members || []);

    // Fetch current assignments for this client
    const { data: assigns } = await supabase
      .from('consultant_assignments')
      .select('user_id')
      .eq('client_id', client.id);
    setCurrentAssignments(assigns?.map(a => a.user_id) || []);
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
      } else {
        // Add assignment
        const { error } = await supabase
          .from('consultant_assignments')
          .insert([{ client_id: selectedClient.id, user_id: uId }]);
        if (error) throw error;
        setCurrentAssignments(prev => [...prev, uId]);
      }
    } catch (err: any) {
      alert('Atama yapılırken hata: ' + err.message);
    }
  };

  const getStatusStyles = (art: any) => {
    if (!art.is_mandatory) {
      return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 opacity-70';
    }
    if (art.compliance_status === 'compliant') {
      return 'border-emerald-250 dark:border-emerald-800 bg-emerald-50/10 dark:bg-emerald-950/5';
    }
    if (art.compliance_status === 'non_compliant') {
      return 'border-rose-250 dark:border-rose-800 bg-rose-50/10 dark:bg-rose-950/5';
    }
    return 'border-amber-250 dark:border-amber-800 bg-amber-50/10 dark:bg-amber-950/5';
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id, extra_permissions')
        .eq('id', session.user.id)
        .single();

        if (profile) {
        setUserRole(profile.role);
        setOrgId(profile.organization_id);
        const perms = profile.extra_permissions || {};
        setCurrentUserPerms(perms);

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

        if (profile.organization_id) {
          const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single();
          setOrgData(org);
        }

        await Promise.all([
          fetchClients(profile.organization_id, profile.role, session.user.id, perms),
          fetchReports(profile.organization_id, profile.role, session.user.id, perms),
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
        .select('*, regulation:pdf_regulations(*)')
        .eq('company_id', orgId);
      
      if (err1) throw err1;
      setAssignedGlobalLegislations(compLegs?.map((cl: any) => cl.regulation).filter(Boolean) || []);

      const { data: allRegs, error: errGlobal } = await supabase
        .from('pdf_regulations')
        .select('*')
        .order('created_at', { ascending: false });
      if (!errGlobal && allRegs) {
        setAllGlobalRegulations(allRegs);
      }

      const isRestrictedRole = userRole === 'corporate_staff' || userRole === 'corporate_chief';
      let clientIds: string[] = [];
      if (isRestrictedRole && !currentUserPerms?.can_view_all_clients) {
        const { data: assigns } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', userId);
        clientIds = assigns?.map((a: any) => a.client_id) || [];
      } else {
        clientIds = clients.map((c: any) => c.id);
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
        const { data: assigns } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', userId);
        clientIds = assigns?.map((a: any) => a.client_id) || [];
      } else {
        clientIds = clients.map((c: any) => c.id);
      }

      let query = supabase
        .from('regulation_requests')
        .select('*, requester:profiles!requested_by(full_name, email), client:consultant_clients!client_id(name), target_regulation:pdf_regulations!target_regulation_id(title)')
        .order('created_at', { ascending: false });

      if (userRole === 'premium_corporate') {
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
      const text = await extractTextFromPdf(file);
      const parsed = parseLegislationText(text);
      setLegArticles(parsed);
      alert(`✅ PDF başarıyla ayrıştırıldı! ${parsed.length} madde bulundu. Lütfen aşağıdaki listeden inceleyin.`);
    } catch (err: any) {
      alert('PDF ayrıştırılamadı: ' + err.message);
    } finally {
      setParsingPdf(false);
    }
  };

  const handleSaveLegislation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legTitle.trim()) return alert('Lütfen mevzuat başlığını girin.');
    if (legArticles.length === 0) {
      if (!window.confirm('Bu mevzuatta hiç madde bulunmuyor. Yine de kaydetmek istiyor musunuz?')) return;
    }

    setSavingLegislation(true);
    try {
      // Create new regulation
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

      // Insert articles
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

      // Automatically assign to company pool (company_pdf_regulations)
      const { error: poolErr } = await supabase
        .from('company_pdf_regulations')
        .insert({
          company_id: orgId,
          regulation_id: newReg.id
        });
      if (poolErr) throw poolErr;

      alert('✅ Özel mevzuat başarıyla havuzunuza eklendi!');
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
      
      // Refresh pool
      fetchConsultantLegislations();
    } catch (err: any) {
      alert('Kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSavingLegislation(false);
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

      if (selectedStaffIdForLeg) {
        const { data: existingAssign } = await supabase
          .from('consultant_assignments')
          .select('id')
          .eq('client_id', selectedClientIdForLeg)
          .eq('user_id', selectedStaffIdForLeg)
          .maybeSingle();

        if (!existingAssign) {
          await supabase
             .from('consultant_assignments')
             .insert({
               client_id: selectedClientIdForLeg,
               user_id: selectedStaffIdForLeg
             });
        }
      }

      alert('Mevzuat işletmeye başarıyla atandı ve maddeler kopyalandı!');
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
      setSelectedClientRegulationArticles(data || []);

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

  const handleUpdateArticleCompliance = async (articleId: string, status: 'compliant' | 'non_compliant') => {
    const art = selectedClientRegulationArticles.find(a => a.id === articleId);
    if (!art) return;
    
    setComplianceNoteData({
      articleId: art.id,
      type: status,
      articleNo: art.article_no,
      title: art.title || '',
      currentNotes: art.current_status_notes || '',
      currentExpiryDate: art.expiry_date || ''
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

  const handleRequestArticleNotes = async (art: any) => {
    setReqNotesArticleId(art.id);
    setReqNotesClientId(selectedClientRegulation?.client_id || '');
    
    // Auto-select assignee from client assignments
    try {
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('user_id')
        .eq('client_id', selectedClientRegulation?.client_id);
      
      if (userRole === 'corporate_staff') {
        setReqNotesAssigneeId(userId);
      } else if (assignments && assignments.length > 0) {
        setReqNotesAssigneeId(assignments[0].user_id);
      } else {
        setReqNotesAssigneeId('');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      if (userRole === 'corporate_staff') {
        setReqNotesAssigneeId(userId);
      }
    }
    
    setReqNotesDueDate('');
    setReqNotesDesc('');
    setNewActionTitle(`${art.article_no} Mevcut Durum Talebi`);
    setShowRequestNotesModal(true);
  };

  const handleOpenActionForArticle = async (art: any) => {
    setNewActionTitle(`[${art.article_no}] Aksiyon`);
    setNewActionDesc(`Bu madde için aksiyon tamamlanması gerekmektedir.\nİlgili Madde: ${art.article_no} - ${art.title || ''}`);
    setNewActionClientId(selectedClientRegulation?.client_id || '');
    setReqNotesArticleId(art.id); // Also associate this action with the article ID if saved through the normal form
    
    // Auto-select assignee from client assignments
    try {
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('user_id')
        .eq('client_id', selectedClientRegulation?.client_id);
      
      if (userRole === 'corporate_staff') {
        setNewActionAssigneeId(userId);
      } else if (assignments && assignments.length > 0) {
        setNewActionAssigneeId(assignments[0].user_id);
      } else {
        setNewActionAssigneeId('');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      if (userRole === 'corporate_staff') {
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
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', userId);
        const cIds = assignments?.map((a) => a.client_id) || [];
        
        if (cIds.length > 0) {
          query = query.or(`assigned_to.eq.${userId},client_id.in.(${cIds.join(',')})`);
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

  const handleCreateAction = async (isArticleAction = false, articleId: string | null = null, clientId: string | null = null) => {
    const title = isArticleAction ? `${newActionTitle}` : newActionTitle.trim();
    const desc = isArticleAction ? reqNotesDesc.trim() : newActionDesc.trim();
    const cId = isArticleAction ? clientId : newActionClientId;
    const aId = isArticleAction ? reqNotesAssigneeId : newActionAssigneeId;
    const dDate = isArticleAction ? reqNotesDueDate : newActionDueDate;
    
    if (!title || !cId || !aId || !dDate) {
      alert('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('compliance_actions')
        .insert({
          client_id: cId,
          article_id: articleId || reqNotesArticleId || null,
          title: title,
          description: desc || null,
          due_date: dDate,
          created_by: userId,
          assigned_to: aId,
          status: 'pending'
        });
        
      if (error) throw error;
      
      alert('Aksiyon başarıyla oluşturuldu.');
      setShowCreateActionModal(false);
      setShowRequestNotesModal(false);
      
      setNewActionTitle('');
      setNewActionDesc('');
      setNewActionClientId('');
      setNewActionAssigneeId('');
      setNewActionDueDate('');
      setReqNotesArticleId('');
      setReqNotesClientId('');
      setReqNotesAssigneeId('');
      setReqNotesDueDate('');
      setReqNotesDesc('');
      
      await fetchComplianceActions();
      
      if (isArticleAction && selectedClientRegulation) {
        if (articleId) {
          await supabase
            .from('client_regulation_articles')
            .update({ current_status_requested: true })
            .eq('id', articleId);
        }
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Aksiyon oluşturulurken hata: ' + err.message);
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
      
      if (action.article_id) {
        await supabase
          .from('client_regulation_articles')
          .update({
            current_status_requested: false,
            current_status_notes: action.notes,
            last_updated_by: action.assigned_to
          })
          .eq('id', action.article_id);
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

  const handleDeleteAction = async (actionId: string, articleId: string | null = null) => {
    if (!window.confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) return;
    
    try {
      const { error } = await supabase
        .from('compliance_actions')
        .delete()
        .eq('id', actionId);
        
      if (error) throw error;
      
      if (articleId) {
        await supabase
          .from('client_regulation_articles')
          .update({ current_status_requested: false })
          .eq('id', articleId);
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
      const isOwner = userRole === 'premium_corporate';
      const reqType = isOwner ? 'owner_to_admin' : 'staff_to_owner';

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

  const handleEscalateRequestToAdmin = async (req: any) => {
    try {
      const { error } = await supabase
        .from('regulation_requests')
        .insert({
          title: `[YÖNLENDİRİLDİ] ${req.title}`,
          description: `Personel ${req.requester?.full_name || 'Çalışan'} tarafından iletilen talep:\n${req.description}`,
          requested_by: userId,
          organization_id: orgId,
          target_regulation_id: req.target_regulation_id || null,
          request_type: 'owner_to_admin',
          status: 'pending'
        });
      if (error) throw error;
      
      await supabase
        .from('regulation_requests')
        .update({ status: 'approved', admin_notes: 'Talep Sistem Adminine iletildi.' })
        .eq('id', req.id);

      alert('Talep Sistem Yöneticisine (Admin) başarıyla iletildi!');
      fetchConsultantRequests();
    } catch (err: any) {
      alert('İletilirken hata: ' + err.message);
    }
  };

  const fetchClients = async (oId: string, role: string, uId: string, perms?: any) => {
    let query = supabase.from('consultant_clients').select('*');
    
    // Kurumsal şef ve personel sadece atandığı firmaları görür (perm yoksa).
    const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';

    if (isRestrictedRole && !perms?.can_view_all_clients) {
      // Sadece atandığı firmalar
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('client_id')
        .eq('user_id', uId);
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
    if (data) setClients(data);
  };

  const fetchReports = async (oId: string, role: string, uId: string, perms?: any) => {
    let query = supabase
      .from('env_reports')
      .select('*, client:client_id(name), creator:creator_id(full_name)');
    
    const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';

    if (isRestrictedRole && !perms?.can_view_all_clients) {
      // Sadece atandığı firmaların raporları
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('client_id')
        .eq('user_id', uId);
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

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name) return;
    if (!canCreateClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
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
        },
      ]);
      if (error) throw error;
      setShowAddClient(false);
      setNewClient({ name: '', address: '', tax_no: '', phone: '', logo_url: '', latitude: null, longitude: null });
      fetchClients(orgId, userRole, userId);
    } catch (err: any) {
      alert('Firma eklenirken hata: ' + err.message);
    }
  };

  const handleOpenEditModal = (client: any) => {
    if (!checkClientEditable(client)) {
      alert('Bu işletmeyi düzenleme yetkiniz bulunmamaktadır (Firma Sahibi tarafından oluşturulmuş veya oluşturulma süresi 24 saati geçmiş).');
      return;
    }
    setEditingClient(client);
    setShowEditClient(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.name) return;
    if (!checkClientEditable(editingClient)) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
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
        })
        .eq('id', editingClient.id);

      if (error) throw error;
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

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

  const isAdminOrChief = userRole === 'admin' || userRole === 'corporate_chief' || userRole === 'premium_corporate';
  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief';
  
  // Granular Permissions for Chief / Staff
  const canViewClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_clients !== false);
  const canCreateClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_create_clients);
  const canEditClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients);
  const canAssignClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_assign_clients);
  const canDeleteClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_delete_clients);
  const canViewReports = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_reports !== false);
  const canViewTeam = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_team !== false);


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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-blue-600" /> {userRole === 'corporate_chief' ? 'Şef Paneli' : 'Raporlar Paneli'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">İşletmelerinizi ve raporları yönetin.</p>
        </div>
          <div className="flex items-center gap-2">
            {canCreateClients && (
              <button
                onClick={() => setShowAddClient(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus size={18} /> Yeni İşletme
              </button>
            )}
          {userRole !== 'corporate_chief' && (
            <Link
              to="/consultant/reports/add"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            >
              <FileText size={18} /> Rapor Oluştur
            </Link>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-slate-700">
        {canViewClients && (
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'clients'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building size={16} /> Hizmet Verilen İşletmeler
          </button>
        )}
        {canViewReports && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'reports'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} /> Raporlar
          </button>
        )}
        {canViewTeam && (
          <button
            onClick={() => setActiveTab('team')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} /> Ekip Yönetimi
          </button>
        )}
        {userRole === 'premium_corporate' && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SettingsIcon size={16} /> Şirket Ayarları
          </button>
        )}

        {(userRole === 'premium_corporate' || userRole === 'corporate_chief') && (
          <button
            onClick={() => setActiveTab('definitions')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'definitions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SettingsIcon size={16} /> Tanımlamalar
          </button>
        )}
        <button
          onClick={() => setActiveTab('legislations')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'legislations'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Scale size={16} /> Danışman İşlemleri
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'actions'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle size={16} /> Aksiyon Takip
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'requests'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell size={16} /> Gönderilen Mevzuat Talepleri
        </button>
        <button
          onClick={() => setActiveTab('inspections')}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'inspections'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <QrCode size={16} /> Saha QR Denetimleri
        </button>
      </div>

      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition"
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
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p className="line-clamp-2"><span className="font-medium">Adres:</span> {client.address}</p>
                <p><span className="font-medium">Tel:</span> {client.phone}</p>
              </div>
              {(canDeleteClients || checkClientEditable(client) || canAssignClients) && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center gap-2">
                  <div className="flex gap-2">
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
                  </div>
                  {canAssignClients && (
                    <button 
                      onClick={() => openAssignModal(client)}
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1 font-medium"
                    >
                      <Users size={14} /> Personel Ata
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {clients.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
              Henüz bir işletme kaydı bulunmuyor.
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
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
                {reports.map((report) => (
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
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Rapor bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

      {activeTab === 'team' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ekip Listesi */}
            <div className={`${userRole === 'premium_corporate' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700`}>
              <h3 className="font-bold text-gray-700 dark:text-white mb-4 flex items-center gap-2 text-lg">
                <Users className="text-blue-600" /> Ekip ve Bekleyen Kodlar
              </h3>
              
              <div className="space-y-4">
                {/* Üyeler */}
                {teamMembers.map((member) => (
                  <div key={member.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex flex-col gap-3 hover:shadow-sm transition">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                          member.role === 'premium_corporate'
                            ? 'bg-rose-600 text-white'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-950/30'
                        }`}>
                          {member.full_name?.charAt(0) || <User size={20} />}
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
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                        </div>
                      </div>
                      
                      {userRole === 'premium_corporate' && member.id !== userId && (
                        <button
                          onClick={() => handleKick(member.id, member.role)}
                          className="text-xs bg-red-50 text-red-600 p-2 rounded border border-red-100 hover:bg-red-100 transition dark:bg-red-950/20 dark:border-red-900"
                          title="Çıkar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Rol & Yetkiler */}
                    {userRole === 'premium_corporate' && member.id !== userId && (
                      <div className="mt-2 pt-3 border-t border-gray-50 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-bold">ROL:</span>
                          {userRole === 'premium_corporate' ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                              className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 font-bold text-blue-700 dark:text-blue-400 outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="premium_corporate">Çevre Danışmanlık Firma Sahibi</option>
                              <option value="corporate_chief">Çevre Danışmanlık Firma Yöneticisi</option>
                              <option value="corporate_staff">Çevre Danışmanlık Personeli</option>
                              <option value="normal">Normal (Ekip Dışı)</option>
                            </select>
                          ) : (
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {roleLabels[member.role] || member.role}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {member.role === 'corporate_chief' ? (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_clients !== false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                İşletmeleri Görüntüleme
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_all_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_all_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Tüm Firmaları Görebilir
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_create_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_create_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Yeni İşletme Oluşturma
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_edit_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_edit_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                İşletme Düzenleme
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_assign_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_assign_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Personel Atama
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_delete_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_delete_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                İşletme Silme (Kritik)
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_reports !== false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_reports: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Raporları Görüntüleme
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_team !== false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_team: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Ekip Yönetimini Görüntüleme
                              </label>



                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.receive_reminder_cc || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), receive_reminder_cc: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Hatırlatma Maillerinde CC'de Yer Alsın
                              </label>
                            </>
                          ) : (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_all_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_all_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Tüm Firmaları Görebilir
                              </label>


                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.receive_reminder_cc || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), receive_reminder_cc: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Hatırlatma Maillerinde CC'de Yer Alsın
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )}
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



      {activeTab === 'definitions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn pb-12">
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

            {/* Yeni Belge Türü Ekle Formu */}
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
                        <User size={10} /> Sahibi: {type.user?.full_name || 'Bilinmeyen'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTabDefinition(type.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LOKASYON TANIMLARI */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
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
                          <User size={10} /> Sahibi: {loc.user?.full_name || 'Bilinmeyen'}
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
          </div>
        </div>
      )}

      {/* LEGISLATIONS TAB */}
      {activeTab === 'legislations' && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Scale className="text-teal-600" /> Danışman İşlemleri
              </h2>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                Yönetmelik ve kanunları inceleyin, hizmet verdiğiniz işletmelere atama yapın ve maddeleri özelleştirin.
              </p>
            </div>
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
              <PlusCircle size={16} /> {userRole === 'premium_corporate' ? 'Admin\'den Mevzuat Talep Et' : 'Yeni Mevzuat Talep Et'}
            </button>
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
          </div>

          <div className="animate-fadeIn">
            {/* 1. SEKME: MEVZUAT HAVUZU */}
            {legSubTab === 'pool' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sistem Mevzuat Havuzu */}
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

                {/* Firma Mevzuat Havuzu */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-gray-100 dark:border-slate-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                      <BookOpen size={18} className="text-teal-600" />
                      Firma Mevzuat Havuzu (Bizim Havuzumuz)
                    </h3>
                    {(userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'corporate_staff') && (
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
                        <Plus size={10} /> Özel Mevzuat Ekle
                      </button>
                    )}
                  </div>
                  
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
                            {(userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients)) && (
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

            {/* 2. SEKME: İŞLETME ATAMALARI */}
            {legSubTab === 'assignments' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                {/* Sol Taraf: İşletme Mevzuat Listesi */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b pb-2 border-gray-100 dark:border-slate-700 flex-wrap">
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
                      </select>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto pr-1">
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
                          <div key={cr.id} className={`py-3.5 flex justify-between items-start gap-4 animate-fadeIn transition-colors p-2 rounded-lg ${selectedClientRegulation?.id === cr.id ? 'bg-teal-50/30 dark:bg-teal-950/10' : ''}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-gray-850 dark:text-gray-200">{cr.title}</span>
                                <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border border-teal-100 dark:border-teal-900">
                                  {cr.client?.name || 'Bilinmeyen İşletme'}
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
                              <button
                                onClick={() => fetchClientRegulationArticles(cr)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition border flex items-center gap-1 ${
                                  selectedClientRegulation?.id === cr.id
                                    ? 'bg-teal-650 text-white border-teal-600'
                                    : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                                }`}
                              >
                                <Eye size={12} /> {selectedClientRegulation?.id === cr.id ? 'Maddeler Açık' : 'Maddeleri İncele'}
                              </button>
                              {(userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients)) && (
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

                {/* Sağ Taraf: Maddeler Listesi */}
                <div className="col-span-1">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2 border-b pb-2 border-gray-100 dark:border-slate-700">
                      <Scale size={18} className="text-teal-600" />
                      Madde & Bent İstisnaları
                    </h3>

                    {!selectedClientRegulation ? (
                      <div className="p-8 text-center text-xs text-gray-400 italic">
                        Maddeleri görmek ve muafiyet durumlarını yönetmek için sol listeden bir mevzuat seçin.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750 flex flex-col gap-2">
                          <div>
                            <div className="text-slate-400 uppercase tracking-wide">Seçili Mevzuat:</div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{selectedClientRegulation.title}</div>
                            <div className="text-teal-600 font-bold mt-0.5">{selectedClientRegulation.client?.name}</div>
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
                                  className={`p-4 rounded-xl border transition shadow-sm bg-white ${getStatusStyles(art)}`}
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <div className="font-bold text-xs text-slate-750 dark:text-slate-200">
                                        {art.article_no} {art.title ? `- ${art.title}` : ''}
                                      </div>
                                      
                                      {/* Last Updated By Info */}
                                      {art.updater?.full_name && (
                                        <div className="text-[10px] text-slate-500 mt-1">
                                          Son Güncelleyen: <b>{art.updater.full_name}</b>
                                        </div>
                                      )}

                                      {/* Validity Date Info */}
                                      {art.is_mandatory && (
                                        <div className="text-[10px] text-slate-500 mt-1">
                                          Geçerlilik Süresi: <span className="font-extrabold text-teal-600 dark:text-teal-400">{art.expiry_date ? new Date(art.expiry_date).toLocaleDateString('tr-TR') : 'Süresiz'}</span>
                                        </div>
                                      )}

                                      {/* Requested Status Badge */}
                                      {art.current_status_requested && (
                                        <div className="mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                          ⚠️ Mevcut Durum Notu Girişi Talep Edildi
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-row sm:flex-col gap-2 shrink-0 items-center sm:items-end w-full sm:w-auto justify-end">
                                      {art.is_mandatory ? (
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => handleUpdateArticleCompliance(art.id, 'compliant')}
                                            className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-200 shadow-sm ${
                                              art.compliance_status === 'compliant'
                                                ? 'bg-emerald-600 border-transparent text-white shadow-emerald-600/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/20 hover:border-emerald-200'
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
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50/20 hover:border-rose-200'
                                            }`}
                                          >
                                            <AlertCircle size={12} />
                                            Uygun Değil
                                          </button>
                                          <button
                                            onClick={() => handleToggleArticleMandatory(art.id, art.is_mandatory)}
                                            className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-purple-600 hover:bg-purple-50/30 hover:border-purple-200 transition-all duration-200"
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

                                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap">{art.content}</p>

                                  {/* Mevcut Durum Notu (Current Status Note) Section */}
                                  {art.is_mandatory && (() => {
                                    const artAction = articleActions.find((a: any) => a.article_id === art.id);
                                    
                                    if (artAction) {
                                      const isAssignee = artAction.assigned_to === userId;
                                      const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief';
                                      
                                      return (
                                        <div className="pt-2.5 border-t border-gray-150 dark:border-slate-800 space-y-3">
                                          {/* Action Status Badge */}
                                          <div className="flex flex-wrap items-center justify-between gap-2">
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
                                            {isManager && (
                                              <button
                                                onClick={() => handleDeleteAction(artAction.id, art.id)}
                                                className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                                                title="Talebi İptal Et"
                                              >
                                                Talebi İptal Et
                                              </button>
                                            )}
                                          </div>

                                          {/* Correction Comment */}
                                          {artAction.status === 'correction_requested' && artAction.manager_comment && (
                                            <div className="bg-rose-50/50 dark:bg-rose-950/10 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-350">
                                              <div className="font-bold text-[9px] uppercase tracking-wide mb-0.5">Düzeltme Gerekçesi</div>
                                              <p className="italic">{artAction.manager_comment}</p>
                                            </div>
                                          )}

                                          {/* Action Notes Editor for Assignee */}
                                          {(artAction.status === 'pending' || artAction.status === 'correction_requested') && editingNotesArtId === art.id ? (
                                            <div className="space-y-2.5">
                                              <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mevcut Durum Açıklaması</label>
                                                <textarea
                                                  rows={3}
                                                  value={tempNotesVal}
                                                  onChange={(e) => setTempNotesVal(e.target.value)}
                                                  placeholder="Bu madde için mevcut durumu/açıklamayı buraya yazın..."
                                                  className="w-full p-2 border rounded-lg text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-slate-755 dark:text-slate-200"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Kanıt Belgesi</label>
                                                  <div className="flex border-b border-gray-200 dark:border-slate-700 mb-2 text-[10px]">
                                                    <button
                                                      type="button"
                                                      onClick={() => setEvidenceMode('upload')}
                                                      className={`py-1 px-2 font-semibold transition border-b-2 ${evidenceMode === 'upload' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-450'}`}
                                                    >
                                                      Dosya Yükle
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setEvidenceMode('select');
                                                        if (userId) fetchUserDocuments(userId);
                                                      }}
                                                      className={`py-1 px-2 font-semibold transition border-b-2 ${evidenceMode === 'select' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-450'}`}
                                                    >
                                                      Evraklarımdan Seç
                                                    </button>
                                                  </div>

                                                  {evidenceMode === 'upload' ? (
                                                    <input
                                                      type="file"
                                                      onChange={(e) => setActionEvidenceFile(e.target.files?.[0] || null)}
                                                      className="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                                                    />
                                                  ) : (
                                                    <select
                                                      className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500 font-bold text-xs text-slate-700 dark:text-slate-350 border-slate-200"
                                                      value={selectedEvidenceDocUrl}
                                                      onChange={(e) => setSelectedEvidenceDocUrl(e.target.value)}
                                                    >
                                                      <option value="">-- Evrak Seçin --</option>
                                                      {userDocuments.map(d => (
                                                        <option key={d.id} value={d.file_url}>{d.title}</option>
                                                      ))}
                                                    </select>
                                                  )}
                                                </div>
                                              <div className="flex gap-2 justify-end pt-1">
                                                <button
                                                    onClick={() => handleCompleteAction(artAction.id, tempNotesVal, evidenceMode === 'upload' ? actionEvidenceFile : null, art.id, evidenceMode === 'select' ? selectedEvidenceDocUrl : null)}
                                                  disabled={uploadingEvidence}
                                                  className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                                >
                                                  {uploadingEvidence ? 'Yükleniyor...' : 'Tamamla ve Gönder'}
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setEditingNotesArtId(null);
                                                    setTempNotesVal('');
                                                    setActionEvidenceFile(null);
                                                  }}
                                                  className="border hover:bg-gray-50 dark:hover:bg-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition text-gray-700 dark:text-gray-300"
                                                >
                                                  İptal
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              {/* Action Notes Display */}
                                              {(artAction.status === 'completed' || artAction.status === 'approved' || artAction.notes) && (
                                                <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                                  <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Girilen Mevcut Durum</div>
                                                  <p className="text-slate-750 dark:text-slate-350 mt-0.5 whitespace-pre-wrap leading-relaxed">
                                                    {artAction.notes || <span className="italic text-gray-400">Açıklama yazılmamış</span>}
                                                  </p>
                                                  
                                                  {artAction.evidence_url && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                                                      <span className="text-[10px] text-slate-400">Yüklenen Belge:</span>
                                                      <a
                                                        href={artAction.evidence_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline font-bold"
                                                      >
                                                        Belgeyi Yeni Sekmede Aç ↗
                                                      </a>
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {/* Action Controls */}
                                              <div className="flex justify-end gap-2">
                                                {(artAction.status === 'pending' || artAction.status === 'correction_requested') && isAssignee && (
                                                  <button
                                                    onClick={() => {
                                                      setEditingNotesArtId(art.id);
                                                      setTempNotesVal(artAction.notes || '');
                                                    }}
                                                    className="text-[10px] font-bold text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 border border-teal-200 px-3 py-1 rounded transition"
                                                  >
                                                    {artAction.status === 'correction_requested' ? 'Düzeltme Yap' : 'Mevcut Durum Gir'}
                                                  </button>
                                                )}

                                                {(() => {
                                                   const isCreator = artAction.created_by === userId;
                                                   return artAction.status === 'completed' && (isManager || isCreator) && (
                                                     <>
                                                       <button
                                                         onClick={() => handleApproveAction(artAction)}
                                                         className="text-[10px] font-bold bg-green-600 text-white hover:bg-green-700 px-3 py-1 rounded transition shadow-sm"
                                                       >
                                                         Onayla
                                                       </button>
                                                       <button
                                                         onClick={() => {
                                                           setSelectedClientAction(artAction);
                                                           setCorrectionDueDate(artAction.due_date || '');
                                                           setCorrectionComment('');
                                                           setShowCorrectionModal(true);
                                                         }}
                                                         className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 px-3 py-1 rounded transition"
                                                       >
                                                         Düzeltme İstenecek
                                                       </button>
                                                     </>
                                                   );
                                                 })()}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else {
                                      // No action exists
                                      const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief';
                                      
                                      return (
                                        <div className="pt-2 border-t border-gray-150 dark:border-slate-800 space-y-2">
                                          {editingNotesArtId === art.id ? (
                                            <div className="space-y-2">
                                              <label className="block text-[10px] font-bold text-gray-400 uppercase">Mevcut Durum Girişi</label>
                                              <textarea
                                                rows={2}
                                                value={tempNotesVal}
                                                onChange={(e) => setTempNotesVal(e.target.value)}
                                                placeholder="Bu madde için mevcut durumu/açıklamayı yazın..."
                                                className="w-full p-2 border rounded-lg text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-slate-755 dark:text-slate-200"
                                              />
                                              <div className="flex gap-2 justify-end">
                                                <button
                                                  onClick={() => handleSaveArticleNotes(art.id)}
                                                  className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
                                                >
                                                  Kaydet
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setEditingNotesArtId(null);
                                                    setTempNotesVal('');
                                                  }}
                                                  className="border hover:bg-gray-50 dark:hover:bg-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition text-gray-700 dark:text-gray-300"
                                                >
                                                  İptal
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex justify-between items-start gap-4 flex-wrap">
                                              <div className="flex-1 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                                <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Mevcut Durum</div>
                                                <p className="text-slate-750 dark:text-slate-350 mt-0.5 whitespace-pre-wrap leading-relaxed">
                                                  {art.current_status_notes || <span className="italic text-gray-400">Durum girilmemiş</span>}
                                                </p>
                                              </div>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={() => {
                                                    setEditingNotesArtId(art.id);
                                                    setTempNotesVal(art.current_status_notes || '');
                                                  }}
                                                  className="text-[10px] font-bold text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20 border border-teal-200 px-2.5 py-1 rounded transition"
                                                >
                                                  Düzenle
                                                </button>
                                                {isManager && (
                                                  <>
                                                    <button
                                                      onClick={() => handleRequestArticleNotes(art)}
                                                      className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-amber-250 px-2.5 py-1 rounded transition"
                                                      title="Mevcut Durum veya Evrak Talep Et"
                                                    >
                                                      Evrak Talep Et
                                                    </button>
                                                    <button
                                                      onClick={() => handleOpenActionForArticle(art)}
                                                      className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 border border-blue-200 px-2.5 py-1 rounded transition"
                                                      title="Bu madde özelinde aksiyon aç"
                                                    >
                                                      Aksiyon Aç
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>
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
                Admin'den veya firma içinden talep edilen mevzuat ve güncelleme taleplerini buradan inceleyebilirsiniz.
              </p>
            </div>
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
              <PlusCircle size={16} /> {userRole === 'premium_corporate' ? 'Admin\'den Mevzuat Talape Et' : 'Yeni Mevzuat Talep Et'}
            </button>
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
                    {req.status === 'pending' && userRole === 'premium_corporate' && req.request_type === 'staff_to_owner' && (
                      <button
                        onClick={() => handleEscalateRequestToAdmin(req)}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <PlusCircle size={12} /> Admin'e Yönlendir
                      </button>
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
            {(userRole === 'premium_corporate' || userRole === 'corporate_chief') && (
              <button
                onClick={() => {
                  setNewActionTitle('');
                  setNewActionDesc('');
                  setNewActionClientId('');
                  setReqNotesAssigneeId('');
                  setReqNotesDueDate('');
                  setShowCreateActionModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 whitespace-nowrap self-stretch sm:self-auto justify-center"
              >
                <Plus size={16} /> Yeni Aksiyon Oluştur
              </button>
            )}
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

                if (filtered.length === 0) {
                  return (
                    <div className="md:col-span-2 bg-white dark:bg-slate-800 p-12 rounded-2xl border border-gray-200 dark:border-slate-700 text-center text-gray-500">
                      <CheckCircle className="mx-auto mb-3 opacity-20" size={48} />
                      <p className="font-bold">Açık veya eşleşen bir aksiyon bulunamadı.</p>
                    </div>
                  );
                }

                return filtered.map((act) => {
                  const isAssignee = act.assigned_to === userId;
                  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief';
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
                          <div>Sorumlu: <b>{act.assignee?.full_name || 'Bilinmeyen'}</b></div>
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
                              onClick={() => handleDeleteAction(act.id, act.article_id)}
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
                  ? 'bg-teal-650 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <MapPin size={14} /> Denetim Noktaları & QR Kodlar ({inspectionPoints.length})
            </button>
            <button
              onClick={() => setInspectionsSubTab('forms')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                inspectionsSubTab === 'forms'
                  ? 'bg-teal-655 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <FileText size={14} /> Form Şablonları ({inspectionForms.length})
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
            </div>
          )}
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
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-teal-650 text-white">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Clock size={20} />
                  Denetim Gönderim Geçmişi
                </h3>
                <p className="text-xs opacity-90">{selectedInspectionPoint.form?.client?.name} — {selectedInspectionPoint.name}</p>
              </div>
              <button 
                onClick={() => setShowSubmissionsModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white transition"
              >
                <XCircle size={22} />
              </button>
            </div>

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
                              {sub.submitted_by_name || <span className="italic font-normal text-slate-400">Anonim Saha Personeli</span>}
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
                <div className="text-slate-400 uppercase tracking-wide">Seçili Madde:</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{newActionTitle}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sorumlu Personel *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={reqNotesAssigneeId}
                  onChange={(e) => setReqNotesAssigneeId(e.target.value)}
                  disabled={userRole === 'corporate_staff'}
                >
                  {userRole === 'corporate_staff' ? (
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
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Özel Talimatlar (Opsiyonel)</label>
                <textarea
                  rows={3}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-700 dark:text-slate-300 border-slate-200"
                  placeholder="Personelin dikkat etmesi gereken özel detaylar varsa belirtin..."
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Talep Et
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
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Hedef Müşteri Firma *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionClientId}
                  onChange={(e) => {
                    setNewActionClientId(e.target.value);
                  }}
                >
                  <option value="">-- Müşteri Seçin --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sorumlu Personel *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 dark:text-slate-300 border-slate-200"
                  value={newActionAssigneeId}
                  onChange={(e) => setNewActionAssigneeId(e.target.value)}
                  disabled={userRole === 'corporate_staff'}
                >
                  {userRole === 'corporate_staff' ? (
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
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Detaylar</label>
                <textarea
                  rows={3}
                  placeholder="Yapılması gereken işin detaylı açıklamasını girin..."
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                >
                  Oluştur
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
                      <option key={d.id} value={d.file_url}>{d.title}</option>
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
                        <p className="text-sm font-bold">{member.full_name}</p>
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
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
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

      {/* Edit Client Modal */}
      {showEditClient && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
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
      {/* --- YENİ: ÖZEL MEVZUAT EKLEME MODALİ --- */}
      {showAddCustomLegModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 border border-slate-100 dark:border-slate-700 animate-fadeIn flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-200 flex items-center gap-2 text-lg">
                <BookOpen size={18} className="text-teal-600" />
                Yeni Özel Mevzuat & Yönetmelik Ekle
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

              {/* Maddeler Listesi Önizleme */}
              {legArticles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Ayrıştırılan Maddeler ({legArticles.length} Adet)</h4>
                  <div className="border border-slate-150 dark:border-slate-750 rounded-2xl divide-y max-h-60 overflow-y-auto bg-slate-50/20">
                    {legArticles.map((art, idx) => (
                      <div key={idx} className="p-3.5 space-y-1 bg-white dark:bg-slate-900/10">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex justify-between">
                          <span>{art.article_no} - {art.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Sıra: {art.order_index}</span>
                        </div>
                        <p className="text-xs text-slate-650 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{art.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Butonlar */}
              <div className="flex gap-3 pt-3 border-t border-gray-150 dark:border-slate-750">
                <button
                  type="submit"
                  disabled={savingLegislation}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:shadow-none text-sm"
                >
                  {savingLegislation ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                  Kaydet & Havuza Ekle
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
                    {selectedActionDetails.assignee?.full_name || 'Atanmamış'}
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

      <MapPickerModal
        isOpen={showAddClientMap}
        onClose={() => setShowAddClientMap(false)}
        initialLat={newClient.latitude}
        initialLng={newClient.longitude}
        onSelect={(latVal, lngVal, addressVal) => {
          setNewClient(prev => ({
            ...prev,
            latitude: latVal,
            longitude: lngVal,
            address: prev.address || addressVal || ''
          }));
          setShowAddClientMap(false);
        }}
      />

      <MapPickerModal
        isOpen={showEditClientMap}
        onClose={() => setShowEditClientMap(false)}
        initialLat={editingClient?.latitude}
        initialLng={editingClient?.longitude}
        onSelect={(latVal, lngVal, addressVal) => {
          setEditingClient(prev => ({
            ...prev,
            latitude: latVal,
            longitude: lngVal,
            address: prev.address || addressVal || ''
          }));
          setShowEditClientMap(false);
        }}
      />
    </div>
  );
}
