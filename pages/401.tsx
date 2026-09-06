import Link from "next/link";
import { ErrorLayout } from "@/components/ErrorLayout";

export default function Error401() {
  return (
    <ErrorLayout
      code="401"
      title="Unauthorized Access"
      description="You need to be logged in to view this page or resource. Please sign in with your account credentials."
      icon="🔒"
      iconBgColor="bg-amber-100"
      iconTextColor="text-amber-600"
      actionButton={
        <Link
          href="/login"
          className="inline-block w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-[0.98]"
        >
          Go to Login
        </Link>
      }
    />
  );
}
