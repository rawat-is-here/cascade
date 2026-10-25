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
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export interface MenuItem {
  id: string;
  name: string;
  hindiName: string;
  price: number;
  estimatedCost: number;
  marginPercent: number;
  rawIngredients: string;
  available: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaveMenu: (items: MenuItem[]) => void;
  initialItems?: MenuItem[];
}

const DEFAULT_MENU: MenuItem[] = [
  {
    id: 'm1',
    name: 'Cutting Chai',
    hindiName: 'कटिंग चाय',
    price: 10,
    estimatedCost: 4.2,
    marginPercent: 58,
    rawIngredients: 'Milk (100ml), Sugar (15g), Chai Patti (5g)',
    available: true
  },
  {
    id: 'm2',
    name: 'Masala Chai (Special)',
    hindiName: 'मसाला स्पेशल चाय',
    price: 15,
    estimatedCost: 6.0,
    marginPercent: 60,
    rawIngredients: 'Full Cream Milk, Elaichi, Adrak, Chai Patti',
    available: true
  },
  {
    id: 'm3',
    name: 'Poha (Full Plate)',
    hindiName: 'पोहा (फुल प्लेट)',
    price: 25,
    estimatedCost: 11.5,
    marginPercent: 54,
    rawIngredients: 'Poha (120g), Pyaaz (40g), Tel (20ml), Peanuts, Sev',
    available: true
  },
  {
    id: 'm4',
    name: 'Garam Samosa (2 pcs)',
    hindiName: 'गरम समोसा (२ पीस)',
    price: 20,
    estimatedCost: 9.8,
    marginPercent: 51,
    rawIngredients: 'Maida, Aloo (150g), Tel for frying, Masala',
    available: true
  },
  {
    id: 'm5',
    name: 'Bun Maska',
    hindiName: 'बन मस्का',
    price: 20,
    estimatedCost: 8.5,
    marginPercent: 57,
    rawIngredients: 'Bakery Bun, Amul Butter (25g)',
    available: true
  }
];

