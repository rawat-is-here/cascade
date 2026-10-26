import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CommodityItem {
  id: string;
  name: string;
  hindiName: string;
  unit: string;
  morningStock: number;
  inferredBurn: number;
  attributedLoss: number;
  currentLatentStock: number;
  ratePerUnit: number;
  dishes: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  language?: 'en' | 'hi';
  lossCommodity: string;
  rotLoss: number;
  familyLunch: number;
  theftLoss: number;
  lossTotalKg: number;
  onOpenLossModal: () => void;
  onOpenMorningStock: () => void;
}

const COMMODITIES: CommodityItem[] = [
  {
    id: 'aloo',
    name: 'Aloo (Potato)',
    hindiName: 'आलू',
    unit: 'kg',
    morningStock: 25.0,
    inferredBurn: 14.5,
    attributedLoss: 1.5,
    currentLatentStock: 9.0,
    ratePerUnit: 18,
    dishes: ['Poha (35g)', 'Samosa (65g)']
  },
  {
    id: 'tamatar',
    name: 'Tamatar (Tomato)',
    hindiName: 'टमाटर',
    unit: 'kg',
    morningStock: 15.0,
    inferredBurn: 8.5,
    attributedLoss: 3.5,
    currentLatentStock: 3.0,
    ratePerUnit: 30,
    dishes: ['Chutney', 'Poha Garnish']
  },
  {
    id: 'poha',
    name: 'Poha Grain',
    hindiName: 'पोहा दाना',
    unit: 'kg',
    morningStock: 10.0,
    inferredBurn: 6.8,
    attributedLoss: 0.2,
    currentLatentStock: 3.0,
    ratePerUnit: 45,
    dishes: ['Poha Plate (110g)']
  },
  {
    id: 'pyaz',
    name: 'Pyaz (Onion)',
    hindiName: 'प्याज़',
    unit: 'kg',
    morningStock: 12.0,
    inferredBurn: 7.2,
    attributedLoss: 1.8,
    currentLatentStock: 3.0,
    ratePerUnit: 26,
    dishes: ['Poha (25g)', 'Kachumber']
  },
  {
    id: 'doodh',
    name: 'Doodh (Milk)',
    hindiName: 'दूध',
    unit: 'L',
    morningStock: 8.0,
    inferredBurn: 5.5,
    attributedLoss: 0.5,
    currentLatentStock: 2.0,
    ratePerUnit: 60,
    dishes: ['Chai (100ml)']
  }
];

