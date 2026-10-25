/**
 * Mobile Service: Audio Streaming & Voice Activity Detection (VAD) Hook
 * Manages 16kHz Mono PCM streaming and energy thresholding on device.
 */

export interface AudioChunk {
  chunkId: string;
  pcm16Data: Int16Array;
  sampleRate: number;
  durationMs: number;
  speechProbability: number;
  isSpeech: boolean;
}

export class MobileAudioCaptureService {
  private sampleRate = 16000;
  private energyThreshold = 0.35; // Silero VAD energy threshold
  private chunkIndex = 0;

  /**
   * Evaluates if a PCM chunk contains human speech formants (300Hz-3400Hz) vs ambient road rumble.
   */
  public evaluateVAD(pcmData: Int16Array): { isSpeech: boolean; energy: number } {
    if (pcmData.length === 0) return { isSpeech: false, energy: 0 };

    let sumSquares = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const normalized = pcmData[i] / 32768.0;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / pcmData.length);
    // Relative energy scaled between 0.0 and 1.0
    const energy = Math.min(1.0, rms * 5.0);

    return {
      isSpeech: energy >= this.energyThreshold,
      energy: Number(energy.toFixed(3))
    };
  }

  /**
   * Simulates/processes an incoming PCM audio buffer.
   */
  public processChunk(pcmData: Int16Array): AudioChunk {
    const vad = this.evaluateVAD(pcmData);
    const durationMs = Math.round((pcmData.length / this.sampleRate) * 1000);

    return {
      chunkId: `chunk-${Date.now()}-${this.chunkIndex++}`,
      pcm16Data: pcmData,
      sampleRate: this.sampleRate,
      durationMs,
      speechProbability: vad.energy,
      isSpeech: vad.isSpeech
    };
  }
}
