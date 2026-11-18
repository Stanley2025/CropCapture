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
import { Colors, Spacing, Typography, Radius } from '../src/constants/theme';
import { useAppStore, PERSONAS } from '../src/store/useAppStore';
import { UserRole } from '../src/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEMO_ROLES: { role: UserRole; title: string; subtitle: string; icon: string; color: string; badge: string }[] = [
  {
    role: 'farmer',
    title: 'Farmer Persona',
    subtitle: 'Emmanuel Gaye • Nimba County',
    icon: 'leaf',
    color: '#15803D',
    badge: 'FARMER',
  },
  {
    role: 'extension_officer',
    title: 'Extension Officer',
    subtitle: 'Kebbeh Flomo • Central Agro Hub',
    icon: 'compass',
    color: '#0284C7',
    badge: 'EXTENSION',
  },
  {
    role: 'quality_inspector',
    title: 'Quality Inspector',
    subtitle: 'Varney Fahnbulleh • Standards Bureau',
    icon: 'shield-checkmark',
    color: '#D97706',
    badge: 'INSPECTOR',
  },
  {
    role: 'cooperative_manager',
    title: 'Cooperative Union',
    subtitle: 'Arthur Sherman • Nimba Rice Union',
    icon: 'people',
    color: '#7C3AED',
    badge: 'COOPERATIVE',
  },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAsRole } = useAppStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [email, setEmail] = useState('farmer@cropcapture.app');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    const persona = PERSONAS[role] || PERSONAS.farmer;
    setEmail(persona.profile.email || `${role}@cropcapture.app`);
  };

  const handleQuickLogin = async (role: UserRole) => {
    setIsLoading(true);
    try {
      await loginAsRole(role);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Sign-In Error', e?.message || 'Failed to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Incomplete Form', 'Please enter your account email address.');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="scan-outline" size={32} color="#A3E635" />
            </View>
            <Text style={styles.brandTitle}>CropCapture</Text>
            <Text style={styles.brandTagline}>From field to frame. Every harvest verified.</Text>
            <View style={styles.pillRow}>
              <View style={styles.idPill}>
                <Ionicons name="lock-closed" size={12} color="#A3E635" />
                <Text style={styles.idPillText}>Role-Based Agricultural Access</Text>
              </View>
            </View>
          </View>

          {/* Quick One-Tap Role Selector */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Choose Your Operating Persona</Text>
            <Text style={styles.sectionSubtitle}>
              Tap any role below for instant demo authentication or choose your account role:
            </Text>

            <View style={styles.roleGrid}>
              {DEMO_ROLES.map((r) => {
                const isSelected = selectedRole === r.role;
                return (
                  <TouchableOpacity
                    key={r.role}
                    style={[
                      styles.roleCard,
                      isSelected && { borderColor: r.color, backgroundColor: '#F0FDF4' },
                    ]}
                    onPress={() => handleSelectRole(r.role)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roleCardTop}>
                      <View style={[styles.roleIconCircle, { backgroundColor: isSelected ? r.color : '#E2E8F0' }]}>
                        <Ionicons
                          name={r.icon as any}
                          size={18}
                          color={isSelected ? '#FFFFFF' : '#475569'}
                        />
                      </View>
                      <View style={[styles.roleBadge, { backgroundColor: `${r.color}20` }]}>
                        <Text style={[styles.roleBadgeText, { color: r.color }]}>{r.badge}</Text>
                      </View>
                    </View>

                    <Text style={styles.roleTitle}>{r.title}</Text>
                    <Text style={styles.roleSubtitle}>{r.subtitle}</Text>

                    <TouchableOpacity
                      style={[styles.instantLoginBtn, { backgroundColor: r.color }]}
                      onPress={() => handleQuickLogin(r.role)}
                    >
                      <Text style={styles.instantLoginBtnText}>Instant Sign In</Text>
                      <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Traditional Credentials Form */}
          <View style={styles.sectionCard}>
            <Text style={styles.formSectionTitle}>Account Credentials</Text>
            <Text style={styles.formSectionSub}>Sign in with your verified national credentials</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Official Email Address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@cropcapture.app"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Security Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Verifying Account...' : `Sign In as ${selectedRole.replace('_', ' ').toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Offline Security Footer */}
          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#A3E635" />
            <Text style={styles.footerNoteText}>
              Offline-First Secure Storage: Data remains protected and encrypted locally when internet access is absent.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D221A',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    borderWidth: 2,
    borderColor: '#A3E635',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  brandTitle: {
    fontSize: Typography.sizes.title,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: Typography.sizes.sm,
    color: '#A3E635',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  pillRow: {
    marginTop: Spacing.sm,
  },
  idPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  idPillText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeader: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  roleCard: {
    width: (SCREEN_WIDTH - Spacing.md * 2 - Spacing.md * 2 - Spacing.sm) / 2,
    minWidth: 135,
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  roleSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
    minHeight: 26,
  },
  instantLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  instantLoginBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formSectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  formSectionSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 48,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginTop: Spacing.xs,
  },
  submitButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
  },
});
