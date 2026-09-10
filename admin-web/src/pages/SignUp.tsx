import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input, Select, Button, toast } from "../components/ui";
import { api } from "../services/api";
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck, Activity, Users, Phone, KeyRound, CheckCircle2 } from "lucide-react";
import logo from "../assets/logo.png";
import GoogleLogo from "../components/GoogleLogo";
import { validateRealEmail } from "../utils/validation";
import { useAuth } from "../context/AuthContext";

export default function SignUp() {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("operations");
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Step 2: Email Verification OTP
  const [emailOtp, setEmailOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !phone) {
      toast("Please fill in all required fields including phone number", "warning");
      return;
    }

    const emailCheck = validateRealEmail(email);
    if (!emailCheck.isValid) {
      toast(emailCheck.error || "Please enter a legitimate, real email address.", "warning");
      return;
    }

    if (!agree) {
      toast("You must agree to the administrative terms and privacy policy", "warning");
      return;
    }

    setLoading(true);

    try {
      await api.signup(name, email, password, department, phone);
      setLoading(false);
      toast("Registration initiated! A 6-digit OTP has been sent to your email.", "success");
      setStep(2);
    } catch (err: any) {
      setLoading(false);
      const message = err.response?.data?.message || err.message || "Failed to submit registration";
      toast(Array.isArray(message) ? message[0] : message, "error");
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp || emailOtp.length < 6) {
      toast("Please enter the complete 6-digit verification code", "warning");
      return;
    }

    setVerifyingOtp(true);
    try {
      await api.confirmEmailVerification(email, emailOtp);
      toast("Email verified successfully! Your account is now confirmed.", "success");
      navigate("/login");
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Invalid or expired verification code";
      toast(Array.isArray(message) ? message[0] : message, "error");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await googleLogin();
      setGoogleLoading(false);
      toast("Authenticated successfully via Google!", "success");
      navigate("/");
    } catch (err: any) {
      setGoogleLoading(false);
      const message = err.response?.data?.message || err.message || "Failed to sign up with Google";
      toast(Array.isArray(message) ? message[0] : message, "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Left panel: Hero Brand Banner - hidden on mobile */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-tr from-[#0a5c4e] via-[#0d7c6a] to-[#1b6fba] text-white p-8 md:p-16 flex-col justify-between relative overflow-hidden">
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
            Administrative Access Request
          </h2>
          <p className="text-sm text-cyan-50 opacity-90 leading-relaxed">
            Registered accounts require email OTP verification and approval by a Platform Super-Administrator before dashboard access permissions are activated.
          </p>
        </div>

        {/* Statistics list */}
        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6 relative z-10">
          <div>
            <p className="text-xl font-bold flex items-center gap-1.5"><Users size={16} className="text-cyan-200" /> 1.2k+</p>
            <p className="text-[10px] text-cyan-100 uppercase tracking-wider mt-0.5">Patients</p>
          </div>
          <div>
            <p className="text-xl font-bold flex items-center gap-1.5"><ShieldCheck size={16} className="text-cyan-200" /> 450+</p>
            <p className="text-[10px] text-cyan-100 uppercase tracking-wider mt-0.5">Providers</p>
          </div>
          <div>
            <p className="text-xl font-bold flex items-center gap-1.5"><Activity size={16} className="text-cyan-200" /> 99.9%</p>
            <p className="text-[10px] text-cyan-100 uppercase tracking-wider mt-0.5">Uptime</p>
          </div>
        </div>
      </div>

      {/* Right panel: Sign up form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header branding */}
          <div className="flex md:hidden items-center gap-2 mb-4 justify-center">
            <img src={logo} alt="Merihcare Logo" className="w-8 h-8 rounded-full" />
            <span className="font-bold text-base text-[#0d7c6a] tracking-wider">MERIHCARE</span>
          </div>

          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {step === 1 ? "Create Administrator Account" : "Verify Real Email Address"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {step === 1
                ? "Submit your info to request an administrator seat for Merihcare."
                : `We've sent a 6-digit verification code to ${email}. Valid for 5 minutes.`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Abebe Kebede"
                required
                leftIcon={<User size={16} />}
              />

              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="abebe@merihcare.et"
                required
                leftIcon={<Mail size={16} />}
              />

              <Input
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+251 91 123 4567"
                required
                leftIcon={<Phone size={16} />}
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

              <Select
                label="Department / Assignment"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                options={[
                  { value: "operations", label: "Operations Management" },
                  { value: "clinical", label: "Clinical Verification Team" },
                  { value: "support", label: "Customer Support & Disputes" },
                  { value: "finance", label: "Finance & Commission Audit" },
                ]}
              />

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-[#0d7c6a] focus:ring-[#0d7c6a]"
                />
                <label htmlFor="agree" className="text-xs text-slate-600 dark:text-slate-400 leading-tight cursor-pointer">
                  I agree to the Merihcare administrative privacy regulations and platform auditing protocols.
                </label>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full !bg-[#0d7c6a] hover:!bg-[#0a6355] text-white py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-teal-900/10 transition-all cursor-pointer"
              >
                Continue & Verify Email
              </Button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-medium">or continue with</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              <Button
                type="button"
                variant="outline"
                loading={googleLoading}
                onClick={handleGoogleSignUp}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <GoogleLogo className="w-4 h-4" />
                <span>Google Workspace</span>
              </Button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                Already have an administrative account?{" "}
                <Link to="/login" className="text-[#0d7c6a] font-semibold hover:underline">
                  Sign In
                </Link>
              </p>
            </form>
          ) : (
            /* Step 2: Email Verification OTP Form */
            <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  Verification Code Sent
                </p>
                <p className="text-[11px] leading-relaxed">
                  Enter the 6-digit code sent to <strong>{email}</strong>. This code is valid strictly for <strong>5 minutes</strong> to confirm you own this email address.
                </p>
              </div>

              <Input
                label="6-Digit Verification Code"
                type="text"
                value={emailOtp}
                onChange={e => setEmailOtp(e.target.value)}
                placeholder="e.g. 123456"
                maxLength={6}
                required
                leftIcon={<KeyRound size={16} />}
              />

              <Button
                type="submit"
                loading={verifyingOtp}
                className="w-full !bg-[#0d7c6a] hover:!bg-[#0a6355] text-white py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-teal-900/10 transition-all cursor-pointer"
              >
                Verify Email & Complete Registration
              </Button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:underline"
                >
                  &larr; Change Details
                </button>
                <button
                  type="button"
                  onClick={handleSignUp}
                  className="text-[#0d7c6a] font-semibold hover:underline"
                >
                  Resend 5-Min Code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
