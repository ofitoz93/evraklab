import * as pdfjsLib from 'pdfjs-dist';

// Vite-style worker path
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface LocalAnalysisResult {
    docType: string;
    acquisitionDate: string | null;
    expiryDate: string | null;
    isIndefinite: boolean;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Local Marker sunucusuna baglanarak PDF'i Markdown'a donusturur.
 * Sunucu calismiyorsa pdf.js'e geri doner.
 */
async function extractTextWithMarker(file: File): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append('file', file);

        // Vite proxy'si (/marker-api) kullanılarak CORS engeli aşılır.
        // Farklı sunucu sürümlerine göre sırasıyla /convert, /convert/single ve /marker denenir.
        const endpoints = [
            '/marker-api/convert',
            '/marker-api/convert/single',
            '/marker-api/marker'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    body: formData,
                });
                if (response.ok) {
                    const data = await response.json();
                    const text = data.markdown || data.text || data.content || data.markdown_text;
                    if (text) return text;
                }
            } catch (err) {
                console.warn(`${endpoint} denemesinde hata oluştu, bir sonrakine geçiliyor:`, err);
            }
        }
        return null;
    } catch (error) {
        console.warn('Marker sunucusuna bağlanılamadı. Yerel tarayıcı (pdf.js) kullanılıyor.');
        return null;
    }
}

/**
 * PDF dosyasından metin ayıklar
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    // 1. Durak: Marker Sunucusu (En kaliteli sonuc)
    const markerText = await extractTextWithMarker(file);
    if (markerText) return markerText;

    // 2. Durak: pdf.js (Yerel, cevrimdisi ve sunucusuz)
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Reconstruct text lines by grouping items on the same line (approximate coordinate matching)
        const lineGroups = textContent.items.reduce((acc: any[], item: any) => {
            if (!item.transform) return acc;
            const x = item.transform[4];
            const y = item.transform[5];
            
            // Look for a line group with y-coordinate within 3 units tolerance
            const tolerance = 3;
            let group = acc.find(g => Math.abs(g.y - y) < tolerance);
            if (group) {
                group.items.push({ str: item.str, x });
            } else {
                acc.push({ y, items: [{ str: item.str, x }] });
            }
            return acc;
        }, []);

        // Sort lines descending (from top of the page to bottom)
        lineGroups.sort((a, b) => b.y - a.y);

        // Sort items inside each line ascending (from left to right) and join with space
        const pageLines = lineGroups.map(group => {
            return group.items
                .sort((a: any, b: any) => a.x - b.x)
                .map((item: any) => item.str)
                .join(' ');
        });

        fullText += pageLines.join('\n') + '\n';
    }
    
    return fullText;
}

/**
 * Metni yerel kurallarla analiz eder (Regex + Keyword)
 */
