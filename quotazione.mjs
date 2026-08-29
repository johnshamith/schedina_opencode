// quotazione.mjs — SCARICA QUOTE DA MULTIPLE FONTI (MULTI-SPORT)
// The Odds API: quote in tempo reale da 20+ bookmaker
// Supporta: calcio (h2h), basket (moneyline, ou), tennis (moneyline)

import fs from 'node:fs';
import path from 'node:path';
import { DATI, togliMargine, mediana, round, log } from './lib.mjs';
import { SPORT, FONDI } from './config.mjs';

// ── CONVERSIONE QUOTE AMERICAN → DECIMAL ─────────────────────
function americanToDecimal(price) {
  if (typeof price !== 'number' || isNaN(price)) return 0;
  if (price >= 1.01 && price <= 100) return price; // gia decimale
  if (price > 100) return round(1 + price / 100, 2); // es. +276 → 3.76
  if (price < -100) return round(1 + 100 / Math.abs(price), 2); // es. -150 → 1.67
  return 0;
}

function isValidOdds(price) {
  if (typeof price !== 'number' || isNaN(price)) return false;
  if (price >= 1.01 && price <= 50) return true; // decimale ragionevole
  return false;
}

// ── THE ODDS API ────────────────────────────────────────────
async function scaricaOddsAPI() {
  const envFile = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) {
    log('File .env non trovato — salto The Odds API');
    return [];
  }
  const env = fs.readFileSync(envFile, 'utf8');
  const match = env.match(/ODDSAPI_KEY\s*=\s*(\S+)/);
  if (!match) {
    log('ODDSAPI_KEY non trovata in .env — salto The Odds API');
    return [];
  }
  const key = match[1].trim();
  const BASE = FONDI.oddsApi.url;

  // Sport attivi
  const rs = await fetch(`${BASE}/sports/?apiKey=${key}`);
  if (!rs.ok) { log(`Errore Odds API: ${rs.status}`); return []; }
  const listaSport = await rs.json();
  const vivi = new Set(listaSport.filter(s => s.active).map(s => s.key));

  // Tennis: solo se abilitato nel config
  const tennisVivi = (SPORT.tennis && SPORT.tennis.length > 0)
    ? listaSport.filter(s => s.active && s.group === 'Tennis').map(s => s.key)
    : [];

  // Tutti gli sport da chiedere
  const daChiedere = [
    ...SPORT.calcio,
    ...SPORT.basket,
    ...tennisVivi,
  ].filter(k => vivi.has(k));

  log(`Odds API: ${daChiedere.length} campionati da chiedere`);
  const eventi = [];
  let usate = 0, rimaste = null;

  for (const s of daChiedere) {
    // Mercati diversi per sport
    let markets = 'h2h'; // default calcio
    if (s.includes('basketball')) {
      markets = 'h2h,totals'; // moneyline + over/under
    } else if (s.includes('tennis')) {
      markets = 'h2h,totals'; // moneyline + over/under
    }

    const u = `${BASE}/sports/${s}/odds/?apiKey=${key}&regions=eu&markets=${markets}&oddsFormat=decimal`;
    const r = await fetch(u);
    rimaste = r.headers.get('x-requests-remaining') ?? rimaste;
    usate++;
    if (!r.ok) continue;
    const j = await r.json();
    if (!Array.isArray(j)) continue;
    const gruppo = listaSport.find(x => x.key === s);

    for (const e of j) {
      // Determina sport dal key
      let sport = 'calcio';
      if (s.includes('basketball')) sport = 'basket';
      else if (s.includes('tennis')) sport = 'tennis';

      eventi.push({
        ...e,
        sport,
        sportKey: s,
        campionato: gruppo.title,
        fonte: 'oddsapi',
      });
    }
    await new Promise(x => setTimeout(x, 300));  // rate limit
  }

  log(`Odds API: ${eventi.length} partite, ${usate} chiamate, ${rimaste} rimaste`);
  return eventi;
}

// ── CALCOLO QUOTE NOSTRE ────────────────────────────────────
export function calcolaQuoteNostre(probabilita, sport = 'calcio') {
  if (sport === 'calcio') {
    return {
      h2h: probabilita.h2h.map(p => p > 0 ? round(1 / p, 2) : 99),
      over25: probabilita.over25 > 0 ? round(1 / probabilita.over25, 2) : 99,
      btts: probabilita.btts.map(p => p > 0 ? round(1 / p, 2) : 99),
    };
  } else if (sport === 'basket') {
    return {
      moneyline: probabilita.moneyline.map(p => p > 0 ? round(1 / p, 2) : 99),
      over: probabilita.over > 0 ? round(1 / probabilita.over, 2) : 99,
      under: probabilita.under > 0 ? round(1 / probabilita.under, 2) : 99,
    };
  } else if (sport === 'tennis') {
    return {
      moneyline: probabilita.moneyline.map(p => p > 0 ? round(1 / p, 2) : 99),
      over: probabilita.over > 0 ? round(1 / probabilita.over, 2) : 99,
      under: probabilita.under > 0 ? round(1 / probabilita.under, 2) : 99,
    };
  }
  return {};
}

