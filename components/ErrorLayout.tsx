import type React from "react";

interface ErrorLayoutProps {
  code: string;
  title: string;
  description: string;
  icon: string;
  iconBgColor?: string;
  iconTextColor?: string;
}

export function ErrorLayout({
  code,
  title,
  description,
  icon,
  iconBgColor = "bg-blue-50",
  iconTextColor = "text-blue-600",
}: ErrorLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans text-center">
      <div className="max-w-md w-full rounded-2xl bg-white p-10 shadow-sm border border-gray-100 space-y-6">
        <div
          className={`w-20 h-20 ${iconBgColor} ${iconTextColor} rounded-full flex items-center justify-center mx-auto text-3xl font-bold shadow-xs`}
        >
          {icon}
        </div>
        <div className="space-y-3">
          <span className="text-5xl font-extrabold text-gray-900 tracking-tight block">
            {code}
          </span>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
