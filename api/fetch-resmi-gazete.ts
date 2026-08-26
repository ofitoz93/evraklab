// api/fetch-resmi-gazete.ts
// Faz 2: Resmi Gazete günlük bülteninden çevre/İSG ile ilgili yönetmelik ve
// tebliğleri otomatik tarar, admin onayı bekleyen scraped_regulation_candidates
// tablosuna düşürür (asla doğrudan pdf_regulations havuzuna yazmaz — bkz.
// add_scraped_regulation_candidates.sql). AdminPanel > Mevzuat Havuzu >
// "Otomatik Taranan Mevzuatlar" sekmesinden admin onaylayınca gerçek havuza
// (pdf_regulations/pdf_articles) kopyalanır.
//
// DİKKAT: Bu dosyanın geliştirildiği ortamda dışa ağ erişimi yoktu, bu yüzden
// resmigazete.gov.tr'nin güncel HTML yapısı CANLI olarak doğrulanamadı.
// Aşağıdaki ayrıştırma, sitenin uzun süredir stabil olan genel yapısına
// (tarih bazlı arşiv URL'si + "YÖNETMELİKLER"/"TEBLİĞLER" başlıklı liste
// blokları) dayanıyor ve mümkün olduğunca esnek/hataya toleranslı yazıldı
// (CSS sınıf adına değil, başlık metnine ve link desenine güveniyor). İlk
// gerçek çalıştırmada (Vercel'e deploy sonrası veya `npm run dev` ile lokal
// tetiklemede) elde edilen HTML'e göre `extractDailyBulletinLinks` ayarlanması
// gerekebilir.
//
// Vercel Cron varsayılan olarak bu path'e GET isteği atar. Bu endpoint'i
// herkese açık bir URL olarak yayınlamamak için (aksi halde herkes tetikleyip
// gereksiz Gemini/ağ trafiği yaratabilir), CRON_SECRET env değişkeni
// tanımlıysa `Authorization: Bearer <secret>` zorunlu kılınır.

import * as cheerio from 'cheerio';
import { Agent, fetch as undiciFetch } from 'undici';
import iconv from 'iconv-lite';
import { createServiceClient } from './paytrShared';
import { parsePdfLogic } from './parse-pdf';
import { parseLegislationText } from '../src/parserUtils';

const RESMI_GAZETE_BASE = 'https://www.resmigazete.gov.tr';

// Alakasız (vergi, tarım, dış ticaret vb.) yüzlerce günlük kayıt admin
// kuyruğunu boğmasın diye başlık bu anahtar kelimelerden en az biriyle
// eşleşmedikçe aday olarak eklenmez.
const RELEVANT_KEYWORDS = [
  'çevre', 'atık', 'iklim', 'emisyon', 'çed', 'i̇sg', 'is sağlığı', 'iş sağlığı',
  'iş güvenliği', 'karbon', 'sera gazı', 'su kirliliği', 'hava kalitesi',
  'toprak kirliliği', 'ambalaj', 'geri dönüşüm', 'kimyasal', 'gürültü',
  'orman', 'maden', 'radyasyon', 'sıfır atık',
];

// resmigazete.gov.tr gibi birçok .gov.tr sitesi, tarayıcı gibi görünmeyen
// (User-Agent'sız/boş) istekleri reddediyor veya bağlantıyı sıfırlıyor —
// bu da Node'un fetch()'inde HTTP durum koduna bile ulaşamadan genel bir
// "fetch failed" hatası olarak görünüyor. Gerçekçi bir tarayıcı User-Agent'ı
// eklemek bu sınıf sorunların en yaygın çözümü.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

// resmigazete.gov.tr, TLS el sıkışmasında ara sertifikayı (intermediate
// certificate) eksik gönderiyor — tarayıcılar bunu otomatik tamamlıyor (AIA
// chasing) ama Node'un fetch()'i tamamlamıyor ve "unable to verify the first
// certificate" hatasıyla reddediyor. Bu ajan SADECE bu dosyadaki (resmi/genel
// -kamu, salt-okunur) isteklerde sertifika doğrulamasını kapatır — uygulamanın
// geri kalanındaki (Supabase, Gemini, PayTR) hiçbir isteği etkilemez. Çekilen
// içerik zaten admin onayından geçmeden pdf_regulations havuzuna asla
// yazılmaz (bkz. scraped_regulation_candidates), bu riski azaltır.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

// fetch() hatalarının gerçek sebebi (DNS/TLS/bağlantı reddi vb.) Node'da
// err.cause içinde saklanıyor ama err.message sadece "fetch failed" diyor —
// bunu görünür kılmadan teşhis etmek imkansız.
async function fetchLikeBrowser(url: string): Promise<Response> {
  try {
    const res = await undiciFetch(url, { headers: BROWSER_HEADERS, dispatcher: insecureAgent });
    return res as unknown as Response;
  } catch (err: any) {
    const cause = err?.cause?.message || err?.cause?.code || err?.code;
    throw new Error(`Ağ isteği başarısız (${url}): ${err.message}${cause ? ` — sebep: ${cause}` : ''}`);
  }
}

