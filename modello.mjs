// modello.mjs — MOTORE PROBABILISTICO MULTI-SPORT
// Combina modelli diversi per ogni sport:
//   - Calcio: Poisson + ELO
//   - Basket: Media punti + ELO + Distribuzione normale
//   - Tennis: Ranking + Forma + ELO
//
// Ogni sport ha il suo modello, poi le quote bookmaker vengono aggiunte da valore.mjs

import fs from 'node:fs';
import path from 'node:path';
import {
  DATI, leggiCsv, num, round,
  poissonMatrix, probDaPoisson,
  calcolaELO, probDaELO,
  mediaPesata, stimaLambda, togliMargine, mediana,
  stimaPuntiBasket, probVittoriaBasket, probOverUnderBasket,
  probVittoriaTennis, probOverUnderTennis,
} from './lib.mjs';
import { LEGHE, STAGIONI, SPORT_CONFIG } from './config.mjs';

// ── NORMALIZZAZIONE NOMI SQUADRE ─────────────────────────────
const NOMI_MAP = {
  'inter milan': 'Inter', 'internazionale': 'Inter', 'inter': 'Inter',
  'ac milan': 'AC Milan', 'milan': 'AC Milan',
  'juventus': 'Juventus', 'juve': 'Juventus',
  'napoli': 'Napoli', 'ssc napoli': 'Napoli',
  'roma': 'AS Roma', 'as roma': 'AS Roma', 'as roma': 'AS Roma',
  'lazio': 'Lazio', 'ss lazio': 'Lazio',
  'atalanta': 'Atalanta BC', 'atalanta bc': 'Atalanta BC',
  'fiorentina': 'Fiorentina', 'acf fiorentina': 'Fiorentina',
  'torino': 'Torino', 'fc torino': 'Torino',
  'bologna': 'Bologna', 'fc bologna': 'Bologna',
  'genoa': 'Genoa', 'genoa cfc': 'Genoa',
  'sampdoria': 'Sampdoria', 'uc sampdoria': 'Sampdoria',
  'udinese': 'Udinese', 'udinese calcio': 'Udinese',
  'sassuolo': 'Sassuolo', 'us sassuolo': 'Sassuolo',
  'cagliari': 'Cagliari', 'cagliari calcio': 'Cagliari',
  'lecce': 'Lecce', 'us lecce': 'Lecce',
  'empoli': 'Empoli', 'empoli fc': 'Empoli',
  'verona': 'Hellas Verona', 'hellas verona': 'Hellas Verona',
  'monza': 'Monza', 'ac monza': 'Monza',
  'frosinone': 'Frosinone', 'frosinone calcio': 'Frosinone',
  'venezia': 'Venezia', 'venezia fc': 'Venezia',
  'parma': 'Parma', 'parma calcio': 'Parma',
  'como': 'Como', 'como 1907': 'Como',
  'barcelona': 'Barcelona', 'fc barcelona': 'Barcelona', 'barca': 'Barcelona',
  'real madrid': 'Real Madrid', 'real madrid cf': 'Real Madrid',
  'atletico madrid': 'Atlético Madrid', 'atlético madrid': 'Atlético Madrid',
  'sevilla': 'Sevilla', 'sevilla fc': 'Sevilla',
  'real sociedad': 'Real Sociedad',
  'villarreal': 'Villarreal', 'cf villarreal': 'Villarreal',
  'athletic bilbao': 'Athletic Bilbao', 'athletic club': 'Athletic Bilbao',
  'celta vigo': 'Celta Vigo', 'rc celta': 'Celta Vigo',
  'getafe': 'Getafe', 'getafe cf': 'Getafe',
  'osasuna': 'CA Osasuna', 'ca osasuna': 'CA Osasuna',
  'mallorca': 'RCD Mallorca', 'rcd mallorca': 'RCD Mallorca',
  'real betis': 'Real Betis', 'betis': 'Real Betis',
  'deportivo alaves': 'Alavés', 'alavés': 'Alavés', 'alaves': 'Alavés',
  'las palmas': 'Las Palmas', 'ud las palmas': 'Las Palmas',
  'espanyol': 'Espanyol', 'rcd espanyol': 'Espanyol',
  'valencia': 'Valencia CF', 'valencia cf': 'Valencia CF',
  'rayo vallecano': 'Rayo Vallecano',
  'cadiz': 'Cádiz', 'cádiz cf': 'Cádiz',
  'granada': 'Granada CF', 'granada cf': 'Granada CF',
  'almeria': 'UD Almería', 'ud almería': 'UD Almería',
  'manchester city': 'Manchester City', 'man city': 'Manchester City',
  'manchester united': 'Manchester United', 'man utd': 'Manchester United',
  'liverpool': 'Liverpool', 'liverpool fc': 'Liverpool',
  'arsenal': 'Arsenal', 'arsenal fc': 'Arsenal',
  'chelsea': 'Chelsea', 'chelsea fc': 'Chelsea',
  'tottenham': 'Tottenham Hotspur', 'tottenham hotspur': 'Tottenham Hotspur',
  'newcastle': 'Newcastle United', 'newcastle united': 'Newcastle United',
  'aston villa': 'Aston Villa',
  'west ham': 'West Ham United', 'west ham united': 'West Ham United',
  'brighton': 'Brighton', 'brighton & hove albion': 'Brighton',
  'wolves': 'Wolverhampton', 'wolverhampton': 'Wolverhampton',
  'crystal palace': 'Crystal Palace',
  'fulham': 'Fulham', 'fulham fc': 'Fulham',
  'brentford': 'Brentford', 'brentford fc': 'Brentford',
  'nottingham forest': 'Nottingham Forest', 'nott\'m forest': 'Nottingham Forest',
  'everton': 'Everton', 'everton fc': 'Everton',
  'bournemouth': 'Bournemouth', 'afc bournemouth': 'Bournemouth',
  'burnley': 'Burnley', 'burnley fc': 'Burnley',
  'sheffield united': 'Sheffield United',
  'luton town': 'Luton Town', 'luton': 'Luton Town',
  'ipswich town': 'Ipswich Town', 'ipswich': 'Ipswich Town',
  'bayern munich': 'Bayern Munich', 'bayern munchen': 'Bayern Munich', 'bayern': 'Bayern Munich',
  'borussia dortmund': 'Borussia Dortmund', 'dortmund': 'Borussia Dortmund',
  'bayer leverkusen': 'Bayer Leverkusen', 'leverkusen': 'Bayer Leverkusen',
  'rb leipzig': 'RB Leipzig', 'leipzig': 'RB Leipzig',
  'eintracht frankfurt': 'Eintracht Frankfurt', 'frankfurt': 'Eintracht Frankfurt',
  'vfb stuttgart': 'VfB Stuttgart', 'stuttgart': 'VfB Stuttgart',
  'vfl wolfsburg': 'Wolfsburg', 'wolfsburg': 'Wolfsburg',
  'borussia monchengladbach': 'Borussia M\'gladbach', 'gladbach': 'Borussia M\'gladbach',
  'werder bremen': 'Werder Bremen', 'bremen': 'Werder Bremen',
  'sc freiburg': 'SC Freiburg', 'freiburg': 'SC Freiburg',
  'augsburg': 'Augsburg', 'fc augsburg': 'Augsburg',
  'mainz 05': 'FSV Mainz 05', 'fsv mainz 05': 'FSV Mainz 05',
  'tsg hoffenheim': 'TSG Hoffenheim', 'hoffenheim': 'TSG Hoffenheim',
  'union berlin': 'Union Berlin',
  '1. fc köln': '1. FC Köln', 'köln': '1. FC Köln', 'fc köln': '1. FC Köln',
  'hamburger sv': 'Hamburger SV', 'hamburg': 'Hamburger SV',
  'fc schalke 04': 'FC Schalke 04', 'schalke': 'FC Schalke 04',
  'sc paderborn': 'SC Paderborn', 'paderborn': 'SC Paderborn',
  'elversberg': 'Elversberg', 'sv elversberg': 'Elversberg',
  'paris saint germain': 'Paris Saint Germain', 'psg': 'Paris Saint Germain',
  'marseille': 'Marseille', 'olympique de marseille': 'Marseille',
  'monaco': 'AS Monaco', 'as monaco': 'AS Monaco',
  'lyon': 'Lyon', 'olympique lyonnais': 'Lyon',
  'lille': 'Lille', 'losc lille': 'Lille',
  'nice': 'Nice', 'ogc nice': 'Nice',
  'rennes': 'Rennes', 'stade rennais': 'Rennes',
  'lens': 'RC Lens', 'rc lens': 'RC Lens',
  'strasbourg': 'Strasbourg', 'rc strasbourg': 'Strasbourg',
  'toulouse': 'Toulouse', 'toulouse fc': 'Toulouse',
  'brest': 'Brest', 'stade brestois': 'Brest',
  'nantes': 'Nantes', 'fc nantes': 'Nantes',
  'montpellier': 'Montpellier', 'montpellier hsc': 'Montpellier',
  'le havre': 'Le Havre', 'le havre ac': 'Le Havre',
  'metz': 'Metz', 'fc metz': 'Metz',
  'lorient': 'Lorient', 'fc lorient': 'Lorient',
  'auxerre': 'Auxerre', 'aj auxerre': 'Auxerre',
  'angers': 'Angers', 'angers sco': 'Angers',
  'saint-etienne': 'Saint-Étienne', 'saint-étienne': 'Saint-Étienne',
  'red star': 'Red Star',
  'estac': 'ESTAC Troyes', 'troyes': 'ESTAC Troyes',
  'paris fc': 'Paris FC',
  'le mans': 'Le Mans FC', 'le mans fc': 'Le Mans FC',
  'new york liberty': 'New York Liberty',
  'phoenix mercury': 'Phoenix Mercury',
  'washington mystics': 'Washington Mystics',
  'minnesota lynx': 'Minnesota Lynx',
  'las vegas aces': 'Las Vegas Aces',
  'connecticut sun': 'Connecticut Sun',
  'indiana fever': 'Indiana Fever',
  'seattle storm': 'Seattle Storm',
  'atlanta dream': 'Atlanta Dream',
  'chicago sky': 'Chicago Sky',
  'dallas wings': 'Dallas Wings',
  'golden state valkyries': 'Golden State Valkyries',
  'portland fire': 'Portland Fire',
  'los angeles sparks': 'Los Angeles Sparks',
  'new york knicks': 'New York Knicks',
  'boston celtics': 'Boston Celtics',
  'los angeles lakers': 'Los Angeles Lakers',
  'golden state warriors': 'Golden State Warriors',
  'milwaukee bucks': 'Milwaukee Bucks',
  'philadelphia 76ers': 'Philadelphia 76ers',
  'denver nuggets': 'Denver Nuggets',
  'oklahoma city thunder': 'Oklahoma City Thunder',
  'phoenix suns': 'Phoenix Suns',
  'dallas mavericks': 'Dallas Mavericks',
  'miami heat': 'Miami Heat',
  'cleveland cavaliers': 'Cleveland Cavaliers',
  'new york knicks': 'New York Knicks',
  'atlanta hawks': 'Atlanta Hawks',
  'chicago bulls': 'Chicago Bulls',
  'toronto raptors': 'Toronto Raptors',
  'brooklyn nets': 'Brooklyn Nets',
  'charlotte hornets': 'Charlotte Hornets',
  'washington wizards': 'Washington Wizards',
  'detroit pistons': 'Detroit Pistons',
  'indiana pacers': 'Indiana Pacers',
  'memphis grizzlies': 'Memphis Grizzlies',
  'houston rockets': 'Houston Rockets',
  'sacramento kings': 'Sacramento Kings',
  'minnesota timberwolves': 'Minnesota Timberwolves',
  'utah jazz': 'Utah Jazz',
  'new orleans pelicans': 'New Orleans Pelicans',
  'san antonio spurs': 'San Antonio Spurs',
  'portland trail blazers': 'Portland Trail Blazers',
  'los angeles clippers': 'Los Angeles Clippers',
  'soka alicante': 'Sóka Alicante',
  'dubai basketball': 'Dubai Basketball',
  'real madrid basketball': 'Real Madrid',
  'fc barcelona basketball': 'FC Barcelona Bàsquet',
  'fenerbahce': 'Fenerbahçe', 'fenerbahce sk': 'Fenerbahçe',
  'olympiacos': 'Olympiacos',
  'panathinaikos': 'Panathinaikos',
  'anadolu efes': 'Anadolu Efes',
  'maccabi tel aviv': 'Maccabi Tel Aviv',
  'virtus bologna': 'Virtus Bologna', 'virtus segafredo bologna': 'Virtus Bologna',
  'ea7 emporio armani milano': 'Olimpia Milano', 'pallacanestro olimpia milano': 'Olimpia Milano',
  'kk partizan': 'Partizan', 'kk partizan nis': 'Partizan',
  'crvena zvezda': 'Crvena zvezda', 'kk crvena zvezda': 'Crvena zvezda',
  'žalgiris': 'Žalgiris', 'bc žalgiris': 'Žalgiris',
  'asvel lyon villeurbanne': 'ASVEL',
  'hapoel tel aviv': 'Hapoel Tel Aviv',
  'saski baskonia': 'Baskonia',
  'paris basketball': 'Paris Basketball',
  'real madrid': 'Real Madrid', 'real madrid baloncesto': 'Real Madrid',
  'fc barcelona': 'FC Barcelona',
  'bayern munich basketball': 'FC Bayern München',
  'fc bayern münchen basketball': 'FC Bayern München',
};

