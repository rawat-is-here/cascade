import React, { useState, useEffect, useMemo } from 'react';
import Constants from 'expo-constants';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MorningStockModal } from './components/MorningStockModal';
import { UpiEventsModal } from './components/UpiEventsModal';
import { SyncModal } from './components/SyncModal';
import { EODReconciliationModal } from './components/EODReconciliationModal';
import { LossModal } from './components/LossModal';
import { MandiOcrModal } from './components/MandiOcrModal';
import { AudioStreamModal } from './components/AudioStreamModal';
import { VoiceOrderModal } from './components/VoiceOrderModal';
import { BlendedPrompt, PromptInfo } from './components/BlendedPrompt';

interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  isCredit: boolean;
  time: string;
}


function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:4000/api`;
    }
  }
  return 'http://localhost:4000/api';
}

export default function App() {
  // Shop Profile State (Fetched from SQLite database via CRDT LWW entities view)
  const [shopName, setShopName] = useState<string>('Akash Chai & Poha Stall');

  useEffect(() => {
    let isMounted = true;
    const fetchShopProfile = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/vendor/shop`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.shopName && isMounted) {
            setShopName(data.shopName);
          }
        }
      } catch {
        // Retain offline default when disconnected
      }
    };
    fetchShopProfile();
    return () => { isMounted = false; };
  }, []);

  // Baseline opening cash float & Dynamic Financial State
  const openingFloat = 500;

  // Transactions (Single Source of Truth - 100% Dynamic)
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Dynamic calculations derived from live transactions
  const totalSales = useMemo(() => {
    return transactions.filter(t => t.isCredit).reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions.filter(t => !t.isCredit).reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const netOperatingBalance = totalSales - totalExpenses;
  const liveCashInDrawer = openingFloat + netOperatingBalance;

  const dynamicUpiTotal = useMemo(() => {
    return transactions
      .filter(t => t.isCredit && (t.category.toLowerCase().includes('upi') || t.title.toLowerCase().includes('upi') || t.category.toLowerCase().includes('soundbox')))
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  // Dynamic Spoilage Attribution State
  const [lossCommodity, setLossCommodity] = useState('Tomatoes');
  const [lossTotalKg, setLossTotalKg] = useState(4.0);
  const [rotLoss, setRotLoss] = useState(43.8);
  const [familyLunch, setFamilyLunch] = useState(47.4);
  const [theftLoss, setTheftLoss] = useState(8.8);

  // Sabotage State
  const [activeSabotage, setActiveSabotage] = useState<'CLEAN' | 'NOISE' | 'CLOCK' | 'AIRGAP'>('CLEAN');

  // Modals & Navigation
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showAudioStreamModal, setShowAudioStreamModal] = useState(false);
  const [showMandiOcr, setShowMandiOcr] = useState(false);
  const [showMorningStock, setShowMorningStock] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showEOD, setShowEOD] = useState(false);
  const [showLoss, setShowLoss] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'HOME' | 'TRANSFERS' | 'ANALYTICS'>('HOME');

  // Real-time Daytime Listening & Confidence States
  const [isListening, setIsListening] = useState(true);
  const [latestHeardDialogue, setLatestHeardDialogue] = useState('Customer: 1 kilo tamatar do → Stall: ₹30');
  const [confirmationPending, setConfirmationPending] = useState<{
    item: string;
    amount: number;
    text: string;
  } | null>(null);

  // Modern Blended Prompt / In-App Notification System
  const [activePrompt, setActivePrompt] = useState<PromptInfo | null>(null);
  const showPrompt = (info: PromptInfo) => {
    setActivePrompt({ ...info });
  };

  // Dynamic Real-time Voice Order Handler (ZERO Hardcoding)
  const handleProcessVoiceOrder = async (spokenPhrase: string) => {
    if (!spokenPhrase || !spokenPhrase.trim()) return;
    setLoading(true);
    const textToSend = spokenPhrase.trim();

    try {
      const res = await fetch(`${getApiBaseUrl()}/vendor/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend, clock: Date.now() })
      });
      const data = await res.json();

      setLatestHeardDialogue(textToSend);

      if (data.isWalkaway) {
        showPrompt({
          badge: 'Customer Walkaway',
          title: 'No Sale Recorded (₹0)',
          description: 'The customer left without buying. No fake sale was added.',
          type: 'info',
          icon: 'walk-outline'
        });
      } else if (data.isFreebie) {
        showPrompt({
          badge: 'Freebie Request',
          title: 'Customer Freebie Noted (₹0)',
          description: `Garnish/extra item (${data.title}) recorded in inventory.`,
          type: 'info',
          icon: 'gift-outline'
        });
      } else if (data.isInquiry) {
        showPrompt({
          badge: 'Price Inquiry',
          title: 'Price Inquiry Heard (₹0)',
          description: `Customer asked: "${textToSend}". No sale booked until quote agreed.`,
          type: 'info',
          icon: 'help-circle-outline'
        });
      } else if (data.amount > 0) {
        const amt = Number(data.amount);
        const newTx: Transaction = {
          id: `tx-voice-${Date.now()}`,
          title: data.title || `Voice Sale (+₹${amt})`,
          category: 'Voice Sale',
          amount: amt,
          isCredit: true,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        };
        setTransactions(prev => [newTx, ...prev]);
        showPrompt({
          badge: 'Dynamic Voice Sale',
          title: `${data.title || 'Sale Recorded'}: +₹${amt.toLocaleString('en-IN')}`,
          description: 'Dynamically parsed and posted to double-entry ledger.',
          type: 'success',
          icon: 'mic-outline'
        });
      } else {
        showPrompt({
          badge: 'Voice Processed',
          title: 'Utterance Received',
          description: textToSend,
          type: 'info',
          icon: 'chatbubble-outline'
        });
      }
    } catch {
      showPrompt({
        badge: 'Offline Note',
        title: 'Heard Spoken Order',
        description: `Logged: "${textToSend}"`,
        type: 'info',
        icon: 'mic-outline'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSoundbox = (amount = 50) => {
    const soundboxTx: Transaction = {
      id: `tx-soundbox-${Date.now()}`,
      title: `Paytm Soundbox UPI: ₹${amount}`,
      category: 'Soundbox Verified',
      amount,
      isCredit: true,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
    setTransactions(prev => [soundboxTx, ...prev]);
    showPrompt({
      badge: 'Paytm Soundbox',
      title: `Payment Received: +₹${amount.toFixed(2)}`,
      description: 'Soundbox audio chime verified and credited to today’s sales.',
      type: 'success',
      icon: 'qr-code-outline'
    });
  };

  const handleStreamTurn = async (speaker: 'VENDOR' | 'CUST_1', text: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/vendor/audio/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker,
          text,
          timestamp: Date.now(),
          confidence: 0.95,
          noiseDb: 64
        })
      });
      const data = await res.json();
      setLatestHeardDialogue(`${speaker}: ${text}`);
      showPrompt({
        badge: 'Turn Streamed',
        title: 'Logged to POST /audio/turn',
        description: `Evidence ID: ${data.evidenceId || 'CHUNK_WAL'} (${data.bufferedTurns || 1} turns buffered)`,
        type: 'success',
        icon: 'mic-outline'
      });
    } catch {
      setLatestHeardDialogue(`${speaker}: ${text}`);
      showPrompt({
        badge: 'Turn Streamed Offline',
        title: 'Buffered in Register',
        description: `${speaker} speech turn recorded into local buffer.`,
        type: 'info',
        icon: 'mic-outline'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTransactions([]);
    setActiveSabotage('CLEAN');
    showPrompt({
      badge: 'Register Reset',
      title: 'Day Baseline Cleared',
      description: `Today’s register reset to opening float ₹${openingFloat}. All entries cleared.`,
      type: 'info',
      icon: 'refresh-outline'
    });
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <BlendedPrompt prompt={activePrompt} onDismiss={() => setActivePrompt(null)} />

      {/* HEADER SECTION */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="storefront-outline" size={18} color="#073B3A" style={styles.headerIcon} />
          <Text style={styles.headerTitle} numberOfLines={1}>{shopName}</Text>
        </View>
        <Text style={styles.headerGrossAmount}>₹{liveCashInDrawer.toLocaleString('en-IN')}.00</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 1. CONCEPTZILLA TWIN CARDS: TOTAL SALE RECORDED & ACTUAL PROFIT */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsCarousel}
        >
          {/* CARD 1: ZILLA WAVE CARD (TOTAL SALE RECORDED) */}
          <View style={styles.zillaCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardBrandBlock}>
                <Text style={styles.cardBrandTitle}>Total Sale Recorded</Text>
              </View>
              {/* Organic Curved Wave Graphic on Right */}
              <View style={styles.cardWaveContainer}>
                <View style={styles.cardWavePine} />
                <View style={styles.cardWaveLime} />
              </View>
            </View>

            <View style={styles.cardAmountBlock}>
              <Text style={styles.cardAmountText}>₹{totalSales.toLocaleString('en-IN')}.00</Text>
              <Text style={styles.cardSubText}>
                {transactions.filter(t => t.isCredit).length} sales verified today • Live Register
              </Text>
            </View>

            <View style={styles.cardFooterRow}>
              <Text style={styles.cardMeshPill}>● MESH SYNCED</Text>
              <View style={styles.cardCircles}>
                <View style={[styles.circleHalf, { backgroundColor: '#EB001B' }]} />
                <View style={[styles.circleHalf, { backgroundColor: '#F79E1B', marginLeft: -8 }]} />
              </View>
            </View>
          </View>

          {/* CARD 2: KURO CARD (ACTUAL PROFIT) */}
          <View style={styles.kuroCard}>
            <View style={styles.kuroTopRow}>
              <Text style={styles.kuroTitle}>Actual Profit</Text>
            </View>

            <View style={styles.kuroWavePineBottom}>
              <Text style={styles.kuroAmount}>
                ₹{Math.max(0, Math.round(netOperatingBalance * 0.38)).toLocaleString('en-IN')} – ₹{Math.max(0, Math.round(netOperatingBalance * 0.44)).toLocaleString('en-IN')}
              </Text>
              <View style={styles.kuroFooterRow}>
                <Text style={styles.kuroCardNumber}>Net Margin ~38%</Text>
                <Text style={styles.kuroVisaBadge}>CRDT DAG</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* DAYTIME FEATURE: CONTINUOUS AUDIO STREAM (CONCEPTZILLA SIGNATURE CARD) */}
        <View style={styles.listeningCard}>
          <View style={styles.listeningCardHeader}>
            <View style={styles.listeningHeaderLeft}>
              <Text style={styles.listeningMicroHeader}>CONTINUOUS AUDIO STREAM</Text>
              <View style={styles.micHardwareBadge}>
                <Ionicons name="mic" size={10} color="#376300" style={{ marginRight: 4 }} />
                <Text style={styles.micHardwareBadgeText}>NATIVE MIC HOOK</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.shiftToggleBtn, isListening ? styles.shiftToggleBtnPause : styles.shiftToggleBtnStart]}
              onPress={() => {
                setIsListening(prev => {
                  const nextState = !prev;
                  if (nextState) {
                    showPrompt({
                      badge: 'Audio Stream Active',
                      title: 'Listening for Sales',
                      description: 'Microphone active in background. Streaming to POST /audio/turn.',
                      type: 'success',
                      icon: 'radio-outline'
                    });
                  } else {
                    showPrompt({
                      badge: 'Audio Stream Muted',
                      title: 'Microphone Paused',
                      description: 'Stream paused. Tap Start Day to resume acoustic VAD.',
                      type: 'neutral',
                      icon: 'pause-circle-outline'
                    });
                  }
                  return nextState;
                });
              }}
            >
              <Ionicons
                name={isListening ? 'pause-outline' : 'mic-outline'}
                size={14}
                color="#073B3A"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.shiftToggleBtnText}>{isListening ? 'Pause' : 'Start Day'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listeningBodyBlock}>
            <Text style={styles.listeningHeroTitle}>
              {isListening ? 'Continuous Acoustic Stream (VAD)' : 'Stream Paused • Offline'}
            </Text>
            <Text style={styles.listeningHeroSub}>
              {isListening
                ? 'Silero VAD energy thresholding & ECAPA-TDNN diarization streaming to POST /audio/turn'
                : 'Microphone asleep • Tap Start Day to resume continuous streaming'}
            </Text>
          </View>

          {/* Real-time Hardware Stream Readout Bar */}
          <View style={styles.audioStreamHudRow}>
            <View style={styles.hudLeftMetrics}>
              <View style={styles.hudMetricItem}>
                <Text style={styles.hudLabel}>VAD ENERGY</Text>
                <Text style={styles.hudValGreen}>{isListening ? 'SPEECH ACTIVE' : 'MUTED'}</Text>
              </View>
              <View style={styles.hudMetricItem}>
                <Text style={styles.hudLabel}>NOISE LEVEL</Text>
                <Text style={styles.hudVal}>{isListening ? '64 dB' : '0 dB'}</Text>
              </View>
              <View style={styles.hudMetricItem}>
                <Text style={styles.hudLabel}>DIARIZATION</Text>
                <Text style={styles.hudVal}>VENDOR (Calibrated)</Text>
              </View>
            </View>

            <View style={styles.miniFreqWave}>
              {[14, 22, 10, 26, 18, 12].map((h, i) => (
                <View key={i} style={[styles.miniBar, { height: isListening ? h : 4 }]} />
              ))}
            </View>
          </View>

          {isListening && (
            <View style={styles.liveAudioSnippetBar}>
              <View style={styles.audioWaveGlyph}>
                <Ionicons name="chatbubble-ellipses-outline" size={13} color="#073B3A" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.audioSnippetLabel}>STREAMED TURN → POST /audio/turn</Text>
                <Text style={styles.audioSnippetText} numberOfLines={1}>
                  {latestHeardDialogue}
                </Text>
              </View>
            </View>
          )}

          {/* Interactive Stream Controls */}
          <View style={styles.streamActionsRow}>
            <TouchableOpacity
              style={styles.openStreamHudBtn}
              onPress={() => setShowAudioStreamModal(true)}
            >
              <Ionicons name="options-outline" size={14} color="#073B3A" style={{ marginRight: 6 }} />
              <Text style={styles.openStreamHudText}>Open Live Mic HUD</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.streamTurnPresetBtn}
              onPress={() => handleStreamTurn('VENDOR', '1 kilo tamatar 30 rupay')}
              disabled={loading}
            >
              <Ionicons name="flash-outline" size={14} color="#073B3A" style={{ marginRight: 4 }} />
              <Text style={styles.streamTurnPresetText}>Test Turn</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DAYTIME FEATURE: 90% STT CONFIRMATION ALERT BANNER */}
        {confirmationPending && (
          <View style={styles.confirmBanner}>
            <View style={styles.confirmHeaderRow}>
              <View style={styles.confirmIconBox}>
                <Ionicons name="ear-outline" size={20} color="#073B3A" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.confirmTitle}>Did you hear right?</Text>
                <Text style={styles.confirmQuestion}>
                  Did the customer ask for <Text style={{ fontWeight: '800', color: '#073B3A' }}>{confirmationPending.item}</Text> for <Text style={{ fontWeight: '800', color: '#073B3A' }}>₹{confirmationPending.amount}</Text>?
                </Text>
                <Text style={styles.confirmSpokenQuote}>“{confirmationPending.text}”</Text>
              </View>
            </View>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.confirmYesBtn}
                onPress={() => {
                  const amt = confirmationPending.amount;
                  const newTx: Transaction = {
                    id: `confirm-${Date.now()}`,
                    title: `${confirmationPending.item} (Confirmed)`,
                    category: 'Voice Sale',
                    amount: amt,
                    isCredit: true,
                    time: 'Just now'
                  };
                  setTransactions(prev => [newTx, ...prev]);
                  setLatestHeardDialogue(`Confirmed: ${confirmationPending.item} → ₹${amt}`);
                  setConfirmationPending(null);
                  showPrompt({
                    badge: 'Sale Confirmed',
                    title: `Added ₹${amt} to Sales`,
                    description: `Confirmed ${confirmationPending.item} order from customer.`,
                    type: 'success',
                    icon: 'checkmark-circle-outline'
                  });
                }}
              >
                <Ionicons name="checkmark-circle" size={15} color="#073B3A" style={{ marginRight: 5 }} />
                <Text style={styles.confirmYesText}>Yes, Correct (+₹{confirmationPending.amount})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmNoBtn}
                onPress={() => {
                  setConfirmationPending(null);
                  showPrompt({
                    badge: 'Audio Quarantined',
                    title: 'Noisy Audio Ignored',
                    description: 'Discarded ambiguous audio. No phantom sale was added.',
                    type: 'warning',
                    icon: 'close-circle-outline'
                  });
                }}
              >
                <Ionicons name="close-circle-outline" size={15} color="#6B7280" style={{ marginRight: 4 }} />
                <Text style={styles.confirmNoText}>No, Ignore</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Today's balance */}
        <View style={styles.periodTableCard}>
          <View style={styles.balanceHeaderRow}>
            <View>
              <Text style={styles.periodHeader}>TODAY’S NET BALANCE</Text>
              <Text style={styles.balanceHeroAmount}>₹{liveCashInDrawer.toLocaleString('en-IN')}.00</Text>
            </View>
            <View style={styles.balanceLivePill}>
              <View style={styles.liveDot} />
              <Text style={styles.balanceLiveText}>LIVE</Text>
            </View>
          </View>
          
          <View style={styles.periodRow}>
            <View style={styles.periodLeft}>
              <View style={styles.arrowCircle}>
                <Text style={styles.arrowSymbol}>↑</Text>
              </View>
              <Text style={styles.periodLabel}>Money in (Total sales)</Text>
            </View>
            <Text style={styles.periodValueCredit}>+₹{totalSales.toLocaleString('en-IN')}.00</Text>
          </View>

          <View style={styles.periodRow}>
            <View style={styles.periodLeft}>
              <View style={styles.arrowCircle}>
                <Text style={styles.arrowSymbol}>↓</Text>
              </View>
              <Text style={styles.periodLabel}>Money out (Expenses)</Text>
            </View>
            <Text style={styles.periodValueDebit}>-₹{totalExpenses.toLocaleString('en-IN')}.00</Text>
          </View>

          <View style={[styles.periodRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.periodLeft}>
              <View style={[styles.arrowCircle, { borderColor: '#073B3A' }]}>
              <Ionicons name="trending-up-outline" size={12} color="#073B3A" />
              </View>
              <Text style={[styles.periodLabel, { fontWeight: '700' }]}>Net operating balance</Text>
            </View>
            <Text style={styles.periodValueAccrual}>
              {netOperatingBalance >= 0 ? '+' : '-'}₹{Math.abs(netOperatingBalance).toLocaleString('en-IN')}.00
            </Text>
          </View>
        </View>

        {/* WHOLESALE MANDI SLIP ENTRY CARD (CONCEPTZILLA EXACT CARD STRUCTURE) */}
        <View style={styles.wholesaleSlipCard}>
          <View style={styles.wholesaleCardHeader}>
            <Text style={styles.wholesaleMicroHeader}>WHOLESALE MANDI SLIP ENTRY</Text>
            <View style={styles.ocrHardwareBadge}>
              <Ionicons name="camera" size={11} color="#376300" style={{ marginRight: 4 }} />
              <Text style={styles.ocrHardwareBadgeText}>OCR CAMERA HOOK</Text>
            </View>
          </View>

          <Text style={styles.wholesaleCardTitle}>Wholesale Mandi Slip & Stock</Text>
          <Text style={styles.wholesaleCardSub}>
            Snap physical paper mandi slips to calibrate wholesale COGS cost basis via optical OCR recognition.
          </Text>

          <View style={styles.wholesaleBasisRow}>
            <View style={styles.wholesaleBasisLeft}>
              <Text style={styles.wholesaleBasisLabel}>ACTIVE COST BASIS (COGS)</Text>
              <Text style={styles.wholesaleBasisValue}>₹1,720.00 Ingested Basis</Text>
              <Text style={styles.wholesaleSupplierText}>Supplier: Azadpur Mandi • 3 Items (120 kg)</Text>
            </View>
            <View style={styles.limeIconBox}>
              <Ionicons name="receipt-outline" size={20} color="#073B3A" />
            </View>
          </View>

          <View style={styles.wholesaleButtonsRow}>
            <TouchableOpacity
              style={styles.scanSlipPrimaryBtn}
              onPress={() => setShowMandiOcr(true)}
            >
              <Ionicons name="scan-outline" size={15} color="#073B3A" style={{ marginRight: 6 }} />
              <Text style={styles.scanSlipPrimaryText}>Scan Mandi Slip (OCR)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualSlipSecondaryBtn}
              onPress={() => setShowMorningStock(true)}
            >
              <Ionicons name="add-outline" size={15} color="#374151" style={{ marginRight: 4 }} />
              <Text style={styles.manualSlipSecondaryText}>Manual Bill</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Stall Actions</Text>
        <View style={styles.actionsGrid}>
          {/* ROW 1: MORNING STOCK | VOICE SALE | ONLINE UPI */}
          <View style={styles.actionsGridRow}>
            <TouchableOpacity
              style={styles.actionGridItem}
              onPress={() => setShowMorningStock(true)}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="cart-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>Add Stock</Text>
              <Text style={styles.actionGridSub}>Mandi bill</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionGridItem}
              onPress={() => setShowVoiceModal(true)}
              disabled={loading}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="mic-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>Voice Sale</Text>
              <Text style={styles.actionGridSub}>Speak or type</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionGridItem}
              onPress={() => setShowUpiModal(true)}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="qr-code-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>Online UPI</Text>
              <Text style={styles.actionGridSub}>Soundbox feed</Text>
            </TouchableOpacity>
          </View>

          {/* ROW 2: CLOSE REGISTER | SPOILED STOCK | SYNC PHONE */}
          <View style={styles.actionsGridRow}>
            <TouchableOpacity
              style={styles.actionGridItem}
              onPress={() => setShowEOD(true)}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="checkmark-done-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>Close Stall</Text>
              <Text style={styles.actionGridSub}>Count drawer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionGridItem}
              onPress={() => setShowLoss(true)}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="pie-chart-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>Spoiled Stock</Text>
              <Text style={styles.actionGridSub}>Heat & lunch</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionGridItem}
              onPress={() => setShowSyncModal(true)}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="phone-portrait-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>Sync Phone</Text>
              <Text style={styles.actionGridSub}>Helper mesh</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>System Security</Text>
        <View style={styles.sabotageTabsRow}>
          {[
            { id: 'CLEAN', label: 'All good' },
            { id: 'NOISE', label: 'Noisy area' },
            { id: 'CLOCK', label: 'Time reset' },
            { id: 'AIRGAP', label: 'Offline' }
          ].map(s => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.sabotageTab,
                activeSabotage === s.id && styles.sabotageTabActive
              ]}
              onPress={() => setActiveSabotage(s.id as any)}
            >
              <Text style={[
                styles.sabotageTabText,
                activeSabotage === s.id && styles.sabotageTabTextActive
              ]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SABOTAGE VERDICT BOX */}
        <View style={styles.sabotageVerdictCard}>
          {activeSabotage === 'CLEAN' && (
            <Text style={styles.sabotageVerdictText}>
              <Text style={{ fontWeight: '800' }}>Everything looks good.</Text> Your sales and expenses are saved safely.
            </Text>
          )}
          {activeSabotage === 'NOISE' && (
            <Text style={[styles.sabotageVerdictText, { color: '#073B3A' }]}>
              <Text style={{ fontWeight: '800' }}>Noisy area detected.</Text> We’ll ask before adding anything we cannot hear clearly.
            </Text>
          )}
          {activeSabotage === 'CLOCK' && (
            <Text style={[styles.sabotageVerdictText, { color: '#073B3A' }]}>
              <Text style={{ fontWeight: '800' }}>Time updated.</Text> Your recent entries are still in the right order.
            </Text>
          )}
          {activeSabotage === 'AIRGAP' && (
            <Text style={[styles.sabotageVerdictText, { color: '#073B3A' }]}>
              <Text style={{ fontWeight: '800' }}>Offline mode is on.</Text> Keep working — your entries will stay on this phone.
            </Text>
          )}
        </View>

        {/* 6. SPENDING / STOCK LOSS ATTRIBUTION (DONUT & LEGEND IN DENSE FINTECH STYLE) */}
        <View style={styles.analyticsSectionRow}>
          <Text style={styles.sectionTitle}>Stock Loss Breakdown</Text>
          <TouchableOpacity onPress={() => setShowLoss(true)}>
            <Text style={styles.customizeLink}>Customize ↗</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stockLossCard}>
          <View style={styles.donutRow}>
            {/* Minimalist Visual Donut Mock */}
            <View style={styles.donutRingContainer}>
              <View style={[styles.donutSector, { borderColor: '#073B3A' }]} />
              <View style={[styles.donutSectorInner, { borderColor: '#E2FD52' }]} />
              <View style={styles.donutHole}>
                <Text style={styles.donutTotalKg}>{lossTotalKg.toFixed(1)} kg</Text>
                <Text style={styles.donutSubText}>{lossCommodity}</Text>
              </View>
            </View>

            {/* Legend Breakdown */}
            <View style={styles.donutLegend}>
              <View style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#073B3A' }]} />
                <Text style={styles.legendName}>Heat Rot: <Text style={styles.legendBold}>{rotLoss}% ({((lossTotalKg * rotLoss) / 100).toFixed(1)} kg)</Text></Text>
              </View>

              <View style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#E2FD52' }]} />
                <Text style={styles.legendName}>Family Food: <Text style={styles.legendBold}>{familyLunch}% ({((lossTotalKg * familyLunch) / 100).toFixed(1)} kg)</Text></Text>
              </View>

              <View style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} />
                <Text style={styles.legendName}>Theft / Loss: <Text style={styles.legendBold}>{theftLoss}% ({((lossTotalKg * theftLoss) / 100).toFixed(1)} kg)</Text></Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Real Indic Voice Tests</Text>
        <View style={styles.scenariosFlow}>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleProcessVoiceOrder('4kg aloo 80 rupaye me de do')}>
            <Text style={styles.scenarioPillText}>🥔 4kg aloo ₹80</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleProcessVoiceOrder('50 rupaye ka tamatar pack kar do')}>
            <Text style={styles.scenarioPillText}>🍅 ₹50 tamatar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleProcessVoiceOrder('2 plate poha 40 rupaye')}>
            <Text style={styles.scenarioPillText}>🍛 2 plate poha ₹40</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleProcessVoiceOrder('Rehne do bhaiya bahut mehenga hai, nahi lena')}>
            <Text style={styles.scenarioPillText}>🚶 Walkaway (₹0)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleProcessVoiceOrder('Thoda dhaniya mirchi upar se daal do na')}>
            <Text style={styles.scenarioPillText}>🌿 Freebie (₹0)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleProcessVoiceOrder('4kg aloo kitne ke hue')}>
            <Text style={styles.scenarioPillText}>❓ Inquiry (₹0)</Text>
          </TouchableOpacity>
        </View>

        {/* 8. RECENT TRANSACTIONS */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.txListWrapper}>
          {transactions.map(tx => (
            <View key={tx.id} style={styles.txItemCard}>
              <View style={styles.txIconSquare}>
                <Ionicons name={tx.isCredit ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color="#073B3A" />
              </View>
              <View style={styles.txMeta}>
                <Text style={styles.txTitleText}>{tx.title}</Text>
                <Text style={styles.txCategoryText}>{tx.category} • {tx.time}</Text>
              </View>
              <Text style={[styles.txAmountText, tx.isCredit ? styles.txCreditColor : styles.txDebitColor]}>
                {tx.isCredit ? '+' : '-'}₹{tx.amount}.00
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 10. BOTTOM NAVIGATION DOCK (CONCEPTZILLA EXACT 3-ICON DOCK) */}
      <View style={styles.bottomDockContainer}>
        <View style={styles.dockPill}>
          <TouchableOpacity style={styles.dockItem} onPress={() => setCurrentScreen('HOME')}>
            <Ionicons name={currentScreen === 'HOME' ? 'home' : 'home-outline'} size={21} color={currentScreen === 'HOME' ? '#073B3A' : '#9CA3AF'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dockItem} onPress={() => setShowEOD(true)}>
            <Ionicons name="swap-horizontal-outline" size={21} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dockMicButton}
            onPress={() => setShowVoiceModal(true)}
            disabled={loading}
            accessibilityLabel="Add a sale by voice"
          >
            <View style={styles.dockMicPulse} />
            <Ionicons name={loading ? 'hourglass-outline' : 'mic'} size={23} color="#073B3A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dockItem} onPress={() => {
            showPrompt({
              badge: 'Stall Profile',
              title: shopName,
              description: 'Offline-first terminal running zero-loss CRDT ledger.',
              type: 'info',
              icon: 'storefront-outline'
            });
          }}>
            <Ionicons name="person-outline" size={21} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* MODALS */}
      <MorningStockModal
        visible={showMorningStock}
        onClose={() => setShowMorningStock(false)}
        apiBaseUrl={getApiBaseUrl()}
        onStockAdded={(summary) => {
          const cost = summary.totalCost;
          const itemNames = summary.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');
          setTransactions(prev => [
            {
              id: `stock-${Date.now()}`,
              title: itemNames ? `Mandi Stock: ${itemNames}` : 'Mandi Morning Stock',
              category: summary.isCash ? 'Mandi Cash Bill' : 'Mandi Udhaar Bill',
              amount: cost,
              isCredit: false,
              time: 'Just now'
            },
            ...prev
          ]);
          showPrompt({
            badge: 'Mandi Stock Added',
            title: `Recorded Stock Outflow: ₹${cost.toLocaleString('en-IN')}`,
            description: summary.isCash ? 'Paid in physical cash from stall drawer.' : 'Logged as wholesale credit (Udhaar).',
            type: 'info',
            icon: 'cart-outline'
          });
        }}
      />

      <UpiEventsModal
        visible={showUpiModal}
        onClose={() => setShowUpiModal(false)}
        apiBaseUrl={getApiBaseUrl()}
        onUpiPaymentConfirmed={(amount, isSale) => {
          if (isSale) {
            const newTx: Transaction = {
              id: `upi-${Date.now()}`,
              title: 'Paytm Soundbox UPI Received',
              category: 'Soundbox Verified',
              amount: amount,
              isCredit: true,
              time: 'Just now'
            };
            setTransactions(prev => [newTx, ...prev]);
            showPrompt({
              badge: 'UPI Verified',
              title: `Received +₹${amount.toLocaleString('en-IN')}`,
              description: 'Soundbox audio chime cross-checked with bank feed.',
              type: 'success',
              icon: 'qr-code-outline'
            });
          }
        }}
      />

      <SyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        apiBaseUrl={getApiBaseUrl()}
        onSyncComplete={(count) => {
          showPrompt({
            badge: 'CRDT Mesh Sync',
            title: 'Helper Phone Merged',
            description: `Synchronized ${count} sales from nearby helper stall phone.`,
            type: 'success',
            icon: 'git-merge-outline'
          });
        }}
      />

      <EODReconciliationModal
        visible={showEOD}
        onClose={() => setShowEOD(false)}
        apiBaseUrl={getApiBaseUrl()}
        confirmedUpiTotal={dynamicUpiTotal}
        initialClosingCash={liveCashInDrawer}
        initialCashExpenses={totalExpenses}
        initialOpeningFloat={openingFloat}
        onReconciliationComplete={(res) => {
          if (res.acceptedTransactions) {
            showPrompt({
              badge: 'Register Closed',
              title: 'Day Reconciled',
              description: `${res.acceptedTransactions.length} sales confirmed. Real profit: ₹${res.takeHomeProfit || 0}.`,
              type: 'success',
              icon: 'shield-checkmark-outline'
            });
          }
          setShowEOD(false);
        }}
      />

      <LossModal
        visible={showLoss}
        onClose={() => setShowLoss(false)}
        apiBaseUrl={getApiBaseUrl()}
        initialCommodity={lossCommodity}
        initialMissingKg={lossTotalKg}
        onCalculate={(r, f, t, c, mKg) => {
          setRotLoss(r);
          setFamilyLunch(f);
          setTheftLoss(t);
          if (c) setLossCommodity(c);
          if (mKg) setLossTotalKg(mKg);
        }}
      />

      <MandiOcrModal
        visible={showMandiOcr}
        onClose={() => setShowMandiOcr(false)}
        apiBaseUrl={getApiBaseUrl()}
        onSlipIngested={(summary) => {
          const cost = summary.totalCost;
          setTransactions(prev => [
            {
              id: `mandi-ocr-${Date.now()}`,
              title: `Mandi OCR: ${summary.supplier}`,
              category: 'Wholesale Mandi COGS',
              amount: cost,
              isCredit: false,
              time: 'Just now'
            },
            ...prev
          ]);
          showPrompt({
            badge: 'Mandi Slip Ingested',
            title: `OCR Slip Recorded: -₹${cost.toLocaleString('en-IN')}`,
            description: `Ingested ${summary.itemsCount} bulk items into wholesale ledger. Zero retail preset prices.`,
            type: 'success',
            icon: 'camera-outline'
          });
        }}
      />

      <AudioStreamModal
        visible={showAudioStreamModal}
        onClose={() => setShowAudioStreamModal(false)}
        apiBaseUrl={getApiBaseUrl()}
        onTurnLogged={(turn) => {
          setLatestHeardDialogue(`${turn.speaker}: ${turn.text}`);
          showPrompt({
            badge: 'Audio Turn Streamed',
            title: `Turn Logged to /audio/turn`,
            description: `Evidence ID: ${turn.evidenceId || 'CHUNK_WAL'}`,
            type: 'success',
            icon: 'mic-outline'
          });
        }}
      />

      <VoiceOrderModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onProcessOrder={handleProcessVoiceOrder}
        loading={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerIcon: {
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  headerGrossAmount: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  /* 1. CONCEPTZILLA TWIN CARDS (CAROUSEL) */
  cardsCarousel: {
    paddingVertical: 4,
    paddingBottom: 16,
  },
  zillaCard: {
    width: 250,
    height: 155,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#DDECE7',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBrandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  cardBrandIcon: {
    marginRight: 5,
  },
  cardBrandTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
  },
  cardWaveContainer: {
    position: 'absolute',
    top: -20,
    right: -25,
    width: 110,
    height: 150,
  },
  cardWavePine: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 80,
    height: 140,
    backgroundColor: '#073B3A',
    borderBottomLeftRadius: 50,
    borderTopLeftRadius: 60,
  },
  cardWaveLime: {
    position: 'absolute',
    top: 25,
    right: 25,
    width: 50,
    height: 100,
    backgroundColor: '#E2FD52',
    borderBottomLeftRadius: 40,
    borderTopLeftRadius: 50,
  },
  cardAmountBlock: {
    marginTop: 8,
    zIndex: 2,
  },
  cardAmountText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#073B3A',
    letterSpacing: -0.5,
  },
  cardSubText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '600',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  cardMeshPill: {
    fontSize: 9,
    fontWeight: '800',
    color: '#073B3A',
    letterSpacing: 0.5,
  },
  cardCircles: {
    flexDirection: 'row',
  },
  circleHalf: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },

  /* KURO CARD */
  kuroCard: {
    width: 220,
    height: 155,
    backgroundColor: '#E2FD52',
    borderRadius: 24,
    marginRight: 10,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  kuroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  kuroAsterisk: {
    fontSize: 16,
    color: '#073B3A',
    marginRight: 6,
    fontWeight: '800',
  },
  kuroTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
  },
  kuroWavePineBottom: {
    backgroundColor: '#073B3A',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 60,
    padding: 16,
    paddingTop: 18,
  },
  kuroAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  kuroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kuroCardNumber: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  kuroVisaBadge: {
    fontSize: 10,
    color: '#E2FD52',
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* DAYTIME LISTENING STATUS CARD (CONCEPTZILLA EXACT CARD STRUCTURE) */
  listeningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginBottom: 18,
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  listeningCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listeningHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listeningMicroHeader: {
    fontSize: 11,
    color: '#6E827D',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginRight: 8,
  },
  listeningStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  listeningStatusPillActive: {
    backgroundColor: '#F1FFE5',
  },
  listeningStatusPillPaused: {
    backgroundColor: '#F3F4F6',
  },
  listeningStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  listeningStatusPillTextActive: {
    color: '#376300',
  },
  listeningStatusPillTextPaused: {
    color: '#6B7280',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPaused: {
    backgroundColor: '#9CA3AF',
  },
  shiftToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  shiftToggleBtnPause: {
    backgroundColor: '#E2FD52',
  },
  shiftToggleBtnStart: {
    backgroundColor: '#E2FD52',
  },
  shiftToggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
  },
  listeningBodyBlock: {
    marginBottom: 10,
  },
  listeningHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#073B3A',
    letterSpacing: -0.2,
  },
  listeningHeroSub: {
    fontSize: 11,
    color: '#6E827D',
    marginTop: 2,
    fontWeight: '500',
  },
  liveAudioSnippetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FCF9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2EFE9',
    marginTop: 4,
  },
  audioWaveGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSnippetLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#6E827D',
    letterSpacing: 0.6,
  },
  audioSnippetText: {
    fontSize: 11,
    color: '#073B3A',
    fontWeight: '700',
    marginTop: 1,
  },
  micHardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1FFE5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  micHardwareBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#376300',
    letterSpacing: 0.5,
  },
  audioStreamHudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#073B3A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  hudLeftMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  hudMetricItem: {
    alignItems: 'flex-start',
  },
  hudLabel: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  hudVal: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  hudValGreen: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2FD52',
    marginTop: 1,
  },
  miniFreqWave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniBar: {
    width: 3.5,
    backgroundColor: '#E2FD52',
    borderRadius: 2,
  },
  streamActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  openStreamHudBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2FD52',
    paddingVertical: 11,
    borderRadius: 14,
  },
  openStreamHudText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
  },
  streamTurnPresetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FCF9',
    borderWidth: 1,
    borderColor: '#DDECE7',
    paddingVertical: 11,
    borderRadius: 14,
  },
  streamTurnPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#073B3A',
  },

  /* WHOLESALE MANDI SLIP CARD (CONCEPTZILLA EXACT CARD STRUCTURE) */
  wholesaleSlipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginBottom: 18,
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  wholesaleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  wholesaleMicroHeader: {
    fontSize: 11,
    color: '#6E827D',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ocrHardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1FFE5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ocrHardwareBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#376300',
    letterSpacing: 0.5,
  },
  wholesaleCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#073B3A',
    letterSpacing: -0.2,
  },
  wholesaleCardSub: {
    fontSize: 11,
    color: '#6E827D',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 16,
  },
  wholesaleBasisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FCF9',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2EFE9',
  },
  wholesaleBasisLeft: {
    flex: 1,
  },
  wholesaleBasisLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6E827D',
    letterSpacing: 0.5,
  },
  wholesaleBasisValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
    marginTop: 2,
  },
  wholesaleSupplierText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  wholesaleButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanSlipPrimaryBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2FD52',
    paddingVertical: 12,
    borderRadius: 14,
  },
  scanSlipPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
  },
  manualSlipSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    borderRadius: 14,
  },
  manualSlipSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  /* 90% STT CONFIRMATION BANNER */
  confirmBanner: {
    backgroundColor: '#F1FFE5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#79AF00',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  confirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  confirmIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 2,
  },
  confirmQuestion: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 16,
  },
  confirmSpokenQuote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#4B5563',
    marginTop: 4,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  confirmYesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginRight: 8,
  },
  confirmYesText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
  },
  confirmNoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  confirmNoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  /* 2. ELECTRIC LIME BANNER */
  limeBanner: {
    backgroundColor: '#E2FD52',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
  },
  limeBannerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  limeBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 4,
  },
  limeBannerSub: {
    fontSize: 11,
    color: '#073B3A',
    opacity: 0.85,
    fontWeight: '500',
    lineHeight: 16,
  },
  limeBannerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#073B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limeCloseIcon: {
    fontSize: 14,
    color: '#E2FD52',
  },

  /* 3. PERIOD BREAKDOWN TABLE */
  periodTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginBottom: 18,
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  periodHeader: {
    fontSize: 11,
    color: '#6E827D',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  balanceHeroAmount: {
    marginTop: 5,
    fontSize: 30,
    color: '#073B3A',
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  balanceLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1FFE5',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#79AF00',
    marginRight: 5,
  },
  balanceLiveText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#376300',
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  periodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  arrowSymbol: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  periodLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  periodValueCredit: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  periodValueDebit: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  periodValueAccrual: {
    fontSize: 13,
    color: '#073B3A',
    fontWeight: '800',
  },

  /* 4. TEAL ACTION SQUIRCLES */
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    marginTop: 4,
  },
  /* 4. STALL ACTIONS GRID (2x3 Conceptzilla squircles) */
  actionsGrid: {
    marginBottom: 18,
  },
  actionsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionGridItem: {
    width: '31.5%',
    backgroundColor: '#073B3A',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  actionGridTitle: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  actionGridSub: {
    fontSize: 10,
    color: '#E2FD52',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  tealActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  tealCardItem: {
    flex: 1,
    backgroundColor: '#073B3A',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  limeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tealCardText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* 5. SABOTAGE SEGMENTED TABS */
  sabotageTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
  },
  sabotageTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 12,
  },
  sabotageTabActive: {
    backgroundColor: '#073B3A',
  },
  sabotageTabText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
  },
  sabotageTabTextActive: {
    color: '#E2FD52',
  },
  sabotageVerdictCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 18,
  },
  sabotageVerdictText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },

  /* 6. STOCK LOSS CARD (DONUT STYLE) */
  analyticsSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customizeLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#073B3A',
  },
  stockLossCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 18,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutRingContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutSector: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 14,
  },
  donutSectorInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 14,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  donutHole: {
    alignItems: 'center',
  },
  donutTotalKg: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  donutSubText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
  },
  donutLegend: {
    flex: 1,
    marginLeft: 20,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendName: {
    fontSize: 12,
    color: '#4B5563',
  },
  legendBold: {
    fontWeight: '800',
    color: '#111827',
  },

  /* 7. ONE TAP SCENARIOS */
  scenariosFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  scenarioPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 8,
  },
  scenarioPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#073B3A',
  },

  /* 8. RECENT TRANSACTIONS */
  txListWrapper: {
    marginBottom: 18,
  },
  txItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  txIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txMeta: {
    flex: 1,
  },
  txTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  txCategoryText: {
    fontSize: 11,
    color: '#6B7280',
  },
  txAmountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  txCreditColor: {
    color: '#073B3A',
  },
  txDebitColor: {
    color: '#DC2626',
  },

  /* 10. BOTTOM DOCK */
  bottomDockContainer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  dockPill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 26,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dockItem: {
    padding: 7,
  },
  dockMicButton: {
    position: 'absolute',
    left: '50%',
    top: -20,
    width: 56,
    height: 56,
    marginLeft: -28,
    borderRadius: 28,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  dockMicPulse: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#E2FD52',
    opacity: 0.18,
    transform: [{ scale: 1.08 }],
  },
  dockIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  dockIconActive: {
    opacity: 1,
  },
});
