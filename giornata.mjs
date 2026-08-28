// giornata.mjs — ORCHESTRATORE COMPLETO MULTI-SPORT
// Esegue tutto il pipeline in sequenza per TUTTI gli sport:
//   1. Scarica dati storici + quote (calcio, basket, tennis)
//   2. Calcola probabilita (modelli sport-specifici)
//   3. Confronta con quote bookmaker
//   4. Trova scommesse con valore
//   5. Componi la schedina (singola/doppia/tripla, multi-sport)
//   6. Calcola la puntata (Kelly Criterion)
//   7. Controlla che sia sicura
//   8. Salva tutto

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';

const PASSI = [
  { nome: 'Scarico dati storici (calcio + basket + tennis)', file: 'scarica.mjs' },
  { nome: 'Scarico quote live (The Odds API)', file: 'quotazione.mjs' },
  { nome: 'Analizzo partite (modelli multi-sport)', file: 'analisi.mjs' },
  { nome: 'Cerco valore (multi-sport)', file: 'ricerca.mjs' },
  { nome: 'Compongo schedina (multi-sport)', file: 'componi.mjs' },
  { nome: 'Controllo sicurezza', file: 'controlla.mjs' },
];

console.log('\n' + '#'.repeat(70));
console.log('  SISTEMA SCHEDINA MULTI-SPORT — ' + new Date().toISOString().slice(0, 16));
console.log('  Sport: Calcio + Basket (WNBA/NBA) + Tennis');
console.log('#'.repeat(70));

for (const passo of PASSI) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${passo.nome}...`);
  console.log('='.repeat(60));

  const r = spawnSync(process.execPath, [passo.file], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });

  if (r.stdout) console.log(r.stdout.trimEnd());
  if (r.stderr) console.error(r.stderr.trimEnd());

  if (r.status !== 0) {
    console.log(`\nERRORE nel passo "${passo.nome}". Mi fermo.`);
    process.exit(1);
  }
}

// Risultato finale
const file = path.join(DATI, 'giocata.json');
if (fs.existsSync(file)) {
  const giocata = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (giocata.niente) {
    console.log('\nNessuna schedina oggi.');
  } else {
    console.log('\n' + '#'.repeat(70));
    console.log('  SCHEDINA PRONTA!');
    console.log(`  Tipo: ${giocata.tipo}`);
    console.log(`  Sport: ${giocata.sport?.join(', ') || 'multi-sport'}`);
    console.log(`  Gambe: ${giocata.gambe?.length || 0}`);
    console.log(`  Quota: ${giocata.quota}`);
    console.log(`  Puntata: ${giocata.puntata} e`);
    console.log(`  Vincita: ${giocata.vincitaAttesa} e`);
    console.log('#'.repeat(70));
  }
}
