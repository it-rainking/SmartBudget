'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'

interface Section {
  id: string
  icon: string
  title: string
  content: React.ReactNode
}

const sections: Section[] = [
  {
    id: 'introduzione',
    icon: '👋',
    title: 'Introduzione',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-900 dark:text-white">SmartBudget</strong> è la tua piattaforma
          personale per tenere sotto controllo le finanze. Puoi registrare entrate e uscite, pianificare
          budget mensili, tenere traccia di fatture e abbonamenti, e monitorare i tuoi obiettivi di risparmio.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '📊', label: 'Dashboard', desc: 'KPI e grafici in tempo reale' },
            { icon: '💳', label: 'Transazioni', desc: 'Entrate, uscite e risparmi' },
            { icon: '📅', label: 'Budget', desc: 'Pianifica e confronta i costi' },
            { icon: '🧾', label: 'Fatture', desc: 'Abbonamenti e scadenze' },
            { icon: '🎯', label: 'Obiettivi', desc: 'Risparmio con progress bar' },
            { icon: '🔔', label: 'Notifiche', desc: 'Alert automatici in-app' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white text-sm">{item.label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'primo-accesso',
    icon: '🚀',
    title: 'Primo accesso e onboarding',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Al primo accesso dopo la registrazione, SmartBudget avvia un wizard in 3 passi per configurare
          il tuo profilo finanziario.
        </p>
        <ol className="space-y-3">
          {[
            {
              step: '1',
              title: 'Valuta e saldo iniziale',
              desc: 'Scegli la tua valuta (EUR, USD, GBP…) e inserisci il saldo di partenza del tuo conto.',
            },
            {
              step: '2',
              title: 'Categorie predefinite',
              desc: 'SmartBudget crea automaticamente categorie per entrate, uscite e risparmi. Potrai personalizzarle in seguito dalle Impostazioni.',
            },
            {
              step: '3',
              title: 'Sei pronto!',
              desc: 'Accedi alla dashboard e inizia a registrare le tue prime transazioni.',
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-4">
              <span className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">
                {item.step}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Dashboard',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          La dashboard è il punto di partenza dopo il login. Hai due viste disponibili:
        </p>
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">📊 Dashboard Mensile</h4>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
              <li>KPI: totale entrate, uscite, risparmi, saldo netto</li>
              <li>Variazione percentuale rispetto al mese precedente</li>
              <li>Grafico donut delle spese per categoria</li>
              <li>Grafico a barre entrate vs uscite per giorno</li>
              <li>Media giornaliera delle spese</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">📈 Dashboard Annuale</h4>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
              <li>Selezione anno con navigazione avanti/indietro</li>
              <li>Grafico a linee del trend 12 mesi</li>
              <li>Grafico a barre confronto entrate/uscite mensili</li>
              <li>Highlights: mese migliore, peggiore, totali anno</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'transazioni',
    icon: '💳',
    title: 'Transazioni',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          In questa sezione puoi aggiungere, modificare ed eliminare le tue transazioni finanziarie.
        </p>
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">Tipi di transazione</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: '📥', label: 'Entrata', desc: 'Stipendio, freelance, rimborsi…' },
                { icon: '📤', label: 'Uscita', desc: 'Spese, acquisti, bollette…' },
                { icon: '🏦', label: 'Risparmio', desc: 'Accantonamento fondi…' },
              ].map((t) => (
                <div key={t.label} className="text-center p-2">
                  <div className="text-2xl mb-1">{t.icon}</div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">{t.label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">Import da CSV</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
              Clicca su <strong>&quot;Importa CSV&quot;</strong> per caricare un file con più transazioni in una volta sola.
              Il sistema rileva automaticamente il separatore (<code>,</code> o <code>;</code>).
            </p>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Colonne supportate:</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-600">
                    <th className="text-left py-1 pr-3 text-zinc-700 dark:text-zinc-300">Colonna</th>
                    <th className="text-left py-1 text-zinc-700 dark:text-zinc-300">Valori accettati</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-600 dark:text-zinc-400 space-y-1">
                  {[
                    ['data / date', 'YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY'],
                    ['tipo / type', 'entrata, spesa, risparmio (o EN: income, expense, saving)'],
                    ['importo / amount', 'numero positivo (es. 1250.50 o 1250,50)'],
                    ['descrizione / description', 'testo libero (opzionale)'],
                    ['metodo / payment_method', 'metodo di pagamento (opzionale)'],
                  ].map(([col, val]) => (
                    <tr key={col} className="border-b border-zinc-100 dark:border-zinc-700">
                      <td className="py-1 pr-3 font-mono">{col}</td>
                      <td className="py-1">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'budget',
    icon: '📅',
    title: 'Budget',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Il modulo Budget ti permette di pianificare quanto vuoi spendere in ogni categoria e confrontarlo
          con l&apos;effettivo a fine mese.
        </p>
        <ol className="space-y-3">
          {[
            {
              step: '1',
              title: 'Seleziona il mese',
              desc: 'Usa i pulsanti mese/anno in alto per navigare tra i periodi.',
            },
            {
              step: '2',
              title: 'Inserisci gli importi pianificati',
              desc: 'Per ogni categoria (spese, entrate, risparmi) digita l\'importo previsto. Il salvataggio è automatico.',
            },
            {
              step: '3',
              title: 'Confronta con l\'effettivo',
              desc: 'La colonna "Effettivo" si aggiorna in tempo reale con le transazioni registrate. La barra di progresso diventa rossa se superi il budget.',
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-4">
              <span className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">
                {item.step}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Attenzione:</strong> se la spesa effettiva supera il 110% del budget pianificato, riceverai
            una notifica di allerta nel campanellino in alto a destra.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'fatture',
    icon: '🧾',
    title: 'Fatture e abbonamenti',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Gestisci le tue fatture ricorrenti e gli abbonamenti. SmartBudget calcola automaticamente
          lo stato di ogni fattura in base alla data di scadenza.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'In attesa', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', desc: 'Non ancora scaduta' },
            { label: 'Pagata', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', desc: 'Saldata regolarmente' },
            { label: 'Scaduta', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', desc: 'Data di scadenza superata' },
            { label: 'Annullata', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400', desc: 'Non più attiva' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
          <h4 className="font-semibold text-zinc-900 dark:text-white mb-1">Periodicità supportate</h4>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
            <li>• Una tantum (pagamento singolo)</li>
            <li>• Settimanale, Mensile, Trimestrale, Annuale</li>
          </ul>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Il <strong>calendario</strong> in fondo alla pagina mostra visivamente i giorni di scadenza
          del mese corrente. Le fatture in scadenza entro 7 giorni appaiono nelle notifiche.
        </p>
      </div>
    ),
  },
  {
    id: 'obiettivi',
    icon: '🎯',
    title: 'Obiettivi finanziari',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Crea obiettivi di risparmio o di rimborso debiti e monitora i progressi con una barra visiva.
        </p>
        <div className="space-y-3">
          {[
            {
              icon: '💰',
              title: 'Obiettivo di risparmio',
              desc: 'Imposta un importo target e una scadenza. Aggiungi progressi manualmente ogni volta che accantoni dei fondi.',
            },
            {
              icon: '💳',
              title: 'Obiettivo di rimborso debito',
              desc: 'Tieni traccia dei debiti che vuoi estinguere: mutuo, prestito auto, carta di credito.',
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Quando un obiettivo raggiunge il <strong>90% o più</strong>, ricevi una notifica di incoraggiamento
          nel campanellino. Al 100% l&apos;obiettivo viene marcato come completato.
        </p>
      </div>
    ),
  },
  {
    id: 'notifiche',
    icon: '🔔',
    title: 'Notifiche',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          SmartBudget genera notifiche automatiche in-app basate sui tuoi dati. Clicca sul
          campanellino in alto a destra per vederle.
        </p>
        <div className="space-y-2">
          {[
            { icon: '🧾', title: 'Fattura in scadenza', desc: 'Entro 7 giorni dalla data di scadenza. Alert urgente se entro 2 giorni.' },
            { icon: '📉', title: 'Budget superato', desc: 'Quando la spesa effettiva supera il 110% del budget pianificato.' },
            { icon: '🎯', title: 'Obiettivo vicino', desc: 'Quando hai raggiunto il 90% o più del tuo obiettivo.' },
            { icon: '⚠️', title: 'Saldo negativo', desc: 'Quando il saldo netto del mese è sotto zero.' },
          ].map((n) => (
            <div key={n.title} className="flex gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <span className="text-xl">{n.icon}</span>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{n.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{n.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Nota:</strong> puoi abilitare notifiche via email e Telegram nelle <strong>Impostazioni</strong>.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'impostazioni',
    icon: '⚙️',
    title: 'Impostazioni',
    content: (
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Dalla pagina Impostazioni puoi personalizzare il comportamento dell&apos;app e gestire il tuo account.
        </p>
        <div className="space-y-3">
          {[
            { title: 'Preferenze generali', desc: 'Valuta di visualizzazione e locale (formato date e numeri).' },
            { title: 'Saldo iniziale', desc: 'Modifica il saldo di partenza usato per i calcoli del netto.' },
            { title: 'Notifiche email', desc: 'Abilita e configura l\'indirizzo email per le notifiche.' },
            { title: 'Notifiche Telegram', desc: 'Connetti il tuo chat ID Telegram per ricevere alert via bot.' },
            { title: 'Export GDPR', desc: 'Scarica un file JSON con tutti i tuoi dati in qualsiasi momento.' },
            { title: 'Eliminazione account', desc: 'Rimuovi definitivamente tutti i tuoi dati dalla piattaforma.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'faq',
    icon: '❓',
    title: 'Domande frequenti',
    content: (
      <div className="space-y-4">
        {[
          {
            q: 'Posso usare SmartBudget su mobile?',
            a: 'Sì, l\'interfaccia è completamente responsive. Su mobile la navigazione è disponibile tramite il menu in alto anziché la sidebar.',
          },
          {
            q: 'I miei dati sono al sicuro?',
            a: 'Tutti i dati sono protetti da Row Level Security (RLS) su Supabase. Ogni utente accede solo ai propri dati, impossibile vedere quelli degli altri.',
          },
          {
            q: 'Posso importare transazioni da Excel?',
            a: 'Al momento è supportato solo il formato CSV. Puoi esportare da Excel in formato CSV (File → Salva con nome → CSV UTF-8).',
          },
          {
            q: 'Cosa succede se importo lo stesso CSV due volte?',
            a: 'Le transazioni verranno duplicate. Prima di importare, verifica l\'intervallo di date del file per evitare doppioni.',
          },
          {
            q: 'Posso eliminare una categoria?',
            a: 'Sì, dalle Impostazioni puoi gestire le categorie. Attenzione: eliminare una categoria con transazioni associate potrebbe rendere quelle transazioni non categorizzate.',
          },
          {
            q: 'Come funziona la scadenza automatica delle fatture?',
            a: 'Lo stato "Scaduta" viene calcolato dinamicamente confrontando la data di scadenza con la data di oggi. Non c\'è un job automatico: si aggiorna ogni volta che apri la pagina.',
          },
        ].map((faq, i) => (
          <div key={i} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="font-semibold text-zinc-900 dark:text-white mb-1 text-sm">{faq.q}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{faq.a}</p>
          </div>
        ))}
      </div>
    ),
  },
]

export default function IstruzioniPage() {
  const [activeSection, setActiveSection] = useState('introduzione')

  const current = sections.find((s) => s.id === activeSection) ?? sections[0]

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Guida all&apos;uso</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Tutto quello che ti serve per usare SmartBudget al meglio.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar navigazione sezioni */}
          <nav className="lg:w-56 flex-shrink-0">
            <ul className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {sections.map((section) => (
                <li key={section.id} className="flex-shrink-0">
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeSection === section.id
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>{section.icon}</span>
                    <span className="hidden lg:inline">{section.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contenuto sezione */}
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">{current.icon}</span>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{current.title}</h2>
              </div>
              {current.content}
            </div>

            {/* Navigazione prev/next */}
            <div className="flex justify-between mt-4">
              {sections.findIndex((s) => s.id === activeSection) > 0 ? (
                <button
                  onClick={() =>
                    setActiveSection(
                      sections[sections.findIndex((s) => s.id === activeSection) - 1].id
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  ← Precedente
                </button>
              ) : (
                <div />
              )}
              {sections.findIndex((s) => s.id === activeSection) < sections.length - 1 ? (
                <button
                  onClick={() =>
                    setActiveSection(
                      sections[sections.findIndex((s) => s.id === activeSection) + 1].id
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                  Successivo →
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
