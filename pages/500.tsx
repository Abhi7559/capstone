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
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
        >
          Retry Page
        </button>
      }
    />
  );
}
