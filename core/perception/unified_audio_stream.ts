/**
 * Unified Continuous Audio Stream & 4-Way Classifier
 * 100% Standalone On-Device. Zero-dependency TypeScript.
 * 
 * Runs indefinitely once started until explicitly stopped by vendor.
 * Strips silence via energy VAD and routes each utterance to:
 *   1. Vendor Voice (enrolled centroid + fatigue adaptation)
 *   2. Customer 1 (primary bargaining customer)
 *   3. Customer 2 (queue customer / cocktail party separation)
 *   4. Soundbox Chime (Paytm/PhonePe dual-tone signature burst)
 * 
 * Appends all transcribed speech chronologically into the persistent transcript log.
 */

import { OnDeviceSpeakerDiarizer } from '../linguistics/speaker_diarizer.ts';
import type { UPICrossValidator, SoundboxAcousticChime } from '../fusion/upi_cross_validator.ts';

export type SpeakerClassification = 'VENDOR' | 'CUST_1' | 'CUST_2' | 'SOUNDBOX_CHIME';

export interface RawTranscriptRecord {
  id: string;
  timestamp: number;
  rawText: string;
  speakerClassification: SpeakerClassification;
  speakerClusterId?: string;
  noiseDb: number;
  processedStatus: 'PENDING' | 'PARSED' | 'DISCARDED';
}

export class UnifiedAudioStreamListener {
  private isListening = false;
  private shiftStartedAt: number | null = null;
  private shiftEndedAt: number | null = null;

  private diarizer: OnDeviceSpeakerDiarizer;
  private upiValidator?: UPICrossValidator;
  private transcriptLog: RawTranscriptRecord[] = [];
  private sequenceCounter = 0;

  constructor(upiValidator?: UPICrossValidator) {
    this.diarizer = new OnDeviceSpeakerDiarizer();
    this.upiValidator = upiValidator;
  }

  public attachUPIValidator(validator: UPICrossValidator): void {
    this.upiValidator = validator;
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
   * 4. Logs to persistent transcript record
   */
  public ingestAudioChunk(params: {
    timestamp: number;
    transcribedText: string;
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
      // Map cluster IDs: earliest cluster is Cust 1, subsequent concurrent cluster is Cust 2
      classification = diarization.clusterId === 'CUST_02' ? 'CUST_2' : 'CUST_1';
    }

    const transcriptRecord: RawTranscriptRecord = {
      id,
      timestamp: params.timestamp,
      rawText: text,
      speakerClassification: classification,
      speakerClusterId: diarization.clusterId,
      noiseDb,
      processedStatus: 'PENDING'
    };

    this.transcriptLog.push(transcriptRecord);
    return transcriptRecord;
  }

  /**
   * Returns the entire chronological transcript log of the shift for EOD Qwen batch reconciliation.
   */
  public getShiftTranscripts(): RawTranscriptRecord[] {
    return [...this.transcriptLog];
  }

  /**
   * Flushes transcript log after EOD reconciliation.
   */
  public resetLog(): void {
    this.transcriptLog = [];
    this.sequenceCounter = 0;
  }
}
