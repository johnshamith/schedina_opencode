// controlla.mjs — CONTROLLO DI SICUREZZA (MULTI-SPORT)
// Controlli automatici per ogni sport + notizie da verificare a mano

import fs from 'node:fs';
import path from 'node:path';
import { DATI, fmt, pct, log } from './lib.mjs';
import { REGOLE } from './config.mjs';

const file = path.join(DATI, 'giocata.json');
if (!fs.existsSync(file)) {
  log('Nessuna giocata da controllare');
  process.exit(0);
}

const g = JSON.parse(fs.readFileSync(file, 'utf8'));
if (g.niente) {
  log('Nessuna schedina oggi: niente da controllare.');
  process.exit(0);
}

const esiti = [];
const ok = (n, d) => esiti.push(['ok', n, d]);
const no = (n, d) => esiti.push(['NO', n, d]);
const chiedi = (n, d) => esiti.push(['?', n, d]);

// ── CONTROLLI GENERALI ──────────────────────────────────────

// 1. Quanto costa la schedina
const costo = g.costo || (1 - g.prob * g.quota);
const seg = costo >= 0 ? '-' : '+';
if (costo <= REGOLE.costoMassimo)
  ok("Costo schedina", `${seg}${Math.abs(costo * 100).toFixed(1)}% (limite -${(REGOLE.costoMassimo * 100).toFixed(0)}%)`);
else
  no("Costo schedina", `${seg}${Math.abs(costo * 100).toFixed(1)}% — TROPPO CARO`);

// 2. Tutte le gambe lo stesso giorno
if (g.gambe) {
  const giorni = [...new Set(g.gambe.map(x => x.inizio ? new Date(x.inizio).toISOString().slice(0, 10) : null))];
  if (giorni.length <= 1)
    ok('Tutte lo stesso giorno', giorni[0] || 'ok');
  else
    no('Tutte lo stesso giorno', `su ${giorni.length} giorni diversi`);
}

// 3. Niente coppe nazionali (solo calcio)
if (g.gambe) {
  const coppe = g.gambe.filter(x =>
    x.sport === 'calcio' && /cup|coppa|pokal|copa del rey|dfb/i.test(x.campionato || '')
  );
  if (!coppe.length)
    ok('Niente coppe calcio', '');
  else
    no('Niente coppe calcio', coppe.map(x => x.campionato).join(', '));
}

// 4. Abbastanza siti quotano
if (g.gambe) {
  const pochi = g.gambe.filter(x => (x.nSiti || 0) < 3);
  if (!pochi.length)
    ok('Prezzo affidabile', 'tutte quotate da 3+ siti');
  else
    chiedi('Prezzo affidabile', `${pochi.length} partite con pochi siti`);
}

// 5. Quota nel range
if (g.gambe) {
  const fuori = g.gambe.filter(x =>
    x.quota < REGOLE.quotaGambaMin || x.quota > REGOLE.quotaGambaMax
  );
  if (!fuori.length)
    ok('Quote nel range', `${fmt(REGOLE.quotaGambaMin)}-${fmt(REGOLE.quotaGambaMax)}`);
  else
    chiedi('Quote fuori range', fuori.map(x => `${x.partita}: ${fmt(x.quota)}`).join(', '));
}

// 6. Probabilita minima
if (g.gambe) {
  const deboli = g.gambe.filter(x => (x.prob || 0) < 0.55);
  if (!deboli.length)
    ok('Probabilita alta', 'tutte > 55%');
  else
    chiedi('Probabilita bassa', deboli.map(x => `${x.partita}: ${pct(x.prob)}`).join(', '));
}

// 7. Puntata non eccessiva
if (g.puntata && g.puntata > REGOLE.puntataMax)
  no('Puntata alta', `${g.puntata} e > massimo ${REGOLE.puntataMax} e`);
else if (g.puntata)
  ok('Puntata ok', `${g.puntata} e`);

// 8. Non troppi sport diversi (max 2)
if (g.gambe) {
  const sport = [...new Set(g.gambe.map(x => x.sport))];
  if (sport.length <= 2)
    ok('Sport misti', `${sport.join(', ')}`);
  else
    no('Troppi sport', `${sport.length} sport diversi nella stessa schedina`);
}

// 9. Controlli specifici per sport
if (g.gambe) {
  for (const gamb of g.gambe) {
    // BASKET: no spread se prob < 55%
    if (gamb.sport === 'basket' && gamb.esito?.includes('Spread') && gamb.prob < 0.55) {
      chiedi(`Basket spread`, `${gamb.partita}: prob ${pct(gamb.prob)} — rischioso`);
    }

    // TENNIS: favorito troppo schiacciante (quota < 1.15 = niente valore)
    if (gamb.sport === 'tennis' && gamb.quota < 1.15) {
      chiedi(`Tennis quota bassa`, `${gamb.partita}: quota ${fmt(gamb.quota)} — niente valore`);
    }

    // CALCIO: BTTS con prob < 50%
    if (gamb.sport === 'calcio' && gamb.esito === 'BTTS Yes' && gamb.prob < 0.50) {
      chiedi(`Calcio BTTS`, `${gamb.partita}: prob ${pct(gamb.prob)} — rischioso`);
    }
  }
}

// ── STAMPA RISULTATI ────────────────────────────────────────
console.log('\n' + '='.repeat(65));
console.log('  CONTROLLO DI SICUREZZA (MULTI-SPORT)');
console.log('='.repeat(65));

for (const [liv, nome, det] of esiti) {
  const icona = liv === 'ok' ? '[ok]  ' : liv === 'NO' ? '[NO]  ' : '[??]  ';
  console.log(`${icona}${nome.padEnd(28)}${det}`);
}

// ── NOTIZIE DA CONTROLLARE A MANO ───────────────────────────
if (g.gambe && g.gambe.length > 0) {
  console.log('\n' + '-'.repeat(65));
  console.log('NOTIZIE DA VERIFICARE A MANO:');
  console.log('-'.repeat(65));
  for (const x of g.gambe) {
    console.log(`  [ ] [${x.sport}] ${x.partita}  (${x.campionato || 'N/A'})`);

    if (x.sport === 'calcio') {
      console.log(`      Infortunati? Formazione? Turnover? Motivazione?`);
    } else if (x.sport === 'basket') {
      console.log(`      Giocatori assenti? Back-to-back? Riposo?`);
    } else if (x.sport === 'tennis') {
      console.log(`      Superficie? Forma recente? Infortuni?`);
    }
  }
}

// ── VERDETTO ────────────────────────────────────────────────
const rossi = esiti.filter(e => e[0] === 'NO').length;
const gialli = esiti.filter(e => e[0] === '?').length;

console.log('\n' + '='.repeat(65));
if (rossi) {
  console.log(`  ${rossi} PROBLEMI ROSSI → NON SI GIOCA!`);
  process.exitCode = 1;
} else if (gialli) {
  console.log(`  ${gialli} attenzioni, ma nessun blocco. Verifica le notizie.`);
} else {
  console.log('  TUTTO OK → PUOI GIOCARE!');
}
console.log('='.repeat(65));
