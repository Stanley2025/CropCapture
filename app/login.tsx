import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { Leaf, Compass, ShieldCheck, Users } from 'lucide-react-native';
import {
  Colors,
  FontFamily,
  Spacing,
  Typography,
  Shadows,
} from '../src/constants/theme';
import { useAppStore } from '../src/store/useAppStore';
import { UserRole } from '../src/types/database';
import { DatePickerField } from '../src/components/DatePickerField';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RoleTab {
  key: UserRole;
  label: string;
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  defaultEmail: string;
}

const ROLE_TABS: RoleTab[] = [
  {
    key: 'farmer',
    label: 'Farmer',
    IconComponent: Leaf,
    defaultEmail: 'farmer@cropcapture.app',
  },
  {
    key: 'extension_officer',
    label: 'Extension',
    IconComponent: Compass,
    defaultEmail: 'extension@cropcapture.app',
  },
  {
    key: 'quality_inspector',
    label: 'Inspector',
    IconComponent: ShieldCheck,
    defaultEmail: 'inspector@cropcapture.app',
  },
  {
    key: 'cooperative_manager',
    label: 'Co-op',
    IconComponent: Users,
    defaultEmail: 'admin@cropcapture.app',
  },
];

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, registerFarmerAccount } = useAppStore();

  const [authMode, setAuthMode] = useState<'signin' | 'create_account'>('signin');
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

  // Sign In State
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [email, setEmail] = useState(isDev ? ROLE_TABS[0].defaultEmail : '');
  const [password, setPassword] = useState(isDev ? '••••••••' : '');
  const [isLoading, setIsLoading] = useState(false);

  // Helper for farm id
  const generateFullDigitsFarmId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Create Account State
  const [farmId, setFarmId] = useState(generateFullDigitsFarmId());
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [idType, setIdType] = useState<'Passport' | 'National ID card' | ''>('');
  const [idNumber, setIdNumber] = useState('');

  const activeTab = ROLE_TABS.find((r) => r.key === selectedRole) || ROLE_TABS[0];

  const handleSelectRole = (tab: RoleTab) => {
    setSelectedRole(tab.key);
    if (isDev) {
      setEmail(tab.defaultEmail);
      setPassword('••••••••');
    }
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

  const handleCreateAccount = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Name.');
      return;
    }
    if (!dateOfBirth.trim()) {
      Alert.alert('Required Field', 'Please select your Date of Birth.');
      return;
    }
    if (!gender) {
      Alert.alert('Required Field', 'Please select your Gender.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please enter your Address.');
      return;
    }
    if (!pin.trim() || pin.trim().length < 4) {
      Alert.alert('Required Field', 'Please enter a 4-6 digit numeric security PIN.');
      return;
    }

    setIsLoading(true);
    try {
      const created = await registerFarmerAccount({
        farm_id_code: farmId,
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth.trim(),
        gender: gender,
        address: address.trim(),
        pin: pin.trim(),
        id_type: idType || undefined,
        id_number: idNumber.trim() || undefined,
      });

      Alert.alert(
        'Account Created Successfully!',
        `Your Farm ID is: ${created.farmer_id_code}\n${
          pin ? `Your security PIN is: ${pin}\n` : ''
        }You are now logged into CropCapture.`,
        [
          {
            text: 'Enter Dashboard',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Account Creation Failed', e?.message || 'Could not register account.');
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

  // Perspective rays
  const headerHeight = 200;
  const originX = SCREEN_WIDTH / 2;
  const originY = headerHeight + 50;
  const rayTargets = [
    { x: -SCREEN_WIDTH * 0.3, y: -40 },
    { x: SCREEN_WIDTH * 0.05, y: -40 },
    { x: SCREEN_WIDTH * 0.28, y: -40 },
    { x: SCREEN_WIDTH * 0.5, y: -40 },
    { x: SCREEN_WIDTH * 0.72, y: -40 },
    { x: SCREEN_WIDTH * 0.95, y: -40 },
    { x: SCREEN_WIDTH * 1.3, y: -40 },
  ];

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Green Section with Perspective Sun Rays */}
          <View
            style={[
              styles.topGreenHeader,
              { paddingTop: Math.max(insets.top, 16) + 24 },
            ]}
          >
            <Svg style={StyleSheet.absoluteFill}>
              {rayTargets.map((target, idx) => (
                <Line
                  key={`ray-${idx}`}
                  x1={originX}
                  y1={originY}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="1.5"
                />
              ))}
            </Svg>

            <Text style={styles.headingTitle}>
              {authMode === 'signin' ? 'Welcome back' : 'Create account'}
            </Text>
            <Text style={styles.headingSub}>
              {authMode === 'signin'
                ? 'Sign in to your CropCapture account'
                : 'Join the national smallholder verified network'}
            </Text>
          </View>

          {/* Overlapping White Form Card */}
          <View style={styles.contentWrapper}>
            <View style={styles.formCard}>
              {authMode === 'signin' ? (
                <>
                  {/* Role Selector: "I am a" */}
                  <Text style={styles.sectionLabel}>I am a</Text>
                  <View style={styles.roleGrid}>
                    {ROLE_TABS.map((tab) => {
                      const isSelected = selectedRole === tab.key;
                      const IconComp = tab.IconComponent;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          style={[
                            styles.roleSquircle,
                            isSelected ? styles.roleSquircleActive : styles.roleSquircleInactive,
                          ]}
                          onPress={() => handleSelectRole(tab)}
                          activeOpacity={0.8}
                        >
                          <IconComp
                            size={20}
                            color={isSelected ? Colors.primary : Colors.text}
                            strokeWidth={2.4}
                          />
                          <Text
                            style={[
                              styles.roleText,
                              isSelected && styles.roleTextActive,
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Email address field */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email address</Text>
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@example.com"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  {/* Password field */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TextInput
                      style={styles.textInput}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Your password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  {/* Forgot password link */}
                  <TouchableOpacity
                    style={styles.forgotPasswordBtn}
                    onPress={handleForgotPassword}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </TouchableOpacity>

                  {/* Primary Sign In Button */}
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleRegularLogin}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Sign in as {activeTab.label}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Switch to Create Account */}
                  <TouchableOpacity
                    style={styles.switchModeBtn}
                    onPress={() => setAuthMode('create_account')}
                  >
                    <Text style={styles.switchModeText}>
                      New farmer? <Text style={{ color: Colors.primary, fontFamily: FontFamily.bold }}>Register account</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Create Account Form with DatePickerField */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="e.g. Emmanuel Gaye"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  {/* Date of Birth with Calendar Selector */}
                  <DatePickerField
                    label="Date of Birth"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    placeholder="Select your birth date"
                  />

                  {/* Gender Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Gender</Text>
                    <View style={styles.genderRow}>
                      {(['Male', 'Female', 'Other'] as const).map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[
                            styles.genderBtn,
                            gender === g && styles.genderBtnActive,
                          ]}
                          onPress={() => setGender(g)}
                        >
                          <Text
                            style={[
                              styles.genderBtnText,
                              gender === g && styles.genderBtnTextActive,
                            ]}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Address */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Address / Community</Text>
                    <TextInput
                      style={styles.textInput}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="e.g. Gbehley, Nimba County"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  {/* PIN */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Offline Security PIN (4-6 digits)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={pin}
                      onChangeText={setPin}
                      placeholder="4 to 6 digit PIN"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      secureTextEntry
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleCreateAccount}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create Farmer Account</Text>
                    )}
                  </TouchableOpacity>

                  {/* Back to Sign In */}
                  <TouchableOpacity
                    style={styles.switchModeBtn}
                    onPress={() => setAuthMode('signin')}
                  >
                    <Text style={styles.switchModeText}>
                      Already have an account? <Text style={{ color: Colors.primary, fontFamily: FontFamily.bold }}>Sign in</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Offline Reminder Footer */}
            <Text style={styles.offlineFooterText}>
              After your first sign in, you can open the app even without internet.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  topGreenHeader: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 54,
    position: 'relative',
    overflow: 'hidden',
  },
  headingTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headingSub: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.sm,
    color: '#DDF0D8',
    lineHeight: 20,
  },
  contentWrapper: {
    paddingHorizontal: Spacing.xl,
    marginTop: -28,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    marginBottom: 20,
    ...Shadows.card,
  },
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  roleSquircle: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roleSquircleActive: {
    backgroundColor: Colors.tintSoft,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  roleSquircleInactive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.text,
  },
  roleTextActive: {
    fontFamily: FontFamily.bold,
    color: Colors.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.text,
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.primary,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.card,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  offlineFooterText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: {
    backgroundColor: Colors.tintSoft,
    borderColor: Colors.primary,
  },
  genderBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.text,
  },
  genderBtnTextActive: {
    fontFamily: FontFamily.bold,
    color: Colors.primary,
  },
});
