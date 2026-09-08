import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useInviteMember } from "@/hooks/useMembers";
import { inviteMemberSchema } from "@/schemas/member.schema";
import type { InviteMemberInput, InviteMemberResponse } from "@/types/auth";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const {
    inviteMember,
    isLoading: isInviting,
    error: inviteError,
    reset: resetMutation,
  } = useInviteMember();

  const [successResult, setSuccessResult] =
    useState<InviteMemberResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    mode: "onTouched",
  });

  const handleClose = () => {
    setSuccessResult(null);
    setCopied(false);
    resetForm();
    resetMutation();
    onClose();
  };

  const onSubmit = async (data: InviteMemberInput) => {
    try {
      const result = await inviteMember(data);
      setSuccessResult(result);
    } catch {
      // Error handled by hook
    }
  };

  const handleCopyPassword = () => {
    if (successResult?.temporaryPassword) {
      navigator.clipboard.writeText(successResult.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 md:p-7 shadow-xl border border-gray-100 font-sans">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Team Member</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Invite a new member to join the project workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {successResult ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 p-4 border border-green-200">
              <p className="text-xs font-bold text-green-900 mb-1">
                Member Invited Successfully!
              </p>
              <p className="text-xs text-green-700 leading-relaxed">
                Provide these credentials to the member so they can log in.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Name
                </span>
                <p className="text-sm font-semibold text-gray-900">
                  {successResult.member.name}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Email
                </span>
                <p className="text-sm font-semibold text-gray-900">
                  {successResult.member.email}
                </p>
              </div>
              {successResult.member.designation && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    Designation
                  </span>
                  <p className="text-sm font-semibold text-gray-900">
                    {successResult.member.designation}
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Temporary Password
                </span>
                <div className="flex items-center justify-between mt-1">
                  <code className="bg-white px-3 py-1.5 rounded-lg border border-gray-300 font-mono text-sm text-gray-800 font-bold select-all">
                    {successResult.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="ml-2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition"
                  >
                    {copied ? "Copied! ✓" : "Copy Password"}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-2.5"
            noValidate
          >
            {inviteError && (
              <div className="rounded-xl bg-red-50 p-3.5 border border-red-200">
                <p className="text-xs font-semibold text-red-800">
                  {inviteError}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="modalMemberName"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Name *
              </label>
              <input
                id="modalMemberName"
                type="text"
                placeholder="Name of the member"
                className={`w-full rounded-lg border h-11 px-3.5 text-xs outline-none transition ${errors.name
                    ? "border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                  }`}
                {...register("name")}
              />
              <div className="min-h-[18px] mt-1">
                {errors.name && (
                  <p className="text-[11px] text-red-600 font-medium">
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="modalMemberEmail"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Email *
              </label>
              <input
                id="modalMemberEmail"
                type="email"
                placeholder="example@email.com"
                className={`w-full rounded-lg border h-11 px-3.5 text-xs outline-none transition ${errors.email
                    ? "border-red-500 focus:ring-2 focus:ring-red-100"
                    : "border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                  }`}
                {...register("email")}
              />
              <div className="min-h-[18px] mt-1">
                {errors.email && (
                  <p className="text-[11px] text-red-600 font-medium">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="modalMemberDesignation"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Designation
              </label>
              <input
                id="modalMemberDesignation"
                type="text"
                placeholder="Graphics Designer / Software Engineer"
                className="w-full rounded-lg border border-gray-300 h-11 px-3.5 text-xs outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                {...register("designation")}
              />
              <div className="min-h-[18px] mt-1" />
            </div>

            <div>
              <label
                htmlFor="modalMemberJoiningDate"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Joining Date
              </label>
              <input
                id="modalMemberJoiningDate"
                type="date"
                className="w-full rounded-lg border border-gray-300 h-11 px-3.5 text-xs text-gray-700 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                {...register("joiningDate")}
              />
              <div className="min-h-[18px] mt-1" />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isInviting}
                className="w-full rounded-full bg-gray-200 text-gray-900 hover:bg-gray-300 h-11 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isInviting ? "Adding Member..." : "Add Member"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
