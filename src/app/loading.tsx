export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento...</p>
      </div>
    </div>
  )
}
