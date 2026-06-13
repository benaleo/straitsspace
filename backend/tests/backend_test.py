"""StraitsSpace backend regression tests — uses public REACT_APP_BACKEND_URL."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- Health ----------------
def test_health(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    d = r.json()
    assert d["app"] == "StraitsSpace"
    assert d["ai"] in ("deepseek", "heuristic-fallback")


# ---------------- Products ----------------
def test_products_seeded(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    products = r.json()
    assert isinstance(products, list)
    assert len(products) >= 8  # 8 seeded
    p = products[0]
    for k in ("id", "name", "price"):
        assert k in p
    assert "_id" not in p


def test_products_search(s):
    r = s.get(f"{API}/products", params={"q": "running"})
    assert r.status_code == 200
    results = r.json()
    assert len(results) >= 1
    assert any("running" in p["name"].lower() or "running" in p.get("description", "").lower()
               for p in results)


def test_product_crud(s):
    payload = {"name": "TEST_Widget", "description": "test", "price": 12.5, "category": "test"}
    r = s.post(f"{API}/products", json=payload)
    assert r.status_code == 200
    p = r.json()
    assert p["name"] == "TEST_Widget"
    assert p["price"] == 12.5
    pid = p["id"]

    # GET single
    r = s.get(f"{API}/products/{pid}")
    assert r.status_code == 200 and r.json()["id"] == pid

    # Update
    upd = dict(payload, name="TEST_Widget2", price=15.0)
    r = s.put(f"{API}/products/{pid}", json=upd)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Widget2"

    # Delete
    r = s.delete(f"{API}/products/{pid}")
    assert r.status_code == 200
    r = s.get(f"{API}/products/{pid}")
    assert r.status_code == 404


# ---------------- Leads / qualify ----------------
def test_leads_sorted_by_priority(s):
    r = s.get(f"{API}/leads")
    assert r.status_code == 200
    leads = r.json()
    assert isinstance(leads, list)
    if len(leads) >= 2:
        prios = [l["priority"] for l in leads]
        assert prios == sorted(prios, reverse=True), "leads not sorted by priority desc"


def test_qualify_high_value_creates_lead(s):
    msg = "Hi, we're an enterprise treasury team looking to settle ~$95,000/month in XUSD via API. Urgent."
    r = s.post(f"{API}/qualify", json={"text": msg, "name": "TEST_Enterprise", "source": "test"})
    assert r.status_code == 200
    body = r.json()
    q = body["qualification"]
    for k in ("intent_score", "budget_signal", "product_fit", "urgency", "deal_value_est",
              "sentiment", "needs_escalation", "summary", "suggested_reply",
              "recommended_product_ids", "priority"):
        assert k in q, f"missing key {k}"
    assert q["deal_value_est"] > 0
    assert 0 <= q["priority"] <= 200
    lead = body["lead"]
    assert lead["name"] == "TEST_Enterprise"
    assert "_id" not in lead

    # Verify persisted
    r = s.get(f"{API}/leads/{lead['id']}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["lead"]["id"] == lead["id"]
    assert any(m["text"] == msg for m in detail["messages"])


@pytest.mark.parametrize("kind", ["high_value", "frustrated", "low_intent", "purchase"])
def test_simulate(s, kind):
    r = s.post(f"{API}/simulate/{kind}")
    assert r.status_code == 200
    body = r.json()
    q = body["qualification"]
    lead = body["lead"]
    if kind == "frustrated":
        assert q["sentiment"] == "frustrated", f"expected frustrated sentiment got {q['sentiment']}"
        assert q["needs_escalation"] is True


def test_lead_reply_advances_status(s):
    # Create lead via qualify
    r = s.post(f"{API}/qualify", json={"text": "Need running shoes under $100, ready to buy", "name": "TEST_Reply"})
    lead = r.json()["lead"]
    lid = lead["id"]
    initial_status = lead["status"]

    # Reply
    r = s.post(f"{API}/leads/{lid}/reply", json={"text": "Hello, here are some options."})
    assert r.status_code == 200
    updated = r.json()
    assert updated["first_response_at"] is not None
    if initial_status in ("new", "qualifying"):
        assert updated["status"] == "negotiating"

    # Verify message stored
    r = s.get(f"{API}/leads/{lid}")
    msgs = r.json()["messages"]
    assert any(m["sender"] == "rep" for m in msgs)


def test_lead_status_patch(s):
    r = s.post(f"{API}/qualify", json={"text": "interested in headphones", "name": "TEST_Status"})
    lid = r.json()["lead"]["id"]
    r = s.patch(f"{API}/leads/{lid}/status", json={"status": "won"})
    assert r.status_code == 200
    r = s.get(f"{API}/leads/{lid}")
    assert r.json()["lead"]["status"] == "won"


def test_lead_404(s):
    r = s.get(f"{API}/leads/{uuid.uuid4()}")
    assert r.status_code == 404


# ---------------- Metrics ----------------
def test_metrics(s):
    r = s.get(f"{API}/metrics")
    assert r.status_code == 200
    d = r.json()
    assert "before" in d and "after" in d
    for blk in (d["before"], d["after"]):
        assert "avg_wait" in blk and "handled" in blk and "conversion" in blk


# ---------------- Chat / commerce ----------------
@pytest.fixture(scope="session")
def chat_session():
    return f"test_session_{uuid.uuid4().hex[:8]}"


def test_chat_purchase_intent(s, chat_session):
    r = s.post(f"{API}/chat", json={"session_id": chat_session,
                                    "message": "running shoes under $100"})
    assert r.status_code == 200
    d = r.json()
    assert d["reply"]
    assert isinstance(d["products"], list)
    assert len(d["products"]) >= 1  # purchase intent should return products

    # History hydrated
    r = s.get(f"{API}/chat/{chat_session}")
    assert r.status_code == 200
    msgs = r.json()
    assert len(msgs) >= 2
    ai_msgs = [m for m in msgs if m["sender"] == "ai"]
    assert any(m.get("product_cards") for m in ai_msgs), "expected product_cards hydrated"


# ---------------- Wallet & Orders ----------------
def test_wallet_auto_create_and_topup(s):
    sess_id = f"test_wallet_{uuid.uuid4().hex[:8]}"
    r = s.get(f"{API}/wallet", params={"session_id": sess_id})
    assert r.status_code == 200
    w = r.json()["wallet"]
    assert w["balance"] == 5000.0

    r = s.post(f"{API}/wallet/topup", json={"session_id": sess_id, "amount": 250})
    assert r.status_code == 200
    assert r.json()["balance"] == 5250.0


def test_order_with_wallet(s):
    sess_id = f"test_order_{uuid.uuid4().hex[:8]}"
    # ensure wallet created at 5000
    s.get(f"{API}/wallet", params={"session_id": sess_id})
    # pick a product
    prods = s.get(f"{API}/products").json()
    p = prods[0]
    order_payload = {
        "session_id": sess_id,
        "items": [{"id": p["id"], "name": p["name"], "price": p["price"], "qty": 1}],
        "address": "1 Test Lane",
        "payment_method": "wallet",
    }
    r = s.post(f"{API}/orders", json=order_payload)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "placed"
    assert order["total"] == p["price"]

    # Wallet decremented
    w = s.get(f"{API}/wallet", params={"session_id": sess_id}).json()["wallet"]
    assert w["balance"] == round(5000.0 - p["price"], 2)

    # Status update
    r = s.patch(f"{API}/orders/{order['id']}/status", json={"status": "shipped"})
    assert r.status_code == 200


def test_order_insufficient_balance(s):
    sess_id = f"test_poor_{uuid.uuid4().hex[:8]}"
    s.get(f"{API}/wallet", params={"session_id": sess_id})
    payload = {
        "session_id": sess_id,
        "items": [{"id": "x", "name": "Expensive", "price": 99999, "qty": 1}],
        "address": "x",
        "payment_method": "wallet",
    }
    r = s.post(f"{API}/orders", json=payload)
    assert r.status_code == 400


# ---------------- Admin ----------------
def test_admin_analytics(s):
    r = s.get(f"{API}/admin/analytics")
    assert r.status_code == 200
    d = r.json()
    for k in ("orders", "revenue", "active_users", "conversion"):
        assert k in d


def test_admin_chat_logs(s):
    r = s.get(f"{API}/admin/chat-logs")
    assert r.status_code == 200
    d = r.json()
    assert "messages" in d and "escalations" in d


# ---------------- Telegram ----------------
def test_telegram_wrong_secret(s):
    r = s.post(f"{API}/telegram/webhook/wrong-secret", json={"message": {"text": "hi"}})
    assert r.status_code == 403
