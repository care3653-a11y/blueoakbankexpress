"""
Seed a richer fictional transaction history so the dashboard chart has
something to show. Deterministic (fixed seed) so runs are reproducible.

All of this is invented demo data for a portfolio build.
"""

import json
import os
import random
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))
USERS_FILE = os.path.join(BASE, "users.json")
TX_FILE = os.path.join(BASE, "transactions.json")

random.seed(20251026)

users = json.load(open(USERS_FILE, encoding="utf-8"))
by_name = {u["username"]: u for u in users}
existing = json.load(open(TX_FILE, encoding="utf-8"))

PRIMARY = "jhaynes"
COUNTERPARTIES = [u["username"] for u in users if u["username"] != PRIMARY]

INCOME = [
    ("Payroll deposit", 8200, 9600),
    ("Client settlement", 3200, 7400),
    ("Dividend distribution", 900, 2600),
    ("Expense reimbursement", 240, 980),
]
SPEND = [
    ("Automated bill", 120, 460),
    ("Card payment", 45, 320),
    ("Wage bill", 900, 1800),
    ("Vendor invoice", 600, 2400),
    ("Insurance premium", 180, 540),
    ("Utilities", 90, 240),
    ("Rent", 2100, 2100),
]

END = datetime(2025, 10, 26)
START = END - timedelta(days=182)   # ~6 months back, fills the chart window

rows = []


def stamp(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")


day = START
while day <= END:
    # Salary lands near the start of each month
    if day.day in (2, 3):
        label, lo, hi = INCOME[0]
        rows.append({
            "from": random.choice(COUNTERPARTIES),
            "to": PRIMARY,
            "amount": float(round(random.uniform(lo, hi), 2)),
            "purpose": label,
            "timestamp": stamp(day.replace(hour=random.randint(7, 10),
                                           minute=random.randint(0, 59))),
            "type": "transfer",
            "status": "completed",
            "routing_number": by_name[PRIMARY]["routing_number"],
        })

    # Occasional other income
    if random.random() < 0.10:
        label, lo, hi = random.choice(INCOME[1:])
        rows.append({
            "from": random.choice(COUNTERPARTIES),
            "to": PRIMARY,
            "amount": float(round(random.uniform(lo, hi), 2)),
            "purpose": label,
            "timestamp": stamp(day.replace(hour=random.randint(9, 17),
                                           minute=random.randint(0, 59))),
            "type": "transfer",
            "status": "completed",
            "routing_number": by_name[PRIMARY]["routing_number"],
        })

    # Outgoings, a few per week
    for _ in range(random.choice([0, 0, 1, 1, 2])):
        label, lo, hi = random.choice(SPEND)
        cp = random.choice(COUNTERPARTIES)
        rows.append({
            "from": PRIMARY,
            "to": cp,
            "amount": float(round(random.uniform(lo, hi), 2)),
            "purpose": label,
            "timestamp": stamp(day.replace(hour=random.randint(8, 21),
                                           minute=random.randint(0, 59))),
            "type": "transfer",
            "status": "completed",
            "routing_number": by_name[cp]["routing_number"],
        })

    day += timedelta(days=1)

# Keep the original hand-made entries; they include the flagged-review case.
combined = rows + [t for t in existing if isinstance(t, dict)]
combined.sort(key=lambda t: t.get("timestamp", ""), reverse=True)

json.dump(combined, open(TX_FILE, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

inflow = sum(t["amount"] for t in combined if t.get("to") == PRIMARY)
outflow = sum(t["amount"] for t in combined if t.get("from") == PRIMARY)
print("wrote {} transactions".format(len(combined)))
print("  in : {:,.2f}".format(inflow))
print("  out: {:,.2f}".format(outflow))
print("  net: {:,.2f}".format(inflow - outflow))
