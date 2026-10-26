import React, { useState, useEffect, useRef } from 'react';
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
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface AudioTurnLog {
  id: string;
  speaker: 'VENDOR' | 'CUSTOMER';
  text: string;
  timestamp: string;
  confidence: number;
  noiseDb: number;
  needsConfirmation?: boolean;
  confirmed?: boolean;
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
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState<AudioTurnLog[]>([]);
  const [quickInput, setQuickInput] = useState('');
  const [processingTurn, setProcessingTurn] = useState(false);
  const [sessionNoiseDb, setSessionNoiseDb] = useState(48);

  // Confidence Gate (< 80%) State
  const [pendingConfirm, setPendingConfirm] = useState<AudioTurnLog | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const isMountedRef = useRef(true);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const sessionActiveRef = useRef(false);
  const sliceTimerRef = useRef<any>(null);
  const speechDetectedRef = useRef(false);

  const RECORDING_OPTIONS: Audio.RecordingOptions = {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000
    },
    isMeteringEnabled: true
  };

  const startSessionRecording = async (): Promise<boolean> => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        alert('Microphone permission required for continuous session.');
        return false;
      }
      // ★ CRITICAL: set allowsRecordingIOS before every prepareToRecordAsync
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:         true,   // unlocks mic on iOS/Android
        playsInSilentModeIOS:       true,
        staysActiveInBackground:    true,
        shouldDuckAndroid:          true,
        playThroughEarpieceAndroid: false
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      rec.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          const clamped = Math.max(-60, Math.min(0, status.metering));
          const db = Math.round(42 + ((clamped + 60) / 60) * 48);
          setSessionNoiseDb(db);
          if ((clamped + 60) / 60 > 0.22) {
            speechDetectedRef.current = true;
          }
        }
      });
      await rec.startAsync();
      recordingRef.current = rec;
      return true;
    } catch (err: any) {
      console.warn('[AudioSession] startSessionRecording failed:', err?.message || err);
      return false;
    }
  };

  const processSessionAudioChunk = async (rec: Audio.Recording) => {
    try {
      // Don't check isRecording — the timer may have already stopped it
      try { await rec.stopAndUnloadAsync(); } catch {}
      const uri = rec.getURI();
      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64
        });
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

        if (base64Audio && base64Audio.length > 1000) {
          const res = await fetch(`${apiBaseUrl}/vendor/audio/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: 'audio/mp4'
            })
          });
          const data = await res.json();
          if (data && data.ok && data.text && data.text.trim()) {
            handleIncomingTranscript(
              data.text.trim(),
              data.speaker || 'CUSTOMER',
              typeof data.confidence === 'number' ? data.confidence : 0.92,
              data.noiseDb || sessionNoiseDb
            );
          }
        }
      }
    } catch (err: any) {
      console.warn('[AudioSession] processSessionAudioChunk failed:', err?.message || err);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (visible) {
      loadSessionTranscripts();
    }
    return () => {
      isMountedRef.current = false;
      if (sliceTimerRef.current) {
        clearInterval(sliceTimerRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [visible, apiBaseUrl]);

  // Load existing session turns from server SQLite WAL
  const loadSessionTranscripts = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/audio/turns`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.turns)) {
          const list: AudioTurnLog[] = data.turns.map((t: any) => ({
            id: t.id,
            speaker: t.speakerClassification === 'VENDOR' ? 'VENDOR' : 'CUSTOMER',
            text: t.rawText,
            timestamp: new Date(t.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            confidence: t.sttConfidence ?? 0.95,
            noiseDb: t.noiseDb || 60,
            evidenceId: t.id,
            confirmed: true
          }));
          setTranscripts(list.reverse());
        }
      }
    } catch {
      // Offline fallback
    }
  };

  // THE SINGLE BUTTON: Start Session / End Session
  const handleToggleSession = async () => {
    setLoading(true);
    try {
      if (sessionActive) {
        // End Session
        sessionActiveRef.current = false;
        setSessionActive(false);
        if (sliceTimerRef.current) {
          clearInterval(sliceTimerRef.current);
          sliceTimerRef.current = null;
        }
        if (recordingRef.current) {
          try {
            await recordingRef.current.stopAndUnloadAsync();
          } catch {}
          recordingRef.current = null;
        }
      } else {
        // Start Session
        const ok = await startSessionRecording();
        if (ok) {
          sessionActiveRef.current = true;
          setSessionActive(true);
          sliceTimerRef.current = setInterval(async () => {
            if (!sessionActiveRef.current) return;
            if (speechDetectedRef.current && recordingRef.current) {
              speechDetectedRef.current = false;
              const current = recordingRef.current;
              recordingRef.current = null;
              // startSessionRecording already calls setAudioModeAsync before prepareToRecordAsync
              await startSessionRecording();
              processSessionAudioChunk(current);
            }
          }, 5000);
        }
      }
    } catch (err) {
      console.warn('Session toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Process incoming turn from Gemini transcription
  const handleIncomingTranscript = async (
    text: string,
    speaker: 'VENDOR' | 'CUSTOMER',
    confidence: number,
    noiseDb: number = 60
  ) => {
    const timeMs = Date.now();
    const timeStr = new Date(timeMs).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const turn: AudioTurnLog = {
      id: `turn-${timeMs}`,
      speaker,
      text,
      timestamp: timeStr,
      confidence,
      noiseDb,
      needsConfirmation: confidence < 0.80,
      confirmed: confidence >= 0.80
    };

    // Low confidence gate (< 80%)
    if (confidence < 0.80) {
      setPendingConfirm(turn);
      setEditText(text);
      setIsEditing(false);
    } else {
      commitTurnToBackend(turn);
    }

    setTranscripts(prev => [turn, ...prev]);
  };

  const commitTurnToBackend = async (turn: AudioTurnLog) => {
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/audio/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speaker: turn.speaker === 'VENDOR' ? 'VENDOR' : 'CUST_1',
          text: turn.text,
          timestamp: Date.now(),
          confidence: turn.confidence,
          noiseDb: turn.noiseDb
        })
      });
      const data = await res.json();
      turn.evidenceId = data.evidenceId;
      if (onTurnLogged) onTurnLogged(turn);
    } catch {
      turn.evidenceId = `OFFLINE_${Date.now()}`;
      if (onTurnLogged) onTurnLogged(turn);
    }
  };

  // 1. Confirm transcript as correct (< 90% verified)
  const handleConfirmPending = () => {
    if (!pendingConfirm) return;
    const confirmedTurn: AudioTurnLog = {
      ...pendingConfirm,
      needsConfirmation: false,
      confirmed: true
    };

    setTranscripts(prev => prev.map(t => (t.id === confirmedTurn.id ? confirmedTurn : t)));
    commitTurnToBackend(confirmedTurn);
    setPendingConfirm(null);
    setIsEditing(false);
  };

  // 2. Save manual edit
  const handleSaveManualEdit = () => {
    if (!pendingConfirm || !editText.trim()) return;
    const editedTurn: AudioTurnLog = {
      ...pendingConfirm,
      text: editText.trim(),
      confidence: 1.0, // Vendor manually confirmed text
      needsConfirmation: false,
      confirmed: true
    };

    setTranscripts(prev => prev.map(t => (t.id === editedTurn.id ? editedTurn : t)));
    commitTurnToBackend(editedTurn);
    setPendingConfirm(null);
    setIsEditing(false);
  };

  // 3. Discard noisy/unintelligible transcript
  const handleDiscardPending = () => {
    if (!pendingConfirm) return;
    setTranscripts(prev => prev.filter(t => t.id !== pendingConfirm.id));
    setPendingConfirm(null);
    setIsEditing(false);
  };

  // Submit spoken phrase to backend Gemini STT
  const handleSubmitSpokenPhrase = async (simulatedConf?: number) => {
    const raw = quickInput.trim();
    if (!raw) return;
    setProcessingTurn(true);

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/audio/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: raw,
          simulatedConf
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          handleIncomingTranscript(
            data.text,
            data.speaker || 'CUSTOMER',
            data.confidence,
            data.noiseDb || 60
          );
        }
      } else {
        // Fallback
        handleIncomingTranscript(raw, 'CUSTOMER', simulatedConf ?? 0.95, 60);
      }
    } catch {
      // Offline fallback
      handleIncomingTranscript(raw, 'CUSTOMER', simulatedConf ?? 0.95, 60);
    } finally {
      setProcessingTurn(false);
      setQuickInput('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: sessionActive ? '#10B981' : '#9CA3AF' }
                ]}
              />
              <View>
                <Text style={styles.modalTitle}>Continuous Audio Session</Text>
                <Text style={styles.modalSubtitle}>
                  {sessionActive
                    ? 'Session Active • Neural Acoustic Live Stream'
                    : 'Session Inactive • Tap to Start'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* THE SINGLE BUTTON: START SESSION / END SESSION */}
          <View style={styles.singleButtonContainer}>
            <TouchableOpacity
              style={[
                styles.mainSessionBtn,
                sessionActive ? styles.endSessionBtn : styles.startSessionBtn
              ]}
              onPress={handleToggleSession}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={sessionActive ? '#FFFFFF' : '#073B3A'} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={sessionActive ? 'stop-circle' : 'play-circle'}
                    size={26}
                    color={sessionActive ? '#FFFFFF' : '#073B3A'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.mainSessionBtnText,
                      sessionActive ? styles.endSessionBtnText : styles.startSessionBtnText
                    ]}
                  >
                    {sessionActive ? 'End Session' : 'Start Session'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* CONFIRMATION / MANUAL EDIT CARD (< 80% Confidence Gate) */}
          {pendingConfirm && (
            <View style={styles.confirmAlertCard}>
              <View style={styles.confirmAlertHeader}>
                <View style={styles.warningIconCircle}>
                  <Ionicons name="warning" size={16} color="#D97706" />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.confirmAlertTitle}>
                    Confirm Transcript ({Math.round(pendingConfirm.confidence * 100)}% &lt; 80%)
                  </Text>
                  <Text style={styles.confirmAlertSubtitle}>
                    Speech confidence below threshold. Was this transcript accurate?
                  </Text>
                </View>
              </View>

              {!isEditing ? (
                <>
                  <View style={styles.spokenQuoteBox}>
                    <Text style={styles.spokenQuoteText}>“{pendingConfirm.text}”</Text>
                  </View>
                  <View style={styles.confirmActionsRow}>
                    <TouchableOpacity
                      style={styles.confirmBtnPrimary}
                      onPress={handleConfirmPending}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#073B3A" />
                      <Text style={styles.confirmBtnPrimaryText}>Correct</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.confirmBtnSecondary}
                      onPress={() => setIsEditing(true)}
                    >
                      <Ionicons name="pencil" size={15} color="#1F2937" />
                      <Text style={styles.confirmBtnSecondaryText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.confirmBtnDiscard}
                      onPress={handleDiscardPending}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={styles.confirmBtnDiscardText}>Discard</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>Edit Spoken Words:</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    placeholder="Enter corrected transcript in Hindi/English..."
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                  />
                  <View style={styles.editActionsRow}>
                    <TouchableOpacity
                      style={styles.saveEditBtn}
                      onPress={handleSaveManualEdit}
                    >
                      <Ionicons name="save-outline" size={15} color="#073B3A" />
                      <Text style={styles.saveEditText}>Save & Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelEditBtn}
                      onPress={() => setIsEditing(false)}
                    >
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Quick Input Bar (For vocal testing / quiet stalls) */}
          {sessionActive && (
            <View style={styles.quickInputCard}>
              <TextInput
                style={styles.quickTextInput}
                value={quickInput}
                onChangeText={setQuickInput}
                placeholder="Speak/Type phrase (e.g., '4 kilo tamatar 100 rupaye')..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={() => handleSubmitSpokenPhrase()}
              />
              <View style={styles.quickActionButtons}>
                <TouchableOpacity
                  style={[styles.quickSendBtn, !quickInput.trim() && { opacity: 0.5 }]}
                  disabled={!quickInput.trim() || processingTurn}
                  onPress={() => handleSubmitSpokenPhrase()}
                >
                  {processingTurn ? (
                    <ActivityIndicator size="small" color="#073B3A" />
                  ) : (
                    <>
                      <Ionicons name="send" size={14} color="#073B3A" />
                      <Text style={styles.quickSendBtnText}>Send</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickTestLowConfBtn, !quickInput.trim() && { opacity: 0.5 }]}
                  disabled={!quickInput.trim() || processingTurn}
                  onPress={() => handleSubmitSpokenPhrase(0.72)}
                >
                  <Ionicons name="warning-outline" size={14} color="#D97706" />
                  <Text style={styles.quickTestLowConfText}>Test &lt;80%</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Session Transcripts List */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>Session Transcripts</Text>
            <Text style={styles.listHeaderCount}>
              {transcripts.length} {transcripts.length === 1 ? 'Turn' : 'Turns'}
            </Text>
          </View>

          <ScrollView style={styles.transcriptsList} contentContainerStyle={{ paddingBottom: 20 }}>
            {transcripts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name={sessionActive ? 'mic-outline' : 'mic-off-outline'}
                  size={42}
                  color="#9CA3AF"
                />
                <Text style={styles.emptyTitle}>
                  {sessionActive ? 'Listening for Customers...' : 'Session Stopped'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {sessionActive
                    ? 'Spoken orders & Hindi queries will stream here in real time.'
                    : 'Tap "Start Session" to open audio stream.'}
                </Text>
              </View>
            ) : (
              transcripts.map((t) => {
                const isVendor = t.speaker === 'VENDOR';
                const isLowConf = t.confidence < 0.80;

                return (
                  <View
                    key={t.id}
                    style={[
                      styles.transcriptCard,
                      isLowConf && !t.confirmed ? styles.transcriptCardAlert : null
                    ]}
                  >
                    <View style={styles.transcriptCardHeader}>
                      <View style={styles.speakerBadgeRow}>
                        <View
                          style={[
                            styles.speakerPill,
                            isVendor ? styles.speakerPillVendor : styles.speakerPillCustomer
                          ]}
                        >
                          <Ionicons
                            name={isVendor ? 'person' : 'people'}
                            size={12}
                            color={isVendor ? '#073B3A' : '#1E40AF'}
                          />
                          <Text
                            style={[
                              styles.speakerPillText,
                              isVendor ? styles.speakerTextVendor : styles.speakerTextCustomer
                            ]}
                          >
                            {isVendor ? 'VENDOR' : 'CUSTOMER'}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.confBadge,
                            isLowConf ? styles.confBadgeLow : styles.confBadgeHigh
                          ]}
                        >
                          <Text
                            style={[
                              styles.confBadgeText,
                              isLowConf ? styles.confTextLow : styles.confTextHigh
                            ]}
                          >
                            {Math.round(t.confidence * 100)}%
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.transcriptTimeText}>{t.timestamp}</Text>
                    </View>

                    <Text style={styles.transcriptBodyText}>“{t.text}”</Text>

                    <View style={styles.transcriptFooter}>
                      <View style={styles.footerNoiseRow}>
                        <Ionicons name="volume-medium-outline" size={13} color="#9CA3AF" />
                        <Text style={styles.footerNoiseText}>{t.noiseDb} dB</Text>
                      </View>

                      {t.needsConfirmation && !t.confirmed ? (
                        <View style={styles.statusPillReview}>
                          <Text style={styles.statusPillReviewText}>Pending Review</Text>
                        </View>
                      ) : (
                        <View style={styles.statusPillConfirmed}>
                          <Ionicons name="checkmark-done" size={12} color="#059669" />
                          <Text style={styles.statusPillConfirmedText}>Confirmed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '65%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  closeBtn: {
    padding: 6
  },

  /* THE SINGLE BUTTON */
  singleButtonContainer: {
    marginVertical: 14,
    alignItems: 'center'
  },
  mainSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8
  },
  startSessionBtn: {
    backgroundColor: '#E2FD52',
    borderWidth: 1,
    borderColor: '#C6E33B'
  },
  endSessionBtn: {
    backgroundColor: '#DC2626'
  },
  mainSessionBtnText: {
    fontSize: 16,
    fontWeight: '800'
  },
  startSessionBtnText: {
    color: '#073B3A'
  },
  endSessionBtnText: {
    color: '#FFFFFF'
  },

  /* CONFIRMATION / MANUAL EDIT CARD */
  confirmAlertCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12
  },
  confirmAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  warningIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E'
  },
  confirmAlertSubtitle: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 1
  },
  spokenQuoteBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FCD34D'
  },
  spokenQuoteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    fontStyle: 'italic'
  },
  confirmActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  confirmBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12
  },
  confirmBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
    marginLeft: 6
  },
  confirmBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12
  },
  confirmBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 5
  },
  confirmBtnDiscard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12
  },
  confirmBtnDiscardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 4
  },

  /* EDIT SECTION */
  editSection: {
    marginTop: 8
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350F',
    marginBottom: 6
  },
  editInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8
  },
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  saveEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10
  },
  saveEditText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
    marginLeft: 6
  },
  cancelEditBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  cancelEditText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600'
  },

  /* QUICK INPUT BAR */
  quickInputCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  quickTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    marginBottom: 8
  },
  quickActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  quickSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8
  },
  quickSendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073B3A',
    marginLeft: 5
  },
  quickTestLowConfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  quickTestLowConfText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4
  },

  /* TRANSCRIPTS LIST */
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151'
  },
  listHeaderCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280'
  },
  transcriptsList: {
    flex: 1
  },
  transcriptCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  transcriptCardAlert: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB'
  },
  transcriptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  speakerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  speakerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8
  },
  speakerPillVendor: {
    backgroundColor: '#D1FAE5'
  },
  speakerPillCustomer: {
    backgroundColor: '#DBEAFE'
  },
  speakerPillText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4
  },
  speakerTextVendor: {
    color: '#073B3A'
  },
  speakerTextCustomer: {
    color: '#1E40AF'
  },
  confBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  confBadgeHigh: {
    backgroundColor: '#ECFDF5'
  },
  confBadgeLow: {
    backgroundColor: '#FEF3C7'
  },
  confBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  confTextHigh: {
    color: '#059669'
  },
  confTextLow: {
    color: '#D97706'
  },
  transcriptTimeText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  transcriptBodyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6
  },
  transcriptFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerNoiseRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  footerNoiseText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 3
  },
  statusPillConfirmed: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusPillConfirmedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 3
  },
  statusPillReview: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusPillReviewText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E'
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 8
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240
  }
});
