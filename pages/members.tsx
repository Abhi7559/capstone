import { useState } from "react";
import { InviteMemberModal } from "@/components/InviteMemberModal";
import { MemberProfileModal } from "@/components/MemberProfileModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useMembers } from "@/hooks/useMembers";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types/auth";

export default function MembersPage() {
  const {
    data: members,
    isLoading: isMembersLoading,
    isError: isMembersError,
  } = useMembers();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === "admin";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "member"]}>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <Sidebar
          activeTab="members"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            title="Team Members"
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-8 overflow-y-auto">
            {/* Page Header */}
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Team Members
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  View workspace team members, designations, and roles.
                </p>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none"
                >
                  + Add Member
                </button>
              )}
            </div>
            {/* Members Table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {isMembersLoading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading members...
                </div>
              ) : isMembersError ? (
                <div className="p-8 text-center bg-red-50 text-red-700 flex flex-col items-center justify-center space-y-3">
                  <p className="text-sm font-semibold">
                    Unable to load workspace members list at this time. Please try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer shadow-xs"
                  >
                    Retry Page
                  </button>
                </div>
              ) : !members || members.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  No members yet.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-400 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5">Name</th>
                      <th className="px-6 py-3.5">Email</th>
                      <th className="px-6 py-3.5">Role</th>
                      <th className="px-6 py-3.5">Designation</th>
                      <th className="px-6 py-3.5">Joining Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {members.map((member) => (
                      <tr
                        key={member.id}
                        onClick={() => isAdmin && setSelectedMember(member)}
                        className={`transition ${
                          isAdmin
                            ? "hover:bg-blue-50/50 cursor-pointer"
                            : "hover:bg-gray-50/50"
                        }`}
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMember(member);
                              }}
                              className="hover:text-blue-600 text-left font-bold"
                            >
                              {member.name}
                            </button>
                          ) : (
                            member.name
                          )}
                        </td>
                        <td className="px-6 py-4">{member.email}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              member.role === "admin"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {member.designation ||
                            (member.role === "admin"
                              ? "System Administrator"
                              : "Software Engineer")}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-500">
                          {member.joiningDate
                            ? new Date(member.joiningDate).toString() !==
                              "Invalid Date"
                              ? new Date(member.joiningDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : member.joiningDate
                            : "Sep 1, 2026"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Add New Member Modal */}
      <InviteMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Member Profile Modal for Admin */}
      <MemberProfileModal
        member={selectedMember}
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        currentUserId={currentUser?.id}
        onSuccess={showToast}
      />

      {/* Floating Top-Center Toast Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center space-x-3 rounded-full bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 text-xs font-semibold shadow-2xl border border-slate-700/50 animate-in fade-in slide-in-from-top-4 duration-200">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </ProtectedRoute>
  );
}
