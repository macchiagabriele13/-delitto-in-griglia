# Pubblicare Delitto in Griglia (1 contro 1 online)

Questa versione usa **Node.js** e deve essere pubblicata come **Web Service**, non come Static Site. Le stanze sono condivise solo quando due utenti accedono alla stessa istanza del server.

## Passaggi sul browser, senza terminale

1. Apri https://github.com/new, accedi a GitHub e crea un repository chiamato `delitto-in-griglia` (privato o pubblico), senza inizializzarlo con altri file.
2. Scompatta `Delitto-in-Griglia-PRONTO-PER-RENDER.zip` sul computer. Nel repository, usa **Add file → Upload files** e carica **tutti i file e la cartella `public`** estratti, non lo ZIP. Al livello principale di GitHub devono comparire `package.json`, `server.js` e `render.yaml`. Conferma con **Commit changes**.
3. Vai su https://dashboard.render.com/ e scegli **New → Web Service**. Collega il repository GitHub appena creato. Configura runtime **Node**, build command `npm install`, start command `npm start`, plan **Free** (se disponibile), e crea il servizio. In alternativa, usa **New → Blueprint** per leggere automaticamente `render.yaml` dal repository.
4. Aspetta che lo stato del servizio sia **Live**. Render mostrerà il vero indirizzo `https://<nome-servizio>.onrender.com`. Aprilo: qui puoi creare una stanza e copiare il codice/link invito. L'avversario apre lo stesso sito e inserisce il codice o segue il link.

**Note:** su Free il servizio può addormentarsi dopo un periodo di inattività: la prima apertura successiva può essere più lenta. Le stanze risiedono in memoria e si perdono se il servizio si riavvia. Non usare più istanze senza introdurre uno stato condiviso.

## Controlli

- Visita `https://<indirizzo-render>/health`: deve apparire un JSON con `ok: true`.
- Apri una stanza da un dispositivo e raggiungila da un secondo dispositivo; i due giocatori devono vedere lo stesso caso.
- Puoi eseguire localmente `npm test` prima del deploy.
