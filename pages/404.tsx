import Link from "next/link";

export default function Custom404() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 font-sans text-center">
      <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-lg border border-gray-100 space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-3xl font-bold">
          🔍
        </div>
        <div className="space-y-2">
          <span className="text-5xl font-extrabold text-gray-900 tracking-tight">404</span>
          <h1 className="text-xl font-bold text-gray-800">Page Not Found</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            The page or project resource you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
