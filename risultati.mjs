// risultati.mjs — VERIFICA RISULTATI E INVIA NOTIFICA TELEGRAM
// Legge le giocate in attesa (risultato null) da storico-giocate.json,
// controlla i punteggi via The Odds API, determina VINTA/PERDUTA,
// aggiorna bankroll e manda il messaggio su Telegram.
//
// Su GitHub i segreti sono in env (secrets); in locale leggo da .env.

import fs from 'node:fs';
import path from 'node:path';

const DATI = path.join(process.cwd(), 'dati');

// CARICA ENV (locale)
function caricaEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const config = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    config[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return config;
}

const KEY = process.env.ODDSAPI_KEY || caricaEnv().ODDSAPI_KEY;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || caricaEnv().TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID || caricaEnv().TELEGRAM_CHAT_ID;
const BASE = 'https://api.the-odds-api.com/v4';

// MAPPA CAMPIONATO -> ODDSAPI SPORT KEY
const MAPPA_CAMPIONATO = {
  'serie a': 'soccer_italy_serie_a',
  'serie b': 'soccer_italy_serie_b',
  'bundesliga': 'soccer_germany_bundesliga',
  'ligue 1': 'soccer_france_ligue_one',
  'ligue one': 'soccer_france_ligue_one',
  'premier league': 'soccer_epl',
  'premiership': 'soccer_spl',
  'la liga': 'soccer_spain_la_liga',
  'eredivisie': 'soccer_netherlands_eredivisie',
  'wnba': 'basketball_wnba',
  'nba': 'basketball_nba',
  'euroleague': 'basketball_euroleague',
  'atp': 'tennis_atp',
  'wta': 'tennis_wta',
  'champions': 'soccer_uefa_champs_league_qualification',
  'europa league': 'soccer_uefa_europa_league',
  'conference': 'soccer_uefa_conference_league',
};

// NORMALIZZA NOME SQUADRA (con alias)
const ALIAS = {
  'man city': 'manchester city',
  'man utd': 'manchester united',
  'man united': 'manchester united',
  'psg': 'paris saint germain',
  'paris sg': 'paris saint germain',
  'sporting': 'sporting lisbon',
  'sporting cp': 'sporting lisbon',
  'sp. lisbon': 'sporting lisbon',
  'inter': 'inter milan',
  'ac milan': 'milan',
  'roma': 'as roma',
  'spagna': 'spain',
};

function roundDec(n) {
  return Math.round(n * 100) / 100;
}

function normNome(n) {
  let s = String(n || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (ALIAS[s]) s = ALIAS[s];
  return s;
}

function mappaSportKey(campionato, partita) {
  const s = `${campionato || ''} ${partita || ''}`.toLowerCase();
  if (s.includes('portugal') || s.includes('primeira') || s.includes('portogallo')) {
    return 'soccer_portugal_primeira_liga';
  }
  for (const [k, v] of Object.entries(MAPPA_CAMPIONATO)) {
    if (k === 'la liga') continue;
    if (s.includes(k)) return v;
  }
  if (s.includes('la liga') || s.includes('spagna') || s.includes('liga')) {
    return 'soccer_spain_la_liga';
  }
  return null;
}

function nomiCoincidono(a, b) {
  const na = normNome(a);
  const nb = normNome(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function scaricaScores(sportKey) {
  const u = `${BASE}/sports/${sportKey}/scores/?apiKey=${KEY}&daysFrom=2`;
  const r = await fetch(u);
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

function esitoReale(gamba, eventi) {
  const [casa, trasf] = (gamba.partita || '')
    .split('-')
    .map(x => x.trim());

  const match = eventi.find(e => EventoContiene(e, casa, trasf));
  if (!match) return { stato: 'NON_TROVATO', dettaglio: 'partita non trovata nei risultati' };

  const score = punteggio(match);
  if (score === null) return { stato: 'IN_CORSO', dettaglio: 'punteggio non disponibile' };

  const inizio = match.commence_time ? new Date(match.commence_time).getTime() : 0;
  const ormaiFinita = inizio && (Date.now() - inizio > (100 * 60 * 1000));
  if (!match.completed && !ormaiFinita) {
    return { stato: 'IN_CORSO', dettaglio: 'partita ancora in corso' };
  }

  const goalCasa = goalDi(score, casa);
  const goalTrasf = goalDi(score, trasf);

  let reale;
  if (goalCasa > goalTrasf) reale = '1';
  else if (goalTrasf > goalCasa) reale = '2';
  else reale = 'X';

  const esito = (gamba.esito || '').toUpperCase().replace(/\s+/g, '');
  let vinta;
  if (esito === '1X') vinta = reale === '1' || reale === 'X';
  else if (esito === 'X2' || esito === '2X') vinta = reale === 'X' || reale === '2';
  else if (esito === '12') vinta = reale === '1' || reale === '2';
  else if (esito === 'X') vinta = reale === 'X';
  else if (esito === '1') vinta = reale === '1';
  else if (esito === '2') vinta = reale === '2';
  else vinta = false;

  const dettaglio = `${casa} ${goalCasa} - ${goalTrasf} ${trasf}`;
  return { stato: vinta ? 'VINTA' : 'PERDUTA', dettaglio, reale };
}

function EventoContiene(e, casa, trasf) {
  const eh = e.home_team || '';
  const ea = e.away_team || '';
  return (nomiCoincidono(eh, casa) && nomiCoincidono(ea, trasf)) ||
         (nomiCoincidono(eh, trasf) && nomiCoincidono(ea, casa));
}

function punteggio(e) {
  if (!e.scores || !Array.isArray(e.scores)) return null;
  const m = {};
  for (const s of e.scores) m[normNome(s.name)] = parseInt(s.score, 10) || 0;
  return m;
}

function goalDi(scoreMap, nome) {
  const n = normNome(nome);
  if (!n) return 0;
  if (scoreMap[n] !== undefined) return scoreMap[n];
  for (const [k, v] of Object.entries(scoreMap)) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  return 0;
}

async function inviaText(testo) {
  if (!TOKEN || !CHAT) return false;
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ chat_id: CHAT, text: testo }),
  });
  const j = await r.json();
  return j.ok;
}

