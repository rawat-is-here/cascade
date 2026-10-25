import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirmTransactions: (entries: {
    inventoryExpense: number;
    creditSettled: number;
    salesEarned: number;
  }) => void;
}

export const VoiceIngestionModal: React.FC<Props> = ({
  visible,
  onClose,
  onConfirmTransactions
}) => {
  const [isListening, setIsListening] = useState(false);
  const [hasParsed, setHasParsed] = useState(false);

  const rawSampleUtterance =
    'भाई ३ किलो टमाटर लिया १८० में… [85dB ट्रैफिक हॉर्न] …शर्मा जी का ४० जमा कर, और ७ प्लेट पोहा दे।';

  const handleStartListening = () => {
    setIsListening(true);
    setHasParsed(false);
    setTimeout(() => {
      setIsListening(false);
      setHasParsed(true);
    }, 1600);
  };

  const handleConfirm = () => {
    onConfirmTransactions({
      inventoryExpense: 180,
      creditSettled: 40,
      salesEarned: 175
    });
    setHasParsed(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.row}>
              <View style={styles.pulseDot} />
              <Text style={styles.headerTitle}>आवाज़ पहचान (Street Voice Engine)</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* The Big Mic Indicator */}
            <View style={styles.micCenter}>
              <TouchableOpacity
                style={[styles.bigMicCircle, isListening && styles.bigMicActive]}
                onPress={handleStartListening}
              >
                <Ionicons
                  name={isListening ? 'radio' : 'mic'}
                  size={44}
                  color="#ffffff"
                />
              </TouchableOpacity>
              <Text style={styles.micInstruction}>
                {isListening
                  ? 'सुन रहे हैं... (85dB Noise Filtering Active)'
                  : 'माइक दबाकर बोलें (Tap to Speak)'}
              </Text>
            </View>

            {/* Raw Street Input Box */}
            <View style={styles.rawBox}>
              <Text style={styles.rawLabel}>सुनी गई वेंडर बोली (Raw Utterance):</Text>
              <Text style={styles.rawText}>"{rawSampleUtterance}"</Text>
            </View>

            {isListening && (
              <View style={styles.procBox}>
                <ActivityIndicator size="small" color="#34d399" />
                <Text style={styles.procText}>
                  ध्वनि शोर अलग कर रहे हैं + लेक्सिकॉन ड्रॉप लागू हो रहा है...
                </Text>
              </View>
            )}

            {/* Extracted Double-Entry Postings */}
            {hasParsed && (
              <View style={styles.resultsBox}>
                <Text style={styles.resultsHeading}>
                  AI द्वारा निकाले गए ३ लेजर खाते (Compound Multi-Action):
                </Text>

                {/* Entry 1: Inventory */}
                <View style={styles.entryCard}>
                  <View style={styles.entryIconBox}>
                    <MaterialCommunityIcons name="basket-fill" size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.flex1}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.entryTitle}>कच्चा माल ख़रीद (Inventory)</Text>
                      <Text style={styles.confidencePill}>94% पक्का</Text>
                    </View>
                    <Text style={styles.entrySub}>+3 kg टमाटर @ ₹180 नक़द गया</Text>
                    <Text style={styles.debitCredit}>Debit: Inventory | Credit: Cash</Text>
                  </View>
                </View>

                {/* Entry 2: Customer Credit */}
                <View style={styles.entryCard}>
                  <View style={[styles.entryIconBox, { backgroundColor: '#3b0764' }]}>
                    <Ionicons name="person" size={20} color="#c084fc" />
                  </View>
                  <View style={styles.flex1}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.entryTitle}>उधारी जमा (Udhar Reconciled)</Text>
                      <Text style={styles.confidencePill}>88% पक्का</Text>
                    </View>
                    <Text style={styles.entrySub}>शर्मा जी (स्कूटर वाले) ने ₹40 जमा किए</Text>
                    <Text style={styles.debitCredit}>Debit: Cash | Credit: Customer Udhar</Text>
                  </View>
                </View>

                {/* Entry 3: Food Sales */}
                <View style={styles.entryCard}>
                  <View style={[styles.entryIconBox, { backgroundColor: '#064e3b' }]}>
                    <Ionicons name="fast-food" size={20} color="#34d399" />
                  </View>
                  <View style={styles.flex1}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.entryTitle}>नाश्ता बिक्री (Food Sales)</Text>
                      <Text style={styles.confidencePill}>96% पक्का</Text>
                    </View>
                    <Text style={styles.entrySub}>7 प्लेट पोहा (+₹175 नक़द आया)</Text>
                    <Text style={styles.debitCredit}>Debit: Cash | Credit: Food Sales</Text>
                  </View>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Ionicons name="checkmark-done-circle" size={24} color="#fff" />
                  <Text style={styles.confirmBtnText}>सही है, लेजर में दर्ज करें (Confirm)</Text>
                </TouchableOpacity>
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
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#0c1017',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  flex1: {
    flex: 1
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginRight: 8
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  closeBtn: {
    padding: 4
  },
  content: {
    padding: 18,
    paddingBottom: 40
  },
  micCenter: {
    alignItems: 'center',
    marginVertical: 14
  },
  bigMicCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOpacity: 0.5,
    shadowRadius: 12
  },
  bigMicActive: {
    backgroundColor: '#f43f5e',
    shadowColor: '#f43f5e'
  },
  micInstruction: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10
  },
  rawBox: {
    backgroundColor: '#161f2e',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    marginBottom: 14
  },
  rawLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4
  },
  rawText: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic'
  },
  procBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  procText: {
    color: '#a7f3d0',
    fontSize: 11,
    marginLeft: 8
  },
  resultsBox: {
    marginTop: 6
  },
  resultsHeading: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10
  },
  entryCard: {
    backgroundColor: '#131b2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  entryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#451a03',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  entryTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  confidencePill: {
    backgroundColor: '#064e3b',
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  entrySub: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2
  },
  debitCredit: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2
  },
  confirmBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 14
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8
  }
});
