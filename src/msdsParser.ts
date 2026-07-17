// MSDS/SDS toplu PDF analizi için saf (React/Supabase'den bağımsız) ayrıştırma
// fonksiyonları. src/localScanner.ts'teki extractTextFromPdf ile çıkarılan
// metin buraya verilir; bu dosya yalnızca metin üzerinde çalışır.

export type DateTier = 1 | 2 | 3;

export interface DateCandidate {
  date: string; // ISO yyyy-mm-dd
  label: string; // eşleşen etiket metni (Tier 3 için 'Date:' / 'Tarih:')
  tier: DateTier;
  dayDefaulted: boolean; // ay/yıl formatından geldi, gün=1 varsayıldı
  rawMatch: string; // orijinal eşleşen metin parçası
}

export interface MsdsDateDetectionResult {
  primaryDate: DateCandidate | null;
  otherDates: DateCandidate[];
}

export interface MsdsProductNameResult {
  productName: string | null;
  source: 'label' | 'heuristic_top_lines' | null;
  matchedLabel: string | null;
}

export interface MsdsParseResult {
  productName: MsdsProductNameResult;
  dates: MsdsDateDetectionResult;
  hasExtractedText: boolean; // false => taranmış/görüntü PDF, manuel giriş gerekli
  extractedCharCount: number;
}

export type MsdsStatus = 'expired' | 'approaching' | 'valid' | 'unknown';

// --- Etiket katmanları (spesifikasyondaki tam liste) ---

const TIER1_LABELS = [
  'Revision Date',
  'Date Revised',
  'Date of Revision',
  'Date of Last Revision',
  'Last Revision Date',
  'Last Revised',
  'Date of Last Issue',
  'Revizyon Tarihi',
  'Son Revizyon Tarihi',
  'Güncelleme Tarihi',
  'Düzenleme Tarihi',
];

const TIER2_LABELS = [
  'Date of Issue',
  'Date of First Issue',
  'Issue Date',
  'Issued',
  'Date of Preparation',
  'Preparation Date',
  'Prepared On',
  'Publication Date',
  'Effective Date',
  'Print Date',
  'Version Date',
  'Hazırlama Tarihi',
  'Yayın Tarihi',
  'Yayınlanma Tarihi',
  'Basım Tarihi',
  'Belge Tarihi',
  'Geçerlilik Tarihi',
];

const TIER3_LABELS = ['Date:', 'Tarih:'];

const PRODUCT_NAME_LABELS = [
  'Ürün Adı',
  'Ticari Adı',
  'Ürün Kimliği',
  'Madde Adı',
  'Product Name',
  'Trade Name',
  'Product Identifier',
  'Material Name',
];

const GENERIC_HEADER_LINES = [
  'safety data sheet',
  'material safety data sheet',
  'güvenlik bilgi formu',
  'malzeme güvenlik bilgi formu',
  'ürün bilgi formu',
  'msds',
  'sds',
  'gbf',
];

// --- Ay adı sözlükleri ---

const TR_MONTHS: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  eylül: 9,
  ekim: 10,
  kasım: 11,
  aralık: 12,
};

const EN_MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const TR_MONTH_ALT = Object.keys(TR_MONTHS).join('|');
const EN_MONTH_ALT = Object.keys(EN_MONTHS).join('|');

interface ParsedDateParts {
  year: number;
  month: number;
  day: number;
  dayDefaulted: boolean;
}

interface DatePattern {
  regex: RegExp;
  parse: (m: RegExpExecArray) => ParsedDateParts | null;
}

// Belirsiz DD/MM vs MM/DD çözümü: bileşenlerden biri 12'den büyükse o kesin
// gün, diğeri ay olur; ikisi de <=12 ise Gün/Ay/Yıl varsayılır.
function resolveAmbiguousDayMonth(a: number, b: number): { day: number; month: number } {
  if (a > 12) return { day: a, month: b };
  if (b > 12) return { day: b, month: a };
  return { day: a, month: b };
}

