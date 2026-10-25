"""
Dataset Generator for Indic Street Food Bargaining & Linguistics
Generates a realistic, highly diverse evaluation corpus of 150 multi-turn negotiations
across Hindi, Hinglish, Marathi, and street slang with annotated dialogue acts,
target items, units, rates, noise levels, and derived monetary ground truths.
"""

import json
import random
from pathlib import Path

ITEMS = [
    {"name": "tomato", "hindi": ["tamatar", "tamaatar"], "unit": "kg", "base_rate": 40},
    {"name": "potato", "hindi": ["aalu", "aloo"], "unit": "kg", "base_rate": 25},
    {"name": "onion", "hindi": ["pyaaz", "pyaz", "kanda"], "unit": "kg", "base_rate": 35},
    {"name": "poha", "hindi": ["poha", "pohe"], "unit": "plate", "base_rate": 20},
    {"name": "samosa", "hindi": ["samosa", "samose"], "unit": "piece", "base_rate": 15},
    {"name": "tea", "hindi": ["chai", "chaha"], "unit": "cup", "base_rate": 10},
]

QUANTITY_PATTERNS = [
    ("aadha kilo", 0.5, "kg"),
    ("ek kilo", 1.0, "kg"),
    ("dedh kilo", 1.5, "kg"),
    ("do kilo", 2.0, "kg"),
    ("ek paav", 0.25, "kg"),
    ("2 paav", 0.5, "kg"),
    ("do plate", 2.0, "plate"),
    ("ek plate", 1.0, "plate"),
    ("3 samosa", 3.0, "piece"),
    ("do chai", 2.0, "cup"),
]

COUNTER_PATTERNS = [
    "nahi {rate} ka lagao",
    "{rate} me nipta do bhaiya",
    "padosi to {rate} me de raha hai",
    "roz to aate hain, {rate} karo na",
    "kuch to kam karo, {rate} theek hai",
    "chalo {rate} me de do",
]

CONCESSION_PATTERNS = [
    "ok",
    "theek hai",
    "chalo le jao",
    "de diya",
    "chalo baandh diya",
    "theek hai le lo",
]

REJECTION_PATTERNS = [
    "nahi hoga bhaiya",
    "kharid hi utne ki hai",
    "nahi jam raha",
    "isse kam me nahi hoga",
    "chhod do fir",
]

WALKAWAY_PATTERNS = [
    "rehne do bhaiya bohot mehenga hai",
    "aage se le lenge",
    "nahi chahiye",
    "chhod do bhai",
]

FREEBIE_PATTERNS = [
    "thoda dhaniya mirchi daal do na",
    "ek nimbu upar se daal do",
    "thodi extra chatni daal do",
]

def generate_dataset(n_samples=150):
    dataset = []
    random.seed(42)

    for i in range(1, n_samples + 1):
        item_obj = random.choice(ITEMS)
        item_name = item_obj["name"]
        item_word = random.choice(item_obj["hindi"])
        quoted_rate = item_obj["base_rate"]
        counter_rate = max(5, quoted_rate - random.choice([5, 10, 15]))
        
        scenario_type = random.choices(
            ["SUCCESS_NEGOTIATION", "WALKAWAY", "VALUE_ORDER", "FREEBIE_ATTACHED", "NO_BARGAIN_DIRECT"],
            weights=[0.50, 0.15, 0.15, 0.10, 0.10]
        )[0]

        turns = []
        noise_db = random.choice([50, 65, 72, 80, 88])
        customer_id = f"CUST_{random.randint(1, 40):02d}"

        if scenario_type == "SUCCESS_NEGOTIATION":
            qty_text, qty_val, qty_unit = random.choice(QUANTITY_PATTERNS)
            if item_obj["unit"] == "kg" and qty_unit != "kg":
                qty_text, qty_val, qty_unit = ("aadha kilo", 0.5, "kg")

            turns = [
                {"role": "CUSTOMER", "text": f"{item_word} kitne ka", "act": "PRICE_INQUIRY"},
                {"role": "VENDOR", "text": f"{quoted_rate} ka diya", "act": "VENDOR_QUOTE", "rate": quoted_rate},
                {"role": "CUSTOMER", "text": random.choice(COUNTER_PATTERNS).format(rate=counter_rate), "act": "CUSTOMER_COUNTER", "rate": counter_rate},
                {"role": "VENDOR", "text": random.choice(CONCESSION_PATTERNS), "act": "VENDOR_CONCESSION"},
                {"role": "CUSTOMER", "text": f"{qty_text} kar do", "act": "QUANTITY_SPEC", "qty": qty_val, "unit": qty_unit}
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
            value_cash = random.choice([20, 30, 50, 100])
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
            qty_text, qty_val, qty_unit = ("ek kilo", 1.0, "kg") if item_obj["unit"] == "kg" else ("ek plate", 1.0, "plate")
            turns = [
                {"role": "CUSTOMER", "text": f"{qty_text} {item_word} do", "act": "QUANTITY_SPEC", "qty": qty_val, "unit": qty_unit},
                {"role": "VENDOR", "text": f"{quoted_rate} rupaye ho gaye", "act": "VENDOR_QUOTE", "rate": quoted_rate}
            ]
            expected_rate = quoted_rate
            expected_cash = float(quoted_rate * qty_val)
            is_walkaway = False
            is_freebie = False

        dialogue_entry = {
            "dialogue_id": f"DIAL_{i:03d}",
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

    out_path = Path("evaluation/datasets/indic_negotiations_150.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    print(f"[OK] Generated {len(dataset)} annotated Indic negotiation dialogues at {out_path}")

if __name__ == "__main__":
    generate_dataset()
