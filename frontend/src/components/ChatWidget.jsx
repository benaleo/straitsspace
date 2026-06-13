import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, fmtUSD2 } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Send, Wallet, ShoppingBag, Plus, MapPin, CheckCircle2, AlertTriangle, Bot, MessageCircle, X,
} from "lucide-react";

const PAK_BUDI_AVATAR = "https://images.unsplash.com/photo-1718209881007-c0ecdfc00f9d?crop=entropy&cs=srgb&fm=jpg&w=120&q=80";

const sessionId = (() => {
  let s = localStorage.getItem("ss_session");
  if (!s) { s = "cust_" + Math.random().toString(36).slice(2, 10); localStorage.setItem("ss_session", s); }
  return s;
})();

const ProductCard = ({ p, onBuy }) => (
  <div data-testid={`product-card-${p.id}`} className="mt-2 rounded-lg border border-white/10 bg-[#0C0E16] overflow-hidden">
    <img src={p.image_urls?.[0]} alt={p.name} className="h-28 w-full object-cover" />
    <div className="p-3">
      <div className="font-semibold text-sm">{p.name}</div>
      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{p.description}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono font-bold text-emerald-400">{fmtUSD2(p.price)}</span>
        <Button data-testid={`buy-${p.id}`} size="sm" onClick={() => onBuy(p)} className="h-7 bg-blue-600 hover:bg-blue-500 rounded text-xs">
          <ShoppingBag className="h-3 w-3 mr-1" /> Beli
        </Button>
      </div>
    </div>
  </div>
);

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [address, setAddress] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const endRef = useRef(null);

  const loadWallet = async () => {
    const { data } = await api.get(`/wallet?session_id=${sessionId}`);
    setWallet(data.wallet);
  };

  useEffect(() => {
    if (!open) return;
    loadWallet();
    api.get(`/chat/${sessionId}`).then(({ data }) => {
      if (data.length) {
        setMessages(data.map((m) => ({ sender: m.sender, text: m.text, products: m.product_cards || [] })));
      } else {
        setMessages([{ sender: "ai", products: [],
          text: "Selamat datang di StraitsSpace! Saya Pak Budi, concierge Anda. Sedang mencari sesuatu? Misalnya sepatu lari di bawah $100, headphone, atau smartwatch — silakan tanya saja. 😊" }]);
      }
    });
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { sender: "customer", text, products: [] }]);
    setBusy(true);
    try {
      const { data } = await api.post("/chat", { session_id: sessionId, message: text });
      setMessages((m) => [...m, { sender: "ai", text: data.reply, products: data.products || [], escalated: data.needs_escalation }]);
    } catch (e) { toast.error("Pak Budi sedang tidak tersedia"); }
    finally { setBusy(false); }
  };

  const startCheckout = (p) => { setCheckout(p); setAddress(""); };

  const placeOrder = async () => {
    if (!address.trim()) { toast.error("Mohon masukkan alamat pengiriman"); return; }
    try {
      const { data } = await api.post("/orders", {
        session_id: sessionId,
        items: [{ product_id: checkout.id, name: checkout.name, qty: 1, price: checkout.price }],
        address, payment_method: "wallet",
      });
      setConfirmed(data);
      setCheckout(null);
      await loadWallet();
      setMessages((m) => [...m, { sender: "ai", products: [],
        text: `Pesanan Anda untuk ${checkout.name} sudah dikonfirmasi! Order #${data.id.slice(0, 8)} — status: placed. Anda akan menerima pembaruan di sini. Terima kasih! 🙏` }]);
    } catch (e) { toast.error(e.response?.data?.detail || "Pesanan gagal"); }
  };

  const topup = async (amount) => {
    await api.post("/wallet/topup", { session_id: sessionId, amount, provider: "internal" });
    toast.success(`Saldo ditambah ${fmtUSD2(amount)}`);
    setTopupOpen(false);
    loadWallet();
  };

  return (
    <>
      {/* floating launcher */}
      <button
        data-testid="chat-launcher"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 right-6 z-[60] h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 grid place-items-center text-white transition-colors duration-200"
        aria-label="Buka chat Pak Budi"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="chat-widget"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-44 right-6 z-[60] w-[calc(100vw-3rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-13rem)] rounded-xl border border-white/10 bg-[#0C0E16] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* header */}
            <div className="flex items-center justify-between gap-3 p-3.5 border-b border-white/10 bg-[#11131E] shrink-0">
              <div className="flex items-center gap-2.5">
                <img src={PAK_BUDI_AVATAR} alt="Pak Budi" className="h-9 w-9 rounded-full object-cover border border-blue-500/30" />
                <div>
                  <div className="font-display font-bold text-sm flex items-center gap-1.5">Pak Budi <Bot className="h-3.5 w-3.5 text-blue-400" /></div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online · Concierge StraitsX</div>
                </div>
              </div>
              <button data-testid="wallet-balance" onClick={() => setTopupOpen(true)}
                className="flex items-center gap-1.5 rounded border border-white/10 bg-[#0C0E16] px-2.5 py-1.5 hover:border-blue-500/40 transition-colors">
                <Wallet className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-mono text-xs font-bold">{wallet ? fmtUSD2(wallet.balance) : "…"}</span>
                <Plus className="h-3 w-3 text-slate-500" />
              </button>
            </div>

            {/* messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%]">
                    <div className={m.sender === "customer"
                      ? "bg-blue-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm"
                      : "bg-[#1C1F2E] text-slate-200 border border-white/5 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm"}>
                      {m.text}
                      {m.escalated && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-300 border-t border-white/10 pt-2">
                          <AlertTriangle className="h-3.5 w-3.5" /> Menghubungkan ke @CS_Resmi_Bot
                        </div>
                      )}
                    </div>
                    {m.products?.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-1">
                        {m.products.map((p) => <ProductCard key={p.id} p={p} onBuy={startCheckout} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <div className="text-xs text-slate-500 ml-1">Pak Budi sedang mengetik…</div>}
              <div ref={endRef} />
            </div>

            {/* input */}
            <div className="p-3 border-t border-white/10 bg-[#11131E] flex items-center gap-2 shrink-0">
              <Input data-testid="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Tanya Pak Budi…" className="bg-[#0C0E16] border-white/10 h-9 text-sm" />
              <Button data-testid="chat-send" onClick={send} disabled={busy} className="bg-blue-600 hover:bg-blue-500 rounded h-9 w-9 p-0 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* checkout */}
      <Dialog open={!!checkout} onOpenChange={(o) => !o && setCheckout(null)}>
        <DialogContent className="bg-[#11131E] border-white/10 text-white" data-testid="checkout-dialog">
          <DialogHeader><DialogTitle className="font-display">Konfirmasi Pesanan</DialogTitle></DialogHeader>
          {checkout && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded border border-white/10 bg-[#0C0E16] p-3">
                <img src={checkout.image_urls?.[0]} alt="" className="h-14 w-14 rounded object-cover" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{checkout.name}</div>
                  <div className="font-mono text-emerald-400 text-sm">{fmtUSD2(checkout.price)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Bayar dengan dompet</span>
                <span className="font-mono">{fmtUSD2(wallet?.balance ?? 0)} tersedia</span>
              </div>
              <div>
                <label className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><MapPin className="h-3.5 w-3.5" /> Alamat pengiriman</label>
                <Input data-testid="address-input" value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Sudirman No.1, Jakarta" className="bg-[#0C0E16] border-white/10" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button data-testid="place-order-btn" onClick={placeOrder} className="w-full bg-blue-600 hover:bg-blue-500 rounded">
              Bayar {checkout && fmtUSD2(checkout.price)} &amp; Buat Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirmation */}
      <Dialog open={!!confirmed} onOpenChange={(o) => !o && setConfirmed(null)}>
        <DialogContent className="bg-[#11131E] border-white/10 text-white text-center" data-testid="order-confirmation">
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-400" />
            <DialogTitle className="font-display text-xl">Pesanan Dikonfirmasi</DialogTitle>
            {confirmed && <>
              <p className="text-slate-400 text-sm">Order #{confirmed.id.slice(0, 8)} · {fmtUSD2(confirmed.total)}</p>
              <p className="font-mono text-xs text-slate-500">Status: placed → confirmed → shipped → delivered</p>
            </>}
            <Button onClick={() => setConfirmed(null)} className="bg-blue-600 hover:bg-blue-500 rounded mt-2">Lanjut Belanja</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* topup */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="bg-[#11131E] border-white/10 text-white" data-testid="topup-dialog">
          <DialogHeader><DialogTitle className="font-display">Isi Ulang Dompet</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-400">Saldo saat ini: <span className="font-mono text-white">{fmtUSD2(wallet?.balance ?? 0)}</span></p>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[100, 500, 1000].map((a) => (
              <Button key={a} data-testid={`topup-${a}`} onClick={() => topup(a)} variant="outline"
                className="border-white/10 bg-[#0C0E16] hover:bg-blue-600/10 hover:border-blue-500/40 rounded">
                + {fmtUSD2(a)}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 pt-1">Top-up Stripe / Razorpay menyusul di fase berikutnya — sementara memakai kredit dompet internal.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
