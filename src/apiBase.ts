import { Capacitor } from '@capacitor/core';

// Web'de (tarayıcı, Vercel) "/api/*" istekleri aynı origin'e gider ve
// vercel.json'daki rewrite/vite.config.ts'teki dev middleware tarafından
// karşılanır. Capacitor ile paketlenen native uygulamada ise WebView kendi
// yerel origin'inden (Android: https://localhost, iOS: capacitor://localhost)
// servis edildiği için o rewrite yok — native'de "/api/*" istekleri gerçek
// production domainine mutlak URL ile gönderilmeli, yoksa sessizce 404 döner.
const PRODUCTION_ORIGIN = (import.meta.env.VITE_APP_BASE_URL as string | undefined) || 'https://evraklab.com';

export function apiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    return `${PRODUCTION_ORIGIN}${path}`;
  }
  return path;
}
