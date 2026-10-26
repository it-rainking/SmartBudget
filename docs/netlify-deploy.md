# Deploy su Netlify

SmartBudget è un Next.js standard: su Netlify non serve un adapter da installare.
Netlify riconosce Next.js e applica a ogni build il proprio runtime (OpenNext,
`@netlify/plugin-nextjs`): pagine e API route diventano Netlify Functions, il
middleware un'Edge Function. La configurazione di build è in `netlify.toml`.

Supabase, GitHub Actions (cron) e i servizi esterni (Resend, Telegram, Google
Sheets, Yahoo) non cambiano: cambia solo l'host dell'app.

## 1. Crea il sito

1. Netlify → **Add new project → Import an existing project → GitHub** →
   `it-rainking/smartbudget`.
2. Branch di produzione: `main`. Build command e publish directory vengono da
   `netlify.toml` (`npm run build`, `.next`): lasciali come proposti.
3. **Non lanciare ancora il deploy**: prima le variabili, perché le
   `NEXT_PUBLIC_*` vengono incorporate nel bundle al momento della build.

## 2. Variabili d'ambiente

Project configuration → Environment variables. Scope: **Builds** e
**Functions** per tutte (le funzioni non vedono le variabili scritte in
`netlify.toml`). Ogni modifica richiede un nuovo deploy per avere effetto.

| Variabile | Obbligatoria | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sì | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sì | |
| `NEXT_PUBLIC_APP_URL` | sì | URL pubblico, es. `https://smartbudget.netlify.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | sì | cron, notifiche, eliminazione account |
| `CRON_SECRET` | sì | stesso valore del secret GitHub |
| `GSHEET_ID` | no | Sheet ponte prezzi; senza, il cron usa solo Yahoo |
| `GOOGLE_SA_EMAIL` | no | `client_email` del service account |
| `GOOGLE_SA_PRIVATE_KEY` | no | `private_key` del service account |
| `RESEND_API_KEY` | no | notifiche email |
| `TELEGRAM_BOT_TOKEN` | no | notifiche Telegram |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | no | funzioni AI (oggi poco più che placeholder): senza chiave le route rispondono con errore e il resto dell'app funziona |

**Limite di ~4 KB**: le funzioni girano su AWS Lambda e tutte le variabili
insieme devono stare in circa 4 KB. Per questo il service account Google si
passa con `GOOGLE_SA_EMAIL` + `GOOGLE_SA_PRIVATE_KEY` e non con
`GOOGLE_SA_KEY_B64`, che da sola ne occupa circa 3. Il codice accetta ancora
`GOOGLE_SA_KEY_B64` per gli altri host, ma su Netlify non va impostata.

Netlify espone da sé `COMMIT_REF`: `/api/health` lo usa per mostrare il commit
in esecuzione.

## 3. Supabase

Authentication → URL Configuration:

- **Site URL**: l'URL Netlify (o il dominio personalizzato, quando c'è).
- **Redirect URLs**: aggiungi `https://<sito>.netlify.app/**`. Senza, login via
  link, `/auth/callback` e recupero password rimandano al vecchio dominio.

Tieni anche l'URL vecchio finché il vecchio deploy resta attivo.

## 4. Primo deploy e verifica

Deploys → **Trigger deploy**. A build finita:

1. `GET /api/health` → `status: ok` e `commit_short` uguale all'ultimo commit.
2. Login, dashboard mensile, inserimento e modifica di una transazione, import
   CSV, `/investimenti`.
3. Cron prezzi a mano, misurando la durata:
   ```sh
   time curl -X POST https://<sito>.netlify.app/api/cron/prices \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
   Deve restare sotto i 60 secondi (limite di Netlify per richiesta). Il cron
   interroga Yahoo con 5 richieste in parallelo; se un giorno il portafoglio
   cresce al punto da sforare, la soluzione è una Background Function (fino a
   15 minuti), non alzare il parallelismo.
4. Nei log della funzione (Logs → Functions) le righe `[yahoo]` /
   `[yahoo:chart]` dicono quale canale ha servito i prezzi.

## 5. Cron (GitHub Actions)

GitHub → Settings → Secrets and variables → Actions: aggiorna `APP_URL` con
l'URL Netlify. `CRON_SECRET` resta uguale. Lancia a mano entrambi i workflow
(`Prezzi investimenti`, `Notifiche automatiche`) da Actions per conferma.

Le Scheduled Functions di Netlify non sono usate: limite di 30 secondi,
partono solo sul deploy di produzione e duplicherebbero uno scheduler che
funziona già.

## 6. Passaggio definitivo

1. Dominio personalizzato (Domain management) e DNS.
2. Aggiorna `NEXT_PUBLIC_APP_URL`, Site URL di Supabase e `APP_URL` su GitHub,
   poi rifai il deploy.
3. Tieni il vecchio host acceso una o due settimane come ripiego, poi spegnilo
   e rimuovi `railway.toml`.

## Differenze rispetto a Railway

- Nessun processo sempre acceso: la prima richiesta dopo un periodo di
  inattività è più lenta (cold start).
- Ogni richiesta ha 60 secondi al massimo. Oggi nessuna route ci si avvicina
  tranne, potenzialmente, il cron prezzi (vedi sopra).
- Gli header di sicurezza (CSP ecc.) restano in `next.config.ts` e il runtime
  Netlify li applica anche alle risposte delle funzioni.
