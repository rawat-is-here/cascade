import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BaselineResult } from '../../shared/types';

interface Props {
  baseline?: BaselineResult;
}

export const BaselinePanel: React.FC<Props> = ({ baseline }) => {
  return (
    <View style={[styles.card, baseline?.crashedOrHallucinated ? styles.cardError : styles.cardNormal]}>
      <View style={styles.header}>
        <Text style={styles.title}>❌ Competitor Baseline (95%)</Text>
        <Text style={styles.tag}>{baseline?.latencyMs ?? 0}ms</Text>
      </View>
      <Text style={styles.body}>
        {baseline?.rawLLMOutput || 'Awaiting input stream...'}
      </Text>
      {baseline?.crashedOrHallucinated && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>
            ⚠️ Failure: {baseline.failureReason || 'Hallucinated or crashed on hostile input'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardError: {
    borderColor: '#ef4444',
    backgroundColor: '#450a0a',
  },
  cardNormal: {
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tag: {
    color: '#94a3b8',
    fontSize: 12,
  },
  body: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
  },
  alertBox: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#7f1d1d',
    borderRadius: 4,
  },
  alertText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
  },
});
