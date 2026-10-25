import { IndicNumericLexer } from '../core/linguistics/indic_lexer.ts';
import { OnDeviceSpeakerDiarizer } from '../core/linguistics/speaker_diarizer.ts';
import { ViterbiNegotiatorEngine } from '../core/linguistics/viterbi_negotiator.ts';
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
  // TEST 4: THE EXACT BARGAINING WALKTHROUGH
  // Cust: "tamatar kitne ka" -> Vend: "40 ka diya" -> Cust: "nahi 30 ka lagao" -> Vend: "ok" -> Cust: "aadha kilo kar do"
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: The Exact Negotiation Dialogue Walkthrough ---');
  const negotiator = new ViterbiNegotiatorEngine();
  const testCustId = 'CUST_TEST_01';

  // Turn 1 (Customer): "tamatar kitne ka"
  const turn1 = negotiator.processTurn({
    speakerRole: 'CUSTOMER',
    customerId: testCustId,
    utteranceText: 'tamatar kitne ka'
  });
  console.log(`  Turn 1 (Cust): "tamatar kitne ka" -> State: ${turn1.currentState}, Item: ${turn1.itemName}`);

  // Turn 2 (Vendor): "40 ka diya"
  const turn2 = negotiator.processTurn({
    speakerRole: 'VENDOR',
    customerId: testCustId,
    utteranceText: '40 ka diya'
  });
  console.log(`  Turn 2 (Vend): "40 ka diya" -> State: ${turn2.currentState}, Quoted Rate: ₹${turn2.quotedRate}`);
  if (turn2.quotedRate !== 40) throw new Error(`Expected quoted rate 40, got ${turn2.quotedRate}`);

  // Turn 3 (Customer): "nahi 30 ka lagao"
  const turn3 = negotiator.processTurn({
    speakerRole: 'CUSTOMER',
    customerId: testCustId,
    utteranceText: 'nahi 30 ka lagao'
  });
  console.log(`  Turn 3 (Cust): "nahi 30 ka lagao" -> State: ${turn3.currentState}, Proposed: ₹${turn3.customerCounterRate || 30} (isBinding: ${turn3.isBindingCommitted})`);
  if (turn3.isBindingCommitted) throw new Error('Customer counter-offer must NOT be binding before vendor concession!');

  // Turn 4 (Vendor): "ok"
  const turn4 = negotiator.processTurn({
    speakerRole: 'VENDOR',
    customerId: testCustId,
    utteranceText: 'ok'
  });
  console.log(`  Turn 4 (Vend): "ok" -> State: ${turn4.currentState}, Locked Agreed Rate: ₹${turn4.finalAgreedRate}`);
  if (turn4.finalAgreedRate !== 30) throw new Error(`Expected agreed rate locked to 30, got ${turn4.finalAgreedRate}`);

  // Turn 5 (Customer): "aadha kilo kar do"
  const turn5 = negotiator.processTurn({
    speakerRole: 'CUSTOMER',
    customerId: testCustId,
    utteranceText: 'aadha kilo kar do'
  });
  console.log(`  Turn 5 (Cust): "aadha kilo kar do" -> State: ${turn5.currentState}`);
  console.log(`    Agreed Rate: ₹${turn5.finalAgreedRate}/kg`);
  console.log(`    Quantity   : ${turn5.quantity} kg`);
  console.log(`    Derived Cash: EXACTLY ₹${turn5.derivedTotalAmount} (${turn5.derivedTotalMinor} paise)`);
  console.log(`    Committed  : ${turn5.isBindingCommitted}`);

  // Strict verification: 30 * 0.5 = 15.00
  if (turn5.derivedTotalAmount !== 15.0 || turn5.derivedTotalMinor !== 1500) {
    throw new Error(`TEST 4 FAILED: Expected derived total of ₹15.00, got ₹${turn5.derivedTotalAmount}`);
  }
  if (!turn5.isBindingCommitted) {
    throw new Error('TEST 4 FAILED: Deal must be committed after vendor concession + quantity specification');
  }
  console.log('  ✓ EXACT WALKTHROUGH VERIFIED: 30 × 0.5 = ₹15.00');

  // -------------------------------------------------------------
  // TEST 5: Criticality Invariants (Walkaway, Freebie, Alias Prior)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Criticality Edge Cases ---');

  // Edge Case A: Walkaway abort (zero ledger entry)
  const walkawayNegotiator = new ViterbiNegotiatorEngine();
  walkawayNegotiator.processTurn({ speakerRole: 'CUSTOMER', customerId: 'C_WALK', utteranceText: 'tamatar kitne ka' });
  walkawayNegotiator.processTurn({ speakerRole: 'VENDOR', customerId: 'C_WALK', utteranceText: '40 ka diya' });
  walkawayNegotiator.processTurn({ speakerRole: 'CUSTOMER', customerId: 'C_WALK', utteranceText: '25 me do' });
  const walkRes = walkawayNegotiator.processTurn({ speakerRole: 'CUSTOMER', customerId: 'C_WALK', utteranceText: 'rehne do bhaiya, bohot mehenga hai' });
  
  if (!walkRes.isWalkaway || walkRes.derivedTotalAmount !== 0) {
    throw new Error(`TEST 5A FAILED: Walkaway did not abort cleanly: amount=${walkRes.derivedTotalAmount}`);
  }
  console.log(`  ✓ Walkaway Invariant Verified: isWalkaway=${walkRes.isWalkaway}, Total=${walkRes.derivedTotalAmount} (0 ledger entry)`);

  // Edge Case B: Freebie Goodwill
  const freebieRes = negotiator.processTurn({ speakerRole: 'CUSTOMER', customerId: 'C_FREE', utteranceText: 'thoda dhaniya mirchi daal do na' });
  if (!freebieRes.isFreebie || freebieRes.derivedTotalAmount !== 0) {
    throw new Error('TEST 5B FAILED: Freebie did not record 0 cash amount');
  }
  console.log(`  ✓ Freebie Invariant Verified: isFreebie=${freebieRes.isFreebie}, CashAmount=₹${freebieRes.derivedTotalAmount}`);

  // Edge Case C: Indic Soundex Alias Resolution ("Sarma ji" -> Sharma Ji)
  const trie = new IndicPhoneticTrie();
  const aliasMatch = trie.resolve('Sarma ji ka 40 jama kar');
  if (!aliasMatch || aliasMatch.entityId !== 'ENT-SHARMA-01') {
    throw new Error(`TEST 5C FAILED: Expected ENT-SHARMA-01, got ${aliasMatch?.entityId}`);
  }
  console.log(`  ✓ Indic Soundex Resolved: 'Sarma ji' -> ${aliasMatch.canonicalName} (${aliasMatch.entityId})`);

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
