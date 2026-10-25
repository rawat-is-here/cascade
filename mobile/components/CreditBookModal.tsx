import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CreditEntry {
  id: string;
  customerName: string;
  amountOwed: number;
  lastEntryAt: number;
  entryCount: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onCreditAdded?: (customerName: string, amount: number) => void;
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function CreditBookModal({
  visible,
  onClose,
  apiBaseUrl,
  onCreditAdded,
}: Props) {
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [addingCredit, setAddingCredit] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Settling state per entry id
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());

  const totalOutstanding = entries.reduce((sum, e) => sum + e.amountOwed, 0);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/credit-book`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: CreditEntry[] = await res.json();
      setEntries(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load credit book.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (visible) {
      fetchEntries();
    }
  }, [visible, fetchEntries]);

  const handleMarkPaid = async (entry: CreditEntry) => {
    // Optimistic update
    setSettlingIds((prev) => new Set(prev).add(entry.id));
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, amountOwed: 0 } : e))
    );

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/credit-book/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: entry.customerName,
          amount: entry.amountOwed,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
    } catch (e: any) {
      // Revert optimistic update
      setEntries((prev) =>
        prev.map((en) =>
          en.id === entry.id ? { ...en, amountOwed: entry.amountOwed } : en
        )
      );
      Alert.alert('Error', e?.message ?? 'Could not mark as paid. Please try again.');
    } finally {
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const handleAddCredit = async () => {
    const trimmedName = newName.trim();
    const parsedAmount = parseFloat(newAmount);
    if (!trimmedName) {
      setAddError('Customer name is required.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAddError('Enter a valid amount greater than 0.');
      return;
    }

    setAddingCredit(true);
    setAddError(null);

    // Optimistic entry
    const optimisticEntry: CreditEntry = {
      id: `temp-${Date.now()}`,
      customerName: trimmedName,
      amountOwed: parsedAmount,
      lastEntryAt: Date.now(),
      entryCount: 1,
    };
    setEntries((prev) => [optimisticEntry, ...prev]);
    setNewName('');
    setNewAmount('');

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/credit-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: trimmedName, amount: parsedAmount }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const savedEntry: CreditEntry = await res.json();
      // Replace optimistic entry with real one
      setEntries((prev) =>
        prev.map((e) => (e.id === optimisticEntry.id ? savedEntry : e))
      );
      onCreditAdded?.(trimmedName, parsedAmount);
    } catch (e: any) {
      // Remove optimistic entry on failure
      setEntries((prev) => prev.filter((en) => en.id !== optimisticEntry.id));
      setAddError(e?.message ?? 'Failed to add credit. Please try again.');
      setNewName(trimmedName);
      setNewAmount(String(parsedAmount));
    } finally {
      setAddingCredit(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="book" size={20} color="#073B3A" />
            </View>
            <Text style={styles.headerTitle}>Udhar Book</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Outstanding Banner */}
          <View style={styles.outstandingBanner}>
            <Text style={styles.outstandingLabel}>Total Outstanding</Text>
            <Text style={styles.outstandingAmount}>
              ₹{totalOutstanding.toFixed(2)}
            </Text>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#073B3A" />
              <Text style={styles.loadingText}>Loading credit book...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchEntries}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Empty state */}
              {entries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="book-outline" size={56} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No udhar entries yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Add your first credit entry below
                  </Text>
                </View>
              ) : (
                entries.map((entry) => (
                  <View key={entry.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardLeft}>
                        <Text style={styles.customerName}>
                          {entry.customerName}
                        </Text>
                        <Text style={styles.amountOwed}>
                          ₹{entry.amountOwed.toFixed(2)} owed
                        </Text>
                      </View>
                      <View style={styles.cardRight}>
                        {entry.amountOwed > 0 ? (
                          <TouchableOpacity
                            style={[
                              styles.markPaidBtn,
                              settlingIds.has(entry.id) && styles.markPaidBtnDisabled,
                            ]}
                            onPress={() => handleMarkPaid(entry)}
                            disabled={settlingIds.has(entry.id)}
                          >
                            {settlingIds.has(entry.id) ? (
                              <ActivityIndicator size="small" color="#E2FD52" />
                            ) : (
                              <Text style={styles.markPaidBtnText}>Mark Paid</Text>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.settledPill}>
                            <Ionicons name="checkmark-circle" size={12} color="#059669" />
                            <Text style={styles.settledText}>Settled ✓</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.cardMeta}>
                      <View style={styles.entryCountPill}>
                        <Text style={styles.entryCountText}>
                          {entry.entryCount} {entry.entryCount === 1 ? 'entry' : 'entries'}
                        </Text>
                      </View>
                      <Text style={styles.lastEntry}>
                        Last: {timeAgo(entry.lastEntryAt)}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              {/* Add Credit Form */}
              <View style={styles.addForm}>
                <Text style={styles.addFormTitle}>Add New Udhar</Text>

                {addError ? (
                  <View style={styles.addErrorBanner}>
                    <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                    <Text style={styles.addErrorText}>{addError}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.input}
                  placeholder="Customer name (e.g. Sharma Ji)"
                  placeholderTextColor="#9CA3AF"
                  value={newName}
                  onChangeText={setNewName}
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Amount (₹)"
                  placeholderTextColor="#9CA3AF"
                  value={newAmount}
                  onChangeText={setNewAmount}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.addUdharBtn,
                    addingCredit && styles.addUdharBtnDisabled,
                  ]}
                  onPress={handleAddCredit}
                  disabled={addingCredit}
                >
                  {addingCredit ? (
                    <ActivityIndicator size="small" color="#073B3A" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={18} color="#073B3A" />
                      <Text style={styles.addUdharBtnText}>Add Udhar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  outstandingBanner: {
    backgroundColor: '#073B3A',
    marginHorizontal: 16,
    marginVertical: 14,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outstandingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(226,253,82,0.8)',
  },
  outstandingAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E2FD52',
    fontVariant: ['tabular-nums'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#073B3A',
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#E2FD52',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#9CA3AF',
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  amountOwed: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  markPaidBtn: {
    backgroundColor: '#073B3A',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  markPaidBtnDisabled: {
    opacity: 0.6,
  },
  markPaidBtnText: {
    color: '#E2FD52',
    fontSize: 12,
    fontWeight: '700',
  },
  settledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  settledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  entryCountPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  entryCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
  },
  lastEntry: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  addForm: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  addFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  addErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  addErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },
  addUdharBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  addUdharBtnDisabled: {
    opacity: 0.6,
  },
  addUdharBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#073B3A',
  },
});

export { CreditBookModal };
