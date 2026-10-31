import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { apiEndpoint } from "@/utils/apiConfig";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read email & token from URL query params
  useEffect(() => {
    if (router.isReady) {
      if (typeof router.query.email === "string") {
        setEmail(router.query.email);
      }
      if (typeof router.query.token === "string") {
        setToken(router.query.token);
      }
    }
  }, [router.isReady, router.query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // First try directly calling the FastAPI backend via apiEndpoint
      let res: Response | null = null;
      try {
        res = await fetch(apiEndpoint("/auth/signup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            newPassword,
            confirmPassword,
            token: token || null,
          }),
        });
      } catch {
        // Direct call failed (network / CORS / bad domain)
      }

      // Fallback to local next route if backend direct call failed
      if (!res || !res.ok) {
        res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            newPassword,
            confirmPassword,
            token: token || undefined,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.detail || data.message || "Failed to set up account password.",
        );
      }

      // Redirect to login page with passwordChanged parameter
      router.push(
        `/login?passwordChanged=true&email=${encodeURIComponent(email)}`,
      );
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-slate-900/90 p-8 shadow-2xl border border-slate-800 backdrop-blur-xl">
        {/* Brand header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/30 border border-blue-400/30">
            TB
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white block leading-none">
              Team Hub
            </span>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1 block">
              Member Activation & Signup
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Create Your Password
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Welcome! Set up a secure password to activate your workspace
            account.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-950/60 p-3.5 border border-red-800 text-xs text-red-300 font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email input */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-3.5 pr-12 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Minimum 8 characters. Include numbers and symbols for strength.
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-3.5 pr-12 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3 text-xs font-bold text-white transition shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              {isLoading
                ? "Setting Password..."
                : "Set Password & Complete Signup"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an active account?{" "}
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            Log in here
          </Link>
        </div>
      </div>
    </div>
  );
}
