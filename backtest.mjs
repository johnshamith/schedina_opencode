// backtest.mjs — TESTA IL SISTEMA SU DATI STORICI
// Simula le scommesse del passato per vedere quanto avrebbe guadagnato
//
// Come funziona:
//   1. Prende i risultati passati da football-data.co.uk
//   2. Per ogni giornata, "prevede" i risultati col modello
//   3. Confronta con le quote del passato
//   4. Simula le scommesse
//   5. Calcola profitto/loss, win rate, ROI

import fs from 'node:fs';
import path from 'node:path';
import {
  DATI, leggiCsv, num, round, fmt, pct, log,
  poissonMatrix, probDaPoisson, calcolaELO, probDaELO,
  mediaPesata, togliMargine, kelly, mediana,
} from './lib.mjs';
import { LEGHE, STAGIONI, REGOLE } from './config.mjs';

// ── CARICA TUTTO LO STORICO ─────────────────────────────────
function caricaTutto() {
  const partite = [];
  for (const div of Object.keys(LEGHE)) {
    for (const st of STAGIONI) {
      const file = path.join(DATI, `${div}_${st}.csv`);
      const raw = leggiCsv(file);
      for (const r of raw) {
        if (!r.Date || !r.HomeTeam || !r AwayTeam) continue;
        const fthg = num(r.FTHG);
        const ftag = num(r.FTAG);
        if (fthg === null || ftag === null) continue;

        // Quote dal file CSV
        const b365h = num(r.B365H);
        const b365d = num(r.B365D);
        const b365a = num(r.B365A);

        partite.push({
          ...r,
          lega: div,
          stagione: st,
          data: r.Date ? new Date(Date.UTC(
            ...r.Date.split('/').reverse().map((v, i) => i === 0 ? +v + 2000 : +v - 1)
          )) : null,
          fthg, ftag,
          ftr: r.FTR,
          quote: [b365h, b365d, b365a].filter(x => x > 0),
        });
      }
    }
  }
  partite.sort((a, b) => (a.data || 0) - (b.data || 0));
  return partite;
}

// ── SIMULA GIORNATA ─────────────────────────────────────────
// Per una singola giornata, simula le scommesse
function simulaGiornata(partiteGiornata, elo) {
  const scommesse = [];

  for (const p of partiteGiornata) {
    if (p.quote.length < 3) continue;  // non ci sono quote

    // Probabilita dal mercato (quote)
    const dev = togliMargine(p.quote);
    if (dev.margine < 0 || dev.margine > 0.15) continue;

    // Probabilita nostra (ELO)
    const eloCasa = elo[p.HomeTeam] || 1500;
    const eloTrasf = elo[p.AwayTeam] || 1500;
    const probElo = probDaELO(eloCasa, eloTrasf);

    // Media pesata
    const probNostra = mediaPesata([
      { prob: probElo, peso: 0.4 },
      { prob: dev.prob, peso: 0.6 },  // il mercato e informativo
    ]);

    // Cerca valore su ogni esito
    const nomi = ['1', 'X', '2'];
    for (let i = 0; i < 3; i++) {
      const q = Math.max(...p.quote);  // quota migliore (simulazione)
      const pr = probNostra[i];
      const valore = kelly(pr, p.quote[i]);

      if (valore > 0) {
        scommesse.push({
          partita: `${p.HomeTeam} vs ${p.AwayTeam}`,
          esito: nomi[i],
          probNostra: pr,
          quota: p.quote[i],
          kelly: valore,
          risultato: i === 0 ? 'H' : i === 1 ? 'D' : 'A',
          vinta: p.ftr === (i === 0 ? 'H' : i === 1 ? 'D' : 'A'),
        });
      }
    }
  }

  return scommesse;
}

