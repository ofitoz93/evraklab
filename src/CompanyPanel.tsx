import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  Users,
  Ticket,
  Copy,
  Trash2,
  Mail,
  Shield,
  UserCog,
  CheckSquare,
  Square,
  PieChart,
  AlertCircle,
  Building,
  Lock,
  Send,
  Clock,
  User,
  Loader,
  Crown,
  XCircle,
  BookOpen,
  PlusCircle,
  CheckCircle,
  Plus,
  ArrowRight,
  Calendar,
  FileText,
  Scale,
} from 'lucide-react';

export default function CompanyPanel() {
  const [loading, setLoading] = useState(true);
  const [myOrg, setMyOrg] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Compliance (Mevzuatlarımız) states
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'team';
  const [activeTab, setActiveTab] = useState<'team' | 'compliance' | 'requests' | 'actions'>(initialTab as any);

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
    currentMandatoryState?: boolean;
  } | null>(null);
  const [complianceNoteValue, setComplianceNoteValue] = useState('');
  const [savingComplianceNote, setSavingComplianceNote] = useState(false);
  const [articleFilter, setArticleFilter] = useState<string>('all');
  const [selectedArticleIdsForRequest, setSelectedArticleIdsForRequest] = useState<string[]>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [selectedEvidenceDocUrl, setSelectedEvidenceDocUrl] = useState<string>('');
  const [evidenceMode, setEvidenceMode] = useState<'upload' | 'select'>('upload');
  const [reqNotesArticleId, setReqNotesArticleId] = useState<string>('');

  const [clientRecId, setClientRecId] = useState<string | null>(null);
  const [myRegulations, setMyRegulations] = useState<any[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [selectedRegArticles, setSelectedRegArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [regsError, setRegsError] = useState<string | null>(null);

  // Mevcut Durum (Current Status Notes) states
  const [editingNotesArtId, setEditingNotesArtId] = useState<string | null>(null);
  const [tempNotesVal, setTempNotesVal] = useState('');

  // Consultant mode in CompanyPanel states
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedRegId, setSelectedRegId] = useState<string>('');

  // Request Modal & List states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestClientId, setRequestClientId] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);

  // Yetki İsimleri (Türkçe)
  const permLabels: any = {
    can_invite: 'Davet Yetkisi',
    can_view_team_docs: 'Ekip Dosyalarını Gör',
    can_edit_team_docs: 'Dosya Düzenle',
    can_delete_team_docs: 'Dosya Sil',
  };

  // Rol İsimleri (Türkçe Çeviri)
  const roleLabels: any = {
    premium_corporate: 'Şirket Sahibi',
    corporate_chief: 'Departman Şefi',
    corporate_staff: 'Personel',
    normal: 'Normal Üye',
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          let orgData = null;
          if (profile.organization_id) {
            const { data: org } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', profile.organization_id)
              .single();
            orgData = org;
          }
          const combined = { ...profile, organization: orgData };
          setMyProfile(combined);

          if (orgData) {
            setMyOrg(orgData);

          // 1. MEVCUT ÜYELER
          let query = supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id);

          if (profile.role === 'premium_corporate')
            query = query.neq('id', session.user.id);

          const { data: members } = await query.order('role', {
            ascending: true,
          });
          setTeamMembers(members || []);

          // 2. BEKLEYEN DAVETLER
          const { data: invites } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('is_used', false)
            .order('created_at', { ascending: false });
          setInvitations(invites || []);
        }
      }
    }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestsForClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('regulation_requests')
        .select('*, requested_by_profile:profiles!requested_by(full_name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMyRequests(data || []);
    } catch (err: any) {
      console.error('Talepler çekilirken hata:', err.message);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim() || !requestDescription.trim()) {
      return alert('Lütfen tüm alanları doldurun.');
    }

    const isConsultantUser = !!myOrg?.is_environmental_consultant || 
      ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(myProfile?.role);
    
    const targetClientId = isConsultantUser ? requestClientId : clientRecId;

    if (!targetClientId) {
      return alert('Lütfen talep yapılacak firmayı seçin.');
    }

    try {
      setSubmittingRequest(true);
      const isOwner = myProfile?.role === 'premium_corporate';
      const reqType = isOwner ? 'owner_to_admin' : 'staff_to_owner';

      const { error } = await supabase
        .from('regulation_requests')
        .insert({
          title: requestTitle.trim(),
          description: requestDescription.trim(),
          requested_by: myProfile.id,
          client_id: targetClientId,
          organization_id: myOrg.id,
          request_type: reqType,
          status: 'pending'
        });

      if (error) throw error;

      alert('Mevzuat talebiniz başarıyla iletildi!');
      setShowRequestModal(false);
      setRequestTitle('');
      setRequestDescription('');
      
      if (clientRecId) {
        await fetchRequestsForClient(clientRecId);
      } else {
        await fetchRequestsForClient(targetClientId);
      }
    } catch (err: any) {
      alert('Talep gönderilirken hata oluştu: ' + err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleSelectRegulation = async (regId: string) => {
    setSelectedRegId(regId);
    if (regId) {
      const reg = myRegulations.find((r) => r.id === regId);
      if (reg) {
        await fetchRegulationArticles(reg);
      }
    } else {
      setSelectedReg(null);
      setSelectedRegArticles([]);
    }
  };

  const fetchRegulationsForClient = async (clientId: string) => {
    setLoadingRegs(true);
    setRegsError(null);
    setSelectedReg(null);
    setSelectedRegArticles([]);
    setSelectedRegId('');
    try {
      setClientRecId(clientId);
      const { data: regs, error: regsErr } = await supabase
        .from('client_regulations')
        .select('*, parent:pdf_regulations(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (regsErr) throw regsErr;
      setMyRegulations(regs || []);

      // Fetch requests for this client
      await fetchRequestsForClient(clientId);
    } catch (err: any) {
      console.error('Mevzuatlar çekilirken hata:', err.message);
      setRegsError(err.message);
    } finally {
      setLoadingRegs(false);
    }
  };

  const fetchMyRegulations = async (orgName: string) => {
    setLoadingRegs(true);
    setRegsError(null);
    try {
      const isConsultant = !!myOrg?.is_environmental_consultant || 
        ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(myProfile?.role);
      if (isConsultant) {
        let clientsList: any[] = [];
        const canViewAll = myProfile?.role === 'premium_corporate' || !!myProfile?.permissions?.can_view_all_clients;
        if (canViewAll) {
          // Get all clients of the consultant company
          const { data } = await supabase
            .from('consultant_clients')
            .select('id, name')
            .eq('consultant_company_id', myOrg.id);
          clientsList = data || [];
        } else {
          // Get clients assigned to this staff member
          const { data } = await supabase
            .from('consultant_assignments')
            .select('client_id, client:consultant_clients(id, name)')
            .eq('user_id', myProfile?.id);
          clientsList = data?.map((a: any) => a.client).filter(Boolean) || [];
        }
        setAssignedClients(clientsList);
        
        // Do not auto-select. Force them to select a firm.
        setSelectedClientId('');
        setClientRecId(null);
        setMyRegulations([]);
      } else {
        // Normal client company: find matching client record in consultant_clients
        const { data: ccList, error: ccErr } = await supabase
          .from('consultant_clients')
          .select('id, name');
        
        if (ccErr) throw ccErr;
        
        let clientRec = null;
        if (ccList && ccList.length > 0) {
          // Try to find the closest match by substring matching
          const cleanOrgName = orgName.trim().toLowerCase();
          clientRec = ccList.find((c: any) => {
            const cleanClientName = c.name.trim().toLowerCase();
            return cleanClientName.includes(cleanOrgName) || cleanOrgName.includes(cleanClientName);
          });
          
          // If no fuzzy match, default to the first one available
          if (!clientRec) {
            clientRec = ccList[0];
          }
        }
        
        if (clientRec) {
          await fetchRegulationsForClient(clientRec.id);
        } else {
          setClientRecId(null);
          setMyRegulations([]);
        }
      }
    } catch (err: any) {
      console.error('Mevzuatlar çekilirken hata:', err.message);
      setRegsError(err.message);
    } finally {
      setLoadingRegs(false);
    }
  };

  const fetchRegulationArticles = async (reg: any) => {
    setLoadingArticles(true);
    setSelectedReg(reg);
    try {
      const { data, error } = await supabase
        .from('client_regulation_articles')
        .select('*, updater:profiles!last_updated_by(full_name)')
        .eq('client_regulation_id', reg.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSelectedRegArticles(data || []);
    } catch (err: any) {
      console.error('Maddeler çekilirken hata:', err.message);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleToggleArticleMandatory = async (artId: string, currentStatus: boolean) => {
    const art = selectedRegArticles.find(a => a.id === artId);
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
          .update({ is_mandatory: true, compliance_status: null, last_updated_by: myProfile?.id })
          .eq('id', artId);
        if (error) throw error;
        
        if (selectedReg) {
          await fetchRegulationArticles(selectedReg);
        }
      } catch (err: any) {
        alert('Madde güncellenirken hata: ' + err.message);
      }
    }
  };

  const handleUpdateArticleCompliance = async (artId: string, status: 'compliant' | 'non_compliant') => {
    const art = selectedRegArticles.find(a => a.id === artId);
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
        last_updated_by: myProfile?.id,
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
      
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
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
          last_updated_by: myProfile?.id
        })
        .eq('id', articleId);
      if (error) throw error;
      
      setEditingNotesArtId(null);
      setTempNotesVal('');
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
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
      
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
      alert('Mevcut durum notu girişi talep edildi.');
    } catch (err: any) {
      alert('Talep iletilirken hata: ' + err.message);
    }
  };

  const handleRequestAllArticleNotes = async () => {
    if (!selectedReg) return;
    if (!window.confirm('Bu mevzuat altındaki tüm aktif maddeler için mevcut durum notu talep etmek istediğinize emin misiniz?')) return;
    
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ current_status_requested: true })
        .eq('client_regulation_id', selectedReg.id)
        .eq('is_mandatory', true);
        
      if (error) throw error;
      
      await fetchRegulationArticles(selectedReg);
      alert('Tüm aktif maddeler için mevcut durum notu girişi talep edildi.');
    } catch (err: any) {
      alert('Toplu talep iletilirken hata: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'compliance' && myOrg?.name && myProfile) {
      fetchMyRegulations(myOrg.name);
    }
  }, [activeTab, myOrg, myProfile]);

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
    if (myProfile?.id) {
      fetchUserDocuments(myProfile.id);
    }
  }, [myProfile]);

  useEffect(() => {
    if (activeTab === 'requests' && clientRecId) {
      fetchRequestsForClient(clientRecId);
    }
  }, [activeTab, clientRecId]);

  const handleToggleArticleSelection = (artId: string) => {
    setSelectedArticleIdsForRequest(prev =>
      prev.includes(artId) ? prev.filter(id => id !== artId) : [...prev, artId]
    );
  };

  const handleRequestSelectedArticleNotes = async () => {
    if (selectedArticleIdsForRequest.length === 0) {
      alert('Lütfen en az bir madde seçin.');
      return;
    }
    if (!window.confirm(`Seçilen ${selectedArticleIdsForRequest.length} madde için mevcut durum notu talep etmek istediğinize emin misiniz?`)) return;
    
    try {
      const { error } = await supabase
        .from('client_regulation_articles')
        .update({ current_status_requested: true })
        .in('id', selectedArticleIdsForRequest);
        
      if (error) throw error;
      
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
      setSelectedArticleIdsForRequest([]);
      alert('Seçilen maddeler için durum notu girişi talep edildi.');
    } catch (err: any) {
      alert('Talep iletilirken hata: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'actions') {
      fetchComplianceActions();
    }
  }, [activeTab, myOrg, myProfile, assignedClients]);

  // --- AKSİYON TAKİP SİSTEMİ FONKSİYONLARI ---
  const fetchComplianceActions = async () => {
    if (!myOrg) return;
    setLoadingActions(true);
    try {
      let query = supabase
        .from('compliance_actions')
        .select('*, client:consultant_clients(name), assignee:profiles!assigned_to(full_name), creator:profiles!created_by(full_name)');
      
      if (isConsultant) {
        const clientIds = assignedClients.map(c => c.id);
        if (clientIds.length > 0) {
          if (myProfile?.role === 'corporate_staff') {
            query = query.or(`assigned_to.eq.${myProfile.id},client_id.in.(${clientIds.join(',')})`);
          } else {
            query = query.in('client_id', clientIds);
          }
        } else {
          query = query.eq('assigned_to', myProfile?.id);
        }
      } else {
        if (clientRecId) {
          query = query.eq('client_id', clientRecId);
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
      console.error('Aksiyonlar yüklenemedi:', err.message);
    } finally {
      setLoadingActions(false);
    }
  };

  const handleCreateAction = async () => {
    const title = newActionTitle.trim();
    const desc = newActionDesc.trim();
    const cId = isConsultant ? newActionClientId : clientRecId;
    const aId = newActionAssigneeId || myProfile?.id;
    const dDate = newActionDueDate;
    
    if (!title || !cId || !aId || !dDate) {
      alert('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('compliance_actions')
        .insert({
          client_id: cId,
          article_id: reqNotesArticleId || null,
          title: title,
          description: desc || null,
          due_date: dDate,
          created_by: myProfile?.id,
          assigned_to: aId,
          status: 'pending'
        });
        
      if (error) throw error;
      
      alert('Aksiyon başarıyla oluşturuldu.');
      closeCreateActionModal();
      
      await fetchComplianceActions();
    } catch (err: any) {
      alert('Aksiyon oluşturulurken hata: ' + err.message);
    }
  };

  const closeCreateActionModal = () => {
    setShowCreateActionModal(false);
    setNewActionTitle('');
    setNewActionDesc('');
    setNewActionClientId('');
    setNewActionAssigneeId('');
    setNewActionDueDate('');
    setReqNotesArticleId('');
  };

  const handleOpenActionForArticle = async (art: any) => {
    setNewActionTitle(`[${art.article_no}] Aksiyon`);
    setNewActionDesc(`Bu madde için aksiyon tamamlanması gerekmektedir.\nİlgili Madde: ${art.article_no} - ${art.title || ''}`);
    setNewActionClientId(clientRecId || '');
    setReqNotesArticleId(art.id);
    
    // Otomatik atama
    try {
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('user_id')
        .eq('client_id', clientRecId);
      
      if (assignments && assignments.length > 0) {
        setNewActionAssigneeId(assignments[0].user_id);
      } else {
        setNewActionAssigneeId(myProfile?.id || '');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setNewActionAssigneeId(myProfile?.id || '');
    }
    
    setNewActionDueDate('');
    setShowCreateActionModal(true);
    setActiveTab('actions');
    setSearchParams({ tab: 'actions' });
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
            last_updated_by: myProfile?.id
          })
          .eq('id', articleId);
      }
      
      alert('Aksiyon tamamlandı ve onay bekliyor durumuna getirildi!');
      setShowCompleteActionModal(false);
      setActionNotes('');
      setActionEvidenceFile(null);
      setSelectedClientAction(null);
      
      await fetchComplianceActions();
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
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
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
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
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
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
      if (selectedReg) {
        await fetchRegulationArticles(selectedReg);
      }
    } catch (err: any) {
      alert('Aksiyon silinirken hata: ' + err.message);
    }
  };

  const isConsultant = !!myOrg?.is_environmental_consultant || 
    ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(myProfile?.role);
  const isCorporateAdmin = myProfile?.role === 'premium_corporate';
  const canInvite =
    isCorporateAdmin ||
    (myProfile?.role === 'corporate_chief' &&
      myProfile?.permissions?.can_invite);
  const isExpired = myProfile?.role === 'normal' && myProfile?.organization_id;

  const billableMembersCount = teamMembers.filter(
    (m) => m.role !== 'premium_corporate'
  ).length;
  const totalUsed = billableMembersCount + invitations.length;
  const maxLimit = myOrg?.member_limit || 5;
  const usagePercent = Math.min(100, (totalUsed / maxLimit) * 100);
  const isFull = totalUsed >= maxLimit;

  // --- 1. E-POSTA İLE DAVET (Geri Eklendi) ---
  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalUsed >= maxLimit)
      return alert('Kapasite dolu! Paket yükseltmeniz gerekiyor.');
    if (!inviteEmail.includes('@')) return alert('Geçerli bir email giriniz.');

    setSendingEmail(true);
    try {
      // Mevcut davet var mı?
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', myOrg.id)
        .eq('email', inviteEmail)
        .eq('is_used', false)
        .maybeSingle();

      if (existingInvite) {
        alert('⚠️ Bu kullanıcıya zaten bekleyen bir davet var.');
        setSendingEmail(false);
        return;
      }

      // Kullanıcıyı Bul
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
        alert('⚠️ Bu kullanıcı zaten bir şirkette.');
        setSendingEmail(false);
        return;
      }

      // Kod Üret ve Kaydet
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([{ code, organization_id: myOrg.id, email: inviteEmail }]);

      if (inviteError) throw inviteError;

      // Bildirim Gönder
      await supabase.from('notifications').insert([
        {
          user_id: targetUser.id,
          title: 'Şirket Daveti',
          message: `${myOrg.name} şirketi sizi ekibine katılmaya davet etti.`,
          type: 'invite',
          metadata: {
            org_id: myOrg.id,
            org_name: myOrg.name,
            invite_code: code,
          },
        },
      ]);

      alert(`✅ Davet Gönderildi!`);
      setInviteEmail('');
      fetchCompanyData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  // --- 2. MANUEL KOD ÜRETME ---
  const handleCreateCode = async () => {
    if (totalUsed >= maxLimit) return alert('Kapasite dolu!');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const { error } = await supabase
        .from('invitations')
        .insert([
          { code, organization_id: myOrg.id, email: null, is_used: false },
        ]);
      if (error) throw error;
      alert(`✅ Kod Oluşturuldu: ${code}`);
      fetchCompanyData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  // --- YARDIMCI FONKSİYONLAR ---
  const handleDeleteInvite = async (id: string) => {
    if (!window.confirm('İptal etmek istiyor musunuz?')) return;
    await supabase.from('invitations').delete().eq('id', id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Kopyalandı: ' + code);
  };

  const handleKick = async (id: string, role: string) => {
    if (role === 'premium_corporate') return alert('Yöneticiyi silemezsiniz.');
    if (window.confirm('Bu personeli şirketten çıkarmak istiyor musunuz?')) {
      await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'normal' })
        .eq('id', id);
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleToggleRole = async (member: any) => {
    if (!isCorporateAdmin) return;
    const confirmed = window.confirm(
      `"${member.full_name}" kullanıcısının rolünü değiştirmek istiyor musunuz?`
    );
    if (!confirmed) return;

    const newRole =
      member.role === 'corporate_staff' ? 'corporate_chief' : 'corporate_staff';
    const defaultPerms =
      newRole === 'corporate_chief'
        ? {
            can_invite: false,
            can_view_team_docs: false,
            can_edit_team_docs: false,
            can_delete_team_docs: false,
          }
        : {};

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, permissions: defaultPerms })
      .eq('id', member.id);
    if (error) return alert(error.message);

    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, role: newRole, permissions: defaultPerms }
          : m
      )
    );
  };

  const handleTogglePermission = async (member: any, permType: string) => {
    if (!isCorporateAdmin) return;
    const currentPerms = member.permissions || {};
    const newPerms = { ...currentPerms, [permType]: !currentPerms[permType] };
    await supabase
      .from('profiles')
      .update({ permissions: newPerms })
      .eq('id', member.id);
    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === member.id ? { ...m, permissions: newPerms } : m
      )
    );
  };

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (!myOrg)
    return (
      <div className="p-8 text-center text-gray-500">
        Herhangi bir şirkete bağlı değilsiniz.
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      {/* ÜST BİLGİ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building className="text-purple-600" /> {myOrg.name}
          </h1>
          <span className="text-sm text-gray-500">Yönetim Paneli</span>
        </div>
        <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-xl border">
          <div className="flex justify-between items-end mb-2">
            <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
              <PieChart size={14} /> Kota
            </div>
            <div className="text-xl font-black text-gray-800">
              {totalUsed}{' '}
              <span className="text-sm text-gray-400 font-medium">
                / {maxLimit}
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full ${
                isFull ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => {
            setActiveTab('team');
            setSearchParams({ tab: 'team' });
          }}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'team'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={16} /> Ekip Yönetimi
        </button>
        <button
          onClick={() => {
            setActiveTab('compliance');
            setSearchParams({ tab: 'compliance' });
          }}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'compliance'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield size={16} /> Mevzuatlarımız
        </button>
        <button
          onClick={() => {
            setActiveTab('requests');
            setSearchParams({ tab: 'requests' });
          }}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'requests'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock size={16} /> Gönderilen Mevzuat Talepleri
        </button>
        <button
          onClick={() => {
            setActiveTab('actions');
            setSearchParams({ tab: 'actions' });
          }}
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'actions'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle size={16} /> Aksiyon Takip
        </button>
      </div>

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* SOL: EKİP LİSTESİ */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Users size={20} /> Ekip ve Bekleyen Kodlar
            </h3>

            <div className="space-y-4">
              {/* Mevcut Üyeler */}
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-lg border bg-white flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          member.role === 'corporate_chief'
                            ? 'bg-blue-600'
                            : 'bg-gray-400'
                        }`}
                      >
                        {member.full_name?.charAt(0) || <User size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          {member.full_name}
                          {/* Türkçe Rol Etiketi */}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                              member.role === 'corporate_chief'
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {roleLabels[member.role] || member.role}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {/* Yönetici Butonları */}
                    {isCorporateAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleRole(member)}
                          className="text-xs bg-gray-100 px-2 py-1 rounded border hover:bg-gray-200 flex items-center gap-1 transition"
                          title="Rol Değiştir"
                        >
                          <UserCog size={12} /> Rol
                        </button>
                        <button
                          onClick={() => handleKick(member.id, member.role)}
                          className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition"
                          title="Çıkar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Şef Yetkileri */}
                  {isCorporateAdmin && member.role === 'corporate_chief' && (
                    <div className="mt-2 pt-2 border-t ml-12">
                      <span className="text-[10px] font-bold text-gray-400 block mb-1">
                        ŞEF YETKİLERİ
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          'can_invite',
                          'can_view_team_docs',
                          'can_edit_team_docs',
                          'can_delete_team_docs',
                        ].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleTogglePermission(member, p)}
                            className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition ${
                              member.permissions?.[p]
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-55 text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            {member.permissions?.[p] ? (
                              <CheckSquare size={10} />
                            ) : (
                              <Square size={10} />
                            )}{' '}
                            {permLabels[p] || p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Bekleyen Davetler */}
              {invitations.map((i) => (
                <div
                  key={i.id}
                  className="p-4 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50 flex justify-between items-center opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                      {i.email ? <Mail size={20} /> : <Ticket size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-purple-900 text-sm">
                        {i.email ? i.email : 'Manuel Kod'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-700 font-mono tracking-wider">
                          {i.code}
                        </span>
                        <span className="text-[10px] text-purple-500">
                          {i.email ? '(E-posta Daveti)' : '(Manuel Kod)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCode(i.code)}
                      className="p-2 bg-white rounded border hover:bg-gray-50 text-gray-500"
                      title="Kopyala"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteInvite(i.id)}
                      className="p-2 bg-white rounded border hover:bg-red-50 text-red-500"
                      title="İptal Et"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {teamMembers.length === 0 && invitations.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  Henüz ekip üyesi yok.
                </div>
              )}
            </div>
          </div>

          {/* SAĞ: DAVET OLUŞTURMA */}
          <div className="space-y-6">
            {canInvite ? (
              <>
                {/* E-POSTA DAVET KARTI (Geri Geldi) */}
                <div className="bg-white p-6 rounded-xl border shadow-sm border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <Mail size={18} /> E-Posta ile Davet
                  </h3>
                  <form onSubmit={handleSendEmailInvite} className="space-y-2">
                    <input
                      type="email"
                      required
                      placeholder="personel@sirket.com"
                      className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button
                      disabled={isFull || sendingEmail}
                      className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {sendingEmail ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      {sendingEmail ? 'Gönderiliyor...' : 'Davet Gönder'}
                    </button>
                  </form>
                </div>

                {/* MANUEL KOD KARTI */}
                <div className="bg-white p-6 rounded-xl border shadow-sm border-purple-100">
                  <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                    <Ticket size={18} /> Manuel Kod Üret
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Bu kodu personele verin. Personel "Ayarlar" sayfasından bu
                    kodu girerek giriş talebi oluşturacak.
                  </p>
                  <button
                    onClick={handleCreateCode}
                    disabled={isFull}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {isFull ? 'Kota Dolu' : 'Kod Oluştur'}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 p-6 rounded-xl border text-center text-gray-500 text-sm">
                <Shield size={32} className="mx-auto mb-2 opacity-30" />
                Personel davet etme yetkiniz bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
          <div className="border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Shield className="text-purple-600" /> Şirket Mevzuat ve Uyum Listesi
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {!isConsultant 
                  ? 'Danışmanlık firması tarafından şirketinize tanımlanan yasal mevzuatları ve yükümlülükleri takip edin.' 
                  : 'Sorumlusu olduğunuz firmalara atanan yasal mevzuatları ve yükümlülükleri takip edin.'}
              </p>
            </div>
            
            </div>

          {regsError && (
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-150 text-red-700 dark:text-red-400 text-xs">
              ⚠️ <b>Mevzuatlar yüklenirken hata oluştu:</b> {regsError}
              <br className="mt-1" />
              Lütfen veritabanı RLS (Row Level Security) politikalarını güncellediğinizden ve SQL kodlarını Supabase SQL Editöründe çalıştırdığınızdan emin olun.
            </div>
          )}

          <div className="space-y-6">
            {/* Üst Kısım: İşletmeler ve Yönetmelikler (Yan Yana) */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* 1. İşletmeler Listesi (Sadece Danışmanlar için) */}
              {isConsultant && (
                <div className="w-full md:w-80 shrink-0 md:border-r md:pr-6 space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">İşletmeler</span>
                  {assignedClients.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl bg-slate-50/50 text-xs px-2">
                      {myProfile?.role === 'premium_corporate' 
                        ? 'Sisteme kayıtlı firma bulunmuyor.' 
                        : 'Üstünüze atanan firma bulunmuyor.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {assignedClients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedClientId(c.id);
                            fetchRegulationsForClient(c.id);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition flex items-center gap-2.5 ${
                            selectedClientId === c.id
                              ? 'border-purple-500 bg-purple-50/40 text-purple-700 font-bold'
                              : 'border-slate-150 hover:bg-slate-50 bg-white text-slate-700'
                          }`}
                        >
                          <Building size={16} className={selectedClientId === c.id ? 'text-purple-600' : 'text-gray-400'} />
                          <span className="text-xs truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Mevzuat Talep Et Butonu */}
                  <button
                    onClick={() => {
                      setRequestClientId(clientRecId || '');
                      setShowRequestModal(true);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <PlusCircle size={14} /> Mevzuat Talep Et
                  </button>
                </div>
              )}

              {/* 2. Yönetmelikler Listesi */}
              <div className="flex-1 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">Yönetmelikler</span>
                
                {!clientRecId ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl bg-slate-50/50 text-xs">
                    Lütfen önce bir firma seçin.
                  </div>
                ) : loadingRegs ? (
                  <div className="flex justify-center items-center py-12 text-xs text-gray-500 gap-2">
                    <Loader className="animate-spin" size={14} /> Yükleniyor...
                  </div>
                ) : myRegulations.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl bg-slate-50/50 text-xs space-y-2">
                    <p>Bu firmaya tanımlı mevzuat bulunmuyor.</p>
                    {!isConsultant && (
                      <button
                        onClick={() => setShowRequestModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <PlusCircle size={10} /> Talep Et
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-1">
                    {myRegulations.map((reg) => (
                      <button
                        key={reg.id}
                        onClick={() => {
                          setSelectedReg(reg);
                          fetchRegulationArticles(reg);
                        }}
                        className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col justify-between gap-1.5 ${
                          selectedReg?.id === reg.id
                            ? 'border-purple-500 bg-purple-50/30'
                            : 'border-slate-150 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-purple-50 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-purple-100 uppercase">
                            {reg.parent?.category || 'Yönetmelik'}
                          </span>
                          <span className="font-bold text-xs text-slate-800 line-clamp-2">{reg.title}</span>
                        </div>
                        {reg.parent?.rg_no && (
                          <span className="text-[10px] text-gray-400 block mt-1">RG No: {reg.parent.rg_no}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Maddeler Detay Görünümü (Alt Kısım - Tam Genişlik) */}
            <div className="border-t pt-6 space-y-4">
              <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">Maddeler</span>
              
              {!selectedReg ? (
                <div className="text-center py-20 text-gray-400 border border-dashed rounded-xl bg-slate-50/30 text-xs">
                  <Shield size={32} className="mx-auto mb-2 opacity-30 text-purple-600" />
                  Maddelerini incelemek için yukarıdaki listeden bir mevzuat seçin.
                </div>
              ) : loadingArticles ? (
                <div className="flex justify-center items-center py-20 text-xs text-gray-500 gap-2">
                  <Loader className="animate-spin" size={16} /> Maddeler Yükleniyor...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-b pb-2 flex justify-between items-center flex-wrap gap-3 bg-white dark:bg-slate-850 p-1.5 rounded-xl border border-slate-150 dark:border-slate-800">
                    <div className="flex-1 min-w-[200px]">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{selectedReg.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Uygulanacak maddeleri ve uyum durumlarını yönetin.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Bulk request button shown only to managers */}
                       {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief') && (
                         <button
                           onClick={handleRequestSelectedArticleNotes}
                           className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
                         >
                           ⚠️ Seçilenler İçin Durum Talep Et ({selectedArticleIdsForRequest.length})
                         </button>
                       )}
                      
                      <select
                        value={articleFilter}
                        onChange={(e) => setArticleFilter(e.target.value)}
                        className="p-1.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 outline-none text-[11px] font-extrabold text-slate-700 dark:text-slate-300"
                      >
                        <option value="all">Filtrele: Tüm Maddeler</option>
                        <option value="missing_notes">Eksik Mevcut Durumlar</option>
                        <option value="requested">Talep Gelenler</option>
                        <option value="compliant">Uyum: Uygun</option>
                        <option value="non_compliant">Uyum: Uygun Değil</option>
                        <option value="exempt">Uyum: Hariç Tutulanlar</option>
                      </select>

                      {selectedReg.parent?.rg_no && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                          RG No: {selectedReg.parent.rg_no}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
                    {(() => {
                      const filtered = selectedRegArticles.filter((art) => {
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
                          <p className="text-center py-10 text-xs text-gray-400 italic bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-850">
                            Filtreye uygun madde bulunamadı.
                          </p>
                        );
                      }

                      return filtered.map((art) => (
                        <div
                          key={art.id}
                          className={`p-4 rounded-xl border transition shadow-sm bg-white ${getStatusStyles(art)}`}
                        >
                          <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                                  art.is_mandatory ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                                }`}>
                                  {art.is_mandatory ? 'Aktif' : 'Hariç Tutuldu'}
                                </span>
                                {art.is_mandatory && (
                                  art.compliance_status ? (
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                                      art.compliance_status === 'non_compliant'
                                        ? 'bg-red-50 text-red-700 border-red-100'
                                        : 'bg-green-50 text-green-700 border-green-100'
                                    }`}>
                                      {art.compliance_status === 'non_compliant' ? 'Uygun Değil' : 'Uygun'}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase bg-slate-100 text-slate-500 border-slate-200">
                                      Seçilmedi
                                    </span>
                                  )
                                )}
                                 {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief') && art.is_mandatory && !art.current_status_requested && (
                                   <input
                                     type="checkbox"
                                     checked={selectedArticleIdsForRequest.includes(art.id)}
                                     onChange={() => handleToggleArticleSelection(art.id)}
                                     className="mr-2 h-4 w-4 rounded border-gray-300 text-purple-650 focus:ring-purple-500 cursor-pointer"
                                   />
                                 )}
                                <span className="font-bold text-xs text-slate-800">{art.article_no} - {art.title}</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">{art.content}</p>
                              
                              {/* Last Updated By Info */}
                              {art.updater?.full_name && (
                                <div className="text-[10px] text-gray-400 mt-2 font-semibold">
                                  Son Güncelleyen: <b>{art.updater.full_name}</b>
                                </div>
                              )}

                              {/* Validity Date Info */}
                              {art.is_mandatory && (
                                <div className="text-[10px] text-gray-400 mt-1 font-semibold">
                                  Geçerlilik Süresi: <span className="font-extrabold text-purple-600 dark:text-purple-400">{art.expiry_date ? new Date(art.expiry_date).toLocaleDateString('tr-TR') : 'Süresiz'}</span>
                                </div>
                              )}

                              {/* Requested Status Badge */}
                              {art.current_status_requested && (
                                <div className="mt-2 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200 w-fit">
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
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
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

                          {/* Mevcut Durum Notu (Current Status Note) Section */}
                          {art.is_mandatory && (
                            <div className="pt-3 mt-3 border-t border-gray-100 dark:border-slate-800 space-y-2">
                              {editingNotesArtId === art.id ? (
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Mevcut Durum Girişi</label>
                                  <textarea
                                    rows={2}
                                    value={tempNotesVal}
                                    onChange={(e) => setTempNotesVal(e.target.value)}
                                    placeholder="Bu madde için mevcut durumu/açıklamayı yazın..."
                                    className="w-full p-2.5 border rounded-lg text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-purple-500"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => handleSaveArticleNotes(art.id)}
                                      className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition"
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
                                <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
                                  <div className="flex-1 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                                    <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Mevcut Durum</div>
                                    <p className="text-slate-700 dark:text-slate-350 mt-0.5 whitespace-pre-wrap leading-relaxed">
                                      {art.current_status_notes || <span className="italic text-gray-400">Durum girilmemiş</span>}
                                    </p>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingNotesArtId(art.id);
                                        setTempNotesVal(art.current_status_notes || '');
                                      }}
                                      className="text-[10px] font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-purple-200 px-2.5 py-1 rounded transition"
                                    >
                                      Düzenle
                                    </button>
                                    {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief') && (
                                      <>
                                        {!art.current_status_requested && (
                                          <button
                                            onClick={() => handleRequestArticleNotes(art.id)}
                                            className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-amber-200 px-2.5 py-1 rounded transition"
                                            title="Evrak veya Mevcut Durum Talep Et"
                                          >
                                            Mevcut Durum Talep Et
                                          </button>
                                        )}
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
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* MEVZUAT TALEP ETME MODALİ */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <PlusCircle className="text-purple-600" /> Mevzuat Talep Et
              </h3>
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestTitle('');
                  setRequestDescription('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              {isConsultant && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 block">Talep Yapılacak Firma</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2.5 text-sm bg-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    value={requestClientId}
                    onChange={(e) => setRequestClientId(e.target.value)}
                  >
                    <option value="" disabled>-- Firma Seçin --</option>
                    {assignedClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">Mevzuat Adı / Konusu</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Endüstriyel Hava Kirliliği Kontrolü Yönetmeliği"
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">Talep Açıklaması / Notlar</label>
                <textarea
                  required
                  placeholder="Bu mevzuatın firmamız için neden tanımlanmasını istediğinize dair detay yazabilirsiniz."
                  rows={4}
                  className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition resize-none"
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submittingRequest}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingRequest ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  'Talebi İlet'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. SEKME: AKSİYON TAKİP SİSTEMİ */}
      {activeTab === 'requests' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-6">
          <div className="border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                <Clock className="text-purple-650" size={16} /> Gönderilen Mevzuat Talepleri
              </h3>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400 font-medium">
                Danışman firmanızdan talep ettiğiniz veya şirket içi personelin talep ettiği mevzuatları görüntüleyin.
              </p>
            </div>
            {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief' || myProfile?.role === 'corporate_staff') && (
              <button
                onClick={() => {
                  setRequestClientId(isConsultant ? '' : (clientRecId || ''));
                  setShowRequestModal(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md"
              >
                <PlusCircle size={16} /> Yeni Mevzuat Talep Et
              </button>
            )}
          </div>

          {myRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-450 italic bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
              Henüz gönderilmiş bir mevzuat talebi bulunmuyor.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/10 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{req.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      req.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                        : req.status === 'approved'
                        ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900'
                        : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900'
                    }`}
                    >
                      {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                    </span>
                  </div>
                  {req.description && (
                    <p className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{req.description}</p>
                  )}
                  <div className="text-[10px] text-gray-450 dark:text-gray-500 flex justify-between items-center pt-1.5 border-t dark:border-slate-800">
                    <span>Talep Eden: <b>{req.requested_by_profile?.full_name || 'Bilinmiyor'}</b></span>
                    <span>{new Date(req.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                  {req.admin_notes && (
                    <div className="mt-2 p-2 bg-white dark:bg-slate-900 rounded border dark:border-slate-800 text-gray-650 dark:text-gray-400 text-[10px]">
                      <b>Not:</b> {req.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & New Action Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm animate-fadeIn">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg flex items-center gap-2">
                <CheckCircle className="text-purple-600" />
                Aksiyon Takip Sistemi
              </h3>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                Atanan aksiyonları takip edin, yeni aksiyonlar tanımlayın ve ilerlemeyi yönetin.
              </p>
            </div>
            <button
              onClick={() => {
                setNewActionTitle('');
                setNewActionDesc('');
                setNewActionClientId(isConsultant ? '' : (clientRecId || ''));
                setNewActionAssigneeId(myProfile?.id || '');
                setNewActionDueDate('');
                setShowCreateActionModal(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md"
            >
              <PlusCircle size={16} /> Yeni Aksiyon Oluştur
            </button>
          </div>

          {/* Filtreler */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-center animate-fadeIn">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Filtrele</span>
            
            {isConsultant && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold">Firma:</label>
                <select
                  value={actionsFilterClient}
                  onChange={(e) => setActionsFilterClient(e.target.value)}
                  className="p-1.5 border rounded-lg text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-slate-700 dark:text-slate-300 font-bold"
                >
                  <option value="">Tüm Firmalar</option>
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-semibold">Durum:</label>
              <select
                value={actionsFilterStatus}
                onChange={(e) => setActionsFilterStatus(e.target.value)}
                className="p-1.5 border rounded-lg text-xs bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 outline-none text-slate-700 dark:text-slate-300 font-bold"
              >
                <option value="">Tüm Durumlar</option>
                <option value="pending">Bekliyor</option>
                <option value="completed">Onay Bekliyor</option>
                <option value="correction_requested">Düzeltme İstendi</option>
                <option value="approved">Onaylandı</option>
              </select>
            </div>
          </div>

          {/* Aksiyon Listesi Grid */}
          {loadingActions ? (
            <div className="flex justify-center items-center py-20 text-xs text-gray-500 gap-2">
              <Loader className="animate-spin" size={16} /> Aksiyonlar Yükleniyor...
            </div>
          ) : (
            (() => {
              const filtered = complianceActions.filter(act => {
                if (actionsFilterClient && act.client_id !== actionsFilterClient) return false;
                if (actionsFilterStatus && act.status !== actionsFilterStatus) return false;
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-20 bg-white dark:bg-slate-800 border border-dashed rounded-xl text-xs text-gray-400 italic space-y-2 animate-fadeIn">
                    <CheckCircle size={32} className="mx-auto mb-2 opacity-25 text-purple-600" />
                    Kayıtlı veya filtreye uyan aksiyon bulunamadı.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {filtered.map(act => {
                    const isAssignee = act.assigned_to === myProfile?.id;
                    const isManager = myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief';
                    const isCreator = act.created_by === myProfile?.id;
                    
                    const targetDate = new Date(act.due_date);
                    const now = new Date();
                    targetDate.setHours(0,0,0,0);
                    now.setHours(0,0,0,0);
                    const diffTime = targetDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let daysBadgeColor = "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400";
                    if (act.status !== 'approved') {
                      if (diffDays < 0) {
                        daysBadgeColor = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 animate-pulse";
                      } else if (diffDays <= 3) {
                        daysBadgeColor = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400";
                      } else if (diffDays <= 7) {
                        daysBadgeColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400";
                      }
                    }

                    return (
                      <div
                        key={act.id}
                        className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-150 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold uppercase tracking-wider block">
                              {act.client?.name || 'Genel'}
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                              act.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                                : act.status === 'completed'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400'
                                : act.status === 'correction_requested'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400'
                                : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400'
                            }`}>
                              {act.status === 'pending' ? 'Bekliyor' :
                               act.status === 'completed' ? 'Onay Bekliyor' :
                               act.status === 'correction_requested' ? 'Düzeltme İstendi' : 'Onaylandı'}
                            </span>
                          </div>

                          <h4 className="font-bold text-gray-800 dark:text-gray-250 text-sm">{act.title}</h4>
                          
                          {act.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                              {act.description}
                            </p>
                          )}

                          {/* Personel Notu / Kanıt Gösterimi */}
                          {act.notes && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs">
                              <span className="font-extrabold text-[9px] text-slate-400 uppercase tracking-wide">Personel Açıklaması:</span>
                              <p className="text-slate-700 dark:text-slate-350 mt-0.5">{act.notes}</p>
                              {act.evidence_url && (
                                <a
                                  href={act.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-600 dark:text-teal-400 font-bold hover:underline block mt-1.5"
                                >
                                  Ekli Belgeyi Aç ↗
                                </a>
                              )}
                            </div>
                          )}

                          {/* Düzeltme Yorumu Gösterimi */}
                          {act.status === 'correction_requested' && act.manager_comment && (
                            <div className="bg-rose-50/50 dark:bg-rose-950/10 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-350 animate-fadeIn">
                              <span className="font-bold text-[9px] uppercase tracking-wide block">Düzeltme Talebi Gerekçesi:</span>
                              <p className="italic">{act.manager_comment}</p>
                            </div>
                          )}

                          <div className="text-[10px] text-gray-400 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <div>Sorumlu: <b>{act.assignee?.full_name || 'Atanmamış'}</b></div>
                            <div>Oluşturan: <b>{act.creator?.full_name || 'Bilinmeyen'}</b></div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center flex-wrap gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${daysBadgeColor}`}>
                            {act.status === 'approved' ? 'Tamamlandı' : 
                             diffDays < 0 ? `Süresi Geçti (${Math.abs(diffDays)} Gün)` :
                             diffDays === 0 ? 'Bugün Son Gün!' : `${diffDays} Gün Kaldı`}
                          </span>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedActionDetails(act);
                                setShowDetailsModal(true);
                              }}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl transition hover:bg-slate-50 dark:hover:bg-slate-800"
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
                                className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-sm"
                              >
                                Tamamla
                              </button>
                            )}

                            {act.status === 'completed' && (isManager || isCreator) && (
                              <>
                                <button
                                  onClick={() => handleApproveAction(act)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-sm"
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
                                  className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition"
                                >
                                  Düzeltme İste
                                </button>
                              </>
                            )}

                            {(isManager || isCreator) && (
                              <button
                                onClick={() => handleDeleteAction(act.id, act.article_id)}
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                title="Aksiyonu Sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}

                  {/* --- YENİ: ZORUNLU AÇIKLAMA GİRİŞ MODALI --- */}
      {showComplianceNoteModal && complianceNoteData && (() => {
        const type = complianceNoteData.type;
        
        let themeColor = 'purple';
        let statusText = '';
        let inputLabel = '';
        let placeholderText = '';
        let gradientHeader = 'from-purple-500 to-indigo-600';
        let alertBg = 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30';
        let alertText = 'text-purple-700 dark:text-purple-400';
        let accentRing = 'focus:ring-purple-500 focus:border-purple-500';
        let submitBtnBg = 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20';

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
          gradientHeader = 'from-purple-500 to-indigo-600';
          alertBg = 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30';
          alertText = 'text-purple-700 dark:text-purple-400';
          accentRing = 'focus:ring-purple-500 focus:border-purple-500';
          submitBtnBg = 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20';
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
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${alertText} ${alertBg.replace('border-', 'border-').replace('/50', '/95')}`}>
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
                          className="rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700"
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

      {/* --- YENİ: DÜZ AKSİYON OLUŞTURMA MODALI --- */}
      {showCreateActionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-lg">
                <PlusCircle size={18} className="text-purple-600" />
                Yeni Aksiyon Oluştur
              </h3>
              <button 
                onClick={closeCreateActionModal}
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
                  placeholder="Aksiyon başlığını girin..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-sm text-slate-700 dark:text-slate-350 border-slate-200"
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Detaylar</label>
                <textarea
                  rows={3}
                  placeholder="Aksiyon detaylarını buraya yazın..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-medium text-xs text-slate-700 dark:text-slate-350 border-slate-200"
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                />
              </div>

              {isConsultant && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">İlgili Firma *</label>
                  <select
                    required
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-sm text-slate-700 dark:text-slate-350 border-slate-200"
                    value={newActionClientId}
                    onChange={(e) => setNewActionClientId(e.target.value)}
                  >
                    <option value="">-- Firma Seçin --</option>
                    {assignedClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Sorumlu Personel *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-sm text-slate-700 dark:text-slate-350 border-slate-200"
                  value={newActionAssigneeId}
                  onChange={(e) => setNewActionAssigneeId(e.target.value)}
                  disabled={myProfile?.role === 'corporate_staff'}
                >
                  {myProfile?.role === 'corporate_staff' ? (
                    <option value={myProfile.id}>
                      {myProfile.full_name} ({myProfile.email})
                    </option>
                  ) : (
                    <>
                      <option value="">-- Personel Seçin --</option>
                      <option value={myProfile?.id}>
                        {myProfile?.full_name} (Kendime Atayım)
                      </option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </option>
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
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-sm text-slate-700 dark:text-slate-350 border-slate-200"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={closeCreateActionModal}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition text-gray-700 dark:text-gray-300"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateAction}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition"
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
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-lg">
                <CheckCircle size={18} className="text-purple-600" />
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
              <div className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="text-slate-400 uppercase tracking-wide">Aksiyon:</div>
                <div className="font-bold text-slate-850 dark:text-slate-200 text-sm mt-0.5">{selectedClientAction.title}</div>
                {selectedClientAction.description && (
                  <div className="mt-1.5 text-gray-500">{selectedClientAction.description}</div>
                )}
              </div>

              {/* Düzeltme Talebi Yorumu */}
              {selectedClientAction.status === 'correction_requested' && selectedClientAction.manager_comment && (
                <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs">
                  <div className="font-bold text-[9px] text-rose-800 dark:text-rose-450 uppercase tracking-wide">Düzeltme Talebi Gerekçesi:</div>
                  <p className="text-rose-800 dark:text-rose-350 italic mt-0.5">{selectedClientAction.manager_comment}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Mevcut Durum / Açıklama *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Yapılan işlemler, firmanın güncel durumu ve açıklamalarınızı detaylıca yazın..."
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-medium text-xs text-slate-700 dark:text-slate-350 border-slate-200"
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
                    className={`py-1.5 px-3 font-semibold transition border-b-2 ${evidenceMode === 'upload' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                  >
                    Yeni Belge Yükle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceMode('select');
                      if (myProfile?.id) fetchUserDocuments(myProfile.id);
                    }}
                    className={`py-1.5 px-3 font-semibold transition border-b-2 ${evidenceMode === 'select' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400'}`}
                  >
                    Evraklarımdan Seç
                  </button>
                </div>

                {evidenceMode === 'upload' ? (
                  <input
                    type="file"
                    onChange={(e) => setActionEvidenceFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                  />
                ) : (
                  <select
                    className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-xs text-slate-700 dark:text-slate-350 border-slate-200"
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {uploadingEvidence ? 'Dosya Yükleniyor...' : 'Aksiyonu Kapatma Talebi Gönder'}
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
                <AlertCircle size={18} className="text-rose-500" />
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
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-rose-500 font-medium text-xs text-slate-700 dark:text-slate-350 border-slate-200"
                  value={correctionComment}
                  onChange={(e) => setCorrectionComment(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Yeni Son Tarih *</label>
                <input
                  type="date"
                  required
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-rose-500 font-bold text-sm text-slate-700 dark:text-slate-350 border-slate-200"
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

      {/* --- YENİ: AKSİYON DETAY MODALI --- */}
      {showDetailsModal && selectedActionDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-100 dark:border-slate-700 animate-scaleIn">
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-lg">
                <CheckCircle size={18} className="text-purple-600" />
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
                  <div className="text-xs text-slate-700 dark:text-slate-330 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 whitespace-pre-wrap leading-relaxed mt-1">
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
                    <p className="text-xs text-slate-700 dark:text-slate-350 whitespace-pre-wrap">{selectedActionDetails.notes}</p>
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
    </div>
  );
}
