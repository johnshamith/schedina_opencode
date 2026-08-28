// selezione.mjs — SCEGLIE LA SCHEDINA FINALE (MULTI-SPORT)
// Prende le scommesse con valore e le combina in una schedina ottimizzata
// Supporta: singola, doppia, tripla — puo mischiare sport diversi

import fs from 'node:fs';
import path from 'node:path';
import { DATI, round, fmt, pct, log } from './lib.mjs';
import { REGOLE } from './config.mjs';

// ── COMPOSIZIONE SCHEDINA ───────────────────────────────────
export function componiSchedina(scommesse, bankroll) {
  if (!scommesse || scommesse.length === 0) {
    log('Nessuna scommessa con valore disponibile');
    return null;
  }

  // 1. Raggruppa per giorno
  const perGiorno = {};
  for (const s of scommesse) {
    const giorno = s.inizio ? new Date(s.inizio).toISOString().slice(0, 10) : 'sconosciuto';
    if (!perGiorno[giorno]) perGiorno[giorno] = [];
    perGiorno[giorno].push(s);
  }

  // 2. Cerca il giorno con piu gambe sicure
  const giorni = Object.keys(perGiorno).sort();
  let giornoMigliore = null;
  let punteggioMax = 0;

  for (const g of giorni) {
    const gambe = perGiorno[g];
    if (gambe.length < 1) continue; // anche singola va bene

    const punteggio = gambe.reduce((a, s) => a + s.edge * s.kelly * s.probNostra, 0);
    if (punteggio > punteggioMax) {
      punteggioMax = punteggio;
      giornoMigliore = g;
    }
  }

  if (!giornoMigliore) {
    log('Nessun giorno con scommesse disponibili');
    return null;
  }

  const gambe = perGiorno[giornoMigliore];

  // 3. Ordina per valore (edge * kelly * prob)
  gambe.sort((a, b) => (b.edge * b.kelly * b.probNostra) - (a.edge * a.kelly * a.probNostra));

  // 4. Prova composizioni: tripla > doppia > singola
  let migliorSchedina = null;
  let migliorPunteggio = 0;

  // Prima prova tripla (se ci sono abbastanza gambe)
  if (gambe.length >= 3) {
    for (let i = 0; i < gambe.length - 2; i++) {
      for (let j = i + 1; j < gambe.length - 1; j++) {
        for (let k = j + 1; k < gambe.length; k++) {
          const candidate = [gambe[i], gambe[j], gambe[k]];
          const result = valutaCombinazione(candidate, 'TRIPLA');
          if (result && result.punteggio > migliorPunteggio) {
            migliorPunteggio = result.punteggio;
            migliorSchedina = result;
          }
        }
      }
    }
  }

  // Se non ha trovato tripla, prova doppia
  if (!migliorSchedina && gambe.length >= 2) {
    for (let i = 0; i < gambe.length - 1; i++) {
      for (let j = i + 1; j < gambe.length; j++) {
        const candidate = [gambe[i], gambe[j]];
        const result = valutaCombinazione(candidate, 'DOPPIA');
        if (result && result.punteggio > migliorPunteggio) {
          migliorPunteggio = result.punteggio;
          migliorSchedina = result;
        }
      }
    }
  }

  // Fallback: singola migliore
  if (!migliorSchedina && gambe.length >= 1) {
    const best = gambe[0];
    const result = valutaCombinazione([best], 'SINGOLA');
    if (result) {
      migliorSchedina = result;
    }
  }

  if (!migliorSchedina) {
    log('Non riesco a comporre la schedina');
    return null;
  }

  // 5. Calcola puntata con Kelly
  const kellyMin = Math.min(...migliorSchedina.gambe.map(g => g.kelly || 0.05));
  const fraction = kellyMin * REGOLE.kellyFrazione;
  const puntata = Math.max(
    REGOLE.puntataMin,
    Math.min(
      REGOLE.puntataMax,
      Math.round(fraction * bankroll)
    )
  );

  migliorSchedina.puntata = puntata;
  migliorSchedina.vincitaAttesa = round(puntata * migliorSchedina.quota, 2);
  migliorSchedina.giorno = giornoMigliore;

  return migliorSchedina;
}

