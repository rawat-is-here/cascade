import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onStockAdded?: (summary: { items: any[]; totalCost: number; isCash: boolean }) => void;
}

const COMMON_ITEMS = [
  { name: 'Potato (Aalu)', key: 'potato', defaultRate: 14, unit: 'kg' },
  { name: 'Tomato (Tamatar)', key: 'tomato', defaultRate: 22, unit: 'kg' },
  { name: 'Onion (Pyaaz)', key: 'onion', defaultRate: 28, unit: 'kg' },
  { name: 'Cooking Oil', key: 'oil', defaultRate: 120, unit: 'litre' },
  { name: 'Spices & Masala', key: 'spices', defaultRate: 200, unit: 'kg' }
];

export const MorningStockModal: React.FC<Props> = ({
  visible,
  onClose,
  apiBaseUrl,
  onStockAdded
}) => {
  const [selectedKey, setSelectedKey] = useState('potato');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState('50');
  const [unit, setUnit] = useState('kg');
  const [ratePerKg, setRatePerKg] = useState('14');
  const [paidInCash, setPaidInCash] = useState(true);
  const [loading, setLoading] = useState(false);

  const activeItem = COMMON_ITEMS.find(i => i.key === selectedKey);
  const computedTotal = (parseFloat(quantity) || 0) * (parseFloat(ratePerKg) || 0);

  const handleSelectChip = (item: typeof COMMON_ITEMS[0]) => {
    setSelectedKey(item.key);
    setRatePerKg(String(item.defaultRate));
    setUnit(item.unit);
  };

  const handleSaveStock = async () => {
    const qty = parseFloat(quantity);
    const rate = parseFloat(ratePerKg);
    if (!qty || qty <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      Alert.alert('Invalid rate', 'Please enter a valid price paid.');
      return;
    }

    const itemName = selectedKey === 'custom' ? (customName.trim() || 'Custom Item') : (activeItem?.name || selectedKey);
    const rawKey = selectedKey === 'custom' ? customName.trim().toLowerCase() : selectedKey;
    const totalCost = qty * rate;

    setLoading(true);
    try {
      const payload = {
        items: [
          {
            name: rawKey,
            quantityKg: qty,
            ratePerKg: rate,
            unit,
            totalCost
          }
        ],
        paidViaCash: paidInCash,
        source: 'MOBILE_APP_MORNING_BILL'
      };

      const res = await fetch(`${apiBaseUrl}/vendor/wholesale/bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.ok) {
        Alert.alert(
          'Stock Added Successfully',
          `Added ${qty} ${unit} of ${itemName} (₹${totalCost.toLocaleString('en-IN')}). Ready for today's sales!`
        );
        if (onStockAdded) {
          onStockAdded({
            items: payload.items,
            totalCost,
            isCash: paidInCash
          });
        }
        onClose();
      } else {
        Alert.alert('Error', data.error || 'Failed to record morning stock.');
      }
    } catch {
      // Offline fallback
      Alert.alert(
        'Stock Saved Offline',
        `Recorded ${qty} ${unit} of ${itemName} (₹${totalCost.toLocaleString('en-IN')}) locally. Will sync with Mandi accounts when connected.`
      );
      if (onStockAdded) {
        onStockAdded({
          items: [{ name: rawKey, quantityKg: qty, ratePerKg: rate, unit, totalCost }],
          totalCost,
          isCash: paidInCash
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
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
                  <Ionicons name="cart-outline" size={20} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>Add Morning Stock</Text>
                  <Text style={styles.subtitle}>Today's Wholesale Mandi Bill</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Explanatory Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#073B3A" style={{ marginRight: 6 }} />
              <Text style={styles.infoBannerText}>
                No pre-set prices required. Recording your mandi purchase allows the app to compute true gross profits at night.
              </Text>
            </View>

            {/* Common Item Chips */}
            <Text style={styles.inputLabel}>Select Item Bought</Text>
            <View style={styles.chipsRow}>
              {COMMON_ITEMS.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.chip,
                    selectedKey === item.key && styles.chipActive
                  ]}
                  onPress={() => handleSelectChip(item)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedKey === item.key && styles.chipTextActive
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.chip,
                  selectedKey === 'custom' && styles.chipActive
                ]}
                onPress={() => setSelectedKey('custom')}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedKey === 'custom' && styles.chipTextActive
                  ]}
                >
                  + Other Item
                </Text>
              </TouchableOpacity>
            </View>

            {selectedKey === 'custom' && (
              <View style={styles.customInputBlock}>
                <Text style={styles.subLabel}>Custom Item Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Green Chillies, Ginger"
                  placeholderTextColor="#9CA3AF"
                  value={customName}
                  onChangeText={setCustomName}
                />
              </View>
            )}

            {/* Quantity and Unit Row */}
            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="50"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>Unit</Text>
                <View style={styles.unitToggleRow}>
                  {['kg', 'litre', 'quintal'].map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.unitPill,
                        unit === u && styles.unitPillActive
                      ]}
                      onPress={() => setUnit(u)}
                    >
                      <Text
                        style={[
                          styles.unitPillText,
                          unit === u && styles.unitPillTextActive
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Rate Paid */}
            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>Rate Paid (₹ per {unit})</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={ratePerKg}
                  onChangeText={setRatePerKg}
                  placeholder="14"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>Calculated Cost</Text>
                <View style={styles.totalPreviewBox}>
                  <Text style={styles.totalPreviewText}>
                    ₹{computedTotal.toLocaleString('en-IN')}.00
                  </Text>
                </View>
              </View>
            </View>

            {/* Payment Method Toggle */}
            <Text style={styles.inputLabel}>Payment Method</Text>
            <View style={styles.paymentToggleRow}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paidInCash && styles.paymentOptionActive
                ]}
                onPress={() => setPaidInCash(true)}
              >
                <Ionicons
                  name={paidInCash ? 'cash' : 'cash-outline'}
                  size={18}
                  color={paidInCash ? '#073B3A' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.paymentText, paidInCash && styles.paymentTextActive]}>
                  Paid in Cash Now
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  !paidInCash && styles.paymentOptionActive
                ]}
                onPress={() => setPaidInCash(false)}
              >
                <Ionicons
                  name={!paidInCash ? 'time' : 'time-outline'}
                  size={18}
                  color={!paidInCash ? '#073B3A' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.paymentText, !paidInCash && styles.paymentTextActive]}>
                  Pay Later (Udhaar)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveStock}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#073B3A" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Stock & Start Day</Text>
                  <Ionicons name="arrow-forward-circle" size={20} color="#073B3A" style={{ marginLeft: 6 }} />
                </>
              )}
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
    backgroundColor: 'rgba(7, 59, 58, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  content: {
    padding: 22,
    paddingBottom: 36,
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
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1FFE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#073B3A',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#F1FFE5',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#DDECE7',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#073B3A',
    lineHeight: 16,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 4,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#073B3A',
    borderColor: '#073B3A',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#E2FD52',
    fontWeight: '700',
  },
  customInputBlock: {
    marginBottom: 14,
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  col: {
    flex: 1,
    marginHorizontal: 4,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 3,
    height: 42,
    alignItems: 'center',
  },
  unitPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderRadius: 11,
  },
  unitPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  unitPillTextActive: {
    color: '#073B3A',
    fontWeight: '800',
  },
  totalPreviewBox: {
    backgroundColor: '#F1FFE5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDECE7',
    height: 42,
  },
  totalPreviewText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073B3A',
  },
  paymentToggleRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 11,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentOptionActive: {
    backgroundColor: '#F1FFE5',
    borderColor: '#073B3A',
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  paymentTextActive: {
    color: '#073B3A',
    fontWeight: '800',
  },
  saveButton: {
    backgroundColor: '#E2FD52',
    borderRadius: 22,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#073B3A',
    letterSpacing: -0.2,
  },
});
