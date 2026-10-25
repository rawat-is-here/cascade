# Team Cascade: Remaining Integration & Demo Tasks
**Project:** The Invisible Worker — 100% Offline Probabilistic Ledger  
**Branch:** `main`  
**Updated:** October 2026  

---

## 1. Executive Status Overview

| Domain | Owner | Status | Notes |
| :--- | :--- | :---: | :--- |
| **AI, Algorithms & Perception** | **User / Kushal** | **100% COMPLETE** | All 6 phases verified; ECAPA-TDNN ONNX & Qwen GGUF connected; zero pre-set prices; decoupled math enforced. |
| **Backend & Routing** | **Akash** | **~75% COMPLETE** | Express server and legacy endpoints functional; need to expose the 3 continuous SLM endpoints. |
| **Database & Durability** | **Aryan** | **~80% COMPLETE** | SQLite WAL schema & HLC logic complete (`init_db.sql`); need to bind speech transcript buffer. |
| **Mobile Frontend** | **Manthan** | **~70% COMPLETE** | Core screens, modals, and baseline panels written; need to wire them into the main `App.tsx` flow. |
| **Live Pitch / Demo** | **Whole Team** | **READY TO REHEARSE** | 4-step script defined covering morning bill, daytime acoustic filtering, night EOD pass, and sabotage. |

---

## 2. Backend Tasks (Akash — `server/src/routes/vendor.ts`)

Wire 3 REST endpoints to connect the Node.js / Express backend to the new continuous core:

- [ ] **Task B1: Morning Mandi Bill Ingestion Endpoint**
  - **Route:** `POST /api/wholesale/bill`
  - **Body:** `{ items: [{ name: "potato", qtyKg: 50, ratePerKg: 14 }, { name: "tomato", qtyKg: 20, ratePerKg: 22 }] }`
  - **Logic:** Call `WholesaleCostManager.ingestMorningBill()`. Automatically applies the 10% spice/fuel overhead and posts zero-prior initial inventory.
  
- [ ] **Task B2: Dual Acoustic-Digital UPI Cross-Validation Endpoint**
  - **Route:** `POST /api/upi/event`
  - **Body:** `{ type: "SOUNDBOX_CHIME" | "APP_NOTIFICATION", amount: number, timestampMs: number, appName?: string }`
  - **Logic:** Call `DualUPICrossValidator.recordChime()` or `recordNotification()`. Automatically routes confirmed sales to `Revenue:Sales`, personal transfers to `Equity:OwnerPersonalCapital`, and quarantines neighbor soundbox chimes.

- [ ] **Task B3: Night EOD Qwen Batch Pass Endpoint**
  - **Route:** `POST /api/eod/reconcile-batch`
  - **Body:** `{ physicalClosingCash: number, openingFloat?: number }`
  - **Logic:** Trigger `QwenEODBatchInterpreter.reconcileDayBatch(transcripts, wholesaleCosts, physicalCash)`. Returns the gross profit report, dynamically discovered retail rates, and drawer slack attribution.

---

## 3. Database Tasks (Aryan — `server/src/db/`)

Connect the continuous streaming perception pipeline to Aryan's SQLite WAL database:

- [ ] **Task D1: Persist Daily Speech Transcripts**
  - Bind `unified_audio_stream.ts` transcript emissions to the `raw_evidence` table in SQLite WAL.
  - Required columns: `evidence_id`, `evidence_type = 'AUDIO_SPEECH_TRANSCRIPT'`, `payload_json = { speaker, text, timestamp }`, `hlc_wall_ms`.
  - Ensures conversations survive app background kills and can be queried in a single batch pass at night.

- [ ] **Task D2: Persist Wholesale Cost Basis**
  - Ingest the morning Mandi batch into the `inventory_state` table so cost-per-kg records are stored locally for COGS calculation.

- [ ] **Task D3: Test Offline HLC Recovery**
  - Verify that a database reload under a simulated dead battery (`1970-01-01`) preserves Lamport monotonic causal ordering.

---

## 4. Mobile Frontend Tasks (Manthan — `mobile/`)

