import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  pending: {
    item: string;
    amount: number;
    text: string;
    confidence: number;
  } | null;
  onConfirm: () => void;
  onReRecord: () => void;
  onManualEntry: (text: string) => void;
  onDismiss: () => void;
}

export default function STTConfirmationModal({
  visible,
  pending,
  onConfirm,
  onReRecord,
  onManualEntry,
  onDismiss,
}: Props) {
  const [showManualInput, setShowManualInput] = useState(false);
  const [correctedText, setCorrectedText] = useState('');

  const confidence = pending?.confidence ?? 0;
  const confidencePercent = Math.round(confidence * 100);
  const formattedConfidence = confidence.toFixed(2);

  const getConfidenceColor = () => {
    if (confidence < 0.7) return '#EF4444'; // red
    return '#F97316'; // orange (0.7–0.89)
  };

  const handleManualSave = () => {
    if (correctedText.trim()) {
      onManualEntry(correctedText.trim());
      setShowManualInput(false);
      setCorrectedText('');
    }
  };

  const handleDismiss = () => {
    setShowManualInput(false);
    setCorrectedText('');
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kvWrapper}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.warningIconCircle}>
                <Ionicons name="warning" size={22} color="#F97316" />
              </View>
              <Text style={styles.headerTitle}>Low Confidence Transcript</Text>
              <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <View style={styles.infoBannerRow}>
                  <Ionicons name="information-circle" size={16} color="#92400E" />
                  <Text style={styles.infoBannerLabel}>Confidence Score</Text>
                  <Text style={styles.confidenceScore}>{formattedConfidence}</Text>
                </View>
                <Text style={styles.infoBannerText} numberOfLines={3}>
                  "{pending?.text ?? ''}"
                </Text>
              </View>

              {/* Confidence Bar */}
              <View style={styles.barContainer}>
                <Text style={styles.barLabel}>Confidence Level</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${confidencePercent}%` as any,
                        backgroundColor: getConfidenceColor(),
                      },
                    ]}
                  />
                </View>
                <View style={styles.barTicks}>
                  <Text style={styles.barTick}>0%</Text>
                  <Text style={styles.barTick}>70%</Text>
                  <Text style={styles.barTick}>100%</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {/* Confirm */}
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>
                    ✓ Confirm This Sale (₹{pending?.amount?.toFixed(2) ?? '0.00'})
                  </Text>
                </TouchableOpacity>

                {/* Re-record */}
                <TouchableOpacity
                  style={styles.reRecordBtn}
                  onPress={onReRecord}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={16} color="#073B3A" style={styles.btnIcon} />
                  <Text style={styles.reRecordBtnText}>Re-record</Text>
                </TouchableOpacity>

                {/* Type Manually */}
                {!showManualInput ? (
                  <TouchableOpacity
                    style={styles.manualBtn}
                    onPress={() => {
                      setShowManualInput(true);
                      setCorrectedText(pending?.text ?? '');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pencil" size={16} color="#6B7280" style={styles.btnIcon} />
                    <Text style={styles.manualBtnText}>Type Manually</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.manualInputContainer}>
                    <View style={styles.manualInputHeader}>
                      <Ionicons name="pencil" size={14} color="#073B3A" />
                      <Text style={styles.manualInputLabel}>Corrected Text</Text>
                    </View>
                    <TextInput
                      style={styles.manualTextInput}
                      value={correctedText}
                      onChangeText={setCorrectedText}
                      placeholder="Type the correct entry..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      autoFocus
                    />
                    <View style={styles.manualInputActions}>
                      <TouchableOpacity
                        style={styles.cancelManualBtn}
                        onPress={() => {
                          setShowManualInput(false);
                          setCorrectedText('');
                        }}
                      >
                        <Text style={styles.cancelManualBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.saveManualBtn,
                          !correctedText.trim() && styles.saveManualBtnDisabled,
                        ]}
                        onPress={handleManualSave}
                        disabled={!correctedText.trim()}
                      >
                        <Text style={styles.saveManualBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Dismiss link */}
              <TouchableOpacity onPress={handleDismiss} style={styles.dismissLink}>
                <Text style={styles.dismissLinkText}>Dismiss</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  kvWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  warningIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },
  infoBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  infoBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  confidenceScore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    fontVariant: ['tabular-nums'],
  },
  infoBannerText: {
    fontSize: 13,
    color: '#78350F',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  barContainer: {
    marginBottom: 24,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  barTrack: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  barTick: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 8,
  },
  confirmBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#073B3A',
  },
  reRecordBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#073B3A',
    flexDirection: 'row',
    gap: 8,
  },
  reRecordBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#073B3A',
  },
  manualBtn: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    gap: 8,
  },
  manualBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  btnIcon: {
    marginRight: 2,
  },
  manualInputContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  manualInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  manualInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#073B3A',
  },
  manualTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  manualInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  cancelManualBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelManualBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveManualBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#073B3A',
  },
  saveManualBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveManualBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2FD52',
  },
  dismissLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  dismissLinkText: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
});

export { STTConfirmationModal };
