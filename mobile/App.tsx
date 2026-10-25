import React, { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MorningStockModal } from './components/MorningStockModal';
import { UpiEventsModal } from './components/UpiEventsModal';
import { SyncModal } from './components/SyncModal';
import { EODReconciliationModal } from './components/EODReconciliationModal';
import { LossModal } from './components/LossModal';

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

  // Financial State
  const [drawerCash, setDrawerCash] = useState(2500);
  const [profitMin, setProfitMin] = useState(165);
  const [profitMax, setProfitMax] = useState(215);

  // Spoilage Attribution
  const [rotLoss, setRotLoss] = useState(43.8);
  const [familyLunch, setFamilyLunch] = useState(47.4);
  const [theftLoss, setTheftLoss] = useState(8.8);

  // Sabotage State
  const [activeSabotage, setActiveSabotage] = useState<'CLEAN' | 'NOISE' | 'CLOCK' | 'AIRGAP'>('CLEAN');

  // Modals & Navigation
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

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', title: 'Tamatar (3kg) + Sharma Ji', category: 'Vegetable Mandi', amount: 180, isCredit: true, time: '12:42 PM' },
    { id: '2', title: 'Paytm Soundbox UPI Chime', category: 'Digital UPI', amount: 140, isCredit: true, time: '12:38 PM' },
    { id: '3', title: 'Kerosene & Stall Fuel', category: 'Stall Supplies', amount: 60, isCredit: false, time: '11:15 AM' },
    { id: '4', title: 'Poha Plates Sale (x7)', category: 'Food Counter', amount: 140, isCredit: true, time: '10:05 AM' }
  ]);

  // Voice Utterance Handler
  const handleSimulateUtterance = async (scenario: 'MULTI_POST' | 'NEGOTIATION' | 'WALKAWAY' | 'FREEBIE') => {
    setLoading(true);
    let spoken = '';
    if (scenario === 'MULTI_POST') spoken = 'Bhai 3 kilo tamatar liya 180 mein… Sharma ji ka 40 jama kar, aur 7 plate poha de.';
    else if (scenario === 'NEGOTIATION') spoken = 'Customer: 40 me do bhaiya... Vendor: Nahi 50 lagega... Vendor: Chalo 45 me le jao!';
    else if (scenario === 'WALKAWAY') spoken = 'Customer: Rehne do bhaiya bahut mehenga hai, nahi lena!';
    else if (scenario === 'FREEBIE') spoken = 'Customer: Thoda dhaniya mirchi upar se daal do na';

    try {
      const res = await fetch(`${getApiBaseUrl()}/vendor/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken, clock: Date.now() })
      });
      const data = await res.json();

      if (scenario === 'WALKAWAY') {
        Alert.alert('No sale recorded', 'The customer left without buying anything, so no sale was added.');
      } else if (scenario === 'FREEBIE') {
        Alert.alert('Free item noted', 'This was saved as a small customer freebie, not a sale.');
      } else {
        const amt = scenario === 'NEGOTIATION' ? 45 : 180;
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          title: scenario === 'NEGOTIATION' ? 'Sale agreed at ₹45' : 'New voice sale',
          category: 'Voice entry',
          amount: amt,
          isCredit: true,
          time: 'Just now'
        };
        setTransactions(prev => [newTx, ...prev]);
        setDrawerCash(prev => prev + amt);
      }
    } catch {
      // Offline fallback
      if (scenario === 'WALKAWAY') {
        Alert.alert('No sale recorded', 'The customer left without buying anything, so no sale was added.');
      } else if (scenario === 'FREEBIE') {
        Alert.alert('Free item noted', 'This was saved as a small customer freebie, not a sale.');
      } else {
        const amt = scenario === 'NEGOTIATION' ? 45 : 180;
        const newTx: Transaction = {
          id: `tx-off-${Date.now()}`,
          title: scenario === 'NEGOTIATION' ? 'Sale agreed at ₹45' : 'New voice sale',
          category: 'Voice entry',
          amount: amt,
          isCredit: true,
          time: 'Just now'
        };
        setTransactions(prev => [newTx, ...prev]);
        setDrawerCash(prev => prev + amt);
      }
    }
    setLoading(false);
  };

  const handleSimulateSoundbox = () => {
    const soundboxTx: Transaction = {
      id: `tx-soundbox-${Date.now()}`,
      title: 'Paytm Soundbox UPI: ₹140',
      category: 'UPI payment',
      amount: 140,
      isCredit: true,
      time: 'Just now'
    };
    setTransactions(prev => [soundboxTx, ...prev]);
    Alert.alert('Payment added', 'The UPI payment was added to today’s sales.');
  };

  const handleReset = () => {
    setDrawerCash(2500);
    setProfitMin(165);
    setProfitMax(215);
    setActiveSabotage('CLEAN');
    Alert.alert('Day reset', 'Today’s sample balance has been reset.');
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER SECTION */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="storefront-outline" size={18} color="#073B3A" style={styles.headerIcon} />
          <Text style={styles.headerTitle} numberOfLines={1}>{shopName}</Text>
        </View>
        <Text style={styles.headerGrossAmount}>₹{drawerCash.toLocaleString('en-IN')}.00</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* DAYTIME FEATURE: SHIFT TOGGLE & LIVE LISTENING STATUS */}
        <View style={styles.listeningStatusCard}>
          <View style={styles.listeningTopRow}>
            <View style={styles.listeningStatusIndicator}>
              <View style={[styles.statusDot, isListening ? styles.statusDotActive : styles.statusDotPaused]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listeningStatusTitle}>
                  {isListening ? 'Shop Open • Listening for Sales' : 'Shop Paused • Offline'}
                </Text>
                <Text style={styles.listeningStatusSub}>
                  {isListening ? 'Safe in pocket — zero battery drain.' : 'Tap "Start Day" when ready to serve customers.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.shiftToggleBtn, isListening ? styles.shiftToggleBtnPause : styles.shiftToggleBtnStart]}
              onPress={() => {
                setIsListening(prev => {
                  const nextState = !prev;
                  if (nextState) {
                    Alert.alert('Shop Open', 'Listening is active. Speak sales naturally.');
                  } else {
                    Alert.alert('Shop Paused', 'Microphone paused. Tap Start Day to resume.');
                  }
                  return nextState;
                });
              }}
            >
              <Ionicons
                name={isListening ? 'pause-outline' : 'mic-outline'}
                size={14}
                color={isListening ? '#073B3A' : '#073B3A'}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.shiftToggleBtnText}>{isListening ? 'Pause' : 'Start Day'}</Text>
            </TouchableOpacity>
          </View>

          {isListening && (
            <View style={styles.dialogueBubble}>
              <Ionicons name="chatbubble-ellipses-outline" size={13} color="#073B3A" style={{ marginRight: 6 }} />
              <Text style={styles.dialogueBubbleText} numberOfLines={1}>
                {latestHeardDialogue}
              </Text>
            </View>
          )}
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
                  setDrawerCash(prev => prev + amt);
                  setLatestHeardDialogue(`Confirmed: ${confirmationPending.item} → ₹${amt}`);
                  setConfirmationPending(null);
                  Alert.alert('Sale Confirmed', `Added ₹${amt} to today's sales.`);
                }}
              >
                <Ionicons name="checkmark-circle" size={15} color="#073B3A" style={{ marginRight: 5 }} />
                <Text style={styles.confirmYesText}>Yes, Correct (+₹{confirmationPending.amount})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmNoBtn}
                onPress={() => {
                  setConfirmationPending(null);
                  Alert.alert('Sale Ignored', 'Discarded noisy input. No fake sale was added.');
                }}
              >
                <Ionicons name="close-circle-outline" size={15} color="#6B7280" style={{ marginRight: 4 }} />
                <Text style={styles.confirmNoText}>No, Ignore</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 1. CONCEPTZILLA SIGNATURE WAVE CARDS (CAROUSEL) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsCarousel}
        >
          {/* CARD 1: ZILLA CARD (WHITE WITH LIME & PINE WAVE) */}
          <View style={styles.zillaCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardBrandBlock}>
                <Ionicons name="layers-outline" size={14} color="#073B3A" style={styles.cardBrandIcon} />
                <Text style={styles.cardBrandTitle}>Cascade Card</Text>
              </View>
              {/* Organic Curved Wave Graphic on Right */}
              <View style={styles.cardWaveContainer}>
                <View style={styles.cardWavePine} />
                <View style={styles.cardWaveLime} />
              </View>
            </View>

            <View style={styles.cardAmountBlock}>
              <Text style={styles.cardAmountText}>₹{drawerCash.toLocaleString('en-IN')}.00</Text>
              <Text style={styles.cardSubText}>•••• 5722  •  Physical Drawer Cash</Text>
            </View>

            <View style={styles.cardFooterRow}>
              <Text style={styles.cardMeshPill}>● UP TO DATE</Text>
              <View style={styles.cardCircles}>
                <View style={[styles.circleHalf, { backgroundColor: '#EB001B' }]} />
                <View style={[styles.circleHalf, { backgroundColor: '#F79E1B', marginLeft: -8 }]} />
              </View>
            </View>
          </View>

          {/* CARD 2: KURO CARD (ELECTRIC LIME & DEEP PINE SPLIT) */}
          <View style={styles.kuroCard}>
            <View style={styles.kuroTopRow}>
              <Ionicons name="sparkles-outline" size={17} color="#073B3A" style={styles.kuroAsterisk} />
              <Text style={styles.kuroTitle}>Today’s Profit</Text>
            </View>

            <View style={styles.kuroWavePineBottom}>
              <Text style={styles.kuroAmount}>₹{profitMin} – ₹{profitMax}</Text>
              <View style={styles.kuroFooterRow}>
                <Text style={styles.kuroCardNumber}>•••• 2981</Text>
                <Text style={styles.kuroVisaBadge}>ESTIMATE</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Today's balance */}
        <View style={styles.periodTableCard}>
          <View style={styles.balanceHeaderRow}>
            <View>
              <Text style={styles.periodHeader}>TODAY’S NET BALANCE</Text>
              <Text style={styles.balanceHeroAmount}>₹{drawerCash.toLocaleString('en-IN')}.00</Text>
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
              <Text style={styles.periodLabel}>Money in</Text>
            </View>
            <Text style={styles.periodValueCredit}>+₹2,213.22</Text>
          </View>

          <View style={styles.periodRow}>
            <View style={styles.periodLeft}>
              <View style={styles.arrowCircle}>
                <Text style={styles.arrowSymbol}>↓</Text>
              </View>
              <Text style={styles.periodLabel}>Money out</Text>
            </View>
            <Text style={styles.periodValueDebit}>-₹1,821.35</Text>
          </View>

          <View style={[styles.periodRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.periodLeft}>
              <View style={[styles.arrowCircle, { borderColor: '#073B3A' }]}>
              <Ionicons name="trending-up-outline" size={12} color="#073B3A" />
              </View>
              <Text style={[styles.periodLabel, { fontWeight: '700' }]}>Net balance</Text>
            </View>
            <Text style={styles.periodValueAccrual}>+₹391.87</Text>
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
              onPress={() => handleSimulateUtterance('MULTI_POST')}
              disabled={loading}
            >
              <View style={styles.limeIconBox}>
                <Ionicons name="mic-outline" size={20} color="#073B3A" />
              </View>
              <Text style={styles.actionGridTitle}>{loading ? 'Adding...' : 'Voice Sale'}</Text>
              <Text style={styles.actionGridSub}>Speak order</Text>
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
                <Text style={styles.donutTotalKg}>4.0 kg</Text>
                <Text style={styles.donutSubText}>Tomatoes</Text>
              </View>
            </View>

            {/* Legend Breakdown */}
            <View style={styles.donutLegend}>
              <View style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#073B3A' }]} />
                <Text style={styles.legendName}>Heat Rot: <Text style={styles.legendBold}>{rotLoss}%</Text></Text>
              </View>

              <View style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#E2FD52' }]} />
                <Text style={styles.legendName}>Family Food: <Text style={styles.legendBold}>{familyLunch}%</Text></Text>
              </View>

              <View style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} />
                <Text style={styles.legendName}>Theft / Loss: <Text style={styles.legendBold}>{theftLoss}%</Text></Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Voice Scenarios</Text>
        <View style={styles.scenariosFlow}>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleSimulateUtterance('MULTI_POST')}>
            <Text style={styles.scenarioPillText}>Add mixed sale</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleSimulateUtterance('NEGOTIATION')}>
            <Text style={styles.scenarioPillText}>Set price at ₹45</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleSimulateUtterance('WALKAWAY')}>
            <Text style={styles.scenarioPillText}>Customer left</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scenarioPill} onPress={() => handleSimulateUtterance('FREEBIE')}>
            <Text style={styles.scenarioPillText}>Add a free item</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scenarioPill, { backgroundColor: '#F1FFE5', borderColor: '#073B3A', borderWidth: 1 }]}
            onPress={() => {
              setConfirmationPending({
                item: '1 kg Tomatoes',
                amount: 30,
                text: '...ek kilo tamatar... (loud bus horn)'
              });
            }}
          >
            <Text style={[styles.scenarioPillText, { fontWeight: '800' }]}>👂 Muffled voice test</Text>
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
            onPress={() => handleSimulateUtterance('MULTI_POST')}
            disabled={loading}
            accessibilityLabel="Add a sale by voice"
          >
            <View style={styles.dockMicPulse} />
            <Ionicons name={loading ? 'hourglass-outline' : 'mic'} size={23} color="#073B3A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dockItem} onPress={() => {
            Alert.alert('Your shop', 'Manage your shop details and account settings here.');
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
          if (summary.isCash) {
            setDrawerCash(prev => Math.max(0, prev - cost));
          }
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
            setDrawerCash(prev => prev + amount);
          }
        }}
      />

      <SyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        apiBaseUrl={getApiBaseUrl()}
        onSyncComplete={(count) => {
          Alert.alert('Helper Sync', `Synchronized ${count} sales from nearby helper stall phone.`);
        }}
      />

      <EODReconciliationModal
        visible={showEOD}
        onClose={() => setShowEOD(false)}
        apiBaseUrl={getApiBaseUrl()}
        confirmedUpiTotal={140}
        onReconciliationComplete={(res) => {
          if (res.acceptedTransactions) {
            Alert.alert(
              'Register Closed',
              `${res.acceptedTransactions.length} sales confirmed. Real take-home profit: ₹${res.takeHomeProfit || 0}`
            );
          }
          setShowEOD(false);
        }}
      />

      <LossModal
        visible={showLoss}
        onClose={() => setShowLoss(false)}
        apiBaseUrl={getApiBaseUrl()}
        onCalculate={(r, f, t) => {
          setRotLoss(r);
          setFamilyLunch(f);
          setTheftLoss(t);
        }}
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

  /* DAYTIME LISTENING STATUS CARD */
  listeningStatusCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  listeningTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listeningStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPaused: {
    backgroundColor: '#9CA3AF',
  },
  listeningStatusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
  },
  listeningStatusSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  shiftToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  shiftToggleBtnPause: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  shiftToggleBtnStart: {
    backgroundColor: '#E2FD52',
  },
  shiftToggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
  },
  dialogueBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dialogueBubbleText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
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

  /* 1. CONCEPTZILLA WAVE CARDS */
  cardsCarousel: {
    paddingVertical: 10,
    paddingRight: 10,
  },
  zillaCard: {
    width: 250,
    height: 155,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 18,
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
  },
  cardBrandIcon: {
    marginRight: 4,
  },
  cardBrandTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
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
    marginTop: 10,
    zIndex: 2,
  },
  cardAmountText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  kuroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
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
    fontWeight: '800',
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
