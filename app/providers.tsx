"use client";

/**
 * Client-side provider tree.
 * Wrap every client-facing feature here so app/layout.tsx stays a
 * clean Server Component and providers are co-located in one place.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, SessionContext } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode, type JSX } from "react";

const isStaticPages = process.env.NEXT_PUBLIC_GITHUB_PAGES === "1";

function StaticSessionProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <SessionContext.Provider
      value={{
        data: null,
        status: "unauthenticated",
        update: async () => null,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/** Create a stable QueryClient per browser session. */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        throwOnError: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());
  const AuthProvider = isStaticPages ? StaticSessionProvider : SessionProvider;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
