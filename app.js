(() => {
  'use strict';
  const P = window.DeductionPuzzle;
  const el = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const modalEl = document.getElementById('modal');
  const baseURL = new URL(location.href);
  const inviteCode = (baseURL.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  const state = {
    view: inviteCode ? 'lobby' : 'home', name: readLocal('dg-name') || '', joinCode: inviteCode,
    token: null, room: null, source: null, localPuzzle: null, localResult: null,
    startedAt: 0, finishedAt: null, board: {}, marks: new Set(), history: [],
    selected: 'A', tool: 'place', accused: '', busy: false, toastTimer: null, localCooldown: 0
  };
  function readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function writeLocal(key, value) { try { localStorage.setItem(key, value); } catch {} }
  function readSession() { try { return JSON.parse(sessionStorage.getItem('dg-session') || 'null'); } catch { return null; } }
  function writeSession(value) { try { value ? sessionStorage.setItem('dg-session', JSON.stringify(value)) : sessionStorage.removeItem('dg-session'); } catch {} }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const fmt = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const countPlaced = () => Object.keys(state.board).length;
  const puzzle = () => state.view === 'solo' ? state.localPuzzle : state.room?.puzzle;
  function notify(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }
  async function api(path, data) {
    if (location.protocol === 'file:') throw new Error('Per giocare online, avvia il server o pubblica la webapp.');
    let response;
    try { response = await fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }); }
    catch { throw new Error('Server non raggiungibile. Controlla la connessione.'); }
    const obj = await response.json();
    if (!response.ok) throw new Error(obj.error || 'Operazione non riuscita.');
    return obj;
  }
  function icon(name) {
    if (name === 'bolt') return '✦';
    if (name === 'pair') return '♟';
    if (name === 'case') return '⌗';
    return name;
  }
  function renderHome() {
    const spots = { 2:'A', 9:'C', 16:'V', 19:'B', 29:'D', 32:'E' };
    const mock = Array.from({length:36}, (_, i) => {
      const id = spots[i], room = Math.floor(Math.floor(i / 6) / 2) * 2 + Math.floor((i % 6) / 3);
      return `<div class="mock-cell room${room}">${id ? `<span class="mock-token ${id === 'V' ? 'red':''}">${id}</span>` : ([6,13,20,27].includes(i) ? '<span class="mock-x">×</span>' : '')}</div>`;
    }).join('');
    return `<section class="home-hero"><div class="hero-copy"><div class="eyebrow">✳ &nbsp; UN GIALLO TUTTO DA RISOLVERE <span class="bar">/</span> 1–2 GIOCATORI</div><h1>Ogni casella<br>ha un <em>alibi.</em></h1><p>Un delitto. Cinque sospettati. Una vittima. Raccogli gli indizi, ricostruisci la scena e smaschera il colpevole. Oppure sfida un amico: stesso mistero, due menti, un solo vincitore.</p><div class="hero-actions"><button class="btn btn-gold" data-action="solo">Inizia a indagare <span class="arr">↗</span></button><button class="btn btn-outline" data-action="lobby">Sfida un amico <span class="arr">↗</span></button></div><div class="hero-detail"><span><b>✦</b> Casi sempre nuovi</span><span><b>◎</b> Senza registrazione</span><span><b>↗</b> Online in 2</span></div></div><div class="home-visual" aria-hidden="true"><div class="evidence-sticker"><small>FASCICOLO RISERVATO</small><b>CASO N° 001</b></div><div class="mock-sheet"><div class="mock-top"><b>SCENA DEL CRIMINE</b><span>RISERVATO / DG</span></div><div class="mock-grid">${mock}</div><div class="mock-note"><span>06 PERSONE · 06×06</span><span>CHI È IL COLPEVOLE?</span></div></div><div class="seal">DETECTIVE<br>CLUB<br>✳</div></div></section><section class="home-lower"><div class="feature"><div class="feature-icon">${icon('case')}</div><h3>Usa la logica, non la fortuna.</h3><p>Una persona per riga e colonna. Ogni indizio ti avvicina alla soluzione.</p></div><div class="feature"><div class="feature-icon">${icon('pair')}</div><h3>Uno contro uno, davvero online.</h3><p>Crea una stanza, manda il link e risolvi lo stesso caso prima dell'avversario.</p></div><div class="feature"><div class="feature-icon">${icon('bolt')}</div><h3>Nuovo caso, nuova sfida.</h3><p>Enigmi generati e verificati: ogni scena ha una sola soluzione corretta.</p></div></section>`;
  }
  function renderLobby() {
    return `<section class="lobby-main"><div class="lobby-heading"><div class="eyebrow">MULTIPLAYER <span class="bar">/</span> PARTITA PRIVATA</div><h1>La sfida ha inizio.</h1><p>Crea la tua stanza investigativa oppure entra con il codice ricevuto da un amico. Non serve alcun account.</p></div><div class="lobby-layout"><div class="panel lobby-panel"><div class="eyebrow">01 / OSPITA</div><h2>Crea una stanza</h2><p>Ricevi un codice e un link da condividere. La partita comincia quando entra il secondo detective.</p><label class="field-label" for="hostName">Il tuo nome</label><input id="hostName" class="field name-input" maxlength="22" placeholder="Es. Detective G" value="${esc(state.name)}"><button class="btn btn-gold btn-full" data-action="create" ${state.busy?'disabled':''}>Crea partita <span class="arr">↗</span></button></div><div class="panel lobby-panel"><div class="eyebrow">02 / PARTECIPA</div><h2>Entra in una stanza</h2><p>Inserisci il codice di sei caratteri ricevuto dal tuo avversario e unisciti alla sfida.</p><label class="field-label" for="joinName">Il tuo nome</label><input id="joinName" class="field name-input" maxlength="22" placeholder="Es. Detective C" value="${esc(state.name)}"><label class="field-label" for="roomCode">Codice stanza</label><input id="roomCode" class="field code-input mono" maxlength="6" autocapitalize="characters" placeholder="ABC123" value="${esc(state.joinCode)}"><button class="btn btn-outline btn-full" data-action="join" ${state.busy?'disabled':''}>Entra nel duello <span class="arr">↗</span></button></div></div><p class="lobby-footer">Vuoi giocare senza sfida? <button data-action="solo">Inizia una partita in solitaria</button></p></section>`;
  }
  function renderWaiting() {
    const r = state.room;
    return `<section class="waiting"><div class="circle">⌕</div><div class="eyebrow">SALA INVESTIGATIVA <span class="bar">/</span> IN ATTESA</div><h1>Serve un altro detective.</h1><p>La tua stanza è pronta. Invia il codice o il link a un amico: quando entra, il caso partirà automaticamente su entrambi i dispositivi.</p><div class="room-code">${esc(r.code)}</div><button class="btn btn-gold" data-action="invite">Copia link d'invito ↗</button><button class="btn btn-outline" data-action="copycode">Copia codice</button><div class="dots"><span></span><span></span><span></span></div><p class="tiny-note">1 detective su 2 connessi. Tieni aperta questa pagina.</p><button class="btn btn-ghost" data-action="home">← Torna alla home</button></section>`;
  }
  function conflicts() {
    const vals = Object.values(state.board), bad = new Set();
    for (const pos of vals) {
      if (vals.filter(p => P.rowAt(p) === P.rowAt(pos) || P.colAt(p) === P.colAt(pos)).length > 1) bad.add(pos);
    }
    return bad;
  }
  function boardMarkup(p) {
    const ids = Object.fromEntries(Object.entries(state.board).map(([k,v]) => [v,k]));
    const bad = conflicts();
    const people = Object.fromEntries(p.characters.map(x => [x.id,x]));
    const cells = Array.from({length:36}, (_,i) => {
      const r = P.rowAt(i), c = P.colAt(i), room = P.roomAt(i), id = ids[i];
      const item = id ? people[id] : null;
      const title = `Fila ${r+1}, colonna ${c+1}, ${p.rooms[room]}` + (item ? `, ${item.name}` : '');
      const label = r%2===0 && c%3===0 ? `<span class="room-name">${esc(p.rooms[room])}</span>` : '';
      return `<button class="cell room${room} ${state.marks.has(i)?'crossed':''} ${bad.has(i)?'conflict':''}" data-cell="${i}" title="${esc(title)}" aria-label="${esc(title)}">${label}${item?`<span class="token ${id==='V'?'victim':''}" style="--avatar:${esc(item.hue)}">${esc(id)}</span>`:''}</button>`;
    }).join('');
    return `<div class="board-wrap"><div class="col-indices">${Array.from({length:6},(_,i)=>`<span>${i+1}</span>`).join('')}</div><div class="row-indices">${Array.from({length:6},(_,i)=>`<span>${i+1}</span>`).join('')}</div><div class="scene-grid" role="group" aria-label="Scena del crimine, griglia 6 per 6">${cells}</div></div>`;
  }
  function suspectMarkup(p) {
    return `<div class="side-heading"><h2>SCHEDE DEI PERSONAGGI</h2><span class="small-num">06 / 06</span></div><div class="suspect-list">${p.characters.map(person=>`<button class="suspect ${state.selected===person.id?'active':''} ${state.board[person.id]!==undefined?'placed':''}" data-action="select" data-person="${person.id}" aria-pressed="${state.selected===person.id}"><span class="avatar" style="--avatar:${esc(person.hue)}">${esc(person.id)}</span><span class="suspect-info"><span class="suspect-top"><strong>${esc(person.name)}</strong><small>${state.board[person.id]!==undefined?'<span class="placed-check">✓</span>':''} ${esc(person.role)}</small></span><ul>${person.clues.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></span></button>`).join('')}</div>`;
  }
  function renderDuel(r) {
    return `<div class="panel duel-panel"><div class="duel-heading"><b>SFIDA IN DIRETTA</b><span class="tag lit">● LIVE</span></div>${r.players.map(pl=>`<div class="competitor"><div class="competitor-icon">${esc(pl.name.slice(0,1).toUpperCase())}</div><div class="competitor-info"><b>${esc(pl.name)} ${pl.me?'<span class="gold-txt">(tu)</span>':''}</b><small>${pl.online?'● Online':'○ Disconnesso'} · ${pl.progress}/6 posizionati · ${pl.wins || 0} vittorie</small></div><div class="mini-meter" style="--progress:${pl.progress/6*100}%"><span></span></div></div>`).join('')}<div class="duel-bottom"><span>STANZA <strong>${esc(r.code)}</strong></span><button class="btn-ghost" style="padding:0" data-action="invite">Invita ↗</button></div></div>`;
  }
  function resultMarkup(r) {
    const isSolo = state.view === 'solo';
    const result = isSolo ? state.localResult : r.result;
    const selfWon = isSolo || (r.players.find(pl=>pl.me)?.id === result.winnerId);
    return `<div class="panel right-section"><div class="result-top"><div class="result-stamp">${selfWon?'★':'⌛'}</div><div class="section-kicker">FASCICOLO CHIUSO</div><h2>${isSolo?'Caso risolto!':selfWon?'Hai vinto il duello!':'Il tuo avversario ha vinto.'}</h2><p>${isSolo?'Ottimo lavoro, detective. Tutte le posizioni e l’accusa sono corrette.':selfWon?'Hai ricostruito la scena prima dell’avversario.':'La sfida è terminata. Puoi chiedere la rivincita.'}</p></div><div class="result-card"><label>ASSASSINO IDENTIFICATO</label><strong>${esc(result.killerName)}</strong></div><div class="result-card"><label>TEMPO DELLA RISOLUZIONE</label><strong>${fmt(result.elapsedMs)}</strong></div><div class="result-actions">${isSolo?'<button class="btn btn-gold btn-full" data-action="solo">Nuovo caso ↗</button>':`<button class="btn btn-gold btn-full" data-action="rematch" ${r.players.find(pl=>pl.me)?.ready?'disabled':''}>${r.players.find(pl=>pl.me)?.ready?'In attesa della rivincita…':'Chiedi la rivincita ↗'}</button><button class="btn btn-outline btn-full" data-action="invite">Copia link stanza</button>`}<button class="btn btn-ghost btn-full" data-action="home">Torna alla home</button></div>${!isSolo&&r.players.some(pl=>pl.ready)?`<p class="tiny-note">${r.players.filter(pl=>pl.ready).length}/2 giocatori pronti per la rivincita.</p>`:''}</div>`;
  }
  function renderGame() {
    const p = puzzle(), r = state.room || {}, finished = state.view==='solo'?!!state.localResult:r.phase==='finished';
    const selected = p.characters.find(x=>x.id===state.selected);
    const conflictCount = conflicts().size;
    const time = finished ? (state.view==='solo' ? state.finishedAt : r.finishedAt) : Date.now();
    const started = state.view==='solo' ? state.startedAt : r.startedAt;
    const timeText = fmt(time - started);
    const cooldown = state.view === 'solo' ? state.localCooldown : r.cooldownUntil || 0;
    return `<section class="game-page"><div class="game-bar"><div><div class="eyebrow">${state.view==='solo'?'MODALITÀ SOLITARIA':`DUELLO ONLINE <span class="bar">/</span> ROUND ${r.round}`} <span class="bar">/</span> ${esc(p.id)}</div><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p></div><div class="game-bar-actions"><span class="tag lit">${state.view==='solo'?'● SOLO':'● 1 VS 1'}</span><div class="time-box"><span>TEMPO TRASCORSO</span><strong id="clock-time">${timeText}</strong></div><button class="btn btn-outline btn-small" data-action="home">← Esci</button></div></div><div class="game-layout"><aside class="sidebar sidebar-people">${suspectMarkup(p)}</aside><div class="board-column"><div class="board-panel"><div class="board-top"><h2>PIANTA DELLA SCENA</h2><span>6 × 6 <span class="gold-txt">✳</span> 6 aree</span></div><div class="scene-note"><strong>IL DELITTO:</strong> la vittima era nella stessa area dell'assassino, e nessun altro era con loro. Tutti occupavano righe e colonne diverse.</div><div class="mobile-picker" aria-label="Seleziona un personaggio">${p.characters.map(c=>`<button type="button" class="mobile-person ${state.selected===c.id && state.tool==='place'?'active':''}" data-action="select" data-person="${c.id}" aria-label="Seleziona ${esc(c.name)}" aria-pressed="${state.selected===c.id && state.tool==='place'}"><span style="--avatar:${esc(c.hue)}">${esc(c.id)}</span><small>${esc(c.name)}</small></button>`).join('')}</div>${boardMarkup(p)}<div class="board-toolbar"><button class="tool ${state.tool==='place'?'active':''}" data-action="place">◉ &nbsp; Posiziona</button><button class="tool ${state.tool==='mark'?'active':''}" data-action="mark">× &nbsp; Escludi</button><button class="tool" data-action="undo" ${state.history.length?'':'disabled'}>↶ &nbsp; Annulla</button><button class="tool" data-action="reset">⟲ &nbsp; Pulisci</button></div><div class="board-caption"><span>✳</span><span>Seleziona un personaggio a sinistra e poi una casella. <strong>Click destro</strong> per segnare una X. Premi di nuovo per rimuovere.</span></div></div><div class="case-progress"><div><span>RICOSTRUZIONE DELLA SCENA</span><strong>${countPlaced()}/6</strong></div><div class="progress-track" style="--progress:${countPlaced()/6*100}%"><i></i></div>${conflictCount?'<div class="board-caption" style="color:#efaa9e">Attenzione: due persone condividono una riga o una colonna.</div>':''}</div></div><aside class="sidebar sidebar-right">${state.view==='room'?renderDuel(r):''}${finished?resultMarkup(r):`<div class="accuse-panel"><div class="section-kicker">ATTO FINALE / ACCUSA</div><h2>Chi è l’assassino?</h2><p>Quando hai ricostruito tutta la scena, seleziona il colpevole. ${state.view==='room'?'Il primo detective a risolvere vince.':'Controlla bene prima di accusare.'}</p><label class="field-label" for="accused">Il tuo sospettato</label><select class="field" id="accused"><option value="">Scegli il colpevole…</option>${p.characters.filter(x=>x.id!=='V').map(x=>`<option value="${x.id}" ${state.accused===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select><button class="btn btn-red" data-action="submit" ${countPlaced()<6||conflictCount||!state.accused||Date.now()<cooldown?'disabled':''}>Conferma l'accusa →</button><div class="room-helper">${Date.now()<cooldown?'Nuovo tentativo disponibile fra alcuni secondi.':'La soluzione viene verificata solo quando confermi l’accusa.'}</div></div>`}<div class="panel right-section"><div class="section-kicker">MANUALE DEL DETECTIVE</div><h2>Le regole del gioco</h2><div class="rule-list"><div class="rule-row"><span>1</span> Esattamente una persona per ogni riga e colonna.</div><div class="rule-row"><span>2</span> Usa tutti gli indizi delle sei schede.</div><div class="rule-row"><span>3</span> La vittima condivide un’area soltanto con il colpevole.</div><div class="rule-row"><span>4</span> Trova tutte le posizioni e indica l’assassino.</div></div></div>${state.view==='room'?`<div class="panel right-section"><div class="section-kicker">INVITO PRIVATO</div><p>Codice stanza: <strong style="color:var(--gold);font-family:'DM Mono'">${esc(r.code)}</strong></p><button class="btn btn-outline btn-small" data-action="invite">Copia link ↗</button></div>`:''}</aside></div></section>`;
  }
  function render() {
    let html;
    if (state.view === 'home') html = renderHome();
    else if (state.view === 'lobby') html = renderLobby();
    else if (state.view === 'room' && state.room?.phase === 'waiting') html = renderWaiting();
    else if (state.view === 'room' && state.room?.puzzle) html = renderGame();
    else if (state.view === 'solo') html = renderGame();
    else html = renderLobby();
    el.innerHTML = html;
    updateTimer();
  }
  function updateTimer() {
    const target = document.getElementById('clock-time');
    if (!target || !puzzle()) return;
    const ended = state.view === 'solo' ? state.finishedAt : state.room?.finishedAt;
    const started = state.view === 'solo' ? state.startedAt : state.room?.startedAt;
    if (started) target.textContent = fmt((ended || Date.now()) - started);
    if (target && !ended && state.view === 'room' && state.room?.cooldownUntil && Date.now() > state.room.cooldownUntil) {
      const btn = document.querySelector('[data-action="submit"]');
      if (btn && countPlaced()===6 && state.accused && conflicts().size===0) btn.disabled = false;
    }
  }
  function resetBoard() {
    state.board = {}; state.marks = new Set(); state.history = [];
    state.selected = 'A'; state.tool = 'place'; state.accused = ''; state.localResult = null; state.localCooldown = 0;
  }
  function startSolo() {
    leaveRoom(); resetBoard();
    state.localPuzzle = P.generatePuzzle(Date.now() ^ Math.floor(Math.random() * 4294967295));
    state.startedAt = Date.now(); state.finishedAt = null; state.view='solo';
    if (location.protocol !== 'file:') history.replaceState(null, '', location.pathname);
    render(); window.scrollTo({top:0,behavior:'smooth'});
  }
  function saveProgress() {
    if (state.view !== 'room' || !state.room || !state.token) return;
    writeSession({code:state.room.code, token:state.token, round:state.room.round,
      board:{...state.board}, marks:[...state.marks], accused:state.accused});
  }
  function leaveRoom() {
    if (state.source) { state.source.close(); state.source = null; }
    state.room = null; state.token = null; writeSession(null);
  }
  function toHome() {
    leaveRoom(); state.view = 'home'; state.localPuzzle = null;
    if (location.protocol !== 'file:') history.replaceState(null, '', location.pathname);
    render(); window.scrollTo({top:0,behavior:'smooth'});
  }
  function roomUpdate(data) {
    if (state.view !== 'room') return;
    const oldRound = state.room?.round;
    const newRound = data.round;
    if (newRound && newRound !== oldRound && data.phase === 'playing') resetBoard();
    state.room = data;
    if (newRound && newRound !== oldRound) saveProgress();
    render();
  }
  function openEvents() {
    if (state.source) state.source.close();
    if (!state.room || !state.token || !window.EventSource) return;
    const code = state.room.code;
    const events = new EventSource(`/api/rooms/${code}/events?token=${encodeURIComponent(state.token)}`);
    state.source = events;
    events.addEventListener('state', event => {
      if (state.view !== 'room' || state.room?.code !== code) return;
      try { roomUpdate(JSON.parse(event.data)); } catch (error) { console.error('Event parse:', error); }
    });
    events.onerror = () => { /* EventSource reconnects automatically. */ };
  }
  function enterRoom(obj) {
    state.token = obj.token;
    const saved = readSession();
    state.room = obj.state; state.view = 'room'; resetBoard();
    if (saved && saved.code===obj.state.code && saved.round===obj.state.round && obj.state.phase!=='waiting') {
      state.board = saved.board || {}; state.marks = new Set(saved.marks || []); state.accused = saved.accused || '';
    }
    saveProgress();
    history.replaceState(null, '', `${location.pathname}?room=${obj.state.code}`);
    render(); openEvents(); window.scrollTo({top:0,behavior:'smooth'});
  }
  async function createRoom() {
    state.busy = true; render();
    try {
      writeLocal('dg-name', state.name);
      enterRoom(await api('/api/rooms', {name:state.name}));
    } catch (e) { notify(e.message); }
    finally { state.busy = false; if(state.view==='lobby') render(); }
  }
  async function joinRoom() {
    const code = state.joinCode.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) return notify('Inserisci un codice stanza valido di 6 caratteri.');
    state.busy = true; render();
    try {
      writeLocal('dg-name', state.name);
      const existing = readSession();
      enterRoom(await api(`/api/rooms/${code}/join`, { name:state.name, token: existing?.code===code ? existing.token : undefined }));
    } catch (e) { notify(e.message); }
    finally { state.busy = false; if(state.view==='lobby') render(); }
  }
  async function act(action, extra={}) {
    if (!state.room || !state.token) return;
    return api(`/api/rooms/${state.room.code}/action`, {token:state.token, action, ...extra});
  }
  function saveUndo() {
    state.history.push({board:{...state.board},marks:[...state.marks]});
    if (state.history.length>60) state.history.shift();
  }
  function cellClick(position, forceMark=false) {
    if (!puzzle() || state.localResult || (state.view==='room'&&state.room?.phase!=='playing')) return;
    saveUndo();
    if (forceMark || state.tool === 'mark') {
      const occupant = Object.entries(state.board).find(([,idx])=>idx===position);
      if (occupant) delete state.board[occupant[0]];
      if (state.marks.has(position)) state.marks.delete(position);
      else state.marks.add(position);
    } else {
      const person = state.selected;
      const current = state.board[person];
      const existing = Object.entries(state.board).find(([,pos])=>pos===position);
      if (existing) delete state.board[existing[0]];
      if (current !== position) { state.board[person]=position; state.marks.delete(position); }
    }
    if (state.view === 'room') {saveProgress(); act('progress', {count:countPlaced()}).catch(()=>{});}
    render();
  }
  function resetSelections() {
    if (countPlaced()===0 && state.marks.size===0) return;
    if (!window.confirm('Cancellare tutte le posizioni e le X segnate sulla griglia?')) return;
    saveUndo(); state.board = {}; state.marks = new Set();
    if (state.view==='room') {saveProgress();act('progress',{count:0}).catch(()=>{});}
    render();
  }
  async function submit() {
    const p = puzzle();
    if (!p || countPlaced() !== 6 || conflicts().size) return notify('Posiziona tutte e sei le persone, una per riga e colonna.');
    if (!state.accused) return notify('Seleziona chi ritieni essere il colpevole.');
    if (state.view === 'solo') {
      if (!P.validateSolution(p, state.board, state.accused)) {
        state.localCooldown = Date.now()+6000;
        notify('Qualche posizione o l’accusa non torna. Ricontrolla gli indizi.');
        render(); setTimeout(()=>{ if(state.view==='solo'&&!state.localResult) render(); },6100);
        return;
      }
      state.finishedAt=Date.now();
      state.localResult={killer:p.killer,killerName:p.characters.find(x=>x.id===p.killer).name,elapsedMs:state.finishedAt-state.startedAt};
      render(); notify('Caso risolto! Complimenti, detective.');
    } else {
      try { await act('submit',{board:state.board,accused:state.accused}); notify('Caso risolto!'); }
      catch(e){ notify(e.message); if(state.room) { state.room.cooldownUntil=Date.now()+8000; render(); } }
    }
  }
  function showHelp() {
    modalEl.innerHTML = `<div class="modal-layer" data-action="dismiss"><section class="modal-box" role="dialog" aria-modal="true" aria-label="Come si gioca"><button class="modal-close" data-action="dismiss" aria-label="Chiudi">×</button><div class="eyebrow">MANUALE DI INDAGINE / 01</div><h2>Come si gioca</h2><p>Hai una pianta 6×6 divisa in sei aree, cinque sospettati e una vittima. Tutte le persone occupano una casella diversa.</p><ol><li><strong>Leggi gli indizi:</strong> ogni personaggio ha una scheda con informazioni sulla sua posizione.</li><li><strong>Posiziona tutti:</strong> clicca un personaggio, poi una casella. Ogni riga e ogni colonna devono contenere una sola persona.</li><li><strong>Escludi possibilità:</strong> attiva il tasto × per segnare le caselle impossibili, oppure usa il click destro da computer.</li><li><strong>Trova il killer:</strong> la vittima si trovava nella stessa area dell'assassino e di nessun altro.</li><li><strong>Conferma l'accusa:</strong> la verifica controlla sia le sei posizioni sia il colpevole.</li></ol><p>In duello, tu e l'avversario ricevete lo stesso enigma ma lavorate su griglie separate. Vince chi risolve per primo.</p><button class="btn btn-gold btn-full" data-action="dismiss">Ho capito, si indaga!</button></section></div>`;
  }
  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(()=>notify('Copiato negli appunti!')).catch(()=>fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');textarea.value=text;textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();
    try { document.execCommand('copy'); notify('Copiato negli appunti!'); } catch { notify(`Link: ${text}`); }
    textarea.remove();
  }
  document.addEventListener('click', async e => {
    const cell = e.target.closest('[data-cell]');
    if (cell) return cellClick(Number(cell.dataset.cell));
    const btn = e.target.closest('[data-action]'); if (!btn || btn.disabled) return;
    const action=btn.dataset.action;
    if (action==='dismiss') { modalEl.innerHTML=''; return; }
    if (action==='home') return toHome();
    if (action==='help') return showHelp();
    if (action==='lobby') {state.view='lobby';render();return;}
    if (action==='solo') return startSolo();
    if (action==='create') return createRoom();
    if (action==='join') return joinRoom();
    if (action==='invite' && state.room) return copyText(`${location.origin}${location.pathname}?room=${state.room.code}`);
    if (action==='copycode' && state.room) return copyText(state.room.code);
    if (action==='select') { state.selected=btn.dataset.person; state.tool='place'; render();return; }
    if (action==='place'||action==='mark') {state.tool=action;render();return;}
    if (action==='undo') {const old=state.history.pop();if(old){state.board=old.board;state.marks=new Set(old.marks);if(state.view==='room'){saveProgress();act('progress',{count:countPlaced()}).catch(()=>{});}render();}return;}
    if (action==='reset') return resetSelections();
    if (action==='submit') return submit();
    if (action==='rematch') {try {await act('rematch');notify('Richiesta di rivincita inviata.');}catch(err){notify(err.message);}return;}
  });
  document.addEventListener('contextmenu',e=>{const cell=e.target.closest('[data-cell]');if(!cell)return;e.preventDefault();cellClick(Number(cell.dataset.cell),true);});
  document.addEventListener('input', e => {
    const node = e.target;
    if (node.classList.contains('name-input')) {
      state.name = node.value;
      document.querySelectorAll('.name-input').forEach(other=>{if(other!==node)other.value=node.value;});
    }
    if(node.classList.contains('code-input')) {state.joinCode=node.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);node.value=state.joinCode;}
  });
  document.addEventListener('change',e=>{if(e.target.id==='accused'){state.accused=e.target.value;saveProgress();render();}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')modalEl.innerHTML='';
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {if(e.key==='Enter'&&state.view==='lobby'&&document.activeElement?.id==='roomCode')joinRoom();return;}
    if((state.view==='solo'||state.view==='room')&&puzzle()) {
      if('123456'.includes(e.key)&&e.key.length===1) {state.selected=puzzle().characters[Number(e.key)-1].id;state.tool='place';render();}
      if(e.key.toLowerCase()==='x'){state.tool=state.tool==='mark'?'place':'mark';render();}
    }
  });
  setInterval(updateTimer, 500);
  async function resume() {
    const session = readSession();
    if (!inviteCode || !session || session.code!==inviteCode || location.protocol==='file:') { render(); return; }
    try {
      const response = await api(`/api/rooms/${inviteCode}?token=${encodeURIComponent(session.token)}`);
      enterRoom({token:session.token,state:response.state});
    } catch {writeSession(null);render();}
  }
  resume();
})();
