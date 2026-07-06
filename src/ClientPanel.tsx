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
  Moon
} from 'lucide-react';
import { WASTE_CODES, RECOVERY_CODES, DISPOSAL_CODES } from './wasteCodes';

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

export default function ClientPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [permitCategories, setPermitCategories] = useState<{ stage: string; code: string; title: string }[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [completingActionId, setCompletingActionId] = useState<string | null>(null);
  const [actionNoteInput, setActionNoteInput] = useState('');
  const [actionFileInput, setActionFileInput] = useState<File | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [wastes, setWastes] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'actions' | 'waste' | 'reports' | 'matrix' | 'inspections' | 'legislations'>('overview');

  const NAV_TABS: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Genel Bakış', icon: <Activity size={15} /> },
    { id: 'docs', label: 'Belgelerim', icon: <FileText size={15} /> },
    { id: 'actions', label: 'Aksiyonlar', icon: <CheckCircle size={15} /> },
    { id: 'waste', label: 'Atık Yönetimi', icon: <Trash2 size={15} /> },
    { id: 'matrix', label: 'Zorunlu Belge Matrisi', icon: <Table size={15} /> },
    { id: 'reports', label: 'Aylık & Yıllık Raporlar', icon: <Calendar size={15} /> },
    { id: 'inspections', label: 'Saha QR Denetimleri', icon: <QrCode size={15} /> },
    { id: 'legislations', label: 'Mevzuat Takip', icon: <Scale size={15} /> },
  ];
  
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
    () => (localStorage.getItem('evraklab_client_theme') as 'light' | 'dark') || 'dark'
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
        .select('*, consultant_company:consultant_company_id(name)')
        .eq('id', prof.client_id)
        .single();

      if (clientErr || !client) {
        throw new Error('Müşteri firma detayları bulunamadı.');
      }
      setClientDetails(client);

      const { data: permitCats } = await supabase
        .from('environmental_permit_categories')
        .select('stage, code, title')
        .order('sort_order', { ascending: true });
      setPermitCategories(permitCats || []);

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

    } catch (err: any) {
      console.error(err);
      alert('Veriler yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
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

  // Count helper definitions
  const pendingActions = actions.filter(a => a.status !== 'completed' && a.status !== 'done').length;
  const expiredDocs = documents.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date()).length;

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
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-gray-200 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="p-6 flex-1 max-w-7xl mx-auto w-full">

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Warning if expired docs exist */}
            {expiredDocs > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h5 className="text-xs font-extrabold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Dikkat Edilmesi Gereken Evraklar Mevcut</h5>
                  <p className="text-xs text-rose-300 mt-1">Süresi geçmiş {expiredDocs} adet belgeniz bulunmaktadır. Lütfen güncel belgelerinizi hazırlayıp çevre şefinize iletin.</p>
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

                {clientDetails?.service_start_date ? (() => {
                  const status = getContractStatus(clientDetails.service_start_date);
                  return (
                    <div className="p-3 bg-gray-50 dark:bg-slate-950/40 rounded-xl border border-gray-200 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Hizmet Süresi (1 Yıl)</span>
                        {status.isExpired ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 uppercase">Süresi Doldu</span>
                        ) : status.isWarning ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 uppercase animate-pulse">Son {status.daysLeft} Gün</span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 uppercase">{status.daysLeft} Gün Kaldı</span>
                        )}
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-500 dark:text-slate-400">
                        <span>Başlangıç: <b className="text-gray-800 dark:text-slate-200">{new Date(clientDetails.service_start_date).toLocaleDateString('tr-TR')}</b></span>
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
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1.5">İzin Kapsamı</span>
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
