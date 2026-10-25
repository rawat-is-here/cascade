import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  badge?: string;
  title: string;
  description: string;
  buttonText?: string;
  onClose: () => void;
}

export const CustomNoticeModal: React.FC<Props> = ({
  visible,
  badge = 'VERIFIED',
  title,
  description,
  buttonText = 'Got It',
  onClose
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Badge */}
          <View style={styles.topRow}>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </View>

          {/* Title & Description in clean, professional English */}
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.descText}>{description}</Text>

          {/* Action Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>{buttonText}</Text>
            <View style={styles.arrowCircle}>
              <Text style={styles.arrowIcon}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 59, 58, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgePill: {
    backgroundColor: '#073B3A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    color: '#E2FD52',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  titleText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  descText: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 20,
    paddingVertical: 10,
    paddingLeft: 20,
    paddingRight: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#E2FD52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    color: '#073B3A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#073B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    color: '#E2FD52',
    fontSize: 14,
    fontWeight: '900',
  },
});
