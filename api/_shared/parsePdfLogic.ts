// api/_shared/parsePdfLogic.ts
// `_shared/` altında olduğu için Vercel bunu bir route/fonksiyon olarak
// algılamaz — api/parse-pdf.ts (kendi route'u) ve api/fetch-resmi-gazete.ts
// (aday mevzuatları ayrıştırmak için) tarafından import edilir. Önceden bu
// mantık doğrudan api/parse-pdf.ts içindeydi; fetch-resmi-gazete.ts onu
// oradan import ettiğinde Vercel'in her ikisini de ayrı, izole fonksiyonlar
// olarak deploy etmesi runtime'da "Cannot find module" hatasına yol açıyordu.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseLegislationText } from '../../src/parserUtils';

// Standardized structure returned by the API
interface ParseResult {
  title: string;
  category: 'Yönetmelik' | 'Kanun' | 'Yönerge' | 'Diğer';
  publication_date: string | null;
  effective_date: string | null;
  rg_no: string | null;
  rg_date: string | null;
  articles: Array<{
    article_no: string;
    title: string;
    content: string;
    order_index: number;
  }>;
}

export async function parsePdfLogic(
  fileBuffer: Buffer,
  fileName: string,
  apiKey?: string
): Promise<ParseResult> {
  const base64Data = fileBuffer.toString('base64');

  // 1. Try Gemini API if key is available
  if (apiKey && apiKey !== '<GEMINI_API_ANAHTARINIZ>' && apiKey.trim() !== '') {
    try {
      console.log('[Parser] Attempting parsing via Gemini AI API...');

      const prompt = `Aşağıdaki resmi mevzuat/yönetmelik/kanun/yönerge PDF belgesini analiz et. Belgeden aşağıdaki bilgileri çıkar:
1. Mevzuat/Yönetmelik Başlığı (title)
2. Kategorisi (category: 'Yönetmelik', 'Kanun', 'Yönerge' veya 'Diğer')
3. Yayın Tarihi (publication_date: YYYY-MM-DD formatında veya null)
4. Yürürlük Tarihi (effective_date: YYYY-MM-DD formatında veya null)
5. Resmi Gazete Sayısı (rg_no: Örn '31234' veya null)
6. Resmi Gazete Tarihi (rg_date: YYYY-MM-DD formatında veya null)
7. Mevzuatın Maddeleri ve Alt Bentleri (articles)

ÖNEMLİ: Hiyerarşik Yapı Kuralları:
Sistemimizde, uyum takibini kolaylaştırmak için, her bir madde alt bendi (bent, fıkra, a, b, c bentleri, 1, 2, 3 fıkraları) veritabanına AYRI BİRER SATIR (madde) olarak kaydedilmektedir.
Bu nedenle, 'articles' dizisinde her bir bent veya fıkrayı ayrı bir eleman olarak çıkar.
Örnek olarak, eğer 'MADDE 5' altında '(1)', '(2)' fıkraları ve '(1)' fıkrasının altında 'a)', 'b)' bentleri varsa, bunları şu şekilde ayır ve articles dizisine ayrı ayrı ekle:
- article_no: 'MADDE 5 (1) a)', title: 'Maddenin Başlığı', content: 'a) ...'
- article_no: 'MADDE 5 (1) b)', title: 'Maddenin Başlığı', content: 'b) ...'
- article_no: 'MADDE 5 (2)', title: 'Maddenin Başlığı', content: '(2) ...'

Her bir eleman için:
- article_no: İlgili maddeyi ve alt bent harfini/numarasını içeren tam kod. (Örn: 'MADDE 1 (1)', 'MADDE 1 (1) a)')
- title: Maddenin ana başlığı (Örn: 'Amaç ve Kapsam'). Bu başlık alt bentler için de tekrarlanmalıdır, böylece her bent hangi maddenin parçası olduğu anlaşılır.
- content: Bendin/fıkranın içeriği (bendin/fıkranın harfi/işareti ile başlamalıdır, Örn: '(1) Bu Yönetmelik...' veya 'a) İş sağlığı güvenliği...')`;

      // Use gemini-2.5-flash as default, fallback to gemini-1.5-flash if needed
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  category: { type: 'STRING', enum: ['Yönetmelik', 'Kanun', 'Yönerge', 'Diğer'] },
                  publication_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                  effective_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                  rg_no: { type: 'STRING' },
                  rg_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                  articles: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        article_no: { type: 'STRING' },
                        title: { type: 'STRING' },
                        content: { type: 'STRING' },
                      },
                      required: ['article_no', 'content'],
                    },
                  },
                },
                required: ['title', 'category', 'articles'],
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const responseJson = await response.json();
      const textResult = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResult) {
        throw new Error('Gemini API returned empty text response.');
      }

      const parsedData = JSON.parse(textResult);

      // Add order_index to articles
      const finalArticles = (parsedData.articles || []).map((art: any, index: number) => ({
        article_no: art.article_no || `MADDE ${index + 1}`,
        title: art.title || parsedData.title || '',
        content: art.content || '',
        order_index: index + 1,
      }));

      console.log(`[Parser] Successfully parsed ${finalArticles.length} articles via Gemini.`);

      return {
        title: parsedData.title || fileName.replace(/\.pdf$/i, ''),
        category: parsedData.category || 'Yönetmelik',
        publication_date: parsedData.publication_date || null,
        effective_date: parsedData.effective_date || null,
        rg_no: parsedData.rg_no || null,
        rg_date: parsedData.rg_date || null,
        articles: finalArticles,
      };
    } catch (geminiError) {
      console.warn('[Parser] Gemini parsing failed, falling back to local extractor:', geminiError);
    }
  }

  // 2. Marker (https://github.com/datalab-to/marker): PDF -> temiz Markdown dönüşümü.
  // Yerel/self-hosted bir Marker sunucusu (bkz. start_marker.bat, requirements_marker.txt)
  // çalışıyorsa, pdf.js'in ham koordinat-tabanlı satır birleştirmesinden çok daha
  // düzenli/yapılandırılmış metin üretir; bu da "MADDE X" ayrımının doğruluğunu artırır.
  const markerText = await tryExtractWithMarker(fileBuffer, fileName);
  if (markerText) {
    console.log('[Parser] Marker sunucusundan metin alındı, regex ile madde ayrıştırılıyor...');
    const articles = parseLegislationText(markerText);
    if (articles.length > 0) {
      const meta = guessMetadataFromText(markerText, fileName);
      return {
        title: meta.title,
        category: meta.category,
        publication_date: meta.rg_date,
        effective_date: null,
        rg_no: meta.rg_no,
        rg_date: meta.rg_date,
        articles,
      };
    }
    console.warn('[Parser] Marker metninden madde çıkarılamadı, pdf.js yedeğine geçiliyor...');
  }

  // 3. Son yedek: pdf.js ile metin çıkar ve regex ile ayrıştır
  console.log('[Parser] Executing local regex fallback parser (pdf.js)...');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by coordinate like client-side parser to preserve layout
    const lineGroups: any[] = [];
    for (const item of textContent.items as any[]) {
      if (!item.transform) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const tolerance = 3;

      let group = lineGroups.find(g => Math.abs(g.y - y) < tolerance);
      if (group) {
        group.items.push({ str: item.str, x });
      } else {
        lineGroups.push({ y, items: [{ str: item.str, x }] });
      }
    }

    lineGroups.sort((a, b) => b.y - a.y);
    const pageText = lineGroups.map(group => {
      return group.items
        .sort((a: any, b: any) => a.x - b.x)
        .map((item: any) => item.str)
        .join(' ');
    }).join('\n');

    fullText += pageText + '\n';
  }

  // Parse articles via our regex helper
  const articles = parseLegislationText(fullText);
  const { category, title, rg_no, rg_date } = guessMetadataFromText(fullText, fileName);

  return {
    title,
    category,
    publication_date: rg_date, // Use RG date as publication date guess
    effective_date: null,
    rg_no,
    rg_date,
    articles,
  };
}

