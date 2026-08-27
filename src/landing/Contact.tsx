import React, { useEffect, useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Loader } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LandingLayout from './LandingLayout';

export default function Contact() {
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('email_settings')
      .select('key, value')
      .in('key', ['contact_email', 'contact_phone', 'contact_address'])
      .then(({ data }) => {
        (data || []).forEach((row: any) => {
          if (row.key === 'contact_email') setContactEmail(row.value || '');
          if (row.key === 'contact_phone') setContactPhone(row.value || '');
          if (row.key === 'contact_address') setContactAddress(row.value || '');
        });
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const { error: insertErr } = await supabase.from('contact_messages').insert({
        name,
        email,
        phone: phone || null,
        message,
      });
      if (insertErr) throw insertErr;
      setSent(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err: any) {
      setError('Mesajınız gönderilemedi: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <LandingLayout>
      <section className="bg-gray-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">İletişim</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-slate-300">
            Sorularınız için bize ulaşın, size en kısa sürede dönüş yapalım.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-slate-950">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 md:px-8 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-5">
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}`}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 p-5 transition-colors hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Mail size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">E-Posta</div>
                  <div className="font-semibold text-gray-800 dark:text-slate-200">{contactEmail}</div>
                </div>
              </a>
            )}
            {contactPhone && (
              <a
                href={`tel:${contactPhone}`}
                className="flex items-start gap-3 rounded-2xl border border-gray-100 p-5 transition-colors hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Phone size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Telefon</div>
                  <div className="font-semibold text-gray-800 dark:text-slate-200">{contactPhone}</div>
                </div>
              </a>
            )}
            {contactAddress && (
              <div className="flex items-start gap-3 rounded-2xl border border-gray-100 p-5 dark:border-slate-800">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <MapPin size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Adres</div>
                  <div className="font-semibold text-gray-800 dark:text-slate-200">{contactAddress}</div>
                </div>
              </div>
            )}
            {!contactEmail && !contactPhone && !contactAddress && (
              <p className="text-sm text-gray-400 dark:text-slate-500">
                Aşağıdaki formu doldurarak bize ulaşabilirsiniz.
              </p>
            )}
          </div>

          <div className="lg:col-span-3">
            {sent ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-green-100 bg-green-50 p-10 text-center dark:border-green-900/40 dark:bg-green-950/20">
                <CheckCircle2 size={36} className="mb-3 text-green-600 dark:text-green-400" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Mesajınız alındı</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">En kısa sürede size dönüş yapacağız.</p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-4 text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Yeni mesaj gönder
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Ad Soyad
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      Telefon (opsiyonel)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    E-Posta
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    Mesajınız
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
                <button
                  disabled={sending}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:opacity-70"
                >
                  {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                  {sending ? 'Gönderiliyor...' : 'Mesaj Gönder'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
