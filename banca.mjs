// banca.mjs — GESTIONE CAPITALE (KELLY CRITERION)
// Calcola quanto puntare in base alla probabilita e al bankroll
//
// Regola: puntata = kelly_fraction * bankroll
// Kelly dice: f = (p*q - 1) / (q - 1)
// Noi usiamo quarter-Kelly (0.25) per essere conservativi

import fs from 'node:fs';
import path from 'node:path';
import { DATI, fmt, round, clamp, log } from './lib.mjs';
import { REGOLE, KELLY } from './config.mjs';

// ── CARICA BANKROLL ─────────────────────────────────────────
export function caricaBankroll() {
  const file = path.join(DATI, 'cassa.json');
  if (!fs.existsSync(file)) {
    return {
      euro: REGOLE.bankrollIniziale,
      iniziata: new Date().toISOString().slice(0, 10),
      storico: [],
    };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── SALVA BANKROLL ──────────────────────────────────────────
export function salvaBankroll(cassa) {
  fs.writeFileSync(path.join(DATI, 'cassa.json'), JSON.stringify(cassa, null, 1));
}

// ── CALCOLA PUNTATA KELLY ───────────────────────────────────
// Input: probabilita, quota, bankroll
// Output: puntata in euro
export function calcolaPuntata(prob, quota, bankroll) {
  // Kelly fraction
  const q = quota - 1;  // profitto
  const f = (prob * q - 1) / q;
  if (f <= 0) return 0;  // non c'e valore

  // Applica fraction (quarter Kelly)
  const fraction = f * KELLY.fraction;

  // Limita
  const maxPuntata = bankroll * KELLY.maxPuntataPct;
  const puntata = clamp(
    round(fraction * bankroll, 0),
    REGOLE.puntataMin,
    Math.min(REGOLE.puntataMax, maxPuntata)
  );

  return Math.max(REGOLE.puntataMin, puntata);
}

// ── CALCOLA PUNTATA SCHEDINA ────────────────────────────────
// Per una schedina multipla, usa la gamba con il valore piu basso
export function calcolaPuntataSchedina(gambe, bankroll) {
  if (!gambe || gambe.length === 0) return REGOLE.puntataDefault;

  // Trova la gamba con il kelly piu basso (collo di bottiglia)
  const kellyMin = Math.min(...gambe.map(g => g.kelly || 0));
  if (kellyMin <= 0) return REGOLE.puntataDefault;

  const fraction = kellyMin * KELLY.fraction;
  const puntata = round(fraction * bankroll, 0);

  return clamp(
    puntata,
    REGOLE.puntataMin,
    Math.min(REGOLE.puntataMax, bankroll * KELLY.maxPuntataPct)
  );
}

// ── REGISTRA PUNTATA ────────────────────────────────────────
export function registraPuntata(cassa, puntata, quota, esito, note = '') {
  const entry = {
    data: new Date().toISOString().slice(0, 10),
    prima: cassa.euro,
    puntata,
    quota,
    esito,
    dopo: esito === 'VINTA' ? cassa.euro + round(puntata * quota - puntata, 2) : cassa.euro - puntata,
    note,
  };

  cassa.storico.push(entry);
  cassa.euro = entry.dopo;

  // Salva
  salvaBankroll(cassa);

  return entry;
}

// ── RIASSUNTO BANKROLL ──────────────────────────────────────
export function stampaBankroll(cassa) {
  console.log('\n' + '='.repeat(50));
  console.log('BANKROLL');
  console.log('='.repeat(50));
  console.log(`  Attuale: ${fmt(cassa.euro)} e`);
  console.log(`  Puntata consigliata (10%): ${fmt(cassa.euro * 0.10)} e`);
  console.log(`  Puntata Kelly: ${fmt(calcolaPuntata(0.65, 1.50, cassa.euro))} e`);
  console.log(`\n  Ultime 5 giocate:`);
  const ultime = cassa.storico.slice(-5);
  for (const g of ultime) {
    const segno = g.esito === 'VINTA' ? '+' : '-';
    const profitto = g.esito === 'VINTA' ? round(g.puntata * g.quota - g.puntata, 2) : -g.puntata;
    console.log(`    ${g.data}  ${fmt(g.puntata)} e @ ${fmt(g.quota)}  ${g.esito}  ${segno}${fmt(Math.abs(profitto))} e`);
  }
}

// ── STATISTICHE ─────────────────────────────────────────────
export function statistiche(cassa) {
  const giocate = cassa.storico.filter(g => g.esito === 'VINTA' || g.esito === 'PERDUTA');
  const vinte = giocate.filter(g => g.esito === 'VINTA').length;
  const perse = giocate.filter(g => g.esito === 'PERDUTA').length;
  const totale = giocate.length;

  if (totale === 0) return { vinte: 0, perse: 0, totale: 0, winRate: 0, profitto: 0, roi: 0 };

  const profittoNetto = cassa.euro - cassa.storico[0]?.prima || cassa.euro;
  const puntateTotali = giocate.reduce((a, g) => a + g.puntata, 0);

  return {
    vinte,
    perse,
    totale,
    winRate: vinte / totale,
    profitto: round(profittoNetto, 2),
    roi: round(profittoNetto / puntateTotali * 100, 1),
  };
}
