import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  Star,
  CheckCircle,
  AlertCircle,
  Building,
  User,
  ShieldAlert,
  Loader,
  ThumbsUp,
} from 'lucide-react';

interface TokenData {
  id: string;
  period_id: string;
  staff_id: string;
  client_id: string;
  is_used: boolean;
  expires_at: string;
  staff?: { full_name: string };
  client?: { name: string };
}

const CLIENT_QUESTIONS = [
  {
    id: 'cli_q1',
    text: 'Ulaşılabilirlik',
    desc: 'İhtiyaç duyduğunuzda veya acil bir sorunuz olduğunda çevre danışmanınıza kolayca ulaşabiliyor musunuz?'
  },
  {
    id: 'cli_q2',
    text: 'Sahaya Hakimiyet',
    desc: 'Tesis ziyaretleri sırasında sadece evrak kontrolü mü yapıyor, yoksa üretim alanını gezerek potansiyel çevresel riskleri proaktif olarak tespit ediyor mu?'
  },
  {
    id: 'cli_q3',
    text: 'Çözüm Odaklılık',
    desc: 'Tesisinizde tespit edilen uygunsuzluklarda size sadece yasal kuralı mı söylüyor, yoksa pratik ve uygulanabilir çözümler sunuyor mu?'
  },
  {
    id: 'cli_q4',
    text: 'Bilgilendirme ve Rehberlik',
    desc: 'Çevre mevzuatı gereklilikleri, yapmanız gereken yatırımlar ve yasal yükümlülükleriniz konusunda sizi yeterince ve anlaşılır bir dille yönlendiriyor mu?'
  },
  {
    id: 'cli_q5',
    text: 'Genel Memnuniyet',
    desc: 'Danışmanımızın kurumunuzda sergilediği profesyonel duruş ve sunduğu hizmet kalitesini genel olarak nasıl değerlendirirsiniz?'
  },
  {
    id: 'cli_spec_q1',
    text: 'Profesyonellik',
    desc: 'Danışmanınızın saha ziyaretleri, toplantılar ve saha çalışmalarındaki genel profesyonelliği nasıl?'
  },
  {
    id: 'cli_spec_q2',
    text: 'Müşteri İhtiyaçlarını Anlama',
    desc: 'Tesisinizin özel koşullarını anlama ve beklentilerinizi karşılama performansı ne düzeyde?'
  },
  {
    id: 'cli_spec_q3',
    text: 'İzin ve Belgelendirme Desteği',
    desc: 'Çevre izin lisans süreçlerinde ve resmi kurumlarla (Bakanlık/Müdürlük) ilişkilerde verdiği destek kalitesi nasıl?'
  },
  {
    id: 'cli_spec_q4',
    text: 'Tekrar Çalışma İstemi',
    desc: 'Genel memnuniyetinize dayanarak, bu danışman ile gelecekte de çalışmaya devam etmek ister misiniz?'
  }
];

