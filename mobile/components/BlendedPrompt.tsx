import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PromptInfo {
  badge: string;
  title: string;
  description: string;
  type?: 'success' | 'info' | 'warning' | 'neutral';
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number;
}

interface Props {
  prompt: PromptInfo | null;
  onDismiss: () => void;
}

export const BlendedPrompt: React.FC<Props> = ({ prompt, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (prompt) {
      if (timerRef.current) clearTimeout(timerRef.current);

      // Slide and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();

      // Auto dismiss
      const duration = prompt.duration || 3600;
      timerRef.current = setTimeout(() => {
        dismiss();
      }, duration);
    } else {
      dismiss();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prompt]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss();
    });
  };

  if (!prompt) return null;

  const isSuccess = prompt.type === 'success';
  const isWarning = prompt.type === 'warning';
  const iconName = prompt.icon || (isSuccess ? 'checkmark-circle' : isWarning ? 'alert-circle' : 'notifications');

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        }
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={dismiss}
      >
        {/* Left Glowing Icon Box */}
        <View style={[styles.iconBox, isSuccess ? styles.iconBoxSuccess : isWarning ? styles.iconBoxWarning : styles.iconBoxDefault]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isSuccess || isWarning ? '#073B3A' : '#E2FD52'}
          />
        </View>

        {/* Text Content */}
        <View style={styles.textColumn}>
          <View style={styles.badgeRow}>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{prompt.badge.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.titleText} numberOfLines={1}>{prompt.title}</Text>
          <Text style={styles.descriptionText} numberOfLines={2}>{prompt.description}</Text>
        </View>

        {/* Dismiss subtle pill */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#073B3A',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 253, 82, 0.25)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBoxSuccess: {
    backgroundColor: '#E2FD52',
  },
  iconBoxWarning: {
    backgroundColor: '#FDE047',
  },
  iconBoxDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  textColumn: {
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  badgePill: {
    backgroundColor: 'rgba(226, 253, 82, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#E2FD52',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  descriptionText: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
