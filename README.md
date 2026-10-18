# Delitto in Griglia

Webapp originale in italiano di logica investigativa, con modalità **solo** e **duello online 1 contro 1**. Meccanica: 6×6, 5 sospettati + vittima, una persona per riga e colonna, indizi spaziali, assassino unico nell'area con la vittima.

Non è affiliato al progetto originale Murdoku. Non contiene casi o asset originali di Murdoku.

## Avviare in locale

Richiede Node.js 18 o superiore. Non è necessario installare dipendenze.

```bash
npm start
```

Apri **http://localhost:3000**. Puoi testare il duello aprendo una stanza in una finestra e inserendo il codice in un'altra finestra privata. Per due telefoni sulla stessa Wi-Fi usa l'indirizzo IP locale del computer al posto di `localhost` (porta 3000, se consentita dal firewall).

La modalità **solitaria** funziona anche aprendo direttamente `public/index.html` in un browser: il motore dell'enigma gira interamente in JavaScript. Le partite online richiedono il server Node.

## Pubblicare online

1. Carica questa cartella in un repository GitHub.
2. Su **Render**, **Railway**, **Fly.io** o un servizio con supporto Node.js, crea un servizio web collegato al repository.
3. Imposta `npm start` come comando di avvio e la versione Node.js 18+.
4. Il server usa automaticamente la variabile d'ambiente `PORT` fornita dal servizio. Assicurati che il servizio supporti connessioni HTTP persistenti (SSE).
5. Invia agli amici il link HTTPS ottenuto. Entrambi giocano dal proprio browser e si connettono allo stesso server.

**Importante**: usa **una sola istanza del server**. Le stanze sono conservate in memoria, quindi un riavvio elimina le stanze attive. Per gestire più istanze o salvare uno storico dei risultati, occorre spostare le stanze su un database e usare un servizio di pub/sub.

## Funzioni

- Enigmi generati proceduralmente e verificati per **unicità della soluzione**.
- Stessa griglia e stessi indizi per entrambi i detective.
- Griglie private, marcatura con X, annulla, pulisci, indicatore di conflitti.
- Sfida sincronizzata in tempo reale con **Server-Sent Events (SSE)**.
- Codice stanza a 6 caratteri e link d'invito.
- Cronometro, progresso dell'avversario (solo numero di pezzi piazzati), primo a risolvere vince.
- Lato server: verifica della soluzione e dell'assassino, pausa di 8 secondi dopo un'accusa errata.
- Rivincita con accordo di entrambi e nuovo caso.
- Riconnessione dopo il refresh usando `sessionStorage` (nella stessa scheda).
- Nessun account, nessun cookie di tracciamento, nessun pacchetto esterno.

## Sicurezza e limitazioni

- Prototipo funzionante, non un servizio enterprise. Le stanze si eliminano dopo 6 ore d'inattività se non ci sono connessioni attive.
- Il duello è basato sulla fiducia tra amici, non include protezioni avanzate contro bot o cheating.
- Nessun account o chat, nessuna classifica persistente.
- I font Google vengono caricati da rete; esistono fallback di sistema.

## Test

```bash
npm test
```

Controlla la generazione e l'unicità di un campione di casi.

## Demo immediata, senza installare nulla

Nella consegna è presente anche **Delitto-in-Griglia-GIOCA.html**: aprilo direttamente dal tuo computer o telefono per la modalità singola. Il file contiene tutto il codice e la grafica necessari. Per una partita online da due dispositivi diversi devi usare la versione pubblicata su un server Node.js e condividere il link HTTPS della stanza.

## Cosa non fa ancora questa versione

Non include account, chat, matchmaking pubblico o leaderboard globale. Le stanze e le vittorie del duello restano in memoria per la durata della stanza; se il server si riavvia, si perdono. Questa prima versione usa mappe originali 6×6 con sei aree e indizi di posizione e relazione (non riproduce le illustrazioni o i casi di Murdoku).
