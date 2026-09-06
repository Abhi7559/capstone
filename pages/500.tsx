import Link from "next/link";
import { ErrorLayout } from "@/components/ErrorLayout";

export default function Error500() {
  return (
    <ErrorLayout
      code="500"
      title="Internal Server Error"
      description="Something unexpected went wrong on our end. Please refresh or try again shortly."
      icon="⚠️"
      iconBgColor="bg-rose-100"
      iconTextColor="text-rose-600"
      actionButton={
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
          >
            Retry Page
          </button>
          <Link
            href="/dashboard"
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          >
            Dashboard
          </Link>
        </div>
      }
    />
  );
}
