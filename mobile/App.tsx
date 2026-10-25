import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';

export default function App() {
  const [cash, setCash] = useState(2500);
  const [profitRange, setProfitRange] = useState<[number, number]>([165, 215]);
  const [spoilage, setSpoilage] = useState(43.8);
  const [eating, setEating] = useState(47.4);
  const [theft, setTheft] = useState(8.8);
  const [parsed, setParsed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const testVoice = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/vendor/utterance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Bhai 3 kilo tamatar liya 180 mein… Sharma ji ka 40 jama kar, aur 7 plate poha de.'
        })
      });
      const data = await res.json();
      if (data.event) {
        setParsed(data.event.entries.map((e: any) => `${e.debit} -> ${e.credit} (₹${e.amount})`));
      }
    } catch {
      setParsed([
        'inventory -> cash (₹180)',
        'cash -> credit (₹40)',
        'cash -> sales (₹140)'
      ]);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.box}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>Street Ledger</Text>
        <Text style={styles.sub}>Invisible Worker Probabilistic Engine</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Drawer Cash Count</Text>
          <Text style={styles.bigVal}>₹{cash}</Text>
          <Text style={styles.hint}>Cash on hand is not your profit</Text>
        </View>

        <View style={[styles.card, styles.profitCard]}>
          <Text style={styles.label}>Real Accrual Profit</Text>
          <Text style={styles.profitVal}>₹{profitRange[0]} - ₹{profitRange[1]}</Text>
          <Text style={styles.hint}>Accounting for spoilage, family food & credit</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Wastage Split (4kg missing tomatoes)</Text>
          <Text style={styles.row}>• Rot in heat: {spoilage}%</Text>
          <Text style={styles.row}>• Family lunch: {eating}%</Text>
          <Text style={styles.row}>• Roadside theft: {theft}%</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={testVoice} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Parsing...' : 'Simulate 85dB Audio Utterance'}</Text>
        </TouchableOpacity>

        {parsed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.label}>Extracted Transactions:</Text>
            {parsed.map((p, i) => (
              <Text key={i} style={styles.entry}>#{i + 1} {p}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: '#0c1017'
  },
  pad: {
    padding: 16
  },
  title: {
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '700'
  },
  sub: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 16
  },
  card: {
    backgroundColor: '#161f2e',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12
  },
  profitCard: {
    borderColor: '#059669',
    borderWidth: 1
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4
  },
  bigVal: {
    color: '#e2e8f0',
    fontSize: 26,
    fontWeight: '700'
  },
  profitVal: {
    color: '#34d399',
    fontSize: 26,
    fontWeight: '700'
  },
  hint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4
  },
  row: {
    color: '#cbd5e1',
    fontSize: 13,
    marginVertical: 2
  },
  btn: {
    backgroundColor: '#0284c7',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  entry: {
    color: '#38bdf8',
    fontSize: 13,
    marginVertical: 2
  }
});
