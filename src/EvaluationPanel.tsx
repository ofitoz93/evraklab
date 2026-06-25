import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Star,
  Calendar,
  User,
  Building,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  PlusCircle,
  ChevronRight,
  TrendingUp,
  Award,
  Users,
  Settings,
  ArrowRight,
  ClipboardList,
  MessageSquare,
} from 'lucide-react';

interface Period {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
  organization_id: string;
  allow_chief_evaluations: boolean;
}


interface Evaluation {
  id: string;
  period_id: string;
  evaluator_id: string | null;
  evaluatee_id: string;
  client_id: string | null;
  evaluator_type: 'manager' | 'client';
  scores: Record<string, number>;
  comments: string;
  created_at: string;
  evaluator_name?: string;
  evaluatee_name?: string;
  client_name?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Client {
  id: string;
  name: string;
}

interface ClientToken {
  id: string;
  period_id: string;
  staff_id: string;
  client_id: string;
  token: string;
  is_used: boolean;
  expires_at: string;
  created_at: string;
  staff?: { full_name: string };
  client?: { name: string };
}

// 5 Core Categories & Questions Mapping
const CORE_CATEGORIES = [
  {
    id: 'technical',
    title: 'A. Teknik Yetkinlik ve Uzmanlık (Ağırlık: %25)',
    weight: 0.25,
    questions: [
      { id: 'tech_q1', text: 'Çevre mevzuatı, yönetmelikler ve teknik konulardaki bilgi düzeyi ne kadar yeterli?' },
      { id: 'tech_q2', text: 'Raporlar, ölçümler, izin süreçleri ve proje çalışmalarındaki teknik kalitesi nasıl?' },
      { id: 'tech_q3', text: 'Karşılaşılan sorunlara çözüm üretme ve alternatif önerilerde bulunma becerisi nasıl?' }
    ]
  },
  {
    id: 'quality',
    title: 'B. İş Kalitesi ve Teslimat (Ağırlık: %25)',
    weight: 0.25,
    questions: [
      { id: 'qual_q1', text: 'Verdiği rapor, belge ve çıktıların doğruluğu, eksiksizliği ve zamanındalığı nasıl?' },
      { id: 'qual_q2', text: 'Detaycılık ve hata oranı ne düzeyde?' },
      { id: 'qual_q3', text: 'Proje takibinde proaktif davranma ve riskleri önceden fark etme becerisi nasıl?' }
    ]
  },
  {
    id: 'communication',
    title: 'C. İletişim ve İlişkiler (Ağırlık: %20)',
    weight: 0.20,
    questions: [
      { id: 'comm_q1', text: 'Müşteri / ekip ile iletişim tarzı ve yanıt verme hızı nasıl?' },
      { id: 'comm_q2', text: 'Karşı tarafı bilgilendirme, sunum ve raporlama becerisi yeterli mi?' },
      { id: 'comm_q3', text: 'Sorun yaşadığında çözüm odaklı ve yapıcı tutum sergiliyor mu?' }
    ]
  },
  {
    id: 'responsibility',
    title: 'D. Sorumluluk ve Güvenilirlik (Ağırlık: %15)',
    weight: 0.15,
    questions: [
      { id: 'resp_q1', text: 'Görevlere sahiplenme, taahhütlerine uyma ve takip etme düzeyi nasıl?' },
      { id: 'resp_q2', text: 'Çalışma disiplini, zaman yönetimi ve etik yaklaşımı ne durumda?' },
      { id: 'resp_q3', text: 'Ekibin / projenin genel başarısına katkısı ne düzeyde?' }
    ]
  },
  {
    id: 'development',
    title: 'E. Gelişim ve İnisiyatif (Ağırlık: %15)',
    weight: 0.15,
    questions: [
      { id: 'dev_q1', text: 'Yeni bilgi öğrenme, kendini geliştirme çabası var mı?' },
      { id: 'dev_q2', text: 'Süreç iyileştirme önerisi getiriyor mu?' },
      { id: 'dev_q3', text: 'Ek sorumluluk alma ve inisiyatif kullanma düzeyi nasıl?' }
    ]
  }
];

const MANAGER_SPECIAL_QUESTIONS = [
  { id: 'mng_q1', text: 'Firmamızın iç prosedürlerine (kalite yönetim sistemi, dokümantasyon, faturalama vb.) uyum düzeyi?' },
  { id: 'mng_q2', text: 'Takım çalışması ve diğer danışmanlarla koordinasyonu nasıl?' },
  { id: 'mng_q3', text: 'Firma içi eğitimlere / mentorluğa katkısı?' },
  { id: 'mng_q4', text: 'Genel olarak firmaya kattığı değer nedir?' }
];

export default function EvaluationPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('normal');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Sub-tabs
  const [subTab, setSubTab] = useState<'results' | 'periods' | 'submit' | 'tokens'>('results');

  // Database Data States
  const [periods, setPeriods] = useState<Period[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tokens, setTokens] = useState<ClientToken[]>([]);

  // Period Form fields
  const [periodTitle, setPeriodTitle] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [allowChiefEvaluations, setAllowChiefEvaluations] = useState(false);


