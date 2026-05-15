import React from 'react';
import { Shield, ArrowLeft, Lock, Eye, Share2, UserCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 lg:py-20">
        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <Link 
              to="/login" 
              className="inline-flex items-center gap-2 text-slate-500 hover:text-primary transition-colors mb-6 group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span>Kembali ke Login</span>
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Kebijakan <span className="text-primary">Privasi</span>
            </h1>
            <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">
              Aplikasi Telaju • Terakhir Diperbarui: {today}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="text-primary" size={40} />
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 dark:shadow-none">
          
          <section className="mb-12">
            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              Selamat datang di <strong>Telaju</strong>. Kami sangat menghargai privasi Anda dan berkomitmen untuk melindungi data pribadi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan menjaga informasi Anda saat Anda menggunakan aplikasi kami.
            </p>
          </section>

          <div className="space-y-12">
            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Eye size={22} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">1. Informasi yang Kami Kumpulkan</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">Untuk memberikan layanan terbaik, kami mengumpulkan beberapa jenis informasi:</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Identitas Pribadi', desc: 'Nama, alamat email, nomor telepon, dan foto profil.' },
                  { title: 'Informasi Transaksi', desc: 'Detail layanan, riwayat pembayaran, dan struk digital.' },
                  { title: 'Data Lokasi', desc: 'Koordinat GPS real-time (bahkan di latar belakang) untuk pelacakan.' },
                  { title: 'Informasi Perangkat', desc: 'Model, versi OS, ID perangkat, dan data jaringan.' }
                ].map((item, i) => (
                  <li key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <span className="block font-bold text-slate-800 dark:text-slate-200 mb-1">{item.title}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <UserCheck size={22} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. Penggunaan Informasi Anda</h2>
              </div>
              <div className="space-y-4">
                {[
                  { title: 'Penyediaan Layanan', desc: 'Memproses pesanan, verifikasi identitas, dan memfasilitasi komunikasi.' },
                  { title: 'Peningkatan Layanan', desc: 'Menganalisis pola penggunaan untuk memperbaiki fitur dan performa.' },
                  { title: 'Keamanan', desc: 'Mendeteksi dan mencegah penipuan atau aktivitas ilegal.' },
                  { title: 'Komunikasi', desc: 'Mengirimkan pembaruan, pesan administratif, dan materi promosi.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-200">{item.title}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <Share2 size={22} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">3. Berbagi Informasi</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Kami tidak menjual data pribadi Anda. Namun, kami dapat berbagi informasi dengan <strong>Mitra Layanan</strong> (kurir/penyedia jasa), <strong>Penyedia Layanan Pihak Ketiga</strong> (payment gateway, hosting), atau demi <strong>Kepatuhan Hukum</strong> jika diwajibkan oleh otoritas.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Lock size={22} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">4. Keamanan Data</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Kami menerapkan standar keamanan teknis dan organisasi untuk melindungi data Anda. Namun, perlu ingat bahwa tidak ada metode transmisi melalui internet yang 100% aman.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <Shield size={22} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">5. Hak-Hak Anda</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Mengakses dan memperbarui informasi profil langsung melalui aplikasi.
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Meminta penghapusan akun dan data terkait.
                </li>
                <li className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Mencabut izin akses lokasi atau notifikasi.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="p-8 rounded-3xl bg-slate-900 dark:bg-primary/10 border border-slate-800 text-white dark:text-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <RefreshCw size={24} className="text-primary animate-spin-slow" />
                <h2 className="text-2xl font-bold">6. Perubahan Kebijakan Ini</h2>
              </div>
              <p className="opacity-80 leading-relaxed">
                Telaju berhak memperbarui Kebijakan Privasi ini kapan saja. Kami akan memberikan notifikasi jika terdapat perubahan signifikan. Penggunaan berkelanjutan Anda dianggap sebagai persetujuan terhadap kebijakan baru.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} Telaju App. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}} />
    </div>
  );
};
