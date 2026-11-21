import * as Crypto from 'expo-crypto';
import { buyerUrl as makeUrl, publicCodeFromBytes } from '../shared/buyerLink';

/** Where the public buyer page lives. Set EXPO_PUBLIC_BUYER_BASE_URL to the admin site's address. */
export const BUYER_BASE_URL = process.env.EXPO_PUBLIC_BUYER_BASE_URL || 'https://farmtori.app';

export const buyerUrl = (code: string) => makeUrl(code, BUYER_BASE_URL);

/** A new unguessable code for a harvest (from the phone's secure random generator). */
export const newPublicCode = () => publicCodeFromBytes(Crypto.getRandomBytes(15));
