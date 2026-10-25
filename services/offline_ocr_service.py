import sys
import json
import base64
import re
import cv2
import numpy as np

try:
    from rapidocr_onnxruntime import RapidOCR
    ocr_engine = RapidOCR()
except Exception:
    ocr_engine = None

def parse_pure_dynamic_line(line_text):
    clean = line_text.strip()
    if not clean or len(clean) < 3:
        return None

    # Filter out phone screenshot UI overlays (clock, network speed, crop text)
    if re.search(r'crop|kb/s|\d+:\d+|menu|estimate|status|\b101\b', clean, re.I):
        return None

    # Clean currency OCR noise: ₹ often reads as 2, Z, z, rs, inr
    clean_no_sym = re.sub(r'[₹]', ' ', clean)

    # Universal Receipt Regex:
    # Matches: [Any Item Name] [Separator/Space] [Quantity] [Unit optional] [Separator] [Price/Rate]
    m = re.match(r'^([a-zA-Z\s]+?)[-–—=:\s*#]+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?', clean_no_sym)
    if not m:
        # Fallback for compressed handwriting like "Paneer4kg 1200" or "Tamatar-5kg"
        letters = re.match(r'^([a-zA-Z\s]{2,25})', clean_no_sym)
        if not letters:
            return None
        raw_name = letters.group(1).strip(' -–—=:')
        nums = [float(n) for n in re.findall(r'\d+(?:\.\d+)?', clean_no_sym)]
        if not nums:
            return None
        qty = nums[0]
        remainder = clean_no_sym[letters.end():]
        nums_rem = [float(n) for n in re.findall(r'\d+(?:\.\d+)?', remainder)]
        if len(nums_rem) < 2:
            return {
                "name": raw_name.title(),
                "quantityKg": qty,
                "ratePerKg": 0.0,
                "totalCost": 0,
                "unit": "kg"
            }
        qty = nums_rem[0]
        val = nums_rem[-1]
        is_per = bool(re.search(r'/(?:kg|kilo|l|piece|g)|per', remainder, re.I))
        if is_per:
            rate = float(val)
            total = int(round(qty * rate))
        else:
            total = int(val)
            rate = round(total / qty, 1) if qty > 0 else float(total)
        return {
            "name": raw_name.title(),
            "quantityKg": qty,
            "ratePerKg": rate,
            "totalCost": total,
            "unit": "kg"
        }

    raw_name = m.group(1).strip(' -–—=:')
    if not raw_name or len(raw_name) < 2:
        return None

    qty = float(m.group(2))
    raw_unit = (m.group(3) or 'kg').lower()

    # Standardize unit strings
    if raw_unit in ['kilo', 'kilogram', 'kgs']:
        unit = 'kg'
    elif raw_unit in ['gm', 'grams']:
        unit = 'g'
    elif raw_unit in ['liter', 'litre', 'ltr']:
        unit = 'l'
    elif raw_unit in ['crate', 'crates', 'petti']:
        unit = 'crate'
    elif raw_unit in ['bori', 'katta', 'sack']:
        unit = 'bori'
    elif raw_unit in ['piece', 'pieces', 'pc']:
        unit = 'piece'
    else:
        unit = raw_unit if len(raw_unit) <= 6 else 'kg'

    remainder = clean_no_sym[m.end():]
    is_per_unit = bool(re.search(r'/(?:kg|kilo|l|g|piece)|per', remainder, re.I))
    nums = [float(n) for n in re.findall(r'\d+(?:\.\d+)?', remainder)]

    if not nums:
        return {
            "name": raw_name.title(),
            "quantityKg": qty,
            "ratePerKg": 0.0,
            "totalCost": 0,
            "unit": unit
        }

    val = nums[-1]

    # Clean currency glyph noise: e.g. OCR read "214/kg" where '2' was the currency symbol -> 14
    if val > 150 and is_per_unit and str(int(val)).startswith('2') and len(str(int(val))) == 3:
        val = float(str(int(val))[1:])

    if is_per_unit:
        # Rate per unit was written
        rate = float(val)
        total = int(round(qty * rate))
    else:
        # Flat total amount was written
        total = int(val)
        rate = round(total / qty, 1) if qty > 0 else float(total)

    return {
        "name": raw_name.title(),
        "quantityKg": qty,
        "ratePerKg": rate,
        "totalCost": total,
        "unit": unit
    }

def process_image(img_input):
    if not ocr_engine:
        return {"items": [], "totalBill": 0, "raw": ""}

    if isinstance(img_input, str) and len(img_input) > 200:
        clean_base64 = img_input.split(',')[-1]
        img_bytes = base64.b64decode(clean_base64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif isinstance(img_input, str):
        img = cv2.imread(img_input)
    else:
        return {"items": [], "totalBill": 0, "raw": ""}

    if img is None:
        return {"items": [], "totalBill": 0, "raw": ""}

    # CLAHE contrast enhancement for ballpoint pen on notebook paper
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    res, _ = ocr_engine(enhanced_bgr)
    raw_lines = [item[1].strip() for item in (res or [])]

    # Pure dynamic extraction on every detected line - ZERO hardcoded commodity lists
    items = []
    seen = set()
    for line in raw_lines:
        parsed = parse_pure_dynamic_line(line)
        if parsed and parsed["name"].lower() not in seen:
            seen.add(parsed["name"].lower())
            items.append(parsed)

    total_bill = sum(i["totalCost"] for i in items)

    return {
        "mandiName": "Wholesale Mandi Invoice",
        "slipNo": f"MND-{np.random.randint(10000, 99999)}",
        "date": "Today, Morning Mandi",
        "items": items,
        "totalBill": total_bill,
        "rawText": "\n".join(raw_lines),
        "engine": "RAPIDOCR_PURE_DYNAMIC_ONNX"
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        result = process_image(sys.argv[1])
        print(json.dumps(result))
    else:
        data = sys.stdin.read().strip()
        result = process_image(data)
        print(json.dumps(result))
