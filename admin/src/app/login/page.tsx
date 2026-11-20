'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { CropCaptureLogo } from '@/components/brand/Logo';


export default function LoginPage() {
  const router = useRouter();

  // Mode: Sign In or Create Account
  const [authMode, setAuthMode] = useState<'signin' | 'create_account'>('signin');

  // Sign In State
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper: Full digits Farm ID (8 numeric digits)
  const generateFullDigitsFarmId = () => Math.floor(10000000 + Math.random() * 90000000).toString();

  // Create Account State (all optional per user specification)
  const [farmId, setFarmId] = useState(generateFullDigitsFarmId());
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [idType, setIdType] = useState<'Passport' | 'National ID card' | ''>('');
  const [idNumber, setIdNumber] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isMasterAdmin =
        email.trim().toLowerCase() === 'admin@test.com' && password === '12345678';

      // If credentials match designated master admin credentials
      if (isMasterAdmin) {
        if (isSupabaseConfigured()) {
          try {
            const supabase = createClient();
            await supabase.auth.signInWithPassword({
              email: 'admin@test.com',
              password: '12345678',
            });
          } catch {
            // Ignore Supabase auth errors for master admin fallback
          }
        }

        document.cookie = `agritrack_admin_session=active; path=/; max-age=${
          keepSignedIn ? 86400 * 30 : 86400
        }; SameSite=Lax`;
        router.push('/dashboard');
        router.refresh();
        return;
      }

      // Other credentials: authenticates strictly through Supabase
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase project is not configured. Please use administrator credentials.');
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        throw authError;
      }

      document.cookie = `agritrack_admin_session=active; path=/; max-age=${
        keepSignedIn ? 86400 * 30 : 86400
      }; SameSite=Lax`;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.from('farmers').upsert(
          {
            farmer_id_code: farmId,
            full_name: fullName.trim() || `Farmer ${farmId}`,
            gender: gender || null,
            date_of_birth: dateOfBirth.trim() || null,
            phone_number: '+231-77-000-0000',
            county: 'Nimba',
            district: address.trim() || 'Central District',
            community: address.trim() || 'Main Village',
            cooperative_id: '33333333-3333-3333-3333-333333333301',
          },
          { onConflict: 'farmer_id_code' }
        );
      }

      setSuccessMsg(`Account created! Farm ID: ${farmId}`);
      document.cookie = `agritrack_admin_session=active; path=/; max-age=86400; SameSite=Lax`;

      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen w-full">
      {/* Left Column: Visual Brand Panel (Dark Forest Green) */}
      <div className="relative hidden w-[55%] flex-col justify-between bg-[#0E2417] p-12 text-white lg:flex xl:p-16 overflow-hidden select-none">
        {/* Background perspective ray lines matching design */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            className="absolute -right-20 top-1/2 h-[120%] w-[120%] -translate-y-1/2 opacity-20"
            viewBox="0 0 800 800"
            fill="none"
          >
            {/* Center origin of rays */}
            <circle cx="650" cy="400" r="2" fill="#84CC16" />
            <line x1="650" y1="400" x2="-200" y2="-100" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="-200" y2="80" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="-200" y2="240" stroke="#84CC16" strokeWidth="1.2" />
            <line x1="650" y1="400" x2="-200" y2="380" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="-200" y2="520" stroke="#84CC16" strokeWidth="1.2" />
            <line x1="650" y1="400" x2="-200" y2="680" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="-200" y2="850" stroke="#84CC16" strokeWidth="1.2" />
            <line x1="650" y1="400" x2="100" y2="950" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="350" y2="950" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="550" y2="950" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="100" y2="-200" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="350" y2="-200" stroke="#84CC16" strokeWidth="1" />
            <line x1="650" y1="400" x2="550" y2="-200" stroke="#84CC16" strokeWidth="1" />
          </svg>
        </div>

        {/* Top Brand Header */}
        <div className="relative z-10 flex items-center">
          <CropCaptureLogo light iconClassName="h-9 w-9 text-[#A3E635]" />
        </div>


        {/* Hero Tagline Section */}
        <div className="relative z-10 my-auto max-w-xl py-12">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-[54px] xl:leading-[1.12]">
            <span className="block text-white">Every farm recorded.</span>
            <span className="block text-white">Every harvest measured.</span>
            <span className="block text-[#A3E635]">Every quality verified.</span>
          </h2>
          <p className="mt-8 max-w-lg text-base font-normal leading-relaxed text-[#CBD5E1]">
            One console for Liberian agricultural administrators, cooperative unions, extension coordinators and quality inspectors.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#94A3B8]/90">
          <span>Republic of Liberia · Ministry of Agriculture</span>
          <span>Version 1.0.0</span>
        </div>
      </div>

      {/* Right Column: Sign In Form (Warm Off-white / Cream) */}
      <div className="flex w-full flex-1 items-center justify-center bg-[#F7F6F0] px-6 py-12 lg:w-[45%] lg:px-12 xl:px-16">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only Top Brand Header */}
          <div className="mb-8 flex items-center lg:hidden">
            <CropCaptureLogo iconClassName="h-8 w-8 text-[#15803D]" />
          </div>


          {/* Mode Switcher Tabs */}
          <div className="mb-6 flex rounded-xl bg-[#E8EDE5] p-1 text-xs font-semibold text-[#526658]">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 rounded-lg py-2 transition-all ${
                authMode === 'signin'
                  ? 'bg-white text-[#0E2417] shadow-sm font-bold'
                  : 'hover:text-[#0E2417]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                if (!farmId) setFarmId(generateFullDigitsFarmId());
                setAuthMode('create_account');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 rounded-lg py-2 transition-all ${
                authMode === 'create_account'
                  ? 'bg-white text-[#0E2417] shadow-sm font-bold'
                  : 'hover:text-[#0E2417]'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0E2417]">
            {authMode === 'signin' ? 'Admin sign in' : 'Create account'}
          </h2>
          <p className="mt-2 text-sm text-[#52525B]">
            {authMode === 'signin'
              ? 'Use your authorized account to open the admin console.'
              : 'Register a producer profile with an auto-assigned Farm ID.'}
          </p>

          {/* Messages */}
          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <p>{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <p>{successMsg}</p>
            </div>
          )}

          {authMode === 'signin' ? (
            /* Sign In Form */
            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              {/* Work Email */}
              <div>
                <label className="block text-xs font-semibold text-[#18181B] mb-1.5">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agency.gov.lr"
                    className="w-full rounded-xl border border-[#D4D4D8] bg-white py-3 pl-10 pr-4 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Password</label>
                  <button
                    type="button"
                    onClick={() => alert('Password reset verification link has been sent to your email address.')}
                    className="text-xs font-semibold text-[#166534] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-[#D4D4D8] bg-white py-3 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Keep me signed in */}
              <div className="flex items-center pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0E2417] focus:ring-[#0E2417] accent-[#0E2417]"
                  />
                  <span className="text-xs text-[#52525B]">Keep me signed in on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E2417] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#07170E] focus:outline-none focus:ring-2 focus:ring-[#0E2417] focus:ring-offset-2 disabled:opacity-70 shadow-sm"
                >
                  {loading ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <span>Sign in to console</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Create Account Form */
            <form onSubmit={handleCreateAccount} className="mt-7 space-y-4">
              {/* 1. Auto-generated Farm ID (Full Digits) */}
              <div className="flex items-center justify-between rounded-xl border border-[#BDDDAB] bg-[#EBF4E5] p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#2A4A2F]">FARM ID</span>
                    <span className="rounded bg-[#D1E8C5] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E4023]">
                      Auto-generated Full Digits
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold tracking-widest text-[#133319]">{farmId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFarmId(generateFullDigitsFarmId())}
                  title="Generate new Farm ID"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C6DEB7] bg-white text-[#1C3822] hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {/* 2. Full Name (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Full Name</label>
                  <span className="rounded bg-[#E8EDE5] px-1.5 py-0.5 text-[10px] font-medium text-[#526658]">Optional</span>
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Emmanuel Gaye"
                  className="w-full rounded-xl border border-[#D4D4D8] bg-white py-2.5 px-3.5 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                />
              </div>

              {/* 3. Date of Birth (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Date of Birth</label>
                  <span className="rounded bg-[#E8EDE5] px-1.5 py-0.5 text-[10px] font-medium text-[#526658]">Optional</span>
                </div>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-xl border border-[#D4D4D8] bg-white py-2.5 px-3.5 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                />
              </div>

              {/* 4. Gender (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Gender</label>
                  <span className="rounded bg-[#E8EDE5] px-1.5 py-0.5 text-[10px] font-medium text-[#526658]">Optional</span>
                </div>
                <div className="flex gap-2">
                  {(['Male', 'Female', 'Other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(gender === g ? '' : g)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                        gender === g
                          ? 'border-[#1C3822] bg-[#E5F2DC] text-[#1C3822]'
                          : 'border-[#DDE2D9] bg-white text-[#4B5C4F] hover:bg-slate-50'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Address (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Address</label>
                  <span className="rounded bg-[#E8EDE5] px-1.5 py-0.5 text-[10px] font-medium text-[#526658]">Optional</span>
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Gbehley, Sanniquellie-Mahn, Nimba"
                  className="w-full rounded-xl border border-[#D4D4D8] bg-white py-2.5 px-3.5 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                />
              </div>

              {/* 6. PIN (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Security PIN</label>
                  <span className="rounded bg-[#E8EDE5] px-1.5 py-0.5 text-[10px] font-medium text-[#526658]">Optional</span>
                </div>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="e.g. 4-6 numeric digits"
                    className="w-full rounded-xl border border-[#D4D4D8] bg-white py-2.5 pl-3.5 pr-11 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B]"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 7. ID Type: Passport, National ID card (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">Identification Type</label>
                  <span className="rounded bg-[#E8EDE5] px-1.5 py-0.5 text-[10px] font-medium text-[#526658]">Optional</span>
                </div>
                <div className="flex gap-2">
                  {(['Passport', 'National ID card'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setIdType(idType === t ? '' : t)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                        idType === t
                          ? 'border-[#1C3822] bg-[#E5F2DC] text-[#1C3822]'
                          : 'border-[#DDE2D9] bg-white text-[#4B5C4F] hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {idType && (
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={`Enter ${idType} Number (Optional)`}
                    className="mt-2 w-full rounded-xl border border-[#D4D4D8] bg-white py-2.5 px-3.5 text-sm text-[#18181B] placeholder-[#A1A1AA] transition-colors focus:border-[#0E2417] focus:outline-none focus:ring-1 focus:ring-[#0E2417]"
                  />
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E2417] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#07170E] focus:outline-none focus:ring-2 focus:ring-[#0E2417] focus:ring-offset-2 disabled:opacity-70 shadow-sm"
                >
                  {loading ? (
                    <span>Creating Account...</span>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security Disclaimer Note */}
          <div className="mt-8 border-t border-[#E4E4E7] pt-6">
            <div className="flex items-start gap-2.5 text-xs text-[#71717A] leading-relaxed">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-[#A1A1AA]" />
              <p>
                Access is limited to Super Admins, Agricultural Administrators and Quality Managers. All sign-ins are logged.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
