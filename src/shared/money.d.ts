export type Currency = 'USD' | 'LRD';
export const CURRENCIES: Currency[];
export function currencyOf(record: { currency?: string | null } | null | undefined): Currency;
export function symbolOf(currency: Currency): string;
export function formatMoney(amount: number | string | null | undefined, currency?: Currency): string;
