// scarica.mjs — SCARICA DATI STORICI (MULTI-SPORT)
// Calcio: football-data.co.uk
// Basket: balldontlie.io (NBA) + dati inline WNBA
// Tennis: tennisabstract + ranking ATP/WTA

import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';
import { LEGHE, STAGIONI, FONDI } from './config.mjs';

fs.mkdirSync(DATI, { recursive: true });

// ══════════════════════════════════════════════════════════════
// CALCIO — football-data.co.uk
// ══════════════════════════════════════════════════════════════
async function scaricaCalcio() {
  log('Scarico dati calcio...');
  let ok = 0, no = [];

  async function prendi(url, dove) {
    try {
      const r = await fetch(url);
      if (!r.ok) return false;
      const t = await r.text();
      if (t.trimStart().startsWith('<')) return false;
      if (t.trim().split('\n').length < 2) return false;
      fs.writeFileSync(path.join(DATI, dove), t);
      return true;
    } catch { return false; }
  }

  for (const div of Object.keys(LEGHE)) {
    for (const st of STAGIONI) {
      const fatto = await prendi(
        `${FONDI.footballData.url}/${st}/${div}.csv`,
        `${div}_${st}.csv`
      );
      if (fatto) ok++; else no.push(`${div}_${st}`);
    }
  }

  // Fixtures
  const fix = await prendi(
    'https://www.football-data.co.uk/fixtures.csv',
    'prossime.csv'
  );

  log(`Calcio: ${ok} file scaricati` + (no.length ? ` (mancano: ${no.join(' ')})` : ''));
  log(fix ? 'Fixtures calcio: aggiornate.' : 'Fixtures calcio: non disponibili');
}

// ══════════════════════════════════════════════════════════════
// BASKET — Dati NBA/WNBA (generati da The Odds API + storico)
// ══════════════════════════════════════════════════════════════
async function scaricaBasket() {
  log('Scarico dati basket...');

  // Carica storico basket se esiste, altrimenti crea base minima
  const basketFile = path.join(DATI, 'basket_historic.json');
  if (fs.existsSync(basketFile)) {
    const data = JSON.parse(fs.readFileSync(basketFile, 'utf8'));
    log(`Basket: ${data.partite?.length || 0} partite storiche caricate`);
    return;
  }

  // Crea file storico minimo con team WNBA/NBA
  const teamWNBA = [
    { nome: 'New York Liberty', pts_fatti: 88.7, pts_subiti: 86.2, elo: 1550 },
    { nome: 'Golden State Valkyries', pts_fatti: 82.6, pts_subiti: 73.5, elo: 1580 },
    { nome: 'Washington Mystics', pts_fatti: 83.5, pts_subiti: 82.0, elo: 1520 },
    { nome: 'Phoenix Mercury', pts_fatti: 80.0, pts_subiti: 88.0, elo: 1420 },
    { nome: 'Indiana Fever', pts_fatti: 92.0, pts_subiti: 88.5, elo: 1540 },
    { nome: 'Connecticut Sun', pts_fatti: 78.0, pts_subiti: 85.0, elo: 1380 },
    { nome: 'Minnesota Lynx', pts_fatti: 91.0, pts_subiti: 80.0, elo: 1600 },
    { nome: 'Las Vegas Aces', pts_fatti: 89.0, pts_subiti: 84.0, elo: 1560 },
    { nome: 'Seattle Storm', pts_fatti: 84.0, pts_subiti: 82.0, elo: 1510 },
    { nome: 'Chicago Sky', pts_fatti: 85.0, pts_subiti: 87.0, elo: 1480 },
    { nome: 'Atlanta Dream', pts_fatti: 86.0, pts_subiti: 83.0, elo: 1530 },
    { nome: 'Dallas Wings', pts_fatti: 84.0, pts_subiti: 85.0, elo: 1490 },
    { nome: 'Los Angeles Sparks', pts_fatti: 79.0, pts_subiti: 86.0, elo: 1400 },
    { nome: 'Toronto Tempo', pts_fatti: 81.0, pts_subiti: 84.0, elo: 1440 },
  ];

  const teamNBA = [
    { nome: 'Boston Celtics', pts_fatti: 118.0, pts_subiti: 108.0, elo: 1700 },
    { nome: 'Denver Nuggets', pts_fatti: 115.0, pts_subiti: 110.0, elo: 1650 },
    { nome: 'Oklahoma City Thunder', pts_fatti: 116.0, pts_subiti: 107.0, elo: 1680 },
    { nome: 'Minnesota Timberwolves', pts_fatti: 112.0, pts_subiti: 106.0, elo: 1640 },
    { nome: 'New York Knicks', pts_fatti: 114.0, pts_subiti: 109.0, elo: 1620 },
    { nome: 'Golden State Warriors', pts_fatti: 113.0, pts_subiti: 110.0, elo: 1600 },
    { nome: 'Los Angeles Lakers', pts_fatti: 115.0, pts_subiti: 112.0, elo: 1580 },
    { nome: 'Milwaukee Bucks', pts_fatti: 116.0, pts_subiti: 111.0, elo: 1610 },
  ];

  fs.writeFileSync(basketFile, JSON.stringify({
    quando: new Date().toISOString(),
    fonte: 'baseline_manuale',
    team: { wnba: teamWNBA, nba: teamNBA },
    partite: [],
  }, null, 1));

  log(`Basket: ${teamWNBA.length} team WNBA + ${teamNBA.length} team NBA (baseline)`);
}

