"""
Team Cascade: Offline AI Microservice
Hosts:
1. ECAPA-TDNN ONNX: Speaker Embedding extraction (POST /api/ai/embed) -> 192-dim vector
2. Qwen2.5-0.5B-Instruct GGUF: EOD Dialogue Reasoning (POST /api/ai/reason) -> Dynamic rate & qty
"""

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np

app = FastAPI(title="Cascade Offline AI Engine", version="1.0.0")

# Lazy-loaded singletons
_embedder = None
_qwen = None

def get_embedder():
    global _embedder
    if _embedder is None:
        from speaker_embedding_bridge import OfflineSpeakerEmbedder
        _embedder = OfflineSpeakerEmbedder()
    return _embedder

def get_qwen():
    global _qwen
    if _qwen is None:
        from qwen_offline_reasoner import OfflineQwenInterpreter
        _qwen = OfflineQwenInterpreter()
    return _qwen

class EmbeddingRequest(BaseModel):
    audio_pcm: list[float]  # 16kHz PCM audio samples [-1.0 to 1.0]

class ReasoningRequest(BaseModel):
    dialogue: str

@app.get("/health")
def health():
    return {
        "status": "online",
        "ecapa_onnx_ready": os.path.exists("models/ecapa_tdnn/ecapa_tdnn.onnx"),
        "qwen_gguf_ready": os.path.exists("models/qwen/qwen2.5-0.5b-instruct-q4_k_m.gguf")
    }

@app.post("/api/ai/embed")
def embed_speaker(req: EmbeddingRequest):
    try:
        embedder = get_embedder()
        audio_arr = np.array(req.audio_pcm, dtype=np.float32)
        emb = embedder.compute_embedding(audio_arr)
        return {"embedding": emb, "dimension": len(emb)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/reason")
def reason_eod(req: ReasoningRequest):
    try:
        qwen = get_qwen()
        result = qwen.interpret_dialogue_session(req.dialogue)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
