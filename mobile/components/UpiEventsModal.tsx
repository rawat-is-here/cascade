import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onUpiPaymentConfirmed?: (amount: number, isSale: boolean) => void;
}

interface UpiFeedItem {
  id: string;
  type: 'CONFIRMED_SALE' | 'PERSONAL_TRANSFER' | 'NEIGHBOR_CHIME';
  title: string;
  subtitle: string;
  amount: number;
  badgeText: string;
  time: string;
  status: 'CONFIRMED' | 'ISOLATED' | 'QUARANTINED';
}

export const UpiEventsModal: React.FC<Props> = ({
  visible,
  onClose,
  apiBaseUrl,
  onUpiPaymentConfirmed
}) => {
  const [loading, setLoading] = useState(false);
  const [simulatingKind, setSimulatingKind] = useState<'PAYTM' | 'PHONEPE' | 'SOUNDBOX' | null>(null);
  const [feed, setFeed] = useState<UpiFeedItem[]>([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Fetch recent UPI events when modal opens
  useEffect(() => {
    if (!visible) return;
    const fetchState = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/vendor/state`);
        const data = await res.json();
        // Extract upi events from state if available
        const events: UpiFeedItem[] = [];
        if (data && data.upiEvents && Array.isArray(data.upiEvents)) {
          data.upiEvents.forEach((e: any, idx: number) => {
            const status: UpiFeedItem['status'] =
              e.decision?.status === 'CONFIRMED' ? 'CONFIRMED' :
              e.decision?.status === 'ISOLATED' ? 'ISOLATED' : 'QUARANTINED';
            events.push({
              id: e.id || `upi-fetched-${idx}`,
              type: status === 'CONFIRMED' ? 'CONFIRMED_SALE' : status === 'ISOLATED' ? 'PERSONAL_TRANSFER' : 'NEIGHBOR_CHIME',
              title: e.title || e.appName || 'UPI Event',
              subtitle: e.subtitle || e.rawText || '',
              amount: e.amount || 0,
              badgeText: status === 'CONFIRMED' ? 'Confirmed Shop Sale' : status === 'ISOLATED' ? 'Personal Money (Equity)' : 'Neighbor Chime Ignored',
              time: e.time || 'Today',
              status
            });
          });
        }
        setFeed(events);
      } catch {
        // Start with empty feed if API unavailable
        setFeed([]);
      }
    };
    fetchState();
  }, [visible]);

  const handleSimulatePaytm = async () => {
    setSimulatingKind('PAYTM');
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SMS_NOTIFICATION',
          amount: 30,
          appName: 'PAYTM',
          rawText: 'Rs. 30 received from Customer via Paytm'
        })
      });
      const data = await res.json();
      const serverStatus: UpiFeedItem['status'] =
        data?.decision?.status === 'CONFIRMED' ? 'CONFIRMED' :
        data?.decision?.status === 'ISOLATED' ? 'ISOLATED' : 'CONFIRMED';
      const newItem: UpiFeedItem = {
        id: `upi-live-${Date.now()}`,
        type: 'CONFIRMED_SALE',
        title: 'Paytm SMS (+₹30)',
        subtitle: 'Rs. 30 received from Customer via Paytm',
        amount: 30,
        badgeText: 'Confirmed Shop Sale',
        time: 'Just now',
        status: serverStatus
      };
      setFeed(prev => [newItem, ...prev]);
      if (serverStatus === 'CONFIRMED' && onUpiPaymentConfirmed) onUpiPaymentConfirmed(30, true);
      setStatusNotice('✓ Paytm ₹30 event processed by server.');
    } catch {
      setStatusNotice('⚠ Could not reach server for Paytm event.');
    } finally {
      setLoading(false);
      setSimulatingKind(null);
    }
  };

  const handleSimulatePhonePe = async () => {
    setSimulatingKind('PHONEPE');
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SMS_NOTIFICATION',
          amount: 50,
          appName: 'PHONEPE',
          rawText: 'Rs. 50 credited via PhonePe'
        })
      });
      const data = await res.json();
      const serverStatus: UpiFeedItem['status'] =
        data?.decision?.status === 'CONFIRMED' ? 'CONFIRMED' :
        data?.decision?.status === 'ISOLATED' ? 'ISOLATED' : 'CONFIRMED';
      const newItem: UpiFeedItem = {
        id: `upi-live-${Date.now()}`,
        type: 'CONFIRMED_SALE',
        title: 'PhonePe SMS (+₹50)',
        subtitle: 'Rs. 50 credited via PhonePe',
        amount: 50,
        badgeText: 'Confirmed Shop Sale',
        time: 'Just now',
        status: serverStatus
      };
      setFeed(prev => [newItem, ...prev]);
      if (serverStatus === 'CONFIRMED' && onUpiPaymentConfirmed) onUpiPaymentConfirmed(50, true);
      setStatusNotice('✓ PhonePe ₹50 event processed by server.');
    } catch {
      setStatusNotice('⚠ Could not reach server for PhonePe event.');
    } finally {
      setLoading(false);
      setSimulatingKind(null);
    }
  };

  const handleSimulateSoundbox = async () => {
    setSimulatingKind('SOUNDBOX');
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SOUNDBOX_CHIME',
          amount: 80,
          appName: 'PAYTM',
          confidence: 0.96
        })
      });
      const data = await res.json();
      const serverStatus: UpiFeedItem['status'] =
        data?.decision?.status === 'CONFIRMED' ? 'CONFIRMED' :
        data?.decision?.status === 'ISOLATED' ? 'ISOLATED' :
        data?.decision?.status === 'QUARANTINED' ? 'QUARANTINED' : 'CONFIRMED';
      const newItem: UpiFeedItem = {
        id: `upi-live-${Date.now()}`,
        type: serverStatus === 'QUARANTINED' ? 'NEIGHBOR_CHIME' : 'CONFIRMED_SALE',
        title: 'Paytm Soundbox Chime (+₹80)',
        subtitle: 'Soundbox chime detected with high confidence',
        amount: 80,
        badgeText: serverStatus === 'QUARANTINED' ? 'Neighbor Chime Ignored' : 'Confirmed Shop Sale',
        time: 'Just now',
        status: serverStatus
      };
      setFeed(prev => [newItem, ...prev]);
      if (serverStatus === 'CONFIRMED' && onUpiPaymentConfirmed) onUpiPaymentConfirmed(80, true);
      setStatusNotice(`✓ Soundbox ₹80 event processed (${serverStatus}).`);
    } catch {
      setStatusNotice('⚠ Could not reach server for Soundbox event.');
    } finally {
      setLoading(false);
      setSimulatingKind(null);
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
                  <Ionicons name="phone-portrait-outline" size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>Online Payments</Text>
                  <Text style={styles.subtitle}>Soundbox & QR Cross-Validation</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Explanation Note */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How it works for your stall:</Text>
              <Text style={styles.infoBody}>
                When a customer scans your QR, it matches the soundbox chime and adds to sales. If family sends money for home, the app automatically isolates it so your shop accounts stay 100% clean.
              </Text>
            </View>

            {/* Test Simulation Controls */}
            <Text style={styles.sectionHeading}>Simulate Live Events</Text>
            <View style={styles.simRow}>
              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#F1FFE5', borderColor: '#79AF00' }]}
                onPress={handleSimulatePaytm}
                disabled={loading}
              >
                {simulatingKind === 'PAYTM' ? (
                  <ActivityIndicator size="small" color="#073B3A" style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="checkmark-circle" size={16} color="#073B3A" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.simButtonText}>Paytm ₹30</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
                onPress={handleSimulatePhonePe}
                disabled={loading}
              >
                {simulatingKind === 'PHONEPE' ? (
                  <ActivityIndicator size="small" color="#1D4ED8" style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="people" size={16} color="#1D4ED8" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.simButtonText, { color: '#1D4ED8' }]}>PhonePe ₹50</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' }]}
                onPress={handleSimulateSoundbox}
                disabled={loading}
              >
                {simulatingKind === 'SOUNDBOX' ? (
                  <ActivityIndicator size="small" color="#4B5563" style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="volume-mute" size={16} color="#4B5563" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.simButtonText, { color: '#4B5563' }]}>Soundbox ₹80</Text>
              </TouchableOpacity>
            </View>

            {statusNotice && (
              <View style={styles.inlinePromptBanner}>
                <Ionicons name="sparkles" size={14} color="#073B3A" style={{ marginRight: 6 }} />
                <Text style={styles.inlinePromptText}>{statusNotice}</Text>
              </View>
            )}

            {/* Activity Feed */}
            <Text style={styles.sectionHeading}>Today's Online Events</Text>
            {feed.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>No UPI events yet today</Text>
                <Text style={styles.emptyStateSub}>Tap a button above to simulate an event</Text>
              </View>
            ) : (
              feed.map(item => (
                <View key={item.id} style={styles.feedCard}>
                  <View style={styles.feedTopRow}>
                    <View style={[
                      styles.statusBadge,
                      item.status === 'CONFIRMED' && styles.badgeConfirmed,
                      item.status === 'ISOLATED' && styles.badgeIsolated,
                      item.status === 'QUARANTINED' && styles.badgeQuarantined
                    ]}>
                      <Text style={[
                        styles.badgeLabel,
                        item.status === 'CONFIRMED' && styles.badgeLabelConfirmed,
                        item.status === 'ISOLATED' && styles.badgeLabelIsolated,
                        item.status === 'QUARANTINED' && styles.badgeLabelQuarantined
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
                      item.status === 'ISOLATED' && styles.amountIsolated,
                      item.status === 'QUARANTINED' && styles.amountQuarantined
                    ]}>
                      {item.status === 'QUARANTINED' ? 'Ignored' : `+₹${item.amount.toLocaleString('en-IN')}`}
                    </Text>
                  </View>
                </View>
              ))
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
    maxHeight: '90%',
  },
  content: {
    padding: 22,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1FFE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#073B3A',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
    marginTop: 6,
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  simButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 3,
    borderWidth: 1,
  },
  simButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#073B3A',
  },
  inlinePromptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1FFE5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDECE7',
  },
  inlinePromptText: {
    flex: 1,
    fontSize: 11,
    color: '#073B3A',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 10,
  },
  emptyStateSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 4,
  },
  feedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  feedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeConfirmed: {
    backgroundColor: '#F1FFE5',
  },
  badgeIsolated: {
    backgroundColor: '#EFF6FF',
  },
  badgeQuarantined: {
    backgroundColor: '#F3F4F6',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeLabelConfirmed: {
    color: '#225200',
  },
  badgeLabelIsolated: {
    color: '#1E40AF',
  },
  badgeLabelQuarantined: {
    color: '#6B7280',
  },
  feedTime: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  feedMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  feedSub: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },
  feedAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  amountConfirmed: {
    color: '#073B3A',
  },
  amountIsolated: {
    color: '#1D4ED8',
  },
  amountQuarantined: {
    color: '#9CA3AF',
  },
  closeFullBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  closeFullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
});
