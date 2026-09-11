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

### 1-bis. Migration quotazione obbligazioni

Esegui anche `supabase/migrate_investments_bond_quotation.sql`: aggiunge
`assets.price_divisor` (fattore di quotazione), la classe `bond` e ricrea
`get_investment_summary()`. Senza questa migration le posizioni obbligazionarie
risultano valorizzate 100 volte il loro controvalore reale.

Lo script elimina e ricrea `get_investment_summary()`: aggiungere una colonna al
`RETURNS TABLE` cambia il tipo di ritorno della funzione e `CREATE OR REPLACE`
non lo consente. È interamente ri-eseguibile (`IF NOT EXISTS` / `IF EXISTS` su
colonna, vincoli e funzione), quindi si può rilanciare senza effetti collaterali
se una prima esecuzione è fallita a metà.

## 2. Importare il portafoglio da Fineco

Fineco → Patrimonio → Portafoglio titoli → Esporta (CSV). Carica il file nella
pagina `/investimenti` (drag & drop o click). L'import sostituisce
integralmente le posizioni esistenti — è pensato per essere ripetuto a ogni
aggiornamento del portafoglio, non per operazioni incrementali.

### Come viene risolto il ticker

Ordine di precedenza, dal più autorevole:

1. **`isin_ticker_lookup`** — la tabella manuale vince sempre.
2. **Derivazione da `Simbolo` + `Mercato` del CSV** — il broker ci dà entrambi,
   quindi non c'è niente da indovinare: `VWCE` + `MTA` → `BIT:VWCE` (Google
   Finance) e `VWCE.MI` (Yahoo). I ticker dedotti sono elencati nel riquadro
   verde a fine import: **vanno incollati nella colonna A del Sheet ponte**.
3. **Valore già presente sull'asset** — un ticker impostato prima non viene mai
   sovrascritto con un valore vuoto.

La derivazione avviene solo per i mercati in tabella (`resolveTicker.ts`: Borsa
Italiana incluso il codice Fineco `AFF`, Xetra, NYSE/NASDAQ/ARCA/AMEX, Londra,
Euronext Parigi/Amsterdam/Bruxelles con i codici `EURONEXTNL`/`FR`/`BE`, SIX,
BME). Su un mercato sconosciuto **non** viene inventato nulla: l'ISIN resta non
mappato e il mercato viene elencato nel banner, così si può aggiungere la riga
di lookup a mano (o la mappatura del mercato nel codice).

Alcuni mercati sono riconosciuti ma **non espongono un ticker utilizzabile**, e
non compaiono fra quelli "non riconosciuti":

| Mercato | Perché |
|---|---|
| `EQUIDUCT` | MTF paneuropeo in duplice quotazione: il simbolo non identifica una piazza di Google Finance, e il listino primario quota spesso in una valuta diversa dal carico — dedurlo darebbe un P&L sbagliato |
| `MOT`, `EuroTLX`, `ExtraMOT`, `Hi-MTF` | Mercati obbligazionari: il "simbolo" Fineco non è un ticker |

Su questi il ticker va impostato a mano in `isin_ticker_lookup`, scegliendo
consapevolmente la piazza (e quindi la valuta) con cui confrontare il carico.

Una posizione senza prezzo di mercato non vale zero: viene **valorizzata al
costo di carico** (P&L 0) e la tabella mostra "al costo" al posto del prezzo.
Azzerarla la farebbe sparire dal totale e mostrerebbe una perdita del 100% mai
avvenuta.

### Obbligazioni: quotazione in percentuale

Le obbligazioni quotano in percentuale del valore nominale. Fineco riporta
quantità = nominale (es. `10.000`) e prezzo = percentuale (es. `98,50`): il
controvalore è `10.000 × 98,50 / 100 = 9.850 €`, non 985.000 €.

Il fattore non viene dedotto dal nome dello strumento ma **verificato sul file**:
il parser prova quale divisore riproduce la colonna `Valore di carico`, che
Fineco ha già calcolato (il cambio viene provato in entrambe le direzioni,
perché la convenzione della colonna non è dichiarata nell'export). Il tipo
strumento (`Obbligazioni`, `Titoli di Stato`) resta come ripiego se quella
colonna manca. Il risultato finisce in `assets.price_divisor` e vale per il
carico e per ogni prezzo successivo.

Un **ETF obbligazionario** non è quotato in percentuale: resta `etf_bond` con
divisore 1.

Se `Valore di carico` manca, il ripiego guarda anche il **nome**: i titoli di
Stato hanno nomi Fineco riconoscibili (`BTP-1FB33 5,75`, `GREECE-30GE28 3,75`).
I nomi che contengono marcatori di fondo (`ETF`, `UCITS`, `SICAV`) sono esclusi,
così un "Govt Bond UCITS ETF" non viene scambiato per un governativo.

### Classe dell'asset

Se l'ISIN non è in `isin_ticker_lookup`, la classe viene dedotta dal CSV:

| Condizione | Classe |
|---|---|
| Quotato in percentuale del nominale | `bond` |
| Nome/tipo da fondo (`ETF`, `UCITS`...) con marcatori obbligazionari (`Bond`, `Govt`, `Corp`, `High Yield`, `Aggregate`) | `etf_bond` |
| Altri fondi | `etf_equity` |
| Tipo `Azioni`/`Stock`/`Equity` | `stock` |
| Nessuna delle precedenti | classe già presente, altrimenti `other` |

La colonna `Strumento` dice solo "ETF" e non basta a distinguere un azionario da
un obbligazionario: la discriminante è il nome del prodotto. Per una
classificazione più fine (es. `etf_thematic`) usa `isin_ticker_lookup`, che ha
sempre la precedenza.

### Layout dell'export Fineco

Il file scaricato da Fineco (`Portafoglio di sintesi`) è UTF-8 con BOM, righe
CRLF, separatore virgola, e ha questa forma:

```
Portafoglio di sintesi,,,,,...
,,,,,...
Titolo,ISIN,Simbolo,Mercato,Strumento,Valuta,Quantità,P.zo medio di carico,Cambio di carico,Valore di carico,P.zo di mercato,...
<una riga per posizione>
Totale,,,,,...
EUR,,,,,...
```

Due dettagli specifici di questo export:

- **`Strumento` non è il nome del titolo** ma il tipo (ETF, Azioni, Fondo): il
  nome viene preso da `Titolo`.
- **`P.zo medio di carico` è nella valuta del titolo**, mentre `Valore di
  carico` è già convertito in euro. Il parser usa il primo, così il carico è
  confrontabile con il prezzo che arriva dal price feed; la valuta di ogni
  posizione viene letta da `Valuta` e salvata su `assets.currency`.

Se l'export contiene solo intestazione e riga `Totale` (nessuna posizione),
l'import lo dice esplicitamente: va riscaricato con le posizioni aperte.

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
| Prezzo di carico | ...anche `P.zo medio di carico` (nome usato da Fineco) |
| Nome (opzionale) | `Titolo`, `Descrizione`, `Denominazione`; in mancanza `Strumento`, poi `Simbolo`/`Ticker` |
| Valuta (opzionale) | `Valuta`, `Divisa`, `Currency` |
| Simbolo / Mercato (opzionali) | `Simbolo`/`Ticker`, `Mercato`/`Borsa` — usati per derivare il ticker |
| Tipo strumento (opzionale) | `Strumento`, `Tipo`, `Tipologia` — usato per classe e quotazione |

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
| `Nessuna posizione valida trovata nel CSV` | tutte le righe scartate, oppure export con la sola intestazione | leggi i warning elencati nel messaggio |
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
