import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    image: require('../assets/splash/splash_1.png'),
    title: 'CropCapture',
    subtitle: 'From field to Capture.',
    description: 'Digital Farm Records & Geolocation Mapping',
  },
  {
    id: 2,
    image: require('../assets/splash/splash_2.png'),
    title: 'CropCapture',
    subtitle: 'From field to frame.',
    description: 'Real-Time Crop Diagnosis & Field Photography',
  },
  {
    id: 3,
    image: require('../assets/splash/splash_3.png'),
    title: 'CropCapture',
    subtitle: 'From field to frame.',
    description: 'Cassava & Root Crop Harvest Yield Verification',
  },
  {
    id: 4,
    image: require('../assets/splash/splash_4.png'),
    title: 'CropCapture',
    subtitle: 'From field to frame.',
    description: 'National Rice Quality Grading & QR Traceability',
  },
];

const AUTO_ADVANCE_DELAY = 4500; // 4.5 seconds per slide

export default function SplashScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: AUTO_ADVANCE_DELAY,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        if (currentIndex < SLIDES.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          // Completed all slides, navigate to dashboard
          handleFinish();
        }
      }
    });
  };

  useEffect(() => {
    startProgress();
    return () => {
      progressAnim.stopAnimation();
    };
  }, [currentIndex]);

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem('@agritrack_has_seen_splash', 'true');
    } catch (e) {
      // ignore
    }
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    progressAnim.stopAnimation();
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    progressAnim.stopAnimation();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D221A" />

      {/* Full-bleed Illustrated Slide Background */}
      <View style={styles.imageContainer}>
        <Image
          source={currentSlide.image}
          style={styles.slideImage}
          resizeMode="cover"
        />

        {/* Tap areas for quick navigation left/right */}
        <TouchableOpacity
          style={styles.leftTapZone}
          activeOpacity={1}
          onPress={handlePrev}
        />
        <TouchableOpacity
          style={styles.rightTapZone}
          activeOpacity={1}
          onPress={handleNext}
        />
      </View>

      {/* Top Bar with Skip Button */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>AGRITRACK LIBERIA</Text>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={handleFinish}>
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Bottom Control Bar */}
      <View style={styles.bottomBar}>
        {/* Progress Bar Indicators */}
        <View style={styles.indicatorsRow}>
          {SLIDES.map((slide, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;

            return (
              <View key={slide.id} style={styles.indicatorTrack}>
                {isCompleted && <View style={styles.indicatorFillCompleted} />}
                {isCurrent && (
                  <Animated.View
                    style={[
                      styles.indicatorFillCurrent,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Action Button at bottom */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.enterButton}
            onPress={handleFinish}
            activeOpacity={0.8}
          >
            <Text style={styles.enterButtonText}>
              {currentIndex === SLIDES.length - 1 ? 'Enter AgriTrack Liberia' : 'Get Started'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#0D221A" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D221A',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  leftTapZone: {
    position: 'absolute',
    left: 0,
    top: 100,
    bottom: 120,
    width: SCREEN_WIDTH * 0.35,
  },
  rightTapZone: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 120,
    width: SCREEN_WIDTH * 0.35,
  },
  topBar: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  brandRow: {
    backgroundColor: 'rgba(13, 34, 26, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
  brandText: {
    color: '#A3E635',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(13, 34, 26, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  indicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  indicatorTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  indicatorFillCompleted: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A3E635',
  },
  indicatorFillCurrent: {
    height: '100%',
    backgroundColor: '#A3E635',
  },
  actionRow: {
    alignItems: 'center',
  },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A3E635',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enterButtonText: {
    color: '#0D221A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
