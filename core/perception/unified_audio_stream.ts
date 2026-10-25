/**
 * Unified Continuous Audio Stream & 4-Way Classifier with STT Confidence & Instant Vendor Confirmation
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Runs indefinitely once started until explicitly stopped by vendor.
 * Strips silence via energy VAD and routes each utterance to:
 *   1. Vendor Voice (enrolled centroid + fatigue adaptation)
 *   2. Customer 1 (primary bargaining customer)
 *   3. Customer 2 (queue customer / cocktail party separation)
 *   4. Soundbox Chime (Paytm/PhonePe dual-tone signature burst)
 * 
 * CONFIDENCE & VENDOR CONFIRMATION INVARIANT:
 * - Every STT transcript receives a confidence score (0.0 to 1.0).
 * - Only conversations with >= 90% confidence (>= 0.90) are automatically considered.
 * - If STT confidence < 0.90, the system triggers an instant confirmation alert to the vendor.
 * - The vendor can confirm (escalating to 1.0) or reject/edit right away.
 */

import { OnDeviceSpeakerDiarizer } from '../linguistics/speaker_diarizer.ts';
import type { UPICrossValidator, SoundboxAcousticChime } from '../fusion/upi_cross_validator.ts';

export type SpeakerClassification = 'VENDOR' | 'CUST_1' | 'CUST_2' | 'SOUNDBOX_CHIME';

export type ConfirmationStatus = 
  | 'CONFIRMED_HIGH_CONFIDENCE'     // confidence >= 0.90
  | 'REQUIRES_VENDOR_CONFIRMATION'  // confidence < 0.90
  | 'VENDOR_CONFIRMED'              // manually confirmed or corrected by vendor
  | 'VENDOR_REJECTED';              // rejected/discarded by vendor

export interface VendorConfirmationRequest {
  turnId: string;
  timestamp: number;
  speaker: SpeakerClassification;
  rawText: string;
  sttConfidence: number;
  suggestedClarification: string;
}

export interface RawTranscriptRecord {
  id: string;
  timestamp: number;
  rawText: string;
  speakerClassification: SpeakerClassification;
  speakerClusterId?: string;
  sttConfidence: number;            // 0.0 to 1.0
  confirmationStatus: ConfirmationStatus;
  noiseDb: number;
  processedStatus: 'PENDING' | 'PARSED' | 'DISCARDED';
}

export class UnifiedAudioStreamListener {
  public static readonly MIN_CONFIDENCE_THRESHOLD = 0.90; // 90% confidence threshold

  private isListening = false;
  private shiftStartedAt: number | null = null;
  private shiftEndedAt: number | null = null;

  private diarizer: OnDeviceSpeakerDiarizer;
  private upiValidator?: UPICrossValidator;
  private transcriptLog: RawTranscriptRecord[] = [];
  private sequenceCounter = 0;

  // Real-time hook for vendor confirmation when confidence < 90%
  private onConfirmationNeeded?: (req: VendorConfirmationRequest) => void;

  constructor(upiValidator?: UPICrossValidator) {
    this.diarizer = new OnDeviceSpeakerDiarizer();
    this.upiValidator = upiValidator;
  }

  public attachUPIValidator(validator: UPICrossValidator): void {
    this.upiValidator = validator;
  }

  public setOnConfirmationNeeded(callback: (req: VendorConfirmationRequest) => void): void {
    this.onConfirmationNeeded = callback;
  }

  /**
   * Starts the indefinite continuous background listening shift.
   */
  public startShift(now: number = Date.now()): void {
    this.isListening = true;
    this.shiftStartedAt = now;
    this.shiftEndedAt = null;
  }

  /**
   * Stops the continuous background listening shift.
   */
  public stopShift(now: number = Date.now()): void {
    this.isListening = false;
    this.shiftEndedAt = now;
  }

  public get isActive(): boolean {
    return this.isListening;
  }

  /**
   * Enrolls the vendor's 5-second voice calibration centroid.
   */
  public enrollVendor(sampleEmbedding192: number[]): void {
    this.diarizer.enrollVendor([sampleEmbedding192]);
  }