// resmigazete.gov.tr birçok sayfayı hâlâ eski Türkçe kodlamayla (windows-1254/
// ISO-8859-9) yayınlıyor, UTF-8 değil — HTTP Fetch spesifikasyonu gereği
// `Response.text()` her zaman UTF-8 varsayar, bu yüzden Türkçe karakterler
// (ç, ğ, ş, ı, ö, ü, İ) "�" olarak bozuluyordu ve "TEBLİĞ"/"çevre" gibi
// anahtar kelime eşleşmeleri hep başarısız oluyordu. Bu fonksiyon önce
// sayfanın kendi <meta charset> beyanına bakar, yoksa windows-1254'e
// düşer (bu sitede gözlemlenen fiili kodlama) ve hâlâ çok sayıda bozuk
// karakter varsa UTF-8'e geri döner (ihtiyatlı bir sezgisel kontrol).
function decodeHtmlBuffer(buffer: Buffer): string {
  const head = buffer.subarray(0, 2048).toString('latin1');
  const metaMatch = /charset\s*=\s*["']?\s*([\w-]+)/i.exec(head);
  const declaredCharset = metaMatch?.[1]?.toLowerCase();

  const candidates = declaredCharset && declaredCharset !== 'utf-8' && declaredCharset !== 'utf8'
    ? [declaredCharset, 'windows-1254']
    : ['windows-1254'];

  if (!declaredCharset || declaredCharset === 'utf-8' || declaredCharset === 'utf8') {
    const utf8Text = buffer.toString('utf-8');
    const replacementCount = (utf8Text.match(/�/g) || []).length;
    if (replacementCount === 0) return utf8Text;
  }

  for (const enc of candidates) {
    if (iconv.encodingExists(enc)) {
      return iconv.decode(buffer, enc);
    }
  }
  return buffer.toString('utf-8');
}

interface BulletinLink {
  title: string;
  href: string;
  category: 'Yönetmelik' | 'Kanun' | 'Yönerge' | 'Diğer';
}

// `dateOverride` verilirse ('YYYY-MM-DD', örn. AdminPanel'deki manuel tarama
// tarih seçicisinden) o tarih taranır; verilmezse (cron'un normal günlük
// çalışması) bugünün İstanbul tarihi kullanılır.
function resolveDateParts(dateOverride?: string): { yyyy: string; mm: string; dd: string } {
  if (dateOverride) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOverride.trim());
    if (!match) throw new Error(`Geçersiz tarih formatı: "${dateOverride}" (beklenen: YYYY-MM-DD)`);
    const [, yyyy, mm, dd] = match;
    return { yyyy, mm, dd };
  }
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  return {
    yyyy: String(now.getFullYear()),
    mm: String(now.getMonth() + 1).padStart(2, '0'),
    dd: String(now.getDate()).padStart(2, '0'),
  };
}

function guessCategoryFromTitle(title: string): BulletinLink['category'] {
  const t = title.toLocaleUpperCase('tr-TR');
  if (t.includes('KANUN')) return 'Kanun';
  if (t.includes('YÖNERGE')) return 'Yönerge';
  if (t.includes('YÖNETMEL')) return 'Yönetmelik';
  if (t.includes('TEBLİĞ')) return 'Diğer';
  return 'Diğer';
}

function isRelevantTitle(title: string): boolean {
  const t = title.toLocaleLowerCase('tr-TR');
  return RELEVANT_KEYWORDS.some((k) => t.includes(k));
}

// Bülten sayfasındaki "YÖNETMELİKLER"/"TEBLİĞLER" başlıklarını takip eden
// listelerdeki linkleri toplar. Sayfa yapısı değişirse bu fonksiyonun
// güncellenmesi yeterli — çağıran taraf etkilenmez.
function extractDailyBulletinLinks(html: string, pageUrl: string): BulletinLink[] {
  const $ = cheerio.load(html);
  const links: BulletinLink[] = [];
  const seenHref = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const title = $(el).text().trim().replace(/\s+/g, ' ');
    if (!title || title.length < 10 || !href) return;
    // Sadece "YÖNETMELİK"/"TEBLİĞ" geçen link metinlerine bak — bültendeki
    // kanun/karar gibi diğer türleri (kapsam dışı) eler.
    const upper = title.toLocaleUpperCase('tr-TR');
    if (!upper.includes('YÖNETMEL') && !upper.includes('TEBLİĞ')) return;

    const absoluteHref = href.startsWith('http') ? href : new URL(href, pageUrl).toString();
    if (seenHref.has(absoluteHref)) return;
    seenHref.add(absoluteHref);

    links.push({ title, href: absoluteHref, category: guessCategoryFromTitle(title) });
  });

  return links;
}