Glue the UI components into [`mobile/App.tsx`](file:///c:/Csc/cascade/mobile/App.tsx) for a seamless vendor experience:

- [ ] **Task F1: Mount EOD Reconciliation Modal**
  - Hook [`mobile/components/EODReconciliationModal.tsx`](file:///c:/Csc/cascade/mobile/components/EODReconciliationModal.tsx) to an "End Day Settlement" button in `App.tsx`.
  - Allow the vendor to enter physical cash drawer count and see the gross profit breakdown.

- [ ] **Task F2: Mandi Bill Entry Card**
  - Add an input card or quick-entry chips on the vendor home screen:
    - *Tomato: 20 kg @ ₹22/kg*
    - *Potato: 50 kg @ ₹14/kg*
  - Submits to `POST /api/wholesale/bill`.

- [ ] **Task F3: Continuous Microphone Status Pill**
  - Add a pulsing green indicator: *"Microphone Active • Background Listening (Indefinite)"*.
  - Displays turn count and active customer clusters (`VENDOR`, `CUST_1`, `CUST_2`).

- [ ] **Task F4: Side-by-Side Benchmark Demo Panel**
  - Embed [`BaselinePanel.tsx`](file:///c:/Csc/cascade/mobile/components/BaselinePanel.tsx) and [`EnginePanel.tsx`](file:///c:/Csc/cascade/mobile/components/EnginePanel.tsx) side-by-side with [`SabotageControls.tsx`](file:///c:/Csc/cascade/mobile/components/SabotageControls.tsx) for the judges.

---

## 5. Live Hackathon Judge Pitch Flow (Ready to Rehearse)

Rehearse this 4-step demonstration with the judges:

1. **Step 1: Morning Mandi Ingestion (8:00 AM)**
   - Enter 50 kg Potato @ ₹14/kg and 20 kg Tomato @ ₹22/kg.
   - Show that **zero retail prices are pre-configured** in the app.
2. **Step 2: Daytime Continuous Stream (12:00 PM)**
   - Simulate customer negotiation: *"30 ka lagao ... ok aadha kilo kar do"*.
   - Simulate neighbor soundbox chime: App detects chime with no matching notification $\rightarrow$ **Quarantined as noise ($0$ ledger impact)**.
   - Simulate personal GPay family transfer (₹2,000): Notification arrives with no chime $\rightarrow$ **Booked to Equity, NOT Revenue**.
3. **Step 3: Night EOD Batch Pass (10:00 PM)**
   - Vendor enters drawer count (₹65).
   - Qwen2.5-0.5B runs single offline batch pass:
     - Discovers dynamic rates (Tomato ₹30/kg, Potato ₹25/kg).
     - Strictly computes $30 \times 0.5 = ₹15.00$ in code (zero SLM math hallucinations).
     - Matches wholesale COGS and outputs True Gross Profit (₹22.10, 34% margin).
4. **Step 4: Sabotage Demonstration (Showcasing the 0.5% Engine Advantage)**
   - Trigger the **1970 Clock Reset** and **88dB Bus Horn Noise**.
   - **Naive Competitor Baseline:** Crashes with NaN/integer underflow and hallucinates 98% certainty under noise.
   - **Cascade 0.5% Engine:** Overrides physical clock with Lamport causal ordering and transitions to `UNKNOWN_ABSTAIN` without hallucinating.

---

## 6. Pre-Pitch Verification Commands

Run these commands before presentation to confirm all systems are green:

```bash
# 1. Run Core Invariant & CRDT Tests
node --experimental-strip-types tests/test_engine_invariants.ts

# 2. Run Perception & Diarization Tests
node --experimental-strip-types tests/test_phase2_perception.ts

# 3. Run Continuous SLM Pipeline & Decoupled Math Tests
node --experimental-strip-types tests/test_continuous_slm_pipeline.ts

# 4. Run Live 3-Run Sabotage Benchmark
node --experimental-strip-types evaluation/benchmark.ts

# 5. Start Offline AI Service (FastAPI on Port 8000)
python services/offline_ai_service.py
```
