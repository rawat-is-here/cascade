import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  category: string;
  time: string;
  isCredit: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  language?: 'en' | 'hi';
  transactions: Transaction[];
  totalSales: number;
  totalExpenses: number;
  netBalance: number;
  onDeleteTransaction?: (id: string) => void;
  onAddTransaction?: (tx: Transaction) => void;
}

export const ExpenseReportModal: React.FC<Props> = ({
  visible,
  onClose,
  language = 'en',
  transactions,
  totalSales,
  totalExpenses,
  netBalance,
  onDeleteTransaction,
  onAddTransaction
}) => {
  const isHi = language === 'hi';
  const [filter, setFilter] = useState<'ALL' | 'SALES' | 'EXPENSES'>('ALL');
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualType, setManualType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'SALES') return tx.isCredit;
    if (filter === 'EXPENSES') return !tx.isCredit;
    return true;
  });

  const handleCreateManual = () => {
    const amt = parseFloat(manualAmount);
    if (!manualTitle.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Entry', 'Please enter a valid title and amount.');
      return;
    }

    if (onAddTransaction) {
      onAddTransaction({
        id: `tx-man-${Date.now()}`,
        title: manualTitle.trim(),
        amount: amt,
        category: manualType === 'CREDIT' ? 'Manual Sale' : 'Manual Expense',
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        isCredit: manualType === 'CREDIT'
      });
    }

    setManualTitle('');
    setManualAmount('');
    setShowAddManual(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconBox}>
                <Ionicons name="receipt-outline" size={20} color="#073B3A" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerTitle}>{isHi ? 'खर्च और बिक्री रिपोर्ट' : 'Expense & Sales Report'}</Text>
                <Text style={styles.headerSub}>{isHi ? 'दुकान का वास्तविक बहीखाता' : 'Live Double-Entry Ledger Transactions'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Balance Summary Header Cards */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{isHi ? 'कुल बिक्री (आवक)' : 'TOTAL SALES (IN)'}</Text>
              <Text style={styles.summaryCredit}>+₹{totalSales.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{isHi ? 'कुल खर्च (जावक)' : 'EXPENSES (OUT)'}</Text>
              <Text style={styles.summaryDebit}>-₹{totalExpenses.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{isHi ? 'गल्ला शेष' : 'NET DRAWER'}</Text>
              <Text style={[styles.summaryNet, { color: netBalance >= 0 ? '#073B3A' : '#DC2626' }]}>
                ₹{netBalance.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, filter === 'ALL' && styles.filterPillActive]}
              onPress={() => setFilter('ALL')}
            >
              <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>
                {isHi ? 'सभी' : 'All'} ({transactions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filter === 'SALES' && styles.filterPillActive]}
              onPress={() => setFilter('SALES')}
            >
              <Text style={[styles.filterText, filter === 'SALES' && styles.filterTextActive]}>
                {isHi ? 'बिक्री' : 'Sales'} ({transactions.filter(t => t.isCredit).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filter === 'EXPENSES' && styles.filterPillActive]}
              onPress={() => setFilter('EXPENSES')}
            >
              <Text style={[styles.filterText, filter === 'EXPENSES' && styles.filterTextActive]}>
                {isHi ? 'खर्च' : 'Expenses'} ({transactions.filter(t => !t.isCredit).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addManualBtn}
              onPress={() => setShowAddManual(!showAddManual)}
            >
              <Ionicons name={showAddManual ? 'close' : 'add'} size={16} color="#073B3A" />
              <Text style={styles.addManualBtnText}>{showAddManual ? (isHi ? 'रद्द करें' : 'Cancel') : (isHi ? 'जोड़ें' : 'Add')}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Manual Entry Drawer */}
          {showAddManual && (
            <View style={styles.manualEntryBox}>
              <Text style={styles.manualEntryTitle}>{isHi ? 'हाथ से प्रविष्टि दर्ज करें' : 'Record Manual Ledger Entry'}</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, manualType === 'CREDIT' && styles.typeBtnCreditActive]}
                  onPress={() => setManualType('CREDIT')}
                >
                  <Text style={[styles.typeBtnText, manualType === 'CREDIT' && styles.typeBtnTextActive]}>
                    {isHi ? '+ बिक्री (आवक)' : '+ Sale (Money In)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeBtn, manualType === 'DEBIT' && styles.typeBtnDebitActive]}
                  onPress={() => setManualType('DEBIT')}
                >
                  <Text style={[styles.typeBtnText, manualType === 'DEBIT' && styles.typeBtnTextActive]}>
                    {isHi ? '- खर्च (जावक)' : '- Expense (Money Out)'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.manualInput}
                placeholder={isHi ? 'विवरण (जैसे: चाय, ऑटो भाड़ा, आलू)' : 'Description (e.g. Chai, Auto Fare, Extra Aloo)'}
                placeholderTextColor="#9CA3AF"
                value={manualTitle}
                onChangeText={setManualTitle}
              />

              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TextInput
                  style={[styles.manualInput, { flex: 1, marginRight: 8 }]}
                  placeholder={isHi ? 'राशि (₹)' : 'Amount (₹)'}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={manualAmount}
                  onChangeText={setManualAmount}
                />
                <TouchableOpacity style={styles.saveManualBtn} onPress={handleCreateManual}>
                  <Text style={styles.saveManualBtnText}>{isHi ? 'खाते में जोड़ें' : 'Post to Ledger'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Transaction Items List */}
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={36} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>{isHi ? 'कोई लेन-देन दर्ज नहीं है' : 'No Transactions Recorded'}</Text>
                <Text style={styles.emptySub}>
                  {isHi ? 'बोलकर दिए ऑर्डर, मंडी रसीदें और UPI भुगतान यहाँ तुरंत दिखेंगे।' : 'Voice orders, Mandi OCR slips, and UPI payments will appear here in real-time.'}
                </Text>
              </View>
            ) : (
              filteredTransactions.map(tx => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: tx.isCredit ? '#F1FFE5' : '#FEE2E2' }]}>
                    <Ionicons
                      name={tx.isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={16}
                      color={tx.isCredit ? '#376300' : '#DC2626'}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.txTitleText}>{tx.title}</Text>
                    <View style={styles.txMetaRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{tx.category}</Text>
                      </View>
                      <Text style={styles.txTimeText}>{tx.time}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmountText, tx.isCredit ? styles.amountCredit : styles.amountDebit]}>
                      {tx.isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}.00
                    </Text>
                    {onDeleteTransaction && (
                      <TouchableOpacity
                        onPress={() => onDeleteTransaction(tx.id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={13} color="#9CA3AF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#073B3A',
  },
  headerSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FCF9',
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#DDECE7',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2EFE9',
  },
  summaryLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#6E827D',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryCredit: {
    fontSize: 14,
    fontWeight: '900',
    color: '#376300',
  },
  summaryDebit: {
    fontSize: 14,
    fontWeight: '900',
    color: '#DC2626',
  },
  summaryNet: {
    fontSize: 14,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  filterPillActive: {
    backgroundColor: '#073B3A',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterTextActive: {
    color: '#E2FD52',
  },
  addManualBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  addManualBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
  },
  manualEntryBox: {
    backgroundColor: '#FAFAFA',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  manualEntryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 8,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  typeBtnCreditActive: {
    backgroundColor: '#F1FFE5',
    borderColor: '#79AF00',
  },
  typeBtnDebitActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  typeBtnTextActive: {
    color: '#073B3A',
    fontWeight: '800',
  },
  manualInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#111827',
  },
  saveManualBtn: {
    backgroundColor: '#073B3A',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveManualBtnText: {
    color: '#E2FD52',
    fontSize: 11,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
  },
  txTimeText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  txAmountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  amountCredit: {
    color: '#073B3A',
  },
  amountDebit: {
    color: '#DC2626',
  },
  deleteBtn: {
    marginTop: 4,
    padding: 2,
  },
});
