import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onUpiPaymentConfirmed?: (amount: number, isSale: boolean) => void;
}

export interface VerificationItem {
  id: string;
  type: 'SOUNDBOX_CHIME' | 'SMS_NOTIFICATION';
  appName: string;
  amount: number;
  time: string;
  timestamp: number;
  refId?: string;
  isPotentialNeighbor: boolean;
}

export interface ResolvedHistoryItem {
  id: string;
  type: 'DUAL_FUSION' | 'MANUAL_VERIFIED' | 'NEIGHBOR_QUARANTINED' | 'PERSONAL_EQUITY';
  title: string;
  subtitle: string;
  amount: number;
  time: string;
  badgeText: string;
  status: 'CONFIRMED' | 'QUARANTINED' | 'ISOLATED';
}

export const UpiEventsModal: React.FC<Props> = ({
  visible,
  onClose,
  apiBaseUrl,
  onUpiPaymentConfirmed
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'VERIFICATION' | 'HISTORY'>('VERIFICATION');
  const [simulating, setSimulating] = useState<string | null>(null);

  // Verification stage queues
  const [pendingQueue, setPendingQueue] = useState<VerificationItem[]>([]);
  const [history, setHistory] = useState<ResolvedHistoryItem[]>([
    {
      id: 'hist-init-1',
      type: 'DUAL_FUSION',
      title: 'Paytm Soundbox + Bank SMS Matched',
      subtitle: 'Audio chime matched status-bar SMS within 4.2s • Added to sales tally',
      amount: 40,
      time: '11:15 AM',
      badgeText: 'Dual Fusion Verified',
      status: 'CONFIRMED'
    },
    {
      id: 'hist-init-2',
      type: 'NEIGHBOR_QUARANTINED',
      title: 'Side Stall Soundbox Noise Ignored',
      subtitle: 'Chime heard with zero matching bank SMS • Protected from false sales tally',
      amount: 100,
      time: '11:42 AM',
      badgeText: 'Neighbor Chime Quarantined (₹0)',
      status: 'QUARANTINED'
    }
  ]);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Fetch live verification queue when modal opens
  useEffect(() => {
    if (!visible) return;
    fetchVerificationQueue();
  }, [visible]);

  const fetchVerificationQueue = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/verification-queue`);
      const data = await res.json();
      if (data.ok) {
        const items: VerificationItem[] = [];

        // Format pending chimes
        (data.pendingChimes || []).forEach((c: any) => {
          items.push({
            id: c.chimeId,
            type: 'SOUNDBOX_CHIME',
            appName: c.sourceApp || 'PAYTM',
            amount: c.amount,
            time: new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: c.timestamp,
            isPotentialNeighbor: true
          });
        });

        // Format pending notifications
        (data.pendingNotifications || []).forEach((n: any) => {
          items.push({
            id: n.refId || n.notificationId,
            type: 'SMS_NOTIFICATION',
            appName: n.sourceApp || 'PAYTM',
            amount: n.amount,
            time: new Date(n.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: n.receivedAt,
            refId: n.refId,
            isPotentialNeighbor: false
          });
        });

        setPendingQueue(items);
      }
    } catch {
      // Retain existing local state
    }
  };

  // 1. Simulate Acoustic Soundbox Chime (Enters Verification Stage - NOT added to tally yet)
  const handleSimulateChime = async (amount = 50) => {
    setSimulating('CHIME');
    setLoading(true);
    setStatusBanner(null);

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SOUNDBOX_CHIME',
          amount,
          appName: 'PAYTM',
          confidence: 0.95,
          timestamp: Date.now()
        })
      });
      const data = await res.json();

      if (data.isDualConfirmed) {
        // Matched an existing SMS in buffer
        const hist: ResolvedHistoryItem = {
          id: `dual-${Date.now()}`,
          type: 'DUAL_FUSION',
          title: `Paytm Soundbox + SMS Matched (+₹${amount})`,
          subtitle: 'Dual acoustic chime + bank SMS mutually verified • Credited to sales',
          amount,
          time: 'Just now',
          badgeText: 'Dual Fusion Verified',
          status: 'CONFIRMED'
        };
        setHistory(prev => [hist, ...prev]);
        if (onUpiPaymentConfirmed) onUpiPaymentConfirmed(amount, true);
        setStatusBanner(`✓ Soundbox chime matched with existing Bank SMS! Added ₹${amount} to sales.`);
        await fetchVerificationQueue();
      } else {
        // Enters Verification Queue
        const newPending: VerificationItem = {
          id: `CHIME_${Date.now()}`,
          type: 'SOUNDBOX_CHIME',
          appName: 'PAYTM',
          amount,
          time: 'Just now',
          timestamp: Date.now(),
          isPotentialNeighbor: true
        };
        setPendingQueue(prev => [newPending, ...prev]);
        setStatusBanner(`⚠️ Chime heard (+₹${amount}) — Holding in Verification Stage. Waiting for matching bank SMS.`);
      }
    } catch {
      setStatusBanner('⚠ Could not contact server for chime processing.');
    } finally {
      setLoading(false);
      setSimulating(null);
    }
  };

  // 2. Simulate Matching Bank SMS Notification (Triggers Fusion or Enters Queue)
  const handleSimulateSms = async (amount = 50) => {
    setSimulating('SMS');
    setLoading(true);
    setStatusBanner(null);

    const rrn = `PAYTM${amount}${Date.now().toString().slice(-4)}`;

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SMS_NOTIFICATION',
          amount,
          appName: 'PAYTM',
          rrn,
          timestamp: Date.now()
        })
      });
      const data = await res.json();

      if (data.isDualConfirmed) {
        // FUSED! Chime + SMS matched
        const hist: ResolvedHistoryItem = {
          id: `dual-${Date.now()}`,
          type: 'DUAL_FUSION',
          title: `Paytm Soundbox + SMS Matched (+₹${amount})`,
          subtitle: `Bank alert matched audio chime • Verified with RRN: ${rrn}`,
          amount,
          time: 'Just now',
          badgeText: 'Dual Fusion Verified',
          status: 'CONFIRMED'
        };
        setHistory(prev => [hist, ...prev]);
        setPendingQueue(prev => prev.filter(p => !(p.type === 'SOUNDBOX_CHIME' && Math.abs(p.amount - amount) < 0.01)));
        if (onUpiPaymentConfirmed) onUpiPaymentConfirmed(amount, true);
        setStatusBanner(`✓ DUAL STREAM FUSION! Bank SMS verified Soundbox chime. ₹${amount} credited to register.`);
      } else {
        // Silent notification
        const newPending: VerificationItem = {
          id: rrn,
          type: 'SMS_NOTIFICATION',
          appName: 'PAYTM',
          amount,
          time: 'Just now',
          timestamp: Date.now(),
          refId: rrn,
          isPotentialNeighbor: false
        };
        setPendingQueue(prev => [newPending, ...prev]);
        setStatusBanner(`📱 Bank SMS alert received (+₹${amount}) — Holding in verification stage.`);
      }
    } catch {
      setStatusBanner('⚠ Could not contact server for SMS event.');
    } finally {
      setLoading(false);
      setSimulating(null);
    }
  };

  // 3. Vendor Manually Confirms: "This was my stall's sale!"
  const handleConfirmMySale = async (item: VerificationItem) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/verify-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: item.id,
          action: 'CONFIRM_MY_SALE',
          targetType: item.type === 'SOUNDBOX_CHIME' ? 'CHIME' : 'NOTIFICATION'
        })
      });
      const data = await res.json();

      // Remove from pending
      setPendingQueue(prev => prev.filter(p => p.id !== item.id));

      // Add to history
      const hist: ResolvedHistoryItem = {
        id: `manual-${Date.now()}`,
        type: 'MANUAL_VERIFIED',
        title: `${item.appName} Sale Manually Verified (+₹${item.amount})`,
        subtitle: 'Vendor confirmed payment authenticity • Credited to sales register',
        amount: item.amount,
        time: 'Just now',
        badgeText: 'Vendor Verified',
        status: 'CONFIRMED'
      };
      setHistory(prev => [hist, ...prev]);

      // Add to main App transactions tally
      if (onUpiPaymentConfirmed) {
        onUpiPaymentConfirmed(item.amount, true);
      }

      setStatusBanner(`✓ Confirmed! Added ₹${item.amount} to today's sales tally.`);
    } catch {
      setStatusBanner('⚠ Error confirming sale. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Vendor Discards: "Neighbor stall's soundbox noise!"
  const handleQuarantineNeighbor = async (item: VerificationItem) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/verify-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: item.id,
          action: 'QUARANTINE_NEIGHBOR',
          targetType: 'CHIME'
        })
      });

      // Remove from pending
      setPendingQueue(prev => prev.filter(p => p.id !== item.id));

      // Add to quarantined history with 0 added to tally
      const hist: ResolvedHistoryItem = {
        id: `quar-${Date.now()}`,
        type: 'NEIGHBOR_QUARANTINED',
        title: `Side Stall Soundbox Quarantined (₹${item.amount})`,
        subtitle: 'Identified as neighboring stall noise • ₹0 added to drawer tally',
        amount: item.amount,
        time: 'Just now',
        badgeText: 'Neighbor Quarantined (₹0)',
        status: 'QUARANTINED'
      };
      setHistory(prev => [hist, ...prev]);

      setStatusBanner(`🛡️ Neighbor soundbox discarded! ₹0 added to your register.`);
    } catch {
      setStatusBanner('⚠ Error quarantining chime.');
    } finally {
      setLoading(false);
    }
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
                  <Ionicons name="shield-checkmark" size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>Soundbox & SMS Verification</Text>
                  <Text style={styles.subtitle}>Dual-Stream Cross-Check: Eliminates Neighbor Collisions</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Explainable Protective Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={18} color="#073B3A" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.infoBannerText}>
                In dense market rows, nearby stalls' soundboxes can trigger false sales. Cascade cross-references the mic audio chime against your phone's bank SMS alerts. Only verified payments enter your register.
              </Text>
            </View>

            {/* Interactive Scenario Testers */}
            <Text style={styles.sectionHeading}>TEST DUAL-STREAM SCENARIOS</Text>
            <View style={styles.simGrid}>
              <TouchableOpacity
                style={[styles.simCard, simulating === 'CHIME' && styles.simCardActive]}
                onPress={() => handleSimulateChime(50)}
                disabled={loading}
              >
                <Ionicons name="volume-high-outline" size={18} color="#073B3A" />
                <Text style={styles.simCardTitle}>1. Hear Soundbox</Text>
                <Text style={styles.simCardSub}>₹50 Chime Only</Text>
                <View style={styles.simBadgeWarn}>
                  <Text style={styles.simBadgeWarnText}>Hold in Verify</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simCard, simulating === 'SMS' && styles.simCardActive]}
                onPress={() => handleSimulateSms(50)}
                disabled={loading}
              >
                <Ionicons name="chatbox-ellipses-outline" size={18} color="#073B3A" />
                <Text style={styles.simCardTitle}>2. Bank SMS Alert</Text>
                <Text style={styles.simCardSub}>₹50 Matching SMS</Text>
                <View style={styles.simBadgeSuccess}>
                  <Text style={styles.simBadgeSuccessText}>Auto-Fuse</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.simCard}
                onPress={() => handleSimulateChime(120)}
                disabled={loading}
              >
                <Ionicons name="radio-outline" size={18} color="#DC2626" />
                <Text style={styles.simCardTitle}>3. Neighbor Chime</Text>
                <Text style={styles.simCardSub}>₹120 Side Stall</Text>
                <View style={styles.simBadgeDanger}>
                  <Text style={styles.simBadgeDangerText}>Spillover</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Live Feedback Status Banner */}
            {statusBanner && (
              <View style={styles.liveNoticeCard}>
                <Ionicons name="sparkles" size={16} color="#073B3A" style={{ marginRight: 6 }} />
                <Text style={styles.liveNoticeText}>{statusBanner}</Text>
              </View>
            )}

            {/* Tab Navigation */}
            <View style={styles.tabStrip}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'VERIFICATION' && styles.tabItemActive]}
                onPress={() => setActiveTab('VERIFICATION')}
              >
                <Text style={[styles.tabText, activeTab === 'VERIFICATION' && styles.tabTextActive]}>
                  Pending Verification ({pendingQueue.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'HISTORY' && styles.tabItemActive]}
                onPress={() => setActiveTab('HISTORY')}
              >
                <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>
                  Verified Ledger ({history.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* SECTION 1: PENDING VERIFICATION STAGE */}
            {activeTab === 'VERIFICATION' && (
              <View style={styles.verificationSection}>
                {pendingQueue.length === 0 ? (
                  <View style={styles.emptyVerificationBox}>
                    <Ionicons name="checkmark-done-circle-outline" size={44} color="#79AF00" />
                    <Text style={styles.emptyVerificationTitle}>All Inflows Verified</Text>
                    <Text style={styles.emptyVerificationSub}>
                      No pending soundbox chimes or unverified alerts. Your sales tally is clean and protected from neighbor noise.
                    </Text>
                  </View>
                ) : (
                  pendingQueue.map((item) => (
                    <View key={item.id} style={styles.pendingCard}>
                      {/* Warning Header */}
                      <View style={styles.pendingWarnHeader}>
                        <View style={styles.warnPill}>
                          <Ionicons name="warning-outline" size={12} color="#9A3412" style={{ marginRight: 4 }} />
                          <Text style={styles.warnPillText}>
                            {item.type === 'SOUNDBOX_CHIME' ? 'UNMATCHED SOUNDBOX AUDIO' : 'BANK SMS (NO CHIME)'}
                          </Text>
                        </View>
                        <Text style={styles.pendingTime}>{item.time}</Text>
                      </View>

                      {/* Item Details */}
                      <View style={styles.pendingMainRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.pendingTitle}>
                            {item.type === 'SOUNDBOX_CHIME' ? 'Microphone Heard Soundbox Chime' : 'Incoming Bank Notification'}
                          </Text>
                          <Text style={styles.pendingSub}>
                            {item.isPotentialNeighbor
                              ? 'Could be neighboring stall vendor soundbox. Confirm below to add to sales.'
                              : 'Payment received without audio soundbox chime. Verify if customer paid.'}
                          </Text>
                        </View>
                        <Text style={styles.pendingAmount}>₹{item.amount.toLocaleString('en-IN')}</Text>
                      </View>

                      {/* Verification Action Buttons */}
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.confirmSaleBtn}
                          onPress={() => handleConfirmMySale(item)}
                          disabled={loading}
                        >
                          <Ionicons name="checkmark-circle" size={15} color="#073B3A" style={{ marginRight: 5 }} />
                          <Text style={styles.confirmSaleText}>Confirm My Sale (+₹{item.amount})</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.quarantineBtn}
                          onPress={() => handleQuarantineNeighbor(item)}
                          disabled={loading}
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                          <Text style={styles.quarantineText}>Ignore (Neighbor's)</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* SECTION 2: VERIFIED HISTORY */}
            {activeTab === 'HISTORY' && (
              <View style={styles.historySection}>
                {history.map((item) => (
                  <View key={item.id} style={styles.feedCard}>
                    <View style={styles.feedTopRow}>
                      <View style={[
                        styles.statusBadge,
                        item.status === 'CONFIRMED' && styles.badgeConfirmed,
                        item.status === 'QUARANTINED' && styles.badgeQuarantined,
                        item.status === 'ISOLATED' && styles.badgeIsolated
                      ]}>
                        <Text style={[
                          styles.badgeLabel,
                          item.status === 'CONFIRMED' && styles.badgeLabelConfirmed,
                          item.status === 'QUARANTINED' && styles.badgeLabelQuarantined,
                          item.status === 'ISOLATED' && styles.badgeLabelIsolated
                        ]}>
                          {item.badgeText}
                        </Text>
                      </View>
                      <Text style={styles.feedTime}>{item.time}</Text>
                    </View>

                    <View style={styles.feedMainRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.feedTitle}>{item.title}</Text>
                        <Text style={styles.feedSub}>{item.subtitle}</Text>
                      </View>
                      <Text style={[
                        styles.feedAmount,
                        item.status === 'CONFIRMED' && styles.amountConfirmed,
                        item.status === 'QUARANTINED' && styles.amountQuarantined,
                        item.status === 'ISOLATED' && styles.amountIsolated
                      ]}>
                        {item.status === 'QUARANTINED' ? '₹0 (Quarantined)' : `+₹${item.amount.toLocaleString('en-IN')}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.closeFullBtn} onPress={onClose}>
              <Text style={styles.closeFullBtnText}>Done</Text>
            </TouchableOpacity>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1FFE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#073B3A',
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#F8FCF9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#073B3A',
    lineHeight: 16,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  simGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  simCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  simCardActive: {
    borderColor: '#073B3A',
    backgroundColor: '#F1FFE5',
  },
  simCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  simCardSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  simBadgeWarn: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  simBadgeWarnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
  },
  simBadgeSuccess: {
    backgroundColor: '#F1FFE5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  simBadgeSuccessText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#225200',
  },
  simBadgeDanger: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  simBadgeDangerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
  },
  liveNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1FFE5',
    borderWidth: 1,
    borderColor: '#79AF00',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  liveNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#073B3A',
    fontWeight: '700',
    lineHeight: 16,
  },
  tabStrip: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
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
    fontWeight: '800',
  },
  verificationSection: {
    marginBottom: 10,
  },
  emptyVerificationBox: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F8FCF9',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDECE7',
    paddingHorizontal: 20,
  },
  emptyVerificationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#073B3A',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyVerificationSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  pendingCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    padding: 14,
    marginBottom: 10,
  },
  pendingWarnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  warnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  warnPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9A3412',
    letterSpacing: 0.4,
  },
  pendingTime: {
    fontSize: 10,
    color: '#78716C',
    fontWeight: '600',
  },
  pendingMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 2,
  },
  pendingSub: {
    fontSize: 11,
    color: '#78716C',
    lineHeight: 15,
  },
  pendingAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#073B3A',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmSaleBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2FD52',
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 6,
    shadowColor: '#073B3A',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmSaleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
  },
  quarantineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F87171',
    paddingVertical: 10,
    borderRadius: 12,
  },
  quarantineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  historySection: {
    marginBottom: 10,
  },
  feedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  feedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeConfirmed: {
    backgroundColor: '#F1FFE5',
  },
  badgeQuarantined: {
    backgroundColor: '#FEE2E2',
  },
  badgeIsolated: {
    backgroundColor: '#EFF6FF',
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeLabelConfirmed: {
    color: '#225200',
  },
  badgeLabelQuarantined: {
    color: '#991B1B',
  },
  badgeLabelIsolated: {
    color: '#1E40AF',
  },
  feedTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  feedMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  feedSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  feedAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  amountConfirmed: {
    color: '#073B3A',
  },
  amountQuarantined: {
    color: '#9CA3AF',
  },
  amountIsolated: {
    color: '#1D4ED8',
  },
  closeFullBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  closeFullBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
});
