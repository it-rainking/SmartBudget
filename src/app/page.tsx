export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="flex flex-col items-center gap-8 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500 text-4xl text-white shadow-lg">
          💰
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
            SmartBudget
          </h1>
          <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            Piattaforma completa per la gestione delle finanze personali.
            Budget, transazioni, risparmi e molto altro.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="/login"
            className="rounded-full bg-emerald-600 px-8 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Accedi
          </a>
          <a
            href="/signup"
            className="rounded-full border border-emerald-600 px-8 py-3 font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-zinc-800"
          >
            Registrati
          </a>
        </div>
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-500">
          v1.0 — Setup in corso
        </p>
      </main>
    </div>
  );
}
