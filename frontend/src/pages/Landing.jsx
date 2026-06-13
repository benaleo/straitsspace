import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ChatWidget from "@/components/ChatWidget";
import {
  ArrowRight, Zap, Brain, ShieldCheck, MessageSquare, TrendingUp, Clock,
  Layers, Sparkles, CheckCircle2,
} from "lucide-react";

const BG = "https://images.unsplash.com/photo-1614850523011-8f49ffc73908?crop=entropy&cs=srgb&fm=jpg&w=1600&q=80";

const fade = (d = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay: d },
});

const Feature = ({ icon: Icon, title, desc, i }) => (
  <motion.div {...fade(i * 0.08)} className="rounded-lg border border-white/10 bg-[#11131E] p-6 hover:border-blue-500/40 transition-colors duration-200">
    <div className="h-10 w-10 rounded bg-blue-600/15 grid place-items-center mb-4">
      <Icon className="h-5 w-5 text-blue-400" strokeWidth={1.75} />
    </div>
    <h3 className="font-display text-lg font-bold mb-1.5">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
  </motion.div>
);

export default function Landing() {
  const features = [
    { icon: Brain, title: "Antrian Cerdas", desc: "Setiap chat masuk otomatis diberi skor & diurutkan berdasarkan nilai transaksi + niat beli — bukan sekadar urutan datang." },
    { icon: MessageSquare, title: "Concierge Pak Budi", desc: "AI berbahasa Indonesia yang hangat & profesional: menjawab, merekomendasikan produk, dan menutup transaksi langsung di chat." },
    { icon: ShieldCheck, title: "Eskalasi Otomatis", desc: "Pelanggan yang frustrasi langsung dinaikkan prioritasnya & diteruskan ke CS (@CS_Resmi_Bot) sebelum mereka pergi." },
    { icon: Zap, title: "Balasan Satu Klik", desc: "Draf balasan bernuansa Pak Budi siap pakai — rep tinggal edit & kirim. Tak ada yang menunggu." },
    { icon: Layers, title: "Commerce dalam Chat", desc: "Kartu produk, dompet, pembayaran, dan konfirmasi alamat — semua mengalir mulus tanpa keluar dari percakapan." },
    { icon: TrendingUp, title: "Metrik Hidup", desc: "Pantau waktu respons, percakapan tertangani, dan konversi dengan perbandingan Before/After secara real-time." },
  ];
  const steps = [
    { t: "Pelanggan chat", d: "Lewat web, widget, atau Telegram." },
    { t: "Pak Budi mengkualifikasi", d: "Skor niat, nilai transaksi, & sentimen dihitung." },
    { t: "Antrian menata diri", d: "Lead bernilai & mendesak naik ke atas otomatis." },
    { t: "Rep menutup deal", d: "Satu klik balasan, atau AI menyelesaikan transaksi." },
  ];

  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090A0F]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5" data-testid="brand-wordmark">
            <div className="h-8 w-8 rounded bg-blue-600 grid place-items-center font-display font-extrabold text-white">S</div>
            <div className="leading-none">
              <div className="font-display text-lg font-extrabold tracking-tight">StraitsSpace</div>
              <div className="font-mono text-[10px] text-slate-500 -mt-0.5">by StraitsX</div>
            </div>
          </div>
          <Link to="/admin" data-testid="cta-dashboard-nav">
            <Button className="bg-blue-600 hover:bg-blue-500 rounded h-9">
              Masuk Dashboard <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${BG})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090A0F]/60 via-[#090A0F]/90 to-[#090A0F]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <motion.div {...fade()} className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-600/10 px-3.5 py-1.5 text-xs font-medium text-blue-300 mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Didukung Pak Budi AI · XSGD &amp; XUSD
          </motion.div>
          <motion.h1 {...fade(0.05)} className="font-display text-4xl sm:text-6xl font-extrabold leading-[1.05] max-w-3xl">
            Ubah setiap chat menjadi <span className="text-blue-400">pipeline penjualan</span> yang menata diri.
          </motion.h1>
          <motion.p {...fade(0.12)} className="mt-6 text-lg text-slate-300 max-w-2xl leading-relaxed">
            StraitsSpace memberi tim Anda antrian lead cerdas yang mengurutkan berdasarkan nilai &amp; niat,
            serta concierge AI yang menjawab, merekomendasikan, dan menutup transaksi — dalam Bahasa Indonesia.
          </motion.p>
          <motion.div {...fade(0.18)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/admin" data-testid="cta-dashboard-hero">
              <Button className="bg-blue-600 hover:bg-blue-500 rounded h-12 px-6 text-base">
                Buka Dashboard Rep <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" /> atau tanya Pak Budi di pojok kanan bawah →
            </span>
          </motion.div>

          {/* metric strip */}
          <motion.div {...fade(0.25)} className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
            {[
              { icon: Clock, v: "< 5 dtk", l: "Waktu respons pertama" },
              { icon: TrendingUp, v: "+50%", l: "Percakapan / rep / hari" },
              { icon: CheckCircle2, v: "18% → 41%", l: "Konversi lead" },
              { icon: ShieldCheck, v: "> 95%", l: "Frustrasi tereskalasi" },
            ].map((m, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-[#11131E]/80 backdrop-blur p-4">
                <m.icon className="h-4 w-4 text-blue-400 mb-2" />
                <div className="font-display text-2xl font-extrabold text-white">{m.v}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{m.l}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <motion.div {...fade()} className="max-w-2xl mb-12">
          <h2 className="font-display text-3xl font-extrabold">Dua sisi, satu otak AI.</h2>
          <p className="text-slate-400 mt-3">Sisi rep menutup lebih banyak deal. Sisi pelanggan tak pernah menunggu.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => <Feature key={f.title} {...f} i={i} />)}
        </div>
      </section>

      {/* how it works */}
      <section className="border-y border-white/10 bg-[#0B0D14]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <motion.h2 {...fade()} className="font-display text-3xl font-extrabold mb-12">Cara kerjanya</motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s, i) => (
              <motion.div key={i} {...fade(i * 0.08)} className="relative rounded-lg border border-white/10 bg-[#11131E] p-6">
                <div className="font-mono text-blue-400 text-sm mb-3">0{i + 1}</div>
                <h3 className="font-display font-bold text-lg">{s.t}</h3>
                <p className="text-slate-400 text-sm mt-1.5">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <motion.div {...fade()}>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold max-w-2xl mx-auto">
            Tim yang sama. Lebih banyak deal tertutup. Tak ada yang menunggu.
          </h2>
          <Link to="/admin" data-testid="cta-dashboard-footer">
            <Button className="mt-8 bg-blue-600 hover:bg-blue-500 rounded h-12 px-7 text-base">
              Mulai Sekarang <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div className="font-display font-bold text-slate-300">StraitsSpace <span className="font-mono text-xs text-slate-500 font-normal">by StraitsX</span></div>
          <div className="font-mono text-xs">Vibe Sprint Jakarta 2026 · Pak Budi AI</div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
