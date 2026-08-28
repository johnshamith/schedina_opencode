import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function caricaEnv() {
  const envPath = join(__dirname, '.env');
  const env = readFileSync(envPath, 'utf8');
  const config = {};
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    config[key] = value;
  }
  return config;
}

const FOTO_CALCIO = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80';
const FOTO_BASKET = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80';
const FOTO_TENNIS = 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80';

export async function inviaFoto(urlFoto, testo, bottoni) {
  const env = caricaEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return false;

  try {
    const body = {
      chat_id: chatId,
      photo: urlFoto,
      caption: testo
    };

    if (bottoni) {
      body.reply_markup = bottoni;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return data.ok;
  } catch (err) {
    console.error('[TELEGRAM] Errore foto:', err.message);
    return false;
  }
}

export async function inviaTesto(testo) {
  const env = caricaEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testo
      })
    });
    const data = await res.json();
    return data.ok;
  } catch (err) {
    return false;
  }
}

// ─── FORMATO SINGOLA ────────────────────────────────────

export function singola(partita, quota, esito, puntata, bankroll) {
  const data = getData();
  const vincita = (puntata * quota).toFixed(2);
  const ore = getOra();
  const rimanente = bankroll ? (bankroll - puntata).toFixed(2) : '?';

  const testo = `${data}

SINGOLA CONSIGLIATA

${partita}
Ore ${ore} | Quota ${quota}
Esito: ${esito}

Puntata: EUR ${puntata}
Vincita: EUR ${vincita}
Rimanente: EUR ${rimanente}

Nota: verifica quota su 888Sport
Analisi: John + Sistema AI`;

  const bottoni = {
    inline_keyboard: [[
      { text: 'GIOCA SINGOLA', url: 'https://www.888sport.it' }
    ]]
  };

  return { testo, bottoni, foto: FOTO_CALCIO };
}

// ─── FORMATO TRIPLA ────────────────────────────────────

export function tripla(partite, puntata, bankroll) {
  const data = getData();
  const quotaTotale = partite.reduce((acc, p) => acc * p.quota, 1).toFixed(2);
  const vincita = (puntata * parseFloat(quotaTotale)).toFixed(2);
  const rimanente = bankroll ? (bankroll - puntata).toFixed(2) : '?';

  let elenco = '';
  for (let i = 0; i < partite.length; i++) {
    const p = partite[i];
    elenco += `${i + 1}. ${p.squadra1} - ${p.squadra2}\n`;
    elenco += `   Ore ${p.ora} | Quota ${p.quota}\n\n`;
  }

  const testo = `${data}

TRIPLA CONSIGLIATA

${elenco}Quota totale: ${quotaTotale}
Puntata: EUR ${puntata}
Vincita: EUR ${vincita}
Rimanente: EUR ${rimanente}

Nota: verifica quote su 888Sport
Analisi: John + Sistema AI`;

  const bottoni = {
    inline_keyboard: [[
      { text: 'GIOCA TRIPLA', url: 'https://www.888sport.it' }
    ]]
  };

  return { testo, bottoni, foto: FOTO_CALCIO };
}

// ─── FORMATO MULTIPLA ────────────────────────────────────

export function multipla(partite, puntata, bankroll) {
  const data = getData();
  const quotaTotale = partite.reduce((acc, p) => acc * p.quota, 1).toFixed(2);
  const vincita = (puntata * parseFloat(quotaTotale)).toFixed(2);
  const rimanente = bankroll ? (bankroll - puntata).toFixed(2) : '?';

  let elenco = '';
  for (let i = 0; i < partite.length; i++) {
    const p = partite[i];
    elenco += `${i + 1}. ${p.squadra1} - ${p.squadra2}\n`;
    elenco += `   Ore ${p.ora} | Quota ${p.quota}\n\n`;
  }

  const testo = `${data}

MULTIPLA CONSIGLIATA

${elenco}Quota totale: ${quotaTotale}
Puntata: EUR ${puntata}
Vincita: EUR ${vincita}
Rimanente: EUR ${rimanente}

Nota: verifica quote su 888Sport
Analisi: John + Sistema AI`;

  const bottoni = {
    inline_keyboard: [[
      { text: 'GIOCA MULTIPLA', url: 'https://www.888sport.it' }
    ]]
  };

  return { testo, bottoni, foto: FOTO_CALCIO };
}

// ─── FORMATO RISULTATO ────────────────────────────────────

export function risultato(giocata, esito) {
  const barra = esito === 'vinta' ? '=========================' : '---------------------------';
  const testoEsito = esito === 'vinta' ? 'HAI VINTO!' : 'HAI PERSO';

  let testo = `${barra}
${testoEsito}
${barra}

${giocata.tipo} - EUR ${giocata.puntata}
Quota: ${giocata.quota}`;

  if (esito === 'vinta') {
    testo += `\n\nVincita: EUR ${(giocata.puntata * giocata.quota).toFixed(2)}`;
  }

  testo += `\n\n${barra}`;

  return { testo, foto: esito === 'vinta' ? FOTO_CALCIO : null };
}

// ─── FUNZIONI HELPER ────────────────────────────────────

function getData() {
  const mesi = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
  const oggi = new Date();
  return `${oggi.getDate()} ${mesi[oggi.getMonth()]} ${oggi.getFullYear()}`;
}

function getOra() {
  const oggi = new Date();
  return `${String(oggi.getHours()).padStart(2,'0')}:${String(oggi.getMinutes()).padStart(2,'0')}`;
}
