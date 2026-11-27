# Correzioni dalla review (blocchi A, B, D)

## Limite delle 1000 righe di Supabase
PostgREST restituisce al massimo 1000 righe per richiesta e tronca il resto senza errore.
Ogni lettura che può superare quel numero passa da `fetchAllRows` (`src/lib/supabaseFetchAll.ts`),
che legge a pagine con `.range()`. La query deve avere un ordinamento stabile (`.order('id')`),
altrimenti due pagine possono sovrapporsi.

## Segno degli importi nell'import
Negli estratti conto il tipo di movimento è il segno: negativo spesa, positivo entrata.
Il parser usa la colonna "tipo" solo se c'è ed è riconosciuta; altrimenti decide il segno.
In OFX `TRNTYPE` (es. XFER) vale in entrambe le direzioni: conta solo il segno di `TRNAMT`.
Con separatore `;` (CSV italiano) la virgola è sempre il decimale.

## Codifica dei file
Molte banche esportano in Windows-1252. Leggere come UTF-8 corrompe gli accenti.
`decodeCsvBuffer` prova UTF-8 e ricade su Windows-1252 se trova caratteri di sostituzione.

## null e undefined negli update Supabase
Un campo `undefined` sparisce dal JSON e il valore in tabella resta invariato.
Per cancellare un valore serve `null`.

## Idempotenza con un vincolo del database
"Controlla se esiste, poi inserisci" non basta con due schede aperte: entrambe vedono "non esiste".
Il vincolo unico nel database è l'unica garanzia; il codice tratta l'errore 23505 come "già fatto".

## Cache di React Query
Ogni mutation deve invalidare tutte le query che dipendono dai dati cambiati,
compresi i riepiloghi (`annual_data`), altrimenti restano vecchi fino allo `staleTime`.

## Paginazione derivata
Invece di correggere lo stato con un effetto, la pagina mostrata si calcola:
`Math.min(currentPage, totalPages)`. Nessun render intermedio con lista vuota.