/**
 * Yerel/self-hosted Marker sunucusuna (bkz. start_marker.bat, varsayılan port 8001)
 * bağlanıp PDF'i Markdown'a çevirir. Sunucu yapılandırılmamışsa veya erişilemiyorsa
 * null döner ve çağıran taraf pdf.js yedeğine geçer.
 */
async function tryExtractWithMarker(fileBuffer: Buffer, fileName: string): Promise<string | null> {
  const baseUrl = process.env.MARKER_SERVER_URL || process.env.VITE_MARKER_SERVER_URL || 'http://127.0.0.1:8001';
  const endpoints = ['/convert', '/convert/single', '/marker'];

  for (const endpoint of endpoints) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), fileName);

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) continue;

      const data: any = await response.json();
      const text = data.markdown || data.text || data.content || data.markdown_text;
      if (text && typeof text === 'string' && text.trim().length > 0) {
        return text;
      }
    } catch (err) {
      // Sunucu çalışmıyor olabilir (yerel geliştirme dışı ortamlarda beklenen durum) - sessizce bir sonraki endpoint'e geç
      continue;
    }
  }
  return null;
}

function guessMetadataFromText(
  fullText: string,
  fileName: string
): { category: 'Yönetmelik' | 'Kanun' | 'Yönerge' | 'Diğer'; title: string; rg_no: string | null; rg_date: string | null } {
  // Guess metadata from text
  let category: 'Yönetmelik' | 'Kanun' | 'Yönerge' | 'Diğer' = 'Yönetmelik';
  const textLower = fullText.toLowerCase();
  if (textLower.includes('kanun')) category = 'Kanun';
  else if (textLower.includes('yönerge')) category = 'Yönerge';

  // Guess title from first non-empty lines
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  let title = fileName.replace(/\.pdf$/i, '');
  if (lines.length > 0) {
    // Find a line that looks like a title
    const potentialTitle = lines.slice(0, 5).find(l => l.length > 10 && l.length < 150 && !l.includes('Madde'));
    if (potentialTitle) {
      title = potentialTitle;
    }
  }

  // Guess RG number and date using regex
  let rg_no: string | null = null;
  let rg_date: string | null = null;

  const rgNoMatch = fullText.match(/(?:Resmî\s+Gazete\s+Sayı|Sayı|RG\s+No)[:\s]*([0-9\/\-]+)/i);
  if (rgNoMatch) {
    rg_no = rgNoMatch[1].trim();
  }

  const rgDateMatch = fullText.match(/(?:Tarih|RG\s+Tarih)[:\s]*([0-9]{2}[\.\/][0-9]{2}[\.\/][0-9]{4})/i);
  if (rgDateMatch) {
    // Standardize to YYYY-MM-DD
    const parts = rgDateMatch[1].split(/[\.\/]/);
    if (parts.length === 3) {
      rg_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  return { category, title, rg_no, rg_date };
}
