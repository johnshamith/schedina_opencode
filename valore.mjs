// valore.mjs — TROVA SCOMMESSE CON VALORE (MULTI-SPORT)
// Confronta le probabilita nostre con le quote del bookmaker
// Supporta: calcio (1X2, OU, BTTS), basket (moneyline, OU), tennis (moneyline, OU)

import fs from 'node:fs';
import path from 'node:path';
import { DATI, round, fmt, pct, calcolaValore, quotaGiusta, log } from './lib.mjs';
import { REGOLE, SPORT_CONFIG } from './config.mjs';

// ── TROVA VALORE CALCIO ─────────────────────────────────────
function trovaValoreCalcio(p) {
  const scommesse = [];
  const prob = p.probNostra.h2h;
  const quote = p.migliorQuota;
  const nomi = p.nomi;

  if (!prob || !quote || prob.length !== 3) return scommesse;

  // 1X2
  for (let i = 0; i < 3; i++) {
    const q = quote[i];
    const pr = prob[i];
    if (!q || !pr || q <= 1 || pr <= 0) continue;

    const valore = calcolaValore(pr, q);
    if (valore.kelly <= 0) continue;

    scommesse.push({
      partita: `${p.casa} vs ${p.trasf}`,
      sport: 'calcio',
      campionato: p.campionato,
      esito: nomi[i],
      spiega: `vince ${nomi[i] === 'Draw' ? 'il pareggio' : nomi[i] === p.casa ? p.casa : p.trasf}`,
      probNostra: pr,
      quotaBookmaker: q,
      quotaFair: quotaGiusta(pr),
      edge: valore.edge,
      kelly: valore.kelly,
      ev: valore.ev,
      nSiti: p.nSiti,
      inizio: p.inizio,
    });
  }

  // Over 2.5
  if (p.probNostra.over25 && p.migliorQuotaOver) {
    const q = p.migliorQuotaOver;
    const pr = p.probNostra.over25;
    if (q > 1 && pr > 0) {
      const valore = calcolaValore(pr, q);
      if (valore.kelly > 0) {
        scommesse.push({
          partita: `${p.casa} vs ${p.trasf}`,
          sport: 'calcio',
          campionato: p.campionato,
          esito: 'Over 2.5',
          spiega: 'almeno 3 gol',
          probNostra: pr,
          quotaBookmaker: q,
          quotaFair: quotaGiusta(pr),
          edge: valore.edge,
          kelly: valore.kelly,
          ev: valore.ev,
          nSiti: p.nSiti,
          inizio: p.inizio,
        });
      }
    }
  }

  return scommesse;
}

