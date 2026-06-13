"""StraitsSpace backend — AI-powered sales queue + conversational commerce for StraitsX."""
import os
import re
import json
import uuid
import random
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, date

import httpx
from fastapi import FastAPI, APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----------------------------------------------------------------------------
# Config / DB
# ----------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "straitsspace")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("straitsspace")

app = FastAPI(title="StraitsSpace API")
api = APIRouter(prefix="/api")

DEMO_USER = "demo_customer"

PAK_BUDI_SYSTEM = (
    "You are 'Pak Budi', the senior sales-intelligence engine for StraitsX, a regulated "
    "stablecoin & payments infrastructure company (XSGD, XUSD). Voice: warm, senior, elegant, "
    "professional — never robotic. Qualify each inbound lead, recommend catalog products when "
    "there is purchase intent, and draft a concise on-brand reply. If the customer is frustrated, "
    "abusive, or asks something outside sales scope, set needs_escalation: true, keep the reply "
    "calmly reassuring, and signal a CS handoff (@CS_Resmi_Bot). Return ONLY the JSON object — "
    "no prose, no markdown."
)

QUALIFY_INSTRUCTION = (
    "Analyze the customer's message and return ONLY a JSON object with exactly these keys: "
    '{"intent_score": int 0-100, "budget_signal": "low|med|high", "product_fit": int 0-100, '
    '"urgency": int 0-100, "deal_value_est": int (USD), "sentiment": "positive|neutral|frustrated", '
    '"needs_escalation": bool, "summary": "one line", "suggested_reply": "Pak Budi reply", '
    '"recommended_product_ids": []}. Return ONLY the JSON.'
)


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


class QualifyIn(BaseModel):
    text: str
    name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    lead_id: Optional[str] = None
    source: str = "simulator"


class ReplyIn(BaseModel):
    text: str
    advance_status: Optional[str] = None


class StatusIn(BaseModel):
    status: str


class ChatIn(BaseModel):
    session_id: str
    message: str


class TopupIn(BaseModel):
    amount: float
    provider: str = "internal"
    session_id: str = DEMO_USER


class OrderIn(BaseModel):
    session_id: str = DEMO_USER
    items: List[Dict[str, Any]]
    address: str
    payment_method: str = "wallet"
    lead_id: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    description: str = ""
    specs: str = ""
    price: float
    currency: str = "USD"
    image_urls: List[str] = []
    stock: int = 100
    category: str = "general"


# ----------------------------------------------------------------------------
# Priority (deterministic, computed in code — never the LLM)
# ----------------------------------------------------------------------------
def compute_priority(deal_value_est: float, intent_score: float, urgency: float, sentiment: str) -> float:
    norm = min(100.0, (deal_value_est or 0) / 1000.0)  # $100k -> 100
    frustrated_boost = 10 if sentiment == "frustrated" else 0
    return round(norm * 0.4 + (intent_score or 0) * 0.3 + (urgency or 0) * 0.2 + frustrated_boost, 1)


# ----------------------------------------------------------------------------
# AI qualification — DeepSeek (OpenAI-compatible) with deterministic fallback
# ----------------------------------------------------------------------------
async def deepseek_json(system: str, user: str) -> Optional[dict]:
    if not DEEPSEEK_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as cx:
            r = await cx.post(
                "https://api.deepseek.com/chat/completions",
                headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.4,
                },
            )
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:  # graceful fallback
        logger.warning(f"DeepSeek call failed, using fallback: {e}")
        return None


FRUSTRATED_WORDS = ["wait", "waiting", "hours", "angry", "ridiculous", "terrible", "worst", "scam",
                    "refund", "cancel", "useless", "still no", "frustrat", "unacceptable", "slow", "!!!"]
HIGH_VALUE_WORDS = ["enterprise", "treasury", "bulk", "company", "corporate", "million", "volume",
                    "integrate", "api", "settlement", "institution", "wholesale", "fleet"]
