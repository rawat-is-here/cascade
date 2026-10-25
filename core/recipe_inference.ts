export class RecipeTracker {
  history: Array<{
    sales: Record<string, number>;
    burn: Record<string, number>;
  }> = [];

  weights: Record<string, Record<string, number>> = {
    poha: { poha_grain: 110, potato: 35 },
    samosa: { potato: 65 }
  };

  record(sales: Record<string, number>, burn: Record<string, number>) {
    this.history.push({ sales, burn });
    this.adjust();
  }

  adjust() {
    const batch = this.history.slice(-10);
    for (const b of batch) {
      for (const [ingredient, actualBurn] of Object.entries(b.burn)) {
        let expected = 0;
        for (const [dish, count] of Object.entries(b.sales)) {
          const w = this.weights[dish]?.[ingredient] || 40;
          expected += count * w;
        }

        const err = actualBurn - expected;
        const lr = 0.05;

        for (const [dish, count] of Object.entries(b.sales)) {
          if (count > 0) {
            if (!this.weights[dish]) this.weights[dish] = {};
            const current = this.weights[dish][ingredient] || 40;
            const updated = Math.max(10, current + (err / (count + 1)) * lr);
            this.weights[dish][ingredient] = updated;
          }
        }
      }
    }
  }

  getPortion(dish: string, ingredient: string) {
    const val = this.weights[dish]?.[ingredient] || 50;
    const band = val * 0.12;

    let trend: 'shrinking' | 'stable' | 'expanding' = 'stable';
    if (val < 45) trend = 'shrinking';
    if (val > 70) trend = 'expanding';

    return {
      dish,
      ingredient,
      grams: parseFloat(val.toFixed(1)),
      bounds: [
        parseFloat((val - band).toFixed(1)),
        parseFloat((val + band).toFixed(1))
      ],
      trend
    };
  }
}
