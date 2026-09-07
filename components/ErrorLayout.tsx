import Link from "next/link";
import type React from "react";

interface ErrorLayoutProps {
  code: string;
  title: string;
  description: string;
  icon: string;
  iconBgColor?: string;
  iconTextColor?: string;
  actionButton?: React.ReactNode;
}

export function ErrorLayout({
  code,
  title,
  description,
  icon,
  iconBgColor = "bg-amber-100",
  iconTextColor = "text-amber-600",
  actionButton,
}: ErrorLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-xl border border-gray-200 text-center space-y-6">
        <div
          className={`w-16 h-16 ${iconBgColor} ${iconTextColor} rounded-full flex items-center justify-center mx-auto text-2xl font-bold`}
        >
          {icon}
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-900">{code}</h1>
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>

        <div className="pt-2">
          {actionButton || (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-block w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-[0.98] cursor-pointer"
            >
              Refresh & Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
