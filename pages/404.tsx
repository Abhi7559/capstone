import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function Error404() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <Sidebar
          activeTab="projects"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            title="Page Not Found"
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-xl border border-gray-200 text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                🔍
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-extrabold text-gray-900">404</h1>
                <h2 className="text-lg font-bold text-gray-800">Resource Not Found</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  The requested page or project resource does not exist or may have been removed.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-[0.98] cursor-pointer"
                >
                  Retry Page
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
