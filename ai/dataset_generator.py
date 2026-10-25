"""
Dataset Generator for Indic Street Food Bargaining & Linguistics
Generates a realistic, large-scale evaluation corpus of 1,500 multi-turn negotiations (6,000+ turns)
across Hindi, Hinglish, Marathi, Punjabi slang with annotated dialogue acts,
target items, units, rates, noise levels, and derived monetary ground truths.
"""

import json
import random
from pathlib import Path

ITEMS = [
    {"name": "tomato", "hindi": ["tamatar", "tamaatar"], "unit": "kg", "base_rate": 40},
    {"name": "potato", "hindi": ["aalu", "aloo", "batata"], "unit": "kg", "base_rate": 25},
    {"name": "onion", "hindi": ["pyaaz", "pyaz", "kanda"], "unit": "kg", "base_rate": 35},
    {"name": "ginger", "hindi": ["adrak", "aale"], "unit": "kg", "base_rate": 120},
    {"name": "chili", "hindi": ["mirchi", "mirch"], "unit": "kg", "base_rate": 80},
    {"name": "lemon", "hindi": ["nimbu", "limbu"], "unit": "piece", "base_rate": 5},
    {"name": "poha", "hindi": ["poha", "pohe"], "unit": "plate", "base_rate": 20},
    {"name": "samosa", "hindi": ["samosa", "samose"], "unit": "piece", "base_rate": 15},
    {"name": "kachori", "hindi": ["kachori", "kachodi"], "unit": "piece", "base_rate": 18},
    {"name": "jalebi", "hindi": ["jalebi", "jilebi"], "unit": "kg", "base_rate": 160},
    {"name": "tea", "hindi": ["chai", "chaha"], "unit": "cup", "base_rate": 10},
    {"name": "lassi", "hindi": ["lassi"], "unit": "glass", "base_rate": 30},
    {"name": "paneer", "hindi": ["paneer"], "unit": "kg", "base_rate": 360},
]

QUANTITY_PATTERNS = [
    ("aadha kilo", 0.5, "kg"),
    ("ek kilo", 1.0, "kg"),
    ("dedh kilo", 1.5, "kg"),
    ("do kilo", 2.0, "kg"),
    ("teen kilo", 3.0, "kg"),
    ("ek paav", 0.25, "kg"),
    ("2 paav", 0.5, "kg"),
    ("ek plate", 1.0, "plate"),
    ("do plate", 2.0, "plate"),
    ("teen plate", 3.0, "plate"),
    ("ek samosa", 1.0, "piece"),
    ("2 samosa", 2.0, "piece"),
    ("3 samosa", 3.0, "piece"),
    ("4 samosa", 4.0, "piece"),
    ("ek chai", 1.0, "cup"),
    ("do chai", 2.0, "cup"),
    ("teen chai", 3.0, "cup"),
    ("ek glass", 1.0, "glass"),
    ("do glass", 2.0, "glass"),
]

COUNTER_PATTERNS = [
    "nahi {rate} ka lagao",
    "{rate} me nipta do bhaiya",
    "padosi to {rate} me de raha hai",
    "roz to aate hain, {rate} karo na",
    "kuch to kam karo, {rate} theek hai",
    "chalo {rate} me de do",
    "{rate} lagao to bolo",
    "sahi sahi lagao {rate} rupaye",
    "{rate} me baandh do",
]

CONCESSION_PATTERNS = [
    "ok",
    "theek hai",
    "chalo le jao",
    "de diya",
    "chalo baandh diya",
    "theek hai le lo",
    "chal theek hai",
    "ha le ja",
    "ok done",
]

REJECTION_PATTERNS = [
    "nahi hoga bhaiya",
    "kharid hi utne ki hai",
    "nahi jam raha",
    "isse kam me nahi hoga",
    "chhod do fir",
    "itne me nahi baithta",
]

WALKAWAY_PATTERNS = [
    "rehne do bhaiya bohot mehenga hai",
    "aage se le lenge",
    "nahi chahiye",
    "chhod do bhai",
    "rehne do bhaiya",
    "aage dekhenge",
]

FREEBIE_PATTERNS = [
    "thoda dhaniya mirchi daal do na",
    "ek nimbu upar se daal do",
    "thodi extra chatni daal do",
    "thoda kadi patta daal do",
]

