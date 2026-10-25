import { LossReport } from '../shared/types';

export class LossEstimator {
  estimate(
    item: string,
    lostQty: number,
    unit: string,
    env: {
      temp: number;
      hrs: number;
      hour: number;
      devices: number;
    }
  ): LossReport {
    // heat rot rate
    const heatDelta = Math.max(0, env.temp - 28);
    const rotSpeed = 0.03 + (heatDelta * 0.015);
    const spoilRaw = 1.0 - Math.exp(-rotSpeed * env.hrs);

    // eating around lunch time
    const lunchDist = Math.abs(env.hour - 13.5);
    const lunchCurve = Math.exp(-Math.pow(lunchDist, 2) / 3.0);
    const famPresence = Math.min(1.0, env.devices * 0.35);
    const eatRaw = 0.2 + (lunchCurve * 0.6 * (0.4 + famPresence));

    const theftRaw = 0.15;

    const sum = spoilRaw + eatRaw + theftRaw;
    const spoilShare = parseFloat((spoilRaw / sum).toFixed(3));
    const eatShare = parseFloat((eatRaw / sum).toFixed(3));
    const theftShare = parseFloat((theftRaw / sum).toFixed(3));

    const spread = lostQty * 0.1;
    const range: [number, number] = [
      parseFloat((lostQty - spread).toFixed(2)),
      parseFloat((lostQty + spread).toFixed(2))
    ];

    return {
      item,
      lostQty,
      unit,
      spoilage: spoilShare,
      eating: eatShare,
      theft: theftShare,
      range
    };
  }
}
