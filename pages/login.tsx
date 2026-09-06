import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useChangePassword, useLogin } from "@/hooks/useLogin";
import {
  type ChangePasswordValues,
  changePasswordSchema,
  type LoginCredentials,
  loginSchema,
} from "@/schemas/auth.schema";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useLogin();
  const {
    changePassword,
    isLoading: isChangingPassword,
    error: changePasswordError,
  } = useChangePassword();

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // First time login state
  const [pendingChangeUserEmail, setPendingChangeUserEmail] = useState<
    string | null
  >(null);
  const [_tempPasswordUsed, setTempPasswordUsed] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const {
    register: registerChange,
    handleSubmit: handleSubmitChange,
    setValue: setChangeValue,
    formState: { errors: changeErrors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
  });

  const onSubmit = (data: LoginCredentials) => {
    login(data, {
      onSuccess: (user) => {
        if (user.requiresPasswordChange) {
          setPendingChangeUserEmail(user.email);
          setTempPasswordUsed(data.password);
          setChangeValue("email", user.email);
          setChangeValue("currentPassword", data.password);
        }
      },
    });
  };

  const onChangePasswordSubmit = async (data: ChangePasswordValues) => {
    try {
      await changePassword(data);
      setPendingChangeUserEmail(null);
      router.push("/dashboard?loggedIn=true");
    } catch {
      // Handled in mutation error
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100 font-sans">
      {/* Left panel with modern dark slate gradient and centered balanced layout */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-10 xl:p-12 flex-col justify-center relative overflow-hidden h-full">
        {/* Background Accent Decorative Glows */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto space-y-6">
          {/* Logo & Platform Tag */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/30 border border-blue-400/30">
              TB
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white block leading-none">
                Internal Team Task Board
              </span>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1 block">
                Enterprise Project Governance
              </span>
            </div>
          </div>

          {/* Main Hero Headline & Subtitle */}
          <div className="space-y-2">
            <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Streamline Project Governance & Team Workflow
            </h2>
            <p className="text-slate-300 text-xs xl:text-sm leading-relaxed">
              Centralized platform for internal project management, Kanban task
              workflow tracking, and secure role-based access control.
            </p>
          </div>

          {/* 4 Feature Cards Block - Seamless Grid */}
          <div className="grid gap-3 pt-2">
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 backdrop-blur-md transition hover:border-slate-600">
              <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-extrabold border border-blue-500/30">
                01
              </span>
              <div>
                <h4 className="text-xs xl:text-sm font-bold text-slate-100">
                  Agile Kanban Board
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  Drag & drop tasks seamlessly across Backlog, To Do, In
                  Progress, Completed, and custom columns.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 backdrop-blur-md transition hover:border-slate-600">
              <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-extrabold border border-emerald-500/30">
                02
              </span>
              <div>
                <h4 className="text-xs xl:text-sm font-bold text-slate-100">
                  Granular Access Control
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  Role-based operations empowering Admins to manage members,
                  create custom columns, and assign projects.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 backdrop-blur-md transition hover:border-slate-600">
              <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-extrabold border border-purple-500/30">
                03
              </span>
              <div>
                <h4 className="text-xs xl:text-sm font-bold text-slate-100">
                  First-Time Login Security
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                  Enforces mandatory custom password update for auto-generated
                  temporary credentials.
                </p>
              </div>
            </div>
          </div>

          {/* Integrated Platform Badge Footer */}
          <div className="flex items-center space-x-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300">
              Internal Governance Platform
            </span>
            <span>•</span>
            <span>Next.js, TanStack Query & React Hook Form</span>
          </div>
        </div>
      </div>

      {/* Right panel: Login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Please enter your credentials to access your workspace.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                maxLength={254}
                placeholder="example@email.com"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${
                  errors.email
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                }`}
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  maxLength={64}
                  placeholder="••••••••"
                  className={`w-full rounded-lg border pl-3.5 pr-12 py-2.5 text-sm outline-none transition focus:ring-2 ${
                    errors.password
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                  }`}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition focus:outline-none"
                >
                  {showPassword ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 013.98.813c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.027-4.103a3 3 0 11-4.243-4.243m4.243 4.243L3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>

      {/* Mandatory First-Time Password Update Modal */}
      {Boolean(pendingChangeUserEmail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                🔒 Security Requirement
              </div>
              <h3 className="text-xl font-bold text-gray-900 tracking-tight pt-1">
                Update Your Password
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                You are logging in with an auto-generated temporary password.
                Please set a new secure password to proceed.
              </p>
            </div>

            {changePasswordError && (
              <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs font-medium text-red-700">
                {changePasswordError}
              </div>
            )}

            <form
              onSubmit={handleSubmitChange(onChangePasswordSubmit)}
              className="space-y-4"
              noValidate
            >
              <input type="hidden" {...registerChange("email")} />
              <input type="hidden" {...registerChange("currentPassword")} />

              {/* New Password */}
              <div>
                <label
                  htmlFor="newPasswordInput"
                  className="block text-xs font-bold text-gray-700 mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPasswordInput"
                    type={showNewPassword ? "text" : "password"}
                    maxLength={64}
                    placeholder="Enter new strong password"
                    className={`w-full rounded-xl border pl-3.5 pr-10 py-2 text-xs outline-none transition focus:ring-2 ${
                      changeErrors.newPassword
                        ? "border-red-500 focus:ring-red-200"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                    {...registerChange("newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {changeErrors.newPassword && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">
                    {changeErrors.newPassword.message}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-gray-400">
                  Must be at least 8 chars with uppercase, lowercase, number &
                  special char.
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPasswordInput"
                  className="block text-xs font-bold text-gray-700 mb-1"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPasswordInput"
                    type={showConfirmPassword ? "text" : "password"}
                    maxLength={64}
                    placeholder="Re-enter new password"
                    className={`w-full rounded-xl border pl-3.5 pr-10 py-2 text-xs outline-none transition focus:ring-2 ${
                      changeErrors.confirmPassword
                        ? "border-red-500 focus:ring-red-200"
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                    {...registerChange("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {changeErrors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">
                    {changeErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isChangingPassword
                    ? "Updating Password..."
                    : "Update Password & Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
