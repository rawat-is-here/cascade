import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onProcessOrder: (spokenPhrase: string) => Promise<void>;
  loading?: boolean;
}

const SAMPLE_ORDERS = [
  { label: '4kg aloo 80 rupaye me de do', note: 'Dynamic: +₹80.00' },
  { label: '50 rupaye ka tamatar pack kar do', note: 'Value Order: +₹50.00' },
  { label: '2 plate poha 40 rupaye', note: 'Plate Count: +₹40.00' },
  { label: '3 chai 30 rupaye', note: 'Beverage: +₹30.00' },
  { label: 'Sharma ji ka 100 jama kar', note: 'Udhaar Credit: +₹100.00' },
  { label: '4kg aloo kitne ke hue', note: 'Inquiry: ₹0 (No phantom sale)' },
  { label: 'Rehne do bhaiya bahut mehenga hai', note: 'Walkaway: ₹0 (Customer left)' },
  { label: 'Thoda dhaniya mirchi upar se daal do', note: 'Freebie: ₹0 (Stock only)' }
];

export const VoiceOrderModal: React.FC<Props> = ({
  visible,
  onClose,
  onProcessOrder,
  loading = false
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = async (textToSubmit?: string) => {
    const query = (textToSubmit !== undefined ? textToSubmit : inputText).trim();
    if (!query) return;
    await onProcessOrder(query);
    setInputText('');
    onClose();
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
                  <Ionicons name="mic" size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>Voice Sale Order</Text>
                  <Text style={styles.subtitle}>Dynamic Indic Lexer & Double-Entry Parser</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Input Box */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>SPEAK OR ENTER CUSTOM PHRASE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 4kg aloo 80 rupaye, 50 ka tamatar..."
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSubmit()}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.processBtn, (!inputText.trim() || loading) && styles.processBtnDisabled]}
                onPress={() => handleSubmit()}
                disabled={!inputText.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#073B3A" size="small" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#073B3A" style={{ marginRight: 6 }} />
                    <Text style={styles.processBtnText}>Parse & Post Sale</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Dynamic Samples */}
            <Text style={styles.sectionHeading}>Tap Any Real Street Dialogue to Test</Text>
            <Text style={styles.sectionSub}>
              Zero hardcoding. Each phrase is dynamically parsed by the Indic NLP Lexer.
            </Text>

            <View style={styles.chipsContainer}>
              {SAMPLE_ORDERS.map((sample, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.chip}
                  onPress={() => handleSubmit(sample.label)}
                  disabled={loading}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chipText}>“{sample.label}”</Text>
                    <Text style={styles.chipNote}>{sample.note}</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={20} color="#073B3A" />
                </TouchableOpacity>
              ))}
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '85%',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  inputCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 12,
  },
  processBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processBtnDisabled: {
    opacity: 0.5,
  },
  processBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 12,
  },
  chipsContainer: {
    gap: 8,
  },
  chip: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#073B3A',
    marginBottom: 2,
  },
  chipNote: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
});
