import Link from "next/link";
import type { ReactNode } from "react";

import { PRIVACY_PATH, TERMS_PATH } from "@/lib/legal";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Unibox</span>
        </div>
        {children}

        {/* Meta's reviewers look for these from the signed-out entry point. */}
        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <Link href={PRIVACY_PATH} className="hover:text-foreground">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href={TERMS_PATH} className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
