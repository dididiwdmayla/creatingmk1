export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-8 font-sans dark:bg-black">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Radar
      </h1>
      <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
        Prospecção de leads locais. O dashboard de uso, a busca e a lista de
        leads chegam nas próximas iterações — ver{" "}
        <code className="font-mono text-sm">ARCHITECTURE.md</code>.
      </p>
    </main>
  );
}
