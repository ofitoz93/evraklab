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
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'clients' | 'reports' | 'settings' | 'team' | 'definitions' | 'legislations'>('clients');

  // --- MEVZUAT TAKİP BÖLÜMÜ STATE'LERİ ---
  const [assignedGlobalLegislations, setAssignedGlobalLegislations] = useState<any[]>([]);
  const [allGlobalRegulations, setAllGlobalRegulations] = useState<any[]>([]);
  const [importingLegId, setImportingLegId] = useState<string | null>(null);
  const [clientRegulations, setClientRegulations] = useState<any[]>([]);
  const [staffRequests, setStaffRequests] = useState<any[]>([]);
  const [legSubTab, setLegSubTab] = useState<'pool' | 'assignments' | 'requests'>('pool');
  
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
  });
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
    if ((activeTab === 'settings' || activeTab === 'team' || activeTab === 'definitions' || activeTab === 'legislations') && orgId) {
      fetchTeamMembers();
    }
    if (activeTab === 'team' && orgId) {
      fetchInvitations();
    }
    if (activeTab === 'definitions' && orgId) {
      fetchDefinitionsTab();
    }
    if (activeTab === 'legislations' && orgId) {
      fetchConsultantLegislations();
      fetchConsultantRequests();
    }
  }, [activeTab, orgId]);

  const fetchTeamMembers = async () => {
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, extra_permissions')
      .eq('organization_id', orgId);
    setTeamMembers(members || []);
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
    } catch (err: any) {
      console.error('Maddeler yüklenemedi:', err.message);
    } finally {
      setLoadingLegArticles(false);
    }
  };

  const handleToggleArticleMandatory = async (articleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ is_mandatory: !currentStatus, last_updated_by: userId })
        .eq('id', articleId);
      if (error) throw error;
      
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Madde güncellenirken hata: ' + err.message);
    }
  };

  const handleUpdateArticleCompliance = async (articleId: string, status: 'compliant' | 'non_compliant') => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ compliance_status: status, last_updated_by: userId })
        .eq('id', articleId);
      if (error) throw error;
      
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
    } catch (err: any) {
      alert('Madde uyum durumu güncellenirken hata: ' + err.message);
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

  const handleRequestArticleNotes = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ current_status_requested: true })
        .eq('id', articleId);
      if (error) throw error;
      
      if (selectedClientRegulation) {
        await fetchClientRegulationArticles(selectedClientRegulation);
      }
      alert('Mevcut durum notu girişi talep edildi.');
    } catch (err: any) {
      alert('Talep iletilirken hata: ' + err.message);
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
        },
      ]);
      if (error) throw error;
      setShowAddClient(false);
      setNewClient({ name: '', address: '', tax_no: '', phone: '', logo_url: '' });
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
          <Scale size={16} /> Mevzuatlar
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
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase dark:bg-blue-950/30">
                          {member.full_name?.charAt(0) || <User size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 dark:text-white flex flex-wrap items-center gap-2">
                            {member.full_name}
                            <span className="text-[10px] px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 uppercase font-semibold">
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
                <Scale className="text-teal-600" /> Mevzuat Yönetimi
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
            <button
              onClick={() => setLegSubTab('requests')}
              className={`flex items-center gap-2 py-2.5 px-5 text-xs font-bold rounded-lg transition ${
                legSubTab === 'requests'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-900/50'
              }`}
            >
              <Bell size={14} /> Mevzuat Talepleri
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
                    {(userRole === 'premium_corporate' || userRole === 'corporate_chief') && (
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
                                  className="bg-red-50 hover:bg-red-100 text-red-650 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400 whitespace-nowrap"
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
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2 border-b pb-2 border-gray-100 dark:border-slate-700">
                      <Building size={18} className="text-blue-600" />
                      İşletmelere Atanan Mevzuatlar
                    </h3>

                    <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto pr-1">
                      {clientRegulations.length === 0 ? (
                        <p className="text-center py-6 text-xs text-gray-400 italic">
                          Hizmet verdiğiniz işletmelere henüz atanmış bir mevzuat bulunmuyor.
                        </p>
                      ) : (
                        clientRegulations.map(cr => (
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
                                  className="bg-red-50 hover:bg-red-100 text-red-650 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400"
                                >
                                  Kaldır
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
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
                        <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-150 dark:border-slate-750">
                          <div className="text-slate-400 uppercase tracking-wide">Seçili Mevzuat:</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{selectedClientRegulation.title}</div>
                          <div className="text-teal-600 font-bold mt-0.5">{selectedClientRegulation.client?.name}</div>
                        </div>

                        {loadingLegArticles ? (
                          <div className="flex items-center justify-center p-8">
                            <Loader className="animate-spin text-teal-600" size={24} />
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                            {selectedClientRegulationArticles.length === 0 ? (
                              <p className="text-center text-xs text-gray-400 italic py-4">Bu mevzuata ait madde bulunamadı.</p>
                            ) : (
                              selectedClientRegulationArticles.map((art) => (
                                <div key={art.id} className="p-4 rounded-xl border border-gray-150 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/10 space-y-3">
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

                                      {/* Requested Status Badge */}
                                      {art.current_status_requested && (
                                        <div className="mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                          ⚠️ Mevcut Durum Notu Girişi Talep Edildi
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-1.5 items-end">
                                      <button
                                        onClick={() => handleToggleArticleMandatory(art.id, art.is_mandatory)}
                                        className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full border uppercase transition ${
                                          art.is_mandatory
                                            ? 'bg-green-50 text-green-700 border-green-250 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900'
                                            : 'bg-red-50 text-red-700 border-red-250 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900'
                                        }`}
                                      >
                                        {art.is_mandatory ? 'Uyum Zorunlu' : 'Muaf'}
                                      </button>
                                      {art.is_mandatory && (
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => handleUpdateArticleCompliance(art.id, 'compliant')}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition ${
                                              art.compliance_status !== 'non_compliant'
                                                ? 'bg-green-650 border-transparent text-white shadow-sm'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-green-650'
                                            }`}
                                          >
                                            Uygun
                                          </button>
                                          <button
                                            onClick={() => handleUpdateArticleCompliance(art.id, 'non_compliant')}
                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition ${
                                              art.compliance_status === 'non_compliant'
                                                ? 'bg-red-600 border-transparent text-white shadow-sm'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-red-600'
                                            }`}
                                          >
                                            Uygun Değil
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-xs text-gray-650 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{art.content}</p>

                                  {/* Mevcut Durum Notu (Current Status Note) Section */}
                                  {art.is_mandatory && (
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
                                              className="bg-green-650 hover:bg-green-750 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
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
                                              className="text-[10px] font-bold text-teal-650 hover:bg-teal-50 dark:hover:bg-teal-950/20 border border-teal-200 px-2.5 py-1 rounded transition"
                                            >
                                              Düzenle
                                            </button>
                                            {(userRole === 'premium_corporate' || userRole === 'corporate_chief') && !art.current_status_requested && (
                                              <button
                                                onClick={() => handleRequestArticleNotes(art.id)}
                                                className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-amber-250 px-2.5 py-1 rounded transition"
                                              >
                                                Mevcut Durum Talep Et
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. SEKME: MEVZUAT TALEPLERİ */}
            {legSubTab === 'requests' && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-4 animate-fadeIn">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2 border-b pb-2 border-gray-100 dark:border-slate-700">
                  <Bell size={18} className="text-teal-600" />
                  Mevzuat & Güncelleme Talepleri
                </h3>

                <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto pr-1">
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
                            className="bg-teal-650 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <PlusCircle size={12} /> Admin'e Yönlendir
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
    </div>
  );
}