async function fetchAndExtractText(url: string, apiKey?: string): Promise<{
  articles: Array<{ article_no: string; title: string; content: string; order_index: number }>;
  title: string | null;
}> {
  const res = await fetchLikeBrowser(url);
  if (!res.ok) throw new Error(`Belge indirilemedi (${res.status}): ${url}`);
  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());

  if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
    const parsed = await parsePdfLogic(buffer, url.split('/').pop() || 'regulation.pdf', apiKey);
    return { articles: parsed.articles, title: parsed.title };
  }

  // HTML sayfası: metne çevirip mevcut regex tabanlı madde ayrıştırıcıyı
  // (parseLegislationText) kullan — Gemini'ye PDF olmayan içerik gönderilmez.
  const $ = cheerio.load(decodeHtmlBuffer(buffer));
  const text = $('body').text().replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
  const articles = parseLegislationText(text);
  return { articles, title: null };
}

export interface FetchResmiGazeteResult {
  bulletinUrl: string;
  scannedDate: string; // YYYY-MM-DD
  totalLinksFound: number;
  relevantLinksFound: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function fetchResmiGazeteLogic(dateOverride?: string): Promise<FetchResmiGazeteResult> {
  const { yyyy, mm, dd } = resolveDateParts(dateOverride);
  const scannedDate = `${yyyy}-${mm}-${dd}`;
  const bulletinUrl = `${RESMI_GAZETE_BASE}/eskiler/${yyyy}/${mm}/${yyyy}${mm}${dd}.htm`;

  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  const bulletinRes = await fetchLikeBrowser(bulletinUrl);
  if (!bulletinRes.ok) {
    // 404 en sık nedeni: o tarihte Resmi Gazete yayımlanmamış (hafta sonu/
    // resmi tatil) — bunu genel bir hata yerine anlaşılır bir mesajla ilet.
    if (bulletinRes.status === 404) {
      throw new Error(`${scannedDate} tarihinde Resmi Gazete yayımlanmamış (hafta sonu/resmi tatil olabilir).`);
    }
    throw new Error(`Günlük bülten sayfası alınamadı (${bulletinRes.status}): ${bulletinUrl}`);
  }
  const bulletinHtml = decodeHtmlBuffer(Buffer.from(await bulletinRes.arrayBuffer()));
  const allLinks = extractDailyBulletinLinks(bulletinHtml, bulletinUrl);
  const relevantLinks = allLinks.filter((l) => isRelevantTitle(l.title));

  if (relevantLinks.length === 0) {
    return {
      bulletinUrl,
      scannedDate,
      totalLinksFound: allLinks.length,
      relevantLinksFound: 0,
      inserted: 0,
      skipped: 0,
      errors: [],
    };
  }

  const supabase = createServiceClient();
  const geminiApiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  for (const link of relevantLinks) {
    try {
      const { data: existing } = await supabase
        .from('scraped_regulation_candidates')
        .select('id')
        .eq('source', 'resmi_gazete')
        .eq('source_url', link.href)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const { articles, title: parsedTitle } = await fetchAndExtractText(link.href, geminiApiKey);

      const { error: insertError } = await supabase.from('scraped_regulation_candidates').insert({
        source: 'resmi_gazete',
        source_url: link.href,
        title: parsedTitle || link.title,
        category: link.category,
        rg_date: scannedDate,
        articles,
        status: 'pending',
      });
      if (insertError) {
        // Aynı source_url'i başka bir eşzamanlı çalıştırma az önce eklemiş
        // olabilir (UNIQUE ihlali) — bu normal bir çakışma, hata değil.
        if ((insertError as any).code === '23505') {
          skipped++;
        } else {
          throw insertError;
        }
      } else {
        inserted++;
      }
    } catch (err: any) {
      errors.push(`${link.title}: ${err.message || err}`);
    }
  }

  return {
    bulletinUrl,
    scannedDate,
    totalLinksFound: allLinks.length,
    relevantLinksFound: relevantLinks.length,
    inserted,
    skipped,
    errors,
  };
}

function isAuthorized(req: any): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // Ortam değişkeni tanımlı değilse serbest bırak (dev/ilk kurulum)
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  return authHeader === `Bearer ${cronSecret}`;
}

// Vercel Cron her zaman GET ile, tarihsiz çağırır (bugünü tarar) — bu yol
// CRON_SECRET ile korunur. AdminPanel'deki "Belirli Tarihi Tara" formu ise
// POST ile gövdede { date: 'YYYY-MM-DD' } gönderir; api/parse-pdf.ts ile aynı
// güvenlik modelini izler (admin panelinden gelen POST istekleri sunucu
// tarafında ayrıca doğrulanmaz — CRON_SECRET burada uygulanmaz, aksi halde
// admin'in tarayıcısından atılan istek de 401 alırdı).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && !isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    let dateOverride: string | undefined;
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      dateOverride = body.date || undefined;
    } else {
      dateOverride = req.query?.date || undefined;
    }

    const result = await fetchResmiGazeteLogic(dateOverride);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Resmi Gazete Fetch] Hata:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
