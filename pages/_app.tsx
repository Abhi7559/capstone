import "@/styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";
import { apiEndpoint } from "@/utils/apiConfig";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // Cache data as fresh for 30 seconds for instant navigation
            refetchOnWindowFocus: false, // Prevent redundant background fetches on tab switches
            retry: 1, // Avoid hanging on network timeouts
          },
        },
      }),
  );

  // Background non-blocking ping to wake up the cloud backend (mitigates free-tier cold starts)
  useEffect(() => {
    try {
      fetch(apiEndpoint("/health"), { method: "GET" }).catch(() => {});
    } catch {
      // Non-blocking ping
    }
  }, []);

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
