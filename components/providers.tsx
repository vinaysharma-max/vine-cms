"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ConvexReactClient } from "convex/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { InviteAcceptanceBootstrap } from "@/components/Member/InviteAcceptanceBootstrap";

export const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!,
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <NuqsAdapter>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <InviteAcceptanceBootstrap />
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </NuqsAdapter>
    </ConvexAuthNextjsProvider>
  );
}
