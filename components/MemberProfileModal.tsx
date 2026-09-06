import { useEffect, useState } from "react";
import { useDeleteMember, useUpdateMember } from "@/hooks/useMembers";
import type { User } from "@/types/auth";

interface MemberProfileModalProps {
  member: User | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onSuccess?: (msg: string) => void;
}

export function MemberProfileModal({
  member,
  isOpen,
  onClose,
  currentUserId,
  onSuccess,
}: MemberProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const {
    updateMember,
    isLoading: isUpdating,
    error: updateError,
  } = useUpdateMember();
  const {
    deleteMember,
    isLoading: isDeleting,
    error: deleteError,
  } = useDeleteMember();

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  useEffect(() => {
    if (member && isOpen) {
      setName(member.name || "");
      setEmail(member.email || "");
      setDesignation(
        member.designation ||
          (member.role === "admin"
            ? "System Administrator"
            : "Software Engineer"),
      );
      setJoiningDate(member.joiningDate || "2026-09-01");
      setRole(member.role || "member");
      setIsEditing(false);
      setIsConfirmingDelete(false);
      setCopiedPassword(false);
    }
  }, [member, isOpen]);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen && member) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const handleCopyPassword = () => {
    const passwordToCopy = member.password || "Admin@123";
    navigator.clipboard.writeText(passwordToCopy);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMember({
        id: member.id,
        input: {
          name: name.trim(),
          email: email.trim(),
          designation: designation.trim(),
          joiningDate,
          role,
        },
      });
      onSuccess?.("Member details updated successfully!");
      setIsEditing(false);
      onClose();
    } catch {
      // Error handled by mutation state
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMember(member.id);
      onSuccess?.("Member deleted successfully!");
      setIsConfirmingDelete(false);
      onClose();
    } catch {
      // Error handled
    }
  };

  const isSelf = member.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-900 text-white font-black text-lg uppercase shadow-md">
              {name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{name}</h2>
              <p className="text-xs text-gray-500 font-medium">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Delete Confirmation Screen */}
        {isConfirmingDelete ? (
          <div className="rounded-xl bg-red-50 p-5 border border-red-200 space-y-3">
            <h3 className="text-sm font-bold text-red-900">
              Confirm Member Deletion
            </h3>
            {deleteError && (
              <div className="rounded-lg bg-red-100 p-2.5 text-xs font-semibold text-red-800 border border-red-300">
                {deleteError}
              </div>
            )}
            <p className="text-xs text-red-700 leading-relaxed">
              Are you sure you want to remove <strong>{member.name}</strong>{" "}
              from the workspace? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition shadow-xs"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Member"}
              </button>
            </div>
          </div>
        ) : isEditing ? (
          /* EDIT MODE FORM */
          <form onSubmit={handleSave} className="space-y-4">
            {updateError && (
              <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs font-semibold text-red-700">
                {updateError}
              </div>
            )}

            <div>
              <label
                htmlFor="editMemberName"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Full Name *
              </label>
              <input
                id="editMemberName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 h-10 px-3.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="editMemberEmail"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Email Address *
              </label>
              <input
                id="editMemberEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 h-10 px-3.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="editMemberDesignation"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Designation
                </label>
                <input
                  id="editMemberDesignation"
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 h-10 px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="editMemberRole"
                  className="block text-xs font-semibold text-gray-700 mb-1"
                >
                  Workspace Role
                </label>
                <select
                  id="editMemberRole"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "admin" | "member")
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white h-10 px-3 text-xs font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 capitalize"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="editMemberJoiningDate"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Joining Date
              </label>
              <input
                id="editMemberJoiningDate"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 h-10 px-3 text-xs text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Footer Form Buttons */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          /* VIEW PROFILE MODE */
          <div className="space-y-4">
            {/* Role & Status */}
            <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-gray-100 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Workspace Role
                </span>
                <span
                  className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold capitalize ${
                    role === "admin"
                      ? "bg-purple-100 text-purple-800 border border-purple-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                >
                  {role}
                </span>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Status
                </span>
                <span className="inline-block rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold capitalize">
                  {member.status || "Active"}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-white p-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Designation
                </span>
                <p className="font-bold text-gray-900 mt-1">
                  {designation || "Software Engineer"}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Joining Date
                </span>
                <p className="font-bold text-gray-900 mt-1">
                  {joiningDate
                    ? new Date(joiningDate).toString() !== "Invalid Date"
                      ? new Date(joiningDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : joiningDate
                    : "Sep 1, 2026"}
                </p>
              </div>
            </div>

            {/* Password Section */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Generated Account Password
                </span>
                <span className="text-[10px] font-semibold text-gray-400">
                  Admin Access Only
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200">
                <code className="font-mono text-xs font-bold text-gray-800 select-all">
                  {member.password || "Admin@123"}
                </code>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="rounded-md bg-gray-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-gray-800 transition"
                >
                  {copiedPassword ? "Copied! ✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <div>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition"
                  >
                    🗑️ Delete Member
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
                >
                  ✏️ Edit Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
