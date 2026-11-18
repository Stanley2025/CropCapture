export const Colors = {
  // Master Prompt Liberian Agricultural Identity
  primary: '#15803D',       // Primary green
  primaryDark: '#14532D',   // Dark green
  primaryLight: '#DCFCE7',  // Light green
  background: '#F8FAFC',    // Slate-50 background
  surface: '#FFFFFF',       // Card and modal white
  surfaceAlt: '#F1F5F9',    // Slate-100 for secondary backgrounds
  white: '#FFFFFF',         // Crisp white
  text: '#1E293B',          // Main text (slate-800)
  textMuted: '#64748B',     // Slate-500 secondary text
  border: '#E2E8F0',        // Slate-200 border
  borderDark: '#CBD5E1',    // Slate-300
  accent: '#16A34A',        // Green-600
  harvestGold: '#CA8A04',   // Warm harvest gold
  harvestLight: '#FEF9C3',  // Light gold
  danger: '#DC2626',        // Red-600
  dangerLight: '#FEE2E2',   // Red-100
  warning: '#D97706',       // Amber-600
  warningLight: '#FEF3C7',  // Amber-100
  info: '#2563EB',          // Blue-600
  infoLight: '#DBEAFE',     // Blue-100
  syncActive: '#059669',    // Emerald-600
};

export const Typography = {
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
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};
