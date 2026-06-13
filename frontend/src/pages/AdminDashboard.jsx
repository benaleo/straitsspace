import React, { useEffect, useState } from "react";
import { api, fmtUSD2 } from "@/lib/api";
import { StatusPill } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Package, Users, TrendingUp, Plus, Trash2, ShoppingCart, MessageSquare, AlertTriangle } from "lucide-react";

const ORDER_STATUSES = ["placed", "confirmed", "shipped", "delivered"];
const empty = { name: "", description: "", specs: "", price: 0, category: "general", image_urls: [""], stock: 100 };

const Stat = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-lg border border-white/10 bg-[#11131E] p-5">
    <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
      <Icon className="h-4 w-4" /> {label}
    </div>
    <div className={`mt-2 font-display text-3xl font-extrabold ${accent || "text-white"}`}>{value}</div>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [logs, setLogs] = useState({ messages: [], escalations: [] });
  const [form, setForm] = useState(empty);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = async () => {
    const [a, p, o, l] = await Promise.all([
      api.get("/admin/analytics"), api.get("/products"), api.get("/orders"), api.get("/admin/chat-logs"),
    ]);
    setStats(a.data); setProducts(p.data); setOrders(o.data); setLogs(l.data);
  };

  useEffect(() => { refresh(); }, []);

  const saveProduct = async () => {
    try {
      await api.post("/products", { ...form, price: Number(form.price), image_urls: form.image_urls.filter(Boolean) });
      toast.success("Product added");
      setForm(empty); setDialogOpen(false); refresh();
    } catch { toast.error("Failed to add product"); }
  };

  const del = async (id) => { await api.delete(`/products/${id}`); toast.success("Deleted"); refresh(); };

  const setOrderStatus = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    toast.success(`Order → ${status}`); refresh();
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold mb-1">Admin Console</h1>
      <p className="text-slate-400 text-sm mb-5">Catalog, orders, analytics &amp; chatbot audit.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={DollarSign} label="Revenue" value={fmtUSD2(stats?.revenue ?? 0)} accent="text-emerald-400" />
        <Stat icon={ShoppingCart} label="Orders" value={stats?.orders ?? 0} />
        <Stat icon={Users} label="Active Users" value={stats?.active_users ?? 0} />
        <Stat icon={TrendingUp} label="Conversion" value={`${stats?.conversion ?? 0}%`} accent="text-blue-400" />
      </div>

      <Tabs defaultValue="products">
        <TabsList className="bg-[#11131E] border border-white/10">
          <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">Chatbot Logs</TabsTrigger>
        </TabsList>

        {/* PRODUCTS */}
        <TabsContent value="products" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display font-bold flex items-center gap-2"><Package className="h-4 w-4" /> Catalog ({products.length})</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-product-btn" className="bg-blue-600 hover:bg-blue-500 rounded"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
              </DialogTrigger>
              <DialogContent className="bg-[#11131E] border-white/10 text-white" data-testid="product-form">
                <DialogHeader><DialogTitle className="font-display">New Product</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input data-testid="pf-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0C0E16] border-white/10" />
                  <Textarea data-testid="pf-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[#0C0E16] border-white/10" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input data-testid="pf-price" type="number" placeholder="Price (USD)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-[#0C0E16] border-white/10" />
                    <Input data-testid="pf-category" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-[#0C0E16] border-white/10" />
                  </div>
                  <Input data-testid="pf-specs" placeholder="Specs" value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} className="bg-[#0C0E16] border-white/10" />
                  <Input data-testid="pf-image" placeholder="Image URL" value={form.image_urls[0]} onChange={(e) => setForm({ ...form, image_urls: [e.target.value] })} className="bg-[#0C0E16] border-white/10" />
                </div>
                <DialogFooter><Button data-testid="save-product-btn" onClick={saveProduct} className="bg-blue-600 hover:bg-blue-500 rounded w-full">Save Product</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <div key={p.id} data-testid={`admin-product-${p.id}`} className="rounded-lg border border-white/10 bg-[#11131E] p-3 flex gap-3">
                <img src={p.image_urls?.[0]} alt="" className="h-16 w-16 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name}</div>
                  <div className="font-mono text-emerald-400 text-sm">{fmtUSD2(p.price)}</div>
                  <div className="text-[11px] text-slate-500">stock {p.stock} · {p.category}</div>
                </div>
                <button data-testid={`del-product-${p.id}`} onClick={() => del(p.id)} className="text-slate-500 hover:text-rose-400 self-start"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ORDERS */}
        <TabsContent value="orders" className="mt-4">
          <div className="rounded-lg border border-white/10 bg-[#11131E] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0C0E16] text-slate-400 text-xs uppercase tracking-wider">
                <tr><th className="text-left p-3">Order</th><th className="text-left p-3">Items</th><th className="text-left p-3">Total</th><th className="text-left p-3">Address</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-white/5" data-testid={`order-row-${o.id}`}>
                    <td className="p-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="p-3 text-slate-300">{o.items.map((i) => i.name || i.product_id).join(", ")}</td>
                    <td className="p-3 font-mono text-emerald-400">{fmtUSD2(o.total)}</td>
                    <td className="p-3 text-slate-400 text-xs max-w-[160px] truncate">{o.address}</td>
                    <td className="p-3">
                      <Select value={o.status} onValueChange={(s) => setOrderStatus(o.id, s)}>
                        <SelectTrigger className="w-[130px] bg-[#0C0E16] border-white/10 text-xs h-8" data-testid={`order-status-${o.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#11131E] border-white/10 text-white">
                          {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-[#11131E] p-4">
            <h3 className="font-display font-bold flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4" /> Conversation Log</h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {logs.messages.map((m, i) => (
                <div key={i} className="text-sm border-b border-white/5 pb-2">
                  <span className={`font-mono text-[10px] uppercase mr-2 ${m.sender === "ai" ? "text-blue-400" : "text-slate-500"}`}>{m.sender}</span>
                  <span className="text-slate-300">{m.text}</span>
                </div>
              ))}
              {logs.messages.length === 0 && <p className="text-slate-500 text-sm">No conversations yet.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#11131E] p-4">
            <h3 className="font-display font-bold flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-rose-400" /> Escalations</h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {logs.escalations.map((l) => (
                <div key={l.id} className="rounded border border-rose-500/20 bg-rose-500/5 p-3 text-sm">
                  <div className="flex justify-between"><span className="font-semibold">{l.name}</span><StatusPill value={l.status} /></div>
                  <p className="text-slate-400 text-xs mt-1">{l.last_message}</p>
                </div>
              ))}
              {logs.escalations.length === 0 && <p className="text-slate-500 text-sm">No escalations.</p>}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
