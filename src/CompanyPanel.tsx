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
  X,
  MapPin,
  Edit2,
  QrCode,
  Eye,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import { WASTE_CODES, RECOVERY_CODES, DISPOSAL_CODES } from './wasteCodes';
import { MapPickerModal } from './MapPickerModal';
import InspectionAnalytics from './InspectionAnalytics';
import WasteManagement from './WasteManagement';

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
  const [activeTab, setActiveTab] = useState<'team' | 'compliance' | 'requests' | 'actions' | 'waste' | 'inspections'>(initialTab as any);

  // --- ATIK YÖNETİMİ STATE'LERİ ---
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);
  const [loadingWaste, setLoadingWaste] = useState(false);
  const [isWasteTableMissing, setIsWasteTableMissing] = useState(false);
  const [showAddWasteModal, setShowAddWasteModal] = useState(false);
  const [newWasteClientId, setNewWasteClientId] = useState('');
  const [newWasteCode, setNewWasteCode] = useState('');
  const [newWasteExitDate, setNewWasteExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [newWasteQuantity, setNewWasteQuantity] = useState('');

  // New relational selections
  const [wasteCompanies, setWasteCompanies] = useState<any[]>([]);
  const [newWasteTransporterId, setNewWasteTransporterId] = useState('');
  const [newWasteDestinationId, setNewWasteDestinationId] = useState('');
  const [newWasteDisposalCode, setNewWasteDisposalCode] = useState('');

  // Legacy text variables kept for backwards compatibility / local usage
  const [newWasteTransporter, setNewWasteTransporter] = useState('');
  const [newWasteTransporterAddress, setNewWasteTransporterAddress] = useState('');
  const [newWasteDestination, setNewWasteDestination] = useState('');
  const [newWasteDestinationAddress, setNewWasteDestinationAddress] = useState('');

  // Modals for adding transporter / destination
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyType, setNewCompanyType] = useState<'transporter' | 'destination'>('transporter');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyLat, setNewCompanyLat] = useState<number | null>(null);
  const [newCompanyLng, setNewCompanyLng] = useState<number | null>(null);
  const [submittingCompany, setSubmittingCompany] = useState(false);
  const [showCompanyMap, setShowCompanyMap] = useState(false);

  const [newWasteDisposalType, setNewWasteDisposalType] = useState('recovery');
  const [newWasteDescription, setNewWasteDescription] = useState('');
  const [submittingWaste, setSubmittingWaste] = useState(false);
  const [wasteFilterClient, setWasteFilterClient] = useState('');
  const [wasteSearchQuery, setWasteSearchQuery] = useState('');

  // Edit waste record states
  const [showEditWasteModal, setShowEditWasteModal] = useState(false);
  const [editingWasteId, setEditingWasteId] = useState('');
  const [editWasteClientId, setEditWasteClientId] = useState('');
  const [editWasteCode, setEditWasteCode] = useState('');
  const [editWasteExitDate, setEditWasteExitDate] = useState('');
  const [editWasteQuantity, setEditWasteQuantity] = useState('');
  const [editWasteTransporterId, setEditWasteTransporterId] = useState('');
  const [editWasteDestinationId, setEditWasteDestinationId] = useState('');
  const [editWasteDisposalType, setEditWasteDisposalType] = useState('recovery');
  const [editWasteDisposalCode, setEditWasteDisposalCode] = useState('');
  const [editWasteDescription, setEditWasteDescription] = useState('');
  const [updatingWaste, setUpdatingWaste] = useState(false);

  // Waste report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportClientId, setSelectedReportClientId] = useState('');
  const [reportPeriodType, setReportPeriodType] = useState<'all' | 'monthly' | 'yearly'>('all');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [generatingReport, setGeneratingReport] = useState(false);

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
  const [actionsFilterStatus, setActionsFilterStatus] = useState('');
  const [actionsSubTab, setActionsSubTab] = useState<'pending' | 'completed'>('pending');
  
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
  const [selectedArticleIdsForRequest, setSelectedArticleIdsForRequest] = useState<string[]>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [selectedEvidenceDocUrl, setSelectedEvidenceDocUrl] = useState<string>('');
  const [evidenceMode, setEvidenceMode] = useState<'upload' | 'select'>('upload');
  const [selectedEvidenceLocation, setSelectedEvidenceLocation] = useState<string>('');
  const [requestsFilterClient, setRequestsFilterClient] = useState<string>('');
  const [reqNotesArticleId, setReqNotesArticleId] = useState<string>('');
  const [selectedArticleIdsForAction, setSelectedArticleIdsForAction] = useState<string[]>([]);
  const [pendingActionArticleIds, setPendingActionArticleIds] = useState<string[]>([]);

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

  // Change requests states (Ünvan/Adres Değişiklik Talepleri)
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [loadingChangeRequests, setLoadingChangeRequests] = useState(false);
  const [resolvingChangeRequestId, setResolvingChangeRequestId] = useState<string | null>(null);
  const [showChangeRejectionModal, setShowChangeRejectionModal] = useState(false);
  const [changeRejectionReason, setChangeRejectionReason] = useState('');
  const [selectedChangeRequestForRejection, setSelectedChangeRequestForRejection] = useState<any | null>(null);
  const [requestsSubTab, setRequestsSubTab] = useState<'regulation' | 'change'>('regulation');

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

          const { data: members } = await query;
          const sortedMembers = (members || []).sort((a, b) => {
            if (a.role === 'premium_corporate' && b.role !== 'premium_corporate') return -1;
            if (a.role !== 'premium_corporate' && b.role === 'premium_corporate') return 1;
            return 0;
          });
          setTeamMembers(sortedMembers);

          // 2. BEKLEYEN DAVETLER
          const { data: invites } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('is_used', false)
            .order('created_at', { ascending: false });
          setInvitations(invites || []);

          // 3. ATANAN FİRMALARI YÜKLE
          const isConsultantUser = !!orgData?.is_environmental_consultant || 
            ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(profile.role);
          if (isConsultantUser) {
            let clientsList: any[] = [];
            const canViewAll = profile.role === 'premium_corporate' || !!profile.permissions?.can_view_all_clients;
            if (canViewAll) {
              const { data } = await supabase
                .from('consultant_clients')
                .select('id, name')
                .eq('consultant_company_id', orgData.id);
              clientsList = data || [];
            } else {
              const { data } = await supabase
                .from('consultant_assignments')
                .select('client_id, client:consultant_clients(id, name)')
                .eq('user_id', profile.id);
              clientsList = data?.map((a: any) => a.client).filter(Boolean) || [];
            }
            setAssignedClients(clientsList);
          } else {
            // Normal client company: find matching client record in consultant_clients
            const { data: ccList } = await supabase
              .from('consultant_clients')
              .select('id, name');
            
            let clientRec = null;
            if (ccList && ccList.length > 0) {
              const cleanOrgName = orgData.name.trim().toLowerCase();
              clientRec = ccList.find((c: any) => {
                const cleanClientName = c.name.trim().toLowerCase();
                return cleanClientName.includes(cleanOrgName) || cleanOrgName.includes(cleanClientName);
              });
              if (!clientRec) {
                clientRec = ccList[0];
              }
            }
            if (clientRec) {
              setAssignedClients([clientRec]);
            }
          }
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

  const fetchChangeRequests = async (clientId: string) => {
    if (!clientId) return;
    setLoadingChangeRequests(true);
    try {
      const { data, error } = await supabase
        .from('client_change_requests')
        .select('*, requester:requested_by(full_name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChangeRequests(data || []);
    } catch (err: any) {
      console.error('Değişiklik talepleri alınamadı:', err.message);
    } finally {
      setLoadingChangeRequests(false);
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
          resolved_by: myProfile?.id || null
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
      }

      alert('Değişiklik talebi başarıyla onaylandı ve firma bilgileri güncellendi.');
      if (clientRecId) {
        fetchChangeRequests(clientRecId);
      }
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
          resolved_by: myProfile?.id || null
        })
        .eq('id', selectedChangeRequestForRejection.id);

      if (error) throw error;
      alert('Talep reddedildi.');
      setShowChangeRejectionModal(false);
      setSelectedChangeRequestForRejection(null);
      setChangeRejectionReason('');
      if (clientRecId) {
        fetchChangeRequests(clientRecId);
      }
    } catch (err: any) {
      alert('Hata oluştu: ' + err.message);
    } finally {
      setResolvingChangeRequestId(null);
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
      // Admin'e talep gönderme kaldırıldı: personel/şef her zaman firma yöneticisinden (owner) talep eder.
      const reqType = 'staff_to_owner';

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
      await fetchChangeRequests(clientId);
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
          .eq('client_regulation_id', reg.id)
          .order('order_index', { ascending: true });

        if (!updatedError && updatedData) {
          setSelectedRegArticles(updatedData);
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
          setSelectedRegArticles(mappedData);
        }
      } else {
        setSelectedRegArticles(data || []);
      }
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

  const handleUpdateArticleCompliance = (artId: string, status: 'compliant' | 'non_compliant') => {
    const art = selectedRegArticles.find(a => a.id === artId);
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
      return 'border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-900/70 opacity-70';
    }

    const nowStr = new Date().toISOString().split('T')[0];
    const isExpired = art.expiry_date && art.expiry_date < nowStr;

    if (art.compliance_status === 'compliant') {
      if (isExpired) {
        return 'border-rose-500 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-350 animate-compliance-blink';
      }
      return 'border-emerald-500 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-350';
    }
    if (art.compliance_status === 'non_compliant') {
      if (isExpired) {
        return 'border-rose-500 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-350 animate-compliance-blink';
      }
      return 'border-rose-500 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-350';
    }
    return 'border-amber-300 dark:border-amber-500/50 bg-white dark:bg-slate-800';
  };

  const isNearExpiry = (expiryDateStr: string | null) => {
    if (!expiryDateStr) return false;
    const diffDays = (new Date(expiryDateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  const fetchUserDocuments = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, file_url, location_def_id, location_def:user_definitions!location_def_id(id, label)')
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
      fetchChangeRequests(clientRecId);
    }
  }, [activeTab, clientRecId]);

  const handleToggleArticleSelection = (artId: string) => {
    setSelectedArticleIdsForRequest(prev =>
      prev.includes(artId) ? prev.filter(id => id !== artId) : [...prev, artId]
    );
  };

  const handleToggleArticleForAction = (artId: string) => {
    setSelectedArticleIdsForAction(prev =>
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
    if (activeTab === 'waste') {
      fetchWasteRecords();
      fetchWasteCompanies();
    }
    if (activeTab === 'inspections') {
      fetchInspections();
    }
  }, [activeTab, myOrg, myProfile, assignedClients]);

  // Navbar rozeti için: org yüklenir yüklenmez aksiyonları ve "son görülme" zamanını çek
  useEffect(() => {
    if (myOrg) {
      fetchComplianceActions();
    }
  }, [myOrg]);

  useEffect(() => {
    if (!myProfile?.id) return;
    const stored = localStorage.getItem(`evraklab_actions_seen_${myProfile.id}`);
    setActionsLastSeen(stored ? parseInt(stored, 10) : 0);
  }, [myProfile?.id]);

  useEffect(() => {
    if (activeTab === 'actions' && myProfile?.id) {
      const now = Date.now();
      localStorage.setItem(`evraklab_actions_seen_${myProfile.id}`, String(now));
      setActionsLastSeen(now);
    }
  }, [activeTab, myProfile?.id]);

  const newActionsCount = complianceActions.filter((a) => {
    const createdMs = a.created_at ? new Date(a.created_at).getTime() : 0;
    return createdMs > actionsLastSeen;
  }).length;

  // --- ATIK YÖNETİMİ METOTLARI ---
  const fetchWasteCompanies = async () => {
    if (!myOrg) return;
    try {
      const { data, error } = await supabase
        .from('waste_companies')
        .select('*')
        .eq('organization_id', myOrg.id)
        .order('name', { ascending: true });
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "public.waste_companies" does not exist')) {
          console.warn('public.waste_companies table missing');
          setWasteCompanies([]);
        } else {
          throw error;
        }
      } else {
        setWasteCompanies(data || []);
      }
    } catch (err: any) {
      console.error('Atık firmaları yüklenirken hata:', err.message);
    }
  };

  const fetchWasteRecords = async () => {
    if (!myOrg) return;
    setLoadingWaste(true);
    setIsWasteTableMissing(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let query = supabase
        .from('waste_records')
        .select(`
          *,
          client:consultant_clients(id, name),
          creator:profiles!created_by(full_name),
          transporter_company:waste_companies!transporter_id(id, name, address, latitude, longitude),
          destination_company:waste_companies!destination_id(id, name, address, latitude, longitude)
        `);

      const isManager = myProfile?.role === 'premium_corporate' || myProfile?.role === 'admin' || myProfile?.role === 'system_admin';

      if (!isManager) {
        // Only show records for assigned clients
        const clientIds = assignedClients.map(c => c.id);
        query = query.or(`created_by.eq.${session.user.id},client_id.in.(${clientIds.length > 0 ? clientIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);
      }

      const { data, error } = await query.order('exit_date', { ascending: false });
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "public.waste_records" does not exist')) {
          console.warn('public.waste_records table missing');
          setIsWasteTableMissing(true);
          setWasteRecords([]);
        } else {
          throw error;
        }
      } else {
        setWasteRecords(data || []);
      }
    } catch (err: any) {
      console.error('Atık kayıtları yüklenirken hata:', err.message);
    } finally {
      setLoadingWaste(false);
    }
  };

  const handleCreateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWasteClientId || !newWasteCode || !newWasteExitDate || !newWasteQuantity || !newWasteTransporterId || !newWasteDestinationId || !newWasteDisposalType || !newWasteDisposalCode) {
      return alert('Lütfen tüm zorunlu alanları doldurun (Açıklama hariç tüm alanlar zorunludur).');
    }

    setSubmittingWaste(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const qty = parseFloat(newWasteQuantity);
      if (isNaN(qty) || qty <= 0) {
        return alert('Atık miktarı 0\'dan büyük bir sayı olmalıdır.');
      }

      const selectedTransporter = wasteCompanies.find(c => c.id === newWasteTransporterId);
      const selectedDestination = wasteCompanies.find(c => c.id === newWasteDestinationId);

      const { error } = await supabase
        .from('waste_records')
        .insert([{
          client_id: newWasteClientId,
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
          created_by: session.user.id
        }]);

      if (error) throw error;

      alert('Atık kaydı başarıyla eklendi!');
      setShowAddWasteModal(false);
      // Reset form
      setNewWasteClientId('');
      setNewWasteCode('');
      setNewWasteExitDate(new Date().toISOString().split('T')[0]);
      setNewWasteQuantity('');
      setNewWasteTransporterId('');
      setNewWasteDestinationId('');
      setNewWasteDisposalCode('');
      setNewWasteTransporter('');
      setNewWasteTransporterAddress('');
      setNewWasteDestination('');
      setNewWasteDestinationAddress('');
      setNewWasteDisposalType('recovery');
      setNewWasteDescription('');
      
      await fetchWasteRecords();
    } catch (err: any) {
      alert('Atık kaydı eklenirken hata: ' + err.message);
    } finally {
      setSubmittingWaste(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      return alert('Lütfen firma adını girin.');
    }

    setSubmittingCompany(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('waste_companies')
        .insert([{
          organization_id: myOrg.id,
          name: newCompanyName.trim(),
          type: newCompanyType,
          address: newCompanyAddress.trim() || null,
          latitude: newCompanyLat,
          longitude: newCompanyLng,
          created_by: session.user.id
        }]);

      if (error) throw error;

      alert(`${newCompanyType === 'transporter' ? 'Taşıyıcı' : 'Gönderilen'} firma başarıyla kaydedildi!`);
      setShowAddCompanyModal(false);
      // Reset form
      setNewCompanyName('');
      setNewCompanyAddress('');
      setNewCompanyLat(null);
      setNewCompanyLng(null);

      // Refresh list
      await fetchWasteCompanies();
    } catch (err: any) {
      alert('Firma eklenirken hata: ' + err.message);
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleDeleteWaste = async (id: string) => {
    if (!window.confirm('Bu atık kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('waste_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Atık kaydı silindi.');
      await fetchWasteRecords();
    } catch (err: any) {
      alert('Kayıt silinirken hata: ' + err.message);
    }
  };

  const handleOpenEditWasteModal = (rec: any) => {
    setEditingWasteId(rec.id);
    setEditWasteClientId(rec.client_id || '');
    setEditWasteCode(rec.waste_code || '');
    setEditWasteExitDate(rec.exit_date || '');
    setEditWasteQuantity(String(rec.quantity_kg) || '');
    setEditWasteTransporterId(rec.transporter_id || '');
    setEditWasteDestinationId(rec.destination_id || '');
    setEditWasteDisposalType(rec.disposal_type || 'recovery');
    setEditWasteDisposalCode(rec.disposal_code || '');
    setEditWasteDescription(rec.description || '');
    setShowEditWasteModal(true);
  };

  const handleUpdateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWasteClientId || !editWasteCode || !editWasteExitDate || !editWasteQuantity || !editWasteTransporterId || !editWasteDestinationId || !editWasteDisposalType || !editWasteDisposalCode) {
      return alert('Lütfen zorunlu alanları doldurun (Açıklama hariç tüm alanlar zorunludur).');
    }

    setUpdatingWaste(true);
    try {
      const qty = parseFloat(editWasteQuantity);
      if (isNaN(qty) || qty <= 0) {
        return alert('Atık miktarı 0\'dan büyük bir sayı olmalıdır.');
      }

      const selectedTransporter = wasteCompanies.find(c => c.id === editWasteTransporterId);
      const selectedDestination = wasteCompanies.find(c => c.id === editWasteDestinationId);

      const { error } = await supabase
        .from('waste_records')
        .update({
          client_id: editWasteClientId,
          waste_code: editWasteCode,
          exit_date: editWasteExitDate,
          quantity_kg: qty,
          transporter_id: editWasteTransporterId || null,
          destination_id: editWasteDestinationId || null,
          transporter: selectedTransporter?.name || null,
          transporter_address: selectedTransporter?.address || null,
          destination: selectedDestination?.name || null,
          destination_address: selectedDestination?.address || null,
          disposal_type: editWasteDisposalType,
          disposal_code: editWasteDisposalCode || null,
          description: editWasteDescription.trim() || null,
        })
        .eq('id', editingWasteId);

      if (error) throw error;

      alert('Atık kaydı başarıyla güncellendi!');
      setShowEditWasteModal(false);
      await fetchWasteRecords();
    } catch (err: any) {
      alert('Atık kaydı güncellenirken hata: ' + err.message);
    } finally {
      setUpdatingWaste(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedReportClientId) {
      return alert('Lütfen raporu oluşturulacak firmayı seçin.');
    }

    setGeneratingReport(true);
    try {
      // 1. Fetch Client Details
      const { data: clientDetails, error: clientErr } = await supabase
        .from('consultant_clients')
        .select('*')
        .eq('id', selectedReportClientId)
        .single();

      if (clientErr || !clientDetails) {
        throw new Error(clientErr?.message || 'Firma bilgileri bulunamadı.');
      }

      // 2. Fetch Waste Records
      let query = supabase
        .from('waste_records')
        .select(`
          *,
          transporter_company:waste_companies!transporter_id(id, name, address, latitude, longitude),
          destination_company:waste_companies!destination_id(id, name, address, latitude, longitude)
        `)
        .eq('client_id', selectedReportClientId);

      let periodLabel = 'Tüm Zamanlar (Genel)';
      if (reportPeriodType === 'monthly') {
        const [year, month] = reportMonth.split('-');
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const start = `${reportMonth}-01`;
        const end = `${reportMonth}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('exit_date', start).lte('exit_date', end);
        periodLabel = `${month}/${year} (Aylık)`;
      } else if (reportPeriodType === 'yearly') {
        const start = `${reportYear}-01-01`;
        const end = `${reportYear}-12-31`;
        query = query.gte('exit_date', start).lte('exit_date', end);
        periodLabel = `${reportYear} Yılı (Yıllık)`;
      }

      const { data: records, error: recordsErr } = await query.order('exit_date', { ascending: true });

      if (recordsErr) {
        throw recordsErr;
      }

      if (!records || records.length === 0) {
        return alert('Seçilen dönemde atık çıkış kaydı bulunamadı.');
      }

      // 3. Process data
      let totalQty = 0;
      let hazardousQty = 0;
      let nonHazardousQty = 0;

      const codeGroups: Record<string, { code: string; name: string; total: number; isHazardous: boolean }> = {};
      const destGroups: Record<string, { name: string; address: string; total: number }> = {};

      records.forEach(rec => {
        const qty = Number(rec.quantity_kg) || 0;
        totalQty += qty;

        const isHazardous = rec.waste_code.trim().endsWith('*');
        if (isHazardous) {
          hazardousQty += qty;
        } else {
          nonHazardousQty += qty;
        }

        // Group by code
        if (!codeGroups[rec.waste_code]) {
          const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
          codeGroups[rec.waste_code] = {
            code: rec.waste_code,
            name: wasteDef ? wasteDef.name : 'Özel Atık Kodu / Tanımsız',
            total: 0,
            isHazardous
          };
        }
        codeGroups[rec.waste_code].total += qty;

        // Group by destination
        const destName = rec.destination_company?.name || rec.destination || 'Belirtilmemiş Alıcı';
        const destAddr = rec.destination_company?.address || rec.destination_address || 'Adres Girilmemiş';
        if (!destGroups[destName]) {
          destGroups[destName] = {
            name: destName,
            address: destAddr,
            total: 0
          };
        }
        destGroups[destName].total += qty;
      });

      // HTML generation
      const groupedByCodeHtml = Object.values(codeGroups)
        .map(g => `
          <tr>
            <td class="mono">${g.code}</td>
            <td>${g.name}</td>
            <td class="center">
              <span class="badge ${g.isHazardous ? 'badge-hazard' : 'badge-safe'}">
                ${g.isHazardous ? 'Tehlikeli ⚠' : 'Tehlikesiz ✔'}
              </span>
            </td>
            <td class="right">${g.total.toLocaleString('tr-TR')} kg</td>
          </tr>
        `).join('');

      const groupedByDestHtml = Object.values(destGroups)
        .map(g => `
          <tr>
            <td class="bold">${g.name}</td>
            <td class="small">${g.address}</td>
            <td class="right">${g.total.toLocaleString('tr-TR')} kg</td>
          </tr>
        `).join('');

      const detailedRowsHtml = records
        .map(rec => {
          const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
          const isHazardous = rec.waste_code.trim().endsWith('*');
          return `
            <tr>
              <td>${new Date(rec.exit_date).toLocaleDateString('tr-TR')}</td>
              <td>
                <span class="mono">${rec.waste_code}</span>
                <div class="waste-name">${wasteDef ? wasteDef.name : 'Özel Atık'}</div>
              </td>
              <td class="right">${Number(rec.quantity_kg).toLocaleString('tr-TR')} kg</td>
              <td class="small">${rec.transporter_company?.name || rec.transporter || '-'}</td>
              <td class="small">${rec.destination_company?.name || rec.destination || '-'}</td>
              <td class="center">
                <span class="badge ${rec.disposal_type === 'recovery' ? 'badge-recovery' : 'badge-disposal'}">
                  ${rec.disposal_type === 'recovery' ? 'Geri Kaz.' : 'Bertaraf'} ${rec.disposal_code ? `(${rec.disposal_code})` : ''}
                </span>
              </td>
            </tr>
          `;
        }).join('');

      // Open new window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        return alert('Pop-up engelleyici rapor pencerelerini engelliyor. Lütfen tarayıcınızdan pop-uplara izin verin.');
      }

      const clientLogoUrl = clientDetails.logo_url;
      // Danışman firmanın logosu consultant_logo_url alanında tutulur (ConsultantPanel tarafından)
      // logo_url Settings.tsx üzerinden de girilebilir — ikisini de dene
      const orgLogoUrl = myOrg.consultant_logo_url || myOrg.logo_url || null;
      const orgPhone   = myOrg.phone   || '';
      const orgEmail   = myOrg.email   || '';
      const orgAddress = myOrg.address || '';

      printWindow.document.write(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Atık Yönetimi Raporu - ${clientDetails.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: #ffffff;
      padding: 0;
    }
    /* ─── PRINT BAR ─── */
    .no-print {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 24px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .btn-print {
      background: #2ca58d;
      color: #fff;
      border: none;
      padding: 9px 20px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.3px;
    }
    .btn-close {
      background: #ffffff;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 9px 20px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    /* ─── PAGE WRAPPER ─── */
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 36px 48px;
    }
    /* ─── HEADER ─── */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 3px solid #2ca58d;
      margin-bottom: 28px;
    }
    .logo-block {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-placeholder {
      width: 60px;
      height: 60px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
    }
    .logo-placeholder img {
      width: 60px;
      height: 60px;
      object-fit: contain;
      border-radius: 10px;
    }
    .company-info h2 {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .company-info p {
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .consultant-block {
      text-align: right;
      display: flex;
      align-items: center;
      gap: 14px;
      justify-content: flex-end;
    }
    .consultant-block .company-info h2 {
      color: #2ca58d;
    }
    /* ─── TITLE ─── */
    .report-title {
      text-align: center;
      margin-bottom: 28px;
    }
    .report-title h1 {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .report-title .period-badge {
      display: inline-block;
      margin-top: 8px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 4px 16px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    /* ─── SUMMARY CARDS ─── */
    .summary-cards {
      display: flex;
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      flex: 1;
      border-radius: 12px;
      padding: 16px 20px;
      text-align: center;
      border: 1px solid;
    }
    .card-total   { background: #f0fdf9; border-color: #a7f3d0; }
    .card-hazard  { background: #fff1f2; border-color: #fecdd3; }
    .card-safe    { background: #eff6ff; border-color: #bfdbfe; }
    .card-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .card-total   .card-label { color: #2ca58d; }
    .card-hazard  .card-label { color: #e11d48; }
    .card-safe    .card-label { color: #2563eb; }
    .card-value {
      font-size: 26px;
      font-weight: 900;
    }
    .card-total   .card-value { color: #0f766e; }
    .card-hazard  .card-value { color: #be123c; }
    .card-safe    .card-value { color: #1d4ed8; }
    .card-unit {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      margin-left: 4px;
    }
    /* ─── SECTION ─── */
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e293b;
      padding: 8px 14px;
      background: #f8fafc;
      border-left: 4px solid #2ca58d;
      border-radius: 0 6px 6px 0;
      margin-bottom: 12px;
    }
    /* ─── TABLES ─── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead tr {
      background: #f1f5f9;
    }
    thead th {
      padding: 10px 14px;
      text-align: left;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f0fdf4; }
    tbody td {
      padding: 9px 14px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: middle;
    }
    tbody td.right { text-align: right; font-weight: 700; }
    tbody td.center { text-align: center; }
    tbody td.mono { font-family: 'Courier New', monospace; font-weight: 700; color: #0f172a; font-size: 12px; }
    tbody td.small { font-size: 10px; color: #64748b; }
    tbody td.bold { font-weight: 700; color: #0f172a; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      border: 1px solid;
    }
    .badge-hazard  { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
    .badge-safe    { background: #f0fdf4; color: #15803d; border-color: #a7f3d0; }
    .badge-recovery{ background: #f0fdfa; color: #0d9488; border-color: #a7f3d0; }
    .badge-disposal{ background: #fff1f2; color: #e11d48; border-color: #fecdd3; }
    .waste-name    { font-size: 10px; color: #94a3b8; margin-top: 2px; line-height: 1.3; }
    /* ─── SIGNATURE ─── */
    .signature-row {
      display: flex;
      gap: 48px;
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px dashed #e2e8f0;
    }
    .signature-box {
      flex: 1;
      text-align: center;
    }
    .signature-box .sig-label {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 40px;
    }
    .signature-box .sig-line {
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 6px;
    }
    .signature-box .sig-date {
      font-size: 10px;
      color: #94a3b8;
    }
    /* ─── PRINT ─── */
    @media print {
      body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .page { padding: 20px 24px; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">⬇ PDF Olarak Kaydet / Yazdır</button>
    <button class="btn-close" onclick="window.close()">✕ Kapat</button>
  </div>

  <div class="page">

    <!-- HEADER -->
    <div class="report-header">
      <div class="logo-block">
        ${clientLogoUrl
          ? `<div class="logo-placeholder"><img src="${clientLogoUrl}" alt="logo"/></div>`
          : `<div class="logo-placeholder">LOGO</div>`}
        <div class="company-info">
          <h2>${clientDetails.name}</h2>
          <p>Vergi No: ${clientDetails.tax_no || '-'}</p>
          <p>Tel: ${clientDetails.phone || '-'}</p>
          <p>${clientDetails.address || '-'}</p>
        </div>
      </div>
      <div class="consultant-block">
        <div class="company-info">
          <h2>${myOrg.name}</h2>
          <p style="font-size:10px;color:#2ca58d;font-weight:700;margin-bottom:2px;">Çevre Danışmanlık &amp; Denetim</p>
          ${orgPhone ? `<p>Tel: ${orgPhone}</p>` : ''}
          ${orgEmail ? `<p>E-posta: ${orgEmail}</p>` : ''}
          ${orgAddress ? `<p>${orgAddress}</p>` : ''}
        </div>
        ${orgLogoUrl
          ? `<div class="logo-placeholder"><img src="${orgLogoUrl}" alt="logo"/></div>`
          : `<div class="logo-placeholder">LOGO</div>`}
      </div>
    </div>

    <!-- TITLE -->
    <div class="report-title">
      <h1>Atık Yönetimi Döküm Raporu</h1>
      <span class="period-badge">Rapor Dönemi: ${periodLabel}</span>
    </div>

    <!-- SUMMARY CARDS -->
    <div class="summary-cards">
      <div class="card card-total">
        <div class="card-label">Toplam Atık Miktarı</div>
        <div class="card-value">${totalQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
      <div class="card card-hazard">
        <div class="card-label">Tehlikeli Atık</div>
        <div class="card-value">${hazardousQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
      <div class="card card-safe">
        <div class="card-label">Tehlikesiz Atık</div>
        <div class="card-value">${nonHazardousQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
    </div>

    <!-- SECTION 1: CODE GROUPS -->
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

    <!-- SECTION 2: DESTINATION GROUPS -->
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

    <!-- SECTION 3: DETAIL ROWS -->
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

    <!-- SIGNATURES -->
    <div class="signature-row">
      <div class="signature-box">
        <div class="sig-label">${clientDetails.name}<br/>Yetkili Temsilci / İmza</div>
        <div class="sig-line"></div>
        <div class="sig-date">Tarih: _____ / _____ / 20_____</div>
      </div>
      <div class="signature-box">
        <div class="sig-label">${myOrg.name}<br/>Çevre Görevlisi / İmza</div>
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
      setShowReportModal(false);
    } catch (err: any) {
      alert('Rapor oluşturulurken hata: ' + err.message);
    } finally {
      setGeneratingReport(false);
    }
  };

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

  // Sorumlu personele aksiyon bildirim e-postası gönderir (Google Apps Script üzerinden)
  const sendActionAssignmentEmail = async (
    assigneeId: string,
    actionTitle: string,
    dueDate: string | null,
    type: 'action_opened' | 'action_completed' = 'action_opened'
  ): Promise<boolean> => {
    try {
      const { data: scriptSetting } = await supabase
        .from('email_settings')
        .select('value')
        .eq('key', 'script_url')
        .maybeSingle();
      const actualScriptUrl = scriptSetting?.value;
      if (!actualScriptUrl) {
        console.warn('Aksiyon bildirim e-postası gönderilemedi: Google Apps Script URL tanımlı değil.');
        return false;
      }

      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', assigneeId)
        .maybeSingle();
      if (!assigneeProfile?.email) return false;

      await fetch(actualScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          email: assigneeProfile.email,
          clientName: assigneeProfile.full_name || 'Personel',
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

  const handleCreateAction = async () => {
    const title = newActionTitle.trim();
    const desc = newActionDesc.trim();
    const cId = isConsultant ? newActionClientId : clientRecId;
    const aId = newActionAssigneeId || myProfile?.id;
    const dDate = newActionDueDate;

    if (!title || !cId || !aId || !dDate || !desc) {
      alert('Lütfen tüm zorunlu alanları doldurun. Açıklama yazmadan aksiyon açılamaz.');
      return;
    }

    // Normal (premium olmayan) üyeler aynı anda sadece 1 aktif (onaylanmamış) aksiyon açabilir.
    const isNormalTier = myProfile?.role === 'normal';
    if (isNormalTier) {
      const activeCount = complianceActions.filter((a) => a.status !== 'approved').length;
      if (activeCount >= 1) {
        alert('Aksiyon Takip modülünde aynı anda sadece 1 aktif aksiyonunuz olabilir. Yeni aksiyon açmak için mevcut aksiyonunuzun kapanmasını (onaylanmasını) bekleyin ya da premium üyeliğe geçin.');
        return;
      }
    }

    if (creatingAction) return;
    setCreatingAction(true);

    try {
      const articleIds = pendingActionArticleIds.length > 0
        ? pendingActionArticleIds
        : (reqNotesArticleId ? [reqNotesArticleId] : null);

      const { error } = await supabase
        .from('compliance_actions')
        .insert({
          client_id: cId,
          article_id: reqNotesArticleId || null,
          article_ids: articleIds,
          title: title,
          description: desc || null,
          due_date: dDate,
          created_by: myProfile?.id,
          assigned_to: aId,
          status: 'pending'
        });

      if (error) throw error;

      // Aksiyon açıldı e-postası sadece premium üyelere ait bir bildirim; normal üyelere gönderilmiyor.
      const emailSent = isNormalTier ? false : await sendActionAssignmentEmail(aId, title, dDate, 'action_opened');

      alert('Aksiyon başarıyla oluşturuldu.' + (emailSent ? ' Sorumlu personele bildirim e-postası gönderildi.' : ''));
      closeCreateActionModal();

      await fetchComplianceActions();
    } catch (err: any) {
      alert('Aksiyon oluşturulurken hata: ' + err.message);
    } finally {
      setCreatingAction(false);
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
    setPendingActionArticleIds([]);
    setCreatingAction(false);
  };

  // Tek veya birden fazla madde için aksiyon oluşturma modalını hazırlar
  const openActionModalForArticles = async (arts: any[]) => {
    if (arts.length === 0) return;

    if (arts.length === 1) {
      setNewActionTitle(`[${arts[0].article_no}] Aksiyon`);
      setNewActionDesc(`Bu madde için aksiyon tamamlanması gerekmektedir.\nİlgili Madde: ${arts[0].article_no} - ${arts[0].title || ''}`);
    } else {
      const articleList = arts.map((a) => `${a.article_no} - ${a.title || ''}`).join('\n');
      setNewActionTitle(`${arts.length} Madde İçin Aksiyon`);
      setNewActionDesc(`Aşağıdaki maddeler için aksiyon tamamlanması gerekmektedir:\n${articleList}`);
    }
    setNewActionClientId(clientRecId || '');
    setReqNotesArticleId(arts[0].id);
    setPendingActionArticleIds(arts.map((a) => a.id));

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

  const handleOpenActionForArticle = async (art: any) => {
    await openActionModalForArticles([art]);
  };

  const handleOpenActionForSelectedArticles = async () => {
    if (selectedArticleIdsForAction.length === 0) {
      alert('Lütfen aksiyon açmak için en az bir madde seçin.');
      return;
    }
    const arts = selectedRegArticles.filter((a) => selectedArticleIdsForAction.includes(a.id));
    await openActionModalForArticles(arts);
    setSelectedArticleIdsForAction([]);
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

      const linkedArticleIds = (action.article_ids && action.article_ids.length > 0)
        ? action.article_ids
        : (action.article_id ? [action.article_id] : []);
      if (linkedArticleIds.length > 0) {
        await supabase
          .from('client_regulation_articles')
          .update({
            current_status_requested: false
          })
          .in('id', linkedArticleIds);
      }

      if (action.assigned_to && myProfile?.role !== 'normal') {
        await sendActionAssignmentEmail(action.assigned_to, action.title, action.due_date, 'action_completed');
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

  const premiumSeatLimit = myOrg?.premium_seat_limit ?? null;
  const premiumActiveCount = teamMembers.filter(
    (m) => m.role !== 'normal' && m.premium_seat_active !== false
  ).length;

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

  const handleTogglePremiumSeat = async (member: any) => {
    if (!isCorporateAdmin) return;
    const newValue = member.premium_seat_active === false;
    const { error } = await supabase
      .from('profiles')
      .update({ premium_seat_active: newValue })
      .eq('id', member.id);
    if (error) {
      alert('Hata: ' + error.message);
      return;
    }
    setTeamMembers((prev) =>
      prev.map((m) =>
        m.id === member.id ? { ...m, premium_seat_active: newValue } : m
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

  // --- SAHA QR DENETİMLERİ METOTLARI ---
  const fetchInspections = async () => {
    if (!myOrg?.id) return;
    setLoadingInspections(true);
    try {
      const { data: forms, error: formsError } = await supabase
        .from('inspection_forms')
        .select('*, client:consultant_clients(name)')
        .eq('organization_id', myOrg.id)
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
          organization_id: myOrg.id,
          client_id: newInsFormClientId,
          title: newInsFormTitle.trim(),
          description: newInsFormDesc.trim() || null,
          access_password: newInsFormPassword.trim() || null,
          created_by: myProfile?.id
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
    const url = `${domain}/inspect/${encodeURIComponent(point.qr_token)}`;
    
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

  const getModuleForTab = (tab: string): 'compliance' | 'actions' | 'operations' | 'hr' => {
    if (['compliance', 'requests'].includes(tab)) return 'compliance';
    if (tab === 'actions') return 'actions';
    if (['waste', 'inspections'].includes(tab)) return 'operations';
    return 'hr';
  };
  const activeModule = getModuleForTab(activeTab);

  const selectModule = (moduleName: 'compliance' | 'actions' | 'operations' | 'hr') => {
    if (moduleName === 'compliance') {
      setActiveTab('compliance');
      setSearchParams({ tab: 'compliance' });
    } else if (moduleName === 'actions') {
      setActiveTab('actions');
      setSearchParams({ tab: 'actions' });
    } else if (moduleName === 'operations') {
      setActiveTab('waste');
      setSearchParams({ tab: 'waste' });
    } else if (moduleName === 'hr') {
      setActiveTab('team');
      setSearchParams({ tab: 'team' });
    }
  };

  const modules = [
    {
      id: 'compliance',
      label: 'Mevzuat & Yasal Uyum',
      icon: <Shield size={18} />,
      tabs: [
        { id: 'compliance', label: 'Mevzuatlarımız', icon: <Shield size={14} />, show: true },
        { id: 'requests', label: 'Gönderilen Mevzuat Talepleri', icon: <Clock size={14} />, show: true },
      ]
    },
    {
      id: 'actions',
      label: 'Aksiyon Takip',
      icon: <CheckCircle size={18} />,
      tabs: [
        { id: 'actions', label: 'Aksiyon Takip', icon: <CheckCircle size={14} />, show: true },
      ]
    },
    {
      id: 'operations',
      label: 'Operasyon & Çevre',
      icon: <PieChart size={18} />,
      tabs: [
        { id: 'waste', label: 'Atık Yönetimi', icon: <Trash2 size={14} />, show: true },
        { id: 'inspections', label: 'Saha QR Denetimleri', icon: <QrCode size={14} />, show: isConsultant },
      ]
    },
    {
      id: 'hr',
      label: 'İK & Yönetim',
      icon: <Users size={18} />,
      tabs: [
        { id: 'team', label: 'Ekip Yönetimi', icon: <Users size={14} />, show: true },
      ]
    }
  ];

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

      {/* Modüller (Ana Kategoriler) */}
      <div className="bg-slate-100/80 dark:bg-slate-900/50 p-2 rounded-2xl border border-gray-200 dark:border-slate-800 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
        {modules.filter(m => m.tabs.some(t => t.show)).map((mod) => {
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => selectModule(mod.id as any)}
              className={`relative px-5 py-3 text-xs font-bold rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10 scale-[1.02]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSearchParams({ tab: tab.id });
                  }}
                  className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30'
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

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* SOL: EKİP LİSTESİ */}
          <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Users size={20} /> Ekip ve Bekleyen Kodlar
            </h3>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-slate-50 text-slate-600 border-slate-200">
                Kota: {totalUsed}/{maxLimit}
              </span>
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                  premiumSeatLimit !== null
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}
              >
                <Crown size={12} />
                Premium Kota: {premiumSeatLimit !== null ? `${premiumActiveCount}/${premiumSeatLimit}` : 'Sınırsız'}
              </span>
            </div>

            <div className="space-y-4">
              {/* Mevcut Üyeler */}
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className={`p-4 rounded-lg border flex flex-col gap-3 ${
                    member.role !== 'normal' && member.premium_seat_active === false
                      ? 'bg-gray-50 grayscale opacity-70'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          member.role === 'corporate_chief'
                            ? 'bg-blue-600'
                            : member.role === 'premium_corporate'
                            ? 'bg-rose-600'
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
                                : member.role === 'premium_corporate'
                                ? 'bg-rose-50 text-rose-700 border-rose-250 font-bold'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {roleLabels[member.role] || member.role}
                          </span>
                          {member.role !== 'normal' && (
                            member.premium_seat_active === false ? (
                              <span className="text-[10px] px-2 py-0.5 rounded border uppercase bg-gray-100 text-gray-500 border-gray-200 flex items-center gap-1">
                                <XCircle size={11} /> Premium Yok
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded border uppercase bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                <Crown size={11} /> Premium
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {member.role !== 'normal' && (
                      <div className="mt-2 py-1.5 px-3 bg-slate-50 rounded-lg border text-xs flex items-center gap-2">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Deneyim Yılı:</span>
                        {myProfile?.role === 'premium_corporate' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="80"
                              value={member.experience_years !== undefined && member.experience_years !== null ? member.experience_years : 0}
                              onChange={async (e) => {
                                const val = parseInt(e.target.value) || 0;
                                setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, experience_years: val } : m));
                                const { error } = await supabase
                                  .from('profiles')
                                  .update({ experience_years: val })
                                  .eq('id', member.id);
                                if (error) {
                                  alert('Deneyim yılı güncellenirken hata: ' + error.message);
                                  const { data: refreshed } = await supabase
                                    .from('profiles')
                                    .select('*')
                                    .eq('organization_id', myProfile.organization_id);
                                  if (refreshed) {
                                    const sorted = refreshed.sort((a, b) => {
                                      if (a.role === 'premium_corporate' && b.role !== 'premium_corporate') return -1;
                                      if (a.role !== 'premium_corporate' && b.role === 'premium_corporate') return 1;
                                      return 0;
                                    });
                                    setTeamMembers(sorted);
                                  }
                                }
                              }}
                              className="w-16 border rounded px-1.5 py-0.5 text-center bg-white font-bold outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-500">Yıl</span>
                          </div>
                        ) : (
                          <span className="font-bold text-gray-700">
                            {member.experience_years || 0} Yıl
                          </span>
                        )}
                      </div>
                    )}

                    {/* Yönetici Butonları */}
                    {isCorporateAdmin && member.role !== 'premium_corporate' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTogglePremiumSeat(member)}
                          className={`text-xs px-2 py-1 rounded border flex items-center gap-1 transition ${
                            member.premium_seat_active === false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={member.premium_seat_active === false ? 'Premium Ver' : 'Premium Al'}
                        >
                          <Crown size={12} /> {member.premium_seat_active === false ? 'Premium Ver' : 'Premium Al'}
                        </button>
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

                  {/* Mevzuat Talep Et Butonu (yönetici hariç: yönetici talep almaz, doğrudan ekler) */}
                  {myProfile?.role !== 'premium_corporate' && (
                  <button
                    onClick={() => {
                      setRequestClientId(clientRecId || '');
                      setShowRequestModal(true);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <PlusCircle size={14} /> Mevzuat Talep Et
                  </button>
                  )}
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
                       {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief') && (
                         <button
                           onClick={handleOpenActionForSelectedArticles}
                           className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
                           title="Seçilen tüm maddeler için tek bir aksiyon oluştur"
                         >
                           📌 Seçilenler İçin Aksiyon Aç ({selectedArticleIdsForAction.length})
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
                        <option value="near_expiry">Süresi Yaklaşanlar {"<"} 30 gün</option>
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
                        if (articleFilter === 'near_expiry') {
                          return art.is_mandatory && isNearExpiry(art.expiry_date);
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
                          className={`p-4 rounded-xl border transition shadow-sm ${getStatusStyles(art)}`}
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
                                     title="Durum talebi için seç"
                                     className="mr-2 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                   />
                                 )}
                                 {(myProfile?.role === 'premium_corporate' || myProfile?.role === 'corporate_chief') && (
                                   <input
                                     type="checkbox"
                                     checked={selectedArticleIdsForAction.includes(art.id)}
                                     onChange={() => handleToggleArticleForAction(art.id)}
                                     title="Aksiyon açmak için seç"
                                     className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
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
                                <div className="text-[10px] text-gray-400 mt-1 font-semibold flex items-center gap-1.5 flex-wrap">
                                  <span>Geçerlilik Süresi:</span>
                                  {(() => {
                                    if (!art.expiry_date) {
                                      return (
                                        <span className="font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                                          Süresiz
                                        </span>
                                      );
                                    }
                                    const nowStr = new Date().toISOString().split('T')[0];
                                    const isExpired = art.expiry_date < nowStr;
                                    
                                    if (isExpired) {
                                      return (
                                        <span className="font-black text-rose-600 dark:text-rose-400 animate-pulse flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-200 uppercase">
                                          <span>🚨</span>
                                          {new Date(art.expiry_date).toLocaleDateString('tr-TR')} (SÜRESİ GEÇTİ!)
                                        </span>
                                      );
                                    }
                                    if (isNearExpiry(art.expiry_date)) {
                                      return (
                                        <span className="font-extrabold text-amber-600 dark:text-amber-400 animate-pulse flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200">
                                          <span>⏳</span>
                                          {new Date(art.expiry_date).toLocaleDateString('tr-TR')} (Süresi Yaklaşıyor!)
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                                        {new Date(art.expiry_date).toLocaleDateString('tr-TR')}
                                      </span>
                                    );
                                  })()}
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
                          {(
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
                                    <div className="font-extrabold text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                      {art.compliance_status === 'compliant' ? 'Uygunluk Açıklaması' : art.compliance_status === 'non_compliant' ? 'Uygunsuzluk Açıklaması' : 'Mevcut Durum / Gerekçe'}
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-350 mt-0.5 whitespace-pre-wrap leading-relaxed">
                                      {art.current_status_notes || <span className="italic text-gray-400">Açıklama girilmemiş</span>}
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

      {/* 3. SEKME: TALEPLER (Mevzuat ve Ünvan/Adres) */}
      {activeTab === 'requests' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 space-y-6">
          {/* Subtabs Navigation */}
          <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm gap-2">
            <button
              onClick={() => setRequestsSubTab('regulation')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                requestsSubTab === 'regulation'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-400'
              }`}
            >
              Mevzuat Talepleri
            </button>
            <button
              onClick={() => {
                setRequestsSubTab('change');
                if (clientRecId) {
                  fetchChangeRequests(clientRecId);
                }
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                requestsSubTab === 'change'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-400'
              }`}
            >
              Ünvan & Adres Değişikliği Talepleri
            </button>
          </div>

          {requestsSubTab === 'regulation' ? (
            <div className="space-y-6">
              <div className="border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                    <Clock className="text-purple-600" size={16} /> Gönderilen Mevzuat Talepleri
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400 font-medium">
                    Danışman firmanızdan talep ettiğiniz veya şirket içi personelin talep ettiği mevzuatları görüntüleyin.
                  </p>
                </div>
                {(myProfile?.role === 'corporate_chief' || myProfile?.role === 'corporate_staff') && (
                  <button
                    onClick={() => {
                      setRequestClientId(isConsultant ? '' : (clientRecId || ''));
                      setShowRequestModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md"
                  >
                    <PlusCircle size={16} /> Yöneticimden Mevzuat Talep Et
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
                        <span className="font-bold text-slate-850 dark:text-slate-200">{req.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                            : req.status === 'escalated'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900'
                            : req.status === 'approved'
                            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900'
                            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900'
                        }`}
                        >
                          {req.status === 'pending' ? 'Bekliyor' : req.status === 'escalated' ? 'Yönlendirildi' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
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
          ) : (
            <div className="space-y-6">
              <div className="border-b pb-3">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
                  <RefreshCw className="text-purple-600" size={16} /> Gelen Ünvan & Adres Değişikliği Talepleri
                </h3>
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400 font-medium">
                  Danışman personeliniz tarafından şirketinizin resmi ünvan ve adresi için girilen değişiklik taleplerini inceleyin.
                </p>
              </div>

              {loadingChangeRequests ? (
                <div className="flex justify-center items-center py-12 text-xs text-gray-500 gap-2">
                  <Loader className="animate-spin" size={14} /> Yükleniyor...
                </div>
              ) : changeRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-450 italic bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
                  Henüz gelen bir değişiklik talebi bulunmuyor.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {changeRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isResolving = resolvingChangeRequestId === req.id;
                    const canApprove = myProfile?.role === 'premium_corporate';

                    return (
                      <div key={req.id} className="p-4 rounded-xl border bg-slate-50/50 dark:bg-slate-900/10 dark:border-slate-800 space-y-3 text-xs flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">Değişiklik Talebi</span>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                Gönderen: <b>{req.requester?.full_name || 'Bilinmiyor'}</b>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              req.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900'
                                : req.status === 'approved'
                                ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900'
                                : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900'
                            }`}>
                              {req.status === 'pending' ? 'Bekliyor' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                            </span>
                          </div>

                          <div className="space-y-1.5 p-2 rounded bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                            {req.new_name && (
                              <div>
                                <span className="text-[9px] font-bold text-gray-400 block uppercase">Talep Edilen Ünvan</span>
                                <span className="text-gray-700 dark:text-gray-300 font-semibold">{req.new_name}</span>
                              </div>
                            )}
                            {req.new_address && (
                              <div className={req.new_name ? "pt-1.5 border-t border-dashed border-gray-150 dark:border-slate-800" : ""}>
                                <span className="text-[9px] font-bold text-gray-400 block uppercase">Talep Edilen Adres</span>
                                <span className="text-gray-700 dark:text-gray-300 font-semibold block whitespace-pre-wrap">{req.new_address}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-dashed border-gray-200 dark:border-slate-800">
                          <div className="flex justify-between items-center text-[10px]">
                            <a 
                              href={req.gazette_pdf_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                            >
                              Gazete PDF'i Gör ↗
                            </a>
                            <span className="text-gray-400">{new Date(req.created_at).toLocaleDateString('tr-TR')}</span>
                          </div>

                          {req.status === 'rejected' && req.rejection_reason && (
                            <div className="p-2 bg-red-50/50 dark:bg-red-950/10 text-red-800 dark:text-red-350 rounded border border-red-100 dark:border-red-900/35 text-[10px]">
                              <span className="font-bold text-[8px] block uppercase">Red Gerekçesi</span>
                              <p className="italic">{req.rejection_reason}</p>
                            </div>
                          )}

                          {isPending && canApprove && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleApproveChangeRequest(req)}
                                disabled={isResolving}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-2 rounded transition shadow-sm text-center text-xs disabled:opacity-50"
                              >
                                {isResolving ? 'İşleniyor...' : 'Onayla'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedChangeRequestForRejection(req);
                                  setChangeRejectionReason('');
                                  setShowChangeRejectionModal(true);
                                }}
                                disabled={isResolving}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-2 rounded transition border border-red-300 text-center text-xs disabled:opacity-50"
                              >
                                Reddet
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                setReqNotesArticleId('');
                setPendingActionArticleIds([]);
                setShowCreateActionModal(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md"
            >
              <PlusCircle size={16} /> Yeni Aksiyon Oluştur
            </button>
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

              const pendingList = filtered.filter(act => act.status !== 'approved');
              const completedList = filtered.filter(act => act.status === 'approved');

              const renderActionCard = (act: any) => {
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
              };

              const activeList = actionsSubTab === 'pending' ? pendingList : completedList;

              if (activeList.length === 0) {
                return (
                  <div className="text-center py-20 bg-white dark:bg-slate-800 border border-dashed rounded-xl text-xs text-gray-400 italic space-y-2 animate-fadeIn">
                    <CheckCircle size={32} className="mx-auto mb-2 opacity-25 text-purple-600" />
                    {actionsSubTab === 'pending' ? 'Bekleyen aksiyon bulunmuyor.' : 'Tamamlanan aksiyon bulunmuyor.'}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {activeList.map(renderActionCard)}
                </div>
              );
            })()
          )}
        </div>
      )}

      {activeTab === 'waste' && (
        <div className="animate-fadeIn">
          <WasteManagement />
        </div>
      )}

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
                    {assignedClients.map((c) => (
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
              {pendingActionArticleIds.length > 1 && (
                <div className="text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 rounded-xl p-2.5 font-bold">
                  📌 Bu aksiyon {pendingActionArticleIds.length} madde ile ilişkilendirilecek.
                </div>
              )}
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
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">Açıklama / Detaylar *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Aksiyon detaylarını buraya yazın... (zorunlu)"
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
                  disabled={!newActionDesc.trim() || creatingAction}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <div className="space-y-2">
                    <select
                      className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-xs text-slate-700 dark:text-slate-350 border-slate-200"
                      value={selectedEvidenceLocation}
                      onChange={(e) => {
                        setSelectedEvidenceLocation(e.target.value);
                        setSelectedEvidenceDocUrl('');
                      }}
                    >
                      <option value="">-- Tüm Lokasyonlar --</option>
                      {Array.from(new Set(userDocuments.map(d => d.location_def?.label).filter(Boolean))).map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                    <select
                      className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 font-bold text-xs text-slate-700 dark:text-slate-350 border-slate-200"
                      value={selectedEvidenceDocUrl}
                      onChange={(e) => setSelectedEvidenceDocUrl(e.target.value)}
                    >
                      <option value="">-- Evrak Seçin --</option>
                      {userDocuments
                        .filter(d => {
                          if (!selectedEvidenceLocation) return true;
                          return d.location_def?.label === selectedEvidenceLocation;
                        })
                        .map(d => (
                          <option key={d.id} value={d.file_url}>{d.title}{d.location_def?.label ? ` (${d.location_def.label})` : ''}</option>
                        ))}
                    </select>
                  </div>
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

      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="font-bold text-gray-800 text-md flex items-center gap-1.5">
                <PlusCircle className="text-[#2ca58d]" size={20} />
                Yeni Firma Ekle (Taşıyıcı / Gönderilen)
              </h3>
              <button onClick={() => setShowAddCompanyModal(false)} className="text-gray-450 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCompany} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Firma Adı / Ünvanı <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Firma Adı"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Adres
                </label>
                <textarea
                  placeholder="Firma Adresi"
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  rows={2}
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Konum Koordinatları</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Enlem"
                    value={newCompanyLat !== null && newCompanyLat !== undefined ? newCompanyLat : ''}
                    onChange={(e) => setNewCompanyLat(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-1/2 border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-mono font-bold"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Boylam"
                    value={newCompanyLng !== null && newCompanyLng !== undefined ? newCompanyLng : ''}
                    onChange={(e) => setNewCompanyLng(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-1/2 border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-mono font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompanyMap(true)}
                  className="w-full bg-[#2ca58d] hover:bg-[#238c75] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <MapPin size={14} /> Haritadan Konum Seç
                </button>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="px-4 py-2 bg-[#2ca58d] hover:bg-[#238c75] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-teal-50"
                >
                  {submittingCompany ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditWasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="font-bold text-gray-800 text-md flex items-center gap-1.5">
                <Edit2 className="text-blue-500" size={20} />
                Atık Kaydını Düzenle
              </h3>
              <button onClick={() => setShowEditWasteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateWaste} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Atık Çıkan Firma <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editWasteClientId}
                  onChange={(e) => setEditWasteClientId(e.target.value)}
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Atık Kodu & Tanımı <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Kod yazın (örn: 15 01 02) veya arayın..."
                  value={editWasteCode}
                  onChange={(e) => setEditWasteCode(e.target.value)}
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-slate-800"
                />
                {editWasteCode.trim().length > 0 && !WASTE_CODES.some(w => w.code === editWasteCode) && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 py-1 text-xs">
                    {WASTE_CODES.filter(w => 
                      w.code.includes(editWasteCode) || 
                      w.name.toLowerCase().includes(editWasteCode.toLowerCase())
                    ).slice(0, 15).map(w => (
                      <button
                        type="button"
                        key={w.code}
                        onClick={() => setEditWasteCode(w.code)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-55 border-b last:border-0"
                      >
                        <span className="font-bold font-mono text-blue-500 mr-2">{w.code}</span>
                        <span className="text-gray-600 text-[11px]">{w.name}</span>
                      </button>
                    ))}
                    {WASTE_CODES.filter(w => 
                      w.code.includes(editWasteCode) || 
                      w.name.toLowerCase().includes(editWasteCode.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-gray-400 italic text-[11px]">
                        Özel kod olarak kaydedilecek: "{editWasteCode}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Çıkış Tarihi <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={editWasteExitDate}
                    onChange={(e) => setEditWasteExitDate(e.target.value)}
                    className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Miktar (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Miktar"
                    value={editWasteQuantity}
                    onChange={(e) => setEditWasteQuantity(e.target.value)}
                    className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Taşıyıcı Firma <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editWasteTransporterId}
                    onChange={(e) => setEditWasteTransporterId(e.target.value)}
                    className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.address ? `(${c.address})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Gönderilen Firma <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editWasteDestinationId}
                    onChange={(e) => setEditWasteDestinationId(e.target.value)}
                    className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.address ? `(${c.address})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Yöntem Türü <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="edit_disposal_type"
                      value="recovery"
                      checked={editWasteDisposalType === 'recovery'}
                      onChange={() => {
                        setEditWasteDisposalType('recovery');
                        setEditWasteDisposalCode('');
                      }}
                      className="text-blue-500 focus:ring-blue-500"
                    />
                    Geri Kazanım
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="edit_disposal_type"
                      value="disposal"
                      checked={editWasteDisposalType === 'disposal'}
                      onChange={() => {
                        setEditWasteDisposalType('disposal');
                        setEditWasteDisposalCode('');
                      }}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Bertaraf
                  </label>
                </div>

                {editWasteDisposalType === 'recovery' ? (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Geri Kazanım Kodu (R Kodu) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={editWasteDisposalCode}
                      onChange={(e) => setEditWasteDisposalCode(e.target.value)}
                      className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Kod Seçiniz (R1 - R13)...</option>
                      {RECOVERY_CODES.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Bertaraf Kodu (D Kodu) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={editWasteDisposalCode}
                      onChange={(e) => setEditWasteDisposalCode(e.target.value)}
                      className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Kod Seçiniz (D1 - D15)...</option>
                      {DISPOSAL_CODES.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Açıklama
                </label>
                <textarea
                  placeholder="Atıkla alakalı eklemek istediğiniz notlar..."
                  value={editWasteDescription}
                  onChange={(e) => setEditWasteDescription(e.target.value)}
                  rows={2}
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditWasteModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={updatingWaste}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-50"
                >
                  {updatingWaste ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="font-bold text-gray-800 text-md flex items-center gap-1.5">
                <FileText className="text-purple-600" size={20} />
                Atık Çıkış Raporu Oluştur (PDF)
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-655">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Firma Seçin <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedReportClientId}
                  onChange={(e) => setSelectedReportClientId(e.target.value)}
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500 font-bold"
                >
                  <option value="" disabled>Seçiniz...</option>
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Rapor Dönemi <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="reportPeriodType"
                      value="all"
                      checked={reportPeriodType === 'all'}
                      onChange={() => setReportPeriodType('all')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    Tüm Zamanlar
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="reportPeriodType"
                      value="monthly"
                      checked={reportPeriodType === 'monthly'}
                      onChange={() => setReportPeriodType('monthly')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    Aylık
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="reportPeriodType"
                      value="yearly"
                      checked={reportPeriodType === 'yearly'}
                      onChange={() => setReportPeriodType('yearly')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    Yıllık
                  </label>
                </div>

                {reportPeriodType === 'monthly' && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Ay Seçin <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="month"
                      required
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500 font-bold"
                    />
                  </div>
                )}

                {reportPeriodType === 'yearly' && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Yıl Seçin <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="2000"
                      max="2100"
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500 font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-50"
                >
                  {generatingReport ? 'Oluşturuluyor...' : 'Raporu Oluştur (PDF)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChangeRejectionModal && selectedChangeRequestForRejection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border animate-scaleIn">
            <div className="flex justify-between items-center pb-4 border-b">
              <h3 className="font-bold text-gray-800 text-md flex items-center gap-1.5">
                <XCircle className="text-red-500" size={20} />
                Değişiklik Talebini Reddet
              </h3>
              <button 
                onClick={() => {
                  setShowChangeRejectionModal(false);
                  setSelectedChangeRequestForRejection(null);
                  setChangeRejectionReason('');
                }} 
                className="text-gray-400 hover:text-gray-655"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRejectChangeRequest} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Red Gerekçesi <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={changeRejectionReason}
                  onChange={(e) => setChangeRejectionReason(e.target.value)}
                  placeholder="Lütfen talebin neden reddedildiğini açıklayın..."
                  className="w-full border p-2 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeRejectionModal(false);
                    setSelectedChangeRequestForRejection(null);
                    setChangeRejectionReason('');
                  }}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  Reddetmeyi Onayla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MapPickerModal
        isOpen={showCompanyMap}
        onClose={() => setShowCompanyMap(false)}
        initialLat={newCompanyLat}
        initialLng={newCompanyLng}
        onSelect={(latVal, lngVal, addressVal) => {
          setNewCompanyLat(latVal);
          setNewCompanyLng(lngVal);
          setNewCompanyAddress(prev => prev || addressVal || '');
          setShowCompanyMap(false);
        }}
      />
    </div>
  );
}
