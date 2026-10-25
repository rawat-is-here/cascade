import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EngineResult } from '../types';

interface Props {
  engine?: EngineResult;
}

export const EnginePanel: React.FC<Props> = ({ engine }) => {
  return (
    <View style={[styles.card, engine?.abstained ? styles.cardAbstained : styles.cardSuccess]}>
      <View style={styles.header}>
        <Text style={styles.title}>✅ 0.5% Core Engine</Text>
        <Text style={styles.badge}>{engine?.epistemicState || 'INITIALIZING'}</Text>
      </View>
      <Text style={styles.body}>
        {engine?.primaryDecision || 'Ready to evaluate constraints...'}
      </Text>
      
      {engine?.bounds && (
        <View style={styles.boundsBox}>
          <Text style={styles.boundsText}>
            Interval Bounds: [{engine.bounds.minEstimate.toFixed(1)}, {engine.bounds.maxEstimate.toFixed(1)}] | Uncertainty: ±{engine.bounds.uncertaintyInterval.toFixed(1)}
          </Text>
        </View>
      )}

      {engine?.invariantViolationsDetected && engine.invariantViolationsDetected.length > 0 && (
        <View style={styles.violationBox}>
          <Text style={styles.violationText}>
            🛡️ Invariant Caught: {engine.invariantViolationsDetected.join(', ')}
          </Text>
        </View>
      )}

      <Text style={styles.latency}>Engine Latency: {engine?.latencyMs ?? 0}ms</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
  },
  cardSuccess: {
    borderColor: '#10b981',
    backgroundColor: '#022c22',
  },
  cardAbstained: {
    borderColor: '#f59e0b',
    backgroundColor: '#451a03',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 14,
  },
  badge: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#064e3b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  body: {
    color: '#f8fafc',
    fontSize: 13,
    lineHeight: 18,
  },
  boundsBox: {
    marginTop: 8,
    padding: 6,
    backgroundColor: '#064e3b',
    borderRadius: 4,
  },
  boundsText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  violationBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#78350f',
    borderRadius: 4,
  },
  violationText: {
    color: '#fde68a',
    fontSize: 11,
    fontWeight: '600',
  },
  latency: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
});