function normalizzaNome(nome) {
  if (!nome) return nome;
  const lower = nome.toLowerCase().trim();
  if (NOMI_MAP[lower]) return NOMI_MAP[lower];
  // Prova senza punteggiatura
  const clean = lower.replace(/[^a-z0-9 ]/g, '').trim();
  if (NOMI_MAP[clean]) return NOMI_MAP[clean];
  return nome;
}

// ── CARICA DATI STORICI ─────────────────────────────────────
export function caricaStorico() {
  const partite = [];
  for (const div of Object.keys(LEGHE)) {
    for (const st of STAGIONI) {
      const file = path.join(DATI, `${div}_${st}.csv`);
      const raw = leggiCsv(file);
      for (const r of raw) {
        partite.push({
          ...r,
          lega: div,
          stagione: st,
          data: r.Date ? new Date(Date.UTC(
            ...r.Date.split('/').reverse().map((v, i) => i === 0 ? +v + 2000 : +v - 1)
          )) : null,
        });
      }
    }
  }
  partite.sort((a, b) => (a.data || 0) - (b.data || 0));
  return partite;
}

// ── CARICA DATI BASKET ──────────────────────────────────────
export function caricaDatiBasket() {
  const file = path.join(DATI, 'basket_historic.json');
  if (!fs.existsSync(file)) return { team: { wnba: [], nba: [] } };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── CARICA DATI TENNIS ──────────────────────────────────────
export function caricaDatiTennis() {
  const file = path.join(DATI, 'tennis_rankings.json');
  if (!fs.existsSync(file)) return { atp: {}, wta: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── CALCOLO ELO DI TUTTE LE SQUADRE CALCIO ──────────────────
export function calcolaTuttiELO(partite) {
  return calcolaELO(partite, 20);
}

// ══════════════════════════════════════════════════════════════
// ANALISI CALCIO (Poisson + ELO)
// ══════════════════════════════════════════════════════════════
export function analizzaCalcio(dati) {
  const { casa, trasf, partiteCasa, partiteTrasf, eloCasa, eloTrasf } = dati;

  const lambdaCasa = stimaLambda(partiteCasa);
  const lambdaTrasf = stimaLambda(partiteTrasf);

  const matrix = poissonMatrix(
    lambdaCasa.lambdaCasa || 1.3,
    lambdaTrasf.lambdaTrasf || 1.0
  );
  const probPoisson = probDaPoisson(matrix);
  const probElo = probDaELO(eloCasa || 1500, eloTrasf || 1500);

  const probFinale = mediaPesata([
    { prob: probPoisson.h2h, peso: 0.40 },
    { prob: probElo, peso: 0.30 },
    { prob: [0.33, 0.33, 0.34], peso: 0.30 },
  ]);

  return {
    sport: 'calcio',
    prob: {
      h2h: probFinale,
      over25: probPoisson.over25,
      under25: probPoisson.under25,
      btts: probPoisson.btts,
    },
    lambda: {
      casa: lambdaCasa.lambdaCasa || 1.3,
      trasf: lambdaTrasf.lambdaTrasf || 1.0,
    },
    elo: { casa: eloCasa || 1500, trasf: eloTrasf || 1500 },
    matrix,
    detail: {
      poisson: probPoisson.h2h,
      elo: probElo,
    },
  };
}

// ══════════════════════════════════════════════════════════════
// ANALISI BASKET (Media punti + ELO + Gauss)
// ══════════════════════════════════════════════════════════════
export function analizzaBasket(dati) {
  const { casa, trasf, datiBasket } = dati;

  // Trova team nei dati storici
  const teamCasa = datiBasket.team?.wnba?.find(t => t.nome === casa)
                || datiBasket.team?.nba?.find(t => t.nome === casa);
  const teamTrasf = datiBasket.team?.wnba?.find(t => t.nome === trasf)
                 || datiBasket.team?.nba?.find(t => t.nome === trasf);

  // Punti attesi
  let puntiCasa, puntiTrasf;
  if (teamCasa && teamTrasf) {
    puntiCasa = (teamCasa.pts_fatti + teamTrasf.pts_subiti) / 2;
    puntiTrasf = (teamTrasf.pts_fatti + teamCasa.pts_subiti) / 2;
  } else {
    // Default NBA/WNBA
    puntiCasa = 85;
    puntiTrasf = 82;
  }

  // ELO basket
  const eloCasa = teamCasa?.elo || 1500;
  const eloTrasf = teamTrasf?.elo || 1500;

  // Probabilita vittoria (distribuzione normale)
  const [pCasa, pTrasf] = probVittoriaBasket(puntiCasa, puntiTrasf);

  // Over/Under (linea tipica 165 per WNBA, 220 per NBA)
  const lineaOU = puntiCasa > 100 ? 220 : 165;
  const probOU = probOverUnderBasket(puntiCasa, puntiTrasf, lineaOU);

  // Media pesata con ELO
  const probElo = probDaELO(eloCasa, eloTrasf);
  const probFinale = mediaPesata([
    { prob: [pCasa, pTrasf], peso: 0.60 },
    { prob: [probElo[0], probElo[2]], peso: 0.40 },
  ]);

  return {
    sport: 'basket',
    prob: {
      moneyline: [probFinale[0], probFinale[1]],
      over: probOU.over,
      under: probOU.under,
      totaleAtteso: probOU.totaleAtteso,
      lineaOU,
    },
    punti: { casa: round(puntiCasa, 1), trasf: round(puntiTrasf, 1) },
    elo: { casa: eloCasa, trasf: eloTrasf },
    detail: {
      normale: [pCasa, pTrasf],
      elo: [probElo[0], probElo[2]],
    },
  };
}

// ══════════════════════════════════════════════════════════════
// ANALISI TENNIS (Ranking + Forma)
// ══════════════════════════════════════════════════════════════
export function analizzaTennis(dati) {
  const { casa, trasf, datiTennis } = dati;

  // Trova ranking
  const rankCasa = datiTennis.atp?.[casa] || datiTennis.wta?.[casa] || 50;
  const rankTrasf = datiTennis.atp?.[trasf] || datiTennis.wta?.[trasf] || 50;

  // Forma (default 0.6 per top 20, 0.5 per altri)
  const formaCasa = rankCasa <= 20 ? 0.65 : rankCasa <= 50 ? 0.55 : 0.50;
  const formaTrasf = rankTrasf <= 20 ? 0.60 : rankTrasf <= 50 ? 0.52 : 0.48;

  // Probabilita vittoria
  const [pCasa, pTrasf] = probVittoriaTennis(rankCasa, rankTrasf, formaCasa, formaTrasf);

  // Over/Under games (media ~23 per match ATP)
  const mediaGames = 22 + Math.abs(rankCasa - rankTrasf) * 0.05;
  const probOU = probOverUnderTennis(mediaGames, 22.5);

  return {
    sport: 'tennis',
    prob: {
      moneyline: [pCasa, pTrasf],
      over: probOU.over,
      under: probOU.under,
      mediaGames: probOU.mediaAttesa,
    },
    ranking: { casa: rankCasa, trasf: rankTrasf },
    forma: { casa: formaCasa, trasf: formaTrasf },
    detail: {
      elo: [pCasa, pTrasf],
    },
  };
}

// ══════════════════════════════════════════════════════════════
// ANALISI COMPLETA DI UN GIORNO (MULTI-SPORT)
// ══════════════════════════════════════════════════════════════
export function analizzaGiornata(partiteInArrivo) {
  console.log('\nCarico dati storici...');
  const storico = caricaStorico();
  console.log(`  ${storico.length} partite calcio caricate`);

  const eloCalcio = calcolaTuttiELO(storico);
  console.log(`  ${Object.keys(eloCalcio).length} squadre calcio ELO`);

  const datiBasket = caricaDatiBasket();
  console.log(`  Basket: ${(datiBasket.team?.wnba?.length || 0) + (datiBasket.team?.nba?.length || 0)} team`);

  const datiTennis = caricaDatiTennis();
  console.log(`  Tennis: ${Object.keys(datiTennis.atp || {}).length} ATP + ${Object.keys(datiTennis.wta || {}).length} WTA`);

  const risultati = [];

  for (const p of partiteInArrivo) {
    const casaRaw = p.home_team || p.casa;
    const trasfRaw = p.away_team || p.trasf;
    const casa = normalizzaNome(casaRaw);
    const trasf = normalizzaNome(trasfRaw);
    const sport = p.sport || p.sportKey || 'calcio';
    if (!casa || !trasf) continue;

    let analisi;

    if (sport.includes('basketball') || sport === 'basket') {
      // BASKET
      analisi = analizzaBasket({ casa, trasf, datiBasket });
    } else if (sport.includes('tennis')) {
      // TENNIS
      analisi = analizzaTennis({ casa, trasf, datiTennis });
    } else {
      // CALCIO (default)
      const partiteCasa = storico.filter(x => x.HomeTeam === casa).slice(-20);
      const partiteTrasf = storico.filter(x => x.HomeTeam === trasf).slice(-20);

      analisi = analizzaCalcio({
        casa, trasf,
        partiteCasa, partiteTrasf,
        eloCasa: eloCalcio[casa] || 1500,
        eloTrasf: eloCalcio[trasf] || 1500,
      });
    }

    risultati.push({
      ...p,
      casa, trasf,
      sport: analisi.sport,
      probNostra: analisi.prob,
      detail: analisi.detail,
      extra: analisi, // dati extra specifici per sport
    });
  }

  return risultati;
}

// ── STAMPA RISULTATI ────────────────────────────────────────
export function stampaAnalisi(risultati) {
  console.log('\n' + '='.repeat(80));
  console.log('ANALISI PROBABILISTICA MULTI-SPORT');
  console.log('='.repeat(80));

  for (const r of risultati) {
    console.log(`\n[${r.sport.toUpperCase()}] ${r.casa} vs ${r.trasf}`);

    if (r.sport === 'calcio') {
      const p = r.probNostra.h2h;
      console.log(`  ELO: ${r.elo?.casa?.toFixed(0) || '?'} vs ${r.elo?.trasf?.toFixed(0) || '?'}`);
      console.log(`  Lambda: ${r.lambda?.casa?.toFixed(2) || '?'} vs ${r.lambda?.trasf?.toFixed(2) || '?'}`);
      console.log(`  FINALE 1X2:  ${p.map(x => (x * 100).toFixed(1) + '%').join(' / ')}`);
      console.log(`  Over 2.5: ${(r.probNostra.over25 * 100).toFixed(1)}%  |  BTTS: ${(r.probNostra.btts[0] * 100).toFixed(1)}%`);
    } else if (r.sport === 'basket') {
      const p = r.probNostra.moneyline;
      console.log(`  Punti attesi: ${r.punti?.casa || '?'} vs ${r.punti?.trasf || '?'}`);
      console.log(`  Moneyline: ${p.map(x => (x * 100).toFixed(1) + '%').join(' vs ')}`);
      console.log(`  Over ${r.probNostra.lineaOU}: ${(r.probNostra.over * 100).toFixed(1)}%  |  Under: ${(r.probNostra.under * 100).toFixed(1)}%`);
    } else if (r.sport === 'tennis') {
      const p = r.probNostra.moneyline;
      console.log(`  Ranking: ${r.ranking?.casa || '?'} vs ${r.ranking?.trasf || '?'}`);
      console.log(`  Moneyline: ${p.map(x => (x * 100).toFixed(1) + '%').join(' vs ')}`);
      console.log(`  Over 22.5 game: ${(r.probNostra.over * 100).toFixed(1)}%  |  Under: ${(r.probNostra.under * 100).toFixed(1)}%`);
    }
  }
}

// ── MAIN (se lanciato direttamente) ─────────────────────────
if (process.argv[1] && process.argv[1].includes('modello.mjs')) {
  const storico = caricaStorico();
  const elo = calcolaTuttiELO(storico);
  console.log('\nTop 10 squadre calcio per ELO:');
  const top = Object.entries(elo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [nome, rating] of top) {
    console.log(`  ${rating.toFixed(0)}  ${nome}`);
  }

  // Mostra team basket
  const basket = caricaDatiBasket();
  console.log('\nTeam WNBA per ELO:');
  const topWNBA = (basket.team?.wnba || []).sort((a, b) => b.elo - a.elo).slice(0, 5);
  for (const t of topWNBA) {
    console.log(`  ${t.elo}  ${t.nome} (${t.pts_fatti} pf, ${t.pts_subiti} ps)`);
  }
}
