import React, { useState } from 'react';
import { Star, User, Calendar, Award, MessageSquare, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  { key: 'technical', label: 'Teknik Yetkinlik', weight: 25 },
  { key: 'quality', label: 'İş Kalitesi', weight: 25 },
  { key: 'communication', label: 'İletişim', weight: 20 },
  { key: 'responsibility', label: 'Sorumluluk', weight: 15 },
  { key: 'development', label: 'Gelişime Açıklık', weight: 15 },
];

export default function EvaluationsPreview() {
  const [scores, setScores] = useState<Record<string, number>>({
    technical: 4,
    quality: 5,
    communication: 4,
    responsibility: 3,
    development: 4,
  });
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  const total = CATEGORIES.reduce((sum, c) => sum + (scores[c.key] / 5) * c.weight, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-600 p-2.5 rounded-xl">
          <Calendar size={18} />
        </div>
        <div>
          <div className="font-bold text-sm text-gray-800 dark:text-white">2026 - 3. Çeyrek Değerlendirme Dönemi</div>
          <div className="text-[11px] text-gray-500">01.07.2026 – 30.09.2026 · Aktif</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="bg-purple-50 dark:bg-purple-950/20 text-purple-600 p-2 rounded-xl">
            <User size={16} />
          </div>
          <div>
            <div className="font-bold text-sm text-gray-800 dark:text-white">Örnek Personel — Ahmet Yılmaz</div>
            <div className="text-[11px] text-gray-500">Saha Denetim Uzmanı</div>
          </div>
        </div>

        <div className="space-y-3">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{c.label}</div>
                <div className="text-[10px] text-gray-400">Ağırlık: %{c.weight}</div>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setScores((prev) => ({ ...prev, [c.key]: star }))}
                  >
                    <Star
                      size={18}
                      className={star <= scores[c.key] ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-slate-600'}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 mb-1 uppercase"><MessageSquare size={12} /> Yorum</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Bu çeyrekte gösterdiği performans hakkında notlarınız..."
            rows={2}
            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
          <span className="text-xs font-bold text-gray-500">Ağırlıklı Toplam Puan</span>
          <span className="flex items-center gap-1.5 text-lg font-black text-purple-700 dark:text-purple-400">
            <Award size={17} /> {total.toFixed(1)} / 100
          </span>
        </div>

        {saved ? (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle size={15} /> Örnek değerlendirme kaydedildi! Gerçek modülde bu puan, dönem sonu bileşik personel karnesine yansır.
          </div>
        ) : (
          <button onClick={() => setSaved(true)} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl text-xs transition">
            Değerlendirmeyi Kaydet
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-500 text-center">
        Yıldızlara tıklayarak örnek puanlamayı deneyebilirsiniz — hem yöneticiler hem de müşteriler değerlendirme gönderebilir, sonuçlar tek bir bileşik puanda birleşir.
      </p>
    </div>
  );
}
