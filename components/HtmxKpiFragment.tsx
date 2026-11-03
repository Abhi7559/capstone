import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";

interface HtmxKpiFragmentProps {
  onSwitchToReact?: () => void;
}

export function HtmxKpiFragment({ onSwitchToReact }: HtmxKpiFragmentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((state) => state.currentUser);

  useEffect(() => {
    // When HTMX loads or component mounts, instruct HTMX to process the container
    const htmx = (typeof window !== "undefined" && (window as any).htmx) || null;
    if (htmx && containerRef.current) {
      htmx.process(containerRef.current);
    }
  }, []);

  const statsUrl = `/api/htmx/dashboard/stats`;

  return (
    <div className="space-y-4">
      {/* Mode Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 border border-indigo-100 rounded-xl px-4 py-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-gray-800 tracking-tight">
            HTMX Server-Driven Mode
          </span>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full uppercase">
            Jinja2 + Python SSR
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 hidden sm:inline">
            Auto-polling every 30s
          </span>
          {onSwitchToReact && (
            <button
              type="button"
              onClick={onSwitchToReact}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-2xs transition cursor-pointer"
            >
              Switch to Standard View
            </button>
          )}
        </div>
      </div>

      {/* HTMX Dynamic Container */}
      <div
        ref={containerRef}
        id="kpi-container"
        data-hx-get={statsUrl}
        data-hx-trigger="load, every 30s"
        data-hx-swap="innerHTML"
        className="w-full"
      >
        {/* Fallback skeleton while HTMX fetches the first HTML fragment */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-xs"
            >
              <div className="h-3 w-20 bg-gray-200 rounded-sm mb-3" />
              <div className="h-8 w-16 bg-gray-300 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
