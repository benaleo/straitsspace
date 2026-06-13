# StraitsSpace — PRD & Build Log

## Original Problem Statement
AI-Powered Sales Queue & Conversational Commerce for StraitsX (stablecoin/payments, XSGD/XUSD).
Two surfaces, one AI brain ("Pak Budi"): a rep-side self-ranking lead queue, and a customer-side
conversational-commerce concierge. Plus an Admin console. Full PRD in original user message.

## User Choices (v0)
- AI model: **DeepSeek** (live, OpenAI-compatible API; key in backend/.env). Heuristic fallback if unavailable.
- Scope: broad/thin — Rep Dashboard + Customer Chat + Admin.
- Auth: **none** in v0.
- Payments (Stripe/Razorpay) & Email: **deferred** (wallet uses internal credit).
- Telegram bot: **enabled** (webhook auto-set on startup).

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (uuid string ids, `{_id:0}` projections, ISO datetimes).
- Frontend: React + Tailwind + shadcn/ui + framer-motion. Pages: RepDashboard, CustomerChat, AdminDashboard.
- AI: `qualify_text()` → DeepSeek JSON, priority always recomputed in code (`compute_priority`).
- Real-time: 4s polling on queue/metrics (robust vs websockets).

## Personas
- Customer (chat concierge), Sales Rep (works ranked queue), CS/Garda Depan (escalation @CS_Resmi_Bot), Admin.

## Implemented (2026-06-13)
- Rep queue: live ranked cards (priority/value/sentiment/status/escalate), metrics bar + Before/After toggle,
  formula tooltip, Simulator (4 inject types), conversation drawer with editable Pak Budi draft + Send + status.
- AI: `POST /api/qualify` strict JSON via DeepSeek; deterministic priority; escalation flag for frustrated/abusive.
- Customer commerce: `/api/chat` with inline product cards, wallet (auto $5000) + top-up, checkout w/ address,
  order lifecycle, chat history persistence.
- Admin: analytics, product CRUD, order management (status), chatbot logs + escalations.
- Telegram: webhook intake routed into same /qualify pipeline; replies sent back; wrong-secret → 403.
- Seed: 8 products + 7 varied leads on first boot.
- Tested: 21/21 backend pytest + all 3 UI flows (100% / 100%).

## Backlog
- P1: Stripe + Razorpay wallet top-up & checkout; Resend/SendGrid order/top-up emails (FR-C3/C4/C7).
- P1: JWT or Google auth + role-gated Admin (FR-Phase1).
- P2: CSV bulk product import + S3 image upload (FR-A2); embeddings-based product search (FR-AI5).
- P2: React Native mobile app (Phase 6); embeddable chat widget; WebSocket live updates.
- P2: Server-side re-pricing of order items; tighten CORS; a11y DialogDescription on dialogs.

## Next Tasks
1. Wire Stripe wallet top-up (test key already in env) + order emails.
2. Add auth + protect Admin.
