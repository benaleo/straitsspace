import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, fmtUSD } from "@/lib/api";
import { SentimentBadge, StatusPill } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, AlertTriangle, Info, Zap, TrendingUp, Clock, CheckCircle2,
  Flame, UserPlus, Frown, Search, Send, ArrowUp,
} from "lucide-react";

const STATUSES = ["new", "qualifying", "hot", "negotiating", "won", "lost"];

const Metric = ({ icon: Icon, label, value, accent }) => (
  <div className="flex-1 min-w-[150px] rounded border border-white/10 bg-[#11131E] p-4">
    <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} /> {label}
    </div>
    <div className={`mt-2 font-display text-2xl font-extrabold ${accent || "text-white"}`}>{value}</div>
  </div>
);

const MetricsBar = ({ metrics, mode, setMode }) => {
  const data = mode === "before" ? metrics?.before : metrics?.after;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0C0E16] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-bold">Performance</h2>
          <span className="font-mono text-[11px] text-slate-500">
            {mode === "before" ? "FCFS baseline" : "StraitsSpace live"}
          </span>
        </div>
        <div className="flex rounded border border-white/10 overflow-hidden text-xs font-semibold" data-testid="beforeafter-toggle">
          <button
            data-testid="toggle-before"
            onClick={() => setMode("before")}
            className={`px-3 py-1.5 transition-colors ${mode === "before" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Before
          </button>
          <button
            data-testid="toggle-after"
            onClick={() => setMode("after")}
            className={`px-3 py-1.5 transition-colors ${mode === "after" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            After
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Metric icon={Clock} label="Avg First Response" value={data?.avg_wait ?? "—"}
                accent={mode === "after" ? "text-emerald-400" : "text-rose-400"} />
        <Metric icon={TrendingUp} label="Handled Today" value={data?.handled ?? "—"} />
        <Metric icon={CheckCircle2} label="Conversion %" value={`${data?.conversion ?? 0}%`}
                accent={mode === "after" ? "text-emerald-400" : "text-slate-300"} />
      </div>
    </div>
  );
};

