"""
Offline Qwen2.5-0.5B-Instruct Reasoner using llama-cpp-python.
Loads the GGUF model offline and extracts dynamic rates, quantities, and concessions.
CRITICAL LAWS:
1. Zero Pre-configured Retail Prices.
2. Math is decoupled: Code calculates R * Q.
"""

import os
import json
from llama_cpp import Llama

QWEN_MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "qwen", "qwen2.5-0.5b-instruct-q4_k_m.gguf"))

class OfflineQwenInterpreter:
    def __init__(self, model_path: str = QWEN_MODEL_PATH):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Qwen GGUF model not found at {model_path}.")
        
        print(f"[*] Initializing Offline Qwen2.5-0.5B-Instruct from {model_path}...")
        self.llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_threads=4,
            verbose=False
        )
        print("[OK] Qwen2.5-0.5B-Instruct loaded into RAM.")

    def interpret_dialogue_session(self, formatted_dialogue: str) -> dict:
        system_prompt = (
            "You are an offline Indian street food accounting engine.\n"
            "Extract sales transactions from dialogue without pre-configured prices.\n"
            "Rules:\n"
            "1. If vendor says '40 ka diya' and customer says '30 ka lagao' and vendor says 'ok', agreed rate is 30.\n"
            "2. Extract item, agreed_rate, quantity, and unit.\n"
            "Respond strictly in JSON with format: {\"item\": string, \"agreed_rate\": float, \"quantity\": float, \"unit\": string}"
        )

        prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{formatted_dialogue}<|im_end|>\n<|im_start|>assistant\n"

        response = self.llm(
            prompt,
            max_tokens=150,
            temperature=0.1,
            stop=["<|im_end|>"]
        )

        raw_output = response["choices"][0]["text"].strip()
        return {
            "raw_output": raw_output,
            "dialogue": formatted_dialogue
        }

if __name__ == "__main__":
    dialogue = (
        "Customer: tamatar kitne ka\n"
        "Vendor: 40 ka diya\n"
        "Customer: nahi 30 ka lagao\n"
        "Vendor: ok le jao\n"
        "Customer: aadha kilo kar do"
    )
    print("Testing Offline Qwen interpretation on street dialogue:")
    print(dialogue)
    print("-------------------------------------------------------")
    interpreter = OfflineQwenInterpreter()
    result = interpreter.interpret_dialogue_session(dialogue)
    print("Qwen Response:")
    print(result["raw_output"])