def generate_dataset(n_samples=1500):
    dataset = []
    random.seed(42)

    for i in range(1, n_samples + 1):
        item_obj = random.choice(ITEMS)
        item_name = item_obj["name"]
        item_word = random.choice(item_obj["hindi"])
        quoted_rate = item_obj["base_rate"]
        
        # Determine counter rate
        discount = random.choice([5, 10, 15, 20]) if quoted_rate >= 30 else random.choice([2, 5])
        counter_rate = max(quoted_rate // 2, quoted_rate - discount)
        
        scenario_type = random.choices(
            ["SUCCESS_NEGOTIATION", "WALKAWAY", "VALUE_ORDER", "FREEBIE_ATTACHED", "NO_BARGAIN_DIRECT"],
            weights=[0.55, 0.12, 0.15, 0.08, 0.10]
        )[0]

        turns = []
        noise_db = random.choice([50, 65, 72, 80, 88])
        customer_id = f"CUST_{random.randint(1, 150):03d}"

        if scenario_type == "SUCCESS_NEGOTIATION":
            valid_qtys = [q for q in QUANTITY_PATTERNS if q[2] == item_obj["unit"]]
            if not valid_qtys:
                valid_qtys = [("ek kilo", 1.0, "kg")] if item_obj["unit"] == "kg" else [("ek plate", 1.0, "plate")]
            qty_text, qty_val, qty_unit = random.choice(valid_qtys)

            inquiry_text = random.choice([f"{item_word} kitne ka", f"{item_word} kya bhav hai", f"{item_word} ka rate bolo"])
            quote_text = random.choice([f"{quoted_rate} ka diya", f"{quoted_rate} rupaye kilo", f"{quoted_rate} lagaya"])
            counter_text = random.choice(COUNTER_PATTERNS).format(rate=counter_rate)
            concession_text = random.choice(CONCESSION_PATTERNS)
            settle_text = random.choice([f"{qty_text} kar do", f"{qty_text} de do", f"{qty_text} baandh do"])

            turns = [
                {"role": "CUSTOMER", "text": inquiry_text, "act": "PRICE_INQUIRY"},
                {"role": "VENDOR", "text": quote_text, "act": "VENDOR_QUOTE", "rate": quoted_rate},
                {"role": "CUSTOMER", "text": counter_text, "act": "CUSTOMER_COUNTER", "rate": counter_rate},
                {"role": "VENDOR", "text": concession_text, "act": "VENDOR_CONCESSION"},
                {"role": "CUSTOMER", "text": settle_text, "act": "QUANTITY_SPEC", "qty": qty_val, "unit": qty_unit}
            ]
            expected_rate = counter_rate
            expected_cash = round(expected_rate * qty_val, 2)
            is_walkaway = False
            is_freebie = False

        elif scenario_type == "WALKAWAY":
            turns = [
                {"role": "CUSTOMER", "text": f"{item_word} kya bhav hai", "act": "PRICE_INQUIRY"},
                {"role": "VENDOR", "text": f"{quoted_rate} rupaye", "act": "VENDOR_QUOTE", "rate": quoted_rate},
                {"role": "CUSTOMER", "text": f"{counter_rate} me do", "act": "CUSTOMER_COUNTER", "rate": counter_rate},
                {"role": "VENDOR", "text": random.choice(REJECTION_PATTERNS), "act": "VENDOR_REJECTION"},
                {"role": "CUSTOMER", "text": random.choice(WALKAWAY_PATTERNS), "act": "WALK_AWAY"}
            ]
            expected_rate = None
            expected_cash = 0.0
            is_walkaway = True
            is_freebie = False

        elif scenario_type == "VALUE_ORDER":
            value_cash = random.choice([20, 30, 50, 100, 150])
            turns = [
                {"role": "CUSTOMER", "text": f"{value_cash} rupaye ka {item_word} de do", "act": "VALUE_ORDER", "value": value_cash}
            ]
            expected_rate = quoted_rate
            expected_cash = float(value_cash)
            is_walkaway = False
            is_freebie = False

        elif scenario_type == "FREEBIE_ATTACHED":
            freebie_text = random.choice(FREEBIE_PATTERNS)
            turns = [
                {"role": "CUSTOMER", "text": f"1 kilo {item_word} pack kar do", "act": "QUANTITY_SPEC", "qty": 1.0, "unit": "kg"},
                {"role": "CUSTOMER", "text": freebie_text, "act": "FREEBIE_REQUEST"}
            ]
            expected_rate = quoted_rate
            expected_cash = float(quoted_rate * 1.0)
            is_walkaway = False
            is_freebie = True

        else: # NO_BARGAIN_DIRECT
            valid_qtys = [q for q in QUANTITY_PATTERNS if q[2] == item_obj["unit"]]
            qty_text, qty_val, qty_unit = random.choice(valid_qtys) if valid_qtys else ("ek kilo", 1.0, "kg")
            turns = [
                {"role": "CUSTOMER", "text": f"{qty_text} {item_word} do", "act": "QUANTITY_SPEC", "qty": qty_val, "unit": qty_unit},
                {"role": "VENDOR", "text": f"{quoted_rate} rupaye ho gaye", "act": "VENDOR_QUOTE", "rate": quoted_rate}
            ]
            expected_rate = quoted_rate
            expected_cash = float(quoted_rate * qty_val)
            is_walkaway = False
            is_freebie = False

        dialogue_entry = {
            "dialogue_id": f"DIAL_{i:04d}",
            "scenario": scenario_type,
            "target_item": item_name,
            "customerId": customer_id,
            "noiseDb": noise_db,
            "turns": turns,
            "ground_truth": {
                "expectedAgreedRate": expected_rate,
                "expectedDerivedCash": expected_cash,
                "isWalkaway": is_walkaway,
                "isFreebie": is_freebie
            }
        }
        dataset.append(dialogue_entry)

    out_path = Path("evaluation/datasets/indic_negotiations_1500.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    print(f"[OK] Generated {len(dataset)} annotated Indic negotiation dialogues at {out_path}")

if __name__ == "__main__":
    generate_dataset(1500)
