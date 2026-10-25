import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const PariwarMeshTab: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('2 मिनट पहले');

  const devices = [
    {
      id: 'd1',
      name: 'ठेला गल्ला (You)',
      role: 'Counter & Sales Lead',
      status: 'सक्रिय (Active Node)',
      isOnline: true,
      clockHlc: 'HLC-2026-10-25-17:02',
      ip: '192.168.4.1 (BT Master)'
    },
    {
      id: 'd2',
      name: 'छोटू (Chotu - Son)',
      role: 'मंडी खरीदार (Mandi Buyer)',
      status: '🟢 ब्लूटूथ से जुड़ा (BT Connected)',
      isOnline: true,
      clockHlc: 'HLC-2026-10-25-16:58',
      ip: 'BLE-GATT: C4:57:18'
    },
    {
      id: 'd3',
      name: 'घर की रसोई (Sunita)',
      role: 'Kitchen Prep & Spoilage',
      status: '🟡 ऑफ़लाइन (घर पर)',
      isOnline: false,
      clockHlc: 'HLC-2026-10-25-14:30',
      ip: 'P2P Store-and-Forward'
    }
  ];

  const crdtLogs = [
    {
      id: 'l1',
      time: '16:58 PM',
      device: 'छोटू (Mandi)',
      action: 'कच्चा माल: +10kg Aloo @ ₹280, +5L Tel @ ₹550',
      resolution: '✅ Delta-CRDT Join: दोनों लेजर बिना किसी टकराव के जुड़ गए।'
    },
    {
      id: 'l2',
      time: '14:20 PM',
      device: 'घर की रसोई',
      action: 'घरेलू खपत: -1kg Aloo (परिवार का दोपहर भोजन)',
      resolution: '✅ Causal DAG: स्टॉक से घटाया गया, नक़दी पर कोई असर नहीं।'
    },
    {
      id: 'l3',
      time: '08:15 AM',
      device: 'छोटू (Dead Battery)',
      action: '⚠️ Hostile Clock: फ़ोन की बैटरी ख़त्म होने पर घड़ी 1970 पर रिसेट हुई',
      resolution: '🛡️ Merkle-Lamport DAG: 1970 टाइमस्टैम्प को अस्वीकार किया, लॉजिकल सीक्वेंस से इवेंट सुरक्षित रहा!'
    }
  ];

  const handleTriggerSync = () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setLastSyncTime('अभी-अभी (Just now)');
      setTimeout(() => setSyncSuccess(false), 5000);
    }, 1800);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Mesh Radar Hero */}
      <View style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.heroTitle}>परिवार P2P मेश नेटवर्क (3 Devices)</Text>
            <Text style={styles.heroSub}>
              बिना इंटरनेट के ब्लूटूथ व लोकल वाई-फ़ाई पर परिवार के ३ फ़ोन आपस में लेजर सिंक करते हैं।
            </Text>
          </View>
          <MaterialCommunityIcons name="access-point-network" size={32} color="#10b981" />
        </View>

        <View style={styles.syncStatusRow}>
          <Text style={styles.syncStatusText}>आख़िरी सिंक: {lastSyncTime}</Text>
          {isSyncing ? (
            <ActivityIndicator size="small" color="#34d399" />
          ) : (
            <TouchableOpacity style={styles.syncBtn} onPress={handleTriggerSync}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.syncBtnText}>अभी सिंक करें</Text>
            </TouchableOpacity>
          )}
        </View>

        {syncSuccess && (
          <View style={styles.syncSuccessBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.syncSuccessText}>
              छोटू के फ़ोन से ३ नए ट्रांजेक्शन सिंक हो गए!
            </Text>
          </View>
        )}
      </View>

      {/* 3 Devices List */}
      <Text style={styles.sectionTitle}>कनेक्टेड डिवाइस (Family Topology)</Text>
      {devices.map((d) => (
        <View key={d.id} style={styles.deviceCard}>
          <View style={styles.row}>
            <View
              style={[
                styles.deviceIcon,
                d.isOnline ? styles.deviceIconOnline : styles.deviceIconOffline
              ]}
            >
              <Ionicons
                name={d.isOnline ? 'phone-portrait' : 'phone-portrait-outline'}
                size={22}
                color={d.isOnline ? '#34d399' : '#94a3b8'}
              />
            </View>
            <View style={styles.flex1}>
              <View style={styles.rowBetween}>
                <Text style={styles.deviceName}>{d.name}</Text>
                <Text
                  style={[
                    styles.statusBadge,
                    d.isOnline ? styles.badgeOnline : styles.badgeOffline
                  ]}
                >
                  {d.status}
                </Text>
              </View>
              <Text style={styles.deviceRole}>{d.role}</Text>
              <Text style={styles.deviceHlc}>HLC: {d.clockHlc} • {d.ip}</Text>
            </View>
          </View>
        </View>
      ))}

      {/* CRDT & Clock Immunity Log */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
        CRDT टकराव समाधान & 1970 घड़ी सुरक्षा (Audit Log)
      </Text>

      {crdtLogs.map((log) => (
        <View key={log.id} style={styles.logCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.logDevice}>{log.device}</Text>
            <Text style={styles.logTime}>{log.time}</Text>
          </View>
          <Text style={styles.logAction}>{log.action}</Text>
          <View style={styles.resBox}>
            <Text style={styles.resText}>{log.resolution}</Text>
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
    backgroundColor: '#062d22',
    borderColor: '#059669',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  flex1: {
    flex: 1
  },
  heroTitle: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '700'
  },
  heroSub: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
    maxWidth: '85%'
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#064e3b'
  },
  syncStatusText: {
    color: '#cbd5e1',
    fontSize: 12
  },
  syncBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4
  },
  syncSuccessBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  syncSuccessText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10
  },
  deviceCard: {
    backgroundColor: '#131b2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#1e293b'
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  deviceIconOnline: {
    backgroundColor: '#064e3b'
  },
  deviceIconOffline: {
    backgroundColor: '#1e293b'
  },
  deviceName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700'
  },
  deviceRole: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  deviceHlc: {
    color: '#38bdf8',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace'
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeOnline: {
    backgroundColor: '#064e3b',
    color: '#34d399'
  },
  badgeOffline: {
    backgroundColor: '#334155',
    color: '#94a3b8'
  },
  logCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8'
  },
  logDevice: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  logTime: {
    color: '#64748b',
    fontSize: 10
  },
  logAction: {
    color: '#f8fafc',
    fontSize: 12,
    marginVertical: 4,
    fontWeight: '600'
  },
  resBox: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    padding: 6,
    marginTop: 2
  },
  resText: {
    color: '#94a3b8',
    fontSize: 11
  }
});
