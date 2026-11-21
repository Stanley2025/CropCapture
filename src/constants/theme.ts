import { Platform, ViewStyle, TextStyle } from 'react-native';

export const Colors = {
  // V2 Brand & Core Palette
  primary: '#1B7F36',
  primaryDark: '#0F3D22',
  text: '#17301F',
  textMuted: '#5B6F61',
  background: '#F3F8F1',
  card: '#FFFFFF',
  border: '#E1ECDD',
  tint: '#DDF0D8',
  tintSoft: '#E4F4DF',
  lime: '#A5D65A',
  amber: '#F2A93B',
  amberBg: '#FFF3D2',
  amberText: '#4A3000',
  sky: '#B9E2F3',
  inputBg: '#F7FBF5',
  inputBorder: '#C9DBC4',
  danger: '#A3321F',
  dangerBg: '#FBE5DF',

  // Crop colors for field thumbnails and badges
  cropRice: '#3F9A3C',
  cropCassava: '#7C9F34',
  cropCocoa: '#6B4226',
  cropVegetables: '#488B49',
  cropCoffee: '#4A2E18',

  // Compatibility aliases
  white: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7FBF5',
  primaryLight: '#DDF0D8',
  warning: '#F2A93B',
  warningLight: '#FFF3D2',
  dangerLight: '#FBE5DF',
  info: '#B9E2F3',
  infoLight: '#EBF7FD',
  accent: '#A5D65A',
  harvestGold: '#F2A93B',
  harvestLight: '#FFF3D2',
  syncActive: '#1B7F36',
  borderDark: '#C9DBC4',
};

export const FontFamily = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
};

export const Typography = {
  screenTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.text,
  } as TextStyle,

  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text,
  } as TextStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  } as TextStyle,

  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  } as TextStyle,

  secondary: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  } as TextStyle,

  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
  } as TextStyle,

  tabularNumber: {
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  } as TextStyle,

  // Compatibility scale
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    title: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const Spacing = {
  grid: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // screen horizontal padding
  xxl: 24,
  xxxl: 32,
  section: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16, // input boxes
  iconBubble: 20,
  card: 24, // cards 22-24
  headerCurve: 36, // curved bottom corners of colored header
  pill: 9999, // buttons and chips fully rounded
  full: 9999,
  xl: 24,
};

export const Shadows = {
  // Single soft card shadow (iOS shadow + Android elevation), no blurs/glows
  card: {
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  } as ViewStyle,

  floating: {
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  } as ViewStyle,
};