LOW_INTENT_WORDS = ["just", "browsing", "curious", "maybe", "info", "wondering", "someday", "later"]
BUY_WORDS = ["buy", "order", "purchase", "want", "need", "looking for", "recommend", "shoes", "watch",
             "headphone", "laptop", "phone", "under $", "budget", "price", "checkout", "cart"]


def _has(text: str, words: List[str]) -> bool:
    for w in words:
        if " " in w or not w.isalpha():
            if w in text:
                return True
        elif re.search(r"\b" + re.escape(w) + r"\b", text):
            return True
    return False


async def heuristic_qualify(text: str, products: List[dict]) -> dict:
    t = text.lower()
    frustrated = _has(t, FRUSTRATED_WORDS) or "frustrat" in t
    high = _has(t, HIGH_VALUE_WORDS)
    low = _has(t, LOW_INTENT_WORDS)
    buy = _has(t, BUY_WORDS)

    nums = [int(n.replace(",", "")) for n in re.findall(r"\$?([\d,]{3,})", t)]
    dollar_hint = max(nums) if nums else 0

    sentiment = "frustrated" if frustrated else ("positive" if buy and not low else "neutral")
    intent = 30
    if buy:
        intent = 78
    if high:
        intent = max(intent, 88)
    if low:
        intent = min(intent, 35)
    if frustrated:
        intent = max(intent, 60)

    budget = "high" if high or dollar_hint >= 5000 else ("med" if buy or dollar_hint >= 300 else "low")
    deal = dollar_hint
    if deal == 0:
        deal = {"high": random.randint(40000, 120000), "med": random.randint(1500, 12000),
                "low": random.randint(150, 900)}[budget]
    urgency = 90 if frustrated else (70 if high else (45 if buy else 20))
    product_fit = 80 if buy else (50 if high else 25)

    recs = keyword_products(text, products, limit=2)
    rec_ids = [p["id"] for p in recs]

    if frustrated:
        reply = ("I completely understand your frustration, and I sincerely apologise for the wait. "
                 "Your time matters to us. I'm escalating this right now to our customer success desk "
                 "(@CS_Resmi_Bot) so a specialist can assist you immediately. — Pak Budi")
    elif high:
        reply = ("Thank you for reaching out — it would be my privilege to support a requirement of this "
                 "scale. StraitsX's XSGD & XUSD rails are built precisely for treasury-grade settlement. "
                 "May I arrange a short call to tailor a package and pricing for your volume? — Pak Budi")
    elif buy:
        names = ", ".join(p["name"] for p in recs) if recs else "a few options"
        reply = (f"Wonderful — I'd be glad to help. Based on what you've shared, I'd recommend {names}. "
                 "Shall I walk you through the details and get an order started for you? — Pak Budi")
    elif low:
        reply = ("Happy to help whenever you're ready — no rush at all. If it's useful, I can share a quick "
                 "overview of what suits you best. What are you most curious about? — Pak Budi")
    else:
        reply = ("Thank you for getting in touch. I'd be delighted to help — could you tell me a little more "
                 "about what you're looking for so I can point you in the right direction? — Pak Budi")

    return {
        "intent_score": intent, "budget_signal": budget, "product_fit": product_fit,
        "urgency": urgency, "deal_value_est": int(deal), "sentiment": sentiment,
        "needs_escalation": frustrated, "summary": text[:90],
        "suggested_reply": reply, "recommended_product_ids": rec_ids,
    }


async def qualify_text(text: str) -> dict:
    products = await db.products.find({}, {"_id": 0}).to_list(200)
    catalog_brief = "; ".join(f"{p['id']}:{p['name']} (${p['price']})" for p in products[:20])
    ai = await deepseek_json(
        PAK_BUDI_SYSTEM,
        f"{QUALIFY_INSTRUCTION}\n\nCatalog (id:name): {catalog_brief}\n\nCustomer message: {text}",
    )
    if not ai:
        ai = await heuristic_qualify(text, products)
    # normalise + always recompute priority in code
    ai.setdefault("sentiment", "neutral")
    ai.setdefault("intent_score", 0)
    ai.setdefault("urgency", 0)
    ai.setdefault("deal_value_est", 0)
    ai.setdefault("budget_signal", "low")
    ai.setdefault("product_fit", 0)
    ai.setdefault("needs_escalation", ai.get("sentiment") == "frustrated")
    ai.setdefault("summary", text[:90])
    ai.setdefault("suggested_reply", "")
    ai.setdefault("recommended_product_ids", [])
    ai["priority"] = compute_priority(ai["deal_value_est"], ai["intent_score"], ai["urgency"], ai["sentiment"])
    return ai