export const LatentInventoryModal: React.FC<Props> = ({
  visible,
  onClose,
  language = 'en',
  lossCommodity,
  rotLoss,
  familyLunch,
  theftLoss,
  lossTotalKg,
  onOpenLossModal,
  onOpenMorningStock
}) => {
  const isHi = language === 'hi';

  const totalPrepValue = COMMODITIES.reduce(
    (acc, c) => acc + c.currentLatentStock * c.ratePerUnit,
    0
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <View style={styles.iconCircle}>
                  <Ionicons name="cube" size={22} color="#073B3A" />
                </View>
                <View>
                  <Text style={styles.title}>
                    {isHi ? 'कच्चा माल व तैयारी' : 'Latent Stock & Prep'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {isHi ? 'किचन में बची सामग्री और खपत' : 'Inferred portion burn & shelf stock'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Valuation Summary Card */}
            <View style={styles.valuationCard}>
              <View style={styles.valuationHeader}>
                <Text style={styles.valuationLabel}>
                  {isHi ? 'दुकान में बचे माल का अनुमानित मूल्य' : 'ESTIMATED SHELF STOCK VALUE'}
                </Text>
                <TouchableOpacity
                  style={styles.addStockAction}
                  onPress={() => {
                    onClose();
                    onOpenMorningStock();
                  }}
                >
                  <Ionicons name="add-circle" size={16} color="#073B3A" style={{ marginRight: 4 }} />
                  <Text style={styles.addStockText}>{isHi ? 'बिल जोड़ें' : 'Add Bill'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.valuationAmount}>₹{Math.round(totalPrepValue).toLocaleString('en-IN')}</Text>
              <Text style={styles.valuationSub}>
                {isHi
                  ? 'मंडी थोक भाव पर आधारित। बिक्री के आधार पर खपत की गणना।'
                  : 'Based on wholesale Mandi cost basis. Quantities are deduced from sales.'}
              </Text>
            </View>

            {/* Section: Live Latent Stock Items */}
            <Text style={styles.sectionHeading}>
              {isHi ? 'दुकान में मौजूद कच्चा माल' : 'Live Produce on Hand'}
            </Text>
            <View style={styles.commodityList}>
              {COMMODITIES.map(item => {
                const percent = Math.min(
                  100,
                  Math.round((item.currentLatentStock / item.morningStock) * 100)
                );
                const isLow = percent <= 25;

                return (
                  <View key={item.id} style={styles.commodityCard}>
                    <View style={styles.cardTopRow}>
                      <View>
                        <Text style={styles.commodityName}>
                          {isHi ? `${item.hindiName} (${item.name.split(' ')[0]})` : item.name}
                        </Text>
                        <Text style={styles.wholesaleText}>
                          ₹{item.ratePerUnit}/{item.unit} {isHi ? 'थोक भाव' : 'wholesale basis'}
                        </Text>
                      </View>
                      <View style={[styles.stockPill, isLow && styles.stockPillLow]}>
                        <Text style={[styles.stockPillText, isLow && styles.stockPillTextLow]}>
                          {item.currentLatentStock} {item.unit} {isHi ? 'बचा' : 'left'}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressRow}>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${percent}%` },
                            isLow && { backgroundColor: '#EF4444' }
                          ]}
                        />
                      </View>
                      <Text style={styles.percentText}>{percent}%</Text>
                    </View>

                    {/* Burn & Loss Footnote */}
                    <View style={styles.footnoteRow}>
                      <Text style={styles.footnoteItem}>
                        {isHi ? 'बिक्री में खपत:' : 'Burned in sales:'} <Text style={styles.footnoteBold}>-{item.inferredBurn} {item.unit}</Text>
                      </Text>
                      <Text style={styles.footnoteItem}>
                        {isHi ? 'खराबी / नुकसान:' : 'Loss/Rot:'} <Text style={styles.footnoteBoldLoss}>-{item.attributedLoss} {item.unit}</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Section: Inferred Recipe Portions */}
            <Text style={styles.sectionHeading}>
              {isHi ? 'व्यंजन सामग्री अनुपात (बिना BOM)' : 'Inferred Recipe Proportions'}
            </Text>
            <Text style={styles.sectionSub}>
              {isHi ? 'प्रति प्लेट अनुमानित सामग्री खपत:' : 'Deduced per plate without a manual Bill of Materials:'}
            </Text>

            <View style={styles.recipeCard}>
              <View style={styles.recipeRow}>
                <View style={styles.recipeIconBox}>
                  <Ionicons name="restaurant-outline" size={16} color="#073B3A" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.recipeTitle}>{isHi ? 'प्लेट पोहा' : 'Plate Poha'}</Text>
                  <Text style={styles.recipeDesc}>
                    {isHi ? '110g पोहा दाना, 35g आलू, 25g प्याज़' : '110g Poha grain, 35g Potato, 25g Onion'}
                  </Text>
                </View>
                <View style={styles.costBadge}>
                  <Text style={styles.costBadgeText}>
                    {isHi ? 'लागत: ₹5.20' : 'COGS: ₹5.20'}
                  </Text>
                </View>
              </View>

              <View style={[styles.recipeRow, { marginTop: 12 }]}>
                <View style={styles.recipeIconBox}>
                  <Ionicons name="cafe-outline" size={16} color="#073B3A" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.recipeTitle}>{isHi ? 'कप चाय' : 'Cup Chai'}</Text>
                  <Text style={styles.recipeDesc}>
                    {isHi ? '100ml दूध, 12g चीनी, 5g चायपत्ती' : '100ml Milk, 12g Sugar, 5g Tea leaves'}
                  </Text>
                </View>
                <View style={styles.costBadge}>
                  <Text style={styles.costBadgeText}>
                    {isHi ? 'लागत: ₹3.80' : 'COGS: ₹3.80'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Section: Losing Stock Attribution */}
            <View style={styles.lossCard}>
              <View style={styles.lossCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lossCardTitle}>
                    {isHi ? 'बिना बिका नुकसान विश्लेषण' : 'Unrecorded Stock Loss Attribution'}
                  </Text>
                  <Text style={styles.lossCardSub}>
                    {lossTotalKg} kg {lossCommodity} {isHi ? 'पर्यावरणीय मॉडल द्वारा विभाजित' : 'split via Environmental Model'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.lossAdjustBtn}
                  onPress={() => {
                    onClose();
                    onOpenLossModal();
                  }}
                >
                  <Text style={styles.lossAdjustBtnText}>{isHi ? 'बदलें' : 'Adjust'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.lossBar}>
                <View style={[styles.lossBarSegment, { flex: rotLoss, backgroundColor: '#EF4444' }]} />
                <View style={[styles.lossBarSegment, { flex: familyLunch, backgroundColor: '#F59E0B' }]} />
                <View style={[styles.lossBarSegment, { flex: theftLoss, backgroundColor: '#6B7280' }]} />
              </View>

              <View style={styles.lossLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>{isHi ? 'गर्मी/सड़न:' : 'Rot:'} {rotLoss}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>{isHi ? 'घर का खाना:' : 'Lunch:'} {familyLunch}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#6B7280' }]} />
                  <Text style={styles.legendText}>{isHi ? 'चोरी/गिरावट:' : 'Theft:'} {theftLoss}%</Text>
                </View>
              </View>
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },

  /* VALUATION CARD */
  valuationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginBottom: 18,
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  valuationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valuationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6E827D',
    letterSpacing: 0.6,
  },
  addStockAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2FD52',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  addStockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073B3A',
  },
  valuationAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#073B3A',
    marginTop: 6,
  },
  valuationSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 16,
  },

  /* SECTION HEADINGS */
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 10,
  },
  sectionSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: -6,
    marginBottom: 12,
  },

  /* COMMODITY CARDS */
  commodityList: {
    gap: 10,
    marginBottom: 18,
  },
  commodityCard: {
    backgroundColor: '#FAFCFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5EFEA',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  commodityName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073B3A',
  },
  wholesaleText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  stockPill: {
    backgroundColor: '#F1FFE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stockPillLow: {
    backgroundColor: '#FEE2E2',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#275200',
  },
  stockPillTextLow: {
    color: '#B91C1C',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 7,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6E827D',
    width: 32,
    textAlign: 'right',
  },
  footnoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEF4F1',
  },
  footnoteItem: {
    fontSize: 10,
    color: '#6B7280',
  },
  footnoteBold: {
    fontWeight: '700',
    color: '#073B3A',
  },
  footnoteBoldLoss: {
    fontWeight: '700',
    color: '#DC2626',
  },

  /* RECIPE CARD */
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginBottom: 18,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
  },
  recipeDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  costBadge: {
    backgroundColor: '#F1FFE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  costBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#275200',
  },

  /* LOSS CARD */
  lossCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DDECE7',
  },
  lossCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lossCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
  },
  lossCardSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  lossAdjustBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  lossAdjustBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#073B3A',
  },
  lossBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  lossBarSegment: {
    height: '100%',
  },
  lossLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '600',
  },
});
