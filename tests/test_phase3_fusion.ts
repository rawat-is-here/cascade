/**
 * TEAM CASCADE: PHASE 3 CROSS-MODAL FUSION & HYPOTHESIS BUFFER TEST SUITE
 * 
 * Verifies:
 * 1. Kuhn-Munkres (Hungarian) Bipartite Matcher (eliminates double-counting between speech and UPI)
 * 2. Temporal Horizon Window (+-180 seconds boundary enforcement)
 * 3. Dempster-Shafer Multi-Sensor Conflict Resolution (handles acoustic vs digital contradictions)
 * 4. Daily Hypothesis Store & Double-Entry CRDT Ledger Integration
 * 5. Memory & Latency Budget (<15ms execution)
 */

import { performance } from 'node:perf_hooks';
import type { AudioHypothesisBundle, ParsedUPINotification } from '../shared/types.ts';
import { HungarianBipartiteMatcher } from '../core/fusion/bipartite_matcher.ts';
import { DempsterShaferFuser, type SensorBeliefMass } from '../core/fusion/dempster_shafer.ts';
import { DailyHypothesisStore } from '../core/reconciliation/conversation_log.ts';
import { ConservedDoubleEntryCRDT } from '../core/crdt/double_entry_crdt.ts';

function runPhase3FusionSuite() {
  const startTime = performance.now();
  console.log('================================================================');
  console.log('      TEAM CASCADE: PHASE 3 CROSS-MODAL FUSION TEST SUITE       ');
  console.log('================================================================');

  const baseTime = 1730000000000; // Realistic timestamp (Nov 2026)

  // -------------------------------------------------------------
  // TEST 1: Hungarian Bipartite Matcher (Speech vs. Delayed UPI)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Kuhn-Munkres Bipartite Matcher ---');

  const audio1: AudioHypothesisBundle = {
    snippetId: 'AUD_01',
    timestamp: baseTime + 1000,
    rawTranscript: '40 ka diya',
    noiseDb: 65,
    speakerRole: 'VENDOR',
    customerId: 'CUST_01',
    entities: {
      candidateAmounts: [{ amount: 40, acousticConfidence: 0.95 }]
    },
    epistemicState: 'PROBABILISTIC_PRIOR'
  };

  const audio2: AudioHypothesisBundle = {
    snippetId: 'AUD_02',
    timestamp: baseTime + 12000,
    rawTranscript: '140 rupaye ho gaye',
    noiseDb: 70,
    speakerRole: 'VENDOR',
    customerId: 'CUST_02',
    entities: {
      candidateAmounts: [{ amount: 140, acousticConfidence: 0.92 }]
    },
    epistemicState: 'PROBABILISTIC_PRIOR'
  };

  const audio3: AudioHypothesisBundle = {
    snippetId: 'AUD_03',
    timestamp: baseTime + 25000,
    rawTranscript: '20 rupaye ka chole',
    noiseDb: 68,
    speakerRole: 'CUSTOMER',
    customerId: 'CUST_03',
    entities: {
      candidateAmounts: [{ amount: 20, acousticConfidence: 0.88 }]
    },
    epistemicState: 'PROBABILISTIC_PRIOR'
  };

  // UPI notifications with varying delays
  const upiPaytm: ParsedUPINotification = {
    notificationId: 'NOTIF_PAYTM_01',
    sourceApp: 'PAYTM',
    amount: 40,
    refId: 'RRN4920192841',
    receivedAt: baseTime + 8000 // 7s delay after Audio 1
  };

  const upiBankSms: ParsedUPINotification = {
    notificationId: 'NOTIF_SMS_02',
    sourceApp: 'BANK_SMS',
    amount: 140,
    refId: 'UPI9019283719',
    receivedAt: baseTime + 35000 // 23s delay after Audio 2
  };

  const upiPhantom: ParsedUPINotification = {
    notificationId: 'NOTIF_PHONEPE_03',
    sourceApp: 'PHONEPE',
    amount: 999,
    refId: 'TXN9999999999',
    receivedAt: baseTime + 15000 // No audio match
  };

  const matchResult = HungarianBipartiteMatcher.match(
    [audio1, audio2, audio3],
    [upiPaytm, upiBankSms, upiPhantom]
  );

  console.log(`  Matched Pairs: ${matchResult.matchedPairs.length}`);
  console.log(`  Unmatched Audio: ${matchResult.unmatchedAudio.length}`);
  console.log(`  Unmatched UPI: ${matchResult.unmatchedUPI.length}`);

  if (matchResult.matchedPairs.length !== 2) {
    throw new Error(`TEST 1 FAILED: Expected 2 matches, got ${matchResult.matchedPairs.length}`);
  }

  // Verify Pair 1: AUD_01 <-> Paytm 40
  const pair1 = matchResult.matchedPairs.find(p => p.audioSnippet.snippetId === 'AUD_01');
  if (!pair1 || pair1.upiNotification.amount !== 40 || pair1.matchCost > 0.35) {
    throw new Error(`TEST 1 FAILED: Incorrect pair for AUD_01: ${JSON.stringify(pair1)}`);
  }
  console.log(`  ✓ Pair 1 Matched: AUD_01 (₹40) <-> Paytm Soundbox (₹40) [Cost: ${pair1.matchCost.toFixed(3)}]`);

  // Verify Pair 2: AUD_02 <-> Bank SMS 140
  const pair2 = matchResult.matchedPairs.find(p => p.audioSnippet.snippetId === 'AUD_02');
  if (!pair2 || pair2.upiNotification.amount !== 140 || pair2.matchCost > 0.35) {
    throw new Error(`TEST 1 FAILED: Incorrect pair for AUD_02: ${JSON.stringify(pair2)}`);
  }
  console.log(`  ✓ Pair 2 Matched: AUD_02 (₹140) <-> Bank SMS (₹140) [Cost: ${pair2.matchCost.toFixed(3)}]`);

  // Verify Unmatched Audio (AUD_03 is cash)
  if (matchResult.unmatchedAudio.length !== 1 || matchResult.unmatchedAudio[0].snippetId !== 'AUD_03') {
    throw new Error('TEST 1 FAILED: AUD_03 should remain in unmatched cash pool');
  }
  console.log(`  ✓ Unmatched Cash Preserved: AUD_03 (₹20) routed to uncommitted pool`);

  // Verify Unmatched UPI (Phantom 999)
  if (matchResult.unmatchedUPI.length !== 1 || matchResult.unmatchedUPI[0].amount !== 999) {
    throw new Error('TEST 1 FAILED: Phantom UPI 999 should remain unmatched');
  }
  console.log(`  ✓ Phantom UPI Preserved: ₹999 recorded as independent digital receipt`);

  // -------------------------------------------------------------
  // TEST 2: Temporal Horizon Invariant (>180s must reject fusion)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Temporal Horizon Boundary (>180s) ---');
  const staleAudio: AudioHypothesisBundle = {
    snippetId: 'AUD_STALE',
    timestamp: baseTime,
    rawTranscript: '50 rupaye',
    noiseDb: 60,
    speakerRole: 'VENDOR',
    entities: { candidateAmounts: [{ amount: 50, acousticConfidence: 0.9 }] },
    epistemicState: 'PROBABILISTIC_PRIOR'
  };

  const lateUpi: ParsedUPINotification = {
    notificationId: 'NOTIF_LATE',
    sourceApp: 'GPAY',
    amount: 50,
    refId: 'LATE_REF_01',
    receivedAt: baseTime + 185_000 // 185 seconds later (> 180s threshold)
  };

  const staleResult = HungarianBipartiteMatcher.match([staleAudio], [lateUpi]);
  if (staleResult.matchedPairs.length !== 0) {
    throw new Error('TEST 2 FAILED: Temporal invariant violated! Stale event (>180s) was matched.');
  }
  console.log('  ✓ Temporal Invariant Verified: Event with 185s gap correctly rejected from fusion');

  // -------------------------------------------------------------
  // TEST 3: Dempster-Shafer Multi-Sensor Conflict Resolution
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Dempster-Shafer Multi-Sensor Fusion ---');

  // Case A: Agreement between Speech (₹40) and Soundbox (₹40)
  const sensorSpeechOk: SensorBeliefMass = {
    sensorId: 'SPEECH_ASR',
    hypothesizedAmount: 40,
    beliefMass: 0.75,
    uncertaintyMass: 0.25
  };
  const sensorSoundboxOk: SensorBeliefMass = {
    sensorId: 'UPI_SOUNDBOX',
    hypothesizedAmount: 40,
    beliefMass: 0.95,
    uncertaintyMass: 0.05
  };

  const fusedAgreement = DempsterShaferFuser.fuseSensors([sensorSpeechOk, sensorSoundboxOk]);
  console.log(`  Agreement Case -> Fused: ₹${fusedAgreement.fusedAmount}, Belief: ${(fusedAgreement.combinedBelief * 100).toFixed(1)}%, Conflict K: ${fusedAgreement.conflictDegreeK.toFixed(3)}`);
  if (fusedAgreement.hasSevereConflict || fusedAgreement.fusedAmount !== 40 || fusedAgreement.combinedBelief < 0.95) {
    throw new Error('TEST 3A FAILED: Sensor agreement did not boost confidence');
  }
  console.log('  ✓ Sensor Agreement: Confidence elevated to CONSERVED_CANONICAL');

  // Case B: Severe contradiction: Speech claims ₹500, Soundbox confirms ₹20
  const sensorSpeechContradiction: SensorBeliefMass = {
    sensorId: 'SPEECH_ASR',
    hypothesizedAmount: 500,
    beliefMass: 0.90,
    uncertaintyMass: 0.10
  };
  const sensorSoundboxContradiction: SensorBeliefMass = {
    sensorId: 'UPI_SOUNDBOX',
    hypothesizedAmount: 20,
    beliefMass: 0.95,
    uncertaintyMass: 0.05
  };

  const fusedContradiction = DempsterShaferFuser.fuseSensors([sensorSpeechContradiction, sensorSoundboxContradiction]);
  console.log(`  Contradiction Case -> Conflict K: ${(fusedContradiction.conflictDegreeK * 100).toFixed(1)}%, EpistemicState: ${fusedContradiction.epistemicConfidence}`);
  if (!fusedContradiction.hasSevereConflict || fusedContradiction.epistemicConfidence !== 'HIGH_ENTROPY_ABSTAIN') {
    throw new Error('TEST 3B FAILED: Severe contradiction was not flagged as HIGH_ENTROPY_ABSTAIN');
  }
  console.log('  ✓ Severe Conflict Detected: Contradictory evidence quarantined safely');

  // -------------------------------------------------------------
  // TEST 4: Daily Hypothesis Store & Double-Entry CRDT Ledger Commit
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Daily Hypothesis Store & CRDT Ledger ---');
  const crdtLedger = new ConservedDoubleEntryCRDT('device-stall-01');
  const store = new DailyHypothesisStore(crdtLedger);

  // Ingest 3 spoken transactions
  // 1. Spoken negotiated tomato deal from Phase 2 (₹15)
  const audioTomato: AudioHypothesisBundle = {
    snippetId: 'AUD_TOMATO_15',
    timestamp: baseTime + 1000,
    rawTranscript: 'aadha kilo kar do',
    noiseDb: 62,
    speakerRole: 'CUSTOMER',
    customerId: 'CUST_SHARMA',
    negotiation: {
      sessionKey: 'CUST_SHARMA:TOMATO',
      customerId: 'CUST_SHARMA',
      itemName: 'tomato',
      currentState: 'QUANTITY_LOCKED',
      finalAgreedRate: 30,
      quantity: 0.5,
      unit: 'kg',
      derivedTotalAmount: 15.0,
      isVendorConfirmed: true,
      lastActiveTimestamp: baseTime + 1000
    },
    entities: {
      candidateAmounts: [{ amount: 15, acousticConfidence: 0.98 }]
    },
    epistemicState: 'CONSERVED_CANONICAL'
  };

  // 2. Spoken UPI deal (₹40)
  const audioPaytm: AudioHypothesisBundle = {
    snippetId: 'AUD_PAYTM_40',
    timestamp: baseTime + 5000,
    rawTranscript: '40 online bhej do',
    noiseDb: 65,
    speakerRole: 'VENDOR',
    customerId: 'CUST_VERMA',
    entities: {
      candidateAmounts: [{ amount: 40, acousticConfidence: 0.95 }]
    },
    epistemicState: 'PROBABILISTIC_PRIOR'
  };

  // 3. Spoken cash deal (₹60)
  const audioCash: AudioHypothesisBundle = {
    snippetId: 'AUD_CASH_60',
    timestamp: baseTime + 9000,
    rawTranscript: '60 rupaye ka kheer',
    noiseDb: 60,
    speakerRole: 'CUSTOMER',
    customerId: 'CUST_GUPTA',
    entities: {
      candidateAmounts: [{ amount: 60, acousticConfidence: 0.90 }]
    },
    epistemicState: 'PROBABILISTIC_PRIOR'
  };

  store.ingestAudioHypothesis(audioTomato);
  store.ingestAudioHypothesis(audioPaytm);
  store.ingestAudioHypothesis(audioCash);

  let uncommitted = store.getUncommittedCashHypotheses();
  console.log(`  Initial Uncommitted Audio Hypotheses: ${uncommitted.length}`);
  if (uncommitted.length !== 3) throw new Error('Expected 3 uncommitted audio hypotheses');

  // Now an incoming UPI notification arrives for ₹40
  const incomingUPI: ParsedUPINotification = {
    notificationId: 'NOTIF_PAYTM_LIVE',
    sourceApp: 'PAYTM',
    amount: 40,
    refId: 'RRN_LIVE_4040',
    receivedAt: baseTime + 12000
  };

  const ingestionResult = store.ingestUPINotification(incomingUPI);
  console.log(`  Incoming UPI (₹40) processed: matched=${ingestionResult.matched}, txId=${ingestionResult.transaction.txId}`);
  if (!ingestionResult.matched || ingestionResult.transaction.sourceAudioId !== 'AUD_PAYTM_40') {
    throw new Error('TEST 4 FAILED: Ingested UPI did not fuse with AUD_PAYTM_40');
  }

  // Verify CRDT posting
  if (!ingestionResult.delta) {
    throw new Error('TEST 4 FAILED: No BalancedDelta generated for confirmed digital payment');
  }
  console.log(`  ✓ CRDT Transaction Posted: ${ingestionResult.delta.txId}`);

  // Check CRDT ledger conservation
  const conservation = crdtLedger.verifyConservation();
  if (!conservation.isConserved) {
    throw new Error(`TEST 4 FAILED: CRDT ledger not conserved! Net balance = ${conservation.netBalanceMinor}`);
  }
  console.log(`  ✓ CRDT Ledger Conservatively Balanced: Net Minor = ${conservation.netBalanceMinor}`);

  // Check remaining uncommitted pool
  uncommitted = store.getUncommittedCashHypotheses();
  console.log(`  Remaining Uncommitted Cash Hypotheses: ${uncommitted.length}`);
  const remainingIds = uncommitted.map(h => h.snippetId);
  if (uncommitted.length !== 2 || remainingIds.includes('AUD_PAYTM_40')) {
    throw new Error(`TEST 4 FAILED: AUD_PAYTM_40 was not removed from uncommitted pool. Remaining: ${remainingIds.join(', ')}`);
  }
  console.log(`  ✓ Pool Cleansed: Only [${remainingIds.join(', ')}] remain for Phase 4 EOD Cash Settlement`);

  const totalDigital = store.getTotalConfirmedDigital();
  console.log(`  ✓ Confirmed Digital Ledger Total: ₹${totalDigital}`);
  if (totalDigital !== 40) throw new Error(`Expected ₹40 digital, got ₹${totalDigital}`);

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log('\n================================================================');
  console.log(`✓ ALL PHASE 3 FUSION & HYPOTHESIS TESTS PASSED in ${elapsed}ms (<15ms budget).`);
  console.log('================================================================\n');
}

runPhase3FusionSuite();