function caricaJson(nome) {
  const p = path.join(DATI, nome);
  if (!fs.existsSync(p)) return null;
  try {
    let raw = fs.readFileSync(p, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch { return null; }
}

function salvaJson(nome, obj) {
  fs.writeFileSync(path.join(DATI, nome), JSON.stringify(obj, null, 1));
}

async function main() {
  const storico = caricaJson('storico-giocate.json');
  const cassa = caricaJson('cassa.json') ||
    { euro: 15, iniziata: new Date().toISOString().slice(0, 10), storico: [] };

  if (!storico || !Array.isArray(storico.giocate)) {
    console.log('Nessuno storico-giocate.json. Niente da verificare.');
    return;
  }

  const inAttesa = storico.giocate.filter(g => !g.risultato);
  if (inAttesa.length === 0) {
    console.log('Nessuna giocata in attesa di risultato.');
    return;
  }

  const perLiga = {};
  for (const g of inAttesa) {
    for (const gamba of g.gambe || []) {
      const sk = mappaSportKey(gamba.campionato, gamba.partita);
      if (!sk) {
        gamba.risultato = 'LIGA_NON_TROVATA';
        gamba.dettaglio = `${gamba.campionato} non mappata`;
        continue;
      }
      gamba._sportKey = sk;
      perLiga[sk] = perLiga[sk] || [];
      perLiga[sk].push({ giocata: g, gamba });
    }
  }

  for (const [sk, lista] of Object.entries(perLiga)) {
    const eventi = await scaricaScores(sk);
    console.log(`Odds API ${sk}: ${eventi.length} eventi`);
    for (const { giocata, gamba } of lista) {
      const res = esitoReale(gamba, eventi);
      gamba.risultato = res.stato;
      gamba.dettaglio = res.dettaglio;
      console.log(`  ${gamba.partita} -> ${res.stato} (${res.dettaglio})`);
    }
  }

  let testo = `RISULTATI - ${new Date().toISOString().slice(0, 10)}\n\n`;
  let tuttoFinito = true;

  for (const g of inAttesa) {
    const gambe = g.gambe || [];
    const esiti = gambe.map(x => x.risultato);

    const ancoraInCorso = esiti.some(e => e === 'IN_CORSO' || e === 'NON_TROVATO');
    const perse = esiti.some(e => e === 'PERDUTA' || e === 'LIGA_NON_TROVATA');

    testo += `${g.tipo} (EUR ${g.puntata} @ ${g.quota})\n`;
    for (const gamba of gambe) {
      testo += `  ${gamba.partita}: ${gamba.risultato}${gamba.dettaglio ? '  - ' + gamba.dettaglio : ''}\n`;
    }

    if (ancoraInCorso) {
      testo += `  STATO: IN ATTESA (partite in corso)\n\n`;
      tuttoFinito = false;
      g.risultato = 'IN_ATTESA';
      continue;
    }

    if (perse) {
      g.risultato = 'PERDUTA';
      g.cassaDopo = cassa.euro;
      testo += `  STATO: PERDUTA ✗\n\n`;
    } else {
      g.risultato = 'VINTA';
      const ritorno = g.puntata * g.quota;
      g.cassaDopo = roundDec(cassa.euro + ritorno);
      cassa.euro = g.cassaDopo;
      testo += `  STATO: VINTA ✓\n\n`;
    }
  }

  testo += `\nBankroll attuale: EUR ${cassa.euro.toFixed(2)}`;

  salvaJson('storico-giocate.json', storico);
  salvaJson('cassa.json', cassa);

  if (tuttoFinito) {
    await inviaText(testo);
    console.log('[TELEGRAM] Risultati inviati.');
  } else {
    console.log('Non tutto finito, niente invio Telegram (solo log locale).');
  }
}

main().catch(err => {
  console.error('ERRORE:', err);
  process.exit(1);
});
