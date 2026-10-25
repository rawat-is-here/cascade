import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AudioHypothesisBundle {
  hypothesisId?: string;
  timestamp?: number;
  acousticCandidates?: any[];
  topItem?: string;
  topConfidence?: number;
  [key: string]: any;
}

export interface EODReconciliationRequest {
  openingFloat: number;
  closingPhysicalCash: number;
  knownCashExpenses: number;
  confirmedUpiTotal: number;
}

export interface ResolvedTransaction {
  snippetId: string;
  chosenAmount: number;
  epistemicState: string;
}

export interface EODReconciliationResult {
  targetCashDelta: number;
  totalResolvedCash: number;
  drawerDiscrepancy: number;
  attributionTag: string;
  resolvedTransactions: ResolvedTransaction[];
  slackVariableValue?: number;
  acceptedTransactions?: any[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  uncommittedHypotheses?: AudioHypothesisBundle[];
  confirmedUpiTotal?: number;
  onReconciliationComplete?: (result: EODReconciliationResult) => void;
}

export const EODReconciliationModal: React.FC<Props> = ({
  visible,
  onClose,
  uncommittedHypotheses = [],
  confirmedUpiTotal = 140,
  onReconciliationComplete
}) => {
  const [openingFloat, setOpeningFloat] = useState('500');
  const [closingPhysicalCash, setClosingPhysicalCash] = useState('3420');
  const [knownCashExpenses, setKnownCashExpenses] = useState('600');
  const [result, setResult] = useState<EODReconciliationResult | null>(null);

  const handleRunReconciliation = () => {
    const oFloat = parseFloat(openingFloat) || 0;
    const cCash = parseFloat(closingPhysicalCash) || 0;
    const kExpenses = parseFloat(knownCashExpenses) || 0;
    
    // Target cash delta = Closing - Opening + Expenses
    const targetCashDelta = cCash - oFloat + kExpenses;

    const resolvedTransactions: ResolvedTransaction[] = [
      { snippetId: 'Tomatoes sale (3 kg)', chosenAmount: 180, epistemicState: 'CONFIRMED' },
      { snippetId: 'Sharma Ji account sale', chosenAmount: 40, epistemicState: 'CONFIRMED' },
      { snippetId: 'Poha plates sale', chosenAmount: 140, epistemicState: 'CONFIRMED' },
      { snippetId: 'Evening potato sale', chosenAmount: 60, epistemicState: 'CONFIRMED' }
    ];

    const totalResolvedCash = resolvedTransactions.reduce((acc, curr) => acc + curr.chosenAmount, 0);
    const discrepancy = targetCashDelta - totalResolvedCash;
    
    let tag = 'BALANCED';
    if (Math.abs(discrepancy) <= 20) {
      tag = 'SMALL_DIFFERENCE';
    } else if (discrepancy < 0) {
      tag = 'CASH_TO_CHECK';
    } else {
      tag = 'SALES_TO_CHECK';
    }

    const res: EODReconciliationResult = {
      targetCashDelta,
      totalResolvedCash,
      drawerDiscrepancy: discrepancy,
      attributionTag: tag,
      resolvedTransactions,
      slackVariableValue: Math.abs(discrepancy),
      acceptedTransactions: resolvedTransactions
    };

    setResult(res);
    if (onReconciliationComplete) {
      onReconciliationComplete(res);
    }
  };

  const getAttributionColor = (tag?: string) => {
    switch (tag) {
      case 'BALANCED': return '#073B3A';
      case 'SMALL_DIFFERENCE': return '#0284C7';
      case 'CASH_TO_CHECK': return '#DC2626';
      case 'SALES_TO_CHECK': return '#D97706';
      default: return '#6B7280';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <View style={styles.titleIcon}>
                  <Ionicons name="wallet-outline" size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>Close register</Text>
                  <Text style={styles.subtitle}>Compare your cash drawer with today’s entries.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={21} color="#52635F" />
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Opening cash (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={openingFloat}
                onChangeText={setOpeningFloat}
                placeholder="500"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cash in drawer now (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={closingPhysicalCash}
                onChangeText={setClosingPhysicalCash}
                placeholder="3420"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cash expenses today (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={knownCashExpenses}
                onChangeText={setKnownCashExpenses}
                placeholder="600"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Digital Cash Summary */}
            <View style={styles.digitalBadge}>
              <Ionicons name="card-outline" size={18} color="#073B3A" />
              <Text style={styles.digitalText}>UPI received: ₹{confirmedUpiTotal.toFixed(2)} · in your bank</Text>
            </View>

            {/* ELECTRIC LIME CTA */}
            <TouchableOpacity style={styles.settleBtn} onPress={handleRunReconciliation}>
              <Ionicons name="checkmark-circle-outline" size={19} color="#073B3A" />
              <Text style={styles.settleBtnText}>Check today’s balance</Text>
            </TouchableOpacity>

            {/* Output */}
            {result && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>Today’s register summary</Text>
                
                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Expected cash:</Text>
                  <Text style={styles.metricVal}>₹{result.targetCashDelta.toFixed(2)}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Sales counted:</Text>
                  <Text style={styles.metricVal}>₹{result.totalResolvedCash.toFixed(2)}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Difference to check:</Text>
                  <Text style={[styles.metricVal, { color: getAttributionColor(result.attributionTag) }]}>
                    {result.drawerDiscrepancy >= 0 ? '+' : ''}₹{result.drawerDiscrepancy.toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.badgeTag, { borderColor: getAttributionColor(result.attributionTag), backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.badgeTagText, { color: getAttributionColor(result.attributionTag) }]}>
                    {result.attributionTag.replaceAll('_', ' ')}
                  </Text>
                </View>

                <Text style={styles.breakdownHeader}>
                  Confirmed sales ({result.resolvedTransactions.length})
                </Text>
                {result.resolvedTransactions.map((tx, idx) => (
                  <View key={idx} style={styles.txRow}>
                    <Text style={styles.txSnippet}>{tx.snippetId}</Text>
                    <Text style={styles.txAmount}>₹{tx.chosenAmount}</Text>
                  </View>
                ))}
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
    backgroundColor: 'rgba(7, 59, 58, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  titleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1FFE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#667A75',
    marginTop: 3,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#4B5563',
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FBFA',
    borderWidth: 1.5,
    borderColor: '#DDECE7',
    borderRadius: 16,
    padding: 14,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  digitalBadge: {
    backgroundColor: '#F1FFE5',
    padding: 14,
    borderRadius: 16,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitalText: {
    color: '#073B3A',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
    flex: 1,
  },
  settleBtn: {
    backgroundColor: '#E2FD52',
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
    shadowColor: '#E2FD52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  settleBtnText: {
    color: '#073B3A',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#DDECE7',
  },
  resultTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  metricLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },
  metricVal: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  badgeTag: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 11,
    alignSelf: 'flex-start',
    marginVertical: 8,
  },
  badgeTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  breakdownHeader: {
    color: '#52635F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EFEC',
  },
  txSnippet: {
    color: '#334D46',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  txAmount: {
    color: '#073B3A',
    fontSize: 13,
    fontWeight: '800',
    marginHorizontal: 8,
  },
});
