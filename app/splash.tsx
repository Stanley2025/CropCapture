import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Colors,
  FontFamily,
  Spacing,
  Shadows,
} from '../src/constants/theme';
import { FarmerHero } from '../src/components/FarmerHero';
import { useAppStore } from '../src/store/useAppStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAppStore();

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('@cropcapture_has_seen_splash', 'true');
    } catch {
      // ignore
    }
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login' as any);
    }
  };

  const handleSignIn = async () => {
    try {
      await AsyncStorage.setItem('@cropcapture_has_seen_splash', 'true');
    } catch {
      // ignore
    }
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login' as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background SVG Artwork with Sky, Sun, Hills, Farmer, and Rows */}
      <View style={StyleSheet.absoluteFill}>
        <FarmerHero width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />
      </View>

      {/* Top Branding Section */}
      <View style={[styles.topBranding, { paddingTop: Math.max(insets.top, 20) + 32 }]}>
        {/* Viewfinder sprout icon */}
        <View style={styles.brandIconBox}>
          <View style={styles.bracketTopLeft} />
          <View style={styles.bracketTopRight} />
          <View style={styles.bracketBottomLeft} />
          <View style={styles.bracketBottomRight} />
          <View style={styles.leafIconContainer}>
            <View style={styles.leafLeft} />
            <View style={styles.leafRight} />
            <View style={styles.leafStem} />
          </View>
        </View>

        <Text style={styles.brandTitle}>FarmTori</Text>
        <Text style={styles.tagline}>Every farm has a story worth recording</Text>
      </View>

      {/* Bottom Action Buttons (Lime Get Started + White Outline Sign In) */}
      <View
        style={[
          styles.bottomActions,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
      >
        <TouchableOpacity
          style={styles.getStartedBtn}
          onPress={handleGetStarted}
          activeOpacity={0.88}
        >
          <Text style={styles.getStartedBtnText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInBtn}
          onPress={handleSignIn}
          activeOpacity={0.85}
        >
          <Text style={styles.signInBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#86B564',
    position: 'relative',
    justifyContent: 'space-between',
  },
  topBranding: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    zIndex: 10,
  },
  brandIconBox: {
    width: 48,
    height: 48,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bracketTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 14,
    height: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#1B7F36',
    borderTopLeftRadius: 4,
  },
  bracketTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#1B7F36',
    borderTopRightRadius: 4,
  },
  bracketBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 14,
    height: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#1B7F36',
    borderBottomLeftRadius: 4,
  },
  bracketBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#1B7F36',
    borderBottomRightRadius: 4,
  },
  leafIconContainer: {
    width: 22,
    height: 22,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafLeft: {
    position: 'absolute',
    left: 2,
    top: 3,
    width: 8,
    height: 12,
    backgroundColor: '#1B7F36',
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
    transform: [{ rotate: '-25deg' }],
  },
  leafRight: {
    position: 'absolute',
    right: 2,
    top: 3,
    width: 8,
    height: 12,
    backgroundColor: '#1B7F36',
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    transform: [{ rotate: '25deg' }],
  },
  leafStem: {
    position: 'absolute',
    bottom: 1,
    width: 2.5,
    height: 8,
    backgroundColor: '#1B7F36',
    borderRadius: 1,
  },
  brandTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#0F3D22',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: '#17301F',
    lineHeight: 22,
  },
  taglineSub: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: '#17301F',
    lineHeight: 22,
  },
  bottomActions: {
    paddingHorizontal: Spacing.xl,
    gap: 12,
    zIndex: 10,
  },
  getStartedBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.lime, // #A5D65A
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  getStartedBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F3D22',
  },
  signInBtn: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
