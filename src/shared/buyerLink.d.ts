export const DEFAULT_BASE: string;
export const CODE_PATTERN: RegExp;
export function isPublicCode(v: unknown): boolean;
export function publicCodeFromBytes(bytes: ArrayLike<number>): string;
export function buyerUrl(code: string, base?: string): string;
export function parseScanned(raw: string): { kind: 'code' | 'token'; value: string };
