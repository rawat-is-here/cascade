import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { OnboardingModal } from './components/OnboardingModal';
import { MenuBuilderModal, MenuItem } from './components/MenuBuilderModal';
import { UdharKhataTab } from './components/UdharKhataTab';
import { SmartRasoiTab } from './components/SmartRasoiTab';
import { PariwarMeshTab } from './components/PariwarMeshTab';
import { VoiceIngestionModal } from './components/VoiceIngestionModal';
import { JudgeEngineModal } from './components/JudgeEngineModal';

type ActiveTab = 'dashboard' | 'udhar' | 'rasoi' | 'pariwar';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMenuBuilder, setShowMenuBuilder] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showJudgeModal, setShowJudgeModal] = useState(false);

  // Core Financial State
  const [cashOnHand, setCashOnHand] = useState(3200);
  const [profitRange, setProfitRange] = useState<[number, number]>([950, 1120]);
  const [confidencePct, setConfidencePct] = useState(85);
  const [mandiExpense, setMandiExpense] = useState(1400);
  const [spoilageDeduction, setSpoilageDeduction] = useState(350);
  const [uncollectedUdhar, setUncollectedUdhar] = useState(450);

  // App Config
  const [language, setLanguage] = useState<'hi' | 'en'>('en');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [pariwarSynced, setPariwarSynced] = useState(true);

  // Live Activity Feed
  const [feed, setFeed] = useState([
    {
      id: 'f1',
      type: 'voice',
      text: 'शर्मा जी का ₹40 जमा, 7 प्लेट पोहा (+₹175)',
      time: '10 मिनट पहले',
      confidence: '92% पक्का'
    },
    {
      id: 'f2',
      type: 'upi',
      text: 'PhonePe Soundbox: ₹25 प्राप्त हुए (Poha #42)',
      time: '24 मिनट पहले',
      confidence: '100% पक्का'
    },
    {
      id: 'f3',
      type: 'slip',
      text: 'छोटू मंडी पर्ची: 10kg आलू @ ₹280, 5L तेल @ ₹550',
      time: 'सुबह 06:15 AM',
      confidence: '95% पक्का'
    }
  ]);

  // Handle transaction confirmation from voice modal
  const handleConfirmVoice = (entries: {
    inventoryExpense: number;
    creditSettled: number;
    salesEarned: number;
  }) => {
    setCashOnHand((prev) => prev - entries.inventoryExpense + entries.creditSettled + entries.salesEarned);
    setMandiExpense((prev) => prev + entries.inventoryExpense);
    setUncollectedUdhar((prev) => Math.max(0, prev - entries.creditSettled));
    setProfitRange(([low, high]) => [
      low + entries.salesEarned - Math.round(entries.inventoryExpense * 0.4),
      high + entries.salesEarned - Math.round(entries.inventoryExpense * 0.3)
    ]);
    setFeed((prev) => [
      {
        id: `f_${Date.now()}`,
        type: 'voice',
        text: `आवाज़ प्रविष्टि: +₹${entries.salesEarned} बिक्री, -₹${entries.inventoryExpense} कच्चा माल, +₹${entries.creditSettled} उधारी जमा`,
        time: 'अभी-अभी (Just now)',
        confidence: '94% पक्का'
      },
      ...prev
    ]);
  };

  const isHindi = language === 'hi';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />

      {/* TOP STATUS BAR */}
      <View style={styles.topBar}>
        <View style={styles.row}>
          <Text style={styles.logo}>GallaSahi</Text>
          <TouchableOpacity
            style={styles.pariwarPill}
            onPress={() => setActiveTab('pariwar')}
          >
            <View style={styles.greenDot} />
            <Text style={styles.pariwarPillText}>
              {isHindi ? 'परिवार सिंक' : 'Pariwar Synced'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          {/* Language Toggle */}
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
          >
            <Text style={styles.langBtnText}>{isHindi ? 'English' : 'हिंदी'}</Text>
          </TouchableOpacity>

          {/* Menu Builder Button */}
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => setShowMenuBuilder(true)}
          >
            <Ionicons name="restaurant-outline" size={18} color="#34d399" />
          </TouchableOpacity>

          {/* Judge / Red Team Mode Button */}
          <TouchableOpacity
            style={styles.judgeBtn}
            onPress={() => setShowJudgeModal(true)}
          >
            <Ionicons name="shield-checkmark" size={16} color="#fbbf24" />
            <Text style={styles.judgeBtnText}>जज मोड</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TAB 1: ASLI MUNAFA DASHBOARD */}
      {activeTab === 'dashboard' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* THE HERO TRUTH-TELLER CARD */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              {/* Left Column: Cash on hand */}
              <View style={styles.heroCol}>
                <Text style={styles.cashLabel}>
                  {isHindi ? 'गल्ले में कैश' : 'Drawer Cash'}
                </Text>
                <Text style={styles.cashValue}>₹{cashOnHand}</Text>
                <Text style={styles.cashHint}>
                  {isHindi ? 'हाथ की नक़दी (Cash on hand)' : 'Raw Cash Count'}
                </Text>
              </View>

              {/* Vertical Divider */}
              <View style={styles.verticalDivider} />

              {/* Right Column: Asli Munafa with Confidence Pill */}
              <View style={styles.heroCol}>
                <Text style={styles.profitLabel}>
                  {isHindi ? 'असली मुनाफ़ा' : 'True Accrual Profit'}
                </Text>
                <Text style={styles.profitValue}>
                  ₹{profitRange[0]} – ₹{profitRange[1]}
                </Text>
                <View style={styles.confidencePill}>
                  <View style={styles.greenDotSmall} />
                  <Text style={styles.confidenceText}>
                    {confidencePct}% {isHindi ? 'पक्का (High Confidence)' : 'Confidence'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Deduction Ribbon (Where did money go?) */}
            <View style={styles.deductionRibbon}>
              <Text style={styles.ribbonItemNegative}>
                -₹{mandiExpense} {isHindi ? 'कच्चा माल' : 'Raw Materials'}
              </Text>
              <Text style={styles.ribbonDot}>•</Text>
              <Text style={styles.ribbonItemNegative}>
                -₹{spoilageDeduction} {isHindi ? 'सड़न/खपत' : 'Spoilage'}
              </Text>
              <Text style={styles.ribbonDot}>•</Text>
              <Text style={styles.ribbonItemPositive}>
                +₹{uncollectedUdhar} {isHindi ? 'बाक़ी उधारी' : 'Credit'}
              </Text>
            </View>
          </View>

          {/* TWO QUICK ACTION CARDS */}
          <View style={styles.quickGrid}>
            {/* Quick Card 1: Udhar Khata */}
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => setActiveTab('udhar')}
            >
              <View style={styles.quickCardHeader}>
                <View style={[styles.quickIconBox, { backgroundColor: '#3b0764' }]}>
                  <Ionicons name="people" size={18} color="#c084fc" />
                </View>
                <Text style={styles.quickCardTitle}>
                  {isHindi ? 'उधार खाता' : 'Udhar Khata'}
                </Text>
              </View>
              <View style={styles.customerChip}>
                <Text style={styles.customerChipText}>शर्मा जी (₹240 बाक़ी)</Text>
              </View>
              <Text style={styles.quickCardHint}>
                {isHindi ? 'कुल ₹790 बाक़ी • तकाज़ा भेजें' : 'Tap to manage credit'}
              </Text>
            </TouchableOpacity>

            {/* Quick Card 2: Smart Rasoi */}
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => setActiveTab('rasoi')}
            >
              <View style={styles.quickCardHeader}>
                <View style={[styles.quickIconBox, { backgroundColor: '#064e3b' }]}>
                  <Ionicons name="restaurant" size={18} color="#34d399" />
                </View>
                <Text style={styles.quickCardTitle}>
                  {isHindi ? 'स्मार्ट रसोई' : 'Smart Rasoi'}
                </Text>
              </View>
              <View style={styles.customerChip}>
                <Text style={styles.customerChipText}>5kg आलू → ~35 प्लेट</Text>
              </View>
              <Text style={styles.quickCardHint}>
                {isHindi ? 'रेसिपी अनुमान & नुक़सान विभाजन' : 'Zero-shot BOM & Wastage'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* LIVE ACTIVITY FEED */}
          <View style={styles.feedHeaderRow}>
            <Text style={styles.feedHeading}>
              {isHindi ? 'आज की मुख्य प्रविष्टियाँ (Live Activity)' : 'Today Activity'}
            </Text>
            <TouchableOpacity onPress={() => setShowVoiceModal(true)}>
              <Text style={styles.simulateBtnText}>
                {isHindi ? '+ बोल कर जोड़ें' : '+ Voice Add'}
              </Text>
            </TouchableOpacity>
          </View>

          {feed.map((item) => (
            <View key={item.id} style={styles.feedCard}>
              <View style={styles.feedIconBox}>
                <Ionicons
                  name={
                    item.type === 'voice'
                      ? 'mic'
                      : item.type === 'upi'
                      ? 'notifications'
                      : 'receipt'
                  }
                  size={16}
                  color={
                    item.type === 'voice'
                      ? '#34d399'
                      : item.type === 'upi'
                      ? '#38bdf8'
                      : '#fbbf24'
                  }
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.feedText}>{item.text}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.feedTime}>{item.time}</Text>
                  <Text style={styles.feedConfidence}>{item.confidence}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* TAB 2: UDHAR KHATA */}
      {activeTab === 'udhar' && <UdharKhataTab />}

      {/* TAB 3: SMART RASOI */}
      {activeTab === 'rasoi' && <SmartRasoiTab />}

      {/* TAB 4: PARIWAR MESH */}
      {activeTab === 'pariwar' && <PariwarMeshTab />}

      {/* FLOATING ACTION MIC DOCK (OVERSIZED WITH PULSING RAYS) */}
      <View style={styles.floatingDockContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.floatingMicBtn}
          onPress={() => setShowVoiceModal(true)}
          activeOpacity={0.85}
        >
          <View style={styles.micInnerGlow}>
            <Ionicons name="mic" size={32} color="#ffffff" />
          </View>
        </TouchableOpacity>
        <View style={styles.voiceTooltip}>
          <Text style={styles.voiceTooltipText}>
            {isHindi ? 'बोल कर दर्ज करें (Tap & Speak)' : 'Tap & Speak to Log'}
          </Text>
        </View>
      </View>

      {/* BOTTOM TAB NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons
            name={activeTab === 'dashboard' ? 'pie-chart' : 'pie-chart-outline'}
            size={20}
            color={activeTab === 'dashboard' ? '#10b981' : '#94a3b8'}
          />
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>
            {isHindi ? 'मुनाफ़ा' : 'Munafa'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'udhar' && styles.navItemActive]}
          onPress={() => setActiveTab('udhar')}
        >
          <Ionicons
            name={activeTab === 'udhar' ? 'people' : 'people-outline'}
            size={20}
            color={activeTab === 'udhar' ? '#10b981' : '#94a3b8'}
          />
          <Text style={[styles.navText, activeTab === 'udhar' && styles.navTextActive]}>
            {isHindi ? 'उधारी' : 'Udhar'}
          </Text>
        </TouchableOpacity>

        {/* Space for the centered floating mic */}
        <View style={{ width: 60 }} />

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'rasoi' && styles.navItemActive]}
          onPress={() => setActiveTab('rasoi')}
        >
          <Ionicons
            name={activeTab === 'rasoi' ? 'restaurant' : 'restaurant-outline'}
            size={20}
            color={activeTab === 'rasoi' ? '#10b981' : '#94a3b8'}
          />
          <Text style={[styles.navText, activeTab === 'rasoi' && styles.navTextActive]}>
            {isHindi ? 'रसोई' : 'Rasoi'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'pariwar' && styles.navItemActive]}
          onPress={() => setActiveTab('pariwar')}
        >
          <Ionicons
            name={activeTab === 'pariwar' ? 'git-network' : 'git-network-outline'}
            size={20}
            color={activeTab === 'pariwar' ? '#10b981' : '#94a3b8'}
          />
          <Text style={[styles.navText, activeTab === 'pariwar' && styles.navTextActive]}>
            {isHindi ? 'परिवार' : 'Pariwar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODALS */}
      <OnboardingModal
        visible={showOnboarding}
        onComplete={(cfg) => {
          setCashOnHand(cfg.openingCash);
          setShowOnboarding(false);
        }}
      />

      <MenuBuilderModal
        visible={showMenuBuilder}
        onClose={() => setShowMenuBuilder(false)}
        onSaveMenu={(items) => setMenuItems(items)}
        initialItems={menuItems.length > 0 ? menuItems : undefined}
      />

      <VoiceIngestionModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onConfirmTransactions={handleConfirmVoice}
      />

      <JudgeEngineModal
        visible={showJudgeModal}
        onClose={() => setShowJudgeModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  flex1: {
    flex: 1
  },
  logo: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  pariwarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
    marginRight: 5
  },
  greenDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#34d399',
    marginRight: 4
  },
  pariwarPillText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '700'
  },
  langBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6
  },
  langBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600'
  },
  iconActionBtn: {
    backgroundColor: '#1e293b',
    padding: 6,
    borderRadius: 6,
    marginRight: 6
  },
  judgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a03',
    borderColor: '#b45309',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  judgeBtnText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4
  },
  scroll: {
    padding: 16,
    paddingBottom: 110
  },
  heroCard: {
    backgroundColor: '#131b2e',
    borderColor: '#1e293b',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  heroCol: {
    flex: 1
  },
  verticalDivider: {
    width: 1,
    height: '90%',
    backgroundColor: '#1e293b',
    marginHorizontal: 12
  },
  cashLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  cashValue: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4
  },
  cashHint: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4
  },
  profitLabel: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700'
  },
  profitValue: {
    color: '#34d399',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6
  },
  confidenceText: {
    color: '#a7f3d0',
    fontSize: 9,
    fontWeight: '700'
  },
  deductionRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0f1d',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  ribbonItemNegative: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '600'
  },
  ribbonItemPositive: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600'
  },
  ribbonDot: {
    color: '#475569',
    fontSize: 10
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#1e293b'
  },
  quickCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  quickIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  quickCardTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  customerChip: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6
  },
  customerChipText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600'
  },
  quickCardHint: {
    color: '#94a3b8',
    fontSize: 10
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  feedHeading: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700'
  },
  simulateBtnText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700'
  },
  feedCard: {
    backgroundColor: '#131b2e',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  feedIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  feedText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600'
  },
  feedTime: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  feedConfidence: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
  },
  floatingDockContainer: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999
  },
  floatingMicBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#10b981',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    borderWidth: 3,
    borderColor: '#34d399'
  },
  micInnerGlow: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  voiceTooltip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  voiceTooltipText: {
    color: '#a7f3d0',
    fontSize: 9,
    fontWeight: '700'
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    height: 64
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  navItemActive: {
    transform: [{ scale: 1.05 }]
  },
  navText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600'
  },
  navTextActive: {
    color: '#34d399',
    fontWeight: '700'
  }
});
