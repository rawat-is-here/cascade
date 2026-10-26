/**
 * Comprehensive Hindi & English Localization Dictionary
 * Tailored for Indian Street Vendors & Mandi Stall Keepers
 */

export type AppLanguage = 'en' | 'hi';

export const TRANSLATIONS = {
  en: {
    // Header
    storeNameDefault: 'Akash Chai & Poha Stall',
    liveInflow: 'LIVE INFLOW',
    totalSales: 'Total sales',
    salesVerifiedToday: 'sales verified today',
    trueAccrual: 'TRUE ACCRUAL',
    margin: 'Margin',
    actualProfit: 'Actual profit',
    cogsDeducted: 'Wholesale COGS deducted',

    // Audio Stream Card
    streamActive: 'Stream Active',
    startStream: 'Start Stream',
    noise: 'Noise',
    vadEnergy: 'VAD ENERGY',
    speechActive: 'SPEECH ACTIVE',
    muted: 'MUTED',
    speaker: 'SPEAKER',
    vendorActive: 'VENDOR (Active)',
    standby: 'STANDBY',
    streamedTurn: 'STREAMED TURN → POST /audio/turn',
    stopStream: 'Stop Stream',
    startStreamBtn: 'Start Stream',

    // Mandi Card
    wholesaleSlipHeader: 'RAW MATERIAL SLIP (MANDI)',
    cameraOcr: 'CAMERA OCR',
    wholesaleCardTitle: 'Raw Material Slip',
    wholesaleCardSub: 'Scan physical paper mandi chits to lock in wholesale rates.',
    noRawMaterialSlip: 'No raw material slip recorded yet',
    scanMandiSlipBtn: 'Scan Mandi Slip (OCR)',
    manualBillBtn: 'Manual Bill',
    recordedCostBasis: 'RECORDED COST BASIS',
    totalCost: 'TOTAL COST',
    supplier: 'Supplier',

    // Today's Net Balance Table
    todaysNetBalance: 'TODAY’S NET BALANCE',
    live: 'LIVE',
    moneyInTotalSales: 'Money in (Total sales)',
    moneyOutExpenses: 'Money out (Expenses)',
    netOperatingBalance: 'Net operating balance',

    // Confirmation Alert
    didYouHearRight: 'Did you hear right?',
    didCustomerAskFor: 'Did the customer ask for',
    yesCorrect: 'Yes, Correct',
    noIgnore: 'No, Ignore',

    // Stall Actions
    stallActionsTitle: 'Stall Actions',
    addStock: 'Add Stock',
    addStockSub: 'Mandi bill',
    customerUdhaar: 'Customer Udhaar',
    customerUdhaarSub: 'Khata register',
    spoiledStock: 'Spoiled Stock',
    spoiledStockSub: 'Heat & lunch',
    closeStall: 'Close Stall',
    closeStallSub: 'Count drawer',
    latentStock: 'Latent Stock',
    latentStockSub: 'Portions & burn',
    prepBurnTag: 'Prep Burn',
    khataLedger: 'Khata & Ledger',
    khataLedgerSub: 'Bills & udhaar',
    pendingTag: 'Pending',
    allInflowsTag: 'All Inflows',
    lossTheftCardTitle: 'Loss & Spoilage',
    lossTheftCardSub: 'Rot, lunch & theft',
    lossTag: 'Loss Split',

    // Bottom Navigation Dock
    home: 'Home',
    expenseReport: 'Expense Report',
    voiceAndNotes: 'Voice & Handwritten',
    profile: 'Profile',
  },
  hi: {
    // Header
    storeNameDefault: 'आकाश चाय एवं पोहा स्टॉल',
    liveInflow: 'लाइव गल्ला',
    totalSales: 'कुल बिक्री',
    salesVerifiedToday: 'सत्यापित बिक्री आज',
    trueAccrual: 'सच्चा मुनाफा',
    margin: 'मार्जिन',
    actualProfit: 'शुद्ध लाभ',
    cogsDeducted: 'थोक खरीद लागत (COGS) काटकर',

    // Audio Stream Card
    streamActive: 'स्ट्रीम चालू है',
    startStream: 'स्ट्रीम शुरू करें',
    noise: 'ध्वनि स्तर',
    vadEnergy: 'आवाज संसूचक',
    speechActive: 'आवाज सक्रिय',
    muted: 'म्यूट',
    speaker: 'वक्ता',
    vendorActive: 'दुकानदार (सक्रिय)',
    standby: 'तैयार',
    streamedTurn: 'स्ट्रीम संवाद → POST /audio/turn',
    stopStream: 'स्ट्रीम रोकें',
    startStreamBtn: 'स्ट्रीम शुरू करें',

    // Mandi Card
    wholesaleSlipHeader: 'कच्चा माल रसीद (मंडी पर्ची)',
    cameraOcr: 'कैमरा ओसीआर',
    wholesaleCardTitle: 'कच्चा माल रसीद (मंडी)',
    wholesaleCardSub: 'थोक खरीद दरें दर्ज करने के लिए मंडी पर्ची स्कैन करें।',
    noRawMaterialSlip: 'अभी तक कोई मंडी पर्ची दर्ज नहीं है',
    scanMandiSlipBtn: 'मंडी पर्ची स्कैन करें (OCR)',
    manualBillBtn: 'हाथ से बिल जोड़ें',
    recordedCostBasis: 'दर्ज थोक खरीद लागत',
    totalCost: 'कुल लागत',
    supplier: 'आपूर्तिकर्ता',

    // Today's Net Balance Table
    todaysNetBalance: 'आज का कुल बैलेंस',
    live: 'लाइव',
    moneyInTotalSales: 'आमदनी (कुल बिक्री)',
    moneyOutExpenses: 'खर्च (दुकान खर्च)',
    netOperatingBalance: 'शुद्ध परिचालन शेष',

    // Confirmation Alert
    didYouHearRight: 'क्या आपने सही सुना?',
    didCustomerAskFor: 'क्या ग्राहक ने मांगा',
    yesCorrect: 'हाँ, बिल्कुल सही',
    noIgnore: 'नहीं, रद्द करें',

    // Stall Actions
    stallActionsTitle: 'दुकान के काम',
    addStock: 'माल जोड़ें',
    addStockSub: 'मंडी बिल',
    customerUdhaar: 'उधार खाता',
    customerUdhaarSub: 'खाता रजिस्टर',
    spoiledStock: 'खराब माल',
    spoiledStockSub: 'गर्मी व नुकसान',
    closeStall: 'दुकान बंद',
    closeStallSub: 'गल्ला मिलान',
    latentStock: 'कच्चा माल (स्टॉक)',
    latentStockSub: 'खपत और तैयारी',
    prepBurnTag: 'किचन खपत',
    khataLedger: 'खाता और बहीखाता',
    khataLedgerSub: 'बिक्री और उधार',
    pendingTag: 'बाकी',
    allInflowsTag: 'सभी आमदनी',
    lossTheftCardTitle: 'नुकसान व चोरी',
    lossTheftCardSub: 'सड़न, खाना व चोरी',
    lossTag: 'नुकसान बंटवारा',

    // Bottom Navigation Dock
    home: 'होम',
    expenseReport: 'खर्च रिपोर्ट',
    voiceAndNotes: 'बोलकर या लिखकर ऑर्डर',
    profile: 'सेटिंग्स',
  }
};

export function getTranslation(lang: AppLanguage) {
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
}
