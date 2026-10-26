import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onProcessOrder: (spokenPhrase: string) => Promise<void>;
  onAddHandwrittenSlip?: (slip: {
    title: string;
    amount: number;
    isCredit: boolean;
    category: string;
  }) => void;
  loading?: boolean;
}

const SAMPLE_ORDERS = [
  { label: '4kg aloo 80 rupaye me de do', note: 'Dynamic Sale: +₹80.00' },
  { label: '50 rupaye ka tamatar pack kar do', note: 'Value Order: +₹50.00' },
  { label: '2 plate poha 40 rupaye', note: 'Plate Count: +₹40.00' },
  { label: '3 chai 30 rupaye', note: 'Beverage: +₹30.00' },
  { label: 'Sharma ji ka 100 jama kar', note: 'Udhaar Credit: +₹100.00' },
  { label: '4kg aloo kitne ke hue', note: 'Inquiry: ₹0 (No phantom sale)' },
  { label: 'Rehne do bhaiya bahut mehenga hai', note: 'Walkaway: ₹0 (Customer left)' },
  { label: 'Thoda dhaniya mirchi upar se daal do', note: 'Freebie: ₹0 (Stock only)' }
];

const QUICK_COMMODITIES = ['Chai', 'Poha', 'Aloo', 'Tamatar', 'Pyaz', 'Milk', 'Masala', 'Biscuits'];
const QUICK_AMOUNTS = [10, 20, 30, 50, 100, 200, 500];

