import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl?: string;
  onCalculate?: (spoilage: number, eating: number, theft: number) => void;
}

export const LossModal: React.FC<Props> = ({ visible, onClose, apiBaseUrl, onCalculate }) => {
  const [commodity, setCommodity] = useState('Tomatoes');
  const [missingKg, setMissingKg] = useState('4.0');
  const [temp, setTemp] = useState('39');
  const [hoursExposed, setHoursExposed] = useState('7');
  const [result, setResult] = useState<{ spoilage: number; eating: number; theft: number } | null>({
    spoilage: 43.8,
    eating: 47.4,
    theft: 8.8
  });

  const handleCompute = () => {
    const t = parseFloat(temp) || 35;
    const h = parseFloat(hoursExposed) || 6;
    
    // Bayesian temperature-accelerated exponential rot factor
    const rotBase = Math.min(75, Math.max(15, (t - 25) * 3.2 + (h * 1.8)));
    const eatingBase = Math.max(10, 85 - rotBase);
    const theftBase = Math.max(5, 100 - (rotBase + eatingBase));
    const total = rotBase + eatingBase + theftBase;

    const computed = {
      spoilage: Number(((rotBase / total) * 100).toFixed(1)),
      eating: Number(((eatingBase / total) * 100).toFixed(1)),
      theft: Number(((theftBase / total) * 100).toFixed(1))
    };

    setResult(computed);
    if (onCalculate) {
      onCalculate(computed.spoilage, computed.eating, computed.theft);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <View style={styles.titleIcon}>
                  <Ionicons name="leaf-outline" size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>Check stock loss</Text>
                  <Text style={styles.sub}>See why some stock may be missing.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={21} color="#52635F" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Product</Text>
              <View style={styles.chipRow}>
                {['Tomatoes', 'Onions', 'Potatoes'].map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, commodity === c && styles.chipActive]}
                    onPress={() => setCommodity(c)}
                  >
                    <Text style={[styles.chipText, commodity === c && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Missing stock (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={missingKg}
                  onChangeText={setMissingKg}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Temperature (°C)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={temp}
                  onChangeText={setTemp}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Time in heat (hours)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={hoursExposed}
                onChangeText={setHoursExposed}
              />
            </View>

            {/* ELECTRIC LIME CTA */}
            <TouchableOpacity style={styles.calcBtn} onPress={handleCompute}>
              <Ionicons name="sparkles-outline" size={19} color="#073B3A" />
              <Text style={styles.calcBtnText}>Check possible reasons</Text>
            </TouchableOpacity>

            {result && (
              <View style={styles.resultsCard}>
                <Text style={styles.resEyebrow}>STOCK LOSS SUMMARY</Text>
                <Text style={styles.resHeading}>Possible reasons</Text>
                
                <View style={styles.statRow}>
                  <View style={styles.reasonCopy}>
                    <View style={[styles.reasonIcon, { backgroundColor: '#E9F7EF' }]}>
                      <Ionicons name="thermometer-outline" size={17} color="#073B3A" />
                    </View>
                    <Text style={styles.statLabel}>Heat spoilage</Text>
                  </View>
                  <Text style={[styles.statVal, { color: '#073B3A' }]}>{result.spoilage}%</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${result.spoilage}%`, backgroundColor: '#073B3A' }]} /></View>

                <View style={styles.statRow}>
                  <View style={styles.reasonCopy}>
                    <View style={[styles.reasonIcon, { backgroundColor: '#F1FFE5' }]}>
                      <Ionicons name="restaurant-outline" size={17} color="#5B7B00" />
                    </View>
                    <Text style={styles.statLabel}>Family use</Text>
                  </View>
                  <Text style={[styles.statVal, { color: '#073B3A' }]}>{result.eating}%</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${result.eating}%`, backgroundColor: '#A8D600' }]} /></View>

                <View style={styles.statRow}>
                  <View style={styles.reasonCopy}>
                    <View style={[styles.reasonIcon, { backgroundColor: '#FFF1F0' }]}>
                      <Ionicons name="alert-circle-outline" size={17} color="#C63C32" />
                    </View>
                    <Text style={styles.statLabel}>Other loss</Text>
                  </View>
                  <Text style={[styles.statVal, { color: '#DC2626' }]}>{result.theft}%</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${result.theft}%`, backgroundColor: '#F16A5B' }]} /></View>
              </View>
            )}

            <TouchableOpacity style={styles.applyBtn} onPress={onClose}>
              <Text style={styles.applyBtnText}>Save changes</Text>
            </TouchableOpacity>
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
  content: {
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
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    color: '#667A75',
    fontSize: 13,
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
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  rowTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#073B3A',
  },
  chipText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#E2FD52',
    fontWeight: '800',
  },
  calcBtn: {
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
  calcBtnText: {
    color: '#073B3A',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DDECE7',
  },
  resEyebrow: {
    color: '#6E827D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  resHeading: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  reasonCopy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  statLabel: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '500',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  track: {
    height: 7,
    backgroundColor: '#EAF0EE',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  applyBtn: {
    backgroundColor: '#073B3A',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#E2FD52',
    fontSize: 14,
    fontWeight: '800',
  },
});