// ── BACKTEST COMPLETO ───────────────────────────────────────
function backtest() {
  log('Carico dati storici...');
  const partite = caricaTutto();
  log(`  ${partite.length} partite caricate`);

  log('Calcolo ELO...');
  const elo = calcolaELO(partite, 20);
  log(`  ${Object.keys(elo).length} squadre`);

  // Raggruppa per data
  const perData = {};
  for (const p of partite) {
    if (!p.data) continue;
    const key = p.data.toISOString().slice(0, 10);
    if (!perData[key]) perData[key] = [];
    perData[key].push(p);
  }

  const giorni = Object.keys(perData).sort();
  log(`  ${giorni.length} giorni con partite`);

  // Simula
  let bankroll = REGOLE.bankrollIniziale;
  let vinte = 0, perse = 0, totale = 0;
  let profitto = 0;
  const storico = [];

  for (const giorno of giorni) {
    const partiteGiornata = perData[giorno];

    // Calcola ELO fino a quel giorno (backtest fair)
    const eloFinoAQua = calcolaELO(
      partite.filter(p => p.data && p.data <= new Date(giorno + 'T23:59:59')),
      20
    );

    const scommesse = simulaGiornata(partiteGiornata, eloFinoAQua);

    // Filtra: solo quelle con valore e prob > 60%
    const buone = scommesse.filter(s =>
      s.probNostra >= REGOLE.probGambaMin &&
      s.quota >= REGOLE.quotaGambaMin &&
      s.quota <= REGOLE.quotaGambaMax
    );

    if (buone.length === 0) continue;

    // Prendi la migliore (kelly piu alto)
    const migliore = buone.sort((a, b) => b.kelly - a.kelly)[0];

    // Calcola puntata (quarter Kelly)
    const puntata = Math.max(
      REGOLE.puntataMin,
      Math.min(
        REGOLE.puntataMax,
        Math.round(migliore.kelly * 0.25 * bankroll)
      )
    );

    if (puntata > bankroll) continue;  // non abbastanza soldi

    // Simula
    totale++;
    if (migliore.vinta) {
      vinte++;
      const vincita = round(puntata * migliore.quota, 2);
      bankroll += vincita - puntata;
      profitto += vincita - puntata;
    } else {
      perse++;
      bankroll -= puntata;
      profitto -= puntata;
    }

    storico.push({
      data: giorno,
      partita: migliore.partita,
      esito: migliore.esito,
      prob: migliore.probNostra,
      quota: migliore.quota,
      puntata,
      vinta: migliore.vinta,
      bankroll: round(bankroll, 2),
    });
  }

  // Risultati
  console.log('\n' + '='.repeat(70));
  console.log('  RISULTATI BACKTEST');
  console.log('='.repeat(70));
  console.log(`  Periodo: ${giorni[0]} → ${giorni[giorni.length - 1]}`);
  console.log(`  Giorni testati: ${giorni.length}`);
  console.log(`  Giocate totali: ${totale}`);
  console.log(`  Vinte: ${vinte}  |  Perse: ${perse}`);
  console.log(`  Win rate: ${pct(vinte / totale)}`);
  console.log(`  Bankroll iniziale: ${fmt(REGOLE.bankrollIniziale)} e`);
  console.log(`  Bankroll finale: ${fmt(bankroll)} e`);
  console.log(`  Profitto: ${fmt(profitto)} e`);
  console.log(`  ROI: ${pct(profitto / (totale * REGOLE.puntataDefault))}`);
  console.log('='.repeat(70));

  // Salva
  fs.writeFileSync(path.join(DATI, 'backtest.json'), JSON.stringify({
    quando: new Date().toISOString(),
    periodo: { inizio: giorni[0], fine: giorni[giorni.length - 1] },
    giorni: giorni.length,
    totale,
    vinte,
    perse,
    winRate: vinte / totale,
    bankrollIniziale: REGOLE.bankrollIniziale,
    bankrollFinale: round(bankroll, 2),
    profitto: round(profitto, 2),
    storico,
  }, null, 1));

  log('Backtest salvato in dati/backtest.json');
}

// Esegui
backtest();
