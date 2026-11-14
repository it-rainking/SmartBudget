// Versione e giorno di revisione, in piccolo in alto su ogni pagina.
// Valori fissati in build da next.config.ts (package.json + ultimo commit).
export function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION
  const revision = process.env.NEXT_PUBLIC_APP_REVISION
  if (!version) return null

  // YYYY-MM-DD → DD/MM/YYYY (senza passare da Date: niente scarti di fuso)
  const [y, m, d] = (revision ?? '').split('-')
  const day = y && m && d ? `${d}/${m}/${y}` : null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center select-none"
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <span className="text-[9px] leading-3 tracking-wide text-zinc-400 dark:text-zinc-500 tabular-nums">
        v{version}{day ? ` · rev. ${day}` : ''}
      </span>
    </div>
  )
}