// ── TROVA VALORE BASKET ─────────────────────────────────────
function trovaValoreBasket(p) {
  const scommesse = [];
  const prob = p.probNostra.moneyline;
  const nomi = p.nomi || [p.casa, p.trasf];

  if (!prob || prob.length < 2) return scommesse;

  // Moneyline (solo se c'e民la gamba 1 o 2, niente pareggio basket)
  const quote = p.migliorQuota;
  if (quote && quote.length >= 2) {
    for (let i = 0; i < 2; i++) {
      const q = quote[i];
      const pr = prob[i];
      if (!q || !pr || q <= 1 || pr <= 0) continue;

      const valore = calcolaValore(pr, q);
      if (valore.kelly <= 0) continue;

      scommesse.push({
        partita: `${p.casa} vs ${p.trasf}`,
        sport: 'basket',
        campionato: p.campionato,
        esito: nomi[i],
        spiega: `vince ${nomi[i]}`,
        probNostra: pr,
        quotaBookmaker: q,
        quotaFair: quotaGiusta(pr),
        edge: valore.edge,
        kelly: valore.kelly,
        ev: valore.ev,
        nSiti: p.nSiti,
        inizio: p.inizio,
      });
    }
  }

  // Over/Under
  if (p.probNostra.over && p.migliorQuotaOver) {
    const qOver = p.migliorQuotaOver;
    const qUnder = p.migliorQuotaUnder;
    const prOver = p.probNostra.over;
    const prUnder = p.probNostra.under;

    if (qOver > 1 && prOver > 0) {
      const v = calcolaValore(prOver, qOver);
      if (v.kelly > 0) {
        scommesse.push({
          partita: `${p.casa} vs ${p.trasf}`,
          sport: 'basket',
          campionato: p.campionato,
          esito: `Over ${p.linea || '?'}`,
          spiega: `punti totali sopra ${p.linea || '?'}`,
          probNostra: prOver,
          quotaBookmaker: qOver,
          quotaFair: quotaGiusta(prOver),
          edge: v.edge, kelly: v.kelly, ev: v.ev,
          nSiti: p.nSiti,
          inizio: p.inizio,
        });
      }
    }

    if (qUnder > 1 && prUnder > 0) {
      const v = calcolaValore(prUnder, qUnder);
      if (v.kelly > 0) {
        scommesse.push({
          partita: `${p.casa} vs ${p.trasf}`,
          sport: 'basket',
          campionato: p.campionato,
          esito: `Under ${p.linea || '?'}`,
          spiega: `punti totali sotto ${p.linea || '?'}`,
          probNostra: prUnder,
          quotaBookmaker: qUnder,
          quotaFair: quotaGiusta(prUnder),
          edge: v.edge, kelly: v.kelly, ev: v.ev,
          nSiti: p.nSiti,
          inizio: p.inizio,
        });
      }
    }
  }

  return scommesse;
}

// ── TROVA VALORE TENNIS ─────────────────────────────────────
function trovaValoreTennis(p) {
  const scommesse = [];
  const prob = p.probNostra.moneyline;
  const nomi = p.nomi || [p.casa, p.trasf];

  if (!prob || prob.length < 2) return scommesse;

  // Moneyline
  const quote = p.migliorQuota;
  if (quote && quote.length >= 2) {
    for (let i = 0; i < 2; i++) {
      const q = quote[i];
      const pr = prob[i];
      if (!q || !pr || q <= 1 || pr <= 0) continue;

      const valore = calcolaValore(pr, q);
      if (valore.kelly <= 0) continue;

      scommesse.push({
        partita: `${p.casa} vs ${p.trasf}`,
        sport: 'tennis',
        campionato: p.campionato,
        esito: nomi[i],
        spiega: `vince ${nomi[i]}`,
        probNostra: pr,
        quotaBookmaker: q,
        quotaFair: quotaGiusta(pr),
        edge: valore.edge,
        kelly: valore.kelly,
        ev: valore.ev,
        nSiti: p.nSiti,
        inizio: p.inizio,
      });
    }
  }

  // Over/Under games
  if (p.probNostra.over && p.migliorQuotaOver) {
    const qOver = p.migliorQuotaOver;
    const qUnder = p.migliorQuotaUnder;
    const prOver = p.probNostra.over;
    const prUnder = p.probNostra.under;

    if (qOver > 1 && prOver > 0) {
      const v = calcolaValore(prOver, qOver);
      if (v.kelly > 0) {
        scommesse.push({
          partita: `${p.casa} vs ${p.trasf}`,
          sport: 'tennis',
          campionato: p.campionato,
          esito: 'Over games',
          spiega: 'piu di 22.5 game',
          probNostra: prOver,
          quotaBookmaker: qOver,
          quotaFair: quotaGiusta(prOver),
          edge: v.edge, kelly: v.kelly, ev: v.ev,
          nSiti: p.nSiti,
          inizio: p.inizio,
        });
      }
    }

    if (qUnder > 1 && prUnder > 0) {
      const v = calcolaValore(prUnder, qUnder);
      if (v.kelly > 0) {
        scommesse.push({
          partita: `${p.casa} vs ${p.trasf}`,
          sport: 'tennis',
          campionato: p.campionato,
          esito: 'Under games',
          spiega: 'meno di 22.5 game',
          probNostra: prUnder,
          quotaBookmaker: qUnder,
          quotaFair: quotaGiusta(prUnder),
          edge: v.edge, kelly: v.kelly, ev: v.ev,
          nSiti: p.nSiti,
          inizio: p.inizio,
        });
      }
    }
  }

  return scommesse;
}