// ── VALUTA COMBINAZIONE ─────────────────────────────────────
function valutaCombinazione(candidate, tipo) {
  // Quota totale
  const quota = round(candidate.reduce((a, g) => a * g.quotaBookmaker, 1), 2);
  if (quota < REGOLE.quotaTotaleMin || quota > REGOLE.quotaTotaleMax) return null;

  // Probabilita totale
  const prob = candidate.reduce((a, g) => a * g.probNostra, 1);

  // Kelly della schedina
  const kellyMin = Math.min(...candidate.map(g => g.kelly));

  // Punteggio complessivo
  const punteggio = candidate.reduce((a, g) => a + g.edge * g.kelly, 0);

  // Costo della schedina
  const costo = 1 - prob * quota;

  if (costo > REGOLE.costoMassimo) return null;

  // Non mischiare troppi sport diversi (max 2 sport nella stessa schedina)
  const sportDiversi = new Set(candidate.map(g => g.sport));
  if (sportDiversi.size > 2) return null;

  return {
    tipo,
    gambe: candidate,
    quota,
    prob,
    kelly: kellyMin,
    costo,
    punteggio,
    nSport: sportDiversi.size,
    sport: [...sportDiversi],
  };
}

// ── STAMPA SCHEDINA ─────────────────────────────────────────
export function stampaSchedina(schedina) {
  if (!schedina) {
    console.log('\nNessuna schedina da giocare oggi.');
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`SCHEDINA ${schedina.tipo} — ${schedina.giorno || '?'}`);
  console.log(`Sport: ${schedina.sport?.join(', ') || 'multi-sport'}`);
  console.log('='.repeat(70));

  for (let i = 0; i < schedina.gambe.length; i++) {
    const g = schedina.gambe[i];
    console.log(`\n  ${i + 1}. [${g.sport}] ${g.partita}`);
    console.log(`     Esito: ${g.esito}  (${g.spiega})`);
    console.log(`     Quota: ${fmt(g.quotaBookmaker)}  |  Prob: ${pct(g.probNostra)}  |  Edge: +${(g.edge * 100).toFixed(1)}%`);
    console.log(`     Fonte: ${g.nSiti} siti  |  Campionato: ${g.campionato}`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`  Quota totale: ${fmt(schedina.quota)}`);
  console.log(`  Probabilita: ${pct(schedina.prob)}`);
  console.log(`  Costo: ${(schedina.costo * 100).toFixed(1)}%`);
  console.log(`  Kelly: ${(schedina.kelly * 100).toFixed(1)}%`);
  console.log(`  Puntata: ${fmt(schedina.puntata)} e`);
  console.log(`  Vincita: ${fmt(schedina.vincitaAttesa)} e`);
  console.log(`  Profitto: ${fmt(schedina.vincitaAttesa - schedina.puntata)} e`);
  console.log('='.repeat(70));
}

// ── SALVA SCHEDINA ──────────────────────────────────────────
export function salvaSchedina(schedina) {
  if (!schedina) {
    fs.writeFileSync(path.join(DATI, 'giocata.json'), JSON.stringify({
      quando: new Date().toISOString(), niente: true,
    }, null, 1));
    return;
  }

  fs.writeFileSync(path.join(DATI, 'giocata.json'), JSON.stringify({
    quando: new Date().toISOString(),
    giorno: schedina.giorno,
    tipo: schedina.tipo,
    sport: schedina.sport,
    quota: schedina.quota,
    prob: schedina.prob,
    costo: schedina.costo,
    puntata: schedina.puntata,
    vincitaAttesa: schedina.vincitaAttesa,
    gambe: schedina.gambe.map(g => ({
      partita: g.partita,
      sport: g.sport,
      esito: g.esito,
      spiega: g.spiega,
      quota: g.quotaBookmaker,
      prob: g.probNostra,
      edge: g.edge,
      kelly: g.kelly,
      campionato: g.campionato,
      nSiti: g.nSiti,
      inizio: g.inizio,
    })),
  }, null, 1));
}