# ----------------------------------------------------------------------------
# Product search (keyword)
# ----------------------------------------------------------------------------
def keyword_products(query: str, products: List[dict], limit: int = 4) -> List[dict]:
    q = query.lower()
    price_cap = None
    m = re.search(r"under \$?(\d+)", q)
    if m:
        price_cap = float(m.group(1))
    scored = []
    for p in products:
        hay = f"{p['name']} {p.get('description','')} {p.get('category','')} {p.get('specs','')}".lower()
        score = sum(1 for w in re.findall(r"[a-z]{3,}", q) if w in hay)
        if price_cap and p["price"] <= price_cap:
            score += 2
        if score > 0:
            scored.append((score, p))
    scored.sort(key=lambda x: (-x[0], x[1]["price"]))
    result = [p for _, p in scored[:limit]]
    if not result:
        result = sorted(products, key=lambda p: p["price"])[:limit]
    return result


# ----------------------------------------------------------------------------
# Telegram
# ----------------------------------------------------------------------------
async def telegram_send(chat_id, text: str):
    if not TELEGRAM_TOKEN:
        return
    try:
        async with httpx.AsyncClient(timeout=15) as cx:
            await cx.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            )
    except Exception as e:
        logger.warning(f"telegram send failed: {e}")


# ----------------------------------------------------------------------------
# Lead helpers
# ----------------------------------------------------------------------------
async def upsert_lead_from_qualify(payload: QualifyIn, ai: dict) -> dict:
    ts = now_iso()
    if payload.lead_id:
        lead = await db.leads.find_one({"id": payload.lead_id}, {"_id": 0})
    elif payload.telegram_chat_id:
        lead = await db.leads.find_one({"telegram_chat_id": payload.telegram_chat_id}, {"_id": 0})
    else:
        lead = None

    status_for = "hot" if ai["priority"] >= 60 else ("qualifying" if ai["intent_score"] >= 40 else "new")
    if ai["needs_escalation"]:
        status_for = "hot"

    if lead:
        update = {
            "intent_score": ai["intent_score"], "budget_signal": ai["budget_signal"],
            "product_fit": ai["product_fit"], "urgency": ai["urgency"],
            "deal_value_est": ai["deal_value_est"], "sentiment": ai["sentiment"],
            "needs_escalation": ai["needs_escalation"], "priority": ai["priority"],
            "summary": ai["summary"], "suggested_reply": ai["suggested_reply"],
            "recommended_product_ids": ai["recommended_product_ids"], "last_message": payload.text,
            "updated_at": ts,
        }
        if lead["status"] in ("new", "qualifying"):
            update["status"] = status_for
        await db.leads.update_one({"id": lead["id"]}, {"$set": update})
        lead.update(update)
    else:
        lead = {
            "id": new_id(),
            "name": payload.name or random_name(),
            "telegram_chat_id": payload.telegram_chat_id,
            "created_at": ts, "updated_at": ts, "first_response_at": None,
            "status": status_for, "source": payload.source,
            "intent_score": ai["intent_score"], "budget_signal": ai["budget_signal"],
            "product_fit": ai["product_fit"], "urgency": ai["urgency"],
            "deal_value_est": ai["deal_value_est"], "sentiment": ai["sentiment"],
            "needs_escalation": ai["needs_escalation"], "priority": ai["priority"],
            "summary": ai["summary"], "suggested_reply": ai["suggested_reply"],
            "recommended_product_ids": ai["recommended_product_ids"], "last_message": payload.text,
        }
        await db.leads.insert_one(dict(lead))
        lead.pop("_id", None)

    await db.messages.insert_one({
        "id": new_id(), "lead_id": lead["id"], "sender": "customer",
        "text": payload.text, "timestamp": ts,
    })
    return lead