export default function ClientEvaluationPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setErrorMsg('Geçersiz istek: Anket anahtarı bulunamadı.');
      setLoading(false);
    }
  }, [token]);

  const validateToken = async () => {
    try {
      // Fetch token details
      const { data, error } = await supabase
        .from('evaluation_client_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        setErrorMsg('Girdiğiniz değerlendirme linki sistemde kayıtlı değil veya silinmiş.');
        return;
      }

      const tokenObj = data as TokenData;

      if (tokenObj.is_used) {
        setErrorMsg('Bu değerlendirme anketi daha önce doldurulmuştur. Katılımınız için teşekkür ederiz.');
        return;
      }

      if (new Date(tokenObj.expires_at) < new Date()) {
        setErrorMsg('Bu değerlendirme anketinin süresi dolmuştur.');
        return;
      }

      // Enrich with staff and client details
      const { data: staffData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', tokenObj.staff_id)
        .single();

      const { data: clientData } = await supabase
        .from('consultant_clients')
        .select('name')
        .eq('id', tokenObj.client_id)
        .single();

      setTokenData({
        ...tokenObj,
        staff: staffData ? { full_name: staffData.full_name } : undefined,
        client: clientData ? { name: clientData.name } : undefined
      });

    } catch (err: any) {
      console.error('Validation error:', err);
      setErrorMsg('Bağlantı doğrulanırken bir hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (qId: string, rating: number) => {
    setScores(prev => ({
      ...prev,
      [qId]: rating
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenData) return;

    // Validate that all questions are rated
    const unanswered = CLIENT_QUESTIONS.filter(q => !scores[q.id]);
    if (unanswered.length > 0) {
      alert('Lütfen tüm değerlendirme sorularını oylayınız.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into evaluations
      const { error: evalError } = await supabase
        .from('evaluations')
        .insert({
          period_id: tokenData.period_id,
          evaluator_id: null, // client is external, no profile ID
          evaluatee_id: tokenData.staff_id,
          client_id: tokenData.client_id,
          evaluator_type: 'client',
          scores: scores,
          comments: comments.trim() || null
        });

      if (evalError) throw evalError;

      // 2. Mark token as used
      const { error: tokenError } = await supabase
        .from('evaluation_client_tokens')
        .update({ is_used: true })
        .eq('id', tokenData.id);

      if (tokenError) throw tokenError;

      setSuccess(true);
    } catch (err: any) {
      alert('Değerlendirme kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">Bağlantı doğrulanıyor...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-850 max-w-md w-full p-8 rounded-3xl border border-gray-150 dark:border-slate-800 shadow-xl text-center space-y-4">
          <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 rounded-2xl">
            <ShieldAlert size={36} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Anket Erişilemez</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {errorMsg}
          </p>
          <div className="pt-2">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">EvrakLab Çevre Uyumluluk Sistemi</span>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-850 max-w-md w-full p-8 rounded-3xl border border-gray-150 dark:border-slate-800 shadow-xl text-center space-y-4">
          <div className="inline-flex p-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-2xl">
            <ThumbsUp size={36} className="animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Katılımınız İçin Teşekkür Ederiz</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Danışmanınız <strong>{tokenData?.staff?.full_name}</strong> hakkında verdiğiniz değerli geri bildirimler başarıyla kaydedilmiştir. Hizmet kalitemizi artırmamıza katkıda bulunduğunuz için teşekkür ederiz.
          </p>
          <div className="pt-4 border-t dark:border-slate-800">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">EvrakLab Çevre Danışmanlığı</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-850 rounded-3xl border border-gray-150 dark:border-slate-800 shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="p-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center">
          <Building size={32} className="mx-auto mb-2 text-white/90" />
          <h2 className="text-2xl font-black">Danışman Değerlendirme Anketi</h2>
          <p className="text-xs text-blue-100 mt-1 uppercase tracking-wider font-semibold">
            {tokenData?.client?.name} Temsilcisi İçin
          </p>
        </div>

        {/* Info Box */}
        <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-800 text-xs text-gray-600 dark:text-gray-300 flex items-start gap-3">
          <User size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            Hizmet aldığınız Çevre Danışmanınız <strong>{tokenData?.staff?.full_name}</strong>'ın performansını aşağıdaki kriterlere göre 5'li ölçekte (1: Çok Zayıf, 5: Mükemmel) değerlendirin. Yanıtlarınız tamamen gizli tutulacak ve hizmet kalitesini iyileştirme amaçlı kullanılacaktır.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-5">
            {CLIENT_QUESTIONS.map((q, index) => (
              <div key={q.id} className="p-4 bg-gray-50/50 dark:bg-slate-800/30 rounded-2xl border border-gray-150/40 dark:border-slate-800/60 space-y-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 block">Soru {index + 1}</span>
                    <h4 className="font-bold text-gray-800 dark:text-white text-sm">{q.text}</h4>
                  </div>
                  
                  {/* Star Rating picker */}
                  <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleScoreChange(q.id, star)}
                        className={`p-0.5 transition ${
                          star <= (scores[q.id] || 0)
                            ? 'text-yellow-500 fill-yellow-500 hover:scale-110'
                            : 'text-gray-300 dark:text-slate-700 hover:text-yellow-450'
                        }`}
                      >
                        <Star size={20} />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {q.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Comments field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">Ek Görüş ve Önerileriniz (İsteğe Bağlı)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 h-28"
              placeholder="Danışmanınız hakkında eklemek istediğiniz olumlu/olumsuz geri bildirimlerinizi yazabilirsiniz..."
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-md"
          >
            {submitting ? (
              <>
                <Loader className="animate-spin" size={16} /> Gönderiliyor...
              </>
            ) : (
              'Anketi Tamamla ve Gönder'
            )}
          </button>

        </form>

      </div>
    </div>
  );
}
