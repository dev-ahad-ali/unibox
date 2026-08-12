import type { ReactNode } from "react";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Unibox</span>
        </div>
        {children}
      </div>
    </div>
  );
}