const DATE_PATTERNS: DatePattern[] = [
  // 20.10.2016 / 20/10/2016 / 20-10-2016
  {
    regex: /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/g,
    parse: (m) => {
      const { day, month } = resolveAmbiguousDayMonth(parseInt(m[1], 10), parseInt(m[2], 10));
      return { day, month, year: parseInt(m[3], 10), dayDefaulted: false };
    },
  },
  // 13 Aralık 2014
  {
    regex: new RegExp(`(\\d{1,2})\\s+(${TR_MONTH_ALT})\\s+(\\d{4})`, 'gi'),
    parse: (m) => {
      const month = TR_MONTHS[m[2].toLowerCase()];
      if (!month) return null;
      return { day: parseInt(m[1], 10), month, year: parseInt(m[3], 10), dayDefaulted: false };
    },
  },
  // March 5, 2019 / Dec 13, 2014
  {
    regex: new RegExp(`(${EN_MONTH_ALT})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'gi'),
    parse: (m) => {
      const month = EN_MONTHS[m[1].toLowerCase()];
      if (!month) return null;
      return { day: parseInt(m[2], 10), month, year: parseInt(m[3], 10), dayDefaulted: false };
    },
  },
  // 01/2012 (yalnızca ay/yıl)
  {
    regex: /(\d{1,2})[./-](\d{4})/g,
    parse: (m) => {
      const month = parseInt(m[1], 10);
      if (month < 1 || month > 12) return null;
      return { day: 1, month, year: parseInt(m[2], 10), dayDefaulted: true };
    },
  },
  // Aralık 2014 (yalnızca ay/yıl)
  {
    regex: new RegExp(`(${TR_MONTH_ALT})\\s+(\\d{4})`, 'gi'),
    parse: (m) => {
      const month = TR_MONTHS[m[1].toLowerCase()];
      if (!month) return null;
      return { day: 1, month, year: parseInt(m[2], 10), dayDefaulted: true };
    },
  },
  // March 2012 (yalnızca ay/yıl)
  {
    regex: new RegExp(`(${EN_MONTH_ALT})\\.?\\s+(\\d{4})`, 'gi'),
    parse: (m) => {
      const month = EN_MONTHS[m[1].toLowerCase()];
      if (!month) return null;
      return { day: 1, month, year: parseInt(m[2], 10), dayDefaulted: true };
    },
  },
];

function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

interface RawDateFind {
  iso: string;
  dayDefaulted: boolean;
  rawMatch: string;
  start: number;
  end: number;
}

// Verilen kısa metin (etiketten hemen sonraki satır/satır kalanı) içinde ilk
// geçerli tarihi bulur. Kritik sınır kuralı: bir eşleşmenin bittiği/başladığı
// yer sadece \b (kelime sınırı) ile değil, "hemen bitişiğinde rakam var mı"
// kontrolüyle belirlenir - PDF tablo hücreleri arasında boşluk kaybolup
// "05/2005Sayfa:1/3" gibi bitişik metinler oluşabildiği için.
function findDateInText(s: string): RawDateFind | null {
  let best: RawDateFind | null = null;
  let bestPatternIdx = Infinity;

  DATE_PATTERNS.forEach((pattern, patternIdx) => {
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const before = start > 0 ? s[start - 1] : '';
      const after = end < s.length ? s[end] : '';
      if (/\d/.test(before) || /\d/.test(after)) continue;

      const parsed = pattern.parse(m);
      if (!parsed) continue;
      const iso = toIsoIfValid(parsed.year, parsed.month, parsed.day);
      if (!iso) continue;

      if (best === null || start < best.start || (start === best.start && patternIdx < bestPatternIdx)) {
        best = { iso, dayDefaulted: parsed.dayDefaulted, rawMatch: m[0], start, end };
        bestPatternIdx = patternIdx;
      }
      break; // bu pattern için en soldaki geçerli eşleşme bulundu
    }
  });

  return best;
}

interface LineInfo {
  text: string;
  start: number;
  end: number;
}

function buildLines(text: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let pos = 0;
  for (const part of text.split('\n')) {
    lines.push({ text: part, start: pos, end: pos + part.length });
    pos += part.length + 1;
  }
  return lines;
}

function findLineIndex(lines: LineInfo[], pos: number): number {
  return lines.findIndex((l) => pos >= l.start && pos <= l.end);
}

function collectDateCandidates(text: string): DateCandidate[] {
  const lines = buildLines(text);
  const lowerText = text.toLowerCase();
  const consumed: Array<[number, number]> = [];
  const candidates: DateCandidate[] = [];
  const isConsumed = (idx: number) => consumed.some(([s, e]) => idx >= s && idx < e);

  const tierGroups: Array<{ labels: string[]; tier: DateTier }> = [
    { labels: TIER1_LABELS, tier: 1 },
    { labels: TIER2_LABELS, tier: 2 },
    { labels: TIER3_LABELS, tier: 3 },
  ];

  for (const { labels, tier } of tierGroups) {
    for (const label of labels) {
      const lowerLabel = label.toLowerCase();
      let fromIndex = 0;
      let occurrences = 0;

      while (occurrences < 25) {
        const idx = lowerText.indexOf(lowerLabel, fromIndex);
        if (idx === -1) break;
        occurrences++;
        fromIndex = idx + lowerLabel.length;

        // Tier 3 (jenerik "Date:"/"Tarih:") taranırken, daha yüksek öncelikli
        // bir katmanın zaten tükettiği aralığı (örn. "Revision Date: ..."
        // içindeki "Date:") atla - çift sayımı önler.
        if (tier === 3 && isConsumed(idx)) continue;

        const labelEnd = idx + label.length;
        const lineIdx = findLineIndex(lines, idx);
        if (lineIdx === -1) continue;
        const line = lines[lineIdx];

        let found = findDateInText(text.slice(labelEnd, line.end));
        let searchBaseOffset = labelEnd;

        // Değer bir sonraki satıra taşmış olabilir (PDF tablo hücresi bölünmesi)
        if (!found && lineIdx + 1 < lines.length) {
          const nextLine = lines[lineIdx + 1];
          found = findDateInText(nextLine.text);
          searchBaseOffset = nextLine.start;
        }

        if (!found) continue;

        consumed.push([idx, searchBaseOffset + found.end]);
        candidates.push({
          date: found.iso,
          label,
          tier,
          dayDefaulted: found.dayDefaulted,
          rawMatch: found.rawMatch,
        });
      }
    }
  }

  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.date}|${c.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function detectMsdsDates(text: string): MsdsDateDetectionResult {
  const candidates = collectDateCandidates(text || '');
  if (candidates.length === 0) return { primaryDate: null, otherDates: [] };

  // En güncel tarih = ana tarih; eşitlikte katman önceliği (1 > 2 > 3) belirleyici.
  const sorted = [...candidates].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.tier - b.tier;
  });

  return { primaryDate: sorted[0], otherDates: sorted.slice(1) };
}

function isPageNumberLine(line: string): boolean {
  return /^\s*(sayfa|page)?\s*:?\s*\d{1,3}\s*\/\s*\d{1,3}\s*$/i.test(line.trim());
}

function looksLikeVersionLine(line: string): boolean {
  return /\bv\.?\s?\d|\brev\.?\s*\d|\bversion\s*\d/i.test(line);
}

function isGenericHeaderLine(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (!l) return false;
  return GENERIC_HEADER_LINES.some((h) => l === h || l.includes(h));
}

export function detectProductName(text: string): MsdsProductNameResult {
  const safeText = text || '';
  const lines = buildLines(safeText);
  const lowerText = safeText.toLowerCase();

  for (const label of PRODUCT_NAME_LABELS) {
    const idx = lowerText.indexOf(label.toLowerCase());
    if (idx === -1) continue;

    const labelEnd = idx + label.length;
    const lineIdx = findLineIndex(lines, idx);
    if (lineIdx === -1) continue;
    const line = lines[lineIdx];

    let value = safeText.slice(labelEnd, line.end).replace(/^[\s:.\-–—]+/, '').trim();

    if (!value && lineIdx + 1 < lines.length) {
      const nextLine = lines[lineIdx + 1].text.trim();
      const nextLooksLikeAnotherLabel = PRODUCT_NAME_LABELS.some((l) =>
        nextLine.toLowerCase().includes(l.toLowerCase())
      );
      if (
        nextLine &&
        nextLine.length <= 80 &&
        !nextLooksLikeAnotherLabel &&
        !isGenericHeaderLine(nextLine) &&
        !isPageNumberLine(nextLine) &&
        !findDateInText(nextLine)
      ) {
        value = nextLine;
      }
    }

    if (value) {
      return { productName: value, source: 'label', matchedLabel: label };
    }
  }

  // Etiket bulunamadı: ilk ~20 satırı tara, jenerik/tarih/sayfa-no/versiyon
  // satırlarını eleyerek kalan ilk anlamlı satırı al.
  for (const l of lines.slice(0, 20)) {
    const trimmed = l.text.trim();
    if (!trimmed) continue;
    if (isGenericHeaderLine(trimmed)) continue;
    if (isPageNumberLine(trimmed)) continue;
    if (looksLikeVersionLine(trimmed)) continue;
    if (findDateInText(trimmed)) continue;
    return { productName: trimmed, source: 'heuristic_top_lines', matchedLabel: null };
  }

  return { productName: null, source: null, matchedLabel: null };
}

export function parseMsdsText(text: string): MsdsParseResult {
  const safeText = text || '';
  const extractedCharCount = safeText.replace(/\s+/g, '').length;
  return {
    productName: detectProductName(safeText),
    dates: detectMsdsDates(safeText),
    hasExtractedText: extractedCharCount >= 20,
    extractedCharCount,
  };
}

export function computeExpiryDate(primaryDateIso: string, validityYears: number): string {
  const d = new Date(`${primaryDateIso}T00:00:00`);
  const totalMonths = Math.round(validityYears * 12);
  d.setMonth(d.getMonth() + totalMonths);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function computeDaysRemaining(expiryDateIso: string | null, today: Date = new Date()): number | null {
  if (!expiryDateIso) return null;
  const expiry = new Date(`${expiryDateIso}T00:00:00`);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeMsdsStatus(
  expiryDateIso: string | null,
  warningThresholdDays: number,
  today: Date = new Date()
): MsdsStatus {
  const daysRemaining = computeDaysRemaining(expiryDateIso, today);
  if (daysRemaining === null) return 'unknown';
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= warningThresholdDays) return 'approaching';
  return 'valid';
}

export function tierLabel(tier: DateTier): string {
  if (tier === 1) return 'Revizyon/Güncelleme';
  if (tier === 2) return 'Yayın/Hazırlama';
  return 'Jenerik';
}

// Paylaşılan durum etiketi/rozet renkleri — ConsultantPanel, AddMsdsDocuments
// ve ClientPanel'in üçü de aynı sabitleri kullanır (CLAUDE.md: statik Tailwind
// class lookup, template literal değil).
export const MSDS_STATUS_LABELS_TR: Record<MsdsStatus, string> = {
  expired: 'Süresi Doldu',
  approaching: 'Yaklaşıyor',
  valid: 'Geçerli',
  unknown: 'Belirsiz',
};

export const MSDS_STATUS_BADGE_CLASSES: Record<MsdsStatus, string> = {
  expired: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900',
  approaching: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900',
  unknown: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:border-slate-700',
};
