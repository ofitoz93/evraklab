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
} from 'lucide-react';
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


export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<
    'users' | 'companies' | 'tickets' | 'notifications' | 'email_settings' | 'system_settings' | 'legislations' | 'legislation_requests'
  >('tickets');

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
      const { error } = await supabase
        .from('regulation_requests')
        .update({
          status,
          admin_notes: requestAdminNotes.trim()
        })
        .eq('id', requestId);
      if (error) throw error;
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
    } else if (activeTab === 'legislations') {
      fetchGlobalLegislations();
      fetchLegislationRequests();
      fetchCompanies();
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
    if (!window.confirm('E-posta hatırlatıcılarını şimdi manuel olarak tetiklemek istiyor musunuz? Bu işlem, koşulları sağlayan belgelere sahip tüm kullanıcılara hatırlatma e-postaları gönderecektir.')) {
      return;
    }
    setTriggeringReminders(true);
    try {
      const { error } = await supabase.rpc('send_expiry_reminders');
      if (error) throw error;
      alert('E-posta hatırlatma fonksiyonu başarıyla tetiklendi!');
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
          if (finalDate)
            await supabase
              .from('companies')
              .update({ subscription_end_date: finalDate })
              .eq('id', targetOrgId);
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
        updates.subscription_end_date = null;
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
        updates.subscription_end_date = null;
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
    setCompanyQuotaMB(Math.round((comp.storage_limit || 0) / 1048576));
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

  const handleDeleteCompany = async (orgId: string, orgName: string) => {
    if (
      !window.confirm(
        `"${orgName}" şirketini silmek istediğinize emin misiniz?`
      )
    )
      return;
    try {
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
                onClick={() => setActiveTab('legislations')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'legislations'
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <Scale size={18} />
                <span>Mevzuat Havuzu</span>
              </button>
              <button
                onClick={() => setActiveTab('legislation_requests')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold transition ${
                  activeTab === 'legislation_requests'
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                    : 'text-gray-650 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare size={18} />
                  <span>Mevzuat Talepleri</span>
                </div>
                {legislationRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {legislationRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
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
            </nav>
          </div>
        </aside>

        {/* Sağ İçerik Alanı */}
        <main className="flex-1 w-full bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 min-h-[500px] space-y-4">
        {activeTab !== 'tickets' && activeTab !== 'notifications' && activeTab !== 'email_settings' && activeTab !== 'system_settings' && (
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
                  setCreateCanViewRegulations(false);
                  setCreateCanManageRegulations(false);
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
        {activeTab === 'legislation_requests' && (
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
                          req.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
                          'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
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

              {(createRole.includes('premium') || isCorporateRole(createRole)) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={14} className="text-slate-500" />
                    Abonelik Bitiş Tarihi
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
              )}

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

              {(newRole.includes('premium') || isCorporateRole(newRole)) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={14} className="text-slate-500" />
                    Abonelik Bitiş Tarihi
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
              )}

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

              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="comp-env"
                  className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  checked={compIsEnvConsultant}
                  onChange={(e) => setCompIsEnvConsultant(e.target.checked)}
                />
                <label htmlFor="comp-env" className="flex flex-col cursor-pointer select-none">
                  <span className="text-sm font-bold text-blue-900">Çevre Danışmanlık Yetkisi (Raporlar Modülü)</span>
                  <span className="text-[10px] text-blue-600/80 font-medium">Bu şirket için detaylı Çevre Danışmanlığı Raporu (Aylık/Yıllık) hazırlama modülünü etkinleştirir.</span>
                </label>
              </div>

              {editingCompany.id !== 'new' && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[10px] font-medium leading-relaxed">
                  ⚠️ Şirket bilgileri veya abonelik süresi güncellendiğinde, bu şirkete bağlı tüm çalışanların paket aktiflik süreleri bu durumdan etkilenecektir.
                </div>
              )}

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

