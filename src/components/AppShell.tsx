import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-[var(--bg)]">
      {/* Mesh lumineux qui donne de la matière au verre */}
      <div className="app-mesh" aria-hidden />
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="animate-rise-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
