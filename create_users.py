"""
Seed users.json with fictional demo accounts.

Everything here is invented test data for a portfolio build:

  * Routing numbers deliberately FAIL the ABA checksum, so they cannot
    correspond to any real institution.
  * Card numbers are the payment networks' published test numbers
    (4111..., 5555..., etc). They are not valid for any transaction.
  * CVVs are placeholders. Real systems must never store a CVV at all —
    PCI-DSS forbids it. These exist only so the card widget has
    something to reveal.

Run:  python create_users.py
"""

import json
import os
from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_FILE = os.path.join(BASE_DIR, "users.json")


def aba_checksum_valid(rn: str) -> bool:
    d = [int(c) for c in rn]
    total = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])
    return total % 10 == 0


USERS = [
    ("jdoe",            "password123",  "Johnathan Doe",                "483920174", "123456789", 74210.00,  "Personal Checking", "Platinum",  "4111111111111111", "09/29"),
    ("asimmons",        "mysecurepass", "Alicia Simmons",               "602348291", "111111111", 51234.00,  "Personal Checking", "Gold",      "4012888888881881", "03/28"),
    ("mcollins",        "collins2024",  "Michael Collins",              "208674553", "222222222", 28790.00,  "Personal Savings",  "Standard",  "5555555555554444", "11/27"),
    ("lchow",           "lydia88",      "Lydia Chow",                   "758403219", "333333333", 66840.00,  "Personal Checking", "Gold",      "5105105105105100", "06/29"),
    ("urbanholdings",   "urban123",     "Urban Holdings Ltd",           "304918273", "444444444", 735000.00, "Business Checking", "Corporate", "378282246310005",  "01/30"),
    ("zenithcapital",   "zenith123",    "Zenith Capital Group",         "849302716", "555555555", 621000.00, "Business Checking", "Corporate", "6011111111111117", "08/28"),
    ("apexinnovations", "apex123",      "Apex Innovations LLC",         "507384920", "666666666", 495000.00, "Business Checking", "Corporate", "4111111111111111", "02/29"),
    ("empiretrust",     "empire123",    "Empire Trust Partners",        "120948375", "777777777", 812000.00, "Business Checking", "Corporate", "5555555555554444", "12/28"),
    ("novaindustries",  "nova123",      "Nova Industries Corp",         "730194826", "888888888", 534000.00, "Business Checking", "Corporate", "4012888888881881", "07/29"),
    ("silverline",      "silver123",    "Silverline Global Investments","894203571", "999999999", 259000.00, "Business Checking", "Corporate", "5105105105105100", "05/30"),
]


def build():
    out = []
    for (username, password, name, acct, routing,
         balance, acct_type, tier, card_no, expiry) in USERS:

        assert not aba_checksum_valid(routing), (
            "Routing {} passes the ABA checksum — pick a number that fails it "
            "so it cannot match a real bank.".format(routing)
        )

        out.append({
            "username": username,
            "password": generate_password_hash(password),
            "fullname": name,
            "full_name": name,
            "account_number": acct,
            "routing_number": routing,
            "balance": balance,
            "email": "{}@example.com".format(username),
            "date_joined": "2023-01-15",
            "account_type": acct_type,
            "status": "Active",
            "client_tier": tier,
            "card": {"number": card_no, "expiry": expiry, "cvv": "000"},
            "last_login": "",
        })
    return out


if __name__ == "__main__":
    users = build()
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)
    print("Wrote {} demo accounts to {}".format(len(users), USERS_FILE))
    print("All routing numbers fail the ABA checksum. All cards are network test numbers.")