export function analyzeTextLocally(text: string, fileName: string): LocalAnalysisResult {
    const lowerText = text.toLowerCase();
    
    // 1. Belge Türü Tahmini
    const docTypes = [
        { keywords: ['msds', 'güvenlik bilgi formu', 'gbf', 'safety data sheet', 'material safety', 'data sheet'], label: 'MSDS (Güvenlik Bilgi Formu)' },
        { keywords: ['çevre izni', 'çevre izin'], label: 'Çevre İzni' },
        { keywords: ['kapasite raporu', 'üretim kapasite'], label: 'Kapasite Raporu' },
        { keywords: ['isg', 'iş sağlığı', 'güvenliği eğitimi'], label: 'İSG Eğitimi' },
        { keywords: ['hijyen', 'sanitasyon'], label: 'Hijyen Belgesi' },
        { keywords: ['sigorta', 'poliçe'], label: 'Sigorta Poliçesi' },
        { keywords: ['yangın', 'itfaiye'], label: 'Yangın Tüpü Belgesi' },
        { keywords: ['tmgd', 'tehlikeli madde'], label: 'TMGD Belgesi' },
        { keywords: ['ehliyet', 'sürücü belgesi'], label: 'Sürücü Belgesi' },
    ];

    let detectedType = 'Bilinmeyen Belge';
    for (const type of docTypes) {
        if (type.keywords.some(k => lowerText.includes(k))) {
            detectedType = type.label;
            break;
        }
    }

    // Eğer metinden bulunamadıysa dosya ismine bak
    if (detectedType === 'Bilinmeyen Belge') {
        const lowerFileName = fileName.toLowerCase();
        for (const type of docTypes) {
            if (type.keywords.some(k => lowerFileName.includes(k))) {
                detectedType = type.label;
                break;
            }
        }
    }

    const isMSDS = detectedType.includes('MSDS') || lowerText.includes('msds') || lowerText.includes('data sheet');

    // 2. Tarih Ayıklama (Regex)
    const dateRegex = /(\d{2}[./-]\d{2}[./-]\d{4})|(\d{4}-\d{2}-\d{2})/g;
    
    // Tarihleri normalize et ve yerlerini/bağlamlarını yakala
    const normalizedDates: { date: string, index: number, original: string }[] = [];
    let match;
    while ((match = dateRegex.exec(text)) !== null) {
        let d = match[0];
        let normalized = d;
        if (d.includes('.')) {
            const [day, month, year] = d.split('.');
            normalized = `${year}-${month}-${day}`;
        } else if (d.includes('/')) {
            const [day, month, year] = d.split('/');
            normalized = `${year}-${month}-${day}`;
        }
        
        if (!isNaN(new Date(normalized).getTime())) {
            normalizedDates.push({ date: normalized, index: match.index, original: d });
        }
    }

    let acquisitionDate = null;
    let expiryDate = null;

    if (normalizedDates.length > 0) {
        // Bağlam araması (Tarihin yakınındaki kelimeler)
        const acquisitionKeywords = [
            'yayın', 'hazırlama', 'revizyon', 'tanzim', 'veriliş', 'başlangıç', 
            'issued', 'preparation', 'publication', 'revision', 'published', 'date of issue', 'hazirlanma'
        ];
        const expiryKeywords = [
            'bitiş', 'geçerlilik son', 'son geçerlilik', 'valid until', 'expiry', 
            'tarihine kadar', 'son kullanma', 'gecerlilik', 'exp. date'
        ];

        for (const item of normalizedDates) {
            // Tarihin 60 karakter öncesi ve sonrasına bak
            const context = text.substring(Math.max(0, item.index - 60), Math.min(text.length, item.index + 60)).toLowerCase();
            
            if (expiryKeywords.some(k => context.includes(k))) {
                expiryDate = item.date;
            } else if (acquisitionKeywords.some(k => context.includes(k))) {
                acquisitionDate = item.date;
            }
        }

        // Eğer hala bulunamadıysa ve MSDS ise en eski tarihi yayın tarihi kabul et
        const datesOnly = normalizedDates.map(d => d.date).sort();
        if (!acquisitionDate) acquisitionDate = datesOnly[0];
        if (!expiryDate && !isMSDS && datesOnly.length > 1) {
            expiryDate = datesOnly[datesOnly.length - 1];
        }
    }

    // 3. Özel Kurallar (MSDS +3 Yıl)
    if (isMSDS && acquisitionDate && !expiryDate) {
        const acq = new Date(acquisitionDate);
        acq.setFullYear(acq.getFullYear() + 3);
        expiryDate = acq.toISOString().split('T')[0];
    }

    return {
        docType: detectedType,
        acquisitionDate,
        expiryDate,
        isIndefinite: lowerText.includes('süresiz') || lowerText.includes('indefinite'),
        reasoning: `Yerel tarama ile ${normalizedDates.length} tarih bulundu. ${isMSDS ? 'MSDS/Data Sheet özel kuralları uygulandı.' : ''}`,
        confidence: detectedType !== 'Bilinmeyen Belge' && acquisitionDate ? 'high' : 'medium'
    };
}
