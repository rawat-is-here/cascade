import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onComplete: (config: {
    language: string;
    stallType: string;
    familyRole: string;
    openingCash: number;
  }) => void;
}

export const OnboardingModal: React.FC<Props> = ({ visible, onComplete }) => {
  const [step, setStep] = useState(1);
  const [selectedLang, setSelectedLang] = useState('hi');
  const [selectedStall, setSelectedStall] = useState('chai_nashta');
  const [selectedRole, setSelectedRole] = useState('stall_lead');
  const [openingCash, setOpeningCash] = useState(500);

  const languages = [
    { id: 'hi', label: 'हिंदी', sub: 'Hindi', greeting: 'नमस्ते! यह आपका डिजिटल गल्ला है।' },
    { id: 'en', label: 'English', sub: 'English', greeting: 'Welcome! Your digital street ledger.' },
    { id: 'mr', label: 'मराठी', sub: 'Marathi', greeting: 'नमस्कार! हा तुमचा डिजिटल गल्ला आहे.' },
    { id: 'gu', label: 'ગુજરાતી', sub: 'Gujarati', greeting: 'નમસ્તે! આ તમારો ડિજિટલ ગલ્લો છે.' },
    { id: 'ta', label: 'தமிழ்', sub: 'Tamil', greeting: 'வணக்கம்! இது உங்கள் டிஜிட்டல் கல்லா.' },
  ];

  const stallTypes = [
    {
      id: 'chai_nashta',
      title: 'चाय & नाश्ता टपरी',
      en: 'Chai & Breakfast Stall',
      icon: 'coffee',
      items: 'Chai, Poha, Samosa, Bun Maska'
    },
    {
      id: 'street_food',
      title: 'स्ट्रीट फ़ूड / चाट',
      en: 'Fast Food & Chaat Cart',
      icon: 'silverware-fork-knife',
      items: 'Pani Puri, Dosa, Pav Bhaji, Noodles'
    },
    {
      id: 'sabzi_thela',
      title: 'सब्ज़ी & फल ठेला',
      en: 'Vegetable & Fruit Thela',
      icon: 'basket',
      items: 'Aloo, Pyaaz, Tamatar, Seasonal'
    },
    {
      id: 'kirana_stall',
      title: 'छोटा किराना / पान',
      en: 'Mini Kirana & Paan Stall',
      icon: 'store',
      items: 'Packaged Snacks, Cold Drinks, FMCG'
    }
  ];

  const familyRoles = [
    {
      id: 'stall_lead',
      title: 'दुकान / गल्ला लीड (Stall)',
      desc: 'Takes customer orders, accepts cash/UPI, manages udhar',
      badge: 'Main Device (You)',
      icon: 'cash-register'
    },
    {
      id: 'mandi_buyer',
      title: 'मंडी खरीदार (Mandi Buyer - Chotu)',
      desc: 'Visits wholesale market at 5 AM, logs bills & raw materials',
      badge: 'Syncs via Bluetooth',
      icon: 'truck-fast'
    },
    {
      id: 'home_prep',
      title: 'घर की रसोई (Kitchen Prep - Sunita)',
      desc: 'Prepares raw batter, tracks family meal consumption & spoilage',
      badge: 'Offline P2P Node',
      icon: 'pot-steam'
    }
  ];

  const handleFinish = () => {
    onComplete({
      language: selectedLang,
      stallType: selectedStall,
      familyRole: selectedRole,
      openingCash: openingCash
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header Indicator */}
        <View style={styles.header}>
          <Text style={styles.brand}>GallaSahi</Text>
          <Text style={styles.stepIndicator}>Step {step} of 4</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* STEP 1: LANGUAGE SELECTION */}
          {step === 1 && (
            <View>
              <Text style={styles.heading}>अपनी भाषा चुनें</Text>
              <Text style={styles.subheading}>Select your comfortable language for audio & text</Text>

              {languages.map((l) => {
                const isSelected = selectedLang === l.id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.optionCard, isSelected && styles.selectedCard]}
                    onPress={() => setSelectedLang(l.id)}
                  >
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={[styles.cardTitle, isSelected && styles.selectedText]}>{l.label}</Text>
                        <Text style={styles.cardSub}>{l.sub}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={24}
                        color={isSelected ? '#10b981' : '#64748b'}
                      />
                    </View>
                    {isSelected && (
                      <View style={styles.audioPreview}>
                        <Ionicons name="volume-medium" size={18} color="#34d399" />
                        <Text style={styles.audioText}>{l.greeting}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* STEP 2: STALL ARCHETYPE PRESET */}
          {step === 2 && (
            <View>
              <Text style={styles.heading}>आपका ठेला / दुकान क्या है?</Text>
              <Text style={styles.subheading}>Choose your stall type to auto-load raw ingredient recipes</Text>

              {stallTypes.map((s) => {
                const isSelected = selectedStall === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.optionCard, isSelected && styles.selectedCard]}
                    onPress={() => setSelectedStall(s.id)}
                  >
                    <View style={styles.row}>
                      <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                        <MaterialCommunityIcons
                          name={s.icon as any}
                          size={28}
                          color={isSelected ? '#10b981' : '#94a3b8'}
                        />
                      </View>
                      <View style={styles.flex1}>
                        <Text style={[styles.cardTitle, isSelected && styles.selectedText]}>{s.title}</Text>
                        <Text style={styles.cardSub}>{s.en}</Text>
                        <Text style={styles.itemsHint}>Auto-BOM: {s.items}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* STEP 3: 3-DEVICE FAMILY ROLE SETUP */}
          {step === 3 && (
            <View>
              <Text style={styles.heading}>परिवार में कौन चलाता है?</Text>
              <Text style={styles.subheading}>Setup your 3-device family network for offline Bluetooth sync</Text>

              {familyRoles.map((r) => {
                const isSelected = selectedRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.optionCard, isSelected && styles.selectedCard]}
                    onPress={() => setSelectedRole(r.id)}
                  >
                    <View style={styles.row}>
                      <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                        <MaterialCommunityIcons
                          name={r.icon as any}
                          size={28}
                          color={isSelected ? '#10b981' : '#94a3b8'}
                        />
                      </View>
                      <View style={styles.flex1}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.cardTitle, isSelected && styles.selectedText]}>{r.title}</Text>
                          <Text style={styles.roleBadge}>{r.badge}</Text>
                        </View>
                        <Text style={styles.cardSub}>{r.desc}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* STEP 4: OPENING CASH & ZERO-TAX TRUST PLEDGE */}
          {step === 4 && (
            <View>
              <Text style={styles.heading}>गल्ले में आज सुबह कितना कैश है?</Text>
              <Text style={styles.subheading}>Starting drawer change for cash reconciliation</Text>

              <View style={styles.cashDisplay}>
                <Text style={styles.cashCurrency}>₹</Text>
                <Text style={styles.cashNumber}>{openingCash}</Text>
              </View>

              <View style={styles.chipsRow}>
                {[200, 500, 1000, 2000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.chip, openingCash === amt && styles.chipActive]}
                    onPress={() => setOpeningCash(amt)}
                  >
                    <Text style={[styles.chipText, openingCash === amt && styles.chipTextActive]}>
                      ₹{amt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Zero-Tax & 100% Offline Trust Card */}
              <View style={styles.trustCard}>
                <View style={styles.row}>
                  <Ionicons name="shield-checkmark" size={32} color="#10b981" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.trustTitle}>100% Offline & Private (सुरक्षित)</Text>
                    <Text style={styles.trustBody}>
                      No bank passwords needed. Zero data sent to tax authorities. All double-entry records
                      stay encrypted on your family phones.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backBtnText}>वापस (Back)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, step === 1 && { flex: 1 }]}
            onPress={() => {
              if (step < 4) {
                setStep(step + 1);
              } else {
                handleFinish();
              }
            }}
          >
            <Text style={styles.nextBtnText}>
              {step === 4 ? 'गल्ला शुरू करें (Start Galla)' : 'आगे बढ़ें (Next)'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16'
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brand: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  stepIndicator: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600'
  },
  scroll: {
    padding: 20
  },
  heading: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6
  },
  subheading: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18
  },
  optionCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b'
  },
  selectedCard: {
    borderColor: '#10b981',
    backgroundColor: '#062d22'
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  iconBoxActive: {
    backgroundColor: '#064e3b'
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700'
  },
  selectedText: {
    color: '#34d399'
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2
  },
  itemsHint: {
    color: '#38bdf8',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500'
  },
  audioPreview: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#064e3b',
    flexDirection: 'row',
    alignItems: 'center'
  },
  audioText: {
    color: '#34d399',
    fontSize: 12,
    marginLeft: 6,
    fontStyle: 'italic'
  },
  roleBadge: {
    backgroundColor: '#0f766e',
    color: '#ccfbf1',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  cashDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#131b2e',
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
    marginBottom: 16
  },
  cashCurrency: {
    color: '#34d399',
    fontSize: 32,
    fontWeight: '700',
    marginRight: 6
  },
  cashNumber: {
    color: '#f8fafc',
    fontSize: 44,
    fontWeight: '800'
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  chipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700'
  },
  chipTextActive: {
    color: '#fff'
  },
  trustCard: {
    backgroundColor: '#042f2e',
    borderColor: '#0d9488',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16
  },
  trustTitle: {
    color: '#2dd4bf',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  trustBody: {
    color: '#ccfbf1',
    fontSize: 12,
    lineHeight: 17
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
    backgroundColor: '#090d16'
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    marginRight: 10,
    justifyContent: 'center'
  },
  backBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14
  },
  nextBtn: {
    flex: 2,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  nextBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  }
});
