import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import type { EODReconciliationRequest, EODReconciliationResult } from '../../shared/types';
import { EODCashSettler } from '../../core/reconciliation/eod_cash_settler';
import type { AudioHypothesisBundle } from '../../shared/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  uncommittedHypotheses: AudioHypothesisBundle[];
  confirmedUpiTotal: number;
  onReconciliationComplete?: (result: EODReconciliationResult) => void;
}

export const EODReconciliationModal: React.FC<Props> = ({
  visible,
  onClose,
  uncommittedHypotheses,
  confirmedUpiTotal,
  onReconciliationComplete
}) => {
  const [openingFloat, setOpeningFloat] = useState('500');
  const [closingPhysicalCash, setClosingPhysicalCash] = useState('3420');
  const [knownCashExpenses, setKnownCashExpenses] = useState('600');
  const [result, setResult] = useState<EODReconciliationResult | null>(null);

  const handleRunReconciliation = () => {
    const request: EODReconciliationRequest = {
      openingFloat: parseFloat(openingFloat) || 0,
      closingPhysicalCash: parseFloat(closingPhysicalCash) || 0,
      knownCashExpenses: parseFloat(knownCashExpenses) || 0,
      confirmedUpiTotal
    };

    const res = EODCashSettler.reconcile(uncommittedHypotheses, request);
    setResult(res);
    if (onReconciliationComplete) {
      onReconciliationComplete(res);
    }
  };

  const getAttributionColor = (tag?: string) => {
    switch (tag) {
      case 'EXACT_MATCH': return '#10b981';
      case 'ROUNDING_FRICTION': return '#38bdf8';
      case 'UNRECORDED_LEAKAGE': return '#ef4444';
      case 'DROWNED_SALES_SURPLUS': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.title}>🌙 EOD Physical Cash Settlement</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Reconcile physical cash drawer with {uncommittedHypotheses.length} uncommitted acoustic sales.
            </Text>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Morning Cash Float (₹):</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={openingFloat}
                onChangeText={setOpeningFloat}
                placeholder="500"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Night Drawer Physical Cash Count (₹):</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={closingPhysicalCash}
                onChangeText={setClosingPhysicalCash}
                placeholder="3420"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Known Cash Expenses Paid (₹):</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={knownCashExpenses}
                onChangeText={setKnownCashExpenses}
                placeholder="600"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* Digital Cash Summary */}
            <View style={styles.digitalBadge}>
              <Text style={styles.digitalText}>
                💳 Confirmed UPI / Soundbox: ₹{confirmedUpiTotal.toFixed(2)} (Safe in Bank)
              </Text>
            </View>

            <TouchableOpacity style={styles.settleBtn} onPress={handleRunReconciliation}>
              <Text style={styles.settleBtnText}>⚡ Solve MAP Elastic Slack (Algorithm 2)</Text>
            </TouchableOpacity>

            {/* Reconciliation Output */}
            {result && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>Reconciliation Summary</Text>
                
                <View style={styles.row}>
                  <Text style={styles.metricLabel}>Target Cash Sales (ΔC):</Text>
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

                <View style={[styles.badgeTag, { borderColor: getAttributionColor(result.attributionTag) }]}>
                  <Text style={[styles.badgeTagText, { color: getAttributionColor(result.attributionTag) }]}>
                    TAG: {result.attributionTag}
                  </Text>
                </View>

                <Text style={styles.breakdownHeader}>Disambiguated Transactions ({result.resolvedTransactions.length}):</Text>
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16
  },
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '90%'
  },
  scrollContent: {
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc'
  },
  closeBtn: {
    padding: 6
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: 'bold'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 12
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '500'
  },
  input: {
    backgroundColor: '#1e293b',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 14
  },
  digitalBadge: {
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 14
  },
  digitalText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600'
  },
  settleBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 10
  },
  settleBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  resultContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  resultTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 13
  },
  metricVal: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600'
  },
  badgeTag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginVertical: 8
  },
  badgeTagText: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  breakdownHeader: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4
  },
  txSnippet: {
    color: '#94a3b8',
    fontSize: 11
  },
  txAmount: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 12
  },
  txState: {
    color: '#10b981',
    fontSize: 10
  }
});
