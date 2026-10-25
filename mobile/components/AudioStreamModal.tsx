import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AudioTurnLog {
  id: string;
  speaker: 'VENDOR' | 'CUST_1' | 'CUST_2' | 'SOUNDBOX_CHIME';
  text: string;
  timestamp: string;
  noiseDb: number;
  confidence: number;
  evidenceId?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onTurnLogged?: (turn: AudioTurnLog) => void;
}

export const AudioStreamModal: React.FC<Props> = ({
  visible,
  onClose,
  apiBaseUrl,
  onTurnLogged
}) => {
  const [isRecording, setIsRecording] = useState(true);
  const [decibels, setDecibels] = useState(62);
  const [vadActive, setVadActive] = useState(true);
  const [selectedSpeaker, setSelectedSpeaker] = useState<'VENDOR' | 'CUST_1' | 'CUST_2' | 'SOUNDBOX_CHIME'>('VENDOR');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrated, setCalibrated] = useState(true);
  const [history, setHistory] = useState<AudioTurnLog[]>([
    {
      id: '1',
      speaker: 'CUST_1',
      text: 'Bhaiya 1 kilo tamatar kitne ka diya?',
      timestamp: '12:44:10 PM',
      noiseDb: 64,
      confidence: 0.94,
      evidenceId: 'CHUNK_1729924810_1'
    },
    {
      id: '2',
      speaker: 'VENDOR',
      text: 'Tamatar 30 rupay kilo hai bhai.',
      timestamp: '12:44:14 PM',
      noiseDb: 61,
      confidence: 0.97,
      evidenceId: 'CHUNK_1729924814_2'
    }
  ]);

  // Decibel meter fluctuation simulation
  useEffect(() => {
    if (!visible || !isRecording) return;
    const interval = setInterval(() => {
      const base = vadActive ? 64 : 48;
      const noise = Math.round(base + (Math.random() * 12 - 6));
      setDecibels(noise);
      setVadActive(noise > 55);
    }, 800);
    return () => clearInterval(interval);
  }, [visible, isRecording, vadActive]);

  const handleSendTurn = async (speaker: 'VENDOR' | 'CUST_1' | 'CUST_2' | 'SOUNDBOX_CHIME', textToSend: string) => {
    if (!textToSend.trim()) return;
    setLoading(true);

    const timeMs = Date.now();
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const noise = Math.round(58 + Math.random() * 14);
    const conf = 0.95;

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/audio/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker,
          text: textToSend,
          timestamp: timeMs,
          confidence: conf,
          noiseDb: noise
        })
      });
      const data = await res.json();

      const newTurn: AudioTurnLog = {
        id: `turn-${timeMs}`,
        speaker,
        text: textToSend,
        timestamp: timeStr,
        noiseDb: noise,
        confidence: conf,
        evidenceId: data.evidenceId || `CHUNK_${timeMs}_1`
      };

      setHistory(prev => [newTurn, ...prev]);
      setInputText('');
      if (onTurnLogged) onTurnLogged(newTurn);
    } catch {
      // Local fallback
      const newTurn: AudioTurnLog = {
        id: `turn-${timeMs}`,
        speaker,
        text: textToSend,
        timestamp: timeStr,
        noiseDb: noise,
        confidence: conf,
        evidenceId: `OFFLINE_CHUNK_${timeMs}`
      };
      setHistory(prev => [newTurn, ...prev]);
      setInputText('');
      if (onTurnLogged) onTurnLogged(newTurn);
    } finally {
      setLoading(false);
    }
  };

  const handleCalibrateVendorVoice = () => {
    setCalibrating(true);
    setTimeout(() => {
      setCalibrating(false);
      setCalibrated(true);
    }, 2500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.micIconBox}>
                <Ionicons name="mic" size={18} color="#073B3A" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.modalTitle}>Continuous Audio Stream</Text>
                <Text style={styles.modalSubtitle}>POST /audio/turn Hardware Binding</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Live Audio Visualizer Banner */}
            <View style={styles.visualizerCard}>
              <View style={styles.visualizerTopRow}>
                <View style={styles.streamBadge}>
                  <View style={[styles.liveDot, { backgroundColor: isRecording ? '#10B981' : '#9CA3AF' }]} />
                  <Text style={styles.streamBadgeText}>
                    {isRecording ? 'STREAMING 16kHz PCM' : 'STREAM MUTED'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.streamToggle, isRecording ? styles.streamTogglePause : styles.streamToggleStart]}
                  onPress={() => setIsRecording(prev => !prev)}
                >
                  <Ionicons name={isRecording ? 'pause' : 'play'} size={12} color="#073B3A" style={{ marginRight: 4 }} />
                  <Text style={styles.streamToggleText}>{isRecording ? 'Pause' : 'Resume'}</Text>
                </TouchableOpacity>
              </View>

              {/* Pulsing Frequency Bars */}
              <View style={styles.frequencyBarsRow}>
                {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.3, 0.9, 0.7].map((heightScale, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.freqBar,
                      {
                        height: isRecording ? Math.max(10, Math.min(48, decibels * heightScale * 0.7)) : 8,
                        backgroundColor: idx % 2 === 0 ? '#E2FD52' : '#FFFFFF'
                      }
                    ]}
                  />
                ))}
              </View>

              {/* Readout metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>DECIBEL LEVEL</Text>
                  <Text style={styles.metricValue}>{decibels} dB</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>VAD SPEECH</Text>
                  <Text style={[styles.metricValue, { color: vadActive ? '#E2FD52' : '#9CA3AF' }]}>
                    {vadActive ? 'DETECTED' : 'QUIET'}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>PROFILE</Text>
                  <Text style={styles.metricValue}>{calibrated ? 'VENDOR ENROLLED' : 'UNCALIBRATED'}</Text>
                </View>
              </View>
            </View>

            {/* Vendor Voice Profile Calibration Button */}
            <TouchableOpacity
              style={styles.calibratePill}
              onPress={handleCalibrateVendorVoice}
              disabled={calibrating}
            >
              <Ionicons name={calibrating ? 'hourglass-outline' : 'finger-print-outline'} size={16} color="#073B3A" style={{ marginRight: 8 }} />
              <Text style={styles.calibrateText}>
                {calibrating ? 'Enrolling Voice Profile (ECAPA-TDNN 192-dim)...' : 'Re-Calibrate Vendor Voice (5s Enrollment)'}
              </Text>
            </TouchableOpacity>

            {/* Quick Stream Turn Presets */}
            <Text style={styles.sectionHeading}>Stream Pre-Synthesized Turns to /audio/turn</Text>
            <View style={styles.presetButtonsRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => handleSendTurn('VENDOR', '1 kilo tamatar 30 rupay le jao.')}
                disabled={loading}
              >
                <Text style={styles.presetSpeaker}>VENDOR</Text>
                <Text style={styles.presetText}>“1 kilo tamatar ₹30”</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => handleSendTurn('CUST_1', 'Bhaiya 2 plate poha dena jaldi.')}
                disabled={loading}
              >
                <Text style={styles.presetSpeaker}>CUSTOMER</Text>
                <Text style={styles.presetText}>“2 plate poha dena”</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => handleSendTurn('SOUNDBOX_CHIME', 'Paytm par 140 rupay prapt hue.')}
                disabled={loading}
              >
                <Text style={styles.presetSpeaker}>SOUNDBOX</Text>
                <Text style={styles.presetText}>“₹140 received”</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Spoken Turn Input */}
            <Text style={styles.sectionHeading}>Simulate Custom Spoken Turn</Text>
            <View style={styles.inputContainer}>
              <View style={styles.speakerSelectorRow}>
                {(['VENDOR', 'CUST_1', 'SOUNDBOX_CHIME'] as const).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.speakerPill, selectedSpeaker === role && styles.speakerPillActive]}
                    onPress={() => setSelectedSpeaker(role)}
                  >
                    <Text style={[styles.speakerPillText, selectedSpeaker === role && styles.speakerPillTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter spoken customer or vendor phrase..."
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                />
                <TouchableOpacity
                  style={styles.sendTurnBtn}
                  onPress={() => handleSendTurn(selectedSpeaker, inputText)}
                  disabled={loading || !inputText.trim()}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#073B3A" />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color="#073B3A" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Streamed Turns Log */}
            <Text style={styles.sectionHeading}>Recent Audio Turn Logs (WAL Buffer)</Text>
            {history.map(item => (
              <View key={item.id} style={styles.turnCard}>
                <View style={styles.turnHeader}>
                  <View style={[styles.speakerBadge, item.speaker === 'VENDOR' ? styles.badgeVendor : styles.badgeCust]}>
                    <Text style={styles.speakerBadgeText}>{item.speaker}</Text>
                  </View>
                  <Text style={styles.turnTime}>{item.timestamp} • {item.noiseDb} dB</Text>
                </View>
                <Text style={styles.turnBodyText}>“{item.text}”</Text>
                <Text style={styles.turnEvidence}>{item.evidenceId} • {(item.confidence * 100).toFixed(0)}% Confidence</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 59, 58, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#073B3A',
  },
  modalSubtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    padding: 20,
  },
  visualizerCard: {
    backgroundColor: '#073B3A',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  visualizerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  streamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  streamBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  streamToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  streamTogglePause: {
    backgroundColor: '#E2FD52',
  },
  streamToggleStart: {
    backgroundColor: '#D1D5DB',
  },
  streamToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#073B3A',
  },
  frequencyBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 10,
    marginVertical: 10,
  },
  freqBar: {
    width: 6,
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
    marginTop: 6,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  calibratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1FFE5',
    borderWidth: 1,
    borderColor: '#79AF00',
    paddingVertical: 11,
    borderRadius: 14,
    marginBottom: 18,
  },
  calibrateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6E827D',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#F8FCF9',
    borderWidth: 1,
    borderColor: '#DDECE7',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  presetSpeaker: {
    fontSize: 8,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  presetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: '#F8FCF9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDECE7',
    padding: 12,
    marginBottom: 18,
  },
  speakerSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  speakerPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  speakerPillActive: {
    backgroundColor: '#073B3A',
    borderColor: '#073B3A',
  },
  speakerPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
  },
  speakerPillTextActive: {
    color: '#E2FD52',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#111827',
  },
  sendTurnBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  turnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 8,
  },
  turnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  speakerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeVendor: {
    backgroundColor: '#F1FFE5',
  },
  badgeCust: {
    backgroundColor: '#F3F4F6',
  },
  speakerBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#073B3A',
  },
  turnTime: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  turnBodyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  turnEvidence: {
    fontSize: 8,
    color: '#6E827D',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});
