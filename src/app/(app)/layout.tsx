import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-20 pt-4">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