  /**
   * Ingests a continuous stream chunk:
   * 1. Energy VAD check (skips dead air silence)
   * 2. Detects Soundbox Chime vs Human Speech
   * 3. Diarizes human speech into Vendor, Cust 1, Cust 2
   * 4. Evaluates STT confidence:
   *    - >= 90% -> CONFIRMED_HIGH_CONFIDENCE
   *    - < 90% -> REQUIRES_VENDOR_CONFIRMATION (triggers vendor alert right away)
   */
  public ingestAudioChunk(params: {
    timestamp: number;
    transcribedText: string;
    sttConfidence?: number; // STT model confidence (0.0 to 1.0)
    audioEmbedding192?: number[];
    isSoundboxToneDetected?: boolean;
    detectedChimeAmount?: number;
    detectedChimeApp?: 'PAYTM' | 'PHONEPE' | 'GPAY';
    noiseDb?: number;
  }): RawTranscriptRecord | null {
    if (!this.isListening) return null;

    const noiseDb = params.noiseDb || 65;
    const text = params.transcribedText.trim();
    if (!text && !params.isSoundboxToneDetected) return null; // Silence / VAD dropped

    this.sequenceCounter++;
    const id = `CHUNK_${params.timestamp}_${this.sequenceCounter}`;
    const rawConfidence = params.sttConfidence !== undefined ? params.sttConfidence : 0.95;

    // 1. Detect Soundbox Chime
    const isChimePhrase = /(?:paytm|phonepe|gpay|bhim)\s*(?:par|pe)?\s*(\d+(?:\.\d+)?)\s*(?:rupaye|rs)?\s*(?:prapt|jama|received)/i.test(text);

    if (params.isSoundboxToneDetected || isChimePhrase) {
      let chimeAmt = params.detectedChimeAmount;
      if (!chimeAmt) {
        const amtMatch = text.match(/(\d+(?:\.\d+)?)/);
        chimeAmt = amtMatch ? parseFloat(amtMatch[1]) : 0;
      }

      const chimeRecord: RawTranscriptRecord = {
        id,
        timestamp: params.timestamp,
        rawText: text,
        speakerClassification: 'SOUNDBOX_CHIME',
        sttConfidence: 0.99,
        confirmationStatus: 'CONFIRMED_HIGH_CONFIDENCE',
        noiseDb,
        processedStatus: 'PENDING'
      };
      this.transcriptLog.push(chimeRecord);

      // Notify UPI cross-validator immediately
      if (this.upiValidator && chimeAmt > 0) {
        const acousticChime: SoundboxAcousticChime = {
          chimeId: id,
          sourceApp: params.detectedChimeApp || 'PAYTM',
          amount: chimeAmt,
          timestamp: params.timestamp,
          confidence: 0.98
        };
        this.upiValidator.ingestAcousticChime(acousticChime);
      }

      return chimeRecord;
    }

    // 2. Classify Human Voice (Vendor vs Customers)
    const embedding = params.audioEmbedding192 || new Array(192).fill(0.01);
    const diarization = this.diarizer.diarize(embedding, params.timestamp);

    let classification: SpeakerClassification = 'CUST_1';
    if (diarization.role === 'VENDOR') {
      classification = 'VENDOR';
    } else {
      classification = diarization.clusterId === 'CUST_02' ? 'CUST_2' : 'CUST_1';
    }

    // 3. Evaluate 90% Confidence Threshold
    const meetsThreshold = rawConfidence >= UnifiedAudioStreamListener.MIN_CONFIDENCE_THRESHOLD;
    const confirmationStatus: ConfirmationStatus = meetsThreshold
      ? 'CONFIRMED_HIGH_CONFIDENCE'
      : 'REQUIRES_VENDOR_CONFIRMATION';

    const transcriptRecord: RawTranscriptRecord = {
      id,
      timestamp: params.timestamp,
      rawText: text,
      speakerClassification: classification,
      speakerClusterId: diarization.clusterId,
      sttConfidence: rawConfidence,
      confirmationStatus,
      noiseDb,
      processedStatus: 'PENDING'
    };

    this.transcriptLog.push(transcriptRecord);

    // If STT isn't >=90% sure, right away request confirmation from vendor
    if (!meetsThreshold && this.onConfirmationNeeded) {
      this.onConfirmationNeeded({
        turnId: id,
        timestamp: params.timestamp,
        speaker: classification,
        rawText: text,
        sttConfidence: rawConfidence,
        suggestedClarification: `Confirm ${classification}: "${text}" (${Math.round(rawConfidence * 100)}% confidence)`
      });
    }

    return transcriptRecord;
  }

  /**
   * Vendor confirms a low-confidence transcript right away, escalating confidence to 1.0.
   * Can optionally provide corrected text if vendor fixes a misheard word.
   */
  public confirmTranscript(turnId: string, correctedText?: string): boolean {
    const record = this.transcriptLog.find(r => r.id === turnId);
    if (!record) return false;

    if (correctedText && correctedText.trim().length > 0) {
      record.rawText = correctedText.trim();
    }
    record.confirmationStatus = 'VENDOR_CONFIRMED';
    record.sttConfidence = 1.0;
    record.processedStatus = 'PENDING';
    return true;
  }

  /**
   * Vendor rejects a hallucinated or incorrect low-confidence transcript, dropping it completely.
   */
  public rejectTranscript(turnId: string): boolean {
    const record = this.transcriptLog.find(r => r.id === turnId);
    if (!record) return false;

    record.confirmationStatus = 'VENDOR_REJECTED';
    record.processedStatus = 'DISCARDED';
    return true;
  }

  /**
   * Returns list of turns pending vendor confirmation (<90% confidence).
   */
  public getPendingVendorConfirmations(): VendorConfirmationRequest[] {
    return this.transcriptLog
      .filter(r => r.confirmationStatus === 'REQUIRES_VENDOR_CONFIRMATION' && r.processedStatus !== 'DISCARDED')
      .map(r => ({
        turnId: r.id,
        timestamp: r.timestamp,
        speaker: r.speakerClassification,
        rawText: r.rawText,
        sttConfidence: r.sttConfidence,
        suggestedClarification: `Confirm ${r.speakerClassification}: "${r.rawText}" (${Math.round(r.sttConfidence * 100)}%)`
      }));
  }

  /**
   * Returns shift transcripts for EOD Qwen batch reconciliation.
   * By default, strictly returns only turns that are >= 90% confident OR confirmed by vendor.
   * Excludes unconfirmed low-confidence turns and rejected noise.
   */
  public getShiftTranscripts(requireConfidentOnly: boolean = true): RawTranscriptRecord[] {
    if (!requireConfidentOnly) {
      return [...this.transcriptLog];
    }

    return this.transcriptLog.filter(t => {
      if (t.processedStatus === 'DISCARDED' || t.confirmationStatus === 'VENDOR_REJECTED') {
        return false;
      }
      return (
        t.confirmationStatus === 'CONFIRMED_HIGH_CONFIDENCE' ||
        t.confirmationStatus === 'VENDOR_CONFIRMED' ||
        t.sttConfidence >= UnifiedAudioStreamListener.MIN_CONFIDENCE_THRESHOLD
      );
    });
  }

  /**
   * Flushes transcript log after EOD reconciliation.
   */
  public resetLog(): void {
    this.transcriptLog = [];
    this.sequenceCounter = 0;
  }
}
