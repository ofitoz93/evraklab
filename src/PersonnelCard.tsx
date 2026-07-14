import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  X,
  Loader,
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  Wallet,
  FileText,
  Star,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Crown,
  LogOut,
  AlertTriangle,
  ShieldCheck,
  Paperclip,
  Upload,
  ExternalLink,
} from 'lucide-react';
import ExitDateModal from './ExitDateModal';

type CardTab = 'genel' | 'rol' | 'gorev' | 'raporlar' | 'giderler' | 'belgeler';

const CARD_TABS: { id: CardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'genel', label: 'Genel Bilgiler', icon: <Briefcase size={13} /> },
  { id: 'rol', label: 'Rol & Yetkiler', icon: <ShieldCheck size={13} /> },
  { id: 'gorev', label: 'Görev & Atamalar', icon: <Building size={13} /> },
  { id: 'raporlar', label: 'Raporlar & Performans', icon: <FileText size={13} /> },
  { id: 'giderler', label: 'Giderler', icon: <Wallet size={13} /> },
  { id: 'belgeler', label: 'Belgeler', icon: <Paperclip size={13} /> },
];

interface ClientRef {
  id: string;
  name: string;
  permit_stage?: string | null;
  ced_status?: string | null;
}

interface Props {
  personnelId: string;
  orgId: string;
  // Sadece firma sahibinin (premium_corporate) bu bileşeni görebilmesi gerekiyor;
  // ConsultantPanel zaten bu koşulla render ediyor, burada tekrar kontrol ediliyor.
  viewerRole: string;
  // Organizasyonun tüm müşteri firmaları — kişiye atama/atamadan çıkarma için.
  clients: ClientRef[];
  // Rol/yetki/premium/çıkarma gibi ConsultantPanel'in teamMembers listesini
  // etkileyen bir değişiklik olduğunda üst bileşenin listeyi tazelemesi için.
  onMemberChanged: () => void;
  onClose: () => void;
}

const roleLabels: Record<string, string> = {
  premium_corporate: 'Çevre Danışmanlık Firma Sahibi',
  corporate_chief: 'Çevre Danışmanlık Firma Yöneticisi',
  corporate_staff: 'Çevre Danışmanlık Personeli',
  normal: 'Normal (Ekip Dışı)',
};

const PERMS_CHIEF: { key: string; label: string; defaultTrue?: boolean }[] = [
  { key: 'can_view_clients', label: 'İşletmeleri Görüntüleme', defaultTrue: true },
  { key: 'can_view_all_clients', label: 'Tüm Firmaları Görebilir' },
  { key: 'can_create_clients', label: 'Yeni İşletme Oluşturma' },
  { key: 'can_edit_clients', label: 'İşletme Düzenleme' },
  { key: 'can_assign_clients', label: 'Personel Atama' },
  { key: 'can_delete_clients', label: 'İşletme Silme (Kritik)' },
  { key: 'can_view_reports', label: 'Raporları Görüntüleme', defaultTrue: true },
  { key: 'can_view_team', label: 'Ekip Yönetimini Görüntüleme', defaultTrue: true },
  { key: 'receive_reminder_cc', label: "Hatırlatma Maillerinde CC'de Yer Alsın" },
];

const PERMS_STAFF: { key: string; label: string; defaultTrue?: boolean }[] = [
  { key: 'can_view_all_clients', label: 'Tüm Firmaları Görebilir' },
  { key: 'receive_reminder_cc', label: "Hatırlatma Maillerinde CC'de Yer Alsın" },
];

