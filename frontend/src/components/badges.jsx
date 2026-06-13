import React from "react";

const SENTIMENT = {
  positive: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  neutral: "text-slate-300 bg-slate-700/40 border-slate-600/40",
  frustrated: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

const STATUS = {
  new: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  qualifying: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  hot: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  negotiating: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  won: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  lost: "text-slate-500 bg-slate-500/10 border-slate-500/20",
};

export const SentimentBadge = ({ value }) => (
  <span
    data-testid={`sentiment-${value}`}
    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${SENTIMENT[value] || SENTIMENT.neutral}`}
  >
    {value}
  </span>
);

export const StatusPill = ({ value }) => (
  <span
    data-testid={`status-${value}`}
    className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${STATUS[value] || STATUS.new}`}
  >
    {value}
  </span>
);