// ── UNIFICA QUOTE (MULTI-SPORT) ─────────────────────────────
export function unificaQuote(eventi) {
  const risultati = [];

  // Raggruppa per partita
  const perPartita = {};
  for (const e of eventi) {
    const k = `${e.sport}|${e.home_team || ''} - ${e.away_team || ''}`;
    if (!perPartita[k]) perPartita[k] = { evento: e, bookmakers: [] };
    if (e.bookmakers) perPartita[k].bookmakers.push(e.bookmakers);
  }

  for (const [key, { evento, bookmakers }] of Object.entries(perPartita)) {
    const sport = evento.sport || 'calcio';

    // Raccogli quote per ogni sito e mercato
    const quotePerSito = [];
    for (const bm of bookmakers) {
      if (!Array.isArray(bm)) continue;
      for (const b of bm) {
        const hm = (b.markets || []).find(m => m.key === 'h2h');
        const tm = (b.markets || []).find(m => m.key === 'totals');

        const entry = { nome: b.key };

        // Moneyline / 1X2
        if (hm) {
          entry.nomi = hm.outcomes.map(o => o.name);
          entry.prezzi = hm.outcomes.map(o => {
            let p = o.price;
            // Converti American -> Decimal se necessario
            if (p > 100 || p < -100) p = americanToDecimal(p);
            return p;
          });
        }

        // Totals (Over/Under)
        if (tm) {
          const over = tm.outcomes.find(o => o.name === 'Over');
          const under = tm.outcomes.find(o => o.name === 'Under');
          let op = over?.price || null;
          let up = under?.price || null;
          if (op && (op > 100 || op < -100)) op = americanToDecimal(op);
          if (up && (up > 100 || up < -100)) up = americanToDecimal(up);
          entry.over = op;
          entry.under = up;
          entry.linea = over?.point || under?.point || null;
        }

        // Salta se quote non valide
        if (!entry.prezzi || entry.prezzi.some(p => !isValidOdds(p))) continue;

        quotePerSito.push(entry);
      }
    }

    if (quotePerSito.length < 3) continue;

    const nomi = quotePerSito[0].nomi;
    if (!nomi || nomi.length < 2) continue;

    // Mediana moneyline/1X2
    const mediane = nomi.map((_, i) => {
      const tutti = quotePerSito.map(q => q.prezzi?.[i]).filter(x => x > 0);
      return tutti.length > 0 ? mediana(tutti) : 0;
    });

    // Miglior quota
    const miglitori = nomi.map((_, i) => {
      const tutti = quotePerSito.map(q => q.prezzi?.[i]).filter(x => x > 0);
      return tutti.length > 0 ? Math.max(...tutti) : 0;
    });

    // Probabilita mercato
    const dev = togliMargine(mediane);

    // Totals (se disponibile)
    const overMediane = quotePerSito.map(q => q.over).filter(x => x > 0);
    const underMediane = quotePerSito.map(q => q.under).filter(x => x > 0);
    const linea = quotePerSito.find(q => q.linea)?.linea || null;

    const result = {
      casa: evento.home_team,
      trasf: evento.away_team,
      sport,
      campionato: evento.campionato,
      inizio: evento.commence_time,
      nSiti: quotePerSito.length,
      nomi,
      mediana: mediane,
      migliorQuota: miglitori,
      probMercato: dev.prob,
      margine: dev.margine,
      fonte: 'oddsapi',
    };

    // Aggiungi totals se disponibili
    if (overMediane.length > 2) {
      result.overMediana = mediana(overMediane);
      result.underMediana = mediana(underMediane);
      result.migliorQuotaOver = Math.max(...overMediane);
      result.migliorQuotaUnder = Math.max(...underMediane);
      result.linea = linea;
    }

    risultati.push(result);
  }

  return risultati;
}

// ── MAIN ────────────────────────────────────────────────────
export async function scaricaTutto() {
  fs.mkdirSync(DATI, { recursive: true });

  // 1. Scarica quote
  const oddsEventi = await scaricaOddsAPI();

  // 2. Unifica
  const unificate = unificaQuote(oddsEventi);

  // 3. Salva
  const output = {
    quando: new Date().toISOString(),
    nPartite: unificate.length,
    perSport: {
      calcio: unificate.filter(e => e.sport === 'calcio').length,
      basket: unificate.filter(e => e.sport === 'basket').length,
      tennis: unificate.filter(e => e.sport === 'tennis').length,
    },
    eventi: unificate,
  };
  fs.writeFileSync(path.join(DATI, 'quote.json'), JSON.stringify(output, null, 1));
  log(`Salvate ${unificate.length} partite: ${output.perSport.calcio} calcio, ${output.perSport.basket} basket, ${output.perSport.tennis} tennis`);

  return unificate;
}

// Se lanciato direttamente
if (process.argv[1] && process.argv[1].includes('quotazione.mjs')) {
  scaricaTutto().then(() => log('Fatto.'));
}