export const MenuBuilderModal: React.FC<Props> = ({
  visible,
  onClose,
  onSaveMenu,
  initialItems = DEFAULT_MENU
}) => {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<'view' | 'camera' | 'voice'>('view');
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedVoiceText, setCapturedVoiceText] = useState('');
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');

  // Option C: Simulate Photo Snap of the handwritten / painted thela board
  const handleSimulateBoardOCR = () => {
    setIsProcessing(true);
    setOcrSuccessMsg('');
    setTimeout(() => {
      const extracted: MenuItem[] = [
        ...items,
        {
          id: `m_${Date.now()}_1`,
          name: 'Bread Pakoda',
          hindiName: 'ब्रेड पकोड़ा',
          price: 15,
          estimatedCost: 7.2,
          marginPercent: 52,
          rawIngredients: 'Bread (2 slices), Besan, Aloo, Tel',
          available: true
        },
        {
          id: `m_${Date.now()}_2`,
          name: 'Filter Coffee',
          hindiName: 'फ़िल्टर कॉफ़ी',
          price: 20,
          estimatedCost: 8.0,
          marginPercent: 60,
          rawIngredients: 'Milk, Coffee powder, Sugar',
          available: true
        }
      ];
      setItems(extracted);
      setIsProcessing(false);
      setOcrSuccessMsg('बोर्ड से २ नए आइटम पकड़े गए: ब्रेड पकोड़ा (₹15) और कॉफ़ी (₹20)!');
      setActiveTab('view');
    }, 1500);
  };

  // Option B: Simulate Voice Menu creation
  const handleSimulateVoiceMenu = () => {
    setIsProcessing(true);
    setCapturedVoiceText('कटिंग चाय दस की, पोहा पच्चीस का, और कचौरी बारह रुपए की कर दो');
    setTimeout(() => {
      const updated = items.map((it) => {
        if (it.name.toLowerCase().includes('chai')) return { ...it, price: 10 };
        if (it.name.toLowerCase().includes('poha')) return { ...it, price: 25 };
        return it;
      });
      // Add Kachori
      updated.push({
        id: `m_${Date.now()}_3`,
        name: 'Dal Kachori',
        hindiName: 'दाल कचौरी',
        price: 12,
        estimatedCost: 5.5,
        marginPercent: 54,
        rawIngredients: 'Maida, Moong Dal, Masala, Tel',
        available: true
      });
      setItems(updated);
      setIsProcessing(false);
      setOcrSuccessMsg('आवाज़ से मेनू अपडेट हुआ: कचौरी (₹12) जुड़ी और चाय ₹10 सेट!');
      setActiveTab('view');
    }, 1500);
  };

  const updatePrice = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const newPrice = Math.max(5, it.price + delta);
          const margin = Math.round(((newPrice - it.estimatedCost) / newPrice) * 100);
          return { ...it, price: newPrice, marginPercent: margin };
        }
        return it;
      })
    );
  };

  const toggleAvailability = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, available: !it.available } : it))
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>दुकान का मेनू & सही दाम</Text>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              onSaveMenu(items);
              onClose();
            }}
          >
            <Text style={styles.saveBtnText}>सेव करें</Text>
          </TouchableOpacity>
        </View>

        {/* Action Tabs: View vs Camera Snap vs Voice */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'view' && styles.tabItemActive]}
            onPress={() => setActiveTab('view')}
          >
            <MaterialCommunityIcons
              name="book-open-outline"
              size={18}
              color={activeTab === 'view' ? '#10b981' : '#94a3b8'}
            />
            <Text style={[styles.tabText, activeTab === 'view' && styles.tabTextActive]}>
              मेनू लिस्ट ({items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'camera' && styles.tabItemActive]}
            onPress={() => setActiveTab('camera')}
          >
            <Ionicons
              name="camera-outline"
              size={18}
              color={activeTab === 'camera' ? '#10b981' : '#94a3b8'}
            />
            <Text style={[styles.tabText, activeTab === 'camera' && styles.tabTextActive]}>
              बोर्ड फ़ोटो खींचें
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'voice' && styles.tabItemActive]}
            onPress={() => setActiveTab('voice')}
          >
            <Ionicons
              name="mic-outline"
              size={18}
              color={activeTab === 'voice' ? '#10b981' : '#94a3b8'}
            />
            <Text style={[styles.tabText, activeTab === 'voice' && styles.tabTextActive]}>
              बोल कर बनाएँ
            </Text>
          </TouchableOpacity>
        </View>

        {ocrSuccessMsg !== '' && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.successBannerText}>{ocrSuccessMsg}</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* TAB 1: MENU LIST WITH SAHI DAAM ESTIMATES */}
          {activeTab === 'view' && (
            <View>
              <View style={styles.sahiDaamInfoBox}>
                <Ionicons name="calculator-outline" size={22} color="#34d399" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.sahiDaamTitle}>"सही दाम" मार्जिन एडवाइजर</Text>
                  <Text style={styles.sahiDaamDesc}>
                    कच्चे माल (दूध, तेल, सब्ज़ी) की लागत के हिसाब से आपका असली मुनाफ़ा खुद कैलकुलेट होता है।
                  </Text>
                </View>
              </View>

              {items.map((item) => (
                <View
                  key={item.id}
                  style={[styles.menuCard, !item.available && styles.cardUnavailable]}
                >
                  <View style={styles.menuCardTop}>
                    <View style={styles.flex1}>
                      <View style={styles.row}>
                        <Text style={styles.itemNameHindi}>{item.hindiName}</Text>
                        {!item.available && (
                          <Text style={styles.soldOutBadge}>ख़त्म (Sold Out)</Text>
                        )}
                      </View>
                      <Text style={styles.itemNameEn}>{item.name}</Text>
                      <Text style={styles.ingredients}>सामग्री: {item.rawIngredients}</Text>
                    </View>

                    {/* Price with + and - */}
                    <View style={styles.priceCounter}>
                      <TouchableOpacity
                        style={styles.priceBtn}
                        onPress={() => updatePrice(item.id, -1)}
                      >
                        <Text style={styles.priceBtnTxt}>–</Text>
                      </TouchableOpacity>
                      <Text style={styles.priceText}>₹{item.price}</Text>
                      <TouchableOpacity
                        style={styles.priceBtn}
                        onPress={() => updatePrice(item.id, +1)}
                      >
                        <Text style={styles.priceBtnTxt}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sahi Daam Margin Bar */}
                  <View style={styles.marginRow}>
                    <View style={styles.row}>
                      <Text style={styles.costLabel}>लागत: </Text>
                      <Text style={styles.costVal}>~₹{item.estimatedCost.toFixed(1)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.marginLabel}>मुनाफ़ा प्रति प्लेट: </Text>
                      <Text style={styles.marginVal}>
                        +₹{(item.price - item.estimatedCost).toFixed(1)} ({item.marginPercent}%)
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleAvailability(item.id)}
                      style={[
                        styles.toggleBtn,
                        item.available ? styles.toggleOn : styles.toggleOff
                      ]}
                    >
                      <Text style={styles.toggleTxt}>
                        {item.available ? 'उपलब्ध' : 'बंद'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: OPTION C — PHOTO SNAP OF BOARD */}
          {activeTab === 'camera' && (
            <View style={styles.ocrContainer}>
              <View style={styles.viewfinderBox}>
                <Ionicons name="camera" size={54} color="#38bdf8" />
                <Text style={styles.viewfinderTitle}>ठेले के बोर्ड या पर्ची की फ़ोटो लें</Text>
                <Text style={styles.viewfinderSub}>
                  हाथ से लिखा हुआ टीन का बोर्ड या रेट लिस्ट फ़्रेम में रखें। AI अपने आप सारे आइटम और भाव निकाल लेगा।
                </Text>

                {isProcessing ? (
                  <View style={{ alignItems: 'center', marginTop: 20 }}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.procText}>बोर्ड से आइटम स्कैन हो रहे हैं...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.captureBtn}
                    onPress={handleSimulateBoardOCR}
                  >
                    <Ionicons name="scan-circle" size={24} color="#fff" />
                    <Text style={styles.captureBtnText}>फ़ोटो स्कैन करें (Simulate OCR)</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.ocrTips}>
                <Text style={styles.tipsHeading}>💡 वेंडर टिप्स:</Text>
                <Text style={styles.tipsText}>• बोर्ड पर अगर दाम कटे या बदले हैं, तो भी AI नया भाव समझ लेगा।</Text>
                <Text style={styles.tipsText}>• हिंदी, मराठी, इंग्लिश किसी भी भाषा का बोर्ड स्कैन हो जाएगा।</Text>
              </View>
            </View>
          )}

          {/* TAB 3: OPTION B — VOICE MENU CREATION */}
          {activeTab === 'voice' && (
            <View style={styles.ocrContainer}>
              <View style={styles.voiceMicBox}>
                <View style={styles.micCircle}>
                  <Ionicons name="mic" size={48} color="#fff" />
                </View>
                <Text style={styles.viewfinderTitle}>बोल कर मेनू सेट करें</Text>
                <Text style={styles.viewfinderSub}>
                  माइक दबाकर सीधे बोलें: जैसे "कटिंग चाय 10 की, समोसा 15 का, और पोहा 25 रुपए का"
                </Text>

                {isProcessing ? (
                  <View style={{ alignItems: 'center', marginTop: 20 }}>
                    <ActivityIndicator size="large" color="#38bdf8" />
                    <Text style={styles.procText}>आवाज़ प्रोसेस हो रही है...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.captureBtn, { backgroundColor: '#0284c7' }]}
                    onPress={handleSimulateVoiceMenu}
                  >
                    <Ionicons name="mic" size={24} color="#fff" />
                    <Text style={styles.captureBtnText}>बोलना शुरू करें (Simulate Voice)</Text>
                  </TouchableOpacity>
                )}

                {capturedVoiceText !== '' && (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>सुनी गई आवाज़:</Text>
                    <Text style={styles.transcriptText}>"{capturedVoiceText}"</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  closeBtn: {
    padding: 6
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700'
  },
  saveBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a'
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabItemActive: {
    borderBottomColor: '#10b981',
    backgroundColor: '#131f2e'
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6
  },
  tabTextActive: {
    color: '#34d399'
  },
  successBanner: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  successBannerText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1
  },
  scroll: {
    padding: 16
  },
  sahiDaamInfoBox: {
    backgroundColor: '#062d22',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  sahiDaamTitle: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '700'
  },
  sahiDaamDesc: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16
  },
  menuCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b'
  },
  cardUnavailable: {
    opacity: 0.6,
    borderColor: '#475569'
  },
  menuCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  flex1: {
    flex: 1
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  itemNameHindi: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700'
  },
  itemNameEn: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 1
  },
  soldOutBadge: {
    backgroundColor: '#7f1d1d',
    color: '#fecaca',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8
  },
  ingredients: {
    color: '#38bdf8',
    fontSize: 11,
    marginTop: 4
  },
  priceCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090d16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 10
  },
  priceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  priceBtnTxt: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '700'
  },
  priceText: {
    color: '#34d399',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 6
  },
  marginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  costLabel: {
    color: '#94a3b8',
    fontSize: 11
  },
  costVal: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600'
  },
  marginLabel: {
    color: '#94a3b8',
    fontSize: 11
  },
  marginVal: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700'
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  toggleOn: {
    backgroundColor: '#064e3b'
  },
  toggleOff: {
    backgroundColor: '#334155'
  },
  toggleTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700'
  },
  ocrContainer: {
    alignItems: 'center',
    paddingTop: 16
  },
  viewfinderBox: {
    width: '100%',
    backgroundColor: '#131b2e',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#38bdf8',
    padding: 24,
    alignItems: 'center'
  },
  voiceMicBox: {
    width: '100%',
    backgroundColor: '#131b2e',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#0284c7',
    padding: 24,
    alignItems: 'center'
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  viewfinderTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center'
  },
  viewfinderSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18
  },
  captureBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20
  },
  captureBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8
  },
  procText: {
    color: '#34d399',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600'
  },
  ocrTips: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
    width: '100%'
  },
  tipsHeading: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  },
  tipsText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
    marginVertical: 2
  },
  transcriptBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8'
  },
  transcriptLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4
  },
  transcriptText: {
    color: '#38bdf8',
    fontSize: 13,
    fontStyle: 'italic'
  }
});
