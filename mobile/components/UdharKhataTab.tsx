import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export interface CustomerCredit {
  id: string;
  name: string;
  alias: string;
  phone?: string;
  balanceDue: number;
  lastVisit: string;
  lastItem: string;
}

const INITIAL_CUSTOMERS: CustomerCredit[] = [
  {
    id: 'c1',
    name: 'Sharma Ji',
    alias: 'स्कूटर वाले (Red Bajaj Chetak)',
    phone: '+91 98230 11223',
    balanceDue: 240,
    lastVisit: 'आज दोपहर 2:15 PM',
    lastItem: '4 Plate Poha + 2 Cutting Chai'
  },
  {
    id: 'c2',
    name: 'Ramesh Auto-wala',
    alias: 'ब्लू शर्ट ऑटो (MH-31-AZ-8890)',
    phone: '+91 97654 33445',
    balanceDue: 80,
    lastVisit: 'कल शाम 6:40 PM',
    lastItem: '2 Samosa + Special Chai'
  },
  {
    id: 'c3',
    name: 'Tiwari Electricals',
    alias: 'सामने वाली दुकान वाले भैया',
    phone: '+91 98900 44556',
    balanceDue: 350,
    lastVisit: 'आज सुबह 10:30 AM',
    lastItem: '7 Special Chai (Dukan staff)'
  },
  {
    id: 'c4',
    name: 'Gupta Medical Store',
    alias: 'दवा दुकान वाले गुप्ता जी',
    phone: '+91 99221 55667',
    balanceDue: 120,
    lastVisit: '2 दिन पहले',
    lastItem: 'Bun Maska + 2 Cutting'
  }
];

export const UdharKhataTab: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerCredit[]>(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [settleAmount, setSettleAmount] = useState('40');
  const [successBanner, setSuccessBanner] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.alias.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOutstanding = customers.reduce((sum, c) => sum + c.balanceDue, 0);

  const handleSettle = (id: string, amount: number) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const newBal = Math.max(0, c.balanceDue - amount);
          return { ...c, balanceDue: newBal, lastVisit: 'अभी-अभी जमा हुआ' };
        }
        return c;
      })
    );
    setSuccessBanner(`₹${amount} सफलतापूर्वक जमा हो गया!`);
    setSelectedCustomer(null);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const handleWhatsAppReminder = (c: CustomerCredit) => {
    setSuccessBanner(
      `वॉट्सऐप तकाज़ा तैयार: "नमस्ते ${c.name}, आपका चाय-नाश्ते का ₹${c.balanceDue} बाक़ी है। कृपया गल्ले पर जमा कर दें। धन्यवाद!"`
    );
    setTimeout(() => setSuccessBanner(''), 6000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Total Udhar Card */}
      <View style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.heroLabel}>कुल बाक़ी उधारी (Total Market Udhar)</Text>
            <Text style={styles.heroAmount}>₹{totalOutstanding}</Text>
          </View>
          <View style={styles.udharBadge}>
            <Text style={styles.udharBadgeText}>{customers.length} ग्राहक</Text>
          </View>
        </View>
        <Text style={styles.heroSub}>
          अक्सर यह पैसा गल्ले में नहीं आता, इसलिए यह 'असली मुनाफ़े' में बैलेंस शीट पर एसेट रहता है।
        </Text>
      </View>

      {/* Voice Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="नाम या उपनाम खोजें (जैसे 'शर्मा जी', 'ऑटो-वाला')..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.searchMic}
          onPress={() => setSearchQuery('Sharma')}
        >
          <Ionicons name="mic" size={18} color="#34d399" />
        </TouchableOpacity>
      </View>

      {successBanner !== '' && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={styles.successText}>{successBanner}</Text>
        </View>
      )}

      {/* Customer List */}
      <Text style={styles.sectionTitle}>ग्राहक खाते (Street Aliases & Udhar)</Text>

      {filtered.map((cust) => (
        <View key={cust.id} style={styles.customerCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flex1}>
              <Text style={styles.customerName}>{cust.name}</Text>
              <View style={styles.aliasBadge}>
                <Ionicons name="pricetag" size={12} color="#38bdf8" />
                <Text style={styles.aliasText}>{cust.alias}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.balanceDue}>₹{cust.balanceDue}</Text>
              <Text style={styles.bakiLabel}>बाक़ी</Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.detailsText}>आख़िरी हिसाब: {cust.lastItem}</Text>
            <Text style={styles.timeText}>{cust.lastVisit}</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.settleBtn}
              onPress={() => handleSettle(cust.id, 40)}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.settleBtnText}>₹40 जमा करें</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={() => handleWhatsAppReminder(cust)}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              <Text style={styles.whatsappBtnText}>तकाज़ा भेजें</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 100
  },
  heroCard: {
    backgroundColor: '#1f132e',
    borderColor: '#7e22ce',
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
  heroLabel: {
    color: '#d8b4fe',
    fontSize: 13,
    fontWeight: '600'
  },
  heroAmount: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4
  },
  udharBadge: {
    backgroundColor: '#581c87',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  udharBadgeText: {
    color: '#e9d5ff',
    fontWeight: '700',
    fontSize: 12
  },
  heroSub: {
    color: '#c084fc',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16
  },
  searchBar: {
    backgroundColor: '#131b2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    marginLeft: 8
  },
  searchMic: {
    padding: 4
  },
  successBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  successText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12
  },
  customerCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#1e293b'
  },
  flex1: {
    flex: 1
  },
  customerName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  aliasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c2340',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4
  },
  aliasText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4
  },
  balanceDue: {
    color: '#f87171',
    fontSize: 20,
    fontWeight: '800'
  },
  bakiLabel: {
    color: '#94a3b8',
    fontSize: 11
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  detailsText: {
    color: '#94a3b8',
    fontSize: 11
  },
  timeText: {
    color: '#64748b',
    fontSize: 11
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'space-between'
  },
  settleBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    marginRight: 8
  },
  settleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4
  },
  whatsappBtn: {
    flex: 1,
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8
  },
  whatsappBtnText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6
  }
});
