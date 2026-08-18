import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';
import {
  Shield,
  Search,
  Building,
  Edit,
  Users,
  AlertTriangle,
  Trash2,
  Plus,
  MessageSquare,
  XCircle,
  Send,
  Lock,
  Bell,
  Loader,
  Mail,
  UserPlus,
  Calendar,
  Database,
  Key,
  Phone,
  ShieldAlert,
  Settings,
  Scale,
  BookOpen,
  Upload,
  X,
  Check,
  FileText,
  Save,
  CreditCard,
  Printer,
  TrendingUp,
  Gift,
  Copy,
  Ban,
  CheckSquare,
  RefreshCw,
} from 'lucide-react';
import { extractTextFromPdf } from './localScanner';
import { parseLegislationText } from './parserUtils';
import { SYSTEM_MODULES, DEFAULT_MODULE_KEYS, SYSTEM_MODULE_CATEGORIES } from './moduleRegistry';

import GOOGLE_SCRIPT_CODE from '../google_script_mail_template.js?raw';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<
    'users' | 'companies' | 'tickets' | 'notifications' | 'email_settings' | 'system_settings' | 'legislations' | 'legislation_requests' | 'ced_categories' | 'permit_categories' | 'waste_codes' | 'payments' | 'gift_codes' | 'pricing' | 'module_settings'
  >('tickets');

  const [emailSubTab, setEmailSubTab] = useState<'general' | 'client_script'>('general');
  const [legSubTab, setLegSubTab] = useState<'pool' | 'requests'>('pool');

  // --- MEVZUAT HAVUZU (LEGISLATIONS) STATE'LERİ ---
  const [legislations, setLegislations] = useState<any[]>([]);
  const [legislationRequests, setLegislationRequests] = useState<any[]>([]);
  const [showAddLegislationModal, setShowAddLegislationModal] = useState(false);
  const [editingLegislation, setEditingLegislation] = useState<any>(null);
  
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

  const [showAssignLegModal, setShowAssignLegModal] = useState(false);
  const [assigningLeg, setAssigningLeg] = useState<any>(null);
  const [assignedCompaniesMap, setAssignedCompaniesMap] = useState<Record<string, string[]>>({});
  const [selectedFirmId, setSelectedFirmId] = useState('');

  const [replyingRequest, setReplyingRequest] = useState<any>(null);
  const [requestAdminNotes, setRequestAdminNotes] = useState('');


  // --- E-Posta Hatırlatma Ayarları State'leri ---
  const [emailProvider, setEmailProvider] = useState<'google_script' | 'resend' | 'brevo'>('google_script');
  const [apiKey, setApiKey] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [fetchingSettings, setFetchingSettings] = useState(false);
  const [fetchingLogs, setFetchingLogs] = useState(false);


  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Ticket Yönetimi ---
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- YENİ: Bildirim Gönderme State'leri ---
  const [targetUser, setTargetUser] = useState('all');
  const [userSearchTerm, setUserSearchTerm] = useState('📢 TÜM KULLANICILARA GÖNDER');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // --- YENİ: E-Posta & Sistem Ayarları State'leri ---
  const [systemLogoUrl, setSystemLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // --- YENİ: Fiyatlandırma Ayarları State'leri ---
  const DEFAULT_SUBSCRIPTION_PLANS = {
    individual_standard: {
      '1': { old: 250, price: 99, label: 'Aylık' },
      '3': { old: 750, price: 279, label: '3 Aylık' },
      '6': { old: 1500, price: 499, label: '6 Aylık' },
      '12': { old: 3000, price: 849, label: '1 Yıllık' },
    },
    individual_renewal: {
      '1': { old: 99, price: 79, label: 'Aylık Uzatma' },
      '3': { old: 279, price: 207, label: '3 Aylık Uzatma' },
      '6': { old: 499, price: 354, label: '6 Aylık Uzatma' },
      '12': { old: 849, price: 588, label: '1 Yıllık Uzatma' },
    },
    corporate: {
      '1': { old: 500, price: 199, label: 'Aylık' },
      '3': { old: 1500, price: 567, label: '3 Aylık' },
      '6': { old: 3000, price: 1074, label: '6 Aylık' },
      '12': { old: 6000, price: 1788, label: '1 Yıllık' },
    },
  };
  const DEFAULT_STORAGE_PRICING = {
    supabase_cost_usd_per_gb: 0.021,
    usd_try_rate: 46.84,
    profit_margin_percent: 100,
    packages: [
      { size_gb: 0.5, label: '500 MB Ekstra', override_price: 100 },
      { size_gb: 1, label: '1 GB Ekstra', override_price: 190 },
    ],
  };
  const [subscriptionPlans, setSubscriptionPlans] = useState<any>(DEFAULT_SUBSCRIPTION_PLANS);
  const [storagePricing, setStoragePricing] = useState<any>(DEFAULT_STORAGE_PRICING);
  const [fetchingPricing, setFetchingPricing] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const PLAN_LABELS: Record<string, string> = {
    individual_standard: 'Bireysel Premium (Yeni Üyelik)',
    individual_renewal: 'Bireysel Premium (Yenileme)',
    corporate: 'Kurumsal Premium',
  };
  const DURATIONS = [1, 3, 6, 12];

  const fetchPricingSettings = async () => {
    setFetchingPricing(true);
    try {
      const { data, error } = await supabase.from('pricing_settings').select('*');
      if (error) throw error;
      data?.forEach((row: any) => {
        if (row.key === 'subscription_plans') setSubscriptionPlans(row.value);
        if (row.key === 'storage_pricing') setStoragePricing(row.value);
      });
    } catch (err: any) {
      console.error('Fiyatlandırma ayarları yüklenemedi:', err.message);
    } finally {
      setFetchingPricing(false);
    }
  };

  const updatePlanField = (
    planKey: string,
    duration: number,
    field: 'old' | 'price',
    value: string
  ) => {
    setSubscriptionPlans((prev: any) => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        [duration]: {
          ...prev[planKey]?.[duration],
          [field]: value === '' ? '' : Number(value),
        },
      },
    }));
  };

  const handleSaveSubscriptionPlans = async () => {
    setSavingPricing(true);
    try {
      const { error } = await supabase
        .from('pricing_settings')
        .upsert({ key: 'subscription_plans', value: subscriptionPlans, updated_at: new Date().toISOString() });
      if (error) throw error;
      alert('Üyelik fiyatları başarıyla kaydedildi!');
    } catch (err: any) {
      alert('Kaydedilemedi: ' + err.message);
    } finally {
      setSavingPricing(false);
    }
  };

  const calcStoragePackagePrice = (pkg: any) => {
    if (pkg.override_price !== null && pkg.override_price !== undefined && pkg.override_price !== '') {
      return Number(pkg.override_price);
    }
    const cost = Number(storagePricing.supabase_cost_usd_per_gb) || 0;
    const rate = Number(storagePricing.usd_try_rate) || 0;
    const margin = Number(storagePricing.profit_margin_percent) || 0;
    return Math.round(Number(pkg.size_gb) * cost * rate * (1 + margin / 100) * 100) / 100;
  };

  const updateStorageSetting = (field: string, value: string) => {
    setStoragePricing((prev: any) => ({ ...prev, [field]: value === '' ? '' : Number(value) }));
  };

  const updateStoragePackage = (index: number, field: string, value: string) => {
    setStoragePricing((prev: any) => {
      const packages = [...prev.packages];
      packages[index] = {
        ...packages[index],
        [field]: field === 'label' ? value : value === '' ? null : Number(value),
      };
      return { ...prev, packages };
    });
  };

  const addStoragePackage = () => {
    setStoragePricing((prev: any) => ({
      ...prev,
      packages: [...prev.packages, { size_gb: 1, label: 'Yeni Paket', override_price: null }],
    }));
  };

  const removeStoragePackage = (index: number) => {
    setStoragePricing((prev: any) => ({
      ...prev,
      packages: prev.packages.filter((_: any, i: number) => i !== index),
    }));
  };

  const handleSaveStoragePricing = async () => {
    setSavingPricing(true);
    try {
      const { error } = await supabase
        .from('pricing_settings')
        .upsert({ key: 'storage_pricing', value: storagePricing, updated_at: new Date().toISOString() });
      if (error) throw error;
      alert('Depolama fiyatlandırması başarıyla kaydedildi!');
    } catch (err: any) {
      alert('Kaydedilemedi: ' + err.message);
    } finally {
      setSavingPricing(false);
    }
  };

  // --- Kullanıcı ve Şirket State'leri ---
  const [userQuotaMB, setUserQuotaMB] = useState(0);
  const [companyQuotaMB, setCompanyQuotaMB] = useState(0);
  
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [newOrgNameForUser, setNewOrgNameForUser] = useState('');
  const [newOrgLimitForUser, setNewOrgLimitForUser] = useState(5);

  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [compName, setCompName] = useState('');
  const [compLimit, setCompLimit] = useState(0);
  const [compDate, setCompDate] = useState('');
  const [compIsEnvConsultant, setCompIsEnvConsultant] = useState(false);
  const [compEnabledModules, setCompEnabledModules] = useState<string[]>(DEFAULT_MODULE_KEYS);

  // --- Sistem Modül Ayarları State & Handler'ları ---
  const [sysDefaultModuleKeys, setSysDefaultModuleKeys] = useState<string[]>(DEFAULT_MODULE_KEYS);
  const [fetchingModuleSettings, setFetchingModuleSettings] = useState(false);
  const [savingModuleSettings, setSavingModuleSettings] = useState(false);
  const [bulkApplyingModules, setBulkApplyingModules] = useState(false);

  const fetchSystemModuleDefaults = async () => {
    setFetchingModuleSettings(true);
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('*')
        .eq('key', 'default_system_modules')
        .maybeSingle();

      if (error) throw error;
      if (data?.value && Array.isArray(data.value)) {
        setSysDefaultModuleKeys(data.value);
      }
    } catch (err: any) {
      console.warn('Varsayılan sistem modülleri yüklenemedi:', err.message);
    } finally {
      setFetchingModuleSettings(false);
    }
  };

  const handleSaveSystemModuleDefaults = async () => {
    setSavingModuleSettings(true);
    try {
      const { error } = await supabase
        .from('pricing_settings')
        .upsert({
          key: 'default_system_modules',
          value: sysDefaultModuleKeys,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      alert('Sistem varsayılan modül ayarları kaydedildi!');
    } catch (err: any) {
      alert('Modül ayarları kaydedilemedi: ' + err.message);
    } finally {
      setSavingModuleSettings(false);
    }
  };

  const handleBulkApplyDefaultModulesToAllCompanies = async () => {
    if (!window.confirm('DİKKAT: Sistemdeki TÜM şirketlerin aktif modülleri, seçilen bu varsayılan liste ile güncellenecektir. Devam etmek istiyor musunuz?')) return;
    setBulkApplyingModules(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ enabled_modules: sysDefaultModuleKeys })
        .not('id', 'is', null);

      if (error) throw error;
      alert('Tüm şirketlerin modül izinleri başarıyla güncellendi!');
      fetchCompanies();
    } catch (err: any) {
      alert('Toplu güncelleme sırasında hata: ' + err.message);
    } finally {
      setBulkApplyingModules(false);
    }
  };

  // --- Depolama Sağlayıcısı (Supabase / Firmanın kendi Google Drive'ı) ---
  const [compStoragePreference, setCompStoragePreference] = useState<'supabase' | 'google_drive'>('supabase');
  const [compGoogleClientId, setCompGoogleClientId] = useState('');
  const [compGoogleClientSecret, setCompGoogleClientSecret] = useState('');
  const [compGoogleDriveFolderId, setCompGoogleDriveFolderId] = useState('');
  const [compGoogleDriveRefreshToken, setCompGoogleDriveRefreshToken] = useState('');
  const [compGoogleDriveConnectedEmail, setCompGoogleDriveConnectedEmail] = useState('');
  const [connectingGoogleDrive, setConnectingGoogleDrive] = useState(false);

  const [viewTeamOrg, setViewTeamOrg] = useState<any>(null);
  const [teamList, setTeamList] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');

  // --- YENİ: Hata ve Yükleme State'leri ---
  const [companySaveError, setCompanySaveError] = useState<string | null>(null);
  const [userSaveError, setUserSaveError] = useState<string | null>(null);

  // --- YENİ: Kullanıcı Oluşturma State'leri ---
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createRole, setCreateRole] = useState('normal');
  const [createOrgId, setCreateOrgId] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createQuotaMB, setCreateQuotaMB] = useState(50);
  const [createUserLoading, setCreateUserLoading] = useState(false);

  const roleLabels: any = {
    normal: 'Normal',
    premium_individual: 'Bireysel Premium',
    premium_corporate: 'Çevre Danışmanlık Firma Sahibi',
    corporate_chief: 'Çevre Danışmanlık Firma Yöneticisi',
    corporate_staff: 'Çevre Danışmanlık Personeli',
    admin: 'Admin',
    system_admin: 'Sistem Admin',
  };
  const isCorporateRole = (r: string) =>
    ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(r);

  const fetchGlobalLegislations = async () => {
    try {
      const { data, error } = await supabase
        .from('pdf_regulations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLegislations(data || []);

      const { data: assigns, error: assignErr } = await supabase
        .from('company_pdf_regulations')
        .select('*');
      if (!assignErr && assigns) {
        const map: Record<string, string[]> = {};
        assigns.forEach(a => {
          if (!map[a.regulation_id]) map[a.regulation_id] = [];
          map[a.regulation_id].push(a.company_id);
        });
        setAssignedCompaniesMap(map);
      }
    } catch (err: any) {
      console.error('Mevzuatlar çekilirken hata:', err.message);
    }
  };

  const fetchLegislationRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('regulation_requests')
        .select('*, requester:profiles!requested_by(full_name, email), client:consultant_clients!client_id(name), organization:organizations!organization_id(name), regulation:pdf_regulations!target_regulation_id(title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLegislationRequests(data || []);
    } catch (err: any) {
      console.error('Mevzuat talepleri çekilirken hata:', err.message);
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

  const handleSaveLegislation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legTitle.trim()) return alert('Lütfen mevzuat başlığını girin.');
    if (legArticles.length === 0) {
      if (!window.confirm('Bu mevzuatta hiç madde bulunmuyor. Yine de kaydetmek istiyor musunuz?')) return;
    }

    try {
      let regId = editingLegislation?.id;

      if (regId) {
        const { error: regErr } = await supabase
          .from('pdf_regulations')
          .update({
            title: legTitle.trim(),
            category: legCategory,
            publication_date: legPubDate || null,
            effective_date: legEffDate || null,
            rg_no: legRgNo || null,
            rg_date: legRgDate || null
          })
          .eq('id', regId);
        if (regErr) throw regErr;

        const { error: delErr } = await supabase
          .from('pdf_articles')
          .delete()
          .eq('regulation_id', regId);
        if (delErr) throw delErr;
      } else {
        const { data: newReg, error: regErr } = await supabase
          .from('pdf_regulations')
          .insert({
            title: legTitle.trim(),
            category: legCategory,
            publication_date: legPubDate || null,
            effective_date: legEffDate || null,
            rg_no: legRgNo || null,
            rg_date: legRgDate || null
          })
          .select()
          .single();
        if (regErr) throw regErr;
        regId = newReg.id;
      }

      if (legArticles.length > 0) {
        const articlesToInsert = legArticles.map((art, index) => ({
          regulation_id: regId,
          article_no: art.article_no || `Madde ${index + 1}`,
          title: art.title || `Madde ${index + 1}`,
          content: art.content || '',
          order_index: index + 1
        }));

        const { error: artErr } = await supabase
          .from('pdf_articles')
          .insert(articlesToInsert);
        if (artErr) throw artErr;
      }

      alert('Mevzuat başarıyla kaydedildi!');
      setShowAddLegislationModal(false);
      setEditingLegislation(null);
      setLegTitle('');
      setLegCategory('Yönetmelik');
      setLegPubDate('');
      setLegEffDate('');
      setLegRgNo('');
      setLegRgDate('');
      setLegArticles([]);
      fetchGlobalLegislations();
    } catch (err: any) {
      alert('Mevzuat kaydedilirken hata oluştu: ' + err.message);
    }
  };

  const handleDeleteLegislation = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" mevzuatını sistemden silmek istediğinize emin misiniz? Bu mevzuata bağlı tüm maddeler ve firmalardaki uyum kayıtları etkilenecektir!`)) return;
    try {
      const { error } = await supabase
        .from('pdf_regulations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Mevzuat silindi.');
      fetchGlobalLegislations();
    } catch (err: any) {
      alert('Mevzuat silinirken hata: ' + err.message);
    }
  };

  const handleAssignLegislation = async () => {
    if (!selectedFirmId || !assigningLeg) return;
    try {
      const { error } = await supabase
        .from('company_pdf_regulations')
        .insert({
          company_id: selectedFirmId,
          regulation_id: assigningLeg.id
        });
      if (error) throw error;
      alert('Mevzuat firmaya başarıyla tanımlandı!');
      setSelectedFirmId('');
      setShowAssignLegModal(false);
      fetchGlobalLegislations();
    } catch (err: any) {
      alert('Atama yapılırken hata: ' + err.message);
    }
  };

  const handleRemoveCompanyLegislation = async (regId: string, companyId: string) => {
    if (!window.confirm('Bu mevzuatın firma erişimini kaldırmak istiyor musunuz?')) return;
    try {
      const { error } = await supabase
        .from('company_pdf_regulations')
        .delete()
        .eq('regulation_id', regId)
        .eq('company_id', companyId);
      if (error) throw error;
      alert('Atama kaldırıldı.');
      fetchGlobalLegislations();
    } catch (err: any) {
      alert('İptal edilirken hata: ' + err.message);
    }
  };

  const handleRequestStatusUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { data: currentReq, error: getErr } = await supabase
        .from('regulation_requests')
        .select('parent_request_id')
        .eq('id', requestId)
        .single();
      
      const { error } = await supabase
        .from('regulation_requests')
        .update({
          status,
          admin_notes: requestAdminNotes.trim()
        })
        .eq('id', requestId);
      if (error) throw error;

      if (currentReq?.parent_request_id) {
        await supabase
          .from('regulation_requests')
          .update({
            status,
            admin_notes: requestAdminNotes.trim()
          })
          .eq('id', currentReq.parent_request_id);
      }

      alert('Talep güncellendi.');
      setReplyingRequest(null);
      setRequestAdminNotes('');
      fetchLegislationRequests();
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'notifications') fetchUsers();
    else if (activeTab === 'companies') fetchCompanies();
    else if (activeTab === 'tickets') fetchTickets();
    else if (activeTab === 'email_settings') {
      fetchEmailSettings();
      fetchEmailLogs();
    } else if (activeTab === 'system_settings') {
      fetchSystemLogoSettings();
    } else if (activeTab === 'pricing') {
      fetchPricingSettings();
    } else if (activeTab === 'legislations') {
      fetchGlobalLegislations();
      fetchLegislationRequests();
      fetchCompanies();
    } else if (activeTab === 'ced_categories') {
      fetchCedCategories();
    } else if (activeTab === 'waste_codes') {
      fetchCustomWasteCodes();
    } else if (activeTab === 'permit_categories') {
      fetchPermitCategories();
    } else if (activeTab === 'payments') {
      fetchPayments();
    } else if (activeTab === 'gift_codes') {
      fetchGiftCodes();
    } else if (activeTab === 'module_settings') {
      fetchSystemModuleDefaults();
    }
  }, [activeTab]);


  const fetchEmailSettings = async () => {
    setFetchingSettings(true);
    try {
      const { data, error } = await supabase.from('email_settings').select('*');
      if (error) throw error;
      if (data) {
        data.forEach((item: any) => {
          if (item.key === 'email_provider') setEmailProvider(item.value);
          if (item.key === 'api_key') setApiKey(item.value);
          if (item.key === 'sender_email') setSenderEmail(item.value);
          if (item.key === 'script_url') setScriptUrl(item.value);
          if (item.key === 'system_logo_url') setSystemLogoUrl(item.value);
        });
      }
    } catch (err: any) {
      console.error('E-posta ayarları yüklenemedi:', err.message);
    } finally {
      setFetchingSettings(false);
    }
  };

  const fetchEmailLogs = async () => {
    setFetchingLogs(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*, document:documents(title)')
        .order('sent_at', { ascending: false });
      if (error) throw error;
      setEmailLogs(data || []);
    } catch (err: any) {
      console.error('E-posta günlükleri yüklenemedi:', err.message);
    } finally {
      setFetchingLogs(false);
    }
  };

  const handleUploadSystemLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const filePath = `system_logo/${fileName}`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setSystemLogoUrl(urlData.publicUrl);
      alert('Sistem logosu başarıyla yüklendi! Lütfen ayarları kaydedin.');
    } catch (err: any) {
      console.error('Logo yükleme hatası:', err.message);
      alert('Logo yüklenemedi: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const [savingLogo, setSavingLogo] = useState(false);

  const fetchSystemLogoSettings = async () => {
    setFetchingSettings(true);
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .eq('key', 'system_logo_url')
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSystemLogoUrl(data.value);
      }
    } catch (err: any) {
      console.error('Sistem logosunu çekme hatası:', err.message);
    } finally {
      setFetchingSettings(false);
    }
  };

  const handleSaveSystemLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLogo(true);
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert({ key: 'system_logo_url', value: systemLogoUrl });
      if (error) throw error;
      alert('Sistem logosu başarıyla kaydedildi!');
      window.location.reload();
    } catch (err: any) {
      console.error('Logo kaydedilirken hata:', err.message);
      alert('Logo kaydedilemedi: ' + err.message);
    } finally {
      setSavingLogo(false);
    }
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const settings = [
        { key: 'email_provider', value: emailProvider },
        { key: 'api_key', value: apiKey },
        { key: 'sender_email', value: senderEmail },
        { key: 'script_url', value: scriptUrl },
      ];
      const { error } = await supabase.from('email_settings').upsert(settings);
      if (error) throw error;
      alert('E-posta ayarları başarıyla kaydedildi!');
    } catch (err: any) {
      console.error('E-posta ayarları kaydedilirken hata:', err.message);
      alert('Ayarlar kaydedilemedi: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const handleTriggerEmailReminders = async () => {
    if (!window.confirm('E-posta hatırlatıcılarını şimdi manuel olarak tetiklemek istiyor musunuz? Bu işlem, koşulları sağlayan belgelere sahip tüm kullanıcılara ve hizmet sözleşmesi dolan/dolmak üzere olan işletmelere hatırlatma e-postaları gönderecektir.')) {
      return;
    }
    setTriggeringReminders(true);
    try {
      // Belge geçerlilik süresi hatırlatıcıları
      const { error: expiryErr } = await supabase.rpc('send_expiry_reminders');
      if (expiryErr) throw expiryErr;

      // İşletme hizmet sözleşmesi hatırlatıcıları
      const { error: contractErr } = await supabase.rpc('send_client_contract_reminders');
      if (contractErr) throw contractErr;

      alert('E-posta ve sözleşme hatırlatma fonksiyonları başarıyla tetiklendi!');
      fetchEmailLogs();
    } catch (err: any) {
      console.error('Hatırlatma tetikleme hatası:', err.message);
      alert('Hata: ' + err.message);
    } finally {
      setTriggeringReminders(false);
    }
  };


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketMessages]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Kullanıcıları ve Şirketleri ayrı ayrı çek (İlişki hatasını baypas etmek için manuel join)
      const { data: profs, error: pErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      const { data: comps, error: cErr } = await supabase.from('companies').select('id, name, subscription_end_date');
      
      if (pErr) throw pErr;

      // Manuel Map ile birleştir
      const companyMap = new Map();
      if(comps) comps.forEach(c => companyMap.set(c.id, c));

      const mergedUsers = (profs || []).map(u => ({
          ...u,
          organization: companyMap.get(u.organization_id) || null
      }));

      setUsers(mergedUsers);
    } catch (err: any) {
      console.error("Kullanıcı listesi çekilirken hata:", err.message);
      setUsers([]);
    }
    setLoading(false);
  };

  const [companyFetchError, setCompanyFetchError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    setCompanyFetchError(null);
    try {
      // 1. Deneme: 'companies' tablosu
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (err: any) {
      console.warn("Şirket listesi 'companies' tablosundan çekilemedi:", err.message);
      
      try {
        // 2. Deneme: 'organizations' tablosu (Eski isim)
        const { data: orgData, error: orgError } = await supabase.from('organizations').select('*');
        if (orgError) throw orgError;
        setCompanies(orgData || []);
      } catch (err2: any) {
        setCompanyFetchError(`Tablo bulunamadı: ${err.message}`);
        console.error("Tüm tablo denemeleri başarısız oldu.");
      }
    }
    setLoading(false);
  };

  // --- ÇED PROJE KATEGORİLERİ (EK-1 / EK-2) YÖNETİMİ ---
  // İşletmelerin "ÇED Durumu" alanında seçilebilen madde listesi; ConsultantPanel'deki
  // İşletme Ekle/Düzenle/Şube Ekle formları bu tabloyu okuyor (ced_project_categories).
  const [cedCategories, setCedCategories] = useState<any[]>([]);
  const [loadingCed, setLoadingCed] = useState(false);
  const [cedStageFilter, setCedStageFilter] = useState<'ek1' | 'ek2'>('ek1');
  const [cedSearch, setCedSearch] = useState('');
  const [editingCedItem, setEditingCedItem] = useState<any>(null);
  const [cedFormCode, setCedFormCode] = useState('');
  const [cedFormTitle, setCedFormTitle] = useState('');
  const [savingCed, setSavingCed] = useState(false);

  const fetchCedCategories = async () => {
    setLoadingCed(true);
    const { data, error } = await supabase
      .from('ced_project_categories')
      .select('*')
      .order('stage', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('ÇED kategorileri çekilirken hata:', error.message);
    } else {
      setCedCategories(data || []);
    }
    setLoadingCed(false);
  };

  const openCedModal = (item?: any) => {
    if (item) {
      setEditingCedItem(item);
      setCedFormCode(item.code);
      setCedFormTitle(item.title);
    } else {
      setEditingCedItem({ id: 'new', stage: cedStageFilter });
      setCedFormCode('');
      setCedFormTitle('');
    }
  };

  const handleSaveCedCategory = async () => {
    if (!cedFormCode.trim() || !cedFormTitle.trim()) {
      alert('Kod ve başlık alanları zorunludur.');
      return;
    }
    setSavingCed(true);
    try {
      if (editingCedItem.id === 'new') {
        const maxSort = Math.max(0, ...cedCategories.filter((c) => c.stage === editingCedItem.stage).map((c) => c.sort_order || 0));
        const { error } = await supabase.from('ced_project_categories').insert({
          stage: editingCedItem.stage,
          code: cedFormCode.trim(),
          title: cedFormTitle.trim(),
          sort_order: maxSort + 1,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ced_project_categories')
          .update({ code: cedFormCode.trim(), title: cedFormTitle.trim() })
          .eq('id', editingCedItem.id);
        if (error) throw error;
      }
      setEditingCedItem(null);
      await fetchCedCategories();
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSavingCed(false);
    }
  };

  const handleDeleteCedCategory = async (id: string) => {
    if (!window.confirm('Bu maddeyi silmek istediğinize emin misiniz? Bu maddeyi zaten seçmiş işletmelerin kayıtlarından otomatik kaldırılmaz, sadece yeni seçim listesinden çıkar.')) return;
    const { error } = await supabase.from('ced_project_categories').delete().eq('id', id);
    if (error) {
      alert('Silinirken hata: ' + error.message);
      return;
    }
    await fetchCedCategories();
  };

  // --- ATIK KODLARI KATALOĞU YÖNETİMİ ---
  // Atık Yönetimi ekranındaki (WasteManagement.tsx) statik Avrupa Atık Kataloğu
  // listesinde (wasteCodes.ts) olmayan bir kod girildiğinde, admin bunu buradan
  // kalıcı olarak katalogla ekleyebilir; eklenen kod tüm kullanıcılara görünür.
  const [customWasteCodes, setCustomWasteCodes] = useState<any[]>([]);
  const [loadingWasteCodes, setLoadingWasteCodes] = useState(false);
  const [wasteCodeSearch, setWasteCodeSearch] = useState('');
  const [editingWasteCodeItem, setEditingWasteCodeItem] = useState<any>(null);
  const [wasteCodeFormCode, setWasteCodeFormCode] = useState('');
  const [wasteCodeFormName, setWasteCodeFormName] = useState('');
  const [wasteCodeFormDesc, setWasteCodeFormDesc] = useState('');
  const [savingWasteCode, setSavingWasteCode] = useState(false);

  const fetchCustomWasteCodes = async () => {
    setLoadingWasteCodes(true);
    const { data, error } = await supabase
      .from('custom_waste_codes')
      .select('*')
      .order('code', { ascending: true });
    if (error) {
      console.error('Atık kodları çekilirken hata:', error.message);
    } else {
      setCustomWasteCodes(data || []);
    }
    setLoadingWasteCodes(false);
  };

  const openWasteCodeModal = (item?: any) => {
    if (item) {
      setEditingWasteCodeItem(item);
      setWasteCodeFormCode(item.code);
      setWasteCodeFormName(item.name);
      setWasteCodeFormDesc(item.description || '');
    } else {
      setEditingWasteCodeItem({ id: 'new' });
      setWasteCodeFormCode('');
      setWasteCodeFormName('');
      setWasteCodeFormDesc('');
    }
  };

  const handleSaveWasteCode = async () => {
    if (!wasteCodeFormCode.trim() || !wasteCodeFormName.trim()) {
      alert('Kod ve ad alanları zorunludur.');
      return;
    }
    setSavingWasteCode(true);
    try {
      if (editingWasteCodeItem.id === 'new') {
        const { error } = await supabase.from('custom_waste_codes').insert({
          code: wasteCodeFormCode.trim(),
          name: wasteCodeFormName.trim(),
          description: wasteCodeFormDesc.trim() || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_waste_codes')
          .update({
            code: wasteCodeFormCode.trim(),
            name: wasteCodeFormName.trim(),
            description: wasteCodeFormDesc.trim() || null,
          })
          .eq('id', editingWasteCodeItem.id);
        if (error) throw error;
      }
      setEditingWasteCodeItem(null);
      await fetchCustomWasteCodes();
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSavingWasteCode(false);
    }
  };

  const handleDeleteWasteCode = async (id: string) => {
    if (!window.confirm('Bu atık kodunu silmek istediğinize emin misiniz? Bu kodu zaten kullanmış kayıtlardan otomatik kaldırılmaz, sadece yeni seçim listesinden çıkar.')) return;
    const { error } = await supabase.from('custom_waste_codes').delete().eq('id', id);
    if (error) {
      alert('Silinirken hata: ' + error.message);
      return;
    }
    await fetchCustomWasteCodes();
  };

  // --- ÇEVRE İZİN VE LİSANS (EK-1 / EK-2) FAALİYET LİSTESİ YÖNETİMİ ---
  // Danışman panelindeki İşletme Ekle/Düzenle formlarındaki "Çevre İzin/Lisans
  // Kapsamı" alanı bu tabloyu (environmental_permit_categories) okuyor.
  // ÇED listesinden tamamen bağımsız, ayrı bir sınıflandırmadır.
  const [permitCategories, setPermitCategories] = useState<any[]>([]);
  const [loadingPermit, setLoadingPermit] = useState(false);
  const [permitStageFilter, setPermitStageFilter] = useState<'ek1' | 'ek2'>('ek1');
  const [permitSearch, setPermitSearch] = useState('');
  const [editingPermitItem, setEditingPermitItem] = useState<any>(null);
  const [permitFormCode, setPermitFormCode] = useState('');
  const [permitFormTitle, setPermitFormTitle] = useState('');
  const [savingPermit, setSavingPermit] = useState(false);

  const fetchPermitCategories = async () => {
    setLoadingPermit(true);
    const { data, error } = await supabase
      .from('environmental_permit_categories')
      .select('*')
      .order('stage', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Çevre izin kategorileri çekilirken hata:', error.message);
    } else {
      setPermitCategories(data || []);
    }
    setLoadingPermit(false);
  };

  const openPermitModal = (item?: any) => {
    if (item) {
      setEditingPermitItem(item);
      setPermitFormCode(item.code);
      setPermitFormTitle(item.title);
    } else {
      setEditingPermitItem({ id: 'new', stage: permitStageFilter });
      setPermitFormCode('');
      setPermitFormTitle('');
    }
  };

  const handleSavePermitCategory = async () => {
    if (!permitFormCode.trim() || !permitFormTitle.trim()) {
      alert('Kod ve başlık alanları zorunludur.');
      return;
    }
    setSavingPermit(true);
    try {
      if (editingPermitItem.id === 'new') {
        const maxSort = Math.max(0, ...permitCategories.filter((c) => c.stage === editingPermitItem.stage).map((c) => c.sort_order || 0));
        const { error } = await supabase.from('environmental_permit_categories').insert({
          stage: editingPermitItem.stage,
          code: permitFormCode.trim(),
          title: permitFormTitle.trim(),
          sort_order: maxSort + 1,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('environmental_permit_categories')
          .update({ code: permitFormCode.trim(), title: permitFormTitle.trim() })
          .eq('id', editingPermitItem.id);
        if (error) throw error;
      }
      setEditingPermitItem(null);
      await fetchPermitCategories();
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSavingPermit(false);
    }
  };

  const handleDeletePermitCategory = async (id: string) => {
    if (!window.confirm('Bu maddeyi silmek istediğinize emin misiniz? Bu maddeyi zaten seçmiş işletmelerin kayıtlarından otomatik kaldırılmaz, sadece yeni seçim listesinden çıkar.')) return;
    const { error } = await supabase.from('environmental_permit_categories').delete().eq('id', id);
    if (error) {
      alert('Silinirken hata: ' + error.message);
      return;
    }
    await fetchPermitCategories();
  };

  // --- ÖDEMELER & FATURALAR (Premium satın alım geçmişi) ---
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsPlanFilter, setPaymentsPlanFilter] = useState('');
  const [invoicingPayment, setInvoicingPayment] = useState<any>(null);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceTaxId, setInvoiceTaxId] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('*, payer:profiles!user_id(full_name, email), organization:organizations(name)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Ödemeler çekilirken hata:', error.message);
    } else {
      setPayments(data || []);
    }
    setLoadingPayments(false);
  };

  const planTypeLabel = (type: string) => {
    switch (type) {
      case 'individual': return 'Bireysel Premium';
      case 'corporate_new': return 'Kurumsal (Yeni Şirket)';
      case 'corporate_renewal': return 'Kurumsal Yenileme';
      case 'storage': return 'Ekstra Depolama';
      default: return type;
    }
  };

  const now = new Date();
  const currentMonthPayments = payments.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const uniqueBuyers = new Set(payments.map((p) => p.organization_id || p.user_id)).size;

  const openInvoiceModal = (payment: any) => {
    setInvoicingPayment(payment);
    setInvoiceTitle(payment.invoice_title || payment.organization?.name || payment.payer?.full_name || '');
    setInvoiceTaxId(payment.invoice_tax_id || '');
    setInvoiceAddress(payment.invoice_address || '');
  };

  const handleGenerateInvoice = async () => {
    if (!invoicingPayment) return;
    if (!invoiceTitle.trim()) {
      alert('Fatura ünvanı zorunludur.');
      return;
    }
    setSavingInvoice(true);
    try {
      const invoiceNo = invoicingPayment.invoice_no || `EVR-${new Date().getFullYear()}-${String(payments.length + 1).padStart(5, '0')}`;
      const generatedAt = invoicingPayment.invoice_generated_at || new Date().toISOString();

      const { error } = await supabase
        .from('subscription_payments')
        .update({
          invoice_no: invoiceNo,
          invoice_title: invoiceTitle.trim(),
          invoice_tax_id: invoiceTaxId.trim(),
          invoice_address: invoiceAddress.trim(),
          invoice_generated_at: generatedAt,
        })
        .eq('id', invoicingPayment.id);
      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fatura ${invoiceNo}</title>
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; margin: 0; font-size: 13px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
    .header-logo { font-size: 22px; font-weight: 800; color: #0f172a; }
    .header-logo span { color: #2ca58d; }
    .header-meta { text-align: right; font-size: 12px; color: #64748b; font-weight: 600; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .label { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f1f5f9; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px; }
    .right { text-align: right; }
    .total-row td { font-weight: 800; font-size: 15px; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-logo">EVRAK<span>LAB</span></div>
      <div style="font-size:10px; font-weight:bold; color:#64748b; margin-top:2px;">ÇEVRE MEVZUATI TAKİP SİSTEMİ</div>
    </div>
    <div class="header-meta">
      <div>Fatura No: <b>${invoiceNo}</b></div>
      <div>Tarih: ${new Date(generatedAt).toLocaleDateString('tr-TR')}</div>
    </div>
  </div>
  <div class="box">
    <div class="label">Fatura Edilen</div>
    <div style="font-weight:800; font-size:15px;">${invoiceTitle.trim()}</div>
    ${invoiceTaxId.trim() ? `<div style="margin-top:4px; color:#475569;">Vergi No: ${invoiceTaxId.trim()}</div>` : ''}
    ${invoiceAddress.trim() ? `<div style="margin-top:4px; color:#475569;">${invoiceAddress.trim()}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Açıklama</th><th>Detay</th><th class="right">Tutar</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${planTypeLabel(invoicingPayment.plan_type)}</td>
        <td>${invoicingPayment.duration_months ? invoicingPayment.duration_months + ' Ay' : ''}${invoicingPayment.seats ? ' · ' + invoicingPayment.seats + ' Kişi' : ''}${invoicingPayment.storage_bytes ? ' · Ekstra Depolama' : ''}</td>
        <td class="right">${Number(invoicingPayment.amount).toLocaleString('tr-TR')} ₺</td>
      </tr>
      <tr class="total-row">
        <td colspan="2">TOPLAM</td>
        <td class="right">${Number(invoicingPayment.amount).toLocaleString('tr-TR')} ₺</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
      }

      setInvoicingPayment(null);
      await fetchPayments();
    } catch (err: any) {
      alert('Fatura oluşturulurken hata: ' + err.message);
    } finally {
      setSavingInvoice(false);
    }
  };

  // --- HEDİYE KODLARI (Premium redemption kodları) ---
  const [giftCodes, setGiftCodes] = useState<any[]>([]);
  const [loadingGiftCodes, setLoadingGiftCodes] = useState(false);
  const [newGiftType, setNewGiftType] = useState<'individual' | 'corporate'>('individual');
  const [newGiftDuration, setNewGiftDuration] = useState(1);
  const [newGiftSeats, setNewGiftSeats] = useState(3);
  const [newGiftNote, setNewGiftNote] = useState('');
  const [creatingGiftCode, setCreatingGiftCode] = useState(false);

  const fetchGiftCodes = async () => {
    setLoadingGiftCodes(true);
    const { data, error } = await supabase
      .from('premium_gift_codes')
      .select('*, redeemer:profiles!redeemed_by(full_name, email), organization:organizations(name)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Hediye kodları çekilirken hata:', error.message);
    } else {
      setGiftCodes(data || []);
    }
    setLoadingGiftCodes(false);
  };

  const handleCreateGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGiftCode(true);
    try {
      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      const { error } = await supabase.from('premium_gift_codes').insert([
        {
          code,
          type: newGiftType,
          duration_months: newGiftDuration,
          seats: newGiftType === 'corporate' ? newGiftSeats : null,
          note: newGiftNote.trim() || null,
          created_by: (await supabase.auth.getSession()).data.session?.user.id,
        },
      ]);
      if (error) throw error;
      alert(`✅ Kod Oluşturuldu: ${code}`);
      setNewGiftNote('');
      fetchGiftCodes();
    } catch (err: any) {
      alert('Kod oluşturulamadı: ' + err.message);
    } finally {
      setCreatingGiftCode(false);
    }
  };

  const handleRevokeGiftCode = async (id: string) => {
    if (!window.confirm('Bu kodu iptal etmek istediğinize emin misiniz?')) return;
    const { error } = await supabase
      .from('premium_gift_codes')
      .update({ status: 'revoked' })
      .eq('id', id);
    if (error) return alert('İptal edilemedi: ' + error.message);
    fetchGiftCodes();
  };

  const copyGiftCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Kopyalandı: ' + code);
  };

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('*, sender:profiles!user_id(full_name, email)')
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  // --- YENİ: Bildirim Gönderme Fonksiyonu ---
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim())
      return alert('Başlık ve mesaj zorunludur.');

    setSendingNotif(true);
    try {
      let notificationsToInsert = [];

      if (targetUser === 'all') {
        // Herkese Gönder
        notificationsToInsert = users.map((u) => ({
          user_id: u.id,
          title: notifTitle,
          message: notifMessage,
          type: 'system_admin_announcement',
          is_read: false,
        }));
      } else {
        // Tek Kişiye Gönder
        notificationsToInsert = [
          {
            user_id: targetUser,
            title: notifTitle,
            message: notifMessage,
            type: 'system_admin_msg',
            is_read: false,
          },
        ];
      }

      const { error } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (error) throw error;

      alert('Bildirim başarıyla gönderildi!');
      setNotifTitle('');
      setNotifMessage('');
      setTargetUser('all');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingNotif(false);
    }
  };

  const selectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setTicketMessages(data || []);
  };

  const handleReplyTicket = async (ticketId?: any) => {
    const targetId =
      typeof ticketId === 'string' ? ticketId : selectedTicket?.id;

    if (!targetId) {
      return alert('Hata: Hangi destek talebine cevap verileceği bulunamadı.');
    }

    if (!replyText.trim()) return;

    const { error } = await supabase
      .from('ticket_messages')
      .insert([
        { ticket_id: targetId, sender_role: 'admin', message: replyText },
      ]);

    if (error) {
      console.error('Mesaj hatası:', error);
      return alert('Mesaj gönderilemedi: ' + error.message);
    }

    await supabase
      .from('tickets')
      .update({
        status: 'replied',
        has_unread_messages: true,
      })
      .eq('id', targetId);

    setReplyText('');

    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', targetId)
      .order('created_at', { ascending: true });
    setTicketMessages(data || []);

    fetchTickets();
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;
    if (!window.confirm('Bu talebi kapatmak istediğinize emin misiniz?'))
      return;

    await supabase
      .from('tickets')
      .update({ status: 'closed' })
      .eq('id', selectedTicket.id);
    alert('Talep kapatıldı.');
    setSelectedTicket(null);
    fetchTickets();
  };

  const openTeamModal = async (org: any) => {
    setViewTeamOrg(org);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', org.id);
    setTeamList(data || []);
  };

  const removeUserFromOrg = async (userId: string) => {
    if (!window.confirm('Bu kullanıcıyı şirketten çıkarmak istiyor musunuz?'))
      return;
    await supabase
      .from('profiles')
      .update({ organization_id: null, role: 'normal' })
      .eq('id', userId);
    await supabase.rpc('clear_membership_notifications', { target_user_id: userId });
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', viewTeamOrg.id);
    setTeamList(data || []);
  };

  const addUserToOrg = async () => {
    if (!newUserEmail) return;
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newUserEmail)
      .single();
    if (!user) return alert('Bu e-posta ile kayıtlı kullanıcı bulunamadı.');
    await supabase
      .from('profiles')
      .update({ organization_id: viewTeamOrg.id, role: 'corporate_staff' })
      .eq('id', user.id);
    alert('Kullanıcı şirkete eklendi!');
    setNewUserEmail('');
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', viewTeamOrg.id);
    setTeamList(data || []);
  };

  const updateMemberRole = async (memberId: string, role: string) => {
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
      
      // Şirketten çıkarıldıysa veya güncellendiyse listeyi yenile
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', viewTeamOrg.id);
      setTeamList(data || []);
      
      fetchUsers();
    } catch (err: any) {
      console.error("Kullanıcı rolü güncellenirken hata:", err);
      alert('Rol güncellenemedi: ' + err.message);
    }
  };

  const openUserModal = async (user: any) => {
    setEditingUser(user);
    setNewRole(user.role);
    let date = user.subscription_end_date;
    if (isCorporateRole(user.role) && user.organization)
      date = user.organization.subscription_end_date;
    setNewEndDate(date ? new Date(date).toISOString().split('T')[0] : '');
    setSelectedOrgId(user.organization_id || '');
    setNewOrgNameForUser('');
    setUserQuotaMB(Math.round((user.storage_limit || 0) / 1048576));
    await fetchCompanies();
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    if (isCorporateRole(newRole)) {
      if (
        !window.confirm(
          '⚠️ Şirket tarihini değiştiriyorsunuz. Tüm personel etkilenecek.'
        )
      )
        return;
    } else {
      if (!window.confirm('Kullanıcıyı güncellemek istediğinize emin misiniz?'))
        return;
    }

    setUserSaveError(null);
    try {
      const finalDate = newEndDate ? new Date(newEndDate).toISOString() : null;
      let targetOrgId = editingUser.organization_id;

      if (isCorporateRole(newRole)) {
        if (selectedOrgId === 'new') {
          if (!newOrgNameForUser.trim()) return alert('Şirket adı giriniz.');
          const { data: newOrg, error } = await supabase
            .from('companies')
            .insert([
              {
                name: newOrgNameForUser,
                member_limit: newOrgLimitForUser,
                subscription_end_date: finalDate,
              },
            ])
            .select()
            .single();
          if (error) throw error;
          targetOrgId = newOrg.id;
        } else if (selectedOrgId) {
          targetOrgId = selectedOrgId;
          const { error: orgDateErr } = await supabase
            .from('companies')
            .update({ subscription_end_date: finalDate })
            .eq('id', targetOrgId);
          if (orgDateErr) throw orgDateErr;
        } else return alert('Şirket seçmelisiniz.');
      }

      const updates: any = { 
        role: newRole,
        storage_limit: userQuotaMB * 1048576,
      };
      if (isCorporateRole(newRole)) {
        updates.organization_id = targetOrgId;
        updates.subscription_end_date = null;
      } else if (newRole === 'premium_individual') {
        updates.organization_id = null;
        updates.subscription_end_date = finalDate;
      } else {
        updates.organization_id = null;
        updates.subscription_end_date = finalDate;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', editingUser.id);
      if (error) throw error;
      alert('Güncelleme başarılı!');
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Kullanıcı kaydetme hatası:", error);
      if (error.message?.includes('row-level security') || error.message?.includes('RLS') || error.code === '42501') {
        setUserSaveError(
          '⚠️ Veritabanı RLS Politikası Engeli!\n' +
          'Kullanıcı verilerini güncelleme yetkiniz veritabanı RLS politikaları tarafından engellendi.'
        );
      } else {
        setUserSaveError('Hata: ' + error.message);
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createPassword.trim() || !createFullName.trim() || !createPhone.trim()) {
      return alert('Lütfen zorunlu alanları (E-posta, Şifre, Ad Soyad, Telefon) doldurun.');
    }
    if (createPassword.length < 6) {
      return alert('Şifre en az 6 karakter olmalıdır.');
    }

    setCreateUserLoading(true);
    setUserSaveError(null);
    try {
      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: createEmail,
        password: createPassword,
        options: {
          data: {
            full_name: createFullName,
            phone: createPhone,
          },
        },
      });

      if (authErr) throw authErr;
      if (!authData.user) {
        throw new Error('Kullanıcı kaydı başlatıldı fakat kullanıcı objesi alınamadı.');
      }

      // Supabase trigger'ının profili insert etmesi için asenkron gecikmeyi bekle
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const finalDate = createEndDate ? new Date(createEndDate).toISOString() : null;
      
      const updates: any = {
        full_name: createFullName,
        phone: createPhone,
        role: createRole,
        storage_limit: createQuotaMB * 1048576,
      };

      if (isCorporateRole(createRole)) {
        if (!createOrgId) {
          throw new Error('Kurumsal bir rol için lütfen bir şirket seçin.');
        }
        updates.organization_id = createOrgId;
        updates.subscription_end_date = null;
      } else if (createRole === 'premium_individual') {
        updates.organization_id = null;
        updates.subscription_end_date = finalDate;
      } else {
        updates.organization_id = null;
        updates.subscription_end_date = finalDate;
      }

      const { error: profileUpdateErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: createEmail,
          ...updates,
          updated_at: new Date(),
        });

      if (profileUpdateErr) throw profileUpdateErr;

      alert(`✅ Kullanıcı başarıyla oluşturuldu!\nE-posta: ${createEmail}`);
      setShowCreateUserModal(false);
      
      // Formu temizle
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setCreatePhone('');
      setCreateRole('normal');
      setCreateOrgId('');
      setCreateEndDate('');
      setCreateQuotaMB(50);
      setShowCreateUserModal(false);
      fetchUsers();
    } catch (err: any) {
      console.error("Kullanıcı oluşturma hatası:", err);
      if (err.message?.includes('row-level security') || err.message?.includes('RLS') || err.code === '42501') {
        setUserSaveError(
          '⚠️ Veritabanı RLS Politikası Engeli!\n' +
          'Kullanıcı oluşturma yetkiniz veritabanı RLS politikaları tarafından engellendi. ' +
          'Lütfen Supabase Dashboard > SQL Editor sekmesinde size verilen SQL kodunu çalıştırın.'
        );
      } else {
        setUserSaveError('Hata: ' + err.message);
      }
    } finally {
      setCreateUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`"${userEmail}" e-postalı kullanıcıyı sistemden tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
      if (error) throw error;
      alert('Kullanıcı başarıyla sistemden silindi.');
      fetchUsers();
    } catch (err: any) {
      console.error("Kullanıcı silme hatası:", err);
      alert('Kullanıcı silinemedi: ' + err.message);
    }
  };

  const openCompanyModal = (comp: any) => {
    setEditingCompany(comp);
    setCompName(comp.name);
    setCompLimit(comp.member_limit || 5);
    setCompDate(
      comp.subscription_end_date
        ? new Date(comp.subscription_end_date).toISOString().split('T')[0]
        : ''
    );
    setCompIsEnvConsultant(!!comp.is_environmental_consultant);
    setCompEnabledModules(
      Array.isArray(comp.enabled_modules) && comp.enabled_modules.length > 0
        ? comp.enabled_modules
        : DEFAULT_MODULE_KEYS
    );
    setCompanyQuotaMB(Math.round((comp.storage_limit || 0) / 1048576));
    setCompStoragePreference(comp.storage_preference === 'google_drive' ? 'google_drive' : 'supabase');
    setCompGoogleClientId(comp.google_client_id || '');
    setCompGoogleClientSecret(comp.google_client_secret || '');
    setCompGoogleDriveFolderId(comp.google_drive_folder_id || '');
    setCompGoogleDriveRefreshToken(comp.google_drive_refresh_token || '');
    setCompGoogleDriveConnectedEmail(comp.google_drive_connected_email || '');
  };

  const handleSaveCompany = async () => {
    const isNew = editingCompany.id === 'new';
    if (
      !isNew &&
      !window.confirm('Şirketteki TÜM personelin aboneliği etkilenecek. Devam?')
    )
      return;
    
    setCompanySaveError(null);
    try {
      const finalDate = compDate ? new Date(compDate).toISOString() : null;
      if (isNew) {
        const { error } = await supabase
          .from('organizations')
          .insert([
            {
              name: compName,
              member_limit: compLimit,
              subscription_end_date: finalDate,
              storage_limit: companyQuotaMB * 1048576,
              is_environmental_consultant: compIsEnvConsultant,
              enabled_modules: compEnabledModules,
              storage_preference: compStoragePreference,
              google_client_id: compGoogleClientId || null,
              google_client_secret: compGoogleClientSecret || null,
              google_drive_folder_id: compGoogleDriveFolderId || null,
            },
          ]);
        if (error) throw error;
        alert('Yeni şirket başarıyla oluşturuldu!');
      } else {
        const { error } = await supabase
          .from('organizations')
          .update({
            name: compName,
            member_limit: compLimit,
            subscription_end_date: finalDate,
            storage_limit: companyQuotaMB * 1048576,
            is_environmental_consultant: compIsEnvConsultant,
            enabled_modules: compEnabledModules,
            storage_preference: compStoragePreference,
            google_client_id: compGoogleClientId || null,
            google_client_secret: compGoogleClientSecret || null,
            google_drive_folder_id: compGoogleDriveFolderId || null,
          })
          .eq('id', editingCompany.id);
        if (error) throw error;
        alert('Şirket güncellendi!');
      }
      setEditingCompany(null);
      fetchCompanies();
    } catch (e: any) {
      console.error("Şirket kaydetme hatası:", e);
      if (e.message?.includes('row-level security') || e.message?.includes('RLS') || e.code === '42501') {
        setCompanySaveError(
          '⚠️ Veritabanı RLS Politikası Engeli!\n' +
          'Şirket oluşturma/güncelleme yetkiniz veritabanı RLS politikaları tarafından engellendi. ' +
          'Lütfen Supabase Dashboard > SQL Editor sekmesinde size verilen SQL kodunu çalıştırın.'
        );
      } else {
        setCompanySaveError('Hata: ' + e.message);
      }
    }
  };

  // Popup ile Google OAuth onay ekranını açar; App.tsx'teki genel popup dinleyicisi
  // (window.opener.postMessage) koddan döndüğünde burada yakalanıp token değişimi
  // ve firma'nın (organizations) google_drive_* alanlarına kayıt yapılır. Bu işlem
  // sadece admin oturumu açıkken çalıştığından "protect_google_drive_settings"
  // trigger'ı (is_admin() kontrolü) engele takılmaz.
  const googleOauthRedirectUri = `${window.location.origin}/`;

  const handleConnectGoogleDrive = () => {
    if (!compGoogleClientId.trim() || !compGoogleClientSecret.trim()) {
      alert('Lütfen önce Google Client ID ve Client Secret alanlarını doldurun.');
      return;
    }
    if (!editingCompany || editingCompany.id === 'new') {
      alert('Google Drive bağlantısı için önce şirketi oluşturup kaydedin, ardından tekrar düzenleyin.');
      return;
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: compGoogleClientId.trim(),
      redirect_uri: googleOauthRedirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

    const popup = window.open(authUrl, 'google-oauth-connect', 'width=520,height=680');
    if (!popup) {
      alert('Popup engellendi. Lütfen bu site için tarayıcınızda popup iznini açın.');
      return;
    }

    setConnectingGoogleDrive(true);

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'GOOGLE_OAUTH_CODE') return;
      window.removeEventListener('message', handleMessage);

      const code = event.data.code;
      if (!code) {
        setConnectingGoogleDrive(false);
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
            client_id: compGoogleClientId.trim(),
            client_secret: compGoogleClientSecret.trim(),
            redirect_uri: googleOauthRedirectUri,
          }),
        });
        const exchangeResult = await exchangeRes.json();
        if (!exchangeRes.ok || !exchangeResult.success) {
          throw new Error(exchangeResult.error || 'Google token değişimi başarısız oldu.');
        }
        const { access_token, refresh_token } = exchangeResult.data;
        if (!refresh_token) {
          throw new Error(
            'Google bir refresh token döndürmedi. Bu genellikle firma bu uygulamaya daha önce izin verdiyse olur; ' +
            'Google hesabındaki (myaccount.google.com/permissions) mevcut izni iptal edip tekrar deneyin.'
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
            google_client_id: compGoogleClientId.trim(),
            google_client_secret: compGoogleClientSecret.trim(),
            google_drive_folder_id: compGoogleDriveFolderId.trim() || null,
            google_drive_refresh_token: refresh_token,
            google_drive_connected_email: connectedEmail,
          })
          .eq('id', editingCompany.id);
        if (updateErr) throw updateErr;

        setCompStoragePreference('google_drive');
        setCompGoogleDriveRefreshToken(refresh_token);
        setCompGoogleDriveConnectedEmail(connectedEmail);
        fetchCompanies();
        alert(`✅ Google Drive başarıyla bağlandı!\nBağlı hesap: ${connectedEmail}`);
      } catch (err: any) {
        alert('Google Drive bağlantı hatası: ' + err.message);
      } finally {
        setConnectingGoogleDrive(false);
      }
    };

    window.addEventListener('message', handleMessage);
  };

  const handleDisconnectGoogleDrive = async () => {
    if (!editingCompany || editingCompany.id === 'new') return;
    if (
      !window.confirm(
        'Bu firmanın Google Drive bağlantısını kaldırmak istediğinize emin misiniz? ' +
        'Bağlantı kaldırıldıktan sonra yeniden bağlanana kadar bu firma belge yükleyemeyecek.'
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
        .eq('id', editingCompany.id);
      if (error) throw error;
      setCompGoogleDriveRefreshToken('');
      setCompGoogleDriveConnectedEmail('');
      fetchCompanies();
      alert('Google Drive bağlantısı kaldırıldı.');
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  const handleDeleteCompany = async (orgId: string, orgName: string) => {
    if (
      !window.confirm(
        `"${orgName}" şirketini silmek istediğinize emin misiniz?`
      )
    )
      return;
    try {
      await supabase.rpc('clear_org_membership_notifications', { target_org_id: orgId });
      await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'normal', org_role: 'staff' })
        .eq('organization_id', orgId);
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);
      if (error) throw error;
      alert('Şirket silindi.');
      fetchCompanies();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const calculateDaysLeft = (dateString: string) => {
    if (!dateString) return 'Yok';
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? `${days} Gün` : 'Dolmuş';
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCompanies = companies.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const openTicketCount = tickets.filter((t) => t.status === 'open').length;

  if (loading && activeTab !== 'tickets')
    return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4">
      {/* Üst Header */}
      <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-xl border border-red-100 dark:border-red-900/50 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
            <Shield size={24} /> Admin Yönetim Paneli
          </h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sol Sidebar Menü */}
        <aside className="w-full lg:w-64 shrink-0 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-6">
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-3 px-2">Sistem Yönetimi</span>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'users'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Users size={18} />
                <span>Kullanıcılar</span>
              </button>
              <button
                onClick={() => setActiveTab('companies')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'companies'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Building size={18} />
                <span>Şirketler</span>
              </button>
              <button
                onClick={() => setActiveTab('tickets')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'tickets'
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare size={18} />
                  <span>Destek Talepleri</span>
                </div>
                {openTicketCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {openTicketCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-3 px-2">Mevzuat</span>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab('legislations');
                  setLegSubTab('pool');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'legislations'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Scale size={18} />
                  <span>Mevzuat Havuzu</span>
                </div>
                {legislationRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {legislationRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ced_categories')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'ced_categories'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <BookOpen size={18} />
                <span>ÇED Proje Listesi</span>
              </button>
              <button
                onClick={() => setActiveTab('permit_categories')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'permit_categories'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Shield size={18} />
                <span>Çevre İzin Listesi</span>
              </button>
              <button
                onClick={() => setActiveTab('waste_codes')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'waste_codes'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Trash2 size={18} />
                <span>Atık Kodları</span>
              </button>

            </nav>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-3 px-2">Finans</span>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('payments')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'payments'
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <CreditCard size={18} />
                <span>Ödemeler & Faturalar</span>
              </button>
              <button
                onClick={() => setActiveTab('gift_codes')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'gift_codes'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Gift size={18} />
                <span>Hediye Kodları</span>
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'pricing'
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <TrendingUp size={18} />
                <span>Fiyatlandırma</span>
              </button>
            </nav>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-3 px-2">İletişim & Ayarlar</span>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'notifications'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Bell size={18} />
                <span>Bildirim Gönder</span>
              </button>
              <button
                onClick={() => setActiveTab('email_settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'email_settings'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Mail size={18} />
                <span>E-Posta Ayarları</span>
              </button>
              <button
                onClick={() => setActiveTab('system_settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'system_settings'
                    ? 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Settings size={18} />
                <span>Sistem Ayarları</span>
              </button>
              <button
                onClick={() => setActiveTab('module_settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'module_settings'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <CheckSquare size={18} />
                <span>Modül Ayarları</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Sağ İçerik Alanı */}
        <main className="flex-1 w-full bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 min-h-[500px] space-y-4">
        {activeTab !== 'tickets' && activeTab !== 'notifications' && activeTab !== 'email_settings' && activeTab !== 'system_settings' && activeTab !== 'pricing' && activeTab !== 'module_settings' && (
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
            <Search className="text-gray-400" />
            <input
              type="text"
              placeholder="Ara..."
              className="bg-transparent outline-none w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {/* WASTE TAB */}
        {/* ÇED PROJE LİSTESİ TAB */}
        {activeTab === 'ced_categories' && (
          <div className="animate-fadeIn bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">ÇED Proje Listesi (EK-1 / EK-2)</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Bu liste, danışman panelindeki işletme ekleme/düzenleme formlarında "ÇED Durumu" seçilirken kullanılır.
                  Yeni bir mevzuat değişikliği geldiğinde buradan madde ekleyebilirsiniz.
                </p>
              </div>
              <button
                onClick={() => openCedModal()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
              >
                <Plus size={16} /> Yeni Madde Ekle
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center bg-gray-100 dark:bg-slate-900 rounded-lg p-1">
                <button
                  onClick={() => setCedStageFilter('ek1')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    cedStageFilter === 'ek1' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-indigo-400' : 'text-gray-500'
                  }`}
                >
                  EK-1 ({cedCategories.filter((c) => c.stage === 'ek1').length})
                </button>
                <button
                  onClick={() => setCedStageFilter('ek2')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    cedStageFilter === 'ek2' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-indigo-400' : 'text-gray-500'
                  }`}
                >
                  EK-2 ({cedCategories.filter((c) => c.stage === 'ek2').length})
                </button>
              </div>
              <input
                type="text"
                placeholder="Kod veya başlıkta ara..."
                value={cedSearch}
                onChange={(e) => setCedSearch(e.target.value)}
                className="flex-1 min-w-[200px] border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>

            {loadingCed ? (
              <div className="py-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {cedCategories
                  .filter((c) => c.stage === cedStageFilter)
                  .filter(
                    (c) =>
                      c.code.toLowerCase().includes(cedSearch.toLowerCase()) ||
                      c.title.toLowerCase().includes(cedSearch.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900/50 transition"
                    >
                      <div className="text-sm">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 mr-2">{item.code}</span>
                        <span className="text-gray-700 dark:text-gray-300">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openCedModal(item)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded"
                          title="Düzenle"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteCedCategory(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                {cedCategories.filter((c) => c.stage === cedStageFilter).length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">Bu kategoride henüz madde yok.</div>
                )}
              </div>
            )}

            {editingCedItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 dark:text-white">
                      {editingCedItem.id === 'new' ? 'Yeni ÇED Maddesi' : 'Maddeyi Düzenle'} · {(editingCedItem.stage || cedStageFilter).toUpperCase()}
                    </h3>
                    <button onClick={() => setEditingCedItem(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Kod</label>
                      <input
                        type="text"
                        value={cedFormCode}
                        onChange={(e) => setCedFormCode(e.target.value)}
                        placeholder="örn: 55"
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Başlık</label>
                      <textarea
                        value={cedFormTitle}
                        onChange={(e) => setCedFormTitle(e.target.value)}
                        rows={4}
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                  </div>
                  <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingCedItem(null)}
                      className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSaveCedCategory}
                      disabled={savingCed}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold"
                    >
                      {savingCed ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÇEVRE İZİN LİSTESİ TAB */}
        {activeTab === 'permit_categories' && (
          <div className="animate-fadeIn bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Çevre İzin Listesi (EK-1 / EK-2)</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Bu liste, danışman panelindeki işletme ekleme/düzenleme formlarında "Çevre İzin/Lisans Kapsamı" seçilirken kullanılır.
                  Yeni bir mevzuat değişikliği geldiğinde buradan madde ekleyebilirsiniz.
                </p>
              </div>
              <button
                onClick={() => openPermitModal()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
              >
                <Plus size={16} /> Yeni Madde Ekle
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center bg-gray-100 dark:bg-slate-900 rounded-lg p-1">
                <button
                  onClick={() => setPermitStageFilter('ek1')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    permitStageFilter === 'ek1' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-indigo-400' : 'text-gray-500'
                  }`}
                >
                  EK-1 ({permitCategories.filter((c) => c.stage === 'ek1').length})
                </button>
                <button
                  onClick={() => setPermitStageFilter('ek2')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    permitStageFilter === 'ek2' ? 'bg-white dark:bg-slate-700 shadow text-indigo-700 dark:text-indigo-400' : 'text-gray-500'
                  }`}
                >
                  EK-2 ({permitCategories.filter((c) => c.stage === 'ek2').length})
                </button>
              </div>
              <input
                type="text"
                placeholder="Kod veya başlıkta ara..."
                value={permitSearch}
                onChange={(e) => setPermitSearch(e.target.value)}
                className="flex-1 min-w-[200px] border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>

            {loadingPermit ? (
              <div className="py-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {permitCategories
                  .filter((c) => c.stage === permitStageFilter)
                  .filter(
                    (c) =>
                      c.code.toLowerCase().includes(permitSearch.toLowerCase()) ||
                      c.title.toLowerCase().includes(permitSearch.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900/50 transition"
                    >
                      <div className="text-sm">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 mr-2">{item.code}</span>
                        <span className="text-gray-700 dark:text-gray-300">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openPermitModal(item)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded"
                          title="Düzenle"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePermitCategory(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                {permitCategories.filter((c) => c.stage === permitStageFilter).length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">Bu kategoride henüz madde yok.</div>
                )}
              </div>
            )}

            {editingPermitItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 dark:text-white">
                      {editingPermitItem.id === 'new' ? 'Yeni Çevre İzin Maddesi' : 'Maddeyi Düzenle'} · {(editingPermitItem.stage || permitStageFilter).toUpperCase()}
                    </h3>
                    <button onClick={() => setEditingPermitItem(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Kod</label>
                      <input
                        type="text"
                        value={permitFormCode}
                        onChange={(e) => setPermitFormCode(e.target.value)}
                        placeholder="örn: 3.15"
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Başlık</label>
                      <textarea
                        value={permitFormTitle}
                        onChange={(e) => setPermitFormTitle(e.target.value)}
                        rows={4}
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                  </div>
                  <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingPermitItem(null)}
                      className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSavePermitCategory}
                      disabled={savingPermit}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold"
                    >
                      {savingPermit ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ATIK KODLARI TAB */}
        {activeTab === 'waste_codes' && (
          <div className="animate-fadeIn bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Atık Kodları Kataloğu</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Atık Yönetimi ekranındaki resmi Avrupa Atık Kataloğu listesinde bulunmayan yeni bir atık kodu
                  gerektiğinde buradan ekleyebilirsiniz. Eklenen kodlar tüm kullanıcılara otomatik olarak görünür.
                </p>
              </div>
              <button
                onClick={() => openWasteCodeModal()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
              >
                <Plus size={16} /> Yeni Atık Kodu Ekle
              </button>
            </div>

            <input
              type="text"
              placeholder="Kod veya ad içinde ara..."
              value={wasteCodeSearch}
              onChange={(e) => setWasteCodeSearch(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm mb-4 dark:bg-slate-900 dark:border-slate-700"
            />

            {loadingWasteCodes ? (
              <div className="py-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {customWasteCodes
                  .filter(
                    (c) =>
                      c.code.toLowerCase().includes(wasteCodeSearch.toLowerCase()) ||
                      c.name.toLowerCase().includes(wasteCodeSearch.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900/50 transition"
                    >
                      <div className="text-sm">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 mr-2 font-mono">{item.code}</span>
                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                        {item.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openWasteCodeModal(item)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded"
                          title="Düzenle"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteWasteCode(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                {customWasteCodes.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-sm">Henüz eklenmiş bir atık kodu yok.</div>
                )}
              </div>
            )}

            {editingWasteCodeItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 dark:text-white">
                      {editingWasteCodeItem.id === 'new' ? 'Yeni Atık Kodu' : 'Atık Kodunu Düzenle'}
                    </h3>
                    <button onClick={() => setEditingWasteCodeItem(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Kod</label>
                      <input
                        type="text"
                        value={wasteCodeFormCode}
                        onChange={(e) => setWasteCodeFormCode(e.target.value)}
                        placeholder="örn: 15 01 02"
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Ad / Tanım</label>
                      <textarea
                        value={wasteCodeFormName}
                        onChange={(e) => setWasteCodeFormName(e.target.value)}
                        rows={3}
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Açıklama (opsiyonel)</label>
                      <input
                        type="text"
                        value={wasteCodeFormDesc}
                        onChange={(e) => setWasteCodeFormDesc(e.target.value)}
                        placeholder="örn: Tehlikeli atık ise 'M' / 'A' notu"
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                  </div>
                  <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingWasteCodeItem(null)}
                      className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSaveWasteCode}
                      disabled={savingWasteCode}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold"
                    >
                      {savingWasteCode ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÖDEMELER & FATURALAR TAB */}
        {activeTab === 'payments' && (
          <div className="animate-fadeIn space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase mb-1">
                  <TrendingUp size={14} className="text-green-600" /> Bu Ay Alınan Ödeme
                </div>
                <div className="text-2xl font-black text-green-600">
                  {monthlyRevenue.toLocaleString('tr-TR')} ₺
                </div>
                <div className="text-[10px] text-gray-400 mt-1">{currentMonthPayments.length} işlem · {now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase mb-1">
                  <CreditCard size={14} className="text-indigo-600" /> Toplam Gelir (Tüm Zamanlar)
                </div>
                <div className="text-2xl font-black text-indigo-600">
                  {totalRevenue.toLocaleString('tr-TR')} ₺
                </div>
                <div className="text-[10px] text-gray-400 mt-1">{payments.length} işlem</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase mb-1">
                  <Users size={14} className="text-blue-600" /> Premium Satın Alan
                </div>
                <div className="text-2xl font-black text-blue-600">{uniqueBuyers}</div>
                <div className="text-[10px] text-gray-400 mt-1">Farklı kullanıcı/şirket</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Ödeme Geçmişi</h2>
                <select
                  value={paymentsPlanFilter}
                  onChange={(e) => setPaymentsPlanFilter(e.target.value)}
                  className="border rounded-lg p-2 text-xs dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="">Tüm Planlar</option>
                  <option value="individual">Bireysel Premium</option>
                  <option value="corporate_new">Kurumsal (Yeni Şirket)</option>
                  <option value="corporate_renewal">Kurumsal Yenileme</option>
                  <option value="storage">Ekstra Depolama</option>
                </select>
              </div>

              {loadingPayments ? (
                <div className="py-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500 text-xs uppercase">
                        <th className="py-2 pr-3">Tarih</th>
                        <th className="py-2 pr-3">Kullanıcı / Firma</th>
                        <th className="py-2 pr-3">Plan</th>
                        <th className="py-2 pr-3 text-right">Tutar</th>
                        <th className="py-2 pr-3">Fatura</th>
                        <th className="py-2 pr-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {payments
                        .filter((p) => !paymentsPlanFilter || p.plan_type === paymentsPlanFilter)
                        .map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 pr-3 text-xs text-gray-500">
                              {new Date(p.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="font-bold text-gray-800 dark:text-gray-200">
                                {p.organization?.name || p.payer?.full_name || 'Bilinmeyen'}
                              </div>
                              <div className="text-[11px] text-gray-400">{p.payer?.email}</div>
                            </td>
                            <td className="py-2.5 pr-3 text-xs">
                              <span className="px-2 py-0.5 rounded-full border bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 font-bold">
                                {planTypeLabel(p.plan_type)}
                              </span>
                              {(p.duration_months || p.seats) && (
                                <div className="text-[10px] text-gray-400 mt-1">
                                  {p.duration_months ? `${p.duration_months} Ay` : ''}{p.seats ? ` · ${p.seats} Kişi` : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-bold text-gray-800 dark:text-gray-200">
                              {Number(p.amount).toLocaleString('tr-TR')} ₺
                            </td>
                            <td className="py-2.5 pr-3 text-xs">
                              {p.invoice_no ? (
                                <span className="text-green-600 font-bold">{p.invoice_no}</span>
                              ) : (
                                <span className="text-gray-400">Oluşturulmadı</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-right">
                              <button
                                onClick={() => openInvoiceModal(p)}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                <Printer size={13} /> {p.invoice_no ? 'Yeniden Yazdır' : 'Fatura Oluştur'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                            Henüz kayıtlı bir ödeme yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {invoicingPayment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 dark:text-white">Fatura Bilgileri</h3>
                    <button onClick={() => setInvoicingPayment(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fatura Ünvanı</label>
                      <input
                        type="text"
                        value={invoiceTitle}
                        onChange={(e) => setInvoiceTitle(e.target.value)}
                        placeholder="Şirket / kişi adı"
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Vergi No / TCKN</label>
                      <input
                        type="text"
                        value={invoiceTaxId}
                        onChange={(e) => setInvoiceTaxId(e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Adres</label>
                      <textarea
                        value={invoiceAddress}
                        onChange={(e) => setInvoiceAddress(e.target.value)}
                        rows={3}
                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg">
                      Plan: <b>{planTypeLabel(invoicingPayment.plan_type)}</b> · Tutar: <b>{Number(invoicingPayment.amount).toLocaleString('tr-TR')} ₺</b>
                    </div>
                  </div>
                  <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                    <button
                      onClick={() => setInvoicingPayment(null)}
                      className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleGenerateInvoice}
                      disabled={savingInvoice}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
                    >
                      <Printer size={14} /> {savingInvoice ? 'Oluşturuluyor...' : 'Fatura Oluştur ve Yazdır'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gift_codes' && (
          <div className="animate-fadeIn space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Hediye Kodu Oluştur</h2>
              <form onSubmit={handleCreateGiftCode} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tip</label>
                  <select
                    value={newGiftType}
                    onChange={(e) => setNewGiftType(e.target.value as 'individual' | 'corporate')}
                    className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="individual">Bireysel Premium</option>
                    <option value="corporate">Kurumsal Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Süre</label>
                  <select
                    value={newGiftDuration}
                    onChange={(e) => setNewGiftDuration(Number(e.target.value))}
                    className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value={1}>1 Ay</option>
                    <option value={3}>3 Ay</option>
                    <option value={6}>6 Ay</option>
                    <option value={12}>12 Ay</option>
                  </select>
                </div>
                {newGiftType === 'corporate' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Kişi Sayısı</label>
                    <input
                      type="number"
                      min={1}
                      value={newGiftSeats}
                      onChange={(e) => setNewGiftSeats(Number(e.target.value))}
                      className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                )}
                <div className={newGiftType === 'corporate' ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Not (opsiyonel)</label>
                  <input
                    type="text"
                    value={newGiftNote}
                    onChange={(e) => setNewGiftNote(e.target.value)}
                    placeholder="Örn: Yılbaşı çekilişi"
                    className="w-full border rounded-lg p-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <button
                  disabled={creatingGiftCode}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg p-2.5 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {creatingGiftCode ? <Loader size={14} className="animate-spin" /> : <Gift size={14} />}
                  Kod Oluştur
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Oluşturulan Kodlar</h2>
              {loadingGiftCodes ? (
                <div className="py-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
              ) : (
                <div className="space-y-2">
                  {giftCodes.map((g) => (
                    <div
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-2 border-dashed border-amber-200 bg-amber-50 dark:bg-slate-900 dark:border-slate-700 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-700 font-mono tracking-wider dark:bg-slate-800">
                          {g.code}
                        </span>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <div className="font-bold">
                            {g.type === 'individual' ? 'Bireysel' : `Kurumsal · ${g.seats} Kişilik`} · {g.duration_months} Ay
                          </div>
                          {g.note && <div className="text-gray-400">{g.note}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            g.status === 'unused'
                              ? 'bg-blue-100 text-blue-700'
                              : g.status === 'redeemed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {g.status === 'unused' ? 'Kullanılmadı' : g.status === 'redeemed' ? 'Kullanıldı' : 'İptal Edildi'}
                        </span>
                        {g.status === 'redeemed' && (
                          <span className="text-[11px] text-gray-500">
                            {g.redeemer?.full_name || g.redeemer?.email} {g.organization?.name ? `(${g.organization.name})` : ''}
                          </span>
                        )}
                        <button onClick={() => copyGiftCode(g.code)} className="text-amber-600 hover:bg-amber-100 p-1.5 rounded">
                          <Copy size={16} />
                        </button>
                        {g.status === 'unused' && (
                          <button onClick={() => handleRevokeGiftCode(g.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {giftCodes.length === 0 && (
                    <div className="py-12 text-center text-gray-400 text-sm">Henüz kod oluşturulmadı.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <Users size={16} className="text-blue-500" />
                Sistemdeki tüm kullanıcıları yönetin ve yetkilendirin.
                <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {filteredUsers.length} Kullanıcı
                </span>
              </span>
              <button
                onClick={() => {
                  setShowCreateUserModal(true);
                  // Formu temizle
                  setCreateEmail('');
                  setCreatePassword('');
                  setCreateFullName('');
                  setCreatePhone('');
                  setCreateRole('normal');
                  setCreateOrgId('');
                  setCreateEndDate('');
                  setCreateQuotaMB(50);
                  setUserSaveError(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-100"
              >
                <Plus size={14} /> Yeni Kullanıcı Ekle
              </button>
            </div>
            
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="p-3">Kullanıcı</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Bitiş</th>
                  <th className="p-3 text-right">İşlem</th>
                </tr>
              </thead>
            <tbody className="text-sm divide-y">
              {filteredUsers.map((user) => {
                let displayDate = user.subscription_end_date;
                if (isCorporateRole(user.role) && user.organization)
                  displayDate = user.organization.subscription_end_date;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-bold">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      {user.organization && (
                        <div className="text-[10px] text-blue-600 font-bold flex gap-1 items-center">
                          <Building size={10} /> {user.organization.name}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold border w-fit">
                          {roleLabels[user.role] || user.role}
                        </span>

                      </div>
                    </td>
                    <td className="p-3 text-xs font-mono">
                      {displayDate
                        ? new Date(displayDate).toLocaleDateString()
                        : '-'}
                      {displayDate && (
                        <div
                          className={
                            new Date(displayDate) < new Date()
                              ? 'text-red-500 font-bold'
                              : 'text-green-500 font-bold'
                          }
                        >
                          ({calculateDaysLeft(displayDate)})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openUserModal(user)}
                          className="text-blue-600 font-bold text-xs border p-1.5 rounded hover:bg-blue-50 flex items-center gap-1"
                        >
                          <Edit size={12} /> Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="text-red-600 font-bold text-xs border border-red-200 p-1.5 rounded hover:bg-red-50 flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Sil
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

        {/* COMPANIES TAB */}
        {activeTab === 'companies' && (
          <div className="animate-fadeIn">
            {companyFetchError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2">
                 <AlertTriangle size={18} /> {companyFetchError}
              </div>
            )}
            
            <div className="flex justify-between items-center mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <Building size={16} className="text-purple-500" />
                Sistemdeki tüm danışmanlık firmalarını ve kurumsal şirketleri yönetin.
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {filteredCompanies.length} Şirket
                </span>
              </span>
              <button
                onClick={() => {
                  setEditingCompany({ id: 'new' });
                  setCompName('');
                  setCompLimit(5);
                  setCompDate('');
                  setCompIsEnvConsultant(false);
                  setCompanyQuotaMB(500); // Varsayılan 500 MB kota
                  setCompanySaveError(null);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-purple-100"
              >
                <Plus size={14} /> Yeni Şirket Ekle
              </button>
            </div>

            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-3">Şirket Ünvanı</th>
                <th className="p-3">Limit</th>
                <th className="p-3">Abonelik Bitişi</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((comp) => (
                  <tr key={comp.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-gray-800 flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                        {(comp.name || comp.title || 'Ş').substring(0,1).toUpperCase()}
                      </div>
                      {comp.name || comp.title || 'İsimsiz Şirket'}
                    </td>
                    <td className="p-3">
                      <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded font-bold text-[10px] border border-purple-100">
                        {comp.member_limit || comp.user_limit || comp.limit || '0'} Kişi
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {comp.subscription_end_date
                          ? new Date(comp.subscription_end_date).toLocaleDateString()
                          : '-'}
                      </div>
                      {comp.subscription_end_date && (
                        <div
                          className={`text-[10px] font-bold ${
                            new Date(comp.subscription_end_date) < new Date()
                              ? 'text-red-500'
                              : 'text-green-500'
                          }`}
                        >
                          ({calculateDaysLeft(comp.subscription_end_date)})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openTeamModal(comp)}
                          className="text-blue-600 font-bold text-[10px] border p-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1"
                        >
                          <Users size={12} /> Ekip
                        </button>
                        <button
                          onClick={() => openCompanyModal(comp)}
                          className="text-purple-600 font-bold text-[10px] border p-1.5 rounded-lg hover:bg-purple-50 flex items-center gap-1"
                        >
                          <Edit size={12} /> Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteCompany(comp.id, comp.name || comp.title)}
                          className="text-red-600 font-bold text-[10px] border border-red-200 p-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                   <td colSpan={4} className="p-10 text-center text-gray-400 italic">
                      Henüz sisteme kayıtlı şirket bulunamadı.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        {/* --- YENİ TAB: NOTIFICATIONS (BİLDİRİM GÖNDERME) --- */}
        {activeTab === 'notifications' && (
          <div className="max-w-2xl mx-auto py-6">
            <div className="bg-teal-50 border border-teal-100 p-6 rounded-xl mb-6">
              <h2 className="text-xl font-bold text-teal-800 flex items-center gap-2 mb-2">
                <Bell className="text-teal-600" /> Duyuru & Bildirim Paneli
              </h2>
              <p className="text-teal-600 text-sm">
                Buradan tüm kullanıcılara veya tek bir kişiye sistem bildirimi
                gönderebilirsiniz.
              </p>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Kime Gönderilecek?
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Tüm kullanıcılar veya bir kullanıcı ara (isim/email)..."
                      className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      value={userSearchTerm}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      onBlur={() => setTimeout(() => setShowUserDropdown(false), 250)}
                    />
                    {showUserDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        <div
                          className="p-3 hover:bg-teal-50 cursor-pointer font-bold text-teal-600 border-b border-gray-100 text-sm"
                          onMouseDown={() => {
                            setTargetUser('all');
                            setUserSearchTerm('📢 TÜM KULLANICILARA GÖNDER');
                            setShowUserDropdown(false);
                          }}
                        >
                          📢 TÜM KULLANICILARA GÖNDER
                        </div>
                        {users
                          .filter((u) => {
                            const term = userSearchTerm.toLowerCase();
                            if (term === '📢 tüm kullanicilara gönder' || term === '') return true;
                            return (
                              (u.full_name || '').toLowerCase().includes(term) ||
                              (u.email || '').toLowerCase().includes(term)
                            );
                          })
                          .map((u) => (
                            <div
                              key={u.id}
                              className="p-3 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 flex justify-between items-center"
                              onMouseDown={() => {
                                setTargetUser(u.id);
                                setUserSearchTerm(`${u.full_name || 'İsimsiz'} (${u.email})`);
                                setShowUserDropdown(false);
                              }}
                            >
                              <span className="font-semibold">{u.full_name || 'İsimsiz'}</span>
                              <span className="text-xs text-gray-500">{u.email}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  {targetUser !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUser('all');
                        setUserSearchTerm('📢 TÜM KULLANICILARA GÖNDER');
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 rounded-xl text-xs font-semibold border transition"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>
                {targetUser !== 'all' && (
                  <div className="mt-2 text-xs text-teal-600 font-semibold flex items-center gap-1">
                    ✓ Seçili Kullanıcı: <span className="font-mono bg-teal-50 px-1 py-0.5 rounded border border-teal-100">{targetUser}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bildirim Başlığı
                </label>
                <input
                  type="text"
                  placeholder="Örn: Sistem Bakım Çalışması"
                  className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-teal-500"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Mesaj İçeriği
                </label>
                <textarea
                  rows={5}
                  placeholder="Duyuru detaylarını buraya yazın..."
                  className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                ></textarea>
              </div>

              <button
                disabled={sendingNotif}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-teal-100 disabled:opacity-50"
              >
                {sendingNotif ? (
                  <Loader className="animate-spin" size={20} />
                ) : (
                  <Send size={20} />
                )}
                {sendingNotif ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
              </button>
            </form>
          </div>
        )}

        {/* LEGISLATIONS TAB */}
        {activeTab === 'legislations' && (
          <div className="animate-fadeIn space-y-6">
            {/* Sub-tabs header */}
            <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6 text-xs gap-2">
              <button
                type="button"
                onClick={() => setLegSubTab('pool')}
                className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                  legSubTab === 'pool'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
                }`}
              >
                <Scale size={14} /> Mevzuat Havuzu
              </button>
              {/* Admin'den mevzuat talep etme akışı kaldırıldı: personel artık sadece kendi
                  firma yöneticisinden talep edebiliyor (bkz. ConsultantPanel/CompanyPanel 'staff_to_owner'). */}
              <button
                type="button"
                onClick={() => setLegSubTab('requests')}
                className={`hidden items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition relative ${
                  legSubTab === 'requests'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
                }`}
              >
                <MessageSquare size={14} /> Mevzuat Talepleri
                {legislationRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1">
                    {legislationRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {legSubTab === 'pool' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <Scale size={16} className="text-teal-500" />
                Global mevzuat havuzunu yönetin ve danışmanlık firmalarına yetki tanımlayın.
                <span className="bg-teal-100 text-teal-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {legislations.length} Mevzuat
                </span>
              </span>
              <button
                onClick={() => {
                  setEditingLegislation(null);
                  setLegTitle('');
                  setLegCategory('Yönetmelik');
                  setLegPubDate('');
                  setLegEffDate('');
                  setLegRgNo('');
                  setLegRgDate('');
                  setLegArticles([]);
                  setPasteText('');
                  setParsingTextMode(false);
                  setShowAddLegislationModal(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-teal-100"
              >
                <Plus size={14} /> Yeni Mevzuat Ekle
              </button>
            </div>

            {/* Mevzuat Listesi */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen size={18} className="text-teal-600" />
                  Mevzuat Havuzu Listesi
                </h3>
              </div>

              <div className="divide-y max-h-[600px] overflow-y-auto pr-1">
                {legislations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Mevzuat havuzu henüz boş. Yeni mevzuat ekleyin.
                  </div>
                ) : (
                  legislations.map((leg) => {
                    const assignedFirms = assignedCompaniesMap[leg.id] || [];
                    return (
                      <div key={leg.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-teal-50 text-teal-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-teal-100 uppercase shrink-0">
                              {leg.category}
                            </span>
                            <h4 className="font-bold text-slate-800 text-sm sm:text-base">{leg.title}</h4>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            {leg.rg_no && <span>RG No: <b>{leg.rg_no}</b></span>}
                            {leg.rg_date && <span>RG Tarih: <b>{new Date(leg.rg_date).toLocaleDateString()}</b></span>}
                            {leg.publication_date && <span>Yayın: <b>{new Date(leg.publication_date).toLocaleDateString()}</b></span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Erişen Firmalar:</span>
                            {assignedFirms.length === 0 ? (
                              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded italic">Atanmamış</span>
                            ) : (
                              assignedFirms.map(fId => {
                                const comp = companies.find(c => c.id === fId);
                                return (
                                  <span key={fId} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                                    {comp?.name || 'Şirket'}
                                    <button 
                                      onClick={() => handleRemoveCompanyLegislation(leg.id, fId)}
                                      className="text-red-500 hover:text-red-700 font-extrabold ml-1 focus:outline-none"
                                      title="Atamayı kaldır"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setAssigningLeg(leg);
                              setSelectedFirmId('');
                              setShowAssignLegModal(true);
                            }}
                            className="text-blue-600 hover:bg-blue-50 border border-blue-100 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1"
                          >
                            Firmaya Ata
                          </button>
                          <button
                            onClick={async () => {
                              const { data: arts } = await supabase
                                .from('pdf_articles')
                                .select('*')
                                .eq('regulation_id', leg.id)
                                .order('order_index', { ascending: true });
                              
                              setEditingLegislation(leg);
                              setLegTitle(leg.title);
                              setLegCategory(leg.category || 'Yönetmelik');
                              setLegPubDate(leg.publication_date || '');
                              setLegEffDate(leg.effective_date || '');
                              setLegRgNo(leg.rg_no || '');
                              setLegRgDate(leg.rg_date || '');
                              setLegArticles(arts || []);
                              setPasteText('');
                              setParsingTextMode(false);
                              setShowAddLegislationModal(true);
                            }}
                            className="text-gray-700 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs font-bold transition"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteLegislation(leg.id, leg.title)}
                            className="text-red-650 hover:bg-red-50 border border-red-200 p-1.5 rounded transition"
                            title="Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
              </div>
            )}
            
            {/* LEGISLATION REQUESTS TAB */}
        {legSubTab === 'requests' && (
          <div className="animate-fadeIn space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <MessageSquare size={16} className="text-orange-500" />
                Danışmanlık firmalarından gelen mevzuat ve güncelleme taleplerini değerlendirin.
                <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {legislationRequests.length} Toplam Talep
                </span>
                <span className="bg-orange-500 text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {legislationRequests.filter(r => r.status === 'pending').length} Bekleyen
                </span>
              </span>
            </div>

            {/* Talepler Listesi */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquare size={18} className="text-orange-500" />
                  Gelen Mevzuat Talepleri
                </h3>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {legislationRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Mevzuat veya güncelleme talebi bulunmuyor.
                  </div>
                ) : (
                  legislationRequests.map((req) => (
                    <div key={req.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          req.status === 'pending' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          req.status === 'escalated' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          req.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
                          'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {req.status === 'pending' ? 'Bekliyor' : req.status === 'escalated' ? 'Yönlendirildi' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                        </span>
                        <span className="text-slate-400">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="font-bold text-slate-800 text-sm">{req.title}</div>
                      <div className="text-slate-600 line-clamp-3">{req.description}</div>
                      
                      <div className="border-t pt-1.5 text-[10px] text-slate-500 space-y-0.5">
                        <div>Talep Eden: <b>{req.requester?.full_name} ({req.requester?.email})</b></div>
                        {req.organization && <div>Firma: <b>{req.organization.name}</b></div>}
                        {req.client && <div>Müşteri Firma: <b>{req.client.name}</b></div>}
                        {req.regulation && <div>İlgili Mevzuat: <b className="text-teal-600">{req.regulation.title}</b></div>}
                        {req.admin_notes && (
                          <div className="bg-white p-1.5 rounded border mt-1.5 text-slate-700 italic">
                            Admin Notu: {req.admin_notes}
                          </div>
                        )}
                      </div>

                      {req.status === 'pending' && (
                        <div className="flex gap-2 pt-1 border-t">
                          <button
                            onClick={() => {
                              setReplyingRequest(req);
                              setRequestAdminNotes(req.admin_notes || '');
                            }}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded font-bold text-[10px] transition"
                          >
                            Değerlendir
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
        </div>
        )}

        {/* --- YENİ TAB: E-POSTA AYARLARI --- */}
        {activeTab === 'email_settings' && (
          <div className="animate-fadeIn space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-indigo-800 flex items-center gap-2 mb-2">
                  <Mail className="text-indigo-600" /> E-Posta Bildirim Ayarları
                </h2>
                <p className="text-indigo-600 text-sm">
                  Premium üyelerin belgelerinin bitiş tarihine yaklaşınca gönderilecek e-posta hatırlatıcılarının ayarlarını buradan yapabilirsiniz.
                  Sistem her gün Türkiye saati ile 09:00'da (06:00 UTC) otomatik olarak tarama yapacaktır.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerEmailReminders}
                disabled={triggeringReminders}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-indigo-100 disabled:opacity-50 shrink-0"
              >
                {triggeringReminders ? (
                  <Loader className="animate-spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
                {triggeringReminders ? 'Tetikleniyor...' : 'Hatırlatıcıları Şimdi Çalıştır'}
              </button>
            </div>

            {/* Alt Sekme Menüsü */}
            <div className="flex border-b border-gray-200 bg-white p-1.5 rounded-lg shadow-sm gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setEmailSubTab('general')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  emailSubTab === 'general'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400'
                }`}
              >
                Genel E-Posta Bildirim Ayarları
              </button>
              <button
                type="button"
                onClick={() => setEmailSubTab('client_script')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  emailSubTab === 'client_script'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400'
                }`}
              >
                Müşteri Giriş Portalı Mail Scripti
              </button>
            </div>

            {emailSubTab === 'general' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Ayarları */}
              <div className="md:col-span-1 bg-gray-50/50 p-6 rounded-2xl border border-gray-150 space-y-6 h-fit">
                <h3 className="font-bold text-gray-800 text-base border-b pb-2">Sağlayıcı Yapılandırması</h3>
                {fetchingSettings ? (
                  <div className="flex items-center justify-center p-8 text-gray-500 gap-2">
                    <Loader className="animate-spin" size={16} />
                    Ayarlar Yükleniyor...
                  </div>
                ) : (
                  <form onSubmit={handleSaveEmailSettings} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                        E-Posta Sağlayıcısı
                      </label>
                      <select
                        className="w-full p-2.5 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-semibold text-gray-700 cursor-pointer"
                        value={emailProvider}
                        onChange={(e: any) => setEmailProvider(e.target.value)}
                      >
                        <option value="google_script">Google Apps Script (Gmail - Ücretsiz)</option>
                        <option value="brevo">Brevo (Sendinblue - Ücretsiz SMTP)</option>
                        <option value="resend">Resend (Profesyonel E-Posta)</option>
                      </select>
                    </div>

                    {emailProvider === 'google_script' && (
                      <div className="space-y-3 animate-fadeIn">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                            Google Script URL'si
                          </label>
                          <input
                            type="url"
                            required
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                            value={scriptUrl}
                            onChange={(e) => setScriptUrl(e.target.value)}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed bg-white p-3 rounded-lg border">
                          💡 <strong>Google Script Kurulumu:</strong> Google Apps Script ile kişisel Gmail adresinizden ücretsiz olarak günde 100 adet e-posta gönderebilirsiniz. 
                          Kullanıcının belirlediği script URL'sine POST isteği gönderilerek mailler iletilir.
                        </p>
                      </div>
                    )}

                    {emailProvider === 'resend' && (
                      <div className="space-y-3 animate-fadeIn">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                            Resend API Key
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="re_..."
                            className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                            Gönderen E-Posta (Sender Email)
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="info@evraklab.com"
                            className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                            value={senderEmail}
                            onChange={(e) => setSenderEmail(e.target.value)}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed bg-white p-3 rounded-lg border">
                          💡 <strong>Resend Entegrasyonu:</strong> Kendi alan adınızı (domain) doğrulatıp profesyonel e-postalar göndermek için idealdir. Aylık 3.000 mail ücretsizdir.
                        </p>
                      </div>
                    )}

                    {emailProvider === 'brevo' && (
                      <div className="space-y-3 animate-fadeIn">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                            Brevo API Key v3
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="xkeysib-..."
                            className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                            Gönderen E-Posta (Brevo Verified Email)
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="gonderen@gmail.com"
                            className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-sm font-medium"
                            value={senderEmail}
                            onChange={(e) => setSenderEmail(e.target.value)}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed bg-white p-3 rounded-lg border">
                          💡 <strong>Brevo Entegrasyonu:</strong> Kişisel `@gmail.com` adresinizi doğrulatıp gönderen olarak kullanmanıza olanak tanır. Günde 300 mail tamamen ücretsizdir.
                        </p>
                      </div>
                    )}


                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      {savingSettings ? <Loader className="animate-spin" size={16} /> : <Shield size={16} />}
                      {savingSettings ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                    </button>
                  </form>
                )}
              </div>

              {/* Log Geçmişi */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-gray-150 p-6 flex flex-col space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-gray-800 text-base">E-Posta Gönderim Günlüğü (Logs)</h3>
                  <button
                    onClick={fetchEmailLogs}
                    disabled={fetchingLogs}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    {fetchingLogs && <Loader className="animate-spin" size={10} />}
                    Yenile
                  </button>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[450px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5">Belge</th>
                        <th className="p-2.5">Alıcı E-Posta</th>
                        <th className="p-2.5">Konu</th>
                        <th className="p-2.5">Durum</th>
                        <th className="p-2.5">Tarih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fetchingLogs ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-400">
                            Günlükler Yükleniyor...
                          </td>
                        </tr>
                      ) : emailLogs.length > 0 ? (
                        emailLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="p-2.5 font-semibold text-gray-750">
                              {log.document?.title || <span className="text-gray-400 italic">Silinmiş Belge</span>}
                            </td>
                            <td className="p-2.5 text-gray-600 font-mono">{log.recipient_email}</td>
                            <td className="p-2.5 text-gray-700 truncate max-w-[180px]" title={log.subject}>{log.subject}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                                  log.status === 'sent'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : log.status === 'expired'
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}
                              >
                                {log.status === 'sent' ? 'Süresi Yaklaştı' : log.status === 'expired' ? 'Süresi Geçti' : log.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-gray-400 font-mono whitespace-nowrap">
                              {new Date(log.sent_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                            Henüz herhangi bir hatırlatma e-postası gönderilmedi.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-150 dark:border-slate-700 space-y-6 animate-fadeIn text-left text-gray-800 dark:text-gray-100 shadow-sm">
                <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-xl flex flex-col justify-between items-start gap-2">
                  <h3 className="text-base font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-1.5">
                    📋 Müşteri Portalı Otomatik Şifre Davet Scripti
                  </h3>
                  <p className="text-xs text-indigo-750 dark:text-indigo-300 leading-relaxed font-semibold">
                    Müşteri panelini kullanan firmalarınız için davet e-postası ve şifre belirleme bağlantısının otomatik gönderilmesi için aşağıdaki Google Apps Script kodunu kullanın.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed space-y-2.5">
                    <p className="font-bold text-gray-800 dark:text-white text-sm">🛠️ Adım Adım Kurulum Kılavuzu:</p>
                    <ol className="list-decimal pl-5 space-y-2 font-medium">
                      <li>Aşağıdaki kod penceresine tıklayarak kodu seçin veya <strong>"Google Script Kodunu Kopyala"</strong> butonunu kullanarak panoya kopyalayın.</li>
                      <li><a href="https://script.google.com/" target="_blank" rel="noreferrer" className="underline font-extrabold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800">Google Apps Script</a> konsolunu açıp yeni bir proje oluşturun ve bu kodu içine yapıştırın. Projeyi kaydedin.</li>
                      <li>Projeyi canlı hale getirmek için sağ üstteki <strong>"Dağıtın" (Deploy) &gt; "Yeni Dağıtım" (New Deployment)</strong> seçeneklerine tıklayın. Tür olarak <strong>"Web Uygulaması" (Web App)</strong> seçin.</li>
                      <li>
                        <strong>Aşağıdaki Güvenlik ve Yayınlama Ayarlarını Birebir Uygulayın:</strong><br />
                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-gray-200 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-300 mt-1.5 space-y-1">
                          • Yürütme Biçimi (Execute as): <strong>"Ben" (Sizin Google Hesabınız)</strong><br />
                          • Erişim Yetkisi (Who has access): <strong>"Herkes" (Anyone)</strong>
                        </div>
                      </li>
                      <li>Dağıtımı tamamladıktan sonra oluşturulan <strong>"Web Uygulaması URL" (Web App URL)</strong> adresini kopyalayarak, bu sayfadaki ilk sekmede (Genel Ayarlar) yer alan <strong>Google Script URL'si</strong> alanına kaydedin.</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                      Google Apps Script Kodu (Kopyalamak için içine tıklayın)
                    </label>
                    <textarea
                      readOnly
                      rows={15}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900 font-mono text-[11px] text-gray-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      value={GOOGLE_SCRIPT_CODE}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(GOOGLE_SCRIPT_CODE);
                        alert('Google Apps Script kodu başarıyla panoya kopyalandı!');
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 w-full shadow-md hover:shadow-lg mt-2 cursor-pointer"
                    >
                      📋 Google Script Kodunu Kopyala
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- SİSTEM AYARLARI TAB --- */}
        {activeTab === 'system_settings' && (
          <div className="animate-fadeIn space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                  <Settings className="text-slate-300" size={22} /> Sistem Ayarları
                </h2>
                <p className="text-slate-400 text-sm">
                  Uygulamanın genel görünümünü ve sistem logosunu buradan yönetebilirsiniz.
                </p>
              </div>
            </div>

            <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
              <h3 className="font-bold text-gray-800 text-base border-b pb-3 flex items-center gap-2">
                <Settings size={16} className="text-slate-500" />
                Sistem Logosu (Favicon ve Sol Üst)
              </h3>

              {fetchingSettings ? (
                <div className="flex items-center justify-center p-8 text-gray-500 gap-2">
                  <Loader className="animate-spin" size={18} />
                  Yükleniyor...
                </div>
              ) : (
                <form onSubmit={handleSaveSystemLogo} className="space-y-5">
                  {/* Preview */}
                  <div className="flex flex-col items-center gap-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6">
                    {systemLogoUrl ? (
                      <img
                        src={systemLogoUrl}
                        alt="Logo Önizleme"
                        className="w-24 h-24 object-contain rounded-xl border bg-white p-2 shadow-sm"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-white gap-1">
                        <Settings size={28} className="opacity-30" />
                        <span className="text-[10px]">Logo Yok</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadSystemLogo}
                        disabled={uploadingLogo}
                        className="hidden"
                        id="system-logo-upload-input-settings"
                      />
                      <label
                        htmlFor="system-logo-upload-input-settings"
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-100 transition cursor-pointer text-gray-700 bg-white shadow-sm"
                      >
                        {uploadingLogo ? (
                          <span className="flex items-center gap-1.5"><Loader className="animate-spin" size={13} /> Yükleniyor...</span>
                        ) : '📁 Logo Yükle'}
                      </label>
                      {systemLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setSystemLogoUrl('')}
                          className="px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition bg-white shadow-sm"
                        >
                          🗑 Kaldır
                        </button>
                      )}
                    </div>
                  </div>

                  {/* URL Input */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                      Veya Logo URL'si Girin
                    </label>
                    <input
                      type="url"
                      placeholder="https://ornek.com/logo.png"
                      className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition text-sm font-medium"
                      value={systemLogoUrl}
                      onChange={(e) => setSystemLogoUrl(e.target.value)}
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    type="submit"
                    disabled={savingLogo}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50"
                  >
                    {savingLogo ? <Loader className="animate-spin" size={16} /> : <Settings size={16} />}
                    {savingLogo ? 'Kaydediliyor...' : 'Sistem Logosunu Kaydet'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* --- MODÜL AYARLARI TAB --- */}
        {activeTab === 'module_settings' && (
          <div className="animate-fadeIn space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-800 to-indigo-700 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg text-white">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                  <CheckSquare className="text-purple-300" size={22} /> Sistem Modül ve Varsayılan Paket Ayarları
                </h2>
                <p className="text-purple-100 text-xs font-medium">
                  Yeni açılacak şirketlerin varsayılan modül paketlerini ve sistemdeki ekstra modülleri buradan yönetin.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSystemModuleDefaults}
                  disabled={savingModuleSettings}
                  className="bg-white text-purple-900 hover:bg-purple-50 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {savingModuleSettings ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Varsayılanları Kaydet
                </button>
                <button
                  onClick={handleBulkApplyDefaultModulesToAllCompanies}
                  disabled={bulkApplyingModules}
                  className="bg-purple-900/60 hover:bg-purple-950 text-white border border-purple-400/40 px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {bulkApplyingModules ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />} Tüm Şirketlere Toplu Uygula
                </button>
              </div>
            </div>

            {fetchingModuleSettings ? (
              <div className="py-16 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <Loader className="animate-spin" size={16} /> Modül ayarları yükleniyor...
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm space-y-6">
                <div className="border-b border-gray-100 dark:border-slate-700 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-base">Sistemdeki Tüm Modüller</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Yeni kaydolan şirketlerin varsayılan modüllerini belirlemek için ilgili modülleri işaretleyin.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 dark:bg-purple-950/30 px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-900">
                    {sysDefaultModuleKeys.length} / {SYSTEM_MODULES.length} Varsayılan Modül Seçili
                  </span>
                </div>

                <div className="space-y-6">
                  {SYSTEM_MODULE_CATEGORIES.map((cat) => {
                    const isCatDefault = sysDefaultModuleKeys.includes(cat.key);
                    const catModules = SYSTEM_MODULES.filter((m) => m.category === cat.key);

                    const toggleCatDefault = (enabled: boolean) => {
                      if (enabled) {
                        setSysDefaultModuleKeys(Array.from(new Set([...sysDefaultModuleKeys, cat.key])));
                      } else {
                        const subKeys = catModules.map((m) => m.key);
                        setSysDefaultModuleKeys(sysDefaultModuleKeys.filter((k) => k !== cat.key && !subKeys.includes(k)));
                      }
                    };

                    return (
                      <div
                        key={cat.key}
                        className={`space-y-4 p-5 rounded-2xl border transition ${
                          isCatDefault
                            ? 'bg-purple-50/40 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900'
                            : 'bg-gray-50/70 border-gray-200 dark:bg-slate-900/40 dark:border-slate-700 opacity-80'
                        }`}
                      >
                        <div className="flex justify-between items-center border-b pb-3 border-purple-200/60 dark:border-slate-700">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                                <CheckSquare size={16} className="text-purple-600" />
                                {cat.name}
                              </h4>
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  isCatDefault
                                    ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
                                }`}
                              >
                                {isCatDefault ? 'Varsayılan Ana Modül' : 'Ekstra Ana Modül'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                              {cat.description}
                            </p>
                          </div>

                          <label className="inline-flex items-center cursor-pointer gap-2 shrink-0">
                            <input
                              type="checkbox"
                              checked={isCatDefault}
                              onChange={(e) => toggleCatDefault(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 relative"></div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {isCatDefault ? 'Varsayılan' : 'Ekstra'}
                            </span>
                          </label>
                        </div>

                        {/* Alt Modüller */}
                        {isCatDefault ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {catModules.map((m) => {
                              const isDefaultSelected = sysDefaultModuleKeys.includes(m.key);
                              return (
                                <div
                                  key={m.key}
                                  className={`p-3.5 rounded-xl border transition space-y-2 flex flex-col justify-between ${
                                    isDefaultSelected
                                      ? 'bg-white border-purple-200 dark:bg-slate-800 dark:border-purple-900 shadow-sm'
                                      : 'bg-gray-100/60 border-gray-200 dark:bg-slate-900/50 dark:border-slate-700 opacity-75'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-start gap-1">
                                      <span className="font-bold text-xs text-gray-800 dark:text-white">{m.name}</span>
                                      <span
                                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                          isDefaultSelected
                                            ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
                                        }`}
                                      >
                                        {isDefaultSelected ? 'Varsayılan' : 'Ekstra'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                      {m.description}
                                    </p>
                                  </div>

                                  <div className="pt-2 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-[10px] font-mono text-gray-400">key: {m.key}</span>
                                    <label className="inline-flex items-center cursor-pointer gap-2">
                                      <input
                                        type="checkbox"
                                        checked={isDefaultSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSysDefaultModuleKeys([...sysDefaultModuleKeys, m.key]);
                                          } else {
                                            setSysDefaultModuleKeys(sysDefaultModuleKeys.filter((k) => k !== m.key));
                                          }
                                        }}
                                        className="sr-only peer"
                                      />
                                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600 relative"></div>
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {isDefaultSelected ? 'Açık' : 'Kapalı'}
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 dark:text-gray-500 font-medium italic p-2 bg-gray-100/50 dark:bg-slate-900/40 rounded-xl">
                            🔒 Bu ana modül varsayılan paket dışındadır (Ekstra Modül). İstenirse yeni şirket açılırken veya şirket düzenleme ekranında bu ana modül ve alt sayfaları aktif edilebilir.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- PRICING TAB --- */}
        {activeTab === 'pricing' && (
          <div className="animate-fadeIn space-y-6">
            <div className="bg-gradient-to-r from-green-800 to-green-700 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                  <TrendingUp className="text-green-300" size={22} /> Fiyatlandırma Ayarları
                </h2>
                <p className="text-green-100 text-sm">
                  Üyelik paket fiyatlarını ve depolama ücretlerini buradan yönetebilirsiniz.
                </p>
              </div>
            </div>

            {fetchingPricing ? (
              <div className="flex items-center justify-center p-8 text-gray-500 gap-2">
                <Loader className="animate-spin" size={18} /> Yükleniyor...
              </div>
            ) : (
              <>
                {/* Üyelik Planları */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <h3 className="font-bold text-gray-800 text-base border-b pb-3 flex items-center gap-2">
                    <CreditCard size={16} className="text-green-600" /> Üyelik Paket Fiyatları
                  </h3>
                  {Object.keys(subscriptionPlans).map((planKey) => (
                    <div key={planKey}>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">{PLAN_LABELS[planKey] || planKey}</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase">
                              <th className="py-2 pr-4">Süre</th>
                              <th className="py-2 pr-4">Eski Fiyat (TL)</th>
                              <th className="py-2 pr-4">Fiyat (TL)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {DURATIONS.map((d) => {
                              const info = subscriptionPlans[planKey]?.[d] || {};
                              return (
                                <tr key={d} className="border-t">
                                  <td className="py-2 pr-4 font-semibold text-gray-600">{info.label || `${d} Ay`}</td>
                                  <td className="py-2 pr-4">
                                    <input
                                      type="number"
                                      className="w-28 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                                      value={info.old ?? ''}
                                      onChange={(e) => updatePlanField(planKey, d, 'old', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 pr-4">
                                    <input
                                      type="number"
                                      className="w-28 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm font-bold"
                                      value={info.price ?? ''}
                                      onChange={(e) => updatePlanField(planKey, d, 'price', e.target.value)}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleSaveSubscriptionPlans}
                    disabled={savingPricing}
                    className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50"
                  >
                    {savingPricing ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                    {savingPricing ? 'Kaydediliyor...' : 'Üyelik Fiyatlarını Kaydet'}
                  </button>
                </div>

                {/* Depolama Fiyatlandırma */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
                  <h3 className="font-bold text-gray-800 text-base border-b pb-3 flex items-center gap-2">
                    <Database size={16} className="text-green-600" /> Ekstra Depolama Fiyatlandırma
                  </h3>
                  <p className="text-xs text-gray-500 -mt-4">
                    Fiyat, Supabase'in gerçek depolama maliyeti (USD/GB/Ay) × Dolar Kuru × (1 + Kar Marjı) formülüyle otomatik hesaplanır.
                    Bir pakete "Manuel Fiyat" girilirse, o paket için otomatik hesaplama yerine bu sabit fiyat kullanılır.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                        Supabase Maliyeti (USD / GB / Ay)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                        value={storagePricing.supabase_cost_usd_per_gb ?? ''}
                        onChange={(e) => updateStorageSetting('supabase_cost_usd_per_gb', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                        USD / TL Kuru
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                        value={storagePricing.usd_try_rate ?? ''}
                        onChange={(e) => updateStorageSetting('usd_try_rate', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                        Kar Marjı (%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        className="w-full p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                        value={storagePricing.profit_margin_percent ?? ''}
                        onChange={(e) => updateStorageSetting('profit_margin_percent', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs uppercase">
                          <th className="py-2 pr-4">Etiket</th>
                          <th className="py-2 pr-4">Boyut (GB)</th>
                          <th className="py-2 pr-4">Manuel Fiyat (TL)</th>
                          <th className="py-2 pr-4">Uygulanacak Fiyat</th>
                          <th className="py-2 pr-4"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {storagePricing.packages.map((pkg: any, index: number) => (
                          <tr key={index} className="border-t">
                            <td className="py-2 pr-4">
                              <input
                                type="text"
                                className="w-40 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                                value={pkg.label ?? ''}
                                onChange={(e) => updateStoragePackage(index, 'label', e.target.value)}
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                step="0.1"
                                className="w-24 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                                value={pkg.size_gb ?? ''}
                                onChange={(e) => updateStoragePackage(index, 'size_gb', e.target.value)}
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                placeholder="Otomatik"
                                className="w-28 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
                                value={pkg.override_price ?? ''}
                                onChange={(e) => updateStoragePackage(index, 'override_price', e.target.value)}
                              />
                            </td>
                            <td className="py-2 pr-4 font-bold text-green-700">
                              {calcStoragePackagePrice(pkg)} TL
                              {(pkg.override_price === null || pkg.override_price === undefined || pkg.override_price === '') && (
                                <span className="ml-1 text-[10px] font-normal text-gray-400">(otomatik)</span>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <button
                                onClick={() => removeStoragePackage(index)}
                                className="text-red-500 hover:text-red-700"
                                title="Paketi Sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={addStoragePackage}
                    className="flex items-center gap-2 text-sm font-bold text-green-700 hover:text-green-900"
                  >
                    <Plus size={16} /> Yeni Depolama Paketi Ekle
                  </button>

                  <button
                    onClick={handleSaveStoragePricing}
                    disabled={savingPricing}
                    className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50"
                  >
                    {savingPricing ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                    {savingPricing ? 'Kaydediliyor...' : 'Depolama Fiyatlandırmasını Kaydet'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* --- TICKETS TAB --- */}
        {activeTab === 'tickets' && (
          <div className="flex h-[600px] border rounded-xl overflow-hidden bg-white">
            <div className="w-1/3 border-r bg-gray-50 overflow-y-auto">
              <div className="p-4 font-bold border-b bg-gray-100 text-gray-700 sticky top-0">
                Gelen Talepler
              </div>
              {tickets.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Henüz talep yok.
                </div>
              )}
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTicket(t)}
                  className={`p-4 border-b cursor-pointer hover:bg-white transition ${
                    selectedTicket?.id === t.id
                      ? 'bg-white border-l-4 border-l-blue-600 shadow-sm'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        t.status === 'open'
                          ? 'bg-orange-100 text-orange-700'
                          : t.status === 'replied'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {t.status === 'open'
                        ? 'Bekliyor'
                        : t.status === 'replied'
                        ? 'Cevaplandı'
                        : 'Kapalı'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-bold text-gray-800 text-sm truncate mt-1">
                    {t.subject}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Users size={12} /> {t.sender?.full_name || 'Bilinmeyen'}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col bg-white">
              {selectedTicket ? (
                <>
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                      <div className="font-bold text-gray-800">
                        {selectedTicket.subject}
                      </div>
                      <div className="text-xs text-gray-500">
                        {selectedTicket.sender?.email}
                      </div>
                    </div>
                    {selectedTicket.status !== 'closed' ? (
                      <button
                        onClick={closeTicket}
                        className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100 flex items-center gap-1"
                      >
                        <Lock size={12} /> Kapat
                      </button>
                    ) : (
                      <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={12} /> Kapalı
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/30">
                    <div className="flex justify-start">
                      <div className="bg-white p-3 rounded-2xl rounded-tl-none border shadow-sm max-w-[85%]">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                          Kullanıcı (Başlangıç)
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedTicket.message}
                        </p>
                      </div>
                    </div>
                    {ticketMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.sender_role === 'admin'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl shadow-sm max-w-[85%] text-sm ${
                            m.sender_role === 'admin'
                              ? 'bg-blue-600 text-white rounded-tr-none'
                              : 'bg-white border text-gray-800 rounded-tl-none'
                          }`}
                        >
                          <div
                            className={`text-[10px] font-bold uppercase mb-1 ${
                              m.sender_role === 'admin'
                                ? 'text-blue-200'
                                : 'text-gray-400'
                            }`}
                          >
                            {m.sender_role === 'admin' ? 'Siz' : 'Kullanıcı'}
                          </div>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef}></div>
                  </div>

                  {selectedTicket.status !== 'closed' ? (
                    <div className="p-4 border-t bg-white">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Cevabınızı yazın..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleReplyTicket()
                          }
                        />
                        <button
                          onClick={() => handleReplyTicket()}
                          className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-100 text-center text-gray-500 text-sm font-bold border-t">
                      Bu destek talebi kapatılmıştır.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageSquare size={48} className="mb-2 opacity-20" />
                  <p>Detayları görmek için bir talep seçin.</p>
                </div>
              )}
            </div>
          </div>
        )}
        </main>
      </div>
      {/* --- MODALLAR (AYNI KALDI) --- */}
      {viewTeamOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building className="text-purple-600" /> {viewTeamOrg.name} -
                Ekip Yönetimi
              </h3>
              <button onClick={() => setViewTeamOrg(null)}>
                <XCircle className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
            <div className="flex gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
              <input
                className="flex-1 border p-2 rounded text-sm"
                placeholder="Kullanıcı Email Adresi"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <button
                onClick={addUserToOrg}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1"
              >
                <Plus size={14} /> Ekle
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="p-2">İsim</th>
                    <th className="p-2">Rol</th>
                    <th className="p-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teamList.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2">
                        <div>{m.full_name}</div>
                        <div className="text-xs text-gray-500">{m.email}</div>
                      </td>
                      <td className="p-2">
                        <select
                          value={m.role}
                          onChange={(e) => updateMemberRole(m.id, e.target.value)}
                          className="border rounded px-2 py-1 text-xs bg-white font-bold text-blue-700 border-blue-100 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="premium_corporate">Çevre Danışmanlık Firma Sahibi</option>
                          <option value="corporate_chief">Çevre Danışmanlık Firma Yöneticisi</option>
                          <option value="corporate_staff">Çevre Danışmanlık Personeli</option>
                          <option value="normal">Normal (Ekip Dışı)</option>
                        </select>
                      </td>
                      <td className="p-2 text-right">
                        {m.role !== 'premium_corporate' && (
                          <button
                            onClick={() => removeUserFromOrg(m.id)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 overflow-y-auto max-h-[90vh] animate-fadeIn transition-all">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                Yeni Kullanıcı Ekle
              </h3>
              <button 
                onClick={() => setShowCreateUserModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {userSaveError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold whitespace-pre-wrap flex items-start gap-2 animate-fadeIn">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>{userSaveError}</div>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ad Soyad *</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ad Soyad"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                      value={createFullName}
                      onChange={(e) => setCreateFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Telefon *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="05xx xxx xx xx"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">E-posta Adresi *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="ornek@domain.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Şifre * (En az 6 karakter)</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kullanıcı Rolü</label>
                <select
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700"
                  value={createRole}
                  onChange={(e) => {
                    setCreateRole(e.target.value);
                    if (!isCorporateRole(e.target.value)) {
                      setCreateOrgId('');
                    }
                  }}
                >
                  {Object.entries(roleLabels).map(([k, v]: any) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {isCorporateRole(createRole) && (
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 animate-fadeIn">
                  <label className="block text-xs font-bold text-purple-900 mb-1.5 uppercase tracking-wider">Atanacağı Şirket *</label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-purple-200 bg-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-purple-700"
                    value={createOrgId}
                    required={isCorporateRole(createRole)}
                    onChange={(e) => setCreateOrgId(e.target.value)}
                  >
                    <option value="">-- Şirket Seçin --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={14} className="text-slate-500" />
                  Abonelik / Üyelik Bitiş Tarihi
                  {isCorporateRole(createRole) && (
                    <span className="text-[9px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold uppercase ml-auto">
                      Şirket Ayarı
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  disabled={isCorporateRole(createRole)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  value={createEndDate}
                  onChange={(e) => setCreateEndDate(e.target.value)}
                />
                {isCorporateRole(createRole) && (
                  <p className="text-[10px] text-purple-600 mt-1 italic font-medium">
                    * Kurumsal üyelerin aboneliği, bağlı oldukları şirketin abonelik bitiş tarihi ile eşleşir.
                  </p>
                )}
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-xs font-bold text-blue-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600" />
                  Özel Depolama Kotası (MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700 bg-white"
                    value={createQuotaMB}
                    onChange={(e) => setCreateQuotaMB(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-2 rounded-xl">MB</span>
                </div>
              </div>



              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={createUserLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {createUserLoading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {createUserLoading ? 'Kullanıcı Kaydediliyor...' : 'Kaydet ve Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 overflow-y-auto max-h-[90vh] animate-fadeIn transition-all">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                Kullanıcı Yetki & Profil Düzenleme
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {userSaveError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold whitespace-pre-wrap flex items-start gap-2 animate-fadeIn">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>{userSaveError}</div>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-sm bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-1">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Tam Adı:</span>
                  <span className="font-bold text-slate-800">{editingUser.full_name || 'Girilmemiş'}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>E-posta:</span>
                  <span className="font-bold text-slate-800">{editingUser.email}</span>
                </div>
                {editingUser.phone && (
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Telefon:</span>
                    <span className="font-bold text-slate-800">{editingUser.phone}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kullanıcı Rolü</label>
                <select
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700"
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    if (!isCorporateRole(e.target.value)) {
                      setSelectedOrgId('');
                    }
                  }}
                >
                  {Object.entries(roleLabels).map(([k, v]: any) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {isCorporateRole(newRole) && (
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 animate-fadeIn space-y-3">
                  <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider">
                    {newRole === 'premium_corporate' ? 'Yönettiği Şirket' : 'Atanacağı Şirket'}
                  </label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-purple-200 bg-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-purple-700"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                  >
                    <option value="">-- Şirket Seçin --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="new" className="font-bold text-blue-600">
                      + Yeni Şirket Oluştur ve Ata
                    </option>
                  </select>

                  {selectedOrgId === 'new' && (
                    <div className="space-y-3 pt-3 border-t border-purple-100 animate-slideDown">
                      <div>
                        <label className="block text-[10px] font-bold text-purple-700 mb-1 uppercase">Yeni Şirket Ünvanı</label>
                        <input
                          type="text"
                          placeholder="Yeni Şirket Adı"
                          className="w-full p-2.5 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-medium"
                          value={newOrgNameForUser}
                          onChange={(e) => setNewOrgNameForUser(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-purple-700 uppercase">Personel Limiti:</span>
                        <input
                          type="number"
                          className="w-24 p-2.5 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-slate-700 text-center"
                          value={newOrgLimitForUser}
                          onChange={(e) => setNewOrgLimitForUser(parseInt(e.target.value) || 2)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={14} className="text-slate-500" />
                  Abonelik / Üyelik Bitiş Tarihi
                  {isCorporateRole(newRole) && (
                    <span className="text-[9px] text-red-600 bg-red-50 border border-red-150 px-1.5 py-0.5 rounded font-bold uppercase ml-auto flex items-center gap-0.5">
                      <AlertTriangle size={10} /> Şirketi Etkiler
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-medium bg-white"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
                {isCorporateRole(newRole) && (
                  <p className="text-[10px] text-red-500 mt-1.5 font-medium leading-relaxed">
                    * Dikkat: Kurumsal yöneticilerin bitiş tarihi değiştirildiğinde tüm şirket çalışanlarının abonelik bitişi de senkronize olarak güncellenir.
                  </p>
                )}
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-xs font-bold text-blue-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600" />
                  Özel Depolama Kotası (MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700 bg-white"
                    value={userQuotaMB}
                    onChange={(e) => setUserQuotaMB(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-2 rounded-xl">MB</span>
                </div>
              </div>



              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleSaveUser}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                >
                  <Shield size={16} /> Değişiklikleri Kaydet
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-fadeIn transition-all">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Building size={20} />
                </div>
                {editingCompany.id === 'new' ? 'Yeni Şirket Oluştur' : 'Şirket Bilgilerini Düzenle'}
              </h3>
              <button 
                onClick={() => setEditingCompany(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {companySaveError && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold whitespace-pre-wrap flex items-start gap-2 animate-fadeIn shadow-sm">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1 leading-relaxed">
                  {companySaveError}
                  {companySaveError.includes('RLS') && (
                    <div className="mt-2 text-xs bg-white/70 p-2.5 rounded-lg border border-red-100 text-red-800 font-mono select-all">
                      -- Supabase Dashboard SQL Editor'de çalıştırılacak script planda mevcut!
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Şirket Ünvanı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Acme A.Ş."
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-medium"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Personel Limiti</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-slate-700"
                    value={compLimit}
                    onChange={(e) => setCompLimit(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Abonelik Bitişi</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-medium text-slate-700"
                    value={compDate}
                    onChange={(e) => setCompDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <label className="block text-xs font-bold text-purple-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-purple-600" />
                  Ortak Şirket Kotası (MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-full p-2.5 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition text-sm font-semibold text-slate-700 bg-white"
                    value={companyQuotaMB}
                    onChange={(e) => setCompanyQuotaMB(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-2 rounded-xl">MB</span>
                </div>
              </div>

              {/* MODÜL İZİNLERİ VE EKSTRA PAKET TANIMLARI */}
              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare size={14} className="text-purple-600" />
                    Modül İzinleri & Ekstra Paket Tanımları
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                    Şirket / Danışmanlık firmasının erişebileceği modülleri seçin. Varsayılan modüller haricindeki ekstra modüller Admin tarafından veya satın almaya bağlı aktif edilir.
                  </p>
                </div>

                <div className="space-y-4">
                  {SYSTEM_MODULE_CATEGORIES.map((cat) => {
                    const isCatEnabled = compEnabledModules.includes(cat.key);
                    const catModules = SYSTEM_MODULES.filter((m) => m.category === cat.key);

                    const toggleCat = (enabled: boolean) => {
                      if (enabled) {
                        setCompEnabledModules(Array.from(new Set([...compEnabledModules, cat.key])));
                      } else {
                        const subKeys = catModules.map((m) => m.key);
                        setCompEnabledModules(compEnabledModules.filter((k) => k !== cat.key && !subKeys.includes(k)));
                      }
                    };

                    return (
                      <div
                        key={cat.key}
                        className={`space-y-3 p-3.5 rounded-2xl border transition ${
                          isCatEnabled
                            ? 'bg-purple-50/50 border-purple-200'
                            : 'bg-slate-100/70 border-slate-200 opacity-75'
                        }`}
                      >
                        <div className="flex justify-between items-center border-b pb-2 border-purple-200/60">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-purple-950">{cat.name}</span>
                              {cat.isDefault ? (
                                <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold uppercase">Varsayılan Ana Modül</span>
                              ) : (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase">Ekstra Ana Modül</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5">{cat.description}</p>
                          </div>

                          <label className="inline-flex items-center cursor-pointer gap-2 shrink-0">
                            <input
                              type="checkbox"
                              checked={isCatEnabled}
                              onChange={(e) => toggleCat(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 relative"></div>
                            <span className="text-xs font-bold text-slate-700">
                              {isCatEnabled ? 'Ana Modül Açık' : 'Kapalı'}
                            </span>
                          </label>
                        </div>

                        {/* Alt Modüller */}
                        {isCatEnabled ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {catModules.map((m) => {
                              const isChecked = compEnabledModules.includes(m.key);
                              return (
                                <label
                                  key={m.key}
                                  className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                                    isChecked
                                      ? 'bg-purple-100/60 border-purple-300 text-purple-950'
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setCompEnabledModules([...compEnabledModules, m.key]);
                                      } else {
                                        setCompEnabledModules(compEnabledModules.filter((k) => k !== m.key));
                                      }
                                    }}
                                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                                  />
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>{m.name}</span>
                                      {m.isDefault ? (
                                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold uppercase">Varsayılan</span>
                                      ) : (
                                        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase">Ekstra Modül</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">{m.description}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 font-medium italic p-2 bg-slate-200/40 rounded-xl">
                            🔒 Bu ana modül kapalı olduğu için alt sayfaları kullanıcı ve danışman panellerinde görüntülenmez.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-3">
                <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600" />
                  Depolama Sağlayıcısı
                </label>
                <select
                  className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm font-semibold text-slate-700 bg-white"
                  value={compStoragePreference}
                  onChange={(e) => setCompStoragePreference(e.target.value as 'supabase' | 'google_drive')}
                >
                  <option value="supabase">EvrakLab Sistem Depolaması (Supabase)</option>
                  <option value="google_drive">Firmanın Kendi Google Drive'ı</option>
                </select>

                {compStoragePreference === 'google_drive' && (
                  <div className="space-y-2.5 pt-2 border-t border-blue-100">
                    {compGoogleDriveConnectedEmail ? (
                      <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs">
                        <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                          <Check size={13} /> Bağlı: {compGoogleDriveConnectedEmail}
                        </span>
                        <button
                          type="button"
                          onClick={handleDisconnectGoogleDrive}
                          className="text-red-600 text-[10px] font-bold hover:underline shrink-0"
                        >
                          Bağlantıyı Kaldır
                        </button>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-700 font-semibold leading-relaxed">
                        ⚠️ Bağlantı henüz tamamlanmadı. Bağlantı kurulana kadar bu firma belge yükleyemez.
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Google Client ID"
                      className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-xs font-medium"
                      value={compGoogleClientId}
                      onChange={(e) => setCompGoogleClientId(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="Google Client Secret"
                      className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-xs font-medium"
                      value={compGoogleClientSecret}
                      onChange={(e) => setCompGoogleClientSecret(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Drive Klasör ID (opsiyonel, boşsa 'Ana Dizin')"
                      className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-xs font-medium"
                      value={compGoogleDriveFolderId}
                      onChange={(e) => setCompGoogleDriveFolderId(e.target.value)}
                    />

                    {editingCompany.id !== 'new' ? (
                      <>
                        <button
                          type="button"
                          onClick={handleConnectGoogleDrive}
                          disabled={connectingGoogleDrive}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition"
                        >
                          {connectingGoogleDrive
                            ? 'Bağlanıyor...'
                            : compGoogleDriveConnectedEmail
                              ? 'Yeniden Bağla'
                              : "Google Drive'a Bağlan"}
                        </button>
                        <p className="text-[9px] text-slate-400 leading-relaxed">
                          Google Cloud Console'da bu OAuth istemcisinin "Yetkilendirilmiş yeniden yönlendirme URI'leri" alanına şunu ekleyin:{' '}
                          <span className="font-mono select-all">{googleOauthRedirectUri}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">
                        Google Drive bağlantısını tamamlamak için önce şirketi kaydedin, ardından tekrar düzenleyin.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {editingCompany.id !== 'new' && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[10px] font-medium leading-relaxed">
                  ⚠️ Şirket bilgileri veya abonelik süresi güncellendiğinde, bu şirkete bağlı tüm çalışanların paket aktiflik süreleri bu durumdan etkilenecektir.
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleSaveCompany}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
                >
                  <Save size={16} /> Değişiklikleri Kaydet
                </button>
                <button
                  onClick={() => setEditingCompany(null)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: MEVZUAT EKLEME/DÜZENLEME MODALI --- */}
      {showAddLegislationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 border border-slate-100 overflow-y-auto max-h-[90vh] animate-fadeIn transition-all space-y-4">
            <div className="flex justify-between items-center mb-2 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Scale size={20} className="text-teal-600" />
                {editingLegislation ? 'Mevzuat Düzenle' : 'Yeni Mevzuat Ekle'}
              </h3>
              <button 
                onClick={() => setShowAddLegislationModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Ayrıştırma Motorları */}
            {!editingLegislation && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PDF Yükleme */}
                <div className="flex flex-col gap-2 border p-4 rounded-2xl bg-teal-50/20 border-teal-100">
                  <h4 className="font-bold text-xs text-teal-800 flex items-center gap-1.5 uppercase">
                    <Upload size={14} /> 1. PDF Yükle ve Akıllı Ayrıştır
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Resmi Gazete mevzuat PDF'ini sisteme yükleyin, maddeleri otomatik ayrıştıralım.
                  </p>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleParsePdf}
                    disabled={parsingPdf}
                    className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 mt-2 cursor-pointer"
                  />
                  {parsingPdf && (
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-600 mt-2">
                      <Loader size={16} className="animate-spin" /> PDF Okunuyor ve Maddeler Ayrıştırılıyor...
                    </div>
                  )}
                </div>

                {/* Metin Yapıştırma */}
                <div className="flex flex-col gap-2 border p-4 rounded-2xl bg-indigo-50/20 border-indigo-100">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-indigo-800 flex items-center gap-1.5 uppercase">
                      <FileText size={14} /> 2. Metin Yapıştır ve Ayrıştır
                    </h4>
                    <button
                      type="button"
                      onClick={() => setParsingTextMode(!parsingTextMode)}
                      className="text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold transition border border-indigo-200"
                    >
                      {parsingTextMode ? 'Kapat' : 'Metin Kutusunu Aç'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Resmi Gazete mevzuat metnini kopyalayıp buraya yapıştırarak maddelere ayrıştırın.
                  </p>
                  {parsingTextMode && (
                    <div className="space-y-2 mt-2">
                      <textarea
                        placeholder="Mevzuat metnini buraya yapıştırın (Örn: MADDE 1 - ...)"
                        className="w-full h-32 p-2 border rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleParseText}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
                      >
                        Ayrıştır
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Metadataları */}
            <form onSubmit={handleSaveLegislation} className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150 space-y-4">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Mevzuat Detayları</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Mevzuat Adı / Başlığı *</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Çevre İzin ve Lisans Yönetmeliği"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      value={legTitle}
                      onChange={(e) => setLegTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                    <select
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-1 focus:ring-teal-500 bg-white text-slate-700 font-semibold"
                      value={legCategory}
                      onChange={(e) => setLegCategory(e.target.value)}
                    >
                      <option value="Yönetmelik">Yönetmelik</option>
                      <option value="Kanun">Kanun</option>
                      <option value="Yönerge">Yönerge</option>
                      <option value="Tebliğ">Tebliğ</option>
                      <option value="Genelge">Genelge</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">RG Numarası</label>
                    <input
                      type="text"
                      placeholder="Örn: 29115"
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      value={legRgNo}
                      onChange={(e) => setLegRgNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">RG Tarihi</label>
                    <input
                      type="date"
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-1 focus:ring-teal-500 text-slate-700 bg-white"
                      value={legRgDate}
                      onChange={(e) => setLegRgDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Yayın Tarihi</label>
                    <input
                      type="date"
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-1 focus:ring-teal-500 text-slate-700 bg-white"
                      value={legPubDate}
                      onChange={(e) => setLegPubDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Yürürlük Tarihi</label>
                    <input
                      type="date"
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-1 focus:ring-teal-500 text-slate-700 bg-white"
                      value={legEffDate}
                      onChange={(e) => setLegEffDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Maddeler Editörü */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={14} className="text-teal-600" />
                    Maddeler ({legArticles.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setLegArticles([
                        ...legArticles,
                        { article_no: `Madde ${legArticles.length + 1}`, title: '', content: '', order_index: legArticles.length + 1 }
                      ]);
                    }}
                    className="bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-teal-200 transition flex items-center gap-1"
                  >
                    <Plus size={12} /> Madde Ekle
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto border p-3 rounded-2xl bg-slate-50/20">
                  {legArticles.length === 0 ? (
                    <p className="text-center py-10 text-xs text-slate-400 italic">
                      Henüz madde bulunmuyor. PDF yükleyebilir, metin yapıştırabilir veya manuel "Madde Ekle" butonunu kullanabilirsiniz.
                    </p>
                  ) : (
                    legArticles.map((art, idx) => (
                      <div key={idx} className="p-3.5 bg-white border rounded-2xl space-y-3 shadow-sm relative group border-slate-100">
                        <button
                          type="button"
                          onClick={() => setLegArticles(legArticles.filter((_, i) => i !== idx))}
                          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded-full transition"
                          title="Maddeyi Sil"
                        >
                          <XCircle size={18} />
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Madde No (Örn: Madde 1)"
                            className="border p-2 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                            value={art.article_no}
                            onChange={(e) => {
                              const copy = [...legArticles];
                              copy[idx].article_no = e.target.value;
                              setLegArticles(copy);
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Madde Başlığı (Örn: Amaç)"
                            className="sm:col-span-3 border p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                            value={art.title}
                            onChange={(e) => {
                              const copy = [...legArticles];
                              copy[idx].title = e.target.value;
                              setLegArticles(copy);
                            }}
                          />
                        </div>
                        <textarea
                          required
                          placeholder="Madde içeriği..."
                          className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-1 focus:ring-teal-500 min-h-[60px] resize-y bg-white text-slate-700 font-medium"
                          value={art.content}
                          onChange={(e) => {
                            const copy = [...legArticles];
                            copy[idx].content = e.target.value;
                            setLegArticles(copy);
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-teal-100 animate-pulse"
                >
                  <Check size={16} /> Mevzuatı Kaydet ve Yayınla
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLegislationModal(false)}
                  className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- YENİ: MEVZUAT FİRMA ATAMA MODALI --- */}
      {showAssignLegModal && assigningLeg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Building size={18} className="text-blue-600" />
                Mevzuatı Tanımla
              </h3>
              <button 
                onClick={() => setShowAssignLegModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-150">
                <div className="text-slate-400 uppercase tracking-wide">Atanacak Mevzuat:</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{assigningLeg.title}</div>
                <div className="text-teal-600 font-bold mt-0.5 uppercase">{assigningLeg.category}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Hedef Danışmanlık Firması Seçin</label>
                <select
                  className="w-full p-2.5 rounded-xl border bg-white outline-none focus:ring-1 focus:ring-blue-500 font-bold text-sm text-slate-700 border-slate-250"
                  value={selectedFirmId}
                  onChange={(e) => setSelectedFirmId(e.target.value)}
                >
                  <option value="">-- Firma Seçin --</option>
                  {companies
                    .filter(c => c.is_environmental_consultant === true)
                    .map((c) => {
                      const isAlreadyAssigned = (assignedCompaniesMap[assigningLeg.id] || []).includes(c.id);
                      return (
                        <option key={c.id} value={c.id} disabled={isAlreadyAssigned}>
                          {c.name} {isAlreadyAssigned ? '(Zaten Tanımlı)' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <button
                  onClick={handleAssignLegislation}
                  disabled={!selectedFirmId}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:shadow-none"
                >
                  Tanımlamayı Kaydet
                </button>
                <button
                  onClick={() => setShowAssignLegModal(false)}
                  className="flex-1 border border-slate-200 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- YENİ: MEVZUAT TALEBİ DEĞERLENDİRME MODALI --- */}
      {replyingRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Bell size={18} className="text-orange-500" />
                Talep Değerlendir
              </h3>
              <button 
                onClick={() => setReplyingRequest(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1 text-slate-600">
                <div>Talep Edilen: <b>{replyingRequest.title}</b></div>
                <div>Açıklama: {replyingRequest.description}</div>
                <div>Talep Eden: <b>{replyingRequest.requester?.full_name}</b></div>
                {replyingRequest.organization && <div>Danışmanlık Firması: <b>{replyingRequest.organization.name}</b></div>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Admin Cevap Notu</label>
                <textarea
                  placeholder="Talep edene iletilecek açıklama veya not..."
                  className="w-full h-24 p-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-teal-500 bg-white text-slate-700 font-medium"
                  value={requestAdminNotes}
                  onChange={(e) => setRequestAdminNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => handleRequestStatusUpdate(replyingRequest.id, 'approved')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-bold text-xs transition"
                >
                  Onayla / Karşılandı
                </button>
                <button
                  onClick={() => handleRequestStatusUpdate(replyingRequest.id, 'rejected')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl font-bold text-xs transition"
                >
                  Reddet
                </button>
                <button
                  onClick={() => setReplyingRequest(null)}
                  className="flex-1 border border-slate-200 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition text-xs"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

