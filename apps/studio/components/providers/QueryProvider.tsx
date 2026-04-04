"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { createAppQueryClient } from "@hyperagent/frontend-data";

const DevtoolsPanel = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools),
  { ssr: false },
);

/**
 * App-wide TanStack Query client. Place high in the client tree.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <DevtoolsPanel initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
