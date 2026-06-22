import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Send, 
  User, 
  FileText, 
  Check, 
  X,
  AlertCircle,
  HelpCircle,
  Loader
} from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  question_type: 'yes_no' | 'compliant' | 'text' | 'rating';
  is_required: boolean;
  order_index: number;
}

interface Point {
  id: string;
  name: string;
  location_description: string;
  form_id: string;
}

interface Form {
  id: string;
  title: string;
  description: string;
  organization_id: string;
  client_id: string;
  access_password?: string;
}

interface Consultant {
  name: string;
  consultant_logo_url?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
}

interface Client {
  name: string;
}

export default function InspectionPage() {
  const { token } = useParams<{ token: string }>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [point, setPoint] = useState<Point | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Form responses state
  const [answers, setAnswers] = useState<Record<string, { answer_bool?: boolean; answer_text?: string }>>({});
  const [submittedByName, setSubmittedByName] = useState('');
  const [submittedBySurname, setSubmittedBySurname] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password verification states
  const [passwordInput, setPasswordInput] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Geçersiz QR kod tokeni.');
      setLoading(false);
      return;
    }
    loadInspectionDetails();
  }, [token]);

  const loadInspectionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get the inspection point by qr_token
      const { data: pointData, error: pointError } = await supabase
        .from('inspection_points')
        .select('*')
        .eq('qr_token', decodeURIComponent(token!))
        .single();

      if (pointError || !pointData) {
        setError('Belirtilen QR koda ait aktif bir denetim noktası bulunamadı.');
        setLoading(false);
        return;
      }

      setPoint(pointData);

      // 2. Get the associated form
      const { data: formData, error: formError } = await supabase
        .from('inspection_forms')
        .select('*')
        .eq('id', pointData.form_id)
        .single();

      if (formError || !formData) {
        setError('Bu denetim noktasına bağlı form bulunamadı.');
        setLoading(false);
        return;
      }

      if (!formData.is_active) {
        setError('Bu denetim formu şu anda pasif durumdadır.');
        setLoading(false);
        return;
      }

      setForm(formData);
      if (!formData.access_password || formData.access_password.trim() === '') {
        setIsPasswordVerified(true);
      }

      // 3. Get the client details (facilities)
      const { data: clientData, error: clientError } = await supabase
        .from('consultant_clients')
        .select('name')
        .eq('id', formData.client_id)
        .single();

      if (!clientError && clientData) {
        setClient(clientData);
      }

      // 4. Get the consultant company (organizations)
      const { data: consultantData, error: consultantError } = await supabase
        .from('organizations')
        .select('name, consultant_logo_url, logo_url, phone, email')
        .eq('id', formData.organization_id)
        .single();

      if (!consultantError && consultantData) {
        setConsultant(consultantData);
      }

      // 5. Get the questions ordered by order_index
      const { data: questionsData, error: questionsError } = await supabase
        .from('inspection_questions')
        .select('*')
        .eq('form_id', formData.id)
        .order('order_index', { ascending: true });

      if (questionsError || !questionsData) {
        setError('Form soruları yüklenemedi.');
        setLoading(false);
        return;
      }

      setQuestions(questionsData);
      
      // Initialize answer structure
      const initialAnswers: typeof answers = {};
      questionsData.forEach(q => {
        initialAnswers[q.id] = {};
      });
      setAnswers(initialAnswers);

    } catch (err: any) {
      console.error(err);
      setError('Veriler yüklenirken sistemsel bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (passwordInput.trim() === (form.access_password || '').trim()) {
      setIsPasswordVerified(true);
      setPasswordError(null);
    } else {
      setPasswordError('Girdiğiniz şifre hatalı. Lütfen tekrar deneyin.');
    }
  };

  const handleBoolChange = (questionId: string, value: boolean) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer_bool: value
      }
    }));
  };

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer_text: value
      }
    }));
  };

  const handleRatingChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer_text: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!point || !form) return;

    if (!submittedByName.trim()) {
      alert('Lütfen adınızı giriniz.');
      return;
    }
    if (!submittedBySurname.trim()) {
      alert('Lütfen soyadınızı giriniz.');
      return;
    }

    // Validate required questions
    for (const q of questions) {
      if (q.is_required) {
        const answer = answers[q.id];
        if (q.question_type === 'yes_no' || q.question_type === 'compliant') {
          if (answer.answer_bool === undefined) {
            alert(`Lütfen "${q.question_text}" sorusunu cevaplayın.`);
            return;
          }
        } else {
          if (!answer.answer_text || answer.answer_text.trim() === '') {
            alert(`Lütfen "${q.question_text}" sorusunu doldurun.`);
            return;
          }
        }
      }
    }

    try {
      setSubmitting(true);

      // 1. Create a submission
      const { data: submissionData, error: submissionError } = await supabase
        .from('inspection_submissions')
        .insert({
          point_id: point.id,
          submitted_by_name: submittedByName.trim(),
          submitted_by_surname: submittedBySurname.trim(),
          general_notes: generalNotes.trim() || null
        })
        .select()
        .single();

      if (submissionError || !submissionData) {
        throw new Error(submissionError?.message || 'Gönderim kaydı oluşturulamadı.');
      }

      // 2. Prepare answer rows
      const answerRows = questions.map(q => {
        const ans = answers[q.id];
        return {
          submission_id: submissionData.id,
          question_id: q.id,
          answer_bool: ans.answer_bool !== undefined ? ans.answer_bool : null,
          answer_text: ans.answer_text !== undefined ? ans.answer_text : null
        };
      });

      // 3. Insert answers
      const { error: answersError } = await supabase
        .from('inspection_answers')
        .insert(answerRows);

      if (answersError) {
        throw new Error(answersError.message);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert('Form kaydedilirken bir hata oluştu: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  // Progress calculation
  const totalRequired = questions.filter(q => q.is_required).length;
  const answeredRequired = questions.filter(q => {
    if (!q.is_required) return false;
    const ans = answers[q.id];
    if (q.question_type === 'yes_no' || q.question_type === 'compliant') {
      return ans?.answer_bool !== undefined;
    }
    return ans?.answer_text !== undefined && ans.answer_text.trim() !== '';
  }).length;

  const progressPercent = totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <Loader className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Denetim formu yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-6 max-w-md w-full text-center shadow-xl">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-100 mb-2">Erişim Hatası</h1>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <div className="text-xs text-slate-500 border-t border-slate-700/50 pt-4">
            Lütfen QR kodunu tekrar taratın veya sistem yöneticinizle iletişime geçin.
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    const orgLogo = consultant?.consultant_logo_url || consultant?.logo_url;
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 border border-teal-500/20 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-400"></div>
          
          {orgLogo ? (
            <img src={orgLogo} alt="Logo" className="h-12 object-contain mx-auto mb-6 max-w-[180px]" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-6">
              <Check className="w-6 h-6 text-teal-400" />
            </div>
          )}

          <CheckCircle className="w-16 h-16 text-teal-400 mx-auto mb-4 animate-bounce" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Başarıyla Gönderildi</h1>
          <p className="text-slate-400 text-sm mb-6">
            Denetim kaydı sisteme başarıyla işlenmiştir. Katkınız için teşekkür ederiz.
          </p>

          <div className="bg-slate-900/60 border border-slate-700/30 rounded-xl p-4 text-left text-xs space-y-2 mb-6">
            <div>
              <span className="text-slate-500">Tesis:</span>
              <span className="text-slate-300 font-semibold ml-2">{client?.name || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Nokta:</span>
              <span className="text-slate-300 font-semibold ml-2">{point?.name}</span>
            </div>
            <div>
              <span className="text-slate-500">Tarih:</span>
              <span className="text-slate-300 font-semibold ml-2">
                {new Date().toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 border-t border-slate-700/50 pt-4 flex flex-col items-center justify-center gap-1">
            <span className="font-semibold text-slate-400">{consultant?.name}</span>
            <span>Çevre Danışmanlık ve Denetim Sistemi</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isPasswordVerified) {
    const orgLogo = consultant?.consultant_logo_url || consultant?.logo_url;
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          
          {orgLogo ? (
            <img src={orgLogo} alt="Logo" className="h-12 object-contain mx-auto mb-6 max-w-[180px]" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
              <Info className="w-6 h-6 text-blue-400" />
            </div>
          )}

          <h1 className="text-xl font-bold text-slate-100 mb-2">Şifre Korumalı Denetim</h1>
          <p className="text-slate-400 text-sm mb-6">
            Bu denetim formuna erişebilmek için lütfen formu oluşturan yetkilinin belirlediği şifreyi giriniz.
          </p>

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Form Giriş Şifresi"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/70 rounded-xl px-4 py-3 text-slate-200 text-center text-sm outline-none transition-all duration-150"
                required
              />
            </div>
            {passwordError && (
              <p className="text-red-400 text-xs mt-1 text-center font-medium">
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              Doğrula ve Formu Aç
            </button>
          </form>

          <div className="text-xs text-slate-500 border-t border-slate-800/50 pt-4 mt-6 flex flex-col items-center justify-center gap-1">
            <span className="font-semibold text-slate-400">{consultant?.name}</span>
            <span>Çevre Danışmanlık ve Denetim Sistemi</span>
          </div>
        </div>
      </div>
    );
  }

  const orgLogo = consultant?.consultant_logo_url || consultant?.logo_url;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {orgLogo ? (
              <img src={orgLogo} alt="Logo" className="h-8 max-w-[120px] object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center font-bold text-teal-400 text-sm">
                EL
              </div>
            )}
            <div>
              <h2 className="text-xs text-teal-400 font-bold uppercase tracking-wider">Saha Denetimi</h2>
              <h1 className="text-sm font-bold text-slate-200 line-clamp-1">{client?.name}</h1>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block">Nokta</span>
            <span className="text-xs font-semibold text-slate-300 line-clamp-1">{point?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-2xl mx-auto px-4 mt-6">
        
        {/* Form Meta details card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-indigo-500"></div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">{form?.title}</h1>
          {form?.description && (
            <p className="text-slate-400 text-xs leading-relaxed mb-4">{form.description}</p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
            <Info className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>
              Lütfen aşağıdaki form sorularını eksiksiz doldurup en alttaki **Formu Gönder** butonuna basınız.
            </span>
          </div>

          {/* Progress bar */}
          {totalRequired > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-400">Zorunlu Soruların Doldurulma Oranı</span>
                <span className="font-semibold text-teal-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-350"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* The Questions Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q, idx) => {
            const currentAns = answers[q.id] || {};
            
            return (
              <div 
                key={q.id} 
                className={`bg-slate-900 border rounded-2xl p-5 shadow-md transition-all duration-200 ${
                  q.is_required && (
                    (q.question_type === 'yes_no' || q.question_type === 'compliant') 
                      ? currentAns.answer_bool === undefined 
                      : !currentAns.answer_text
                  )
                    ? 'border-slate-800/80 focus-within:border-teal-500/50'
                    : 'border-teal-500/20'
                }`}
              >
                {/* Question text & badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs font-bold text-slate-500 bg-slate-950/60 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border border-slate-800">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200 leading-snug">
                        {q.question_text}
                      </h3>
                    </div>
                  </div>
                  {q.is_required && (
                    <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                      Zorunlu
                    </span>
                  )}
                </div>

                {/* Input forms based on type */}
                {q.question_type === 'yes_no' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleBoolChange(q.id, true)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-bold text-sm transition-all duration-150 ${
                        currentAns.answer_bool === true
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/5'
                          : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                      EVET
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBoolChange(q.id, false)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-bold text-sm transition-all duration-150 ${
                        currentAns.answer_bool === false
                          ? 'bg-red-500/15 border-red-500 text-red-400 ring-2 ring-red-500/20 shadow-lg shadow-red-500/5'
                          : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      <X className="w-5 h-5" />
                      HAYIR
                    </button>
                  </div>
                )}

                {q.question_type === 'compliant' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleBoolChange(q.id, true)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-bold text-sm transition-all duration-150 ${
                        currentAns.answer_bool === true
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/5'
                          : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      UYGUN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBoolChange(q.id, false)}
                      className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-bold text-sm transition-all duration-150 ${
                        currentAns.answer_bool === false
                          ? 'bg-amber-500/15 border-amber-500 text-amber-400 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/5'
                          : 'bg-slate-950/50 border-slate-850 text-slate-400 hover:bg-slate-800/30'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                      UYGUN DEĞİL
                    </button>
                  </div>
                )}

                {q.question_type === 'text' && (
                  <textarea
                    rows={3}
                    placeholder="Lütfen buraya yazınız..."
                    value={currentAns.answer_text || ''}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/70 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-655 text-sm outline-none transition-all duration-150"
                  />
                )}

                {q.question_type === 'rating' && (
                  <div className="flex items-center justify-center gap-3 py-2 bg-slate-950/40 rounded-xl border border-slate-850/50">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleRatingChange(q.id, val.toString())}
                        className={`w-11 h-11 rounded-lg border font-bold text-base transition-all ${
                          currentAns.answer_text === val.toString()
                            ? 'bg-teal-500/20 border-teal-500 text-teal-400 shadow-md ring-2 ring-teal-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Submission Info section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Denetçi Bilgileri</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Adınız <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet"
                  value={submittedByName}
                  onChange={(e) => setSubmittedByName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/70 rounded-xl px-4 py-3 text-slate-200 text-sm outline-none transition-all duration-150"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Soyadınız <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Yılmaz"
                  value={submittedBySurname}
                  onChange={(e) => setSubmittedBySurname(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/70 rounded-xl px-4 py-3 text-slate-200 text-sm outline-none transition-all duration-150"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Saha Tespitleri / Genel Notlar (Opsiyonel)
              </label>
              <textarea
                rows={3}
                placeholder="Varsa diğer hususları ve eklemek istediğiniz notları belirtin..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/70 rounded-xl px-4 py-3 text-slate-200 text-sm outline-none transition-all duration-150"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-450 hover:from-teal-600 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-800 text-slate-950 font-bold py-4 px-6 rounded-2xl shadow-xl shadow-teal-500/10 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 cursor-pointer text-base uppercase tracking-wider"
          >
            {submitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin text-slate-950" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 text-slate-950" />
                Formu Gönder
              </>
            )}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 mt-12 text-center text-xs text-slate-600 border-t border-slate-900/60 pt-6">
        <div className="flex flex-col items-center gap-1">
          <p className="font-semibold text-slate-500">{consultant?.name}</p>
          {consultant?.phone && <p>Tel: {consultant.phone}</p>}
          {consultant?.email && <p>E-posta: {consultant.email}</p>}
          <p className="mt-2 text-[10px] text-slate-700">Powered by Evraklab QR Inspections</p>
        </div>
      </footer>
    </div>
  );
}
