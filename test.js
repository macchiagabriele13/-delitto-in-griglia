const assert = require('node:assert/strict');
const P = require('./public/puzzle.js');
let total = 0;
console.time('Puzzle test');
for (let seed = 1; seed <= 125; seed++) {
  const p = P.generatePuzzle(seed);
  assert.equal(new Set(Object.values(p.solution)).size,6);
  assert.equal(new Set(Object.values(p.solution).map(P.rowAt)).size,6);
  assert.equal(new Set(Object.values(p.solution).map(P.colAt)).size,6);
  assert.equal(P.validateSolution(p,p.solution,p.killer), true);
  assert.equal(P.validateSolution(p,p.solution,'Z'), false);
  assert.equal(p.characters.reduce((n,c)=>n+c.clues.length,0),p.clueCount);
  const suspects = P.PEOPLE.slice(0,5).filter(x=>P.roomAt(p.solution[x.id])===P.roomAt(p.solution.V));
  assert.equal(suspects.length,1);
  total++;
}
console.timeEnd('Puzzle test');
console.log(`${total} enigmi generati e verificati correttamente.`);
