import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input, Button, toast, Modal } from "../components/ui";
import { api } from "../services/api";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Activity, Users, KeyRound, Smartphone, RefreshCw } from "lucide-react";
import logo from "../assets/logo.png";
import GoogleLogo from "../components/GoogleLogo";
import AppleLogo from "../components/AppleLogo";
import { validateRealEmail } from "../utils/validation";

import { useAuth } from "../context/AuthContext";

export default function Login({ onLogin }: { onLogin?: () => void }) {
  const navigate = useNavigate();
  const { login, googleLogin, appleLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // OTP Password Reset State (Dual-Channel SMS & Email)
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetChannel, setResetChannel] = useState<"sms" | "email">("sms");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [resetMaskedDest, setResetMaskedDest] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resendingSms, setResendingSms] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast("Please fill in all fields", "warning");
      return;
    }

    const emailCheck = validateRealEmail(email);
    if (!emailCheck.isValid) {
      toast(emailCheck.error || "Please provide a valid, legitimate email address.", "warning");
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      setLoading(false);
      toast("Welcome back!", "success");
      if (onLogin) {
        onLogin();
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setLoading(false);
      console.error("Authentication failed:", err);
      let errMsg = err.response?.data?.message || err.message;
      if (!err.response && (err.message === "Network Error" || err.code === "ERR_NETWORK")) {
        errMsg = "Network Error: Unable to reach backend server. Please verify backend status or refresh.";
      } else if (!errMsg) {
        errMsg = "Invalid email or password. Please verify your credentials.";
      }
      toast(Array.isArray(errMsg) ? errMsg[0] : errMsg, "error");
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await googleLogin();
      setGoogleLoading(false);
      toast("Authenticated successfully via Google!", "success");
      if (onLogin) {
        onLogin();
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setGoogleLoading(false);
      const errMsg = err.response?.data?.message || err.message || "Failed to sign in with Google";
      toast(Array.isArray(errMsg) ? errMsg[0] : errMsg, "error");
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      await appleLogin();
      setAppleLoading(false);
      toast("Authenticated successfully via Apple!", "success");
      if (onLogin) {
        onLogin();
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setAppleLoading(false);
      const errMsg = err.response?.data?.message || err.message || "Failed to sign in with Apple";
      toast(Array.isArray(errMsg) ? errMsg[0] : errMsg, "error");
    }
  };

  const handleOpenOtpModal = async () => {
    const currentEmail = email || localStorage.getItem("admin_email") || "";
    let currentPhone = localStorage.getItem("admin_phone") || "";
    setSavedEmail(currentEmail);
    setSavedPhone(currentPhone);
    setResetChannel("sms");
    setResetIdentifier(currentPhone);
    setResetMaskedDest("");
    setResetOtp("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetStep(1);
    setOtpModalOpen(true);

    // If phone is empty but email is available, automatically look up phone from backend
    if (!currentPhone && currentEmail) {
      try {
        const contact = await api.lookupContact(currentEmail);
        if (contact && contact.phone) {
          setSavedPhone(contact.phone);
          setResetIdentifier(contact.phone);
          localStorage.setItem("admin_phone", contact.phone);
        }
      } catch {}
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = resetIdentifier.trim();
    if (!val) {
      toast(resetChannel === "sms" ? "Please enter your mobile phone number" : "Please enter your administrator email", "warning");
      return;
    }
    if (resetChannel === "email") {
      const emailCheck = validateRealEmail(val);
      if (!emailCheck.isValid) {
        toast(emailCheck.error || "Please enter a valid email", "warning");
        return;
      }
    }
    setResetLoading(true);
    setResetOtp("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    try {
      const currentEmail = (savedEmail || (email.includes("@") ? email : "")).trim();
      const currentPhone = (resetChannel === "sms" ? val : (savedPhone || "")).trim();
      const res = await api.requestPasswordReset(val, resetChannel, {
        email: currentEmail || undefined,
        phone: currentPhone || undefined,
      });
      const dest = res.destination || val;
      setResetMaskedDest(dest);
      toast(
        resetChannel === "sms"
          ? `6-Digit OTP code sent via SMS to ${dest}! (Valid for 5 minutes)`
          : `6-Digit OTP code sent via Email to ${dest}! (Valid for 5 minutes)`,
        "success"
      );
      setResetOtp("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setResetStep(2);
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to request password reset code", "error");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendOtp = async (targetChannel: "sms" | "email") => {
    if (targetChannel === "sms") setResendingSms(true);
    else setResendingEmail(true);
    try {
      const currentEmail = (savedEmail || (email.includes("@") ? email : "")).trim();
      const currentPhone = (targetChannel === "sms" ? resetIdentifier.trim() : (savedPhone || "")).trim();
      const res = await api.requestPasswordReset(resetIdentifier.trim(), targetChannel, {
        email: currentEmail || undefined,
        phone: currentPhone || undefined,
      });
      setResetChannel(targetChannel);
      const dest = res.destination || resetIdentifier.trim();
      setResetMaskedDest(dest);
      toast(`New 6-digit OTP code sent via ${targetChannel.toUpperCase()} to ${dest}!`, "success");
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || `Failed to resend OTP via ${targetChannel.toUpperCase()}`, "error");
    } finally {
      setResendingSms(false);
      setResendingEmail(false);
    }
  };

  const handleConfirmResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtp || !resetNewPassword) {
      toast("Please fill in OTP code and new password", "warning");
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast("Passwords do not match", "warning");
      return;
    }
    if (resetNewPassword.length < 6) {
      toast("Password must be at least 6 characters", "warning");
      return;
    }
    setResetLoading(true);
    try {
      const currentEmail = (savedEmail || (email.includes("@") ? email : "")).trim();
      const currentPhone = (resetChannel === "sms" ? resetIdentifier.trim() : (savedPhone || "")).trim();
      await api.confirmPasswordReset(resetIdentifier.trim(), resetOtp.trim(), resetNewPassword, {
        email: currentEmail || undefined,
        phone: currentPhone || undefined,
      });
      toast("Password reset successfully! You can now sign in with your new password.", "success");
      if (resetIdentifier.includes("@")) {
        setEmail(resetIdentifier.trim());
      }
      setPassword(resetNewPassword);
      setOtpModalOpen(false);
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Invalid or expired OTP code", "error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-tr from-[#0a5c4e] via-[#0d7c6a] to-[#1b6fba] text-white p-8 md:p-16 flex-col justify-between relative overflow-hidden">
        {/* Decorative backdrop shapes */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full bg-cyan-400/10 blur-2xl animate-pulse" />

        {/* Brand header */}
        <div className="flex items-center gap-3 relative z-10">
          <img src={logo} alt="Merihcare Logo" className="w-10 h-10 rounded-full object-cover border border-white/20" />
          <div>
            <h1 className="text-lg font-bold tracking-wider leading-none">MERIHCARE</h1>
            <span className="text-[10px] text-cyan-200 font-semibold tracking-widest uppercase">Admin Portal</span>
          </div>
        </div>

        {/* Mid slogan */}
        <div className="my-12 md:my-0 space-y-4 relative z-10 max-w-md">
          <h2 className="text-3xl md:text-4xl font-bold font-sans leading-tight">
            Ethiopia's Leading Home Healthcare Network
          </h2>
          <p className="text-sm text-cyan-50 opacity-90 leading-relaxed">
            Manage provider credential approvals, track real-time locations across Addis Ababa, audit transactions, and resolve complaints instantly.
          </p>
        </div>

        {/* Statistics list */}
        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6 relative z-10">
          <div>
            <p className="text-xl font-bold flex items-center gap-1.5"><Users size={16} className="text-cyan-200" /> 1.2k+</p>
            <p className="text-[10px] text-cyan-100 uppercase tracking-wider mt-0.5">Patients</p>
          </div>
          <div>
            <p className="text-xl font-bold flex items-center gap-1.5"><ShieldCheck size={16} className="text-cyan-200" /> 120+</p>
            <p className="text-[10px] text-cyan-100 uppercase tracking-wider mt-0.5">Clinicians</p>
          </div>
          <div>
            <p className="text-xl font-bold flex items-center gap-1.5"><Activity size={16} className="text-cyan-200" /> 91%</p>
            <p className="text-[10px] text-cyan-100 uppercase tracking-wider mt-0.5">Success Rate</p>
          </div>
        </div>
      </div>

      {/* Right panel: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-slate-50 dark:bg-slate-900">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile-only brand header */}
          <div className="flex md:hidden items-center gap-3 mb-2 justify-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0d7c6a] to-[#1b6fba] flex items-center justify-center">
              <img src={logo} alt="Merihcare Logo" className="w-8 h-8 rounded-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#18232e] dark:text-white tracking-wider">MERIHCARE</p>
              <p className="text-[10px] text-[#8a9aaa] tracking-widest uppercase">Admin Portal</p>
            </div>
          </div>

          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>
              Sign In
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your administrator credentials to access governance features.
            </p>
          </div>


          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@merihcare.et"
              required
              leftIcon={<Mail size={16} />}
            />

            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              leftIcon={<Lock size={16} />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                <input type="checkbox" className="rounded border-slate-300 dark:border-slate-700 text-[#0d7c6a] focus:ring-[#0d7c6a]" />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleOpenOtpModal}
                className="text-[#0d7c6a] hover:underline font-semibold cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <Button type="submit" loading={loading} fullWidth className="mt-2 py-3">
              Sign In
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 dark:bg-slate-900 px-3 text-slate-400 font-medium tracking-wider">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading || appleLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-sm transition-all hover:shadow cursor-pointer"
            >
              {googleLoading ? (
                <div className="w-4 h-4 border-2 border-[#0d7c6a] border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleLogo size={16} />
              )}
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={loading || googleLoading || appleLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-slate-900 dark:border-slate-700 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-100 font-semibold text-xs shadow-sm transition-all hover:shadow cursor-pointer"
            >
              {appleLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <AppleLogo size={16} />
              )}
              <span>Apple</span>
            </button>
          </div>

          <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
            Don't have an administrator account?{" "}
            <Link to="/signup" className="text-[#0d7c6a] hover:underline font-semibold">
              Request access / Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password OTP Modal */}
      <Modal
        open={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        title={resetStep === 1 ? "Reset Password via OTP" : "Enter Verification OTP"}
      >
        {resetStep === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 text-xs">
            {/* Channel Selection Toggle */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Choose Verification Delivery Channel:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setResetChannel("sms");
                    if (savedPhone) {
                      setResetIdentifier(savedPhone);
                    } else {
                      const emailToLookup = savedEmail || (resetIdentifier.includes("@") ? resetIdentifier : "");
                      if (emailToLookup) {
                        try {
                          const contact = await api.lookupContact(emailToLookup);
                          if (contact && contact.phone) {
                            setSavedPhone(contact.phone);
                            setResetIdentifier(contact.phone);
                            localStorage.setItem("admin_phone", contact.phone);
                          }
                        } catch {}
                      }
                    }
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    resetChannel === "sms"
                      ? "border-[#0d7c6a] bg-[#0d7c6a]/10 text-[#0d7c6a] dark:text-[#2dd4bf] shadow-sm ring-1 ring-[#0d7c6a]"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <Smartphone size={15} />
                  <span>Via SMS (Phone)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetChannel("email");
                    setResetIdentifier(savedEmail || (resetIdentifier.includes("@") ? resetIdentifier : ""));
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    resetChannel === "email"
                      ? "border-[#0d7c6a] bg-[#0d7c6a]/10 text-[#0d7c6a] dark:text-[#2dd4bf] shadow-sm ring-1 ring-[#0d7c6a]"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <Mail size={15} />
                  <span>Via Email</span>
                </button>
              </div>
            </div>

            <p className="text-[#4a5a6a] dark:text-slate-300 leading-relaxed">
              {resetChannel === "sms"
                ? "Enter your registered mobile phone number. We will send a secure 6-digit OTP via SMS (valid for 5 minutes)."
                : "Enter your registered administrator email address. We will send a secure 6-digit OTP code (valid for 5 minutes)."}
            </p>

            {resetChannel === "sms" ? (
              <Input
                label="Administrator Mobile Phone"
                type="tel"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="0911223344 or +251911223344"
                required
                leftIcon={<Smartphone size={16} />}
              />
            ) : (
              <Input
                label="Administrator Email"
                type="email"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="admin@merihcare.et"
                required
                leftIcon={<Mail size={16} />}
              />
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <Button type="button" variant="ghost" onClick={() => setOtpModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={resetLoading}>
                {resetChannel === "sms" ? "Send SMS OTP" : "Send Email OTP"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmResetOtp} autoComplete="off" noValidate className="space-y-4 text-xs relative">
            {/* Decoy inputs to absorb browser password manager autofill and prevent pre-populating saved credentials */}
            <input type="text" name="fake_username_remembered" tabIndex={-1} aria-hidden="true" autoComplete="username" style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none", zIndex: -1 }} />
            <input type="password" name="fake_password_remembered" tabIndex={-1} aria-hidden="true" autoComplete="current-password" style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none", zIndex: -1 }} />

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300">
              <p className="font-semibold text-xs mb-1">
                6-Digit OTP Dispatched via {resetChannel.toUpperCase()}
              </p>
              <p className="text-[11px] leading-relaxed">
                Sent to <strong className="text-slate-900 dark:text-white">{resetMaskedDest || resetIdentifier}</strong>. Valid strictly for <strong>5 minutes</strong>.
              </p>
            </div>

            <Input
              label="6-Digit OTP Code"
              type="text"
              name="otp_verification_code_field"
              id="otp_verification_code_field"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="e.g. 123456"
              maxLength={6}
              required
              leftIcon={<KeyRound size={16} />}
            />
            <Input
              label="New Password"
              type="password"
              name="new_password_account_reset"
              id="new_password_account_reset"
              autoComplete="new-password"
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              leftIcon={<Lock size={16} />}
            />
            <Input
              label="Confirm New Password"
              type="password"
              name="confirm_password_account_reset"
              id="confirm_password_account_reset"
              autoComplete="new-password"
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              leftIcon={<Lock size={16} />}
            />

            {/* Resend via SMS vs Email */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Didn't receive code?</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={resendingSms || resendingEmail}
                  onClick={() => handleResendOtp("sms")}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0d7c6a] dark:text-[#2dd4bf] hover:bg-[#0d7c6a]/10 rounded border border-[#0d7c6a]/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Smartphone size={12} />
                  <span>{resendingSms ? "Sending..." : "Resend SMS"}</span>
                </button>
                <button
                  type="button"
                  disabled={resendingSms || resendingEmail}
                  onClick={() => handleResendOtp("email")}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0d7c6a] dark:text-[#2dd4bf] hover:bg-[#0d7c6a]/10 rounded border border-[#0d7c6a]/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Mail size={12} />
                  <span>{resendingEmail ? "Sending..." : "Resend Email"}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <button
                type="button"
                onClick={() => setResetStep(1)}
                className="text-xs text-[#0d7c6a] hover:underline font-semibold cursor-pointer"
              >
                ← Back
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOtpModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={resetLoading}>
                  Set New Password
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
