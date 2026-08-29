// componi.mjs — COMPONE SCHEDINA SAFE (SOLO SINGOLE)
// Solo favoriti con quota 1.20-1.40, solo oggi

import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';
import { caricaBankroll } from './banca.mjs';
import { singola } from './notifica.mjs';

// Carica scommesse con valore
const valoreFile = path.join(DATI, 'valore.json');
if (!fs.existsSync(valoreFile)) {
  log('Mancano le scommesse. Lancia prima ricerca.mjs');
  process.exit(1);
}

const { scommesse } = JSON.parse(fs.readFileSync(valoreFile, 'utf8'));
if (!scommesse || scommesse.length === 0) {
  log('Nessuna scommessa disponibile');
  process.exit(0);
}

// Filtra SOLO oggi
const oggi = new Date().toISOString().slice(0, 10);
const partiteOggi = scommesse.filter(s => {
  if (!s.inizio) return false;
  const data = new Date(s.inizio).toISOString().slice(0, 10);
  return data === oggi;
});

log(`Partite oggi: ${partiteOggi.length}`);

// Filtra SONO favoriti con quota 1.20-1.40
const favoriti = partiteOggi.filter(s => {
  const quota = s.quotaBookmaker;
  return quota >= 1.20 && quota <= 1.40;
});

log(`Favoriti (quota 1.20-1.40): ${favoriti.length}`);

// Ordina per probabilità (più alta prima)
favoriti.sort((a, b) => b.probNostra - a.probNostra);

// Scegli il MIGLIORE (prob più alta)
const migliore = favoriti[0];

if (!migliore) {
  log('Nessun favorito trovato per oggi');
  // Prova domani
  const domani = new Date();
  domani.setDate(domani.getDate() + 1);
  const dataDomani = domani.toISOString().slice(0, 10);
  
  const partiteDomani = scommesse.filter(s => {
    if (!s.inizio) return false;
    const data = new Date(s.inizio).toISOString().slice(0, 10);
    return data === dataDomani;
  });
  
  const favoritiDomani = partiteDomani.filter(s => {
    const quota = s.quotaBookmaker;
    return quota >= 1.20 && quota <= 1.40;
  });
  
  favoritiDomani.sort((a, b) => b.probNostra - a.probNostra);
  
  if (favoritiDomani.length > 0) {
    log(`Trovato favorito per DOMANI: ${favoritiDomani[0].partita}`);
    const m = favoritiDomani[0];
    
    // Calcola puntata
    const cassa = caricaBankroll();
    const puntata = Math.min(50, Math.max(25, Math.round(cassa.euro * 0.2)));
    
    const schedina = {
      tipo: 'SINGOLA',
      giorno: dataDomani,
      sport: m.sport,
      quota: m.quotaBookmaker,
      prob: m.probNostra,
      puntata: puntata,
      vincitaAttesa: Math.round(puntata * m.quotaBookmaker * 100) / 100,
      gambe: [{
        partita: m.partita,
        sport: m.sport,
        esito: m.esito,
        spiega: m.spiega,
        quota: m.quotaBookmaker,
        prob: m.probNostra,
        edge: m.edge,
        kelly: m.kelly,
        campionato: m.campionato,
        nSiti: m.nSiti,
        inizio: m.inizio,
        ora: new Date(m.inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
      }]
    };
    
    // Salva
    fs.writeFileSync(path.join(DATI, 'giocata.json'), JSON.stringify({
      quando: new Date().toISOString(),
      giorno: schedina.giorno,
      tipo: schedina.tipo,
      sport: schedina.sport,
      quota: schedina.quota,
      prob: schedina.prob,
      puntata: schedina.puntata,
      vincitaAttesa: schedina.vincitaAttesa,
      gambe: schedina.gambe
    }, null, 1));
    
    // Stampa
    console.log('\n' + '='.repeat(70));
    console.log(`SINGOLA SAFE DOMANI — ${schedina.giorno}`);
    console.log('='.repeat(70));
    console.log(`  ${m.partita}`);
    console.log(`  Esito: ${m.esito} (${m.spiega})`);
    console.log(`  Quota: ${m.quotaBookmaker} | Prob: ${(m.probNostra * 100).toFixed(1)}%`);
    console.log(`  Puntata: ${puntata} EUR`);
    console.log(`  Vincita: ${schedina.vincitaAttesa} EUR`);
    console.log('='.repeat(70));
    
    process.exit(0);
  }
  
  log('Nessuna partita trovata');
  process.exit(0);
}

// Calcola puntata
const cassa = caricaBankroll();
const puntata = Math.min(50, Math.max(25, Math.round(cassa.euro * 0.2)));

// Crea schedina SINGOLA
const schedina = {
  tipo: 'SINGOLA',
  giorno: oggi,
  sport: migliore.sport,
  quota: migliore.quotaBookmaker,
  prob: migliore.probNostra,
  puntata: puntata,
  vincitaAttesa: Math.round(puntata * migliore.quotaBookmaker * 100) / 100,
  gambe: [{
    partita: migliore.partita,
    sport: migliore.sport,
    esito: migliore.esito,
    spiega: migliore.spiega,
    quota: migliore.quotaBookmaker,
    prob: migliore.probNostra,
    edge: migliore.edge,
    kelly: migliore.kelly,
    campionato: migliore.campionato,
    nSiti: migliore.nSiti,
    inizio: migliore.inizio,
    ora: new Date(migliore.inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  }]
};

// Salva
fs.writeFileSync(path.join(DATI, 'giocata.json'), JSON.stringify({
  quando: new Date().toISOString(),
  giorno: schedina.giorno,
  tipo: schedina.tipo,
  sport: schedina.sport,
  quota: schedina.quota,
  prob: schedina.prob,
  puntata: schedina.puntata,
  vincitaAttesa: schedina.vincitaAttesa,
  gambe: schedina.gambe
}, null, 1));

// Stampa
console.log('\n' + '='.repeat(70));
console.log(`SINGOLA SAFE — ${schedina.giorno}`);
console.log('='.repeat(70));
console.log(`  ${migliore.partita}`);
console.log(`  Esito: ${migliore.esito} (${migliore.spiega})`);
console.log(`  Quota: ${migliore.quotaBookmaker} | Prob: ${(migliore.probNostra * 100).toFixed(1)}%`);
console.log(`  Puntata: ${puntata} EUR`);
console.log(`  Vincita: ${schedina.vincitaAttesa} EUR`);
console.log('='.repeat(70));
