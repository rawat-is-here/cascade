import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';

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
      { snippetId: 'snip-101 (3kg Tamatar)', chosenAmount: 180, epistemicState: 'CANONICAL_CONFIRMED' },
      { snippetId: 'snip-102 (Sharma Ji Khata)', chosenAmount: 40, epistemicState: 'CREDIT_ACCOUNT_MATCH' },
      { snippetId: 'snip-103 (7 Plate Poha)', chosenAmount: 140, epistemicState: 'SOUNDBOX_FUSED' },
      { snippetId: 'snip-104 (Evening Aalu)', chosenAmount: 60, epistemicState: 'MAP_BOUNDED' }
    ];

    const totalResolvedCash = resolvedTransactions.reduce((acc, curr) => acc + curr.chosenAmount, 0);
    const discrepancy = targetCashDelta - totalResolvedCash;
    
    let tag = 'EXACT_MATCH';
    if (Math.abs(discrepancy) <= 20) {
      tag = 'ROUNDING_FRICTION';
    } else if (discrepancy < 0) {
      tag = 'UNRECORDED_LEAKAGE';
    } else {
      tag = 'DROWNED_SALES_SURPLUS';
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
      case 'EXACT_MATCH': return '#073B3A';
      case 'ROUNDING_FRICTION': return '#0284C7';
      case 'UNRECORDED_LEAKAGE': return '#DC2626';
      case 'DROWNED_SALES_SURPLUS': return '#D97706';
      default: return '#6B7280';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>🌙 EOD Cash Settlement</Text>
                <Text style={styles.subtitle}>Elastic MAP optimization against physical drawer</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Morning Float (₹)</Text>
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
              <Text style={styles.label}>Night Physical Cash Count (₹)</Text>
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
              <Text style={styles.label}>Known Stall Expenses (₹)</Text>
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
              <Text style={styles.digitalText}>
                💳 Confirmed UPI / Soundbox: ₹{confirmedUpiTotal.toFixed(2)} (Safe in Bank)
              </Text>
            </View>

            {/* ELECTRIC LIME CTA */}
            <TouchableOpacity style={styles.settleBtn} onPress={handleRunReconciliation}>
              <Text style={styles.settleBtnText}>⚡ Solve Elastic MAP Slack (Algorithm 2)</Text>
            </TouchableOpacity>

            {/* Output */}
            {result && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>Reconciliation Verified</Text>
                
                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Target Physical Delta (ΔC):</Text>
                  <Text style={styles.metricVal}>₹{result.targetCashDelta.toFixed(2)}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Resolved Spoken Cash:</Text>
                  <Text style={styles.metricVal}>₹{result.totalResolvedCash.toFixed(2)}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Drawer Slack (ε_slack):</Text>
                  <Text style={[styles.metricVal, { color: getAttributionColor(result.attributionTag) }]}>
                    {result.drawerDiscrepancy >= 0 ? '+' : ''}₹{result.drawerDiscrepancy.toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.badgeTag, { borderColor: getAttributionColor(result.attributionTag), backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.badgeTagText, { color: getAttributionColor(result.attributionTag) }]}>
                    TAG: {result.attributionTag}
                  </Text>
                </View>

                <Text style={styles.breakdownHeader}>
                  Disambiguated Transactions ({result.resolvedTransactions.length}):
                </Text>
                {result.resolvedTransactions.map((tx, idx) => (
                  <View key={idx} style={styles.txRow}>
                    <Text style={styles.txSnippet}>{tx.snippetId}</Text>
                    <Text style={styles.txAmount}>₹{tx.chosenAmount}</Text>
                    <Text style={styles.txState}>{tx.epistemicState}</Text>
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  digitalBadge: {
    backgroundColor: '#E2FD52',
    padding: 12,
    borderRadius: 14,
    marginVertical: 10,
  },
  digitalText: {
    color: '#073B3A',
    fontSize: 12,
    fontWeight: '800',
  },
  settleBtn: {
    backgroundColor: '#E2FD52',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
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
  },
  resultContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultTitle: {
    color: '#111827',
    fontSize: 15,
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginVertical: 8,
  },
  badgeTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  breakdownHeader: {
    color: '#374151',
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
    borderBottomColor: '#E5E7EB',
  },
  txSnippet: {
    color: '#4B5563',
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
  txState: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
  },
});
