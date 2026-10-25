import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
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
  const [feed, setFeed] = useState<UpiFeedItem[]>([
    {
      id: 'upi-1',
      type: 'CONFIRMED_SALE',
      title: 'Paytm Soundbox QR Scan',
      subtitle: 'Chime & bank notification matched • Credited to Sales Revenue',
      amount: 30,
      badgeText: 'Confirmed Shop Sale',
      time: 'Just now',
      status: 'CONFIRMED'
    },
    {
      id: 'upi-2',
      type: 'PERSONAL_TRANSFER',
      title: 'GPay Transfer from Sister',
      subtitle: 'Personal family money • Kept separate from shop accounts',
      amount: 2000,
      badgeText: 'Personal Money (Equity)',
      time: '12:15 PM',
      status: 'ISOLATED'
    },
    {
      id: 'upi-3',
      type: 'NEIGHBOR_CHIME',
      title: 'Neighboring Stall Soundbox',
      subtitle: 'Acoustic audio heard with no phone notification • Quarantined',
      amount: 50,
      badgeText: 'Neighbor Chime Ignored',
      time: '11:40 AM',
      status: 'QUARANTINED'
    }
  ]);

  const handleSimulateEvent = async (kind: 'SALE' | 'PERSONAL' | 'NEIGHBOR') => {
    setLoading(true);
    let eventType = 'SOUNDBOX_CHIME';
    let amount = 30;
    let appName = 'PAYTM';
    let rawText = '';
    let payerName = 'Customer';

    if (kind === 'SALE') {
      eventType = 'APP_NOTIFICATION';
      amount = 40;
      appName = 'PAYTM';
      rawText = 'Received ₹40.00 on Paytm QR at Akash Poha Stall';
      payerName = 'Rahul S.';
    } else if (kind === 'PERSONAL') {
      eventType = 'APP_NOTIFICATION';
      amount = 2000;
      appName = 'GPAY';
      rawText = 'Pooja Rawat sent you ₹2,000 via Google Pay';
      payerName = 'Sister (Family)';
    } else if (kind === 'NEIGHBOR') {
      eventType = 'SOUNDBOX_CHIME';
      amount = 50;
      appName = 'PAYTM';
      rawText = 'Paytm par pachaas rupaye prapt hue';
    }

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/upi/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          amount,
          timestamp: Date.now(),
          appName,
          rawText,
          payerName
        })
      });
      const data = await res.json();

      let newItem: UpiFeedItem;
      if (kind === 'SALE') {
        newItem = {
          id: `upi-live-${Date.now()}`,
          type: 'CONFIRMED_SALE',
          title: `Paytm Soundbox QR (+₹${amount})`,
          subtitle: 'Dual verified • Added to today’s stall sales revenue',
          amount,
          badgeText: 'Confirmed Shop Sale',
          time: 'Just now',
          status: 'CONFIRMED'
        };
        if (onUpiPaymentConfirmed) onUpiPaymentConfirmed(amount, true);
        Alert.alert('Shop Sale Added', `₹${amount} UPI payment verified and added to today’s sales!`);
      } else if (kind === 'PERSONAL') {
        newItem = {
          id: `upi-live-${Date.now()}`,
          type: 'PERSONAL_TRANSFER',
          title: `GPay Family Money (+₹${amount.toLocaleString('en-IN')})`,
          subtitle: 'Personal home money • Kept separate so shop profit remains exact',
          amount,
          badgeText: 'Personal Money (Equity)',
          time: 'Just now',
          status: 'ISOLATED'
        };
        Alert.alert('Personal Money Isolated', `₹${amount.toLocaleString('en-IN')} kept in your personal equity without inflating shop sales.`);
      } else {
        newItem = {
          id: `upi-live-${Date.now()}`,
          type: 'NEIGHBOR_CHIME',
          title: `Neighbor Stall Chime (₹${amount})`,
          subtitle: 'Audio chime heard with 0 matching bank notification • Discarded',
          amount,
          badgeText: 'Neighbor Chime Ignored',
          time: 'Just now',
          status: 'QUARANTINED'
        };
        Alert.alert('Neighbor Soundbox Ignored', `Heard ₹${amount} from nearby stall. Safely ignored to prevent false double-counting.`);
      }

      setFeed(prev => [newItem, ...prev]);
    } catch {
      // Offline simulation
      if (kind === 'SALE') {
        if (onUpiPaymentConfirmed) onUpiPaymentConfirmed(amount, true);
        Alert.alert('Shop Sale Added', `₹${amount} recorded locally as verified stall sale.`);
      } else if (kind === 'PERSONAL') {
        Alert.alert('Personal Money Isolated', `₹${amount.toLocaleString('en-IN')} kept in personal equity.`);
      } else {
        Alert.alert('Neighbor Soundbox Ignored', `Neighbor stall chime ignored safely.`);
      }
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
                onPress={() => handleSimulateEvent('SALE')}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={16} color="#073B3A" style={{ marginRight: 4 }} />
                <Text style={styles.simButtonText}>Stall QR (₹40)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}
                onPress={() => handleSimulateEvent('PERSONAL')}
                disabled={loading}
              >
                <Ionicons name="people" size={16} color="#1D4ED8" style={{ marginRight: 4 }} />
                <Text style={[styles.simButtonText, { color: '#1D4ED8' }]}>Sister (₹2,000)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simButton, { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' }]}
                onPress={() => handleSimulateEvent('NEIGHBOR')}
                disabled={loading}
              >
                <Ionicons name="volume-mute" size={16} color="#4B5563" style={{ marginRight: 4 }} />
                <Text style={[styles.simButtonText, { color: '#4B5563' }]}>Neighbor (₹50)</Text>
              </TouchableOpacity>
            </View>

            {/* Activity Feed */}
            <Text style={styles.sectionHeading}>Today's Online Events</Text>
            {feed.map(item => (
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
            ))}

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