export const VoiceOrderModal: React.FC<Props> = ({
  visible,
  onClose,
  onProcessOrder,
  onAddHandwrittenSlip,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState<'VOICE' | 'HANDWRITTEN'>('VOICE');

  // Voice Feed State
  const [spokenText, setSpokenText] = useState('');
  const [isSimulatingFeed, setIsSimulatingFeed] = useState(false);

  // Handwritten Slip State
  const [slipTitle, setSlipTitle] = useState('');
  const [slipAmount, setSlipAmount] = useState('');
  const [isCreditSlip, setIsCreditSlip] = useState(true); // true = Inflow (Sale), false = Outflow (Expense)
  const [slipCategory, setSlipCategory] = useState('Chit / Slip Note');

  const handleVoiceSubmit = async (phraseToSubmit?: string) => {
    const query = (phraseToSubmit !== undefined ? phraseToSubmit : spokenText).trim();
    if (!query) return;
    await onProcessOrder(query);
    setSpokenText('');
    onClose();
  };

  const handleSimulateLiveFeed = async () => {
    setIsSimulatingFeed(true);
    // Pick a random realistic street quote
    const randomSample = SAMPLE_ORDERS[Math.floor(Math.random() * SAMPLE_ORDERS.length)];
    setSpokenText(randomSample.label);
    setTimeout(async () => {
      setIsSimulatingFeed(false);
      await onProcessOrder(randomSample.label);
      setSpokenText('');
      onClose();
    }, 1200);
  };

  const handleHandwrittenSubmit = () => {
    const rawAmt = parseFloat(slipAmount);
    if (isNaN(rawAmt) || rawAmt <= 0) return;

    const title = slipTitle.trim() || (isCreditSlip ? 'Handwritten Stall Sale' : 'Stall Expense Chit');

    if (onAddHandwrittenSlip) {
      onAddHandwrittenSlip({
        title,
        amount: rawAmt,
        isCredit: isCreditSlip,
        category: slipCategory
      });
    } else {
      // Fallback to process order string
      const phrase = `${title} ${rawAmt} rupaye ${isCreditSlip ? 'nakad' : 'kharcha'}`;
      onProcessOrder(phrase);
    }

    setSlipTitle('');
    setSlipAmount('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <View style={styles.iconCircle}>
                  <Ionicons name={activeTab === 'VOICE' ? 'mic' : 'create'} size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>
                    {activeTab === 'VOICE' ? 'Voice Audio Feed' : 'Handwritten Entry'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {activeTab === 'VOICE'
                      ? 'Live Speech Stream & Indic NLP Lexer'
                      : 'Record Paper Chits & Pen Notes into Ledger'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Segmented Mode Selector */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'VOICE' && styles.tabButtonActive]}
                onPress={() => setActiveTab('VOICE')}
              >
                <Ionicons
                  name="mic"
                  size={16}
                  color={activeTab === 'VOICE' ? '#073B3A' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === 'VOICE' && styles.tabTextActive]}>
                  Voice Feed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'HANDWRITTEN' && styles.tabButtonActive]}
                onPress={() => setActiveTab('HANDWRITTEN')}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={activeTab === 'HANDWRITTEN' ? '#073B3A' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === 'HANDWRITTEN' && styles.tabTextActive]}>
                  Handwritten Slip
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: VOCAL FEED MODE ONLY */}
            {activeTab === 'VOICE' && (
              <View>
                {/* Live Microphone Vocal Feed Card */}
                <View style={styles.streamHeroCard}>
                  <View style={styles.streamHeroTop}>
                    <View style={styles.streamStatusBadge}>
                      <View style={[styles.pulseDot, isSimulatingFeed && styles.pulseDotActive]} />
                      <Text style={styles.streamStatusText}>
                        {isSimulatingFeed ? 'STREAM RECORDING ACTIVE' : 'MIC STREAM READY'}
                      </Text>
                    </View>
                    <Text style={styles.streamHzText}>16kHz PCM / Mono</Text>
                  </View>

                  {/* Concentric Microphone Radar Visualizer */}
                  <View style={styles.vocalRadarCenter}>
                    <View style={[styles.radarOuterRing, isSimulatingFeed && styles.radarOuterRingActive]}>
                      <View style={[styles.radarInnerRing, isSimulatingFeed && styles.radarInnerRingActive]}>
                        <View style={styles.radarMicCircle}>
                          <Ionicons
                            name={isSimulatingFeed ? 'radio' : 'mic'}
                            size={34}
                            color="#073B3A"
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.waveformRow}>
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 26 : 14 }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 42 : 24 }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 56 : 38, backgroundColor: '#E2FD52' }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 38 : 22 }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 60 : 44, backgroundColor: '#E2FD52' }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 42 : 32 }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 26 : 18 }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 48 : 28, backgroundColor: '#E2FD52' }]} />
                    <View style={[styles.waveBar, { height: isSimulatingFeed ? 22 : 16 }]} />
                  </View>

                  {/* Real-time Spoken Text Readout / Guidance */}
                  <View style={styles.vocalStatusBox}>
                    <Text style={styles.vocalStatusHeading}>
                      {isSimulatingFeed
                        ? 'LISTENING TO STREET SPOKEN TURN...'
                        : 'READY FOR VOCAL INPUT'}
                    </Text>
                    <Text style={styles.vocalStatusSub}>
                      {isSimulatingFeed
                        ? (spokenText ? `“${spokenText}”` : 'Capturing stall speech stream...')
                        : 'Speak naturally in Hindi, Hinglish, or English. Stall background noise is automatically filtered.'}
                    </Text>
                  </View>

                  {/* Primary Vocal Feed Action Button */}
                  <TouchableOpacity
                    style={[styles.streamTriggerBtn, isSimulatingFeed && styles.streamTriggerBtnActive]}
                    onPress={handleSimulateLiveFeed}
                    disabled={isSimulatingFeed || loading}
                  >
                    {isSimulatingFeed || loading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator color="#073B3A" size="small" style={{ marginRight: 10 }} />
                        <Text style={styles.streamTriggerBtnText}>
                          {loading ? 'Posting to Stall Ledger...' : 'Listening to Vocal Feed...'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="mic" size={22} color="#073B3A" style={{ marginRight: 8 }} />
                        <Text style={styles.streamTriggerBtnText}>Capture Live Vocal Turn</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Acoustic Noise Shield Badges */}
                  <View style={styles.vocalBadgesRow}>
                    <View style={styles.vocalBadge}>
                      <Ionicons name="shield-checkmark" size={13} color="#E2FD52" style={{ marginRight: 4 }} />
                      <Text style={styles.vocalBadgeText}>Noise Shield: ECAPA-TDNN</Text>
                    </View>
                    <View style={styles.vocalBadge}>
                      <Ionicons name="flash-outline" size={13} color="#E2FD52" style={{ marginRight: 4 }} />
                      <Text style={styles.vocalBadgeText}>Indic Lexer: Real-time</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* TAB 2: HANDWRITTEN SLIP MODE */}
            {activeTab === 'HANDWRITTEN' && (
              <View>
                {/* Stall Slip Notepad Card */}
                <View style={styles.notepadCard}>
                  <View style={styles.notepadHeader}>
                    <View style={styles.notepadRedDot} />
                    <Text style={styles.notepadTitle}>STALL PEN & PAPER CHIT</Text>
                    <Text style={styles.notepadDate}>
                      {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>

                  {/* Flow Direction Toggle (Sale vs Expense) */}
                  <View style={styles.flowToggleRow}>
                    <TouchableOpacity
                      style={[styles.flowBtn, isCreditSlip && styles.flowBtnIncome]}
                      onPress={() => setIsCreditSlip(true)}
                    >
                      <Ionicons
                        name="arrow-down-circle"
                        size={16}
                        color={isCreditSlip ? '#073B3A' : '#6B7280'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.flowBtnText, isCreditSlip && styles.flowBtnTextActive]}>
                        Customer Sale (+)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.flowBtn, !isCreditSlip && styles.flowBtnExpense]}
                      onPress={() => setIsCreditSlip(false)}
                    >
                      <Ionicons
                        name="arrow-up-circle"
                        size={16}
                        color={!isCreditSlip ? '#FFFFFF' : '#6B7280'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.flowBtnText, !isCreditSlip && styles.flowBtnTextExpenseActive]}>
                        Cash Expense (-)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Item Description Field */}
                  <Text style={styles.fieldLabel}>ITEM OR CUSTOMER NOTE</Text>
                  <TextInput
                    style={styles.notepadInput}
                    placeholder="e.g. Ramesh Chai, 5kg Aloo, Daily Milk..."
                    placeholderTextColor="#9CA3AF"
                    value={slipTitle}
                    onChangeText={setSlipTitle}
                  />

                  {/* Amount Field */}
                  <Text style={styles.fieldLabel}>TOTAL AMOUNT (₹)</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.rupeeSign}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={slipAmount}
                      onChangeText={setSlipAmount}
                    />
                  </View>

                  {/* Quick Produce Chips */}
                  <Text style={styles.quickLabel}>QUICK ITEMS</Text>
                  <View style={styles.quickChipsRow}>
                    {QUICK_COMMODITIES.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.quickChip}
                        onPress={() => {
                          setSlipTitle(prev => (prev ? `${prev}, ${item}` : item));
                        }}
                      >
                        <Text style={styles.quickChipText}>+{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Quick Amount Chips */}
                  <Text style={styles.quickLabel}>QUICK RUPEES</Text>
                  <View style={styles.quickChipsRow}>
                    {QUICK_AMOUNTS.map((amt, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.quickChipAmount}
                        onPress={() => {
                          const current = parseFloat(slipAmount) || 0;
                          setSlipAmount((current + amt).toString());
                        }}
                      >
                        <Text style={styles.quickChipAmountText}>+₹{amt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.postSlipBtn,
                      (!slipAmount || parseFloat(slipAmount) <= 0) && styles.postSlipBtnDisabled
                    ]}
                    onPress={handleHandwrittenSubmit}
                    disabled={!slipAmount || parseFloat(slipAmount) <= 0}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#073B3A" style={{ marginRight: 8 }} />
                    <Text style={styles.postSlipBtnText}>
                      Post ₹{slipAmount || '0'} to Stall Ledger
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 59, 58, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#073B3A',
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },

  /* TAB BAR */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#073B3A',
  },

  /* STREAM HERO CARD */
  streamHeroCard: {
    backgroundColor: '#073B3A',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  streamHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  streamStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(226, 253, 82, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2FD52',
    marginRight: 6,
  },
  streamStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E2FD52',
    letterSpacing: 0.6,
  },
  streamHzText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginBottom: 14,
  },
  waveBar: {
    width: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
  },
  streamTriggerBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamTriggerBtnActive: {
    backgroundColor: '#C5E035',
  },
  streamTriggerBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
  },

  /* RADAR & VOCAL VISUALIZER */
  vocalRadarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  radarOuterRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: 'rgba(226, 253, 82, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarOuterRingActive: {
    backgroundColor: 'rgba(226, 253, 82, 0.22)',
  },
  radarInnerRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(226, 253, 82, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInnerRingActive: {
    backgroundColor: 'rgba(226, 253, 82, 0.4)',
  },
  radarMicCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E2FD52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  pulseDotActive: {
    backgroundColor: '#FFFFFF',
  },
  vocalStatusBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 253, 82, 0.15)',
    alignItems: 'center',
  },
  vocalStatusHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2FD52',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  vocalStatusSub: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  vocalBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  vocalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  vocalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },

  /* NOTEPAD / HANDWRITTEN SLIP STYLING */
  notepadCard: {
    backgroundColor: '#FAFAF7',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E2D8',
    marginBottom: 16,
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  notepadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECE0',
  },
  notepadRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  notepadTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#55554B',
    letterSpacing: 0.8,
    flex: 1,
  },
  notepadDate: {
    fontSize: 11,
    color: '#8A8A7A',
    fontWeight: '700',
  },
  flowToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  flowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  flowBtnIncome: {
    backgroundColor: '#E2FD52',
    borderColor: '#D4EE3C',
  },
  flowBtnExpense: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  flowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  flowBtnTextActive: {
    color: '#073B3A',
    fontWeight: '800',
  },
  flowBtnTextExpenseActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  notepadInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#D8D8CA',
    marginBottom: 12,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8D8CA',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  rupeeSign: {
    fontSize: 18,
    fontWeight: '800',
    color: '#073B3A',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    paddingVertical: 10,
  },
  quickLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8A8A7A',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  quickChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D8D8CA',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#073B3A',
  },
  quickChipAmount: {
    backgroundColor: '#F1FFE5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#C6E8A8',
  },
  quickChipAmountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#275200',
  },
  postSlipBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  postSlipBtnDisabled: {
    opacity: 0.5,
  },
  postSlipBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073B3A',
  },
});
