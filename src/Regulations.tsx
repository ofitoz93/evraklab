import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Scale, FileText, ChevronRight, Users, CheckSquare, Square, X, MessageCircle, Send, PlusCircle, Trash2, Edit, Save, XCircle } from 'lucide-react';

export default function Regulations() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  const [regulations, setRegulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Okuma Modu
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [articles, setArticles] = useState<any[]>([]);
  
  // Yorumlar (Sadece Kendi Firmalarına Ait Olanlar)
  const [comments, setComments] = useState<any[]>([]);
  const [activeCommentTarget, setActiveCommentTarget] = useState<string | null>(null); // 'general' veya 'article_id'
  const [commentText, setCommentText] = useState('');
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Firma Yöneticisi Yetkilendirme Modalı
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [companyRegulations, setCompanyRegulations] = useState<any[]>([]);
  // user => [reg_id, reg_id]
  const [userAssignedRegs, setUserAssignedRegs] = useState<Record<string, string[]>>({});

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
       setCurrentUser(session.user);
       const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
       setProfile(prof);
       fetchAllowedRegulations(prof);
    }
  };

  const fetchAllowedRegulations = async (prof: any) => {
     setLoading(true);
     if (prof?.role === 'admin') {
         // Sistem yöneticisi hepsini görebilir
         const { data } = await supabase.from('regulations').select('*');
         setRegulations(data || []);
     } 
     else if (prof?.role === 'premium_corporate' || prof?.role === 'corporate_chief') {
         // Firma yöneticisi firmaya atanmışları görür
         const { data, error } = await supabase
            .from('company_regulations')
            .select('regulation_id, regulations(*) ')
            .eq('organization_id', prof.organization_id);
            
         if (error) console.error("Firma mevzuat hatası:", error);
         if (data) setRegulations(data.map((d: any) => d.regulations));
     } 
     else {
         // Normal kullanıcı kendine atanmış olanları görür
         const { data } = await supabase
            .from('user_regulations')
            .select('regulation_id, regulations(*) ')
            .eq('user_id', prof?.id);
         if (data) setRegulations(data.map((d: any) => d.regulations));
     }
     setLoading(false);
  };

  const openReadingMode = async (regId: string) => {
      setSelectedRegId(regId);
      const { data } = await supabase.from('regulation_articles').select('*').eq('regulation_id', regId).order('order_index', { ascending: true });
      setArticles(data || []);
      
      // Yorumları Çek
      if(profile?.organization_id) {
          const { data: comms, error } = await supabase.from('regulation_comments')
               .select('*')
               .eq('regulation_id', regId)
               .eq('organization_id', profile.organization_id)
               .order('created_at', { ascending: true });
          
          if (error) console.error("Yorum çekme hatası:", error);
          
          if (comms && comms.length > 0) {
              const uIds = Array.from(new Set(comms.map(c => c.user_id)));
              const { data: profs } = await supabase.from('profiles').select('id, full_name, role').in('id', uIds);
              
              const merged = comms.map(c => ({
                 ...c,
                 author: profs?.find(p => p.id === c.user_id)
              }));
              setComments(merged);
          } else {
              setComments([]);
          }
      }
  };

  const handleSendComment = async (articleId: string | null) => {
      if(!commentText.trim()) return;
      const { error } = await supabase.from('regulation_comments').insert([{
           organization_id: profile.organization_id,
           regulation_id: selectedRegId,
           article_id: articleId,
           user_id: currentUser.id,
           content: commentText
      }]);
      
      if(!error) {
          setCommentText('');
          setActiveCommentTarget(null);
          // Yeniden yorumları çek
          openReadingMode(selectedRegId!);
      } else {
          alert('Yorum eklenirken hata oluştu!');
      }
  };

  const handleDeleteComment = async (id: string) => {
      if(!window.confirm("Bu yorumu tamamen silmek istediğinize emin misiniz?")) return;
      const { error } = await supabase.from('regulation_comments').delete().eq('id', id);
      if(!error) openReadingMode(selectedRegId!);
  };

  const handleSaveEdit = async (id: string) => {
      if(!editContent.trim()) return;
      const { error } = await supabase.from('regulation_comments').update({ content: editContent }).eq('id', id);
      if(!error) {
          setEditingCommentId(null);
          openReadingMode(selectedRegId!);
      }
  };

  const canModify = (comment: any) => {
      if (!profile || !currentUser) return false;
      if (currentUser.id === comment.user_id) return true; // Kendi yorumu
      if (profile.role === 'premium_corporate') return true; // Firma sahibi her şeyi silebilir/düzenler
      // Departman şefi ise ama yorum sahibi firma sahibi değilse
      if (profile.role === 'corporate_chief' && comment.author?.role !== 'premium_corporate') return true;
      return false;
  };

  // --- YETKİLENDİRME (FİRMA YÖNETİCİSİ İÇİN) ---
  const openDelegationModal = async () => {
      if(!profile?.organization_id) return;
      setIsDelegateModalOpen(true);
      
      // Şirket çalışanlarını getir
      const { data: users } = await supabase.from('profiles').select('id, full_name, role').eq('organization_id', profile.organization_id);
      setCompanyUsers(users || []);

      // Şirkete atanmış mevzuatları al
      const { data: cRegs } = await supabase.from('company_regulations').select('regulation_id, regulations(*)').eq('organization_id', profile.organization_id);
      const allCRegs = cRegs?.map((d:any) => d.regulations) || [];
      setCompanyRegulations(allCRegs);

      // Mevcut atamaları al
      const { data: uRegs } = await supabase.from('user_regulations');
      
      const mapping: Record<string, string[]> = {};
      if(users) {
          users.forEach((u: any) => { mapping[u.id] = [] });
      }
      if(uRegs) {
         uRegs.forEach((ur: any) => {
             if(mapping[ur.user_id]) {
                 mapping[ur.user_id].push(ur.regulation_id);
             }
         });
      }
      setUserAssignedRegs(mapping);
  };

  const toggleUserDelegation = async (userId: string, regId: string) => {
      const assigned = userAssignedRegs[userId] || [];
      const hasIt = assigned.includes(regId);

      if (hasIt) {
          // Sil
          await supabase.from('user_regulations').delete().eq('user_id', userId).eq('regulation_id', regId);
          setUserAssignedRegs({
              ...userAssignedRegs, 
              [userId]: assigned.filter(r => r !== regId)
          });
      } else {
          // Ekle
          await supabase.from('user_regulations').insert([{ user_id: userId, regulation_id: regId, assigned_by: currentUser.id }]);
          setUserAssignedRegs({
              ...userAssignedRegs,
              [userId]: [...assigned, regId]
          });
      }
  };


  const isManager = profile?.role === 'premium_corporate' || profile?.role === 'corporate_chief';

  if (loading) return <div className="p-8">Yükleniyor...</div>;

  return (
    <div className="p-4 md:p-6 mb-20 md:mb-0 max-w-5xl mx-auto animate-fadeIn">
       
       <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-slate-800">
           <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
                  <Scale size={28} />
               </div>
               <div>
                  <h1 className="text-2xl font-bold">Mevzuat Takibi</h1>
                  <p className="text-gray-500 text-sm">Size tanımlı olan güncel yönetmelik ve standartları buradan inceleyebilirsiniz.</p>
               </div>
           </div>
           
           {isManager && (
               <button onClick={openDelegationModal} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm font-bold shadow">
                   <Users size={18} /> Çalışan Yetkileri
               </button>
           )}
       </div>

       {/* LİSTELEME MODU */}
       {!selectedRegId && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {regulations.map((reg) => (
                   <div key={reg.id} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                       <div>
                           <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                               <FileText size={18} />
                               <span className="text-xs font-bold uppercase tracking-wider">{reg.rg_no ? `RG: ${reg.rg_no}` : 'GENEL'}</span>
                           </div>
                           <h3 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">{reg.title}</h3>
                           <p className="text-sm text-gray-500 mt-2">
                               Yürürlük: <span className="font-semibold text-gray-700 dark:text-gray-300">{reg.effective_date || '-'}</span>
                           </p>
                       </div>
                       <button onClick={() => openReadingMode(reg.id)} className="mt-4 w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border dark:border-slate-600 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2">
                           İçeriği Oku <ChevronRight size={16} />
                       </button>
                   </div>
               ))}

               {regulations.length === 0 && (
                   <div className="col-span-full py-12 text-center text-gray-500 bg-white dark:bg-slate-800 rounded-lg border border-dashed dark:border-slate-700">
                       <Scale size={48} className="mx-auto mb-4 text-gray-300 dark:text-slate-600" />
                       <h3 className="text-lg font-bold">Mevzuat Bulunamadı</h3>
                       <p>Size atanmış herhangi bir mevzuat / yönetmelik kaydı bulunmuyor.</p>
                   </div>
               )}
           </div>
       )}

       {/* OKUMA MODU */}
       {selectedRegId && (
           <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-lg flex flex-col h-[75vh]">
               <div className="p-4 border-b dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                   <h2 className="font-bold text-lg flex-1 mr-4">{regulations.find(r => r.id === selectedRegId)?.title}</h2>
                   <button onClick={() => {setSelectedRegId(null); setActiveCommentTarget(null); setCommentText('');}} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-sm font-bold flex items-center gap-1 transition">
                       <ChevronRight className="rotate-180" size={16} /> Geri
                   </button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                   {/* GENEL YÖNETMELİK YORUMLARI */}
                   <div className="mb-6 p-4 rounded-xl border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/10 dark:border-l-orange-600">
                       <div className="flex justify-between items-start mb-3">
                           <h3 className="font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2"><MessageCircle size={18} /> Yönetmelik Genel Notları</h3>
                           {isManager && activeCommentTarget !== 'general' && (
                               <button onClick={() => { setActiveCommentTarget('general'); setCommentText(''); }} className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded font-bold hover:bg-orange-300 transition">
                                   + Not Ekle
                               </button>
                           )}
                       </div>
                       
                       {/* Yorum Listesi Geneli */}
                       <div className="space-y-3 mb-3">
                           {comments.filter(c => c.article_id === null).map((c) => (
                               <div key={c.id} className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border border-orange-100 dark:border-orange-800 group/item">
                                   {editingCommentId === c.id ? (
                                       <div className="flex flex-col gap-2">
                                           <textarea className="w-full text-sm p-2 outline-none border rounded mr-2" value={editContent} onChange={e => setEditContent(e.target.value)} />
                                           <div className="flex gap-2 justify-end">
                                               <button onClick={() => setEditingCommentId(null)} className="text-gray-500 hover:text-gray-700 flex items-center gap-1"><XCircle size={14}/> İptal</button>
                                               <button onClick={() => handleSaveEdit(c.id)} className="text-green-600 font-bold hover:text-green-700 flex items-center gap-1"><Save size={14}/> Kaydet</button>
                                           </div>
                                       </div>
                                   ) : (
                                       <>
                                           <div className="flex justify-between border-b border-orange-50 dark:border-slate-700 pb-1 mb-2">
                                               <span className="text-xs font-bold text-orange-700">{c.author?.full_name || 'Yönetici'}</span>
                                               <div className="flex gap-3 items-center">
                                                   <span className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleString()}</span>
                                                   {canModify(c) && (
                                                       <div className="flex gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                           <button onClick={() => {setEditingCommentId(c.id); setEditContent(c.content);}} className="text-blue-500 hover:text-blue-700"><Edit size={14}/></button>
                                                           <button onClick={() => handleDeleteComment(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                                       </div>
                                                   )}
                                               </div>
                                           </div>
                                           <p className="text-sm pb-1 whitespace-pre-wrap">{c.content}</p>
                                       </>
                                   )}
                               </div>
                           ))}
                       </div>

                       {isManager && activeCommentTarget === 'general' && (
                           <div className="bg-white dark:bg-slate-800 p-2 rounded border border-orange-200 dark:border-orange-700 flex flex-col gap-2 shadow-sm animate-fadeIn">
                               <textarea autoFocus rows={2} className="w-full text-sm p-2 outline-none resize-none dark:bg-slate-700 dark:text-white" placeholder="Firma personelleri için bu yönetmelikle ilgili genel bir açıklama/not girin..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                               <div className="flex justify-end gap-2 border-t pt-2 dark:border-slate-600">
                                    <button onClick={() => setActiveCommentTarget(null)} className="text-xs text-gray-500 hover:text-gray-700">İptal</button>
                                    <button onClick={() => handleSendComment(null)} className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 hover:bg-orange-600"><Send size={12} /> Kaydet</button>
                               </div>
                           </div>
                       )}
                   </div>

                   <hr className="dark:border-slate-700" />

                   {articles.length === 0 ? (
                       <div className="text-center text-gray-500 py-10">Maddeler henüz yüklenmemiş.</div>
                   ) : (
                       articles.map((art, i) => (
                           <div key={art.id} className="group border-b pb-6 dark:border-slate-700">
                               <div className="flex justify-between items-start mb-2">
                                   <h3 className="font-bold text-blue-800 dark:text-blue-400 text-lg">{art.article_no ? `Madde ${art.article_no}` : ''} {art.title ? `- ${art.title}` : ''}</h3>
                                   {isManager && activeCommentTarget !== art.id && (
                                       <button onClick={() => { setActiveCommentTarget(art.id); setCommentText(''); }} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <PlusCircle size={12}/> Yorum Yap
                                       </button>
                                   )}
                               </div>
                               <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{art.content}</div>

                               {/* O Maddeye Ait Yorumlar */}
                               {comments.filter(c => c.article_id === art.id).length > 0 && (
                                   <div className="mt-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
                                       {comments.filter(c => c.article_id === art.id).map(c => (
                                           <div key={c.id} className="bg-blue-50/50 dark:bg-slate-800/50 p-3 rounded border border-blue-100 dark:border-slate-700 group/item">
                                               {editingCommentId === c.id ? (
                                                   <div className="flex flex-col gap-2">
                                                       <textarea className="w-full text-sm p-2 outline-none border rounded mr-2" value={editContent} onChange={e => setEditContent(e.target.value)} />
                                                       <div className="flex gap-2 justify-end">
                                                           <button onClick={() => setEditingCommentId(null)} className="text-gray-500 hover:text-gray-700 flex items-center gap-1"><XCircle size={14}/> İptal</button>
                                                           <button onClick={() => handleSaveEdit(c.id)} className="text-green-600 font-bold hover:text-green-700 flex items-center gap-1"><Save size={14}/> Kaydet</button>
                                                       </div>
                                                   </div>
                                               ) : (
                                                   <>
                                                       <div className="flex justify-between items-center mb-1">
                                                           <span className="text-[11px] font-bold text-blue-800 dark:text-blue-400">{c.author?.full_name || 'Yönetici'}</span>
                                                           <div className="flex gap-3 items-center">
                                                               <span className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
                                                               {canModify(c) && (
                                                                   <div className="flex gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                       <button onClick={() => {setEditingCommentId(c.id); setEditContent(c.content);}} className="text-blue-500 hover:text-blue-700"><Edit size={14}/></button>
                                                                       <button onClick={() => handleDeleteComment(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                                                   </div>
                                                               )}
                                                           </div>
                                                       </div>
                                                       <p className="text-sm text-gray-700 dark:text-gray-300">{c.content}</p>
                                                   </>
                                               )}
                                           </div>
                                       ))}
                                   </div>
                               )}

                               {/* Yeni Yorum Kutusu */}
                               {isManager && activeCommentTarget === art.id && (
                                   <div className="mt-3 bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-blue-200 dark:border-slate-600 animate-fadeIn ml-4">
                                       <textarea autoFocus rows={2} className="w-full text-sm p-2 outline-none resize-none bg-transparent dark:text-white" placeholder="Bu madde ile ilgili personele not bırakın..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                                       <div className="flex justify-end gap-2 border-t pt-2 dark:border-slate-600">
                                            <button onClick={() => setActiveCommentTarget(null)} className="text-xs text-gray-500 hover:text-gray-700">İptal</button>
                                            <button onClick={() => handleSendComment(art.id)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700"><Send size={12} /> Ekle</button>
                                       </div>
                                   </div>
                               )}
                           </div>
                       ))
                   )}
               </div>
           </div>
       )}


       {/* YETKİLENDİRME MODALI (Firmalar İçin) */}
       {isDelegateModalOpen && (
           <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
                  <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center">
                      <div>
                          <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-purple-600"/> Personel Mevzuat Yetkileri</h2>
                          <p className="text-sm text-gray-500">Firmaya atanan mevzuatları, personellerin okuyabilmesi için tanımlayın.</p>
                      </div>
                      <button onClick={() => setIsDelegateModalOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-5">
                      <table className="w-full text-left">
                          <thead>
                              <tr className="border-b-2 dark:border-slate-700">
                                  <th className="pb-3 text-sm font-bold text-gray-500">Personel</th>
                                  {companyRegulations.map(reg => (
                                      <th key={reg.id} className="pb-3 px-2 text-xs font-bold text-gray-500 text-center w-24">
                                          <div title={reg.title} className="truncate w-full mx-auto">{reg.title.substring(0,25)}</div>
                                      </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody>
                              {companyUsers.map(user => (
                                  <tr key={user.id} className="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                      <td className="py-3 text-sm font-semibold">{user.full_name || 'İsimsiz Kullanıcı'} <span className="text-xs text-gray-400">({user.role})</span></td>
                                      {companyRegulations.map(reg => {
                                          const hasAssigned = (userAssignedRegs[user.id] || []).includes(reg.id);
                                          return (
                                              <td key={reg.id} className="py-3 px-2 text-center">
                                                  <button onClick={() => toggleUserDelegation(user.id, reg.id)} className="focus:outline-none transition-transform hover:scale-110">
                                                      {hasAssigned ? <CheckSquare size={20} className="text-green-500 inline-block"/> : <Square size={20} className="text-gray-300 dark:text-slate-600 inline-block" />}
                                                  </button>
                                              </td>
                                          );
                                      })}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
           </div>
       )}

    </div>
  );
}
