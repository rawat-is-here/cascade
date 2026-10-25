"""
Offline Speaker Embedding Bridge using ECAPA-TDNN ONNX.
Takes 16kHz PCM audio and outputs a 192-dimensional speaker embedding vector.
Feeds directly into core/linguistics/speaker_diarizer.ts (OnDeviceSpeakerDiarizer).
"""

import os
import sys
import numpy as np

MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "ecapa_tdnn", "ecapa_tdnn.onnx"))

class OfflineSpeakerEmbedder:
    def __init__(self, model_path: str = MODEL_PATH):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"ECAPA-TDNN model not found at {model_path}. Please download it first.")
        
        import onnxruntime as ort
        # CPU Execution Provider for 100% on-device CPU execution
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 2
        self.session = ort.InferenceSession(model_path, opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        print(f"[OK] Loaded ECAPA-TDNN ONNX model. Input: {self.input_name}, Output: {self.output_name}")

    def compute_embedding(self, audio_pcm: np.ndarray, sample_rate: int = 16000) -> list[float]:
        """
        Computes 192-dimensional L2-normalized embedding from raw audio PCM.
        """
        # Ensure float32 normalized [-1.0, 1.0]
        if audio_pcm.dtype != np.float32:
            audio_pcm = audio_pcm.astype(np.float32)
            if np.max(np.abs(audio_pcm)) > 1.0:
                audio_pcm = audio_pcm / 32768.0

        if len(audio_pcm.shape) == 1:
            audio_tensor = np.expand_dims(audio_pcm, axis=0) # [1, T]
        else:
            audio_tensor = audio_pcm

        # Run ONNX inference
        outputs = self.session.run([self.output_name], {self.input_name: audio_tensor})
        raw_emb = outputs[0].squeeze() # [192]

        # L2 Normalize
        norm = np.linalg.norm(raw_emb)
        if norm > 1e-12:
            normalized_emb = (raw_emb / norm).tolist()
        else:
            normalized_emb = raw_emb.tolist()

        return normalized_emb

if __name__ == "__main__":
    print("Testing OfflineSpeakerEmbedder on 1-second synthetic 16kHz audio...")
    embedder = OfflineSpeakerEmbedder()
    dummy_audio = np.random.randn(16000).astype(np.float32) * 0.1
    emb = embedder.compute_embedding(dummy_audio)
    print(f"Computed embedding of length: {len(emb)}")
    print(f"Sample 5 dims: {emb[:5]}")