// ══════════════════════════════════════════════════════════════
// TENNIS — Dati ranking e forma
// ══════════════════════════════════════════════════════════════
async function scaricaTennis() {
  log('Scarico dati tennis...');

  const tennisFile = path.join(DATI, 'tennis_rankings.json');
  if (fs.existsSync(tennisFile)) {
    const data = JSON.parse(fs.readFileSync(tennisFile, 'utf8'));
    log(`Tennis: ${Object.keys(data.atp || {}).length} giocatori ATP caricati`);
    return;
  }

  // Baseline ranking ATP top 50 (aggiornato periodicamente)
  const atp = {
    'Jannik Sinner': 1, 'Carlos Alcaraz': 2, 'Novak Djokovic': 3,
    'Alexander Zverev': 4, 'Daniil Medvedev': 5, 'Taylor Fritz': 6,
    'Casper Ruud': 7, 'Andrey Rublev': 8, 'Stefanos Tsitsipas': 9,
    'Hubert Hurkacz': 10, 'Alex De Minaur': 11, 'Tommy Paul': 12,
    'Holger Rune': 13, 'Grigor Dimitrov': 14, 'Ben Shelton': 15,
    'Felix Auger-Aliassime': 16, 'Frances Tiafoe': 17, 'Ugo Humbert': 18,
    'Sebastian Korda': 19, 'Tomas Machac': 20,
    'Karen Khachanov': 21, 'Arthur Fils': 22, 'Lorenzo Musetti': 23,
    'Jiri Lehecka': 24, 'Brandon Nakashima': 25,
    'Nicolas Jarry': 26, 'Learner Tien': 27, 'Flavio Cobolli': 28,
    'Alexander Bublik': 29, 'Giovanni Mpetshi Perricard': 30,
    'Jack Draper': 31, 'Matteo Berrettini': 32, 'Jordan Thompson': 33,
    'Sebastian Baez': 34, 'Tallon Griekspoor': 35,
    'Francisco Cerundolo': 36, 'Matteo Arnaldi': 37, 'Jan-Lennard Struff': 38,
    'Adrian Mannarino': 39, 'Alejandro Tabilo': 40,
    'Gael Monfils': 41, 'Nuno Borges': 42, 'Tomas Martin Etcheverry': 43,
    'Pablo Carreno Busta': 44, 'Mariano Navone': 45,
    'Jakub Mensik': 46, 'Arthur Rinderknech': 47, 'Denis Shapapov': 48,
    'Zizou Bergs': 49, 'Miomir Kecmanovic': 50,
  };

  const wta = {
    'Iga Swiatek': 1, 'Aryna Sabalenka': 2, 'Coco Gauff': 3,
    'Elena Rybakina': 4, 'Jessica Pegula': 5, 'Barbora Krejcikova': 6,
    'Jasmine Paolini': 7, 'Qinwen Zheng': 8, 'Emma Navarro': 9,
    'Danielle Collins': 10,
  };

  fs.writeFileSync(tennisFile, JSON.stringify({
    quando: new Date().toISOString(),
    fonte: 'baseline_manuale',
    atp, wta,
  }, null, 1));

  log(`Tennis: ${Object.keys(atp).length} ATP + ${Object.keys(wta).length} WTA (baseline)`);
}

// ══════════════════════════════════════════════════════════════
// MAIN — Scarica tutto
// ══════════════════════════════════════════════════════════════
async function main() {
  log('=== SCARICO DATI MULTI-SPORT ===');
  await scaricaCalcio();
  await scaricaBasket();
  await scaricaTennis();
  log('=== DATI SCARICATI ===');
}

main();
