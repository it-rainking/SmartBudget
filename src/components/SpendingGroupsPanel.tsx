'use client'

import { useExpenseCategories, useUpdateExpenseCategoryGroup } from '@/hooks/useCategories'
import { useToast } from '@/components/Toast'
import { SPENDING_GROUPS, isSpendingGroup } from '@/lib/kakebo'

// Impostazioni: gruppo Kakebo di ogni categoria di spesa. Il salvataggio è
// immediato al cambio del select, una categoria alla volta.
export function SpendingGroupsPanel() {
  const { data: categories, isLoading } = useExpenseCategories()
  const updateGroup = useUpdateExpenseCategoryGroup()
  const { showToast } = useToast()

  const unassigned = categories?.filter((c) => !c.spending_group).length ?? 0

  return (
    <div id="gruppi-spesa" className="scroll-mt-20 bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wide">Gruppi di spesa</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        Metodo Kakebo: ogni categoria dice quanto è necessaria una spesa. Le uscite fisse riducono il portamonete
        del mese a inizio mese, gli altri quattro gruppi sono le spese variabili. Ricorrenze e rate contano sempre come fisse.
      </p>

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento...</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
          {categories?.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between gap-3 py-2">
              <label htmlFor={`group-${cat.id}`} className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </label>
              <select
                id={`group-${cat.id}`}
                value={cat.spending_group ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  updateGroup.mutate(
                    { id: cat.id, spending_group: isSpendingGroup(value) ? value : null },
                    { onError: (err) => showToast(err instanceof Error ? err.message : 'Salvataggio non riuscito', 'error') },
                  )
                }}
                className="w-48 shrink-0 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Da classificare</option>
                {SPENDING_GROUPS.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      {unassigned > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
          {unassigned === 1 ? '1 categoria non ha' : `${unassigned} categorie non hanno`} ancora un gruppo: le sue spese contano come variabili ma restano fuori dalla ripartizione.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {SPENDING_GROUPS.map((g) => (
          <div key={g.key} className="flex gap-2">
            <dt className="font-medium text-zinc-600 dark:text-zinc-300 shrink-0">{g.label}:</dt>
            <dd className="text-zinc-500 dark:text-zinc-400">{g.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