// ── TROVA VALORE (MULTI-SPORT) ──────────────────────────────
export function trovaValore(partite) {
  const scommesse = [];

  for (const p of partite) {
    const sport = p.sport || 'calcio';

    if (sport === 'calcio') {
      scommesse.push(...trovaValoreCalcio(p));
    } else if (sport === 'basket') {
      scommesse.push(...trovaValoreBasket(p));
    } else if (sport === 'tennis') {
      scommesse.push(...trovaValoreTennis(p));
    }
  }

  // Ordina per edge (piu valore prima)
  scommesse.sort((a, b) => b.edge - a.edge);

  return scommesse;
}

// ── FILTRA PER QUALITA ──────────────────────────────────────
export function filtraQualita(scommesse) {
  return scommesse.filter(s => {
    if (s.probNostra < 0.45) return false;
    if (s.quotaBookmaker < 1.10) return false;
    if (s.quotaBookmaker > 8.00) return false;
    if (s.nSiti < 2) return false;
    if (s.edge <= 0) return false;
    return true;
  });
}

// ── STAMPA TABELLA VALORE ───────────────────────────────────
export function stampaValore(scommesse) {
  console.log('\n' + '='.repeat(95));
  console.log('SCOMMESSE CON VALORE (MULTI-SPORT)');
  console.log('='.repeat(95));
  console.log(
    'Sport'.padEnd(7) +
    'Partita'.padEnd(30) +
    'Esito'.padEnd(14) +
    'Prob %'.padStart(8) +
    'Quota'.padStart(7) +
    'Fair'.padStart(7) +
    'Edge'.padStart(8) +
    'Kelly'.padStart(8) +
    'Siti'.padStart(5)
  );
  console.log('-'.repeat(95));

  for (const s of scommesse.slice(0, 25)) {
    console.log(
      s.sport.slice(0, 6).padEnd(7) +
      s.partita.slice(0, 29).padEnd(30) +
      s.esito.slice(0, 13).padEnd(14) +
      (s.probNostra * 100).toFixed(1).padStart(7) + '%' +
      fmt(s.quotaBookmaker).padStart(7) +
      fmt(s.quotaFair).padStart(7) +
      (s.edge > 0 ? '+' : '') + (s.edge * 100).toFixed(1).padStart(7) + '%' +
      (s.kelly * 100).toFixed(1).padStart(7) + '%' +
      String(s.nSiti).padStart(5)
    );
  }
}

// ── MAIN ────────────────────────────────────────────────────
export function eseguiValore(partiteConQuote) {
  log('Cerco scommesse con valore (multi-sport)...');

  let scommesse = trovaValore(partiteConQuote);
  log(`  ${scommesse.length} scommesse con valore trovate`);

  scommesse = filtraQualita(scommesse);
  log(`  ${scommesse.length} dopo filtraggio qualita`);

  // Riepilogo per sport
  const perSport = {};
  for (const s of scommesse) {
    perSport[s.sport] = (perSport[s.sport] || 0) + 1;
  }
  for (const [sport, n] of Object.entries(perSport)) {
    log(`    ${sport}: ${n} scommesse`);
  }

  stampaValore(scommesse);

  fs.writeFileSync(path.join(DATI, 'valore.json'), JSON.stringify({
    quando: new Date().toISOString(),
    nScommesse: scommesse.length,
    perSport,
    scommesse,
  }, null, 1));

  return scommesse;
}
