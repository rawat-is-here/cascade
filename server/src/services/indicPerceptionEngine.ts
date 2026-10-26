import { getGeminiApiKey } from '../core/security/vault/keyManager';

export interface IndicParsedSlipItem {
  name: string;
  quantityKg: number;
  ratePerKg: number;
  totalCost: number;
}

export interface IndicParsedSlip {
  mandiName: string;
  slipNo: string;
  date: string;
  items: IndicParsedSlipItem[];
  totalBill: number;
  rawText: string;
  paymentMethod: string;
}

export interface IndicAcousticResult {
  text: string;
  speaker: 'VENDOR' | 'CUSTOMER';
  confidence: number;
  noiseDb: number;
  intent?: {
    action: 'SALE' | 'EXPENSE' | 'UDHAAR_CREDIT' | 'INQUIRY' | 'OTHER';
    item?: string;
    quantity?: number;
    amount?: number;
  };
}

/**
 * Indic Neural Perception Engine
 * Multi-tiered acoustic and vision pipeline tailored for Indian street vendor environments.
 * Dispatches to high-throughput Indic neural models with automatic multi-candidate failover.
 */
export class IndicPerceptionEngine {
  private static readonly CANDIDATE_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
  ];
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  public static isConfigured(): boolean {
    const key = getGeminiApiKey();
    return Boolean(key && key.trim().length > 10);
  }

  /**
   * Internal model dispatch with automatic candidate failover
   */
  private static async executePerceptionPipeline(payload: any): Promise<string | null> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.warn('[PerceptionEngine] Neural acoustic key not initialized in vault.');
      return null;
    }

    for (const model of this.CANDIDATE_MODELS) {
      try {
        const endpoint = `${this.API_BASE}/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const jsonResp: any = await res.json();
          const candidateText = jsonResp?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            return candidateText;
          }
        } else {
          const errText = await res.text();
          console.warn(`[PerceptionEngine] Pipeline candidate ${model} status ${res.status}: ${errText.slice(0, 100)}`);
        }
      } catch (err: any) {
        console.warn(`[PerceptionEngine] Pipeline candidate ${model} network error:`, err?.message || err);
      }
    }

    return null;
  }

  /**
   * Physical Wholesale Mandi Slip Perception
   */
  public static async parseWholesaleSlip(imageBase64: string): Promise<IndicParsedSlip | null> {
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
      const prompt = `You are an expert Indic perception engine for wholesale agricultural mandi slips and handwritten vegetable market invoices.
Extract all purchased commodities into a structured JSON object.
Rules:
1. Translate Hindi/slang commodity names into clean standard terms (e.g., Tomatoes, Potatoes, Onions, Ginger, Garlic, Coriander).
2. Compute quantity in kg (quantityKg), rate per kg in INR (ratePerKg), and line total in INR (totalCost).
3. If rates or quantities are in Devanagari numerals (१, २, ३, ४, ५, etc.), convert them accurately.
4. TotalBill MUST equal the exact sum of all item totalCosts.

Output STRICTLY valid JSON:
{
  "mandiName": "Name of Mandi or Wholesale Trader (or 'Wholesale Mandi')",
  "slipNo": "Invoice/Slip number (or 'MND-AUTO')",
  "items": [
    {
      "name": "Tomatoes",
      "quantityKg": 50,
      "ratePerKg": 24,
      "totalCost": 1200
    }
  ],
  "totalBill": 1200,
  "rawText": "Extracted text summary from the receipt"
}`;

      const payload = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: cleanBase64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      };

      const candidateText = await this.executePerceptionPipeline(payload);
      if (!candidateText) return null;

      const cleaned = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const items: IndicParsedSlipItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: any) => ({
            name: String(it.name || 'Commodity'),
            quantityKg: Number(it.quantityKg || it.quantity || 1),
            ratePerKg: Number(it.ratePerKg || it.rate || 0),
            totalCost: Number(it.totalCost || (Number(it.quantityKg || 1) * Number(it.ratePerKg || 0)))
          }))
        : [];

      const totalBill = Number(parsed.totalBill) || items.reduce((sum, it) => sum + it.totalCost, 0);

      return {
        mandiName: parsed.mandiName || 'Krishi Upaj Mandi Samiti',
        slipNo: parsed.slipNo || `MND-${Math.floor(10000 + Math.random() * 90000)}`,
        date: `Today, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        items,
        totalBill,
        rawText: parsed.rawText || 'Processed via Indic Perception Pipeline',
        paymentMethod: 'Cash Paid from Drawer'
      };
    } catch (err: any) {
      console.warn('[PerceptionEngine] Mandi slip parse exception:', err?.message || err);
      return null;
    }
  }

  /**
   * Indic Acoustic Stream Speech Recognition & Diarization
   */
  public static async transcribeAcousticStream(
    audioBase64: string,
    mimeType: string = 'audio/wav'
  ): Promise<IndicAcousticResult | null> {
    try {
      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
      let apiMime = mimeType;
      if (apiMime === 'audio/m4a') apiMime = 'audio/mp4';

      const prompt = `You are an Indic speech recognition model for Indian street stalls (vegetable vendors / chai tapris).
Transcribe this spoken audio accurately. The speaker may be speaking in Hindi, Hinglish, or Indian English with background market noise.
1. Transcribe the exact words spoken. If the audio is silence or background ambient noise without speech, output empty text ("text": "").
2. Classify speaker: 'VENDOR' or 'CUSTOMER'.
3. Assign an acoustic confidence score from 0.10 to 1.00:
   - 0.90 to 0.99 for clear speech.
   - 0.50 to 0.89 for noisy or ambiguous speech.
4. Extract transaction intent if present (action: SALE, EXPENSE, UDHAAR_CREDIT, INQUIRY, OTHER).

Output STRICTLY valid JSON:
{
  "text": "Transcribed Hindi/Hinglish phrase",
  "speaker": "VENDOR" or "CUSTOMER",
  "confidence": 0.95,
  "noiseDb": 62,
  "intent": {
    "action": "SALE",
    "item": "Tomatoes",
    "quantity": 2,
    "amount": 60
  }
}`;

      const payload = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: apiMime,
                  data: cleanBase64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      };

      const candidateText = await this.executePerceptionPipeline(payload);
      if (!candidateText) return null;

      const cleaned = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        text: String(parsed.text || '').trim(),
        speaker: parsed.speaker === 'VENDOR' ? 'VENDOR' : 'CUSTOMER',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.92,
        noiseDb: typeof parsed.noiseDb === 'number' ? parsed.noiseDb : 60,
        intent: parsed.intent
      };
    } catch (err: any) {
      console.warn('[PerceptionEngine] Acoustic transcribe exception:', err?.message || err);
      return null;
    }
  }

  /**
   * Indic Semantic Utterance Understanding
   */
  public static async interpretSpokenTurn(
    spokenText: string
  ): Promise<IndicAcousticResult | null> {
    try {
      const prompt = `Analyze this spoken street vendor turn: "${spokenText}"
1. Detect if it was spoken by VENDOR or CUSTOMER.
2. Determine if it is a transaction, inquiry, walkaway, or banter.
3. If it contains a transaction, extract action (SALE, EXPENSE, UDHAAR_CREDIT, INQUIRY, OTHER), item name, quantity, and amount in INR.

Output STRICTLY valid JSON:
{
  "text": "${spokenText.replace(/"/g, '\\"')}",
  "speaker": "VENDOR" or "CUSTOMER",
  "confidence": 0.95,
  "noiseDb": 58,
  "intent": {
    "action": "SALE",
    "item": "Tomatoes",
    "quantity": 1,
    "amount": 30
  }
}`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      };

      const candidateText = await this.executePerceptionPipeline(payload);
      if (!candidateText) return null;

      const cleaned = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        text: spokenText,
        speaker: parsed.speaker === 'VENDOR' ? 'VENDOR' : 'CUSTOMER',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
        noiseDb: typeof parsed.noiseDb === 'number' ? parsed.noiseDb : 58,
        intent: parsed.intent
      };
    } catch {
      return null;
    }
  }
}
