import React, { useState, useMemo } from 'react';
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

export interface LedgerTransaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  isCredit: boolean;
  time: string;
  customerName?: string;
  isUdhaar?: boolean;
  isSettled?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  language?: 'en' | 'hi';
  transactions: LedgerTransaction[];
  onDeleteTransaction: (id: string) => void;
  onSettleUdhaar: (id: string, amount: number, title: string) => void;
  onAddTransaction: (tx: LedgerTransaction) => void;
  totalSales: number;
  totalExpenses: number;
  netBalance: number;
}

export const UniversalLedgerModal: React.FC<Props> = ({
  visible,
  onClose,
  language = 'en',
  transactions,
  onDeleteTransaction,
  onSettleUdhaar,
  onAddTransaction,
  totalSales,
  totalExpenses,
  netBalance
}) => {
  const isHi = language === 'hi';

  const [filter, setFilter] = useState<'ALL' | 'UDHAAR' | 'SALES' | 'EXPENSES'>('ALL');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<'SALE' | 'EXPENSE' | 'UDHAAR'>('SALE');

  const pendingUdhaarList = useMemo(() => {
    return transactions.filter(t => (t.isUdhaar || t.category.toLowerCase().includes('udhaar')) && !t.isSettled);
  }, [transactions]);

  const totalPendingUdhaar = useMemo(() => {
    return pendingUdhaarList.reduce((sum, t) => sum + t.amount, 0);
  }, [pendingUdhaarList]);

  const filteredList = useMemo(() => {
    return transactions.filter(tx => {
      const isUdhaar = tx.isUdhaar || tx.category.toLowerCase().includes('udhaar');
      if (filter === 'UDHAAR' && !isUdhaar) return false;
      if (filter === 'SALES' && (!tx.isCredit || isUdhaar)) return false;
      if (filter === 'EXPENSES' && tx.isCredit) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          tx.title.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [transactions, filter, search]);

  const handleAddSubmit = () => {
    const amt = parseFloat(formAmount);
    if (!formTitle.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert(
        isHi ? 'गलत प्रविष्टि' : 'Invalid Entry',
        isHi ? 'कृपया मान्य नाम और राशि दर्ज करें।' : 'Please enter a valid title and amount.'
      );
      return;
    }

    const isCredit = formType === 'SALE';
    const isUdhaar = formType === 'UDHAAR';

    const newTx: LedgerTransaction = {
      id: `chit-${Date.now()}`,
      title: formTitle.trim(),
      category: isUdhaar
        ? (isHi ? 'ग्राहक उधार' : 'Customer Udhaar')
        : isCredit
        ? (isHi ? 'नकद बिक्री' : 'Cash Sale')
        : (isHi ? 'दुकान खर्च' : 'Expense Chit'),
      amount: amt,
      isCredit,
      isUdhaar,
      isSettled: false,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customerName: isUdhaar ? formTitle.trim() : undefined
    };

    onAddTransaction(newTx);
    setFormTitle('');
    setFormAmount('');
    setShowAddForm(false);
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
                  <Ionicons name="receipt" size={22} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>
                    {isHi ? 'खाता और बहीखाता' : 'Khata & Ledger'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isHi ? 'सभी बिक्री, खर्च और ग्राहकों का उधार' : 'All transactions, bills & customer credit'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* 3-Column Summary Bar */}
            <View style={styles.summaryBar}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{isHi ? 'कुल बिक्री' : 'TOTAL SALES'}</Text>
                <Text style={styles.summaryValGreen}>+₹{totalSales.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{isHi ? 'खरीद व खर्च' : 'BILLS & COGS'}</Text>
                <Text style={styles.summaryValRed}>-₹{totalExpenses.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>{isHi ? 'बाकी उधार' : 'PENDING UDHAAR'}</Text>
                <Text style={styles.summaryValAmber}>₹{totalPendingUdhaar.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Udhaar Action Alert Banner */}
            {pendingUdhaarList.length > 0 && (
              <View style={styles.udhaarAlert}>
                <Ionicons name="hourglass-outline" size={16} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.udhaarAlertText}>
                  {isHi
                    ? `${pendingUdhaarList.length} ग्राहकों का उधार बाकी है (₹${totalPendingUdhaar})। ग्राहक द्वारा भुगतान करने पर नीचे 'नकद जमा' दबाएं।`
                    : `${pendingUdhaarList.length} customer chits pending (₹${totalPendingUdhaar}). Tap "Collect Cash" below when customer pays.`}
                </Text>
              </View>
            )}

            {/* Search & Add Bar */}
            <View style={styles.actionRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={isHi ? "शर्मा जी, टमाटर, यूपीआई खोजें..." : "Search Sharma ji, Tamatar, UPI..."}
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowAddForm(prev => !prev)}
              >
                <Ionicons name={showAddForm ? "close" : "add"} size={20} color="#073B3A" />
              </TouchableOpacity>
            </View>

            {/* Quick Add Form Drawer */}
            {showAddForm && (
              <View style={styles.formDrawer}>
                <Text style={styles.formTitle}>
                  {isHi ? 'हाथ से नया लेन-देन जोड़ें' : 'ADD MANUAL TRANSACTION'}
                </Text>
                <View style={styles.formTypeRow}>
                  <TouchableOpacity
                    style={[styles.formTypePill, formType === 'SALE' && styles.formTypePillActiveSale]}
                    onPress={() => setFormType('SALE')}
                  >
                    <Text style={[styles.formTypeText, formType === 'SALE' && styles.formTypeTextActive]}>
                      {isHi ? '+ नकद बिक्री' : '+ Cash Sale'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formTypePill, formType === 'UDHAAR' && styles.formTypePillActiveUdhaar]}
                    onPress={() => setFormType('UDHAAR')}
                  >
                    <Text style={[styles.formTypeText, formType === 'UDHAAR' && styles.formTypeTextActiveUdhaar]}>
                      {isHi ? '⏳ उधार पर्ची' : '⏳ Udhaar Chit'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formTypePill, formType === 'EXPENSE' && styles.formTypePillActiveExp]}
                    onPress={() => setFormType('EXPENSE')}
                  >
                    <Text style={[styles.formTypeText, formType === 'EXPENSE' && styles.formTypeTextActiveExp]}>
                      {isHi ? '- खर्च' : '- Expense'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.formInput}
                  placeholder={
                    formType === 'UDHAAR'
                      ? (isHi ? "ग्राहक का नाम (उदा. शर्मा जी 2 चाय)" : "Customer Name (e.g. Sharma ji 2 tea)")
                      : (isHi ? "सामान या विवरण (उदा. दूध, पोहा)" : "Description or Produce Name")
                  }
                  placeholderTextColor="#9CA3AF"
                  value={formTitle}
                  onChangeText={setFormTitle}
                />

                <TextInput
                  style={styles.formInput}
                  placeholder={isHi ? "राशि रुपयों में (₹)" : "Amount in Rupees (₹)"}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={formAmount}
                  onChangeText={setFormAmount}
                />

                <TouchableOpacity style={styles.formSaveBtn} onPress={handleAddSubmit}>
                  <Ionicons name="checkmark-circle" size={16} color="#073B3A" style={{ marginRight: 6 }} />
                  <Text style={styles.formSaveBtnText}>
                    {isHi ? 'बहीखाते में दर्ज करें' : 'Save into Ledger'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Pills */}
            <View style={styles.filterPillsRow}>
              <TouchableOpacity
                style={[styles.filterPill, filter === 'ALL' && styles.filterPillActive]}
                onPress={() => setFilter('ALL')}
              >
                <Text style={[styles.filterPillText, filter === 'ALL' && styles.filterPillTextActive]}>
                  {isHi ? 'सभी' : 'All'} ({transactions.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === 'UDHAAR' && styles.filterPillActiveUdhaar]}
                onPress={() => setFilter('UDHAAR')}
              >
                <Text style={[styles.filterPillText, filter === 'UDHAAR' && styles.filterPillTextActiveUdhaar]}>
                  {isHi ? '⏳ उधार' : '⏳ Udhaar'} ({pendingUdhaarList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === 'SALES' && styles.filterPillActive]}
                onPress={() => setFilter('SALES')}
              >
                <Text style={[styles.filterPillText, filter === 'SALES' && styles.filterPillTextActive]}>
                  {isHi ? 'बिक्री' : 'Sales'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === 'EXPENSES' && styles.filterPillActive]}
                onPress={() => setFilter('EXPENSES')}
              >
                <Text style={[styles.filterPillText, filter === 'EXPENSES' && styles.filterPillTextActive]}>
                  {isHi ? 'खर्च' : 'Expenses'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Transactions List */}
            <View style={styles.txList}>
              {filteredList.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.emptyText}>
                    {isHi ? 'कोई मेल खाता लेन-देन नहीं मिला' : 'No matching transactions found'}
                  </Text>
                </View>
              ) : (
                filteredList.map(tx => {
                  const isUdhaar = tx.isUdhaar || tx.category.toLowerCase().includes('udhaar');
                  const isSettled = tx.isSettled;

                  return (
                    <View
                      key={tx.id}
                      style={[
                        styles.txItem,
                        isUdhaar && !isSettled && styles.txItemUdhaar,
                        isSettled && styles.txItemSettled
                      ]}
                    >
                      <View style={styles.txRow}>
                        <View
                          style={[
                            styles.txIconBox,
                            isUdhaar ? styles.txIconBoxUdhaar : tx.isCredit ? styles.txIconBoxCredit : styles.txIconBoxDebit
                          ]}
                        >
                          <Ionicons
                            name={
                              isUdhaar
                                ? isSettled
                                  ? "checkmark-circle"
                                  : "time-outline"
                                : tx.isCredit
                                ? "arrow-down-outline"
                                : "arrow-up-outline"
                            }
                            size={18}
                            color={isUdhaar ? (isSettled ? "#059669" : "#D97706") : tx.isCredit ? "#073B3A" : "#DC2626"}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={styles.txTitleRow}>
                            <Text style={styles.txTitle} numberOfLines={1}>{tx.title}</Text>
                            <Text
                              style={[
                                styles.txAmount,
                                isUdhaar
                                  ? isSettled
                                    ? styles.txAmountSettled
                                    : styles.txAmountUdhaar
                                  : tx.isCredit
                                  ? styles.txAmountCredit
                                  : styles.txAmountDebit
                              ]}
                            >
                              {isUdhaar
                                ? `₹${tx.amount.toLocaleString('en-IN')}`
                                : tx.isCredit
                                ? `+₹${tx.amount.toLocaleString('en-IN')}`
                                : `-₹${tx.amount.toLocaleString('en-IN')}`}
                            </Text>
                          </View>

                          <View style={styles.txSubRow}>
                            <Text style={styles.txCategory}>
                              {isUdhaar
                                ? isSettled
                                  ? (isHi ? 'उधार जमा' : 'UDHAAR SETTLED')
                                  : (isHi ? 'बाकी उधार' : 'UDHAAR (UNPAID)')
                                : tx.category}
                            </Text>
                            <Text style={styles.txTime}>{tx.time}</Text>
                          </View>
                        </View>
                      </View>

                      {/* 1-Tap Settle Cash Button for Pending Udhaar */}
                      {isUdhaar && !isSettled && (
                        <View style={styles.settleActionRow}>
                          <Text style={styles.settlePrompt}>
                            {isHi ? 'ग्राहक ने भुगतान कर दिया?' : 'Customer cleared this credit?'}
                          </Text>
                          <TouchableOpacity
                            style={styles.settleBtn}
                            onPress={() => onSettleUdhaar(tx.id, tx.amount, tx.title)}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#073B3A" style={{ marginRight: 4 }} />
                            <Text style={styles.settleBtnText}>
                              {isHi ? `₹${tx.amount} नकद जमा करें` : `Collect ₹${tx.amount} Cash`}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Settled Feedback */}
                      {isSettled && (
                        <View style={styles.settledRow}>
                          <Ionicons name="checkmark-circle" size={12} color="#059669" style={{ marginRight: 4 }} />
                          <Text style={styles.settledText}>
                            {isHi ? 'गल्ले में नकद जमा कर दिया गया।' : 'Settled into cash drawer float.'}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },

  /* SUMMARY BAR */
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6E827D',
    letterSpacing: 0.5,
  },
  summaryValGreen: {
    fontSize: 15,
    fontWeight: '900',
    color: '#073B3A',
    marginTop: 2,
  },
  summaryValRed: {
    fontSize: 15,
    fontWeight: '900',
    color: '#DC2626',
    marginTop: 2,
  },
  summaryValAmber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#D97706',
    marginTop: 2,
  },

  /* UDHAAR ALERT */
  udhaarAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  udhaarAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },

  /* ACTION ROW */
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    padding: 0,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* FORM DRAWER */
  formDrawer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  formTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  formTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  formTypePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTypePillActiveSale: {
    backgroundColor: '#F1FFE5',
    borderColor: '#C6E8A8',
  },
  formTypePillActiveUdhaar: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  formTypePillActiveExp: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  formTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  formTypeTextActive: {
    color: '#275200',
    fontWeight: '800',
  },
  formTypeTextActiveUdhaar: {
    color: '#92400E',
    fontWeight: '800',
  },
  formTypeTextActiveExp: {
    color: '#991B1B',
    fontWeight: '800',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 8,
  },
  formSaveBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  formSaveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
  },

  /* FILTER PILLS */
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterPillActive: {
    backgroundColor: '#073B3A',
    borderColor: '#073B3A',
  },
  filterPillActiveUdhaar: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillTextActiveUdhaar: {
    color: '#FFFFFF',
  },

  /* TX LIST */
  txList: {
    gap: 8,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  txItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  txItemUdhaar: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FDE68A',
  },
  txItemSettled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#A7F3D0',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txIconBoxCredit: {
    backgroundColor: '#F1FFE5',
  },
  txIconBoxDebit: {
    backgroundColor: '#FEE2E2',
  },
  txIconBoxUdhaar: {
    backgroundColor: '#FEF3C7',
  },
  txTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  txAmountCredit: {
    color: '#073B3A',
  },
  txAmountDebit: {
    color: '#DC2626',
  },
  txAmountUdhaar: {
    color: '#D97706',
  },
  txAmountSettled: {
    color: '#059669',
  },
  txSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  txCategory: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  txTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  settleActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  settlePrompt: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  settleBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#073B3A',
  },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
  },
  settledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
});
