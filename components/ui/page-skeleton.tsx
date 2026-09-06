import { cn } from "@/lib/utils";

function Pulse({ className }: Readonly<{ className?: string }>) {
  return <div className={cn("animate-pulse rounded-md bg-secondary", className)} />;
}

/**
 * Route-level loading state. Mirrors the AppShell layout (sidebar + header)
 * so navigation paints immediately instead of freezing on the previous page
 * while the server render is in flight.
 */
export function PageSkeleton({ threePane = false }: Readonly<{ threePane?: boolean }>) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <nav className="hidden w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <Pulse className="h-4 w-24" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          <Pulse className="h-8 w-full" />
          <Pulse className="h-8 w-full" />
          <Pulse className="h-8 w-full" />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Pulse className="h-4 w-40" />
        </header>

        {threePane ? (
          <div className="flex min-h-0 flex-1">
            <div className="flex w-72 shrink-0 flex-col gap-2 border-r border-border p-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Pulse key={i} className="h-14 w-full" />
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-end gap-3 p-4">
              <Pulse className="h-10 w-2/5" />
              <Pulse className="h-10 w-1/3 self-end" />
              <Pulse className="h-10 w-1/2" />
              <Pulse className="h-16 w-full" />
            </div>
            <div className="hidden w-64 shrink-0 flex-col gap-3 border-l border-border p-4 lg:flex">
              <Pulse className="h-10 w-full" />
              <Pulse className="h-24 w-full" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            <Pulse className="h-28 w-full" />
            <Pulse className="h-28 w-full" />
            <Pulse className="h-28 w-2/3" />
          </div>
        )}
      </div>
    </div>
  );
}