  // Submit Evaluation fields
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedEvaluateeId, setSelectedEvaluateeId] = useState('');
  const [evalScores, setEvalScores] = useState<Record<string, number>>({});
  const [evalComments, setEvalComments] = useState('');
  const [submittingEval, setSubmittingEval] = useState(false);

  // Client Token Form fields
  const [tokenStaffId, setTokenStaffId] = useState('');
  const [tokenClientId, setTokenClientId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // Selected Employee Card Modal/Details state
  const [selectedEmployeeCard, setSelectedEmployeeCard] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserId(session.user.id);
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, organization_id')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setUserRole(profile.role);
            setOrgId(profile.organization_id);
          }
        }
      } catch (err) {
        console.error('Initialization error in EvaluationPanel:', err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId, subTab]);

  useEffect(() => {
    if (subTab === 'submit' && isChief && activePeriod && !activePeriod.allow_chief_evaluations) {
      setSubTab('results');
    }
  }, [subTab, userRole, periods]);


  const fetchData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Fetch periods
      const { data: periodsData } = await supabase
        .from('evaluation_periods')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      setPeriods(periodsData || []);

      if (periodsData && periodsData.length > 0 && !selectedPeriodId) {
        // Set latest period as default
        const active = periodsData.find(p => p.status === 'active');
        setSelectedPeriodId(active ? active.id : periodsData[0].id);
      }

      // 2. Fetch profiles/members in organization
      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', orgId);
      setMembers(membersData || []);

      // 3. Fetch clients
      const { data: clientsData } = await supabase
        .from('consultant_clients')
        .select('id, name')
        .order('name');
      setClients(clientsData || []);

      // 4. Fetch evaluations
      const { data: evalsData } = await supabase
        .from('evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      // Join profile names and client names manually
      const enrichedEvals = (evalsData || []).map(ev => {
        const evaluator = membersData?.find(m => m.id === ev.evaluator_id);
        const evaluatee = membersData?.find(m => m.id === ev.evaluatee_id);
        const client = clientsData?.find(c => c.id === ev.client_id);
        return {
          ...ev,
          evaluator_name: evaluator ? evaluator.full_name : (ev.evaluator_type === 'client' ? 'Müşteri Temsilcisi' : 'Sistem'),
          evaluatee_name: evaluatee ? evaluatee.full_name : 'Bilinmeyen Personel',
          client_name: client ? client.name : undefined
        };
      });
      setEvaluations(enrichedEvals);

      // 5. Fetch tokens (only for managers/owners)
      if (['premium_corporate', 'corporate_chief', 'admin', 'system_admin'].includes(userRole)) {
        const { data: tokensData } = await supabase
          .from('evaluation_client_tokens')
          .select('*')
          .order('created_at', { ascending: false });
        
        const enrichedTokens = (tokensData || []).map(tk => {
          const staff = membersData?.find(m => m.id === tk.staff_id);
          const client = clientsData?.find(c => c.id === tk.client_id);
          return {
            ...tk,
            staff: staff ? { full_name: staff.full_name } : undefined,
            client: client ? { name: client.name } : undefined
          };
        });
        setTokens(enrichedTokens);
      }

    } catch (err) {
      console.error('Error fetching evaluation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    if (!periodTitle.trim() || !periodStart || !periodEnd) {
      return alert('Lütfen tüm alanları doldurun.');
    }

    try {
      const { error } = await supabase
        .from('evaluation_periods')
        .insert({
          organization_id: orgId,
          title: periodTitle.trim(),
          start_date: periodStart,
          end_date: periodEnd,
          status: 'active',
          allow_chief_evaluations: allowChiefEvaluations
        });

      if (error) throw error;
      alert('Değerlendirme dönemi başarıyla açıldı!');
      setPeriodTitle('');
      setPeriodStart('');
      setPeriodEnd('');
      setAllowChiefEvaluations(false);
      fetchData();
    } catch (err: any) {
      alert('Dönem oluşturulurken hata: ' + err.message);
    }
  };

  const handleTogglePeriodStatus = async (id: string, currentStatus: 'active' | 'closed') => {
    try {
      const nextStatus = currentStatus === 'active' ? 'closed' : 'active';
      const { error } = await supabase
        .from('evaluation_periods')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Dönem güncellenirken hata: ' + err.message);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!window.confirm('Bu değerlendirme dönemini ve bu döneme ait tüm oylamaları silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('evaluation_periods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Dönem silinirken hata: ' + err.message);
    }
  };

  const handleScoreChange = (qId: string, rating: number) => {
    setEvalScores(prev => ({
      ...prev,
      [qId]: rating
    }));
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId) return alert('Lütfen aktif bir değerlendirme dönemi seçin.');
    if (!selectedEvaluateeId) return alert('Lütfen değerlendirilecek personeli seçin.');

    // Validate that all questions are answered
    // Determine evaluatee role to see which questions are required
    const targetUser = members.find(m => m.id === selectedEvaluateeId);
    if (!targetUser) return alert('Seçilen personel bulunamadı.');

    const requiredQuestions: string[] = [];
    CORE_CATEGORIES.forEach(cat => {
      cat.questions.forEach(q => requiredQuestions.push(q.id));
    });
    
    // Add manager special questions (Kurumsal uyum)
    MANAGER_SPECIAL_QUESTIONS.forEach(q => requiredQuestions.push(q.id));

    const unanswered = requiredQuestions.filter(qId => !evalScores[qId]);
    if (unanswered.length > 0) {
      return alert('Lütfen formdaki tüm soruları puanlayın (En az 1 yıldız).');
    }

    setSubmittingEval(true);
    try {
      const { error } = await supabase
        .from('evaluations')
        .insert({
          period_id: selectedPeriodId,
          evaluator_id: userId,
          evaluatee_id: selectedEvaluateeId,
          evaluator_type: 'manager',
          scores: evalScores,
          comments: evalComments.trim() || null
        });

      if (error) throw error;
      alert('Değerlendirme formu başarıyla kaydedildi!');
      setSelectedEvaluateeId('');
      setEvalScores({});
      setEvalComments('');
      setSubTab('results');
      fetchData();
    } catch (err: any) {
      alert('Değerlendirme kaydedilirken hata: ' + err.message);
    } finally {
      setSubmittingEval(false);
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePeriod = periods.find(p => p.status === 'active');
    if (!activePeriod) return alert('Müşteri anketi oluşturmak için aktif bir değerlendirme dönemi olmalıdır.');
    if (!tokenStaffId) return alert('Lütfen değerlendirilecek danışman personeli seçin.');
    if (!tokenClientId) return alert('Lütfen değerlendirecek müşteri firmayı seçin.');

    try {
      const randToken = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
      // Expire in 14 days
      const expires = new Date();
      expires.setDate(expires.getDate() + 14);

      const { error } = await supabase
        .from('evaluation_client_tokens')
        .insert({
          period_id: activePeriod.id,
          staff_id: tokenStaffId,
          client_id: tokenClientId,
          token: randToken,
          expires_at: expires.toISOString()
        });

      if (error) throw error;

      const link = `${window.location.origin}/evaluate-client/${randToken}`;
      setGeneratedLink(link);
      setTokenStaffId('');
      setTokenClientId('');
      fetchData();
    } catch (err: any) {
      alert('Link oluşturulurken hata: ' + err.message);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    alert('Link panoya kopyalandı!');
  };

  const handleReopenToken = async (tokenId: string) => {
    const tk = tokens.find(t => t.id === tokenId);
    if (!tk) return;

    if (!window.confirm('Bu anket linkini yeniden açmak istediğinize emin misiniz? Müşterinin bu link için daha önce yaptığı değerlendirme silinecektir.')) return;

    try {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 14);

      // 1. Delete client evaluation for this token
      const { error: evalDeleteErr } = await supabase
        .from('evaluations')
        .delete()
        .eq('period_id', tk.period_id)
        .eq('client_id', tk.client_id)
        .eq('evaluatee_id', tk.staff_id)
        .eq('evaluator_type', 'client');

      if (evalDeleteErr) throw evalDeleteErr;

      // 2. Update token
      const { error } = await supabase
        .from('evaluation_client_tokens')
        .update({
          is_used: false,
          expires_at: newExpiry.toISOString()
        })
        .eq('id', tokenId);

      if (error) throw error;
      alert('Anket linki yeniden kullanıma açıldı, eski değerlendirme silindi ve süresi 14 gün uzatıldı!');
      fetchData();
    } catch (err: any) {
      alert('Link açılırken hata: ' + err.message);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    const tk = tokens.find(t => t.id === tokenId);
    if (!tk) return;

    if (!window.confirm('Bu anket linkini silmek istediğinize emin misiniz? (Müşterinin yaptığı değerlendirme de silinecektir)')) return;

    try {
      // 1. Delete client evaluation for this token
      const { error: evalDeleteErr } = await supabase
        .from('evaluations')
        .delete()
        .eq('period_id', tk.period_id)
        .eq('client_id', tk.client_id)
        .eq('evaluatee_id', tk.staff_id)
        .eq('evaluator_type', 'client');

      if (evalDeleteErr) throw evalDeleteErr;

      // 2. Delete token
      const { error } = await supabase
        .from('evaluation_client_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;
      alert('Anket linki ve ilişkili değerlendirme silindi!');
      fetchData();
    } catch (err: any) {
      alert('Link silinirken hata: ' + err.message);
    }
  };


  // Helper values
  const isOwner = ['premium_corporate', 'admin', 'system_admin'].includes(userRole);
  const isChief = userRole === 'corporate_chief';
  const isStaff = userRole === 'corporate_staff';
  const activePeriod = periods.find(p => p.status === 'active');

  // Filter members list that can be evaluated:
  // - Owner can evaluate anyone (both chiefs and staff).
  // - Chief can evaluate corporate_staff.
  const evaluableMembers = members.filter(m => {
    if (m.id === userId) return false; // Can't evaluate self
    if (isOwner) return m.role === 'corporate_staff' || m.role === 'corporate_chief';
    if (isChief) return m.role === 'corporate_staff';
    return false;
  });

  // Calculate scores function
  const calculateEmployeeCard = (staffId: string, periodId: string) => {
    const staff = members.find(m => m.id === staffId);
    if (!staff) return null;

    // Get evaluations for this staff in this period
    const staffEvals = evaluations.filter(ev => ev.evaluatee_id === staffId && ev.period_id === periodId);
    
    // Separate by evaluator_type
    const managerEvals = staffEvals.filter(ev => ev.evaluator_type === 'manager');
    const clientEvals = staffEvals.filter(ev => ev.evaluator_type === 'client');

    if (staffEvals.length === 0) return null;

    // Helper to extract category average out of 5
    const getCategoryAverage = (evals: Evaluation[], catId: string) => {
      if (evals.length === 0) return 0;
      let totalRatingSum = 0;
      let count = 0;

      // Determine which questions belong to this category
      const qIds: string[] = [];
      const coreCat = CORE_CATEGORIES.find(c => c.id === catId);
      if (coreCat) {
        coreCat.questions.forEach(q => qIds.push(q.id));
      }

      // Map special questions into categories
      if (catId === 'communication') {
        qIds.push('mng_q2'); // teamwork maps to communication
        qIds.push('cli_spec_q2'); // understanding needs maps to communication
      } else if (catId === 'responsibility') {
        qIds.push('mng_q1'); // procedures maps to responsibility
        qIds.push('mng_q4'); // firm value maps to responsibility
        qIds.push('cli_spec_q1'); // professionalism maps to responsibility
      } else if (catId === 'development') {
        qIds.push('mng_q3'); // mentor maps to development
        qIds.push('cli_spec_q4'); // repeat preference maps to development
      } else if (catId === 'technical') {
        qIds.push('cli_q2'); // field dominance maps to tech
        qIds.push('cli_q3'); // solution oriented maps to tech
      } else if (catId === 'quality') {
        qIds.push('cli_spec_q3'); // permit support maps to quality
      }

      evals.forEach(ev => {
        qIds.forEach(qId => {
          if (ev.scores[qId]) {
            totalRatingSum += ev.scores[qId];
            count++;
          }
        });
      });

      return count > 0 ? totalRatingSum / count : 0;
    };

    // Calculate manager components (A to E)
    let managerScore = 0;
    let managerCatScores: Record<string, number> = {};
    if (managerEvals.length > 0) {
      let weightedSum = 0;
      CORE_CATEGORIES.forEach(cat => {
        const catAvg = getCategoryAverage(managerEvals, cat.id);
        managerCatScores[cat.id] = catAvg;
        weightedSum += catAvg * cat.weight;
      });
      managerScore = weightedSum * 20; // Scale 1-5 to 100
    }

    // Calculate client components (A to E)
    let clientScore = 0;
    let clientCatScores: Record<string, number> = {};
    if (clientEvals.length > 0) {
      let weightedSum = 0;
      CORE_CATEGORIES.forEach(cat => {
        const catAvg = getCategoryAverage(clientEvals, cat.id);
        clientCatScores[cat.id] = catAvg;
        weightedSum += catAvg * cat.weight;
      });
      clientScore = weightedSum * 20; // Scale 1-5 to 100
    }

    // Weighted Score Formula: 60% Manager + 40% Client
    let finalScore = 0;
    if (managerEvals.length > 0 && clientEvals.length > 0) {
      finalScore = (managerScore * 0.60) + (clientScore * 0.40);
    } else if (managerEvals.length > 0) {
      finalScore = managerScore; // Fallback if no client rating yet
    } else if (clientEvals.length > 0) {
      finalScore = clientScore;
    }

    // Determine performance level
    const scoreVal = finalScore / 20; // 5-scale equivalent
    let performanceLabel = 'Veri Yok';
    let performanceColor = 'text-gray-500 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700';

    if (scoreVal >= 4.50) {
      performanceLabel = 'Üstün Performans';
      performanceColor = 'text-green-700 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30';
    } else if (scoreVal >= 4.00) {
      performanceLabel = 'İyi Performans';
      performanceColor = 'text-blue-700 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30';
    } else if (scoreVal >= 3.50) {
      performanceLabel = 'Gelişime Açık';
      performanceColor = 'text-yellow-700 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/30';
    } else if (scoreVal >= 3.00) {
      performanceLabel = 'İyileştirme Gerekli';
      performanceColor = 'text-orange-700 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30';
    } else if (scoreVal > 0) {
      performanceLabel = 'Gelişim Planı / Uyarı';
      performanceColor = 'text-red-700 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30';
    }

    return {
      staff,
      managerScore,
      clientScore,
      finalScore,
      performanceLabel,
      performanceColor,
      managerCatScores,
      clientCatScores,
      evalCount: staffEvals.length,
      managerEvalCount: managerEvals.length,
      clientEvalCount: clientEvals.length,
      evaluationsList: staffEvals
    };
  };

  // Build Results Dashboard Cards
  const getResultsList = () => {
    // Select period
    const activeP = periods.find(p => p.id === selectedPeriodId);
    if (!activeP) return [];

    let targetStaffs = members;

    // Filter based on roles
    if (isStaff) {
      targetStaffs = members.filter(m => m.id === userId);
    } else if (isChief) {
      // Chief can only see results of staff members they graded
      const staffIdsHeGraded = evaluations
        .filter(ev => ev.period_id === selectedPeriodId && ev.evaluator_id === userId)
        .map(ev => ev.evaluatee_id);
      targetStaffs = members.filter(m => staffIdsHeGraded.includes(m.id) || m.id === userId);
    }

    return targetStaffs
      .map(m => calculateEmployeeCard(m.id, selectedPeriodId))
      .filter(card => card !== null) as any[];
  };

  const results = getResultsList();
  const selectedCardData = selectedEmployeeCard ? calculateEmployeeCard(selectedEmployeeCard, selectedPeriodId) : null;

  if (loading && members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-sm font-medium">Değerlendirme verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BAŞLIK */}
      <div className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Star className="text-yellow-500 fill-yellow-500" /> Çalışan Performans Değerlendirmeleri
          </h2>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
            Yönetici ve Müşteri (%60 / %40) ağırlıklı çalışan performans matrisleri ve değerlendirme karneleri.
          </p>
        </div>
        
        {activePeriod ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold border border-green-200 dark:border-green-900/30">
            <CheckCircle size={16} /> Aktif Dönem: {activePeriod.title}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900/30">
            <AlertCircle size={16} /> Aktif Değerlendirme Dönemi Yok
          </div>
        )}
      </div>

      {/* ALT SEKMELER */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm gap-1 flex-wrap">
        <button
          onClick={() => setSubTab('results')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            subTab === 'results'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <TrendingUp size={14} /> Karneler & Analitik
        </button>
        
        {((isOwner && activePeriod) || (isChief && activePeriod && activePeriod.allow_chief_evaluations)) && (
          <button
            onClick={() => setSubTab('submit')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              subTab === 'submit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <ClipboardList size={14} /> Değerlendirme Formu Doldur
          </button>
        )}


        {!isStaff && (
          <button
            onClick={() => setSubTab('tokens')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              subTab === 'tokens'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          >
            <Building size={14} /> Müşteri Anket Linkleri
          </button>
        )}

        {isOwner && (
          <button
            onClick={() => setSubTab('periods')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              subTab === 'periods'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          >
            <Settings size={14} /> Dönem Yönetimi
          </button>
        )}
      </div>

      {/* SEKMELERİN İÇERİĞİ */}

      {/* 1. KARNELER & ANALİTİK */}
      {subTab === 'results' && (
        <div className="space-y-6">
          {/* Dönem Seçimi */}
          <div className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">İzlenecek Dönem:</span>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.status === 'active' ? '(Aktif)' : '(Kapalı)'}
                </option>
              ))}
            </select>
          </div>

          {results.length === 0 ? (
            <div className="bg-white dark:bg-slate-850 p-12 text-center border border-gray-200 dark:border-slate-800 rounded-xl text-gray-400 text-sm">
              Seçilen döneme ait herhangi bir değerlendirme sonucu bulunamadı.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((card) => {
                const scoreOutO5 = card.finalScore / 20;
                return (
                  <div
                    key={card.staff.id}
                    onClick={() => setSelectedEmployeeCard(card.staff.id)}
                    className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-md hover:shadow-lg transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-white text-base leading-snug">{card.staff.full_name}</h4>
                          <span className="text-xs text-gray-400 uppercase tracking-wider block mt-0.5">
                            {card.staff.role === 'corporate_chief' ? 'Şef / Yönetici' : 'Saha Danışmanı'}
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${card.performanceColor}`}>
                          {card.performanceLabel}
                        </span>
                      </div>

                      {/* Bar Grafik ve Puanlar */}
                      <div className="space-y-4 my-6">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Toplam Performans Puanı</span>
                            <span className="font-bold text-gray-850 dark:text-white">{card.finalScore.toFixed(1)} / 100</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full"
                              style={{ width: `${card.finalScore}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                          <div className="bg-gray-50 dark:bg-slate-800 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700/50">
                            <span className="text-gray-450 dark:text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Yönetici (%60)</span>
                            <span className="font-bold text-gray-800 dark:text-white text-sm">
                              {card.managerEvalCount > 0 ? `${card.managerScore.toFixed(1)}` : 'Oylanmadı'}
                            </span>
                          </div>
                          <div className="bg-gray-50 dark:bg-slate-800 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700/50">
                            <span className="text-gray-450 dark:text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Müşteri (%40)</span>
                            <span className="font-bold text-gray-800 dark:text-white text-sm">
                              {card.clientEvalCount > 0 ? `${card.clientScore.toFixed(1)}` : 'Anket Eksik'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button className="w-full mt-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700/50 border border-gray-150 dark:border-slate-700 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition">
                      Detaylı Karneyi İncele <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. DEĞERLENDİRME FORMU DOLDUR */}
      {subTab === 'submit' && activePeriod && (
        <form onSubmit={handleSaveEvaluation} className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b dark:border-slate-700 pb-3 flex items-center gap-2">
            <ClipboardList className="text-blue-600" /> Performans Değerlendirme Anketi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400">Değerlendirilecek Personel</label>
              <select
                value={selectedEvaluateeId}
                onChange={(e) => {
                  setSelectedEvaluateeId(e.target.value);
                  setEvalScores({});
                }}
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-sm text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Seçiniz...</option>
                {evaluableMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.role === 'corporate_chief' ? 'Şef / Yönetici' : 'Saha Danışmanı'})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-xs text-blue-750 dark:text-blue-400">
                Puanlama ölçeği: <strong>1: Çok Zayıf, 5: Mükemmel</strong> (Yıldızlara tıklayarak puanlayın)
              </div>
            </div>
          </div>

          {selectedEvaluateeId && (
            <div className="space-y-6">
              {/* CORE CATEGORIES & QUESTIONS */}
              {CORE_CATEGORIES.map(cat => (
                <div key={cat.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-4">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm border-b dark:border-slate-700 pb-1.5">{cat.title}</h4>
                  <div className="space-y-4">
                    {cat.questions.map(q => (
                      <div key={q.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-300 font-medium max-w-xl">{q.text}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleScoreChange(q.id, star)}
                              className={`p-0.5 transition ${
                                star <= (evalScores[q.id] || 0)
                                  ? 'text-yellow-500 fill-yellow-500 hover:scale-110'
                                  : 'text-gray-300 dark:text-slate-650 hover:text-yellow-350'
                              }`}
                            >
                              <Star size={18} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* MANAGER SPECIAL QUESTIONS */}
              <div className="p-4 bg-purple-50/40 dark:bg-purple-950/10 rounded-2xl border border-purple-100/60 dark:border-purple-900/30 space-y-4">
                <h4 className="font-bold text-purple-900 dark:text-purple-300 text-sm border-b border-purple-100 dark:border-purple-900/20 pb-1.5">
                  F. Kurumsal Uyum ve Değer (Yönetici Özel Soruları)
                </h4>
                <div className="space-y-4">
                  {MANAGER_SPECIAL_QUESTIONS.map(q => (
                    <div key={q.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-300 font-medium max-w-xl">{q.text}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleScoreChange(q.id, star)}
                            className={`p-0.5 transition ${
                              star <= (evalScores[q.id] || 0)
                                ? 'text-yellow-500 fill-yellow-500 hover:scale-110'
                                : 'text-gray-300 dark:text-slate-650 hover:text-yellow-350'
                            }`}
                          >
                            <Star size={18} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* COMMENTS */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400">Varsa Ek Görüş / Değerlendirme Notu</label>
                <textarea
                  value={evalComments}
                  onChange={(e) => setEvalComments(e.target.value)}
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-sm text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 h-24"
                  placeholder="Çalışanın güçlü ve geliştirilmesi gereken yönlerini yazabilirsiniz..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submittingEval}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition ml-auto"
              >
                {submittingEval ? 'Kaydediliyor...' : 'Değerlendirmeyi Kaydet'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* 3. MÜŞTERİ ANKET LİNKLERİ */}
      {subTab === 'tokens' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Link Oluşturma */}
          {activePeriod ? (
            <div className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-1">
              <h4 className="font-bold text-slate-800 dark:text-white text-sm border-b dark:border-slate-700 pb-2">Müşteri Linki Oluştur</h4>
              <form onSubmit={handleGenerateToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400">Danışman Personel</label>
                  <select
                    value={tokenStaffId}
                    onChange={(e) => setTokenStaffId(e.target.value)}
                    className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seçiniz...</option>
                    {members.filter(m => m.role === 'corporate_staff').map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400">Değerlendirecek Müşteri Firma</label>
                  <select
                    value={tokenClientId}
                    onChange={(e) => setTokenClientId(e.target.value)}
                    className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seçiniz...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <PlusCircle size={14} /> Anket Linki Oluştur
                </button>
              </form>

              {generatedLink && (
                <div className="p-4 bg-gray-55 dark:bg-slate-800 rounded-xl border border-gray-150 dark:border-slate-700 space-y-2 mt-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Oluşturulan Link (Tek Kullanımlık):</div>
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="w-full text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded p-1.5 text-blue-600 select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="w-full bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 text-indigo-750 dark:text-indigo-400 py-1.5 text-xs font-bold rounded-lg border border-indigo-200/50 dark:border-indigo-900/30 flex items-center justify-center gap-1"
                  >
                    <Copy size={12} /> Linki Kopyala
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm lg:col-span-1 text-center text-xs text-red-500 font-bold">
              Lütfen anket oluşturabilmek için önce bir değerlendirme dönemi açın.
            </div>
          )}

          {/* Sağ: Oluşturulan Link Listesi */}
          <div className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-white text-sm border-b dark:border-slate-700 pb-2">Oluşturulmuş Aktif Anket Linkleri</h4>
            {tokens.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">
                Kayıtlı anket linki bulunmamaktadır.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-gray-450 uppercase font-bold tracking-wider">
                      <th className="py-2.5">Danışman</th>
                      <th className="py-2.5">Müşteri Firma</th>
                      <th className="py-2.5">Durum</th>
                      <th className="py-2.5">Son Kullanma</th>
                      <th className="py-2.5">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map(tk => {
                      const isExpired = new Date(tk.expires_at) < new Date();
                      return (
                        <tr key={tk.id} className="border-b dark:border-slate-800/50">
                          <td className="py-3 font-bold text-gray-800 dark:text-white">{tk.staff?.full_name}</td>
                          <td className="py-3 text-gray-650 dark:text-gray-300">{tk.client?.name}</td>
                          <td className="py-3">
                            {tk.is_used ? (
                              <span className="px-2 py-0.5 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-full font-bold text-[10px]">
                                Kullanıldı (Oylandı)
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-full font-bold text-[10px]">
                                Süresi Doldu
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-750 dark:text-yellow-400 rounded-full font-bold text-[10px]">
                                Beklemede
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-gray-400">{new Date(tk.expires_at).toLocaleDateString('tr-TR')}</td>
                          <td className="py-3 space-x-2">
                            <button
                              onClick={() => {
                                const l = `${window.location.origin}/evaluate-client/${tk.token}`;
                                navigator.clipboard.writeText(l);
                                alert('Link panoya kopyalandı!');
                              }}
                              className="text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold text-[10px] disabled:opacity-50"
                              disabled={tk.is_used}
                            >
                              Kopyala
                            </button>
                            {isOwner && (
                              <>
                                {(tk.is_used || isExpired) && (
                                  <button
                                    onClick={() => handleReopenToken(tk.id)}
                                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-bold text-[10px]"
                                  >
                                    Yeniden Aç
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteToken(tk.id)}
                                  className="text-red-650 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-bold text-[10px]"
                                >
                                  Sil
                                </button>
                              </>
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
        </div>
      )}

      {/* 4. DÖNEM YÖNETİMİ */}
      {subTab === 'periods' && isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Dönem Açma Formu */}
          <div className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-1">
            <h4 className="font-bold text-slate-800 dark:text-white text-sm border-b dark:border-slate-700 pb-2">Değerlendirme Dönemi Aç</h4>
            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400 font-medium">Dönem Başlığı</label>
                <input
                  type="text"
                  value={periodTitle}
                  onChange={(e) => setPeriodTitle(e.target.value)}
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Örn: 2026 İlk 6 Ay Değerlendirmesi"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400 font-medium">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 dark:text-gray-400 font-medium">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="allowChiefEvaluations"
                  checked={allowChiefEvaluations}
                  onChange={(e) => setAllowChiefEvaluations(e.target.checked)}
                  className="rounded border-gray-350 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="allowChiefEvaluations"
                  className="text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer select-none"
                >
                  Şeflerden Değerlendirme Talep Et
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Plus size={14} /> Yeni Dönem Başlat
              </button>
            </form>
          </div>

          {/* Sağ: Dönem Listesi */}
          <div className="bg-white dark:bg-slate-850 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-white text-sm border-b dark:border-slate-700 pb-2">Kayıtlı Değerlendirme Dönemleri</h4>
            {periods.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">
                Açılmış bir değerlendirme dönemi bulunamadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-gray-450 uppercase font-bold tracking-wider">
                      <th className="py-2.5">Dönem Adı</th>
                      <th className="py-2.5">Başlangıç</th>
                      <th className="py-2.5">Bitiş</th>
                      <th className="py-2.5">Durum</th>
                      <th className="py-2.5">Şef Katılımı</th>
                      <th className="py-2.5 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(p => (
                      <tr key={p.id} className="border-b dark:border-slate-800/50">
                        <td className="py-3 font-bold text-gray-800 dark:text-white">{p.title}</td>
                        <td className="py-3 text-gray-600 dark:text-gray-300">{p.start_date}</td>
                        <td className="py-3 text-gray-600 dark:text-gray-300">{p.end_date}</td>
                        <td className="py-3">
                          {p.status === 'active' ? (
                            <span className="px-2.5 py-0.5 bg-green-55/80 text-green-700 dark:text-green-400 rounded-full font-bold text-[10px]">
                              Aktif / Açık
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-full font-bold text-[10px]">
                              Kapalı
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {p.allow_chief_evaluations ? (
                            <span className="px-2.5 py-0.5 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 rounded-full font-bold text-[10px] border border-purple-200/50 dark:border-purple-900/30">
                              Talep Edildi
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-gray-55 dark:bg-slate-800 text-gray-500 dark:text-gray-450 rounded-full font-bold text-[10px] border border-gray-100 dark:border-slate-700">
                              İzin Yok
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => handleTogglePeriodStatus(p.id, p.status)}
                            className={`font-bold text-[10px] uppercase hover:underline ${
                              p.status === 'active' ? 'text-orange-650' : 'text-green-600'
                            }`}
                          >
                            {p.status === 'active' ? 'Kapat' : 'Aktif Et'}
                          </button>
                          <button
                            onClick={() => handleDeletePeriod(p.id)}
                            className="text-red-600 hover:text-red-800 font-bold text-[10px] uppercase hover:underline"
                          >
                            Sil
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
      )}

      {/* DETAIL MODAL FOR EMPLOYEE SCORE CARD */}
      {selectedEmployeeCard && selectedCardData && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-850 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-150 dark:border-slate-800 flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b dark:border-slate-800 flex justify-between items-start">
              <div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-block mb-2 ${selectedCardData.performanceColor}`}>
                  {selectedCardData.performanceLabel}
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  {selectedCardData.staff.full_name} - Performans Karnesi
                </h3>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                  {selectedCardData.staff.role === 'corporate_chief' ? 'Şef / Yönetici' : 'Saha Danışmanı'}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmployeeCard(null)}
                className="p-1 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800/40 dark:to-slate-800/20 p-4 rounded-2xl border border-blue-100/50 dark:border-slate-850">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Genel Başarı Puanı</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-blue-700 dark:text-blue-400">{selectedCardData.finalScore.toFixed(1)}</span>
                    <span className="text-sm text-gray-400">/ 100</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    %60 Yönetici + %40 Müşteri oranı.
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-150/40 dark:border-slate-850">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Yönetici Puanı (%60)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-gray-800 dark:text-white">
                      {selectedCardData.managerEvalCount > 0 ? selectedCardData.managerScore.toFixed(1) : '0'}
                    </span>
                    <span className="text-sm text-gray-400">/ 100</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Toplam {selectedCardData.managerEvalCount} yönetici değerlendirmesi.
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-150/40 dark:border-slate-850">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Müşteri Puanı (%40)</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-gray-800 dark:text-white">
                      {selectedCardData.clientEvalCount > 0 ? selectedCardData.clientScore.toFixed(1) : 'Yok'}
                    </span>
                    <span className="text-sm text-gray-400">/ 100</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Toplam {selectedCardData.clientEvalCount} müşteri anket katılımı.
                  </div>
                </div>
              </div>

              {/* Category Matrix Table */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 dark:text-white text-sm border-b dark:border-slate-800 pb-2">Kategori Bazlı Detay Matrisi</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b dark:border-slate-800 text-gray-400 uppercase font-bold tracking-wider">
                        <th className="py-2">Değerlendirme Kategorisi</th>
                        <th className="py-2">Kategori Ağırlığı</th>
                        <th className="py-2">Yönetici Puanı (5 Üzerinden)</th>
                        <th className="py-2">Müşteri Puanı (5 Üzerinden)</th>
                        <th className="py-2 text-right">Toplam (100 Üzerinden)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CORE_CATEGORIES.map(cat => {
                        const mScore = selectedCardData.managerCatScores[cat.id] || 0;
                        const cScore = selectedCardData.clientCatScores[cat.id] || 0;
                        
                        let combined = 0;
                        if (mScore > 0 && cScore > 0) {
                          combined = (mScore * 0.60) + (cScore * 0.40);
                        } else if (mScore > 0) {
                          combined = mScore;
                        } else if (cScore > 0) {
                          combined = cScore;
                        }
                        const combinedScale100 = combined * 20;

                        return (
                          <tr key={cat.id} className="border-b dark:border-slate-800/40">
                            <td className="py-3 font-bold text-gray-800 dark:text-white">{cat.title.split(' (')[0]}</td>
                            <td className="py-3 text-gray-450 dark:text-gray-400">%{cat.weight * 100}</td>
                            <td className="py-3 font-semibold text-gray-700 dark:text-gray-300">
                              {mScore > 0 ? `${mScore.toFixed(2)}` : 'Yorumsuz'}
                            </td>
                            <td className="py-3 font-semibold text-gray-700 dark:text-gray-300">
                              {cScore > 0 ? `${cScore.toFixed(2)}` : 'Anket Yok'}
                            </td>
                            <td className="py-3 text-right font-black text-slate-900 dark:text-white">
                              {combinedScale100.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedbacks / Comments Section */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-gray-800 dark:text-white text-sm border-b dark:border-slate-800 pb-2">Değerlendirici Notları ve Yorumlar</h4>
                {selectedCardData.evaluationsList.filter(ev => ev.comments).length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400 italic">
                    Ek bir görüş veya yazılı geri bildirim girilmemiştir.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCardData.evaluationsList.filter(ev => ev.comments).map(ev => (
                      <div key={ev.id} className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-150 dark:border-slate-800/80">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase mb-1">
                          <span>{ev.evaluator_name} {ev.client_name ? `(${ev.client_name})` : ''}</span>
                          <span>{new Date(ev.created_at).toLocaleDateString('tr-TR')}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic">
                          "{ev.comments}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t dark:border-slate-800 bg-gray-50 dark:bg-slate-850 flex justify-end">
              <button
                onClick={() => setSelectedEmployeeCard(null)}
                className="px-5 py-2.5 bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition"
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
