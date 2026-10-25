import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const SmartRasoiTab: React.FC = () => {
  const [potatoBurn, setPotatoBurn] = useState(5.0); // kg
  const [pohaBurn, setPohaBurn] = useState(2.5); // kg
  const [portionSizeGrams, setPortionSizeGrams] = useState(140); // dynamic portion drift
  const [spoilagePct, setSpoilagePct] = useState(60);
  const [familyMealPct, setFamilyMealPct] = useState(25);
  const [theftPct, setTheftPct] = useState(15);
  const [adjustedMessage, setAdjustedMessage] = useState('');

  // Zero-shot recipe inference: ~140g per plate
  const inferredPlates = Math.round((pohaBurn * 1000) / portionSizeGrams);
  const estimatedRevenue = inferredPlates * 25; // ₹25 per plate
  const potatoCost = potatoBurn * 28; // ₹28/kg
  const pohaCost = pohaBurn * 48; // ₹48/kg

  const handleAdjustWastage = (sp: number, fm: number, th: number, label: string) => {
    setSpoilagePct(sp);
    setFamilyMealPct(fm);
    setTheftPct(th);
    setAdjustedMessage(`नुक़सान विभाजन अपडेट हुआ: ${label}`);
    setTimeout(() => setAdjustedMessage(''), 4000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Recipe Inference Card */}
      <View style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.heroTitle}>जीरो-शॉट रेसिपी अनुमान (Zero-Shot BOM)</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BOM-Free Inference</Text>
          </View>
        </View>
        <Text style={styles.heroSub}>
          बिना वेंडर के डायरी लिखे, केवल जलाए गए कच्चे माल से बिकी हुई प्लेटों का हिसाब।
        </Text>

        <View style={styles.burnGrid}>
          <View style={styles.burnBox}>
            <Text style={styles.burnLabel}>आलू की खपत (Burn)</Text>
            <Text style={styles.burnVal}>{potatoBurn} kg</Text>
            <Text style={styles.burnCost}>~₹{potatoCost} लागत</Text>
          </View>
          <View style={styles.burnBox}>
            <Text style={styles.burnLabel}>पोहा की खपत (Burn)</Text>
            <Text style={styles.burnVal}>{pohaBurn} kg</Text>
            <Text style={styles.burnCost}>~₹{pohaCost} लागत</Text>
          </View>
        </View>

        {/* Dynamic Portion Drift */}
        <View style={styles.portionBox}>
          <View style={styles.rowBetween}>
            <Text style={styles.portionLabel}>गतिशील पोर्शन साइज (Portion Drift):</Text>
            <Text style={styles.portionVal}>~{portionSizeGrams} ग्राम / प्लेट</Text>
          </View>
          <Text style={styles.portionHint}>
            💡 भीड़ के समय (8:30-10 AM) प्लेट थोड़ी हल्की हुई, जिससे कच्चा माल खिंच गया।
          </Text>
        </View>

        <View style={styles.inferredResult}>
          <Ionicons name="sparkles" size={20} color="#34d399" />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.inferredTitle}>
              अनुमानित बिकी प्लेटें: {inferredPlates - 3} से {inferredPlates + 3} प्लेट
            </Text>
            <Text style={styles.inferredSub}>
              संभावित बिक्री आय: ₹{estimatedRevenue - 75} – ₹{estimatedRevenue + 75}
            </Text>
          </View>
        </View>
      </View>

      {/* 3-Way Loss Attribution Card */}
      <View style={styles.lossCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.lossTitle}>नुक़सान विभाजन (3-Way Loss Attribution)</Text>
          <Text style={styles.lossTotal}>३.२ किग्रा गुम माल</Text>
        </View>
        <Text style={styles.lossSub}>
          कच्चे माल में जो कमी आई, वह बेची नहीं गई। संभाव्यता मॉडल इसे तीन कारणों में बाँटता है:
        </Text>

        {/* 3 Bars */}
        <View style={styles.barsContainer}>
          {/* Spoilage */}
          <View style={styles.barItem}>
            <View style={styles.rowBetween}>
              <Text style={styles.barLabel}>🍅 गर्मी / सड़न (Heat Spoilage):</Text>
              <Text style={[styles.barVal, { color: '#f87171' }]}>{spoilagePct}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${spoilagePct}%`, backgroundColor: '#ef4444' }
                ]}
              />
            </View>
          </View>

          {/* Family Meals */}
          <View style={styles.barItem}>
            <View style={styles.rowBetween}>
              <Text style={styles.barLabel}>🍽️ परिवार का भोजन (Family Lunch):</Text>
              <Text style={[styles.barVal, { color: '#fbbf24' }]}>{familyMealPct}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${familyMealPct}%`, backgroundColor: '#f59e0b' }
                ]}
              />
            </View>
          </View>

          {/* Theft / Unaccounted */}
          <View style={styles.barItem}>
            <View style={styles.rowBetween}>
              <Text style={styles.barLabel}>❓ सड़क चोरी / बिखराव (Theft/Waste):</Text>
              <Text style={[styles.barVal, { color: '#38bdf8' }]}>{theftPct}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${theftPct}%`, backgroundColor: '#0284c7' }
                ]}
              />
            </View>
          </View>
        </View>

        {adjustedMessage !== '' && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#34d399" />
            <Text style={styles.feedbackText}>{adjustedMessage}</Text>
          </View>
        )}

        {/* Quick Correction Chips */}
        <Text style={styles.quickLabel}>वेंडर त्वरित सुधार (Quick Real-World Adjustment):</Text>
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={styles.chip}
            onPress={() =>
              handleAdjustWastage(75, 15, 10, 'धूप बहुत तेज़ थी (हाई सड़न 75%)')
            }
          >
            <Text style={styles.chipText}>🔥 आज धूप तेज़ थी</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chip}
            onPress={() =>
              handleAdjustWastage(40, 50, 10, 'बच्चों ने ज़्यादा नाश्ता किया')
            }
          >
            <Text style={styles.chipText}>👨‍👩‍👦 घर में ज़्यादा खाया</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 100
  },
  heroCard: {
    backgroundColor: '#0f172a',
    borderColor: '#0284c7',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroTitle: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '700'
  },
  badge: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeText: {
    color: '#e0f2fe',
    fontSize: 10,
    fontWeight: '700'
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16
  },
  burnGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14
  },
  burnBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4
  },
  burnLabel: {
    color: '#94a3b8',
    fontSize: 11
  },
  burnVal: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2
  },
  burnCost: {
    color: '#f59e0b',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600'
  },
  portionBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginTop: 10
  },
  portionLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600'
  },
  portionVal: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700'
  },
  portionHint: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15
  },
  inferredResult: {
    backgroundColor: '#064e3b',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12
  },
  inferredTitle: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700'
  },
  inferredSub: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 2
  },
  lossCard: {
    backgroundColor: '#181124',
    borderColor: '#9333ea',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16
  },
  lossTitle: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: '700'
  },
  lossTotal: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '700'
  },
  lossSub: {
    color: '#a855f7',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16
  },
  barsContainer: {
    marginTop: 14
  },
  barItem: {
    marginBottom: 12
  },
  barLabel: {
    color: '#e2e8f0',
    fontSize: 12
  },
  barVal: {
    fontSize: 12,
    fontWeight: '700'
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#2e1065',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  feedbackBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  feedbackText: {
    color: '#a7f3d0',
    fontSize: 11,
    marginLeft: 6
  },
  quickLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 10,
    fontWeight: '600'
  },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 8
  },
  chip: {
    backgroundColor: '#3b0764',
    borderColor: '#7e22ce',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8
  },
  chipText: {
    color: '#e9d5ff',
    fontSize: 11,
    fontWeight: '600'
  }
});
