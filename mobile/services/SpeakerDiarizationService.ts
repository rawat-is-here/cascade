import { OnDeviceSpeakerDiarizer, type DiarizationResult } from '../../core/linguistics/speaker_diarizer.ts';

/**
 * Mobile Service: Speaker Diarization & Voice Profile Management
 * Exposes 5-second calibration enrollment and live diarization to Expo Go app.
 */
export class MobileSpeakerDiarizationService {
  private diarizer: OnDeviceSpeakerDiarizer;
  private isEnrolled = false;

  constructor() {
    this.diarizer = new OnDeviceSpeakerDiarizer();
  }

  /**
   * One-time 5-second vendor voice enrollment.
   */
  public enrollVendor(sampleEmbeddings: number[][]): boolean {
    try {
      this.diarizer.enrollVendor(sampleEmbeddings);
      this.isEnrolled = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Identifies speaker role (VENDOR vs CUST_xx) for an incoming speech burst.
   */
  public processAudioBurst(embedding: number[]): DiarizationResult {
    return this.diarizer.diarize(embedding);
  }

  public isVendorCalibrated(): boolean {
    return this.isEnrolled;
  }

  public getDiarizer(): OnDeviceSpeakerDiarizer {
    return this.diarizer;
  }
}
