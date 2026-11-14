import React, { useState } from "react";
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  Shield,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AuthModal({ isOpen, onClose, initialMode = "signin" }) {
  const { loginWithGoogle, loginWithEmail, signupWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signin") {
        await loginWithEmail(email, password);
        onClose();
      } else if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        await signupWithEmail(email, password, displayName);
        onClose();
      } else if (mode === "forgot") {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-950/50">
            <Sparkles className="w-5 h-5 fill-slate-950" />
          </div>
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight">
              {mode === "signin" && "Welcome to RecallOps"}
              {mode === "signup" && "Create Your Account"}
              {mode === "forgot" && "Reset Password"}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === "signin" && "Sign in to access your isolated equipment memories"}
              {mode === "signup" && "Register your personal workspace with strict data privacy"}
              {mode === "forgot" && "Enter your email to receive a password reset link"}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert for Password Reset */}
        {resetSent && mode === "forgot" ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Reset Link Dispatched</p>
                <p className="mt-1 text-emerald-400/90">
                  We've sent password reset instructions to <strong className="text-white">{email}</strong>. Please check your inbox and spam folder.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setResetSent(false);
                setMode("signin");
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <>
            {/* Google Sign-In Button */}
            {mode !== "forgot" && (
              <div className="space-y-4 mb-5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-800 w-full" />
                  <span className="bg-slate-900 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    or continue with email
                  </span>
                </div>
              </div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="technician@plant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setMode("forgot");
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-950" />}
                <span>
                  {mode === "signin" && "Sign In to RecallOps"}
                  {mode === "signup" && "Create My Account"}
                  {mode === "forgot" && "Send Reset Link"}
                </span>
              </button>
            </form>

            {/* Switch Mode Footer */}
            <div className="mt-5 text-center text-xs text-slate-400 pt-3 border-t border-slate-800/80">
              {mode === "signin" && (
                <p>
                  Don't have an account yet?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMode("signup");
                    }}
                    className="font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    Sign up
                  </button>
                </p>
              )}
              {mode === "signup" && (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMode("signin");
                    }}
                    className="font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    Sign in
                  </button>
                </p>
              )}
              {mode === "forgot" && (
                <p>
                  Remembered your password?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setMode("signin");
                    }}
                    className="font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    Back to sign in
                  </button>
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Isolated User Workspaces • 256-bit Encrypted</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
