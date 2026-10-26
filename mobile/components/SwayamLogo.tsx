import React, { useState } from 'react';
import { StyleSheet, View, Image, ImageSourcePropType } from 'react-native';

interface Props {
  size?: number;
  imageUri?: string | null;
}

let localAsset: ImageSourcePropType | null = null;
try {
  localAsset = require('../assets/swayam_logo.png');
} catch (e) {
  localAsset = null;
}

export const SwayamLogo: React.FC<Props> = ({ size = 36, imageUri }) => {
  const [imageError, setImageError] = useState(false);
  const badgeRadius = Math.round(size * 0.28);

  const source = imageUri ? { uri: imageUri } : localAsset;

  if (source && !imageError) {
    return (
      <View
        style={[
          styles.imageWrapper,
          {
            width: size,
            height: size,
            borderRadius: badgeRadius,
          },
        ]}
      >
        <Image
          source={source}
          style={{
            width: size,
            height: size,
            borderRadius: badgeRadius,
          }}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  // Pure Vector Architectural Fallback:
  // Fusion of Open Ledger Book (White/Amber) & Layered Currency Banknotes (Electric Lime)
  return (
    <View
      style={[
        styles.logoBadge,
        {
          width: size,
          height: size,
          borderRadius: badgeRadius,
        },
      ]}
    >
      <View style={styles.fusionContainer}>
        {/* Left Book Page (Bahi-Khata Ledger) */}
        <View style={styles.bookHalf}>
          <View style={styles.ledgerLineWhite} />
          <View style={styles.ledgerLineWhite} />
          <View style={styles.ledgerLineAmber} />
        </View>
        {/* Book Spine Center Divider */}
        <View style={styles.bookSpine} />
        {/* Right Cash Banknotes Layer */}
        <View style={styles.cashHalf}>
          <View style={styles.cashNoteOuter}>
            <View style={styles.cashNoteInner} />
          </View>
          <View style={styles.cashFlap} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  imageWrapper: {
    backgroundColor: '#073B3A',
    borderWidth: 1.5,
    borderColor: '#E2FD52',
    overflow: 'hidden',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoBadge: {
    backgroundColor: '#073B3A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2FD52',
    shadowColor: '#073B3A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
    overflow: 'hidden',
  },
  fusionContainer: {
    width: '78%',
    height: '74%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookHalf: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 4,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRightWidth: 0,
  },
  ledgerLineWhite: {
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    width: '85%',
  },
  ledgerLineAmber: {
    height: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 1,
    width: '65%',
  },
  bookSpine: {
    width: 2,
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 1,
  },
  cashHalf: {
    flex: 1.1,
    height: '100%',
    backgroundColor: 'rgba(226, 253, 82, 0.18)',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2FD52',
    borderLeftWidth: 0,
    position: 'relative',
  },
  cashNoteOuter: {
    width: '90%',
    height: '80%',
    borderRadius: 3,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashNoteInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#073B3A',
  },
  cashFlap: {
    position: 'absolute',
    top: -2,
    right: 1,
    width: 8,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 1.5,
    transform: [{ rotate: '15deg' }],
  },
});
