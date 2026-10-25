import { VendorEvent, TxPosting } from '../shared/types';

export class LexiconParser {
  vocab: Record<string, string> = {
    tamatar: 'tomato',
    aloo: 'potato',
    poha: 'poha',
    doodh: 'milk',
    chai: 'tea',
    pyaaz: 'onion'
  };

  addWord(slang: string, word: string) {
    this.vocab[slang.toLowerCase()] = word.toLowerCase();
  }

  parse(text: string, clock = 1): VendorEvent {
    const list: TxPosting[] = [];
    const str = text.toLowerCase();

    // 1. purchase match
    const pMatch = str.match(/(\d+)\s*(kilo|kg|pao|gram)\s*([a-z]+)\s*(?:liya|kharida)?\s*(?:mein)?\s*(\d+)/i);
    if (pMatch) {
      const qty = parseFloat(pMatch[1]);
      const raw = pMatch[3];
      const cost = parseFloat(pMatch[4]);
      const item = this.vocab[raw] || raw;

      list.push({
        debit: 'inventory',
        credit: 'cash',
        amount: cost,
        item,
        qty,
        unit: pMatch[2],
        confidence: 0.94
      });
    }

    // 2. credit match
    const cMatch = str.match(/([a-z]+(?:\s*ji)?)\s*ka\s*(\d+)\s*(?:jama|bheja|diya)/i);
    if (cMatch) {
      list.push({
        debit: 'cash',
        credit: 'credit',
        amount: parseFloat(cMatch[2]),
        alias: cMatch[1].trim(),
        confidence: 0.91
      });
    }

    // 3. order match
    const sMatch = str.match(/(\d+)\s*(plate|cup|glass)\s*([a-z]+)/i);
    if (sMatch) {
      const plates = parseFloat(sMatch[1]);
      const dish = sMatch[3];
      const rate = dish === 'poha' ? 20 : (dish === 'chai' ? 10 : 25);

      list.push({
        debit: 'cash',
        credit: 'sales',
        amount: plates * rate,
        item: dish,
        qty: plates,
        unit: sMatch[2],
        confidence: 0.89
      });
    }

    return {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'speech',
      raw: text,
      entries: list,
      timestamp: Date.now(),
      clock
    };
  }
}
