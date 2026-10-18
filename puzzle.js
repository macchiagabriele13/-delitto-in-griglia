/* Original procedural logic puzzle engine. Browser + Node compatible. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DeductionPuzzle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIZE = 6;
  const PEOPLE = [
    { id: 'A', name: 'Ada', role: 'Sospettata', hue: '#cfb17a' },
    { id: 'B', name: 'Bruno', role: 'Sospettato', hue: '#8ca6c3' },
    { id: 'C', name: 'Clara', role: 'Sospettata', hue: '#bc8ca6' },
    { id: 'D', name: 'Diego', role: 'Sospettato', hue: '#9db68c' },
    { id: 'E', name: 'Elena', role: 'Sospettata', hue: '#bb9789' },
    { id: 'V', name: 'La vittima', role: 'Vittima', hue: '#e58b73' }
  ];
  const ROOM_SETS = [
    ['Biblioteca', 'Atrio', 'Sala da tè', 'Galleria', 'Studio', 'Serra'],
    ['Archivio', 'Ingresso', 'Sala musica', 'Cucina', 'Ufficio', 'Giardino'],
    ['Salone', 'Guardaroba', 'Sala giochi', 'Corridoio', 'Laboratorio', 'Veranda'],
    ['Biblioteca', 'Sala trofei', 'Sala da pranzo', 'Atrio', 'Studio', 'Terrazza']
  ];
  const CASE_NAMES = [
    { title: 'L’ultimo brindisi', description: 'Durante una festa in villa, uno degli ospiti è stato trovato senza vita. Nessuno può lasciare l’edificio.' },
    { title: 'Una notte al museo', description: 'Le porte erano chiuse, le telecamere spente. Cinque persone e una vittima, ma una sola versione dei fatti.' },
    { title: 'Il segreto della villa', description: 'Le luci si sono spente per pochi minuti. Gli indizi rivelano dove si trovava ognuno.' },
    { title: 'Delitto a mezzanotte', description: 'Allo scoccare delle dodici, il silenzio è stato interrotto. Ricostruisci gli spostamenti.' },
    { title: 'Il caso della porta rossa', description: 'Una porta è rimasta socchiusa. La disposizione degli ospiti contiene la risposta.' },
    { title: 'L’ombra del sospetto', description: 'Le testimonianze sembrano combaciare. È la disposizione sulla pianta a svelare il colpevole.' }
  ];

  function random(seed) {
    let x = (Number(seed) >>> 0) || 0x1a2b3c4d;
    return function () {
      x += 0x6d2b79f5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(items, rng) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const roomAt = pos => Math.floor(Math.floor(pos / SIZE) / 2) * 2 + Math.floor((pos % SIZE) / 3);
  const rowAt = pos => Math.floor(pos / SIZE);
  const colAt = pos => pos % SIZE;
  const nameOf = id => PEOPLE.find(p => p.id === id).name;
  const posOf = (p, id) => p[id];

  function clueMatches(clue, placements) {
    const pa = posOf(placements, clue.a);
    if (pa === undefined || pa === null) return true;
    const r = rowAt(pa), c = colAt(pa);
    const pb = clue.b ? posOf(placements, clue.b) : null;
    if (clue.b && (pb === undefined || pb === null)) return true;
    switch (clue.type) {
      case 'room': return roomAt(pa) === clue.value;
      case 'rowHalf': return (r < 3 ? 0 : 1) === clue.value;
      case 'colHalf': return (c < 3 ? 0 : 1) === clue.value;
      case 'rowParity': return (r % 2) === clue.value;
      case 'colParity': return (c % 2) === clue.value;
      case 'border': return (r === 0 || r === 5 || c === 0 || c === 5) === !!clue.value;
      case 'row': return r === clue.value;
      case 'col': return c === clue.value;
      case 'north': return r < rowAt(pb);
      case 'south': return r > rowAt(pb);
      case 'west': return c < colAt(pb);
      case 'east': return c > colAt(pb);
      case 'rowNeighbor': return Math.abs(r - rowAt(pb)) === 1;
      case 'colNeighbor': return Math.abs(c - colAt(pb)) === 1;
      case 'rowGap2': return Math.abs(r - rowAt(pb)) === 2;
      case 'colGap2': return Math.abs(c - colAt(pb)) === 2;
      default: return false;
    }
  }
  function clueText(clue, rooms) {
    const n = clue.b ? nameOf(clue.b) : '';
    switch (clue.type) {
      case 'room': return `Si trovava nell’area «${rooms[clue.value]}».`;
      case 'rowHalf': return clue.value === 0 ? 'Era in una delle tre file superiori.' : 'Era in una delle tre file inferiori.';
      case 'colHalf': return clue.value === 0 ? 'Si trovava nella metà sinistra della pianta.' : 'Si trovava nella metà destra della pianta.';
      case 'rowParity': return clue.value === 0 ? 'Era in una fila dispari (1, 3 o 5).' : 'Era in una fila pari (2, 4 o 6).';
      case 'colParity': return clue.value === 0 ? 'Era in una colonna dispari (1, 3 o 5).' : 'Era in una colonna pari (2, 4 o 6).';
      case 'border': return clue.value ? 'Era lungo il perimetro della pianta.' : 'Non era in una casella sul bordo.';
      case 'row': return `Era nella fila ${clue.value + 1}.`;
      case 'col': return `Era nella colonna ${clue.value + 1}.`;
      case 'north': return `Era più a nord di ${n}.`;
      case 'south': return `Era più a sud di ${n}.`;
      case 'west': return `Era più a ovest di ${n}.`;
      case 'east': return `Era più a est di ${n}.`;
      case 'rowNeighbor': return `Era in una fila adiacente a quella di ${n}.`;
      case 'colNeighbor': return `Era in una colonna adiacente a quella di ${n}.`;
      case 'rowGap2': return `C’erano esattamente due file di differenza rispetto a ${n}.`;
      case 'colGap2': return `C’erano esattamente due colonne di differenza rispetto a ${n}.`;
    }
  }

  // Checks up to `limit` solutions. Row/column uniqueness and the victim rule are built in.
  function enumerateSolutions(clues, limit = 2) {
    const placed = Object.create(null);
    const counts = {};
    for (const p of PEOPLE) counts[p.id] = 0;
    for (const c of clues) counts[c.a] += 2; // prioritize constrained people
    const order = PEOPLE.map(p => p.id).sort((a, b) => counts[b] - counts[a]);
    let found = 0;
    const examples = [];
    function visit(depth, usedRows, usedCols) {
      if (found >= limit) return;
      if (depth === SIZE) {
        const victimRoom = roomAt(placed.V);
        if (PEOPLE.slice(0, 5).filter(person => roomAt(placed[person.id]) === victimRoom).length === 1) {
          found++; examples.push({ ...placed });
        }
        return;
      }
      const id = order[depth];
      for (let r = 0; r < SIZE; r++) {
        if (usedRows & (1 << r)) continue;
        for (let c = 0; c < SIZE; c++) {
          if (usedCols & (1 << c)) continue;
          placed[id] = r * SIZE + c;
          let valid = true;
          for (const clue of clues) {
            if (clue.a === id || clue.b === id) {
              if (!clueMatches(clue, placed)) { valid = false; break; }
            }
          }
          if (valid) visit(depth + 1, usedRows | 1 << r, usedCols | 1 << c);
          delete placed[id];
          if (found >= limit) return;
        }
      }
    }
    visit(0, 0, 0);
    return examples;
  }
  function countSolutions(clues, limit = 2) {
    return enumerateSolutions(clues, limit).length;
  }

  function createCandidates(solution, rooms) {
    const candidates = [];
    const add = (a, type, value, b) => {
      const clue = { a, type };
      if (value !== undefined) clue.value = value;
      if (b) clue.b = b;
      if (clueMatches(clue, solution)) candidates.push(clue);
    };
    for (const p of PEOPLE) {
      const a = p.id, pos = solution[a], r = rowAt(pos), c = colAt(pos);
      add(a, 'room', roomAt(pos));
      add(a, 'rowHalf', r < 3 ? 0 : 1);
      add(a, 'colHalf', c < 3 ? 0 : 1);
      add(a, 'rowParity', r % 2);
      add(a, 'colParity', c % 2);
      add(a, 'border', r === 0 || r === 5 || c === 0 || c === 5);
      add(a, 'row', r);
      add(a, 'col', c);
      for (const q of PEOPLE) {
        if (q.id === a) continue;
        const rr = rowAt(solution[q.id]), cc = colAt(solution[q.id]);
        add(a, r < rr ? 'north' : 'south', undefined, q.id);
        add(a, c < cc ? 'west' : 'east', undefined, q.id);
        if (Math.abs(r - rr) === 1) add(a, 'rowNeighbor', undefined, q.id);
        if (Math.abs(c - cc) === 1) add(a, 'colNeighbor', undefined, q.id);
        if (Math.abs(r - rr) === 2) add(a, 'rowGap2', undefined, q.id);
        if (Math.abs(c - cc) === 2) add(a, 'colGap2', undefined, q.id);
      }
    }
    return candidates;
  }

  function generatePuzzle(seed = Date.now()) {
    const rng = random(seed);
    const rooms = ROOM_SETS[Math.floor(rng() * ROOM_SETS.length)];
    const premise = CASE_NAMES[Math.floor(rng() * CASE_NAMES.length)];
    let solution = null, killer = null;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const columns = shuffled([0, 1, 2, 3, 4, 5], rng);
      const ids = shuffled(PEOPLE.map(p => p.id), rng);
      const candidate = Object.create(null);
      for (let r = 0; r < SIZE; r++) candidate[ids[r]] = r * SIZE + columns[r];
      const inside = ids.filter(id => id !== 'V' && roomAt(candidate[id]) === roomAt(candidate.V));
      if (inside.length === 1) { solution = candidate; killer = inside[0]; break; }
    }
    if (!solution) throw new Error('Impossibile creare il caso.');
    const candidates = createCandidates(solution, rooms);
    const selected = [], seen = new Set();
    const key = clue => JSON.stringify(clue);
    const add = clue => {
      if (!clue || seen.has(key(clue))) return false;
      selected.push(clue); seen.add(key(clue)); return true;
    };
    // Every witness starts with one personal clue; spatial clues make this an actual deduction puzzle.
    const initialTypes = ['rowHalf', 'colHalf', 'rowParity', 'colParity', 'border'];
    for (const person of PEOPLE) {
      const options = shuffled(candidates.filter(c => c.a === person.id && initialTypes.includes(c.type)), rng);
      add(options[0]);
    }
    // Add cross-references, making the deductions shared across cards.
    for (const person of PEOPLE) {
      const relational = shuffled(candidates.filter(c => c.a === person.id && c.b), rng);
      add(relational[0]);
    }
    // Greedy set-cover: select clues that distinguish the greatest number of still-possible scenes.
    const extras = shuffled(candidates.filter(c => c.type !== 'row' && c.type !== 'col'), rng);
    for (let step = 0; step < 22; step++) {
      const alternatives = enumerateSolutions(selected, 120);
      if (alternatives.length <= 1) break;
      let best = null, bestScore = -Infinity;
      for (const clue of extras) {
        if (seen.has(key(clue))) continue;
        const amount = selected.filter(c => c.a === clue.a).length;
        if (amount >= 4) continue;
        let ruledOut = 0;
        for (const arrangement of alternatives) if (!clueMatches(clue, arrangement)) ruledOut++;
        const score = ruledOut - (clue.type === 'room' ? 3 : 0) - amount * 1.1 + rng() * 1.2;
        if (ruledOut && score > bestScore) { best = clue; bestScore = score; }
      }
      if (!best) break;
      add(best);
    }
    if (countSolutions(selected, 2) !== 1) {
      for (const person of shuffled(PEOPLE, rng)) {
        if (countSolutions(selected, 2) === 1) break;
        add(candidates.find(c => c.a === person.id && c.type === 'row'));
        if (countSolutions(selected, 2) === 1) break;
        add(candidates.find(c => c.a === person.id && c.type === 'col'));
      }
    }
    if (countSolutions(selected, 2) !== 1) throw new Error('Enigma non univoco.');
    const clues = selected.map((c, i) => ({ ...c, id: `I${i+1}`, text: clueText(c, rooms) }));
    const publicPuzzle = {
      id: `CASE-${Math.abs(Number(seed)) % 1000000}`,
      title: premise.title,
      description: premise.description,
      rooms: rooms.slice(),
      size: SIZE,
      characters: PEOPLE.map(p => ({ ...p, clues: clues.filter(c => c.a === p.id).map(c => c.text) })),
      clueCount: clues.length
    };
    return { ...publicPuzzle, solution: { ...solution }, killer };
  }
  function publicView(puzzle) {
    const { solution, killer, ...safe } = puzzle;
    return safe;
  }
  function validateSolution(puzzle, board, accused) {
    if (!board || typeof board !== 'object') return false;
    if (!PEOPLE.every(p => Number.isInteger(board[p.id]) && board[p.id] === puzzle.solution[p.id])) return false;
    return accused === puzzle.killer;
  }
  return { SIZE, PEOPLE, roomAt, rowAt, colAt, generatePuzzle, publicView, validateSolution, countSolutions, clueMatches };
});
