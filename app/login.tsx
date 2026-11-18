import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';
import { useAppStore } from '../src/store/useAppStore';
import { UserRole } from '../src/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RoleTab {
  key: UserRole;
  label: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  defaultEmail: string;
}

const ROLE_TABS: RoleTab[] = [
  {
    key: 'farmer',
    label: 'Farmer',
    name: 'Farmer',
    icon: 'leaf-outline',
    defaultEmail: 'farmer@cropcapture.app',
  },
  {
    key: 'extension_officer',
    label: 'Extension',
    name: 'Extension',
    icon: 'compass-outline',
    defaultEmail: 'extension@cropcapture.app',
  },
  {
    key: 'quality_inspector',
    label: 'Inspector',
    name: 'Inspector',
    icon: 'shield-checkmark-outline',
    defaultEmail: 'inspector@cropcapture.app',
  },
  {
    key: 'cooperative_manager',
    label: 'Co-op',
    name: 'Co-op',
    icon: 'people-outline',
    defaultEmail: 'admin@cropcapture.app',
  },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAppStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [email, setEmail] = useState(ROLE_TABS[0].defaultEmail);
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeTab = ROLE_TABS.find((r) => r.key === selectedRole) || ROLE_TABS[0];

  const handleSelectRole = (tab: RoleTab) => {
    setSelectedRole(tab.key);
    setEmail(tab.defaultEmail);
  };

  const handleRegularLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Incomplete Email', 'Please enter your account email address.');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password, selectedRole);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Sign-In Error', e?.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      `A password reset verification link has been dispatched to ${email || 'your registered account email'}.`
    );
  };

  // Pre-calculate radiating rays for background
  const headerHeight = 220;
  const originX = SCREEN_WIDTH / 2;
  const originY = headerHeight + 30;
  const rayTargets = [
    { x: -SCREEN_WIDTH * 0.3, y: -40 },
    { x: SCREEN_WIDTH * 0.05, y: -40 },
    { x: SCREEN_WIDTH * 0.28, y: -40 },
    { x: SCREEN_WIDTH * 0.5, y: -40 },
    { x: SCREEN_WIDTH * 0.72, y: -40 },
    { x: SCREEN_WIDTH * 0.95, y: -40 },
    { x: SCREEN_WIDTH * 1.3, y: -40 },
    { x: -50, y: headerHeight * 0.35 },
    { x: SCREEN_WIDTH + 50, y: headerHeight * 0.35 },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================= */}
          {/* TOP SECTION: Dark Green with Perspective Lines & Logo     */}
          {/* ========================================================= */}
          <View style={styles.topHeader}>
            {/* Perspective Ray Lines */}
            <Svg style={StyleSheet.absoluteFill}>
              {rayTargets.map((target, idx) => (
                <Line
                  key={`ray-${idx}`}
                  x1={originX}
                  y1={originY}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(38, 82, 50, 0.45)"
                  strokeWidth="1.2"
                />
              ))}
            </Svg>

            {/* Brand Logo Row */}
            <View style={styles.brandRow}>
              {/* Custom Viewfinder with Sprout Icon */}
              <View style={styles.logoIcon}>
                <Ionicons name="scan-outline" size={28} color="#B4E544" />
                <View style={styles.logoInnerSprout}>
                  <Ionicons name="leaf" size={13} color="#B4E544" />
                </View>
              </View>

              <Text style={styles.brandTitleText}>
                Crop<Text style={styles.brandCaptureText}>Capture</Text>
              </Text>
            </View>

            {/* Welcome Heading */}
            <Text style={styles.welcomeHeading}>Welcome back</Text>
            <Text style={styles.welcomeSubheading}>
              From field to frame. Every harvest verified.
            </Text>
          </View>

          {/* ========================================================= */}
          {/* BOTTOM SHEET: Warm Cream Card Matching Design Mockup      */}
          {/* ========================================================= */}
          <View style={styles.bottomCard}>
            {/* Label: I am signing in as */}
            <Text style={styles.sectionLabel}>I am signing in as</Text>

            {/* Role Tiles Row */}
            <View style={styles.rolesRow}>
              {ROLE_TABS.map((tab) => {
                const isSelected = selectedRole === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.roleTile,
                      isSelected ? styles.roleTileSelected : styles.roleTileUnselected,
                    ]}
                    onPress={() => handleSelectRole(tab)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={24}
                      color={isSelected ? '#1C3822' : '#2A3C2F'}
                    />
                    <Text
                      style={[
                        styles.roleTileText,
                        isSelected ? styles.roleTileTextSelected : styles.roleTileTextUnselected,
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Input: Email address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputFieldLabel}>Email address</Text>
              <View style={styles.inputFieldWrapper}>
                <Ionicons name="mail-outline" size={20} color="#526658" style={styles.fieldLeftIcon} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor="#7F8F84"
                />
              </View>
            </View>

            {/* Input: Password */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.inputFieldLabel}>Password</Text>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputFieldWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#526658" style={styles.fieldLeftIcon} />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Your password"
                  placeholderTextColor="#7F8F84"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeToggleBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#526658"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary Action Button: Sign in as [Role] */}
            <TouchableOpacity
              style={styles.primarySignInBtn}
              onPress={handleRegularLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.primarySignInText}>
                {isLoading ? 'Signing in...' : `Sign in as ${activeTab.name}`}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A1C14',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#0A1C14',
  },

  /* ------------------------------------------------------------- */
  /* Top Section: Dark Forest Green with Perspective Rays          */
  /* ------------------------------------------------------------- */
  topHeader: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0A1C14',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  logoIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    position: 'relative',
  },
  logoInnerSprout: {
    position: 'absolute',
    top: 9,
    left: 9,
  },
  brandTitleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandCaptureText: {
    color: '#B4E544',
  },
  welcomeHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  welcomeSubheading: {
    fontSize: 14,
    color: '#A8B7AD',
    fontWeight: '400',
    lineHeight: 20,
  },

  /* ------------------------------------------------------------- */
  /* Bottom Sheet: Warm Cream Card                                 */
  /* ------------------------------------------------------------- */
  bottomCard: {
    flex: 1,
    backgroundColor: '#F5F5ED',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5548',
    marginBottom: 12,
  },

  /* Role Selection Tiles */
  rolesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  roleTile: {
    flex: 1,
    height: 76,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  roleTileSelected: {
    backgroundColor: '#E5F2DC',
    borderColor: '#1C3822',
    borderWidth: 1.5,
  },
  roleTileUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E6DF',
    borderWidth: 1,
  },
  roleTileText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  roleTileTextSelected: {
    fontWeight: '700',
    color: '#1C3822',
  },
  roleTileTextUnselected: {
    fontWeight: '500',
    color: '#2A3C2F',
  },

  /* Form Fields */
  inputGroup: {
    marginBottom: 16,
  },
  inputFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E2B21',
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3B24',
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE2D9',
    paddingHorizontal: 14,
  },
  fieldLeftIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E2B21',
    height: '100%',
  },
  eyeToggleBtn: {
    padding: 6,
  },

  /* Primary Action Button */
  primarySignInBtn: {
    height: 52,
    backgroundColor: '#B4E544',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#709420',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primarySignInText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2E20',
    letterSpacing: -0.2,
  },
});
