import Link from "next/link";
import { ErrorLayout } from "@/components/ErrorLayout";

export default function Error404() {
  return (
    <ErrorLayout
      code="404"
      title="Page Not Found"
      description="The page or project resource you are looking for doesn't exist or has been moved."
      icon="🔍"
      iconBgColor="bg-blue-100"
      iconTextColor="text-blue-600"
      actionButton={
        <Link
          href="/projects"
          className="inline-block w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-[0.98]"
        >
          Back to Projects
        </Link>
      }
    />
  );
}
