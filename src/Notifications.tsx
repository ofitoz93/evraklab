import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Bell, Trash2, CheckCircle, AlertTriangle, Shield, Info } from 'lucide-react'; // Shield eklendi

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setNotifications(data || []);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) {
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications(notifications.filter(n => n.id !== id));
    }
  };

  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if(session) {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id);
        fetchNotifications();
    }
  }

  if (loading) return <div className="p-10 text-center dark:text-gray-300">Bildirimler yükleniyor...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Bell className="text-blue-600"/> Bildirim Merkezi
        </h1>
        {notifications.some(n => !n.is_read) && (
            <button onClick={markAllRead} className="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline">
                Tümünü Okundu İşaretle
            </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <Bell size={48} className="mx-auto mb-4 opacity-20"/>
                <p>Henüz bir bildiriminiz yok.</p>
            </div>
        ) : (
            notifications.map(n => {
                // YÖNETİCİ MESAJI KONTROLÜ
                const isAdminMsg = n.type === 'admin_announcement' || n.type === 'admin_msg';
                const isWarning = n.type === 'warning';
                
                return (
                    <div 
                        key={n.id} 
                        className={`relative p-5 rounded-xl border transition group 
                        ${n.is_read ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}
                        ${isAdminMsg ? 'border-l-4 border-l-red-500' : ''} // Admin mesajıysa sol kenar kırmızı
                        `}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`mt-1 p-2 rounded-full flex-shrink-0 
                                ${isAdminMsg ? 'bg-red-100 text-red-600' : isWarning ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                {isAdminMsg ? <Shield size={20}/> : isWarning ? <AlertTriangle size={20}/> : <Info size={20}/>}
                            </div>
                            
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 text-md flex items-center gap-2">
                                        {n.title}
                                        {!n.is_read && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                                        
                                        {/* ADMIN ETİKETİ */}
                                        {isAdminMsg && (
                                            <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded uppercase tracking-wide font-extrabold flex items-center gap-1">
                                                <Shield size={8} fill="currentColor"/> YÖNETİCİ
                                            </span>
                                        )}
                                    </h4>
                                    <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString().slice(0,5)}</span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 leading-relaxed">{n.message}</p>
                                
                                {n.type === 'invite' && (
                                    <div className="mt-3">
                                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700">Daveti Kabul Et</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.is_read && (
                                <button onClick={() => markAsRead(n.id)} className="p-2 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg text-green-600 hover:bg-green-50 shadow-sm" title="Okundu İşaretle">
                                    <CheckCircle size={16}/>
                                </button>
                            )}
                            <button onClick={() => deleteNotification(n.id)} className="p-2 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm" title="Sil">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
}