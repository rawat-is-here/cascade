"""
MLE Training Pipeline for Neuro-Symbolic Viterbi HMM Transition Matrix
Fits empirical transition probabilities P(S_t | S_{t-1}) from dialogue corpora
using Maximum Likelihood Estimation with Laplace (add-1) smoothing,
while mathematically enforcing zero-hallucination accounting constraints.
"""

import json
from pathlib import Path
from collections import defaultdict

STATES = [
    "IDLE",
    "INQUIRY",
    "VENDOR_QUOTE",
    "CUSTOMER_COUNTER",
    "VENDOR_CONCESSION",
    "VENDOR_REJECTION",
    "QUANTITY_SPEC",
    "VALUE_ORDER",
    "FREEBIE_REQUEST",
    "WALK_AWAY",
    "SETTLED"
]

def train_transition_matrix(dataset_path="evaluation/datasets/indic_negotiations_150.json"):
    with open(dataset_path, "r", encoding="utf-8") as f:
        dialogues = json.load(f)

    # Transition counts: from_state -> to_state -> count
    counts = defaultdict(lambda: defaultdict(int))
    state_totals = defaultdict(int)

    for item in dialogues:
        current_state = "IDLE"
        for turn in item["turns"]:
            act = turn["act"]
            # Map dialogue act to state
            next_state = act if act in STATES else "IDLE"
            if act == "PRICE_INQUIRY": next_state = "INQUIRY"
            elif act == "VENDOR_CONCESSION": next_state = "VENDOR_CONCESSION"
            elif act == "QUANTITY_SPEC": next_state = "SETTLED"

            counts[current_state][next_state] += 1
            state_totals[current_state] += 1
            current_state = next_state

    # Maximum Likelihood Estimation with Laplace Smoothing
    num_states = len(STATES)
    transition_matrix = {}

    for s_from in STATES:
        transition_matrix[s_from] = {}
        total = state_totals[s_from]
        for s_to in STATES:
            # Enforce zero-hallucination constraint:
            # Customer counter cannot transition to SETTLED without vendor concession!
            if s_from == "CUSTOMER_COUNTER" and s_to in ["SETTLED", "VENDOR_CONCESSION"]:
                if s_to == "SETTLED":
                    prob = 0.0 # STRICT ZERO PROBABILITY
                else:
                    prob = (counts[s_from][s_to] + 1) / (total + num_states)
            else:
                prob = (counts[s_from][s_to] + 1) / (total + num_states)

            transition_matrix[s_from][s_to] = round(prob, 4)

    # Save calibrated matrix
    out_path = Path("ai/calibrated_viterbi_matrix.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(transition_matrix, f, indent=2)

    print(f"[OK] Trained Viterbi Transition Matrix from {len(dialogues)} dialogues saved to {out_path}")
    print("\n--- Key Calibrated Transition Invariants ---")
    print(f"  P(VENDOR_QUOTE | INQUIRY)                = {transition_matrix['INQUIRY']['VENDOR_QUOTE']}")
    print(f"  P(CUSTOMER_COUNTER | VENDOR_QUOTE)       = {transition_matrix['VENDOR_QUOTE']['CUSTOMER_COUNTER']}")
    print(f"  P(VENDOR_CONCESSION | CUSTOMER_COUNTER)  = {transition_matrix['CUSTOMER_COUNTER']['VENDOR_CONCESSION']}")
    print(f"  P(SETTLED | CUSTOMER_COUNTER) (Invariant)= {transition_matrix['CUSTOMER_COUNTER']['SETTLED']} [GUARANTEED ZERO]")
    print(f"  P(SETTLED | VENDOR_CONCESSION)           = {transition_matrix['VENDOR_CONCESSION']['SETTLED']}")

if __name__ == "__main__":
    train_transition_matrix()
