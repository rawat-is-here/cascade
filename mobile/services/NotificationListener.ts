import type { ParsedUPINotification } from '../../shared/types.ts';

/**
 * Mobile Service: Android Notification & UPI SMS Listener
 * Extracts amount, UPI reference RRN, and payer details from status-bar alerts.
 */
export class MobileNotificationListenerService {
  /**
   * Parses raw notification text into a structured, idempotent UPI transaction object.
   */
  public static parseNotification(rawText: string, appSource = 'AUTO'): ParsedUPINotification | null {
    const text = rawText.trim();
    if (!text) return null;

    let sourceApp: ParsedUPINotification['sourceApp'] = 'PAYTM';
    if (/phonepe/i.test(text) || appSource === 'PHONEPE') {
      sourceApp = 'PHONEPE';
    } else if (/gpay|google\s*pay/i.test(text) || appSource === 'GPAY') {
      sourceApp = 'GPAY';
    } else if (/credited|debited|a\/c|bank|sbi|hdfc|icici/i.test(text)) {
      sourceApp = 'BANK_SMS';
    }

    // Extract Amount (e.g. "₹40", "INR 40.00", "40 rupaye", "Rs. 140")
    const amtRegex = /(?:(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?))|(\d+(?:\.\d+)?)\s*(?:rupaye|rs|prapt\s*hue|received)/i;
    const match = text.match(amtRegex);
    if (!match) return null;

    const amount = parseFloat(match[1] || match[2]);
    if (isNaN(amount) || amount <= 0) return null;

    // Extract UPI Reference (RRN / Ref ID) for strict idempotency
    const refMatch = text.match(/(?:ref(?:\s*no\.?|erence)?|rrn|txn\s*id)[\s:]*([A-Za-z0-9]{8,16})/i);
    const refId = refMatch 
      ? refMatch[1].toUpperCase() 
      : `UPI-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Extract Payer Name if available (e.g. "from R Sharma", "by Sharma")
    const payerMatch = text.match(/(?:from|by|received\s*from)\s+([A-Za-z\s]+?)(?:\s*(?:on|ref|\.|$))/i);
    const payerName = payerMatch ? payerMatch[1].trim() : undefined;

    return {
      notificationId: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      sourceApp,
      amount,
      refId,
      payerName,
      receivedAt: Date.now()
    };
  }
}