export default function PersonnelCard({ personnelId, orgId, viewerRole, clients, onMemberChanged, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [hireDate, setHireDate] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [exitDate, setExitDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Hassas bilgiler (maaş/giderler) varsayılan olarak maskeli — kart her
  // açılışta/kapanışta sıfırlanır, hesabı açık unutan biri panelde
  // gezinirse rakamlar göz ikonuna tıklamadan görünmez.
  const [amountsVisible, setAmountsVisible] = useState(false);

  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [evalSummary, setEvalSummary] = useState<{ count: number; avg: number | null }>({ count: 0, avg: null });

  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseTitle, setNewExpenseTitle] = useState('Maaş Ödemesi');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingExpense, setSavingExpense] = useState(false);

  const [savingRole, setSavingRole] = useState(false);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);
  const [togglingPremium, setTogglingPremium] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Kart karışık göründüğü için bölüm bölüm sekmelere ayrıldı; kimlik
  // başlığı ve "Şirketten Çıkar" footer'ı sekmelerden bağımsız sabit kalır.
  const [activeCardTab, setActiveCardTab] = useState<CardTab>('genel');

  // Personel Belgeleri (Belgeler sekmesi) — belge türleri organizasyon
  // genelinde paylaşılır (user_definitions, category='personnel_doc_type'),
  // bir personel için oluşturulan tür diğer personellerin kartında da çıkar.
  const [docTypes, setDocTypes] = useState<{ id: string; label: string }[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<any[]>([]);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState('');
  const [showNewDocType, setShowNewDocType] = useState(false);
  const [newDocTypeLabel, setNewDocTypeLabel] = useState('');
  const [savingDocType, setSavingDocType] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Maaş Geçmişi — tarih-etkili satırlar (bkz. employee_salary_history).
  // Her satır "şu aydan itibaren maaş şu kadar" demek; bir ay için geçerli
  // tutar, o aya <= olan en güncel effective_date satırıdır. Yeni bir satır
  // eklemek (örn. yıl ortasında zam) daha önce otomatik üretilmiş giderleri
  // de geriye dönük düzeltir (bkz. generate_missing_salary_expenses).
  const [salaryHistory, setSalaryHistory] = useState<{ id: string; effective_date: string; monthly_salary: number }[]>([]);
  const [newSalaryMonth, setNewSalaryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [newSalaryAmount, setNewSalaryAmount] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);

  useEffect(() => {
    fetchAll();
    setAmountsVisible(false);
    setActiveCardTab('genel');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnelId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [
        { data: profileData },
        { data: detailData },
        { data: assignments },
        { data: reports, count: reportsCount },
        { count: docsCount },
        { data: evals },
        { data: exp },
        { data: docTypesData },
        { data: employeeDocsData },
        { data: salaryHistoryData },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, role, experience_years, extra_permissions, premium_seat_active')
          .eq('id', personnelId)
          .single(),
        supabase.from('employee_details').select('*').eq('profile_id', personnelId).maybeSingle(),
        supabase.from('consultant_assignments').select('client_id').eq('user_id', personnelId),
        supabase
          .from('env_reports')
          .select('id, report_type, report_date, client:client_id(name)', { count: 'exact' })
          .eq('creator_id', personnelId)
          .order('report_date', { ascending: false })
          .limit(5),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('uploader_id', personnelId),
        supabase.from('evaluations').select('scores').eq('evaluatee_id', personnelId),
        supabase.from('company_expenses').select('*').eq('employee_id', personnelId).order('expense_date', { ascending: false }),
        supabase.from('user_definitions').select('id, label').eq('category', 'personnel_doc_type').eq('organization_id', orgId).order('label', { ascending: true }),
        supabase.from('employee_documents').select('*, doc_type:doc_type_id(label)').eq('employee_id', personnelId).order('created_at', { ascending: false }),
        supabase.from('employee_salary_history').select('id, effective_date, monthly_salary').eq('profile_id', personnelId).order('effective_date', { ascending: false }),
      ]);

      setProfile(profileData);
      if (detailData) {
        setHireDate(detailData.hire_date || '');
        setPosition(detailData.position || '');
        setDepartment(detailData.department || '');
        setNotes(detailData.notes || '');
        setExitDate(detailData.exit_date || null);
      } else {
        setHireDate('');
        setPosition('');
        setDepartment('');
        setNotes('');
        setExitDate(null);
      }

      setAssignedClientIds((assignments || []).map((a: any) => a.client_id));

      setReportCount(reportsCount || 0);
      setRecentReports(reports || []);
      setDocumentCount(docsCount || 0);

      const allScores: number[] = [];
      (evals || []).forEach((e: any) => {
        if (e.scores && typeof e.scores === 'object') {
          Object.values(e.scores).forEach((v: any) => {
            if (typeof v === 'number') allScores.push(v);
          });
        }
      });
      setEvalSummary({
        count: (evals || []).length,
        avg: allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null,
      });

      setExpenses(exp || []);
      setDocTypes(docTypesData || []);
      setEmployeeDocs(employeeDocsData || []);
      setSalaryHistory(salaryHistoryData || []);
      setNewSalaryMonth(new Date().toISOString().slice(0, 7));
      setNewSalaryAmount('');
    } catch (err: any) {
      alert('Personel bilgileri yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      // İşe başlangıç tarihi girilip kaydedildiğinde, personel daha önce
      // "çıkarılmış" (exit_date dolu) ise bu yeniden işe alım kabul edilir
      // ve exit_date otomatik temizlenir.
      const { error } = await supabase.from('employee_details').upsert(
        {
          profile_id: personnelId,
          organization_id: orgId,
          hire_date: hireDate || null,
          position: position.trim() || null,
          department: department.trim() || null,
          notes: notes.trim() || null,
          exit_date: hireDate ? null : exitDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );
      if (error) throw error;
      setExitDate(hireDate ? null : exitDate);
      alert('Personel bilgileri kaydedildi!');
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Yeni bir "şu aydan itibaren maaş şu kadar" satırı ekler/düzeltir.
  // Sunucu tarafındaki trigger (employee_salary_history_trigger) bunu
  // otomatik olarak zaten üretilmiş aylara da (o aydan itibaren) işler.
  const handleAddSalaryHistory = async () => {
    if (!newSalaryAmount || parseFloat(newSalaryAmount) <= 0) {
      alert('Lütfen geçerli bir tutar girin.');
      return;
    }
    setSavingSalary(true);
    try {
      const effectiveDate = `${newSalaryMonth}-01`;
      const { error } = await supabase.from('employee_salary_history').upsert(
        {
          profile_id: personnelId,
          organization_id: orgId,
          effective_date: effectiveDate,
          monthly_salary: parseFloat(newSalaryAmount),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,effective_date' }
      );
      if (error) throw error;
      await fetchAll();
    } catch (err: any) {
      alert('Maaş kaydedilirken hata: ' + err.message);
    } finally {
      setSavingSalary(false);
    }
  };

  const handleUpdateExperience = async (val: number) => {
    setProfile((prev: any) => ({ ...prev, experience_years: val }));
    const { error } = await supabase.from('profiles').update({ experience_years: val }).eq('id', personnelId);
    if (error) {
      alert('Deneyim yılı güncellenirken hata: ' + error.message);
      fetchAll();
    }
  };

  const handleUpdateRole = async (role: string) => {
    setSavingRole(true);
    try {
      const updates: any = { role };
      if (role === 'normal') {
        updates.organization_id = null;
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', personnelId);
      if (error) throw error;

      if (role === 'normal') {
        await supabase.rpc('clear_membership_notifications', { target_user_id: personnelId });
        await supabase.from('employee_details').upsert(
          { profile_id: personnelId, organization_id: orgId, exit_date: new Date().toISOString().split('T')[0] },
          { onConflict: 'profile_id' }
        );
        onMemberChanged();
        onClose();
        return;
      }

      setProfile((prev: any) => ({ ...prev, role }));
      onMemberChanged();
    } catch (err: any) {
      alert('Rol güncellenirken hata: ' + err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleTogglePermission = async (key: string, value: boolean) => {
    setSavingPerm(key);
    try {
      const updatedPerms = { ...(profile.extra_permissions || {}), [key]: value };
      const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', personnelId);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, extra_permissions: updatedPerms }));
      onMemberChanged();
    } catch (err: any) {
      alert('Yetki güncellenirken hata: ' + err.message);
    } finally {
      setSavingPerm(null);
    }
  };

  const handleTogglePremiumSeat = async () => {
    setTogglingPremium(true);
    try {
      const newValue = profile.premium_seat_active === false;
      const { error } = await supabase.from('profiles').update({ premium_seat_active: newValue }).eq('id', personnelId);
      if (error) throw error;
      setProfile((prev: any) => ({ ...prev, premium_seat_active: newValue }));
      onMemberChanged();
    } catch (err: any) {
      alert('Premium koltuk güncellenirken hata: ' + err.message);
    } finally {
      setTogglingPremium(false);
    }
  };

  const handleToggleAssignment = async (clientId: string) => {
    const isAssigned = assignedClientIds.includes(clientId);
    try {
      if (isAssigned) {
        const { error } = await supabase.from('consultant_assignments').delete().eq('client_id', clientId).eq('user_id', personnelId);
        if (error) throw error;
        setAssignedClientIds((prev) => prev.filter((id) => id !== clientId));
      } else {
        const client = clients.find((c) => c.id === clientId);
        if (client?.permit_stage === 'ek1' || client?.ced_status === 'ek1') {
          const experience = profile?.experience_years || 0;
          if (experience < 3) {
            alert(`Atama Hatası: EK-1 kapsamındaki işletmelere çevre yönetimi hizmeti verecek personelin en az 3 yıl mesleki tecrübeye sahip olması gerekmektedir. Bu personelin deneyimi: ${experience} Yıl.`);
            return;
          }
        }
        const { error } = await supabase.from('consultant_assignments').insert([{ client_id: clientId, user_id: personnelId }]);
        if (error) throw error;
        setAssignedClientIds((prev) => [...prev, clientId]);
      }
    } catch (err: any) {
      alert('Atama güncellenirken hata: ' + err.message);
    }
  };

  const handleOpenKick = () => {
    if (profile?.role === 'premium_corporate') {
      alert('Firma sahibi çıkarılamaz.');
      return;
    }
    setShowExitModal(true);
  };

  const handleKick = async (exitDate: string) => {
    setKicking(true);
    try {
      const { error } = await supabase.rpc('kick_employee_with_exit_date', {
        p_profile_id: personnelId,
        p_org_id: orgId,
        p_exit_date: exitDate,
      });
      if (error) throw error;
      await supabase.rpc('clear_membership_notifications', { target_user_id: personnelId });
      setShowExitModal(false);
      onMemberChanged();
      onClose();
    } catch (err: any) {
      alert('Çıkarılırken hata oluştu: ' + err.message);
    } finally {
      setKicking(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpenseAmount) {
      alert('Lütfen tutar girin.');
      return;
    }
    setSavingExpense(true);
    try {
      const { error } = await supabase.from('company_expenses').insert({
        consultant_company_id: orgId,
        title: newExpenseTitle.trim() || 'Maaş Ödemesi',
        category: 'Maaş/Personel',
        amount: parseFloat(newExpenseAmount),
        expense_date: newExpenseDate,
        employee_id: personnelId,
      });
      if (error) throw error;
      setNewExpenseAmount('');
      setNewExpenseTitle('Maaş Ödemesi');
      setShowAddExpense(false);
      fetchAll();
    } catch (err: any) {
      alert('Gider eklenirken hata: ' + err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
    const { error } = await supabase.from('company_expenses').delete().eq('id', id);
    if (error) return alert('Silinirken hata: ' + error.message);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleAddDocType = async () => {
    const label = newDocTypeLabel.trim();
    if (!label) return;
    const exists = docTypes.some((t) => t.label.trim().toLowerCase() === label.toLowerCase());
    if (exists) {
      alert(`"${label}" zaten listede mevcut.`);
      return;
    }
    setSavingDocType(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('user_definitions')
        .insert([{ user_id: session.user.id, category: 'personnel_doc_type', label, organization_id: orgId }])
        .select()
        .single();
      if (error) throw error;
      setDocTypes((prev) => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)));
      setSelectedDocTypeId(data.id);
      setNewDocTypeLabel('');
      setShowNewDocType(false);
    } catch (err: any) {
      alert('Belge türü eklenirken hata: ' + err.message);
    } finally {
      setSavingDocType(false);
    }
  };

  const handleUploadDoc = async () => {
    if (!selectedDocTypeId) {
      alert('Lütfen önce bir belge türü seçin.');
      return;
    }
    if (!docFile) {
      alert('Lütfen bir dosya seçin.');
      return;
    }
    setUploadingDoc(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const filePath = `personnel-docs/${orgId}/${personnelId}/${Date.now()}-${docFile.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, docFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      const { error } = await supabase.from('employee_documents').insert({
        employee_id: personnelId,
        organization_id: orgId,
        doc_type_id: selectedDocTypeId,
        file_url: urlData.publicUrl,
        file_name: docFile.name,
        uploaded_by: session.user.id,
      });
      if (error) throw error;
      setDocFile(null);
      fetchAll();
    } catch (err: any) {
      alert('Belge yüklenirken hata: ' + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm('Bu belgeyi silmek istediğinize emin misiniz?')) return;
    const { error } = await supabase.from('employee_documents').delete().eq('id', id);
    if (error) return alert('Silinirken hata: ' + error.message);
    setEmployeeDocs((prev) => prev.filter((d) => d.id !== id));
  };

  if (viewerRole !== 'premium_corporate') return null;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalQuotaDays = assignedClientIds.reduce((sum, cid) => {
    const client = clients.find((c) => c.id === cid);
    if (client?.permit_stage === 'ek1') return sum + 2;
    if (client?.permit_stage === 'ek2') return sum + 1;
    return sum;
  }, 0);
  const quotaPercent = Math.min((totalQuotaDays / 16) * 100, 100);
  const quotaExceeded = totalQuotaDays > 16;
  const permList = profile?.role === 'corporate_chief' ? PERMS_CHIEF : profile?.role === 'corporate_staff' ? PERMS_STAFF : [];
  // salaryHistory effective_date DESC sıralı geldiği için, bugüne <= olan ilk satır güncel maaştır.
  const todayStr = new Date().toISOString().split('T')[0];
  const currentSalary = salaryHistory.find((s) => s.effective_date <= todayStr)?.monthly_salary ?? null;

  const AmountMask = ({ value }: { value: string }) =>
    amountsVisible ? (
      <>{value}</>
    ) : (
      <span className="tracking-widest select-none">••••••</span>
    );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700 animate-scaleIn">
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white sticky top-0 z-10">
          <h3 className="font-bold text-base flex items-center gap-2">
            <User size={18} /> Personel Kartı
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-white transition">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader className="animate-spin text-blue-600" size={28} />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Kimlik */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/30 flex items-center justify-center font-bold text-lg uppercase shrink-0">
                  {profile?.full_name?.charAt(0) || <User size={24} />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-lg text-gray-800 dark:text-white">{profile?.full_name}</div>
                  <div className="text-xs text-blue-600 font-bold">{roleLabels[profile?.role] || profile?.role}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {profile?.email}
                    </span>
                    {profile?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {profile.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAmountsVisible((v) => !v)}
                title={amountsVisible ? 'Hassas bilgileri gizle' : 'Maaş/gider bilgilerini göster'}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                  amountsVisible
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-700'
                }`}
              >
                {amountsVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                {amountsVisible ? 'Gizle' : 'Maaşı Göster'}
              </button>
            </div>

            {exitDate && (
              <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                <p className="text-xs text-rose-700 dark:text-rose-400 font-bold">
                  Bu personel {new Date(exitDate).toLocaleDateString('tr-TR')} tarihinde işten ayrılmış görünüyor. Yeniden işe alındıysa aşağıya yeni bir "İşe Başlangıç Tarihi" girip kaydedin — bu, ayrılış kaydını otomatik temizler.
                </p>
              </div>
            )}

            {/* Sekme çubuğu */}
            <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-thin -mx-1 px-1 pb-1">
              {CARD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCardTab(tab.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition ${
                    activeCardTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Genel Bilgiler: İşe alım bilgileri (düzenlenebilir) */}
            {activeCardTab === 'genel' && (
            <>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Briefcase size={13} /> İşe Alım Bilgileri
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">İşe Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Pozisyon</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Örn: Çevre Mühendisi"
                    className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Departman</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Örn: Saha Operasyonları"
                    className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Güncel Maaş (TL)</label>
                  <button
                    type="button"
                    onClick={() => setAmountsVisible((v) => !v)}
                    className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold text-slate-500 flex items-center justify-between"
                  >
                    <AmountMask value={currentSalary != null ? `${Number(currentSalary).toLocaleString('tr-TR')} TL` : 'Belirlenmedi'} />
                    <Eye size={13} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Not</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveDetails}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* Maaş Geçmişi: tarih-etkili maaş/zam satırları */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Wallet size={13} /> Maaş Geçmişi
              </h4>
              <p className="text-[10px] text-slate-400">
                Yeni bir satır eklemek, seçtiğiniz aydan itibaren (o ay dahil, bugüne kadar zaten oluşmuş otomatik giderler dahil) maaşı günceller — öncesindeki aylar etkilenmez.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Geçerlilik Ayı</label>
                  <input
                    type="month"
                    value={newSalaryMonth}
                    onChange={(e) => setNewSalaryMonth(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Aylık Maaş (TL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSalaryAmount}
                    onChange={(e) => setNewSalaryAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddSalaryHistory}
                    disabled={savingSalary}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {savingSalary ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                    {savingSalary ? 'Kaydediliyor...' : 'Ekle / Düzelt'}
                  </button>
                </div>
              </div>

              {salaryHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Henüz maaş girilmemiş.</p>
              ) : (
                <div className="space-y-1.5">
                  {salaryHistory.map((s) => (
                    <div key={s.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {new Date(s.effective_date + 'T00:00:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}'dan itibaren
                      </span>
                      <span className="font-bold text-blue-600">
                        <AmountMask value={`${Number(s.monthly_salary).toLocaleString('tr-TR')} TL`} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}

            {/* Görev & Atamalar: Deneyim yılı + iş günü kotası */}
            {activeCardTab === 'gorev' && profile?.role !== 'normal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 px-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Deneyim Yılı:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={profile?.experience_years ?? 0}
                      onChange={(e) => handleUpdateExperience(parseInt(e.target.value) || 0)}
                      className="w-16 border rounded px-1.5 py-0.5 text-center bg-white dark:bg-slate-900 dark:border-slate-700 font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-500">Yıl</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                    <span>İş Günü Kotası</span>
                    <span className={quotaExceeded ? 'text-rose-600 font-black' : 'text-gray-650 dark:text-gray-300 font-black'}>
                      {totalQuotaDays} / 16 Gün ({((totalQuotaDays / 16) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-250 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${quotaPercent}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        quotaExceeded ? 'bg-rose-500' : totalQuotaDays > 12 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rol & Yetkiler */}
            {activeCardTab === 'rol' && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <ShieldCheck size={13} /> Rol &amp; Yetkiler
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-bold">ROL:</span>
                  <select
                    value={profile?.role}
                    disabled={savingRole}
                    onChange={(e) => handleUpdateRole(e.target.value)}
                    className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 font-bold text-blue-700 dark:text-blue-400 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="premium_corporate">Çevre Danışmanlık Firma Sahibi</option>
                    <option value="corporate_chief">Çevre Danışmanlık Firma Yöneticisi</option>
                    <option value="corporate_staff">Çevre Danışmanlık Personeli</option>
                    <option value="normal">Normal (Ekip Dışı)</option>
                  </select>
                </div>

                <button
                  onClick={handleTogglePremiumSeat}
                  disabled={togglingPremium}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border font-bold transition disabled:opacity-50 ${
                    profile?.premium_seat_active === false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-900 dark:border-slate-700'
                  }`}
                >
                  <Crown size={13} /> {profile?.premium_seat_active === false ? 'Premium Ver' : 'Premium Al'}
                </button>
              </div>

              {permList.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  {permList.map((p) => {
                    const checked = p.defaultTrue ? profile?.extra_permissions?.[p.key] !== false : !!profile?.extra_permissions?.[p.key];
                    return (
                      <label key={p.key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={savingPerm === p.key}
                          onChange={(e) => handleTogglePermission(p.key, e.target.checked)}
                          className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        {p.label}
                      </label>
                    );
                  })}
                  {profile?.role === 'corporate_staff' && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!profile?.extra_permissions?.can_upload_personal_docs}
                        disabled={savingPerm === 'can_upload_personal_docs'}
                        onChange={(e) => handleTogglePermission('can_upload_personal_docs', e.target.checked)}
                        className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      Şahsi Belge Yükleme
                    </label>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Görev & Atamalar: Atandığı işletmeler */}
            {activeCardTab === 'gorev' && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <Building size={13} /> Atandığı İşletmeler ({assignedClientIds.length})
              </h4>
              {clients.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Organizasyona ait işletme bulunamadı.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                  {clients.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${
                        assignedClientIds.includes(c.id)
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 font-bold'
                          : 'bg-white text-gray-500 border-gray-100 dark:bg-slate-900/50 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedClientIds.includes(c.id)}
                        onChange={() => handleToggleAssignment(c.id)}
                        className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Raporlar & Performans */}
            {activeCardTab === 'raporlar' && (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-3 text-center">
                <FileText size={16} className="mx-auto text-blue-600 mb-1" />
                <div className="text-lg font-black text-gray-800 dark:text-white">{reportCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Oluşturduğu Rapor</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-3 text-center">
                <FileText size={16} className="mx-auto text-teal-600 mb-1" />
                <div className="text-lg font-black text-gray-800 dark:text-white">{documentCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Yüklediği Belge</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-3 text-center">
                <Star size={16} className="mx-auto text-amber-500 mb-1" />
                <div className="text-lg font-black text-gray-800 dark:text-white">
                  {evalSummary.avg != null ? evalSummary.avg.toFixed(1) : '-'}
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">{evalSummary.count} Değerlendirme Ort.</div>
              </div>
            </div>

            {recentReports.length > 0 && (
              <div className="space-y-1.5">
                {recentReports.map((r) => (
                  <Link
                    key={r.id}
                    to={`/consultant/reports/${r.id}`}
                    className="flex justify-between items-center text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition"
                  >
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      {r.client?.name || 'Bilinmeyen Firma'} — {r.report_type === 'monthly' ? 'Aylık' : 'Yıllık'}
                    </span>
                    <span className="text-slate-400">{r.report_date ? new Date(r.report_date).toLocaleDateString('tr-TR') : ''}</span>
                  </Link>
                ))}
              </div>
            )}
            </>
            )}

            {/* Giderler: Maaş Geçmişi (Yıl/Ay) + Personel Giderleri */}
            {activeCardTab === 'giderler' && (
            <>
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <Wallet size={13} /> Maaş Geçmişi (Yıl/Ay)
              </h4>
              {(() => {
                const autoSalaryExpenses = expenses.filter((e) => e.is_auto_salary);
                if (autoSalaryExpenses.length === 0) {
                  return <p className="text-xs text-slate-400 italic">Henüz otomatik oluşmuş maaş gideri yok.</p>;
                }
                const byYear = new Map<string, any[]>();
                autoSalaryExpenses.forEach((e) => {
                  const year = String(new Date(e.expense_date).getFullYear());
                  if (!byYear.has(year)) byYear.set(year, []);
                  byYear.get(year)!.push(e);
                });
                const years = Array.from(byYear.keys()).sort((a, b) => Number(b) - Number(a));
                return (
                  <div className="space-y-3">
                    {years.map((year) => {
                      const rows = byYear.get(year)!.sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());
                      const yearTotal = rows.reduce((sum, r) => sum + Number(r.amount), 0);
                      return (
                        <div key={year} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                          <div className="flex justify-between items-center px-3 py-2 bg-slate-100 dark:bg-slate-800">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-300">{year}</span>
                            <span className="text-xs font-bold text-blue-600">
                              <AmountMask value={`${yearTotal.toLocaleString('tr-TR')} TL`} />
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.map((r) => (
                              <div key={r.id} className="flex justify-between items-center px-3 py-1.5 text-xs">
                                <span className="text-slate-500 dark:text-slate-400">
                                  {new Date(r.expense_date).toLocaleDateString('tr-TR', { month: 'long' })}
                                </span>
                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                  <AmountMask value={`${Number(r.amount).toLocaleString('tr-TR')} TL`} />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Wallet size={13} /> Personel Giderleri (<AmountMask value={`${Number(totalExpenses).toLocaleString('tr-TR')} TL`} />)
                </h4>
                <button
                  onClick={() => setShowAddExpense((v) => !v)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Gider Ekle
                </button>
              </div>

              {showAddExpense && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-3 mb-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newExpenseTitle}
                      onChange={(e) => setNewExpenseTitle(e.target.value)}
                      placeholder="Açıklama"
                      className="p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                      placeholder="Tutar (TL)"
                      className="p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={newExpenseDate}
                      onChange={(e) => setNewExpenseDate(e.target.value)}
                      className="p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddExpense}
                      disabled={savingExpense}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      {savingExpense ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              {expenses.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Bu personele bağlı bir gider kaydı yok.</p>
              ) : (
                <div className="space-y-1.5">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                      <div>
                        <div className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          {exp.title}
                          {exp.is_auto_salary && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 font-black uppercase">Otomatik</span>
                          )}
                        </div>
                        <div className="text-slate-400">{new Date(exp.expense_date).toLocaleDateString('tr-TR')}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-rose-600">
                          <AmountMask value={`${Number(exp.amount).toLocaleString('tr-TR')} TL`} />
                        </span>
                        <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-400 hover:text-red-600 transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}

            {/* Belgeler */}
            {activeCardTab === 'belgeler' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Paperclip size={13} /> Belge Yükle
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Belge Türü</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedDocTypeId}
                        onChange={(e) => setSelectedDocTypeId(e.target.value)}
                        className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Seçiniz...</option>
                        {docTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewDocType((v) => !v)}
                        title="Yeni Belge Türü Ekle"
                        className="shrink-0 p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {showNewDocType && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={newDocTypeLabel}
                          onChange={(e) => setNewDocTypeLabel(e.target.value)}
                          placeholder="Örn: SGK Sicil Belgesi"
                          className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAddDocType}
                          disabled={savingDocType || !newDocTypeLabel.trim()}
                          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                        >
                          {savingDocType ? '...' : 'Ekle'}
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">Oluşturduğunuz belge türü diğer personellerin kartında da seçenek olarak görünür.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Dosya</label>
                    <input
                      type="file"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      className="w-full p-1.5 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleUploadDoc}
                    disabled={uploadingDoc}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {uploadingDoc ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingDoc ? 'Yükleniyor...' : 'Yükle'}
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                  <Paperclip size={13} /> Yüklü Belgeler ({employeeDocs.length})
                </h4>
                {employeeDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Bu personele bağlı bir belge yok.</p>
                ) : (
                  <div className="space-y-1.5">
                    {employeeDocs.map((d) => (
                      <div key={d.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-700 dark:text-gray-300">{d.doc_type?.label || 'Belirtilmemiş Tür'}</div>
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 truncate">
                            <ExternalLink size={11} /> {d.file_name}
                          </a>
                          <div className="text-slate-400">{new Date(d.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                        <button onClick={() => handleDeleteDoc(d.id)} className="shrink-0 text-red-400 hover:text-red-600 transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Çıkar */}
            {profile?.role !== 'premium_corporate' && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <button
                  onClick={handleOpenKick}
                  disabled={kicking}
                  className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-4 py-2 rounded-lg transition disabled:opacity-50 dark:bg-red-950/20 dark:border-red-900"
                >
                  <LogOut size={14} /> {kicking ? 'Çıkarılıyor...' : 'Şirketten Çıkar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showExitModal && (
        <ExitDateModal
          memberName={profile?.full_name || ''}
          loading={kicking}
          onConfirm={handleKick}
          onCancel={() => setShowExitModal(false)}
        />
      )}
    </div>
  );
}