const SimulatorPanel = ({ onInject }) => {
  const [loading, setLoading] = useState("");
  const inject = async (kind, label) => {
    setLoading(kind);
    try {
      const { data } = await api.post(`/simulate/${kind}`);
      toast.success(`Injected: ${data.lead.name}`, { description: `Priority ${data.lead.priority} · ${label}` });
      onInject();
    } catch (e) {
      toast.error("Simulation failed");
    } finally {
      setLoading("");
    }
  };
  const btns = [
    { kind: "high_value", label: "High-value lead", icon: Zap, cls: "border-blue-500/30 hover:bg-blue-600/10 text-blue-300" },
    { kind: "frustrated", label: "Frustrated customer", icon: Frown, cls: "border-rose-500/30 hover:bg-rose-600/10 text-rose-300" },
    { kind: "low_intent", label: "Low-intent inquiry", icon: Search, cls: "border-slate-500/30 hover:bg-white/5 text-slate-300" },
    { kind: "purchase", label: "Purchase intent", icon: UserPlus, cls: "border-emerald-500/30 hover:bg-emerald-600/10 text-emerald-300" },
  ];
  return (
    <div className="rounded-lg border border-white/10 bg-[#11131E] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-blue-400" strokeWidth={1.75} />
        <h3 className="font-display text-sm font-bold">Simulator</h3>
        <span className="font-mono text-[10px] text-slate-500">inject → qualify → re-rank</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {btns.map((b) => (
          <button
            key={b.kind}
            data-testid={`sim-${b.kind}`}
            onClick={() => inject(b.kind, b.label)}
            disabled={!!loading}
            className={`flex items-center gap-2 rounded border bg-[#0C0E16] px-3 py-2.5 text-xs font-medium transition-colors duration-200 disabled:opacity-50 ${b.cls}`}
          >
            <b.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {loading === b.kind ? "Injecting…" : b.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const LeadCard = ({ lead, rank, onOpen }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.97 }}
    transition={{ duration: 0.25 }}
    data-testid={`lead-card-${lead.id}`}
    onClick={() => onOpen(lead)}
    className="group cursor-pointer rounded-lg border border-white/10 bg-[#11131E] p-4 hover:border-blue-500/40 hover:bg-[#141726] transition-colors duration-200"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-700 font-mono text-xs text-slate-300">
          #{rank}
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{lead.name}</div>
          <div className="font-mono text-[10px] text-slate-500 uppercase">{lead.source}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 justify-end font-display text-xl font-extrabold text-blue-400 cursor-help">
                <ArrowUp className="h-4 w-4" /> {lead.priority}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs bg-[#0C0E16] border-white/10 text-slate-300">
              <p className="font-mono text-[11px] leading-relaxed">
                priority = value×0.4 + intent×0.3 + urgency×0.2 + (frustrated?10:0)
                <br />= {Math.min(100, Math.round(lead.deal_value_est / 1000))}×0.4 + {lead.intent_score}×0.3 + {lead.urgency}×0.2
                {lead.sentiment === "frustrated" ? " + 10" : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="font-mono text-[10px] text-slate-500">priority</div>
      </div>
    </div>

    <p className="mt-3 text-sm text-slate-400 line-clamp-2">{lead.last_message}</p>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-bold text-emerald-400">{fmtUSD(lead.deal_value_est)}</span>
      <SentimentBadge value={lead.sentiment} />
      <StatusPill value={lead.status} />
      {lead.needs_escalation && (
        <span data-testid={`escalate-${lead.id}`} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border text-rose-400 bg-rose-400/10 border-rose-400/30">
          <AlertTriangle className="h-3 w-3" /> Escalate · CS
        </span>
      )}
    </div>
  </motion.div>
);

const ConversationDrawer = ({ lead, open, onClose, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!lead) return;
    const { data } = await api.get(`/leads/${lead.id}`);
    setDetail(data);
    setDraft(data.lead.suggested_reply || "");
  }, [lead]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const send = async () => {
    setSending(true);
    try {
      await api.post(`/leads/${lead.id}/reply`, { text: draft });
      toast.success("Reply sent · status advanced");
      await load();
      onChanged();
    } catch (e) { toast.error("Failed to send"); }
    finally { setSending(false); }
  };

  const changeStatus = async (status) => {
    await api.patch(`/leads/${lead.id}/status`, { status });
    toast.success(`Status → ${status}`);
    await load();
    onChanged();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md bg-[#0C0E16] border-white/10 text-white overflow-hidden p-0" data-testid="conversation-drawer">
        {detail && (
          <div className="flex flex-col h-full max-h-screen">
            <SheetHeader className="p-5 border-b border-white/10 shrink-0">
              <SheetTitle className="text-white flex items-center justify-between">
                <span>{detail.lead.name}</span>
                <span className="font-display text-blue-400">{detail.lead.priority}</span>
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-mono text-sm text-emerald-400">{fmtUSD(detail.lead.deal_value_est)}</span>
                <SentimentBadge value={detail.lead.sentiment} />
                <StatusPill value={detail.lead.status} />
              </div>
              <p className="text-xs text-slate-400 pt-1">{detail.lead.summary}</p>
            </SheetHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              {detail.messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "rep" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.sender === "rep" ? "bg-blue-600 text-white rounded-br-sm"
                      : m.sender === "ai" ? "bg-violet-600/20 border border-violet-500/20 text-violet-100 rounded-bl-sm"
                      : "bg-[#1C1F2E] border border-white/5 text-slate-200 rounded-bl-sm"}`}>
                    <div className="font-mono text-[9px] uppercase tracking-wider opacity-60 mb-0.5">{m.sender}</div>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-white/10 space-y-3 bg-[#0A0C12] shrink-0">
              {detail.lead.needs_escalation && (
                <div className="flex items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  <AlertTriangle className="h-4 w-4" /> Flagged for CS escalation → @CS_Resmi_Bot
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-violet-300">
                <Sparkles className="h-3.5 w-3.5" /> Pak Budi draft — edit &amp; send
              </div>
              <Textarea
                data-testid="draft-reply"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="bg-[#11131E] border-white/10 text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <Select onValueChange={changeStatus} value={detail.lead.status}>
                  <SelectTrigger className="w-[150px] bg-[#11131E] border-white/10 text-xs" data-testid="status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#11131E] border-white/10 text-white">
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button data-testid="send-reply-btn" onClick={send} disabled={sending}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 rounded">
                  <Send className="h-4 w-4 mr-1.5" /> {sending ? "Sending…" : "Send Reply"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default function RepDashboard() {
  const [leads, setLeads] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [mode, setMode] = useState("after");
  const [active, setActive] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [l, m] = await Promise.all([api.get("/leads"), api.get("/metrics")]);
    setLeads(l.data);
    setMetrics(m.data);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const open = (lead) => { setActive(lead); setDrawerOpen(true); };

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold">Smart Sales Queue</h1>
        <p className="text-slate-400 text-sm mt-1">
          Two reps, one self-ranking pipeline — sorted by deal value &amp; intent, not arrival time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <MetricsBar metrics={metrics} mode={mode} setMode={setMode} />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" /> Ranked Queue
              <span className="font-mono text-[11px] text-slate-500">{leads.length} leads · live re-sort</span>
            </h2>
          </div>
          <div className="space-y-3">
            <AnimatePresence>
              {leads.map((lead, i) => (
                <LeadCard key={lead.id} lead={lead} rank={i + 1} onOpen={open} />
              ))}
            </AnimatePresence>
            {leads.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-slate-500 text-sm">
                No leads yet. Use the Simulator to inject one.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <SimulatorPanel onInject={refresh} />
          <div className="rounded-lg border border-white/10 bg-[#11131E] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-400" />
              <h3 className="font-display text-sm font-bold">Priority Formula</h3>
            </div>
            <code className="block font-mono text-[11px] text-slate-400 leading-relaxed bg-[#0C0E16] rounded p-3">
              priority = value<sub>norm</sub>×0.4<br />
              &nbsp;&nbsp;+ intent×0.3<br />
              &nbsp;&nbsp;+ urgency×0.2<br />
              &nbsp;&nbsp;+ (frustrated ? 10 : 0)
            </code>
            <p className="text-xs text-slate-500 mt-2">Computed server-side for stability — angry &amp; high-value leads bubble up.</p>
          </div>
        </div>
      </div>

      <ConversationDrawer lead={active} open={drawerOpen} onClose={() => setDrawerOpen(false)} onChanged={refresh} />
    </div>
  );
}
