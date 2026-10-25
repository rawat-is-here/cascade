import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SabotageType } from '../../shared/types';

interface Props {
  currentScenario: SabotageType;
  onSelectScenario: (scenario: SabotageType, intensity: number) => void;
}

export const SabotageControls: React.FC<Props> = ({ currentScenario, onSelectScenario }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>⚡ JUDGE SABOTAGE CONTROLS</Text>
      <Text style={styles.sub}>Trigger live hostile conditions to test system breakdown:</Text>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.btn, currentScenario === 'NONE_CLEAN' && styles.btnActive]}
          onPress={() => onSelectScenario('NONE_CLEAN', 0)}
        >
          <Text style={styles.btnText}>Clean Path</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, currentScenario === 'NOISE_85DB' && styles.btnActiveAlert]}
          onPress={() => onSelectScenario('NOISE_85DB', 85)}
        >
          <Text style={styles.btnText}>85dB Noise</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, currentScenario === 'CLOCK_DRIFT_1970' && styles.btnActiveAlert]}
          onPress={() => onSelectScenario('CLOCK_DRIFT_1970', 100)}
        >
          <Text style={styles.btnText}>1970 Clock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  heading: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  sub: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  btn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: '#0284c7',
  },
  btnActiveAlert: {
    backgroundColor: '#dc2626',
  },
  btnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
});