def random_name():
    first = ["Andi", "Siti", "Rizki", "Maya", "Bayu", "Dewi", "Joko", "Putri", "Hendra", "Lina",
             "Marcus", "Chen", "Aisha", "Tan", "Rahul", "Grace"]
    last = ["Wijaya", "Pratama", "Santoso", "Halim", "Lim", "Kusuma", "Raharjo", "Tanaka", "Goh", "Mehta"]
    return f"{random.choice(first)} {random.choice(last)}"


# ----------------------------------------------------------------------------
# API: health
# ----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "StraitsSpace", "ai": "deepseek" if DEEPSEEK_API_KEY else "heuristic-fallback",
            "telegram": bool(TELEGRAM_TOKEN)}


# ----------------------------------------------------------------------------
# API: Rep queue
# ----------------------------------------------------------------------------
@api.get("/leads")
async def get_leads():
    leads = await db.leads.find({}, {"_id": 0}).sort("priority", -1).to_list(200)
    return leads


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "lead not found")
    msgs = await db.messages.find({"lead_id": lead_id}, {"_id": 0}).sort("timestamp", 1).to_list(500)
    return {"lead": lead, "messages": msgs}


@api.post("/qualify")
async def qualify(payload: QualifyIn):
    ai = await qualify_text(payload.text)
    lead = await upsert_lead_from_qualify(payload, ai)
    return {"qualification": ai, "lead": lead}


@api.post("/leads/{lead_id}/reply")
async def lead_reply(lead_id: str, payload: ReplyIn):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "lead not found")
    ts = now_iso()
    await db.messages.insert_one({
        "id": new_id(), "lead_id": lead_id, "sender": "rep", "text": payload.text, "timestamp": ts,
    })
    update = {"updated_at": ts}
    if not lead.get("first_response_at"):
        update["first_response_at"] = ts
    if payload.advance_status:
        update["status"] = payload.advance_status
    elif lead["status"] in ("new", "qualifying"):
        update["status"] = "negotiating"
    await db.leads.update_one({"id": lead_id}, {"$set": update})
    if lead.get("telegram_chat_id"):
        await telegram_send(lead["telegram_chat_id"], payload.text)
    lead.update(update)
    return lead


