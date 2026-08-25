import { supabase } from './supabaseClient';

// Yeni üyelik / ekstra modül / ekstra depolama satın alındığında admin/
// system_admin rolündeki kullanıcılara bildirim düşer (AdminPanel > Ödemeler
// & Faturalar sayfasındaki rozet ve üst navbardaki bildirim zili bunu okur).
// PayTR entegrasyonu şu an devre dışı olduğu için gerçek satın almalar
// api/paytrShared.ts > activatePurchase() üzerinden DEĞİL, doğrudan bu
// client tarafındaki satın alma ekranlarından (Pricing.tsx, Storage.tsx,
// ModuleStore.tsx) tamamlanıyor — bu yüzden bildirim de aynı yerden,
// authenticated kullanıcı istemcisiyle gönderiliyor (notifications tablosunun
// INSERT politikası herkese açık: "Allow authenticated to insert
// notifications").
export async function notifyAdminsOfPayment(title: string, message: string) {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'system_admin']);
    if (!admins || admins.length === 0) return;
    await supabase.from('notifications').insert(
      admins.map((a: { id: string }) => ({ user_id: a.id, title, message, type: 'payment' }))
    );
  } catch (err) {
    console.error('Admin bildirimi gönderilemedi:', err);
  }
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
