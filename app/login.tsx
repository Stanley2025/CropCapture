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
import { DatePickerField } from '../src/components/DatePickerField';

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
  const { login, registerFarmerAccount } = useAppStore();

  // Mode: Sign In or Create Account
  const [authMode, setAuthMode] = useState<'signin' | 'create_account'>('signin');

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

  // Sign In State
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [email, setEmail] = useState(isDev ? ROLE_TABS[0].defaultEmail : '');
  const [password, setPassword] = useState(isDev ? '••••••••' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Helper: Generate 6-digit Farm ID (100000 - 999999)
  const generateFullDigitsFarmId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Create Account State (all fields optional per user instruction)
  const [farmId, setFarmId] = useState(generateFullDigitsFarmId());
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
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
      Alert.alert('Required Field', 'Please enter your Date of Birth (YYYY-MM-DD).');
      return;
    }
    if (!gender) {
      Alert.alert('Required Field', 'Please select your Gender.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please enter your Address (Community, District or County).');
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
            <Text style={styles.welcomeHeading}>
              {authMode === 'signin' ? 'Welcome back' : 'Create account'}
            </Text>
            <Text style={styles.welcomeSubheading}>
              {authMode === 'signin'
                ? 'From field to frame. Every harvest verified.'
                : 'Join CropCapture. System-generated Farm ID assigned.'}
            </Text>
          </View>

          {/* ========================================================= */}
          {/* BOTTOM SHEET: Warm Cream Card Matching Design Mockup      */}
          {/* ========================================================= */}
          <View style={styles.bottomCard}>
            {/* Mode Switcher: Sign in vs Create account */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                style={[styles.tabToggleBtn, authMode === 'signin' && styles.tabToggleBtnActive]}
                onPress={() => setAuthMode('signin')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabToggleText,
                    authMode === 'signin' && styles.tabToggleTextActive,
                  ]}
                >
                  Sign in
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabToggleBtn,
                  authMode === 'create_account' && styles.tabToggleBtnActive,
                ]}
                onPress={() => {
                  if (!farmId) setFarmId(generateFullDigitsFarmId());
                  setAuthMode('create_account');
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabToggleText,
                    authMode === 'create_account' && styles.tabToggleTextActive,
                  ]}
                >
                  Create account
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === 'signin' ? (
              <>
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
                            isSelected
                              ? styles.roleTileTextSelected
                              : styles.roleTileTextUnselected,
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
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color="#526658"
                      style={styles.fieldLeftIcon}
                    />
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
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#526658"
                      style={styles.fieldLeftIcon}
                    />
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

                {/* Footer Switch Prompt */}
                <View style={styles.footerPromptRow}>
                  <Text style={styles.footerPromptText}>Don't have an account?</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (!farmId) setFarmId(generateFullDigitsFarmId());
                      setAuthMode('create_account');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.footerPromptLink}>Create account</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* 1. System Generated Farm ID (Full Digits) */}
                <View style={styles.farmIdBadgeCard}>
                  <View style={styles.farmIdLeftCol}>
                    <View style={styles.farmIdHeaderRow}>
                      <Text style={styles.farmIdLabel}>FARM ID</Text>
                      <View style={styles.autoTag}>
                        <Text style={styles.autoTagText}>Auto-generated 6 Digits</Text>
                      </View>
                    </View>
                    <Text style={styles.farmIdDigits}>{farmId}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setFarmId(generateFullDigitsFarmId())}
                    style={styles.regenerateBtn}
                    activeOpacity={0.7}
                    accessibilityLabel="Generate new Farm ID"
                  >
                    <Ionicons name="refresh" size={18} color="#1C3822" />
                  </TouchableOpacity>
                </View>

                {/* 2. Full Name (Mandatory) */}
                <View style={styles.inputGroup}>
                  <View style={styles.optionalLabelRow}>
                    <Text style={styles.inputFieldLabel}>
                      Full Name <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <Text style={styles.requiredTag}>Required</Text>
                  </View>
                  <View style={styles.inputFieldWrapper}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color="#526658"
                      style={styles.fieldLeftIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="e.g. Emmanuel Gaye"
                      placeholderTextColor="#7F8F84"
                    />
                  </View>
                </View>

                {/* 3. Date of Birth (Interactive Calendar Picker) */}
                <View style={styles.inputGroup}>
                  <View style={styles.optionalLabelRow}>
                    <Text style={styles.inputFieldLabel}>
                      Date of Birth <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <Text style={styles.requiredTag}>Required</Text>
                  </View>
                  <DatePickerField
                    mode="dob"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    helperText="Tap to choose your birthdate from calendar"
                  />
                </View>

                {/* 4. Gender (Mandatory) */}
                <View style={styles.inputGroup}>
                  <View style={styles.optionalLabelRow}>
                    <Text style={styles.inputFieldLabel}>
                      Gender <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <Text style={styles.requiredTag}>Required</Text>
                  </View>
                  <View style={styles.genderRow}>
                    {(['Male', 'Female', 'Other'] as const).map((g) => {
                      const isSelected = gender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[
                            styles.genderChip,
                            isSelected ? styles.genderChipSelected : styles.genderChipUnselected,
                          ]}
                          onPress={() => setGender(gender === g ? '' : g)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={
                              g === 'Male'
                                ? 'male-outline'
                                : g === 'Female'
                                ? 'female-outline'
                                : 'transgender-outline'
                            }
                            size={16}
                            color={isSelected ? '#1C3822' : '#526658'}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.genderChipText,
                              isSelected
                                ? styles.genderChipTextSelected
                                : styles.genderChipTextUnselected,
                            ]}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 5. Address (Mandatory) */}
                <View style={styles.inputGroup}>
                  <View style={styles.optionalLabelRow}>
                    <Text style={styles.inputFieldLabel}>
                      Address <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <Text style={styles.requiredTag}>Required</Text>
                  </View>
                  <View style={styles.inputFieldWrapper}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color="#526658"
                      style={styles.fieldLeftIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="e.g. Gbehley Town, Sanniquellie-Mahn, Nimba"
                      placeholderTextColor="#7F8F84"
                    />
                  </View>
                </View>

                {/* 6. Security PIN (Mandatory) */}
                <View style={styles.inputGroup}>
                  <View style={styles.optionalLabelRow}>
                    <Text style={styles.inputFieldLabel}>
                      Security PIN <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <Text style={styles.requiredTag}>Required</Text>
                  </View>
                  <View style={styles.inputFieldWrapper}>
                    <Ionicons
                      name="keypad-outline"
                      size={20}
                      color="#526658"
                      style={styles.fieldLeftIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      value={pin}
                      onChangeText={setPin}
                      keyboardType="numeric"
                      maxLength={6}
                      secureTextEntry={!showPin}
                      placeholder="e.g. 4-6 digit numeric PIN"
                      placeholderTextColor="#7F8F84"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPin(!showPin)}
                      style={styles.eyeToggleBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPin ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#526658"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 7. ID Type: Passport, National ID card (Optional) */}
                <View style={styles.inputGroup}>
                  <View style={styles.optionalLabelRow}>
                    <Text style={styles.inputFieldLabel}>Identification Type</Text>
                    <Text style={styles.optionalTag}>Optional</Text>
                  </View>
                  <View style={styles.idTypeRow}>
                    {(['Passport', 'National ID card'] as const).map((type) => {
                      const isSelected = idType === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.idTypeChip,
                            isSelected ? styles.idTypeChipSelected : styles.idTypeChipUnselected,
                          ]}
                          onPress={() => setIdType(idType === type ? '' : type)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={type === 'Passport' ? 'airplane-outline' : 'card-outline'}
                            size={16}
                            color={isSelected ? '#1C3822' : '#526658'}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.idTypeChipText,
                              isSelected
                                ? styles.idTypeChipTextSelected
                                : styles.idTypeChipTextUnselected,
                            ]}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Document Number if ID Type chosen */}
                  {idType !== '' && (
                    <View style={[styles.inputFieldWrapper, { marginTop: 10 }]}>
                      <Ionicons
                        name="barcode-outline"
                        size={20}
                        color="#526658"
                        style={styles.fieldLeftIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        value={idNumber}
                        onChangeText={setIdNumber}
                        placeholder={`Enter ${idType} Number (Optional)`}
                        placeholderTextColor="#7F8F84"
                      />
                    </View>
                  )}
                </View>

                {/* Primary Action Button: Create Account */}
                <TouchableOpacity
                  style={styles.primarySignInBtn}
                  onPress={handleCreateAccount}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primarySignInText}>
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Text>
                </TouchableOpacity>

                {/* Footer Switch Prompt */}
                <View style={styles.footerPromptRow}>
                  <Text style={styles.footerPromptText}>Already have an account?</Text>
                  <TouchableOpacity
                    onPress={() => setAuthMode('signin')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.footerPromptLink}>Sign in</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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

  /* Mode Switcher Tabs */
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#EAEFE6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#556658',
  },
  tabToggleTextActive: {
    color: '#142E1B',
    fontWeight: '700',
  },

  /* Farm ID Badge Card */
  farmIdBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EBF4E5',
    borderWidth: 1.5,
    borderColor: '#BDDDAB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  farmIdLeftCol: {
    flex: 1,
  },
  farmIdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  farmIdLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2A4A2F',
    letterSpacing: 0.5,
  },
  autoTag: {
    backgroundColor: '#D1E8C5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E4023',
  },
  farmIdDigits: {
    fontSize: 26,
    fontWeight: '800',
    color: '#133319',
    letterSpacing: 2,
  },
  regenerateBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C6DEB7',
  },

  /* Labels with Optional tag */
  optionalLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A8C7F',
    backgroundColor: '#E8EDE5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '700',
  },

  /* Gender & ID Chips */
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  genderChipSelected: {
    backgroundColor: '#E5F2DC',
    borderColor: '#1C3822',
  },
  genderChipUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE2D9',
  },
  genderChipText: {
    fontSize: 13,
  },
  genderChipTextSelected: {
    fontWeight: '700',
    color: '#1C3822',
  },
  genderChipTextUnselected: {
    fontWeight: '500',
    color: '#4B5C4F',
  },

  idTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  idTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  idTypeChipSelected: {
    backgroundColor: '#E5F2DC',
    borderColor: '#1C3822',
  },
  idTypeChipUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE2D9',
  },
  idTypeChipText: {
    fontSize: 13,
  },
  idTypeChipTextSelected: {
    fontWeight: '700',
    color: '#1C3822',
  },
  idTypeChipTextUnselected: {
    fontWeight: '500',
    color: '#4B5C4F',
  },

  /* Footer Switch Prompt */
  footerPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 8,
  },
  footerPromptText: {
    fontSize: 13,
    color: '#5E6E61',
    fontWeight: '500',
  },
  footerPromptLink: {
    fontSize: 13,
    color: '#165B27',
    fontWeight: '700',
  },
});
