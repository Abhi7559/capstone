import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useChangePassword } from "@/hooks/useLogin";
import {
  type ChangePasswordValues,
  changePasswordSchema,
} from "@/schemas/auth.schema";
import { useAuthStore } from "@/store/useAuthStore";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const { currentUser, logout } = useAuthStore();
  const { changePassword, isLoading, error } = useChangePassword();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
  });

  useEffect(() => {
    if (isOpen && currentUser?.email) {
      setValue("email", currentUser.email);
    }
    if (!isOpen) {
      reset();
    }
  }, [isOpen, currentUser?.email, setValue, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: ChangePasswordValues) => {
    try {
      await changePassword(data);
      onClose();
      logout();
      await signOut({ callbackUrl: "/login?passwordChanged=true" });
    } catch {
      // Error handled via mutation state 'error'
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-gray-100">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200 mb-1">
              🔑 Security
            </div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">
              Change Password
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Update your account password. You will be signed out upon success.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <input type="hidden" {...register("email")} />

          {/* Current Password */}
          <div>
            <label
              htmlFor="currentPasswordInput"
              className="block text-xs font-bold text-gray-700 mb-1"
            >
              Current Password *
            </label>
            <div className="relative">
              <input
                id="currentPasswordInput"
                type={showCurrentPassword ? "text" : "password"}
                maxLength={64}
                placeholder="Enter current password"
                className={`w-full rounded-xl border pl-3.5 pr-10 py-2 text-xs outline-none transition focus:ring-2 ${
                  errors.currentPassword
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                }`}
                {...register("currentPassword")}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                {showCurrentPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="modalNewPasswordInput"
              className="block text-xs font-bold text-gray-700 mb-1"
            >
              New Password *
            </label>
            <div className="relative">
              <input
                id="modalNewPasswordInput"
                type={showNewPassword ? "text" : "password"}
                maxLength={64}
                placeholder="Enter new strong password"
                className={`w-full rounded-xl border pl-3.5 pr-10 py-2 text-xs outline-none transition focus:ring-2 ${
                  errors.newPassword
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                }`}
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                {errors.newPassword.message}
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
              htmlFor="modalConfirmPasswordInput"
              className="block text-xs font-bold text-gray-700 mb-1"
            >
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                id="modalConfirmPasswordInput"
                type={showConfirmPassword ? "text" : "password"}
                maxLength={64}
                placeholder="Re-enter new password"
                className={`w-full rounded-xl border pl-3.5 pr-10 py-2 text-xs outline-none transition focus:ring-2 ${
                  errors.confirmPassword
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                }`}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {isLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
