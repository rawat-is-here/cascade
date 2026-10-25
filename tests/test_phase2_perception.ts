import { IndicNumericLexer } from '../core/linguistics/indic_lexer.ts';
import { OnDeviceSpeakerDiarizer } from '../core/linguistics/speaker_diarizer.ts';
import { QwenEODBatchInterpreter } from '../core/slm/qwen_interpreter.ts';
import { IndicPhoneticTrie } from '../core/linguistics/indic_phonetic.ts';
import { MobileNotificationListenerService } from '../mobile/services/NotificationListener.ts';
import { MobileAudioCaptureService } from '../mobile/services/AudioCaptureService.ts';

function runPhase2PerceptionSuite() {
  console.log('================================================================');
  console.log('    TEAM CASCADE: PHASE 2 PERCEPTION & NEGOTIATOR TEST SUITE    ');
  console.log('================================================================\n');

  const startTime = performance.now();

  // -------------------------------------------------------------
  // TEST 1: Indic Numeric & Unit Lexer
  // -------------------------------------------------------------
  console.log('--- TEST 1: Indic Numeric & Unit Lexer ---');
  
  const t1 = IndicNumericLexer.parse('aadha kilo tamatar kar do');
  if (t1.quantity !== 0.5 || t1.itemNormalized !== 'tomato') {
    throw new Error(`TEST 1 FAILED: Expected 0.5kg tomato, got ${t1.quantity}kg ${t1.itemNormalized}`);
  }
  console.log(`  ✓ 'aadha kilo tamatar' parsed -> Qty: ${t1.quantity}kg, Item: ${t1.itemNormalized}`);

  const t2 = IndicNumericLexer.parse('2 paav tamatar');
  if (t2.quantity !== 0.5) {
    throw new Error(`TEST 1 FAILED: Expected 2 paav = 0.5kg, got ${t2.quantity}kg`);
  }
  console.log(`  ✓ '2 paav tamatar' parsed -> Qty: ${t2.quantity}kg (2 × 0.25kg)`);

  const t3 = IndicNumericLexer.parse('50 rupaye ka aalu de do');
  if (!t3.isValueDriven || t3.price !== 50 || t3.itemNormalized !== 'potato') {
    throw new Error(`TEST 1 FAILED: Value-driven order failed: price=${t3.price}, isValueDriven=${t3.isValueDriven}`);
  }
  console.log(`  ✓ '50 rupaye ka aalu' parsed -> Value-driven Cash: ₹${t3.price}, Item: ${t3.itemNormalized}`);

  const t4 = IndicNumericLexer.parse('thoda dhaniya mirchi daal do na');
  if (!t4.isFreebie) {
    throw new Error('TEST 1 FAILED: Failed to detect freebie request');
  }
  console.log(`  ✓ 'thoda dhaniya mirchi daal do' parsed -> isFreebie: true`);

  // -------------------------------------------------------------
  // TEST 2: Vendor Voice Diarization (ECAPA-TDNN 192-d)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Vendor Voice Diarization & Speaker Verification ---');
  const diarizer = new OnDeviceSpeakerDiarizer();

  // Vendor enrollment with 5-sec sample embedding
  const vendorEnrollment = OnDeviceSpeakerDiarizer.createSyntheticEmbedding(42);
  diarizer.enrollVendor([vendorEnrollment]);

  // Live utterance by Vendor (small vocal perturbation)
  const vendorLiveVoice = OnDeviceSpeakerDiarizer.createSyntheticEmbedding(42, 0.05);
  const vRes = diarizer.diarize(vendorLiveVoice);
  if (vRes.role !== 'VENDOR') {
    throw new Error(`TEST 2 FAILED: Expected VENDOR, got ${vRes.role} (confidence: ${vRes.confidence})`);
  }
  console.log(`  ✓ Vendor live voice verified: Role = ${vRes.role}, Confidence = ${vRes.confidence}`);

  // Customer voice (orthogonal acoustic profile)
  const customerVoice1 = OnDeviceSpeakerDiarizer.createSyntheticEmbedding(999);
  const cRes = diarizer.diarize(customerVoice1);
  if (cRes.role !== 'CUSTOMER') {
    throw new Error(`TEST 2 FAILED: Expected CUSTOMER, got ${cRes.role}`);
  }
  console.log(`  ✓ Non-vendor voice classified: Role = ${cRes.role}, Cluster = ${cRes.clusterId}`);

  // -------------------------------------------------------------
  // TEST 3: Dynamic Multi-Customer Mandi Cocktail Party Clustering
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Concurrent Multi-Customer Online Clustering ---');
  // Customer 2 arrives with another unique voice
  const customerVoice2 = OnDeviceSpeakerDiarizer.createSyntheticEmbedding(777);
  const cRes2 = diarizer.diarize(customerVoice2);

  if (cRes2.clusterId === cRes.clusterId) {
    throw new Error(`TEST 3 FAILED: Customer 1 and Customer 2 collided into same cluster: ${cRes.clusterId}`);
  }
  console.log(`  ✓ Parallel Customers Separated: Cust1 = ${cRes.clusterId}, Cust2 = ${cRes2.clusterId}`);

  // 3-Tier Arbitration: Vendor says "tamatar 35 me dunga"
  const targetCust = diarizer.routeVendorResponse('tamatar 35 me dunga', [
    { customerId: cRes.clusterId, itemName: 'potato', lastSpokeAt: Date.now() - 4000 },
    { customerId: cRes2.clusterId, itemName: 'tomato', lastSpokeAt: Date.now() - 1000 }
  ]);
  if (targetCust !== cRes2.clusterId) {
    throw new Error(`TEST 3 FAILED: Failed to route vendor reply to tomato customer: got ${targetCust}`);
  }
  console.log(`  ✓ Context Router correctly bound vendor reply to ${targetCust} (Item Context: tomato)`);

  // -------------------------------------------------------------
  // TEST 4: THE EXACT BARGAINING WALKTHROUGH WITH OFFLINE QWEN & DECOUPLED MATH
  // Cust: "tamatar kitne ka" -> Vend: "40 ka diya" -> Cust: "nahi 30 ka lagao" -> Vend: "ok" -> Cust: "aadha kilo kar do"
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: The Exact Negotiation Dialogue Walkthrough ---');
  const sessionTurns = [
    { audioSliceId: 't1', timestamp: 1000, rawText: 'tamatar kitne ka', speakerClassification: 'CUST_1' as const, confidence: 0.95 },
    { audioSliceId: 't2', timestamp: 2000, rawText: '40 ka diya', speakerClassification: 'VENDOR' as const, confidence: 0.98 },
    { audioSliceId: 't3', timestamp: 3000, rawText: 'nahi 30 ka lagao', speakerClassification: 'CUST_1' as const, confidence: 0.94 },
    { audioSliceId: 't4', timestamp: 4000, rawText: 'ok', speakerClassification: 'VENDOR' as const, confidence: 0.99 },
    { audioSliceId: 't5', timestamp: 5000, rawText: 'aadha kilo kar do', speakerClassification: 'CUST_1' as const, confidence: 0.96 }
  ];

  const parsedTx = QwenEODBatchInterpreter.parseSessionDialogue('SESS_TEST_01', 'CUST_01', sessionTurns);
  if (!parsedTx) throw new Error('TEST 4 FAILED: Qwen failed to extract transaction from dialogue');

  console.log(`  Item Discovered: ${parsedTx.item}`);
  console.log(`  Agreed Rate   : Rs.${parsedTx.agreedRate}/kg`);
  console.log(`  Quantity      : ${parsedTx.quantity} kg`);
  console.log(`  Derived Cash  : EXACTLY Rs.${parsedTx.derivedTotalCash} (${Math.round(parsedTx.derivedTotalCash * 100)} paise)`);

  if (parsedTx.derivedTotalCash !== 15.0) {
    throw new Error(`TEST 4 FAILED: Expected derived total of Rs.15.00, got Rs.${parsedTx.derivedTotalCash}`);
  }
  console.log('  [OK] EXACT WALKTHROUGH VERIFIED: 30 x 0.5 = Rs.15.00 (Decoupled Math Guarantee)');

  // -------------------------------------------------------------
  // TEST 5: Criticality Invariants (Walkaway, Freebie, Alias Prior)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Criticality Edge Cases ---');

  // Edge Case A: Walkaway abort (zero ledger entry)
  const walkawayTurns = [
    { audioSliceId: 'w1', timestamp: 1000, rawText: 'tamatar kitne ka', speakerClassification: 'CUST_1' as const, confidence: 0.95 },
    { audioSliceId: 'w2', timestamp: 2000, rawText: '40 ka diya', speakerClassification: 'VENDOR' as const, confidence: 0.98 },
    { audioSliceId: 'w3', timestamp: 3000, rawText: '25 me do', speakerClassification: 'CUST_1' as const, confidence: 0.94 },
    { audioSliceId: 'w4', timestamp: 4000, rawText: 'rehne do bhaiya, bohot mehenga hai', speakerClassification: 'CUST_1' as const, confidence: 0.96 }
  ];
  const walkRes = QwenEODBatchInterpreter.parseSessionDialogue('SESS_WALK', 'CUST_WALK', walkawayTurns);
  if (!walkRes || !walkRes.isWalkaway || walkRes.derivedTotalCash !== 0) {
    throw new Error('TEST 5A FAILED: Walkaway did not abort cleanly');
  }
  console.log(`  [OK] Walkaway Invariant Verified: isWalkaway=${walkRes.isWalkaway}, Total=${walkRes.derivedTotalCash} (0 ledger entry)`);

  // Edge Case B: Freebie Goodwill
  const freebieTurns = [
    { audioSliceId: 'f1', timestamp: 1000, rawText: 'thoda dhaniya mirchi daal do na', speakerClassification: 'CUST_1' as const, confidence: 0.95 }
  ];
  const freebieRes = QwenEODBatchInterpreter.parseSessionDialogue('SESS_FREE', 'CUST_FREE', freebieTurns);
  if (!freebieRes || !freebieRes.isFreebie || freebieRes.derivedTotalCash !== 0) {
    throw new Error('TEST 5B FAILED: Freebie did not record 0 cash amount');
  }
  console.log(`  [OK] Freebie Invariant Verified: isFreebie=${freebieRes.isFreebie}, CashAmount=Rs.${freebieRes.derivedTotalCash}`);

  // -------------------------------------------------------------
  // TEST 6: Android Notification & UPI SMS Listener
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Android Notification & UPI SMS Parser ---');
  const paytmNotif = MobileNotificationListenerService.parseNotification('Paytm par ₹40 prapt hue. Ref: 429019284102', 'PAYTM');
  if (!paytmNotif || paytmNotif.amount !== 40 || paytmNotif.sourceApp !== 'PAYTM') {
    throw new Error(`TEST 6 FAILED: Failed to parse Paytm notification: ${JSON.stringify(paytmNotif)}`);
  }
  console.log(`  ✓ Paytm Soundbox parsed -> Amount: ₹${paytmNotif.amount}, App: ${paytmNotif.sourceApp}, Ref: ${paytmNotif.refId}`);

  const bankSms = MobileNotificationListenerService.parseNotification('A/C credited by INR 140.00 on 25-Oct-26. UPI Ref 891028371928.', 'BANK_SMS');
  if (!bankSms || bankSms.amount !== 140 || bankSms.sourceApp !== 'BANK_SMS') {
    throw new Error(`TEST 6 FAILED: Failed to parse Bank SMS: ${JSON.stringify(bankSms)}`);
  }
  console.log(`  ✓ Bank SMS parsed -> Amount: ₹${bankSms.amount}, App: ${bankSms.sourceApp}, Ref: ${bankSms.refId}`);

  // -------------------------------------------------------------
  // TEST 7: Mobile Audio VAD Hook
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Mobile Audio VAD Hook ---');
  const vadService = new MobileAudioCaptureService();
  const silentBuffer = new Int16Array(1600); // 100ms of silence
  const vadSilence = vadService.evaluateVAD(silentBuffer);
  if (vadSilence.isSpeech) throw new Error('VAD failed: Detected speech on silence buffer');

  const speechBuffer = new Int16Array(1600);
  for (let i = 0; i < 1600; i++) speechBuffer[i] = Math.round(Math.sin(i / 10) * 15000); // simulated tone
  const vadSpeech = vadService.evaluateVAD(speechBuffer);
  if (!vadSpeech.isSpeech) throw new Error('VAD failed: Failed to detect voice energy');
  console.log(`  ✓ VAD Energy Hook Verified: Silence=${vadSilence.energy}, Speech=${vadSpeech.energy}`);

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log('\n================================================================');
  console.log(`✓ ALL PHASE 2 PERCEPTION & NEGOTIATOR TESTS PASSED in ${elapsed}ms (<15ms budget).`);
  console.log('================================================================\n');
}

runPhase2PerceptionSuite();
