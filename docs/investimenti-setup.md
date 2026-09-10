# Modulo Investimenti — setup

Guida per attivare il modulo `/investimenti`: import CSV Fineco, prezzi live
via Google Sheet ponte con fallback Yahoo Finance.

## 1. Applicare la migration

Incolla il contenuto di `supabase/migrate_investments.sql` nel SQL Editor del
progetto Supabase ed eseguilo una volta. Crea le tabelle `assets`, `holdings`,
`price_snapshots`, `isin_ticker_lookup`, le relative RLS policy e la funzione
`get_investment_summary()`.

`isin_ticker_lookup` è seedata solo con 2 righe di esempio (VWCE, SWDA). Aggiungi
i tuoi ISIN reali con un `INSERT` manuale nel SQL Editor:

```sql
insert into public.isin_ticker_lookup (isin, ticker_gf, ticker_yahoo, name, asset_class)
values ('IEXXXXXXXXXX', 'BIT:TICKER', 'TICKER.MI', 'Nome ETF', 'etf_equity')
on conflict (isin) do update set ticker_gf = excluded.ticker_gf, ticker_yahoo = excluded.ticker_yahoo;
```

## 2. Importare il portafoglio da Fineco

Fineco → Patrimonio → Portafoglio titoli → Esporta (CSV). Carica il file nella
pagina `/investimenti` (drag & drop o click). L'import sostituisce
integralmente le posizioni esistenti — è pensato per essere ripetuto a ogni
aggiornamento del portafoglio, non per operazioni incrementali.

Gli ISIN non presenti in `isin_ticker_lookup` vengono comunque importati (con
`ticker_gf` vuoto) e segnalati in un banner: senza ticker mappato quella
posizione non riceverà prezzi live finché non aggiungi la riga di lookup.

### Cosa accetta il parser

Il file non deve avere un formato esatto: separatore (`;`, `,`, tab, `|`),
codifica (UTF-8 o Windows-1252) e riga di intestazione vengono rilevati
automaticamente, anche se prima della tabella ci sono righe libere (titolo
del report, numero di conto, righe vuote).

| Serve | Nomi riconosciuti |
|---|---|
| ISIN | `ISIN`, `Codice ISIN`, oppure — se non c'è una colonna dedicata — la colonna che contiene codici in formato ISIN |
| Quantità | `Quantità`, `Q.tà`, `Qta`, `Pezzi`, `Quote`, `Nominale` |
| Prezzo di carico | `Prezzo medio di carico`, `Prz. Medio Carico`, `PMC`, `Prezzo carico`, `Costo medio`; in alternativa si ricava da `Valore di carico` ÷ quantità |
| Nome (opzionale) | `Descrizione`, `Strumento`, `Titolo`, `Denominazione`, in mancanza `Simbolo`/`Ticker` |

Altre regole:

- Righe di totale, disclaimer in coda e posizioni con quantità 0 vengono
  ignorate (le seconde con un warning a video).
- Lo stesso ISIN presente su più righe (titolo su più mercati) viene aggregato:
  quantità sommate, prezzo di carico mediato per quantità.
- Importi sia in formato italiano (`1.234,56`) sia anglosassone (`1,234.56`),
  con o senza simbolo di valuta.

### Se l'import non va a buon fine

L'errore viene mostrato in un riquadro rosso sotto l'area di upload (non solo
come toast) e riporta le colonne effettivamente lette dal file: è il primo
posto da guardare.

| Messaggio | Causa | Rimedio |
|---|---|---|
| `Il file è un foglio Excel (.xlsx/.xls)` | export scaricato in formato Excel | apri il file e salvalo come CSV |
| `Colonne mancanti nel CSV: ...` | l'export non contiene ISIN, quantità o prezzo di carico | riesporta includendo quelle colonne, o aggiungi l'alias in `parseFinecoCsv.ts` |
| `Nessuna posizione valida trovata nel CSV` | tutte le righe scartate | leggi i warning elencati nel messaggio |
| `Portafoglio non caricato` (banner in cima alla pagina) | la migration non è stata eseguita | esegui `supabase/migrate_investments.sql` (punto 1) |

## 3. Creare il Google Sheet ponte

Google Finance non ha API pubbliche: il canale prezzi passa da un Google
Sheet con formule `GOOGLEFINANCE()`, letto in sola lettura via Sheets API.

1. Crea un nuovo Google Sheet, rinomina il primo foglio `Prezzi`.
2. Colonna A: incolla i ticker Google Finance dei tuoi asset. Puoi ottenerli
   con `GET /api/investments/tickers` (autenticato) — ritorna un elenco
   testuale, un ticker per riga, pronto da incollare.
3. Colonne B-E, per ogni riga con un ticker in colonna A:
   - `B2`: `=GOOGLEFINANCE(A2;"price")`
   - `C2`: `=GOOGLEFINANCE(A2;"priceopen")`
   - `D2`: `=GOOGLEFINANCE(A2;"changepct")`
   - `E2`: `=GOOGLEFINANCE(A2;"currency")`
   Trascina le formule per tutte le righe.
4. Cella `G1`: `=NOW()` — usata dal price fetcher per capire se il foglio
   viene ancora aperto/ricalcolato (se più vecchia di 2 ore, il fetcher passa
   al fallback Yahoo per tutti i ticker).

## 4. Creare il service account Google

1. Google Cloud Console → nuovo progetto (o riusane uno esistente) → abilita
   **Google Sheets API**.
2. IAM & Admin → Service Accounts → crea un service account, genera una
   **chiave JSON** e scaricala.
3. Condividi il Google Sheet ponte (creato al punto 3) con l'email del
   service account (`...@...iam.gserviceaccount.com`), permesso "Visualizzatore".
4. Codifica il file JSON in base64:
   ```sh
   base64 -w0 service-account-key.json
   ```

## 5. Variabili d'ambiente

Aggiungi al progetto (Vercel → Settings → Environment Variables, o
`.env.local` in locale):

| Variabile | Valore |
|---|---|
| `GOOGLE_SA_KEY_B64` | output del comando `base64` sopra |
| `GSHEET_ID` | l'ID del Google Sheet ponte (dalla URL, tra `/d/` e `/edit`) |

`CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` sono già usate dal modulo
notifiche esistente — il price fetcher le riusa, nessuna nuova variabile.

## 6. Cron

`vercel.json` include già l'entry per `/api/cron/prices` (ogni 30 minuti,
8-18 CET, giorni feriali). Su **Vercel Hobby** i cron sono limitati a
un'esecuzione al giorno: se sei su questo piano, riduci la schedule a
`"0 8 * * 1-5"` o passa a un piano Pro, altrimenti solo la prima esecuzione
del giorno verrà effettivamente eseguita.

## Fuori scope (V1)

Fiscalità italiana (zainetto, minus/plus), transazioni storiche, performance
TWR/MWR, grafico storico prezzi. Il modulo mostra solo lo stato attuale del
portafoglio; per analisi storiche/fiscali usa direttamente Google Finance
(link "Apri in Google Finance" nella pagina).
