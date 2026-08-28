// config.mjs — REGOLE COMPLETE DEL SISTEMA (MULTI-SPORT)
// Modificare solo qui. Tutto il resto legge da qui.

// ── CAMPIONATI CALCIO ────────────────────────────────────────
export const LEGHE = {
  I1:  'Serie A',
  E0:  'Premier League',
  SP1: 'Liga',
  F1:  'Ligue 1',
  D1:  'Bundesliga',
  P1:  'Portogallo Primeira Liga',
  N1:  'Olanda Eredivisie',
  B1:  'Belgio Pro League',
  T1:  'Turchia Super Lig',
  G1:  'Grecia Super League',
};
export const STAGIONI = ['2627', '2526', '2425'];

// ── REGOLE DI SCELTA ────────────────────────────────────────
export const REGOLE = {
  gambeMin: 1,
  gambeMax: 4,
  quotaGambaMin: 1.10,
  quotaGambaMax: 5.00,
  quotaTotaleMin: 1.10,
  quotaTotaleMax: 30.00,
  probGambaMin: 0.40,
  nSitiMin: 2,
  puntataDefault: 3,
  kellyFrazione: 0.25,
  bankrollIniziale: 15,
  puntataMin: 1,
  puntataMax: 10,
  costoMassimo: 0.30,
  gambeMinimeGiornata: 1,
  saltaSePochi: false,
};

// ── MERCATI PER SPORT ────────────────────────────────────────
export const MERCATI = {
  // Calcio
  calcio: {
    h2h: { nome: 'Vittoria', descrizione: 'Chi vince (1, X, 2)' },
    ou25: { nome: 'Gol', descrizione: 'Over/Under 2.5 gol' },
    btts: { nome: 'Entrambe segnano', descrizione: 'BTTS Yes/No' },
    dc: { nome: 'Doppia chance', descrizione: '1X, X2, 12' },
  },
  // Basket
  basket: {
    moneyline: { nome: 'Vittoria', descrizione: 'Chi vince' },
    spread: { nome: 'Handicap', descrizione: 'Spread punti' },
    ou: { nome: 'Punti', descrizione: 'Over/Under punti totali' },
  },
  // Tennis
  tennis: {
    moneyline: { nome: 'Vittoria', descrizione: 'Chi vince il match' },
    handicap: { nome: 'Handicap', descrizione: 'Handicap game/set' },
    ou: { nome: 'Game', descrizione: 'Over/Under game totali' },
  },
};

// ── SORGENTI DATI ───────────────────────────────────────────
export const FONDI = {
  oddsApi: {
    url: 'https://api.the-odds-api.com/v4',
    maxChiamate: 500,
  },
  footballData: {
    url: 'https://www.football-data.co.uk/mmz4281',
  },
  // Basket dati storici
  basketData: {
    url: 'https://www.balldontlie.io/api/v1',
  },
  // Tennis dati
  tennisData: {
    url: 'https://raw.githubusercontent.com/JeffSackworthy/tennis_data/main',
  },
};

// ── SPORT (The Odds API keys) ────────────────────────────────
export const SPORT = {
  calcio: [
    'soccer_italy_serie_a', 'soccer_epl', 'soccer_spain_la_liga',
    'soccer_france_ligue_one', 'soccer_germany_bundesliga',
    'soccer_portugal_primeira_liga', 'soccer_netherlands_eredivisie',
    'soccer_turkey_super_leag', 'soccer_greece_super_league',
    'soccer_belgium_first_div_a',
    'soccer_uefa_champs_league_qualification',
    'soccer_uefa_europa_league',
    'soccer_uefa_conference_league',
  ],
  basket: [
    'basketball_wnba',
    'basketball_nba',
    'basketball_euroleague',
  ],
  tennis: [
    'tennis_atp',
    'tennis_wta',
  ],
};

// ── CONFIGURAZIONE SPORT SPECIFICA ───────────────────────────
export const SPORT_CONFIG = {
  calcio: {
    modelllo: 'poisson',
    mercati: ['h2h', 'ou25', 'btts'],
    probMinima: 0.55,
    quotaMin: 1.20,
    quotaMax: 1.80,
  },
  basket: {
    modelllo: 'media_punti',
    mercati: ['moneyline', 'ou'],
    probMinima: 0.58,
    quotaMin: 1.25,
    quotaMax: 1.80,
    // Parametri basket
    mediaPuntiCasa: 85,
    mediaPuntiTrasf: 82,
    spreadMedio: 3.5,
  },
  tennis: {
    modelllo: 'ranking_forma',
    mercati: ['moneyline', 'ou'],
    probMinima: 0.60,
    quotaMin: 1.20,
    quotaMax: 1.70,
  },
};

// ── KELLY CRITERION ─────────────────────────────────────────
export const KELLY = {
  fraction: 0.25,
  maxPuntataPct: 0.20,
  minProb: 0.55,
};