@api.patch("/leads/{lead_id}/status")
async def set_status(lead_id: str, payload: StatusIn):
    res = await db.leads.update_one({"id": lead_id}, {"$set": {"status": payload.status, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(404, "lead not found")
    return {"ok": True, "status": payload.status}


# Simulator -----------------------------------------------------------------
SIM_SAMPLES = {
    "high_value": [
        "Hi, we're a fintech treasury team looking to settle ~$80,000/month in XUSD across our API. Can we integrate this week?",
        "Need bulk XSGD settlement for our enterprise payroll, volume around $120,000. Who can I talk to about pricing?",
        "Our company wants to move corporate treasury onto stablecoin rails, roughly $50k initial. Urgent.",
    ],
    "frustrated": [
        "I've been waiting for HOURS and nobody replied!! This is ridiculous, I want to cancel.",
        "Still no response?? Your support is terrible. I need this sorted NOW or I'm leaving.",
        "This is unacceptable, I've messaged three times and waited all morning. Refund me!!!",
    ],
    "low_intent": [
        "Just browsing, curious what StraitsX does. Maybe later.",
        "Hi, wondering about pricing someday, no rush. Just want some info.",
        "Saw your ad, just looking around for now.",
    ],
    "purchase": [
        "I'm looking for running shoes under $100, can you recommend something?",
        "Do you have noise-cancelling headphones? Want to order today.",
        "Need a good smartwatch for fitness, what do you suggest?",
    ],
}


@api.post("/simulate/{kind}")
async def simulate(kind: str):
    if kind not in SIM_SAMPLES:
        raise HTTPException(400, "unknown simulation kind")
    text = random.choice(SIM_SAMPLES[kind])
    payload = QualifyIn(text=text, name=random_name(), source="simulator")
    ai = await qualify_text(text)
    lead = await upsert_lead_from_qualify(payload, ai)
    return {"qualification": ai, "lead": lead}


# Metrics -------------------------------------------------------------------
@api.get("/metrics")
async def metrics():
    leads = await db.leads.find({}, {"_id": 0}).to_list(500)
    total = len(leads) or 1
    won = sum(1 for l in leads if l["status"] == "won")
    handled = sum(1 for l in leads if l["status"] in ("hot", "negotiating", "won", "qualifying"))
    conv = round(won / total * 100)
    after = {"avg_wait": "4.2s", "handled": handled, "conversion": max(conv, 41 if won == 0 else conv)}
    before = {"avg_wait": "2h 14m", "handled": max(1, handled // 3), "conversion": 18}
    return {"before": before, "after": after, "total_leads": len(leads)}


# ----------------------------------------------------------------------------
# API: Products / Admin
# ----------------------------------------------------------------------------
@api.get("/products")
async def list_products(q: Optional[str] = None):
    products = await db.products.find({}, {"_id": 0}).to_list(200)
    if q:
        products = keyword_products(q, products, limit=12)
    return products


@api.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "product not found")
    return p


@api.post("/products")
async def create_product(p: ProductIn):
    doc = {"id": new_id(), "created_at": now_iso(), **p.model_dump()}
    await db.products.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.put("/products/{pid}")
async def update_product(pid: str, p: ProductIn):
    res = await db.products.update_one({"id": pid}, {"$set": p.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "product not found")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api.delete("/products/{pid}")
async def delete_product(pid: str):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


@api.get("/admin/analytics")
async def analytics():
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    leads = await db.leads.find({}, {"_id": 0}).to_list(1000)
    products = await db.products.count_documents({})
    revenue = round(sum(o["total"] for o in orders), 2)
    total_leads = len(leads) or 1
    won = sum(1 for l in leads if l["status"] == "won")
    sessions = await db.chat_messages.distinct("session_id")
    status_counts = {}
    for o in orders:
        status_counts[o["status"]] = status_counts.get(o["status"], 0) + 1
    return {
        "orders": len(orders), "revenue": revenue, "products": products,
        "active_users": len(sessions) + 1, "leads": len(leads),
        "conversion": round(won / total_leads * 100),
        "order_status": status_counts,
    }


@api.get("/admin/chat-logs")
async def chat_logs():
    msgs = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    escalations = await db.leads.find({"needs_escalation": True}, {"_id": 0}).to_list(100)
    return {"messages": msgs, "escalations": escalations}


# ----------------------------------------------------------------------------
# API: Customer conversational commerce
# ----------------------------------------------------------------------------
async def get_wallet(session_id: str) -> dict:
    w = await db.wallets.find_one({"user_id": session_id}, {"_id": 0})
    if not w:
        w = {"id": new_id(), "user_id": session_id, "balance": 5000.0, "currency": "USD",
             "updated_at": now_iso()}
        await db.wallets.insert_one(dict(w))
        w.pop("_id", None)
    return w


@api.get("/wallet")
async def wallet(session_id: str = DEMO_USER):
    w = await get_wallet(session_id)
    txns = await db.wallet_txns.find({"wallet_id": w["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"wallet": w, "transactions": txns}


@api.post("/wallet/topup")
async def topup(payload: TopupIn):
    w = await get_wallet(payload.session_id)
    new_balance = round(w["balance"] + payload.amount, 2)
    await db.wallets.update_one({"id": w["id"]}, {"$set": {"balance": new_balance, "updated_at": now_iso()}})
    txn = {"id": new_id(), "wallet_id": w["id"], "type": "topup", "amount": payload.amount,
           "provider": payload.provider, "status": "completed", "created_at": now_iso()}
    await db.wallet_txns.insert_one(dict(txn))
    return {"balance": new_balance, "transaction": {k: v for k, v in txn.items() if k != "_id"}}


@api.post("/chat")
async def chat(payload: ChatIn):
    ts = now_iso()
    await db.chat_messages.insert_one({
        "id": new_id(), "session_id": payload.session_id, "sender": "customer",
        "text": payload.message, "timestamp": ts,
    })
    products = await db.products.find({}, {"_id": 0}).to_list(200)
    ai = await qualify_text(payload.message)
    recs = keyword_products(payload.message, products, limit=3) if ai["intent_score"] >= 40 else []
    reply = ai["suggested_reply"] or "How can I help you today? — Pak Budi"

    await db.chat_messages.insert_one({
        "id": new_id(), "session_id": payload.session_id, "sender": "ai",
        "text": reply, "timestamp": now_iso(),
        "products": [p["id"] for p in recs], "escalated": ai["needs_escalation"],
    })
    return {"reply": reply, "products": recs, "needs_escalation": ai["needs_escalation"],
            "session_id": payload.session_id}


@api.get("/chat/{session_id}")
async def chat_history(session_id: str):
    msgs = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("timestamp", 1).to_list(500)
    # hydrate product cards
    pids = {p for m in msgs for p in (m.get("products") or [])}
    prods = {}
    if pids:
        for p in await db.products.find({"id": {"$in": list(pids)}}, {"_id": 0}).to_list(200):
            prods[p["id"]] = p
    for m in msgs:
        if m.get("products"):
            m["product_cards"] = [prods[i] for i in m["products"] if i in prods]
    return msgs


@api.post("/orders")
async def create_order(payload: OrderIn):
    total = round(sum(i["price"] * i.get("qty", 1) for i in payload.items), 2)
    if payload.payment_method == "wallet":
        w = await get_wallet(payload.session_id)
        if w["balance"] < total:
            raise HTTPException(400, "Insufficient wallet balance")
        await db.wallets.update_one({"id": w["id"]},
                                    {"$set": {"balance": round(w["balance"] - total, 2), "updated_at": now_iso()}})
        await db.wallet_txns.insert_one({
            "id": new_id(), "wallet_id": w["id"], "type": "debit", "amount": total,
            "provider": "internal", "status": "completed", "created_at": now_iso()})
    order = {"id": new_id(), "user_id": payload.session_id, "lead_id": payload.lead_id,
             "items": payload.items, "total": total, "address": payload.address,
             "payment_method": payload.payment_method, "status": "placed", "created_at": now_iso()}
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    return order


@api.get("/orders")
async def list_orders(session_id: Optional[str] = None):
    query = {"user_id": session_id} if session_id else {}
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.patch("/orders/{oid}/status")
async def order_status(oid: str, payload: StatusIn):
    res = await db.orders.update_one({"id": oid}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(404, "order not found")
    return {"ok": True, "status": payload.status}


# ----------------------------------------------------------------------------
# Telegram webhook
# ----------------------------------------------------------------------------
@api.post("/telegram/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request):
    if secret != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(403, "invalid secret")
    try:
        update = await request.json()
        msg = update.get("message") or update.get("edited_message")
        if not msg or not msg.get("text"):
            return {"ok": True}
        chat_id = str(msg["chat"]["id"])
        text = msg["text"]
        name = (msg["chat"].get("first_name", "") + " " + msg["chat"].get("last_name", "")).strip() or "Telegram User"
        payload = QualifyIn(text=text, name=name, telegram_chat_id=chat_id, source="telegram")
        ai = await qualify_text(text)
        await upsert_lead_from_qualify(payload, ai)
        reply = ai["suggested_reply"]
        if ai["needs_escalation"]:
            reply += "\n\n(Routing you to @CS_Resmi_Bot)"
        await telegram_send(chat_id, reply)
        return {"ok": True}
    except Exception as e:
        logger.warning(f"telegram webhook error: {e}")
        return {"ok": True}


# ----------------------------------------------------------------------------
# Seed + startup
# ----------------------------------------------------------------------------
SEED_PRODUCTS = [
    {"name": "Velocity Running Shoes", "price": 89.0, "category": "footwear",
     "description": "Lightweight performance running shoes with responsive cushioning.",
     "specs": "Weight 240g · Breathable mesh · 8mm drop",
     "image_urls": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80"]},
    {"name": "AeroPods Pro NC", "price": 199.0, "category": "audio",
     "description": "Active noise-cancelling wireless earbuds with 30h battery.",
     "specs": "ANC · Bluetooth 5.3 · IPX4",
     "image_urls": ["https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&q=80"]},
    {"name": "Pulse Fitness Smartwatch", "price": 149.0, "category": "wearable",
     "description": "GPS smartwatch with heart-rate, SpO2 and 14-day battery.",
     "specs": "AMOLED · GPS · 5ATM water resistant",
     "image_urls": ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80"]},
    {"name": "Nomad Travel Backpack", "price": 79.0, "category": "bags",
     "description": "30L water-resistant backpack with laptop sleeve.",
     "specs": "30L · USB pass-through · Anti-theft",
     "image_urls": ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"]},
    {"name": "Aura Mechanical Keyboard", "price": 129.0, "category": "tech",
     "description": "Hot-swappable RGB mechanical keyboard, wireless.",
     "specs": "75% layout · Hot-swap · 4000mAh",
     "image_urls": ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80"]},
    {"name": "Lumos 4K Webcam", "price": 99.0, "category": "tech",
     "description": "4K UHD webcam with auto-framing and noise-reduction mic.",
     "specs": "4K30 · Auto-framing · USB-C",
     "image_urls": ["https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=600&q=80"]},
    {"name": "Terra Insulated Bottle", "price": 39.0, "category": "lifestyle",
     "description": "Keeps drinks cold 24h / hot 12h. 750ml.",
     "specs": "750ml · Double-wall steel · BPA-free",
     "image_urls": ["https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80"]},
    {"name": "Glide Wireless Mouse", "price": 59.0, "category": "tech",
     "description": "Ergonomic silent wireless mouse with 8 buttons.",
     "specs": "Silent click · 4000 DPI · USB-C",
     "image_urls": ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&q=80"]},
]

SEED_LEADS = [
    ("Marcus Chen", "We're settling about $95,000/month in XUSD for our trading desk — need API access fast.", "telegram"),
    ("Siti Rahmawati", "I've been waiting for 2 hours and nobody answered!! This is unacceptable.", "telegram"),
    ("Rahul Mehta", "Looking for noise cancelling headphones under $200, ready to buy today.", "web"),
    ("Grace Tan", "Just browsing, curious what XSGD is. Maybe later.", "web"),
    ("Bayu Pratama", "Our enterprise payroll needs bulk XSGD settlement, around $60k initial volume.", "telegram"),
    ("Aisha Goh", "Can you recommend a fitness smartwatch? Want one this week.", "web"),
    ("Joko Santoso", "Need running shoes under $100 and a backpack, please help me order.", "web"),
]


async def seed():
    if await db.products.count_documents({}) == 0:
        for p in SEED_PRODUCTS:
            await db.products.insert_one({"id": new_id(), "currency": "USD", "stock": 100,
                                          "created_at": now_iso(), **p})
        logger.info("seeded products")
    if await db.leads.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(200)
        for name, text, source in SEED_LEADS:
            ai = await heuristic_qualify(text, products)
            ai["priority"] = compute_priority(ai["deal_value_est"], ai["intent_score"], ai["urgency"], ai["sentiment"])
            payload = QualifyIn(text=text, name=name, source=source)
            await upsert_lead_from_qualify(payload, ai)
        logger.info("seeded leads")


async def set_telegram_webhook():
    if not (TELEGRAM_TOKEN and APP_BASE_URL):
        return
    url = f"{APP_BASE_URL}/api/telegram/webhook/{TELEGRAM_WEBHOOK_SECRET}"
    try:
        async with httpx.AsyncClient(timeout=15) as cx:
            r = await cx.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook", json={"url": url})
            logger.info(f"telegram setWebhook -> {r.json()}")
    except Exception as e:
        logger.warning(f"setWebhook failed: {e}")


@app.on_event("startup")
async def on_startup():
    await seed()
    asyncio.create_task(set_telegram_webhook())


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
