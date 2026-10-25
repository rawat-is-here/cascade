import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, StatusBar } from 'react-native';
import { BaselinePanel } from './components/BaselinePanel';
import { EnginePanel } from './components/EnginePanel';
import { SabotageControls } from './components/SabotageControls';
import { LiveComparisonState, SabotageType } from '../shared/types';

export default function App() {
  const [state, setState] = useState<LiveComparisonState>({
    currentScenario: 'NONE_CLEAN',
    sabotageIntensity: 0,
    baseline: {
      decisionId: 'init-base',
      rawLLMOutput: 'Standard baseline awaiting probe...',
      claimedConfidence: 0.85,
      crashedOrHallucinated: false,
      latencyMs: 45
    },
    engine: {
      decisionId: 'init-eng',
      inputEcho: 'System standby',
      primaryDecision: 'Engine standing by with verified invariants',
      confidenceScore: 1.0,
      epistemicState: 'VERIFIED_KNOWN',
      bounds: { minEstimate: 95, maxEstimate: 105, uncertaintyInterval: 10 },
      invariantViolationsDetected: [],
      abstained: false,
      latencyMs: 1.2,
      causalParents: [],
      explanation: 'System initialized on clean baseline'
    },
    systemMetrics: {
      totalEvents: 0,
      baselineFailures: 0,
      engineRecoveries: 0,
      averageEngineLatencyMs: 1.2
    }
  });

  const handleSabotageTrigger = async (scenario: SabotageType, intensity: number) => {
    try {
      // Points to local Node.js server (e.g. 10.0.2.2 for Android emulator or localhost/IP for physical device)
      const res = await fetch('http://localhost:4000/api/sabotage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, intensity })
      });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
      }
    } catch {
      // Fallback local simulation if server isn't running yet
      if (scenario === 'CLOCK_DRIFT_1970') {
        setState(prev => ({
          ...prev,
          currentScenario: scenario,
          baseline: {
            decisionId: 'base-err',
            rawLLMOutput: 'FATAL: Timestamp 1970-01-01 caused unhandled exception in transaction sequence.',
            claimedConfidence: 0.0,
            crashedOrHallucinated: true,
            failureReason: 'Physical clock reset crashed naive sequential index',
            latencyMs: 12
          },
          engine: {
            ...prev.engine,
            epistemicState: 'UNKNOWN_ABSTAIN',
            primaryDecision: '[ABSTAINED] Caught 1970 clock reset. Lamport Causal DAG preserved state.',
            invariantViolationsDetected: ['Physical clock reset detected: timestamp=0. Overridden by Lamport logical clock.'],
            abstained: true,
            latencyMs: 0.8
          }
        }));
      } else if (scenario === 'NOISE_85DB') {
        setState(prev => ({
          ...prev,
          currentScenario: scenario,
          baseline: {
            decisionId: 'base-hallucinate',
            rawLLMOutput: 'AI Assistant: "I am 99% confident this noisy signal is a valid order." (Hallucination)',
            claimedConfidence: 0.99,
            crashedOrHallucinated: true,
            failureReason: 'Blind point prediction under 85dB noise without uncertainty bounds',
            latencyMs: 110
          },
          engine: {
            ...prev.engine,
            epistemicState: 'DEGRADED_OUTDATED',
            primaryDecision: '[BOUNDED] Degraded signal. Output interval [55.0, 145.0], ±45.0 uncertainty.',
            invariantViolationsDetected: [],
            abstained: false,
            latencyMs: 2.1
          }
        }));
      } else {
        setState(prev => ({
          ...prev,
          currentScenario: 'NONE_CLEAN',
          baseline: {
            decisionId: 'base-ok',
            rawLLMOutput: 'Clean Input: Processed successfully with no errors.',
            claimedConfidence: 0.90,
            crashedOrHallucinated: false,
            latencyMs: 35
          },
          engine: {
            ...prev.engine,
            epistemicState: 'VERIFIED_KNOWN',
            primaryDecision: '[COMMITTED] Clean signal verified. Bounds [95.0, 105.0]',
            invariantViolationsDetected: [],
            abstained: false,
            latencyMs: 1.1
          }
        }));
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.teamTitle}>CASCADE // 0.5% PITCH DEMO</Text>
          <Text style={styles.subTitle}>Live Side-by-Side Sabotage Benchmark</Text>
        </View>

        <SabotageControls
          currentScenario={state.currentScenario}
          onSelectScenario={handleSabotageTrigger}
        />

        <View style={styles.section}>
          <BaselinePanel baseline={state.baseline} />
          <EnginePanel engine={state.engine} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  teamTitle: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subTitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  section: {
    marginTop: 8,
  },
});
