import type { UserRole } from '../types/database';

/** Where a signed-in user starts. A buyer has no farm tabs: they scan harvest QR codes. */
export const homeRouteFor = (role: UserRole | string | null | undefined): string => (role === 'buyer' ? '/buyer' : '/(tabs)');
