// giornata.mjs — ORCHESTRATORE COMPLETO MULTI-SPORT
// Esegue tutto il pipeline in sequenza per TUTTI gli sport:
//   1. Scarica dati storici + quote (calcio, basket, tennis)
//   2. Calcola probabilita (modelli sport-specifici)
//   3. Confronta con quote bookmaker
//   4. Trova scommesse con valore
//   5. Componi la schedina (singola/doppia/tripla, multi-sport)
//   6. Calcola la puntata (Kelly Criterion)
//   7. Controlla che sia sicura
//   8. Salva tutto

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';
import { inviaFoto, tripla, multipla, singola } from './notifica.mjs';

const PASSI = [
  { nome: 'Scarico dati storici (calcio + basket + tennis)', file: 'scarica.mjs' },
  { nome: 'Scarico quote live (The Odds API)', file: 'quotazione.mjs' },
  { nome: 'Analizzo partite (modelli multi-sport)', file: 'analisi.mjs' },
  { nome: 'Cerco valore (multi-sport)', file: 'ricerca.mjs' },
  { nome: 'Compongo schedina (multi-sport)', file: 'componi.mjs' },
  { nome: 'Controllo sicurezza', file: 'controlla.mjs' },
];

console.log('\n' + '#'.repeat(70));
console.log('  SISTEMA SCHEDINA MULTI-SPORT — ' + new Date().toISOString().slice(0, 16));
console.log('  Sport: Calcio + Basket (WNBA/NBA) + Tennis');
console.log('#'.repeat(70));

for (const passo of PASSI) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${passo.nome}...`);
  console.log('='.repeat(60));

  const r = spawnSync(process.execPath, [passo.file], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });

  if (r.stdout) console.log(r.stdout.trimEnd());
  if (r.stderr) console.error(r.stderr.trimEnd());

  if (r.status !== 0) {
    console.log(`\nERRORE nel passo "${passo.nome}". Mi fermo.`);
    process.exit(1);
  }
}

// Risultato finale
const file = path.join(DATI, 'giocata.json');
const cassaFile = path.join(DATI, 'cassa.json');
let bankroll = 15;
if (fs.existsSync(cassaFile)) {
  try {
    const cassa = JSON.parse(fs.readFileSync(cassaFile, 'utf8'));
    bankroll = cassa.euro || 15;
  } catch {}
}

if (fs.existsSync(file)) {
  const giocata = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (giocata.niente) {
    console.log('\nNessuna schedina oggi.');
  } else {
    console.log('\n' + '#'.repeat(70));
    console.log('  SCHEDINA PRONTA!');
    console.log(`  Tipo: ${giocata.tipo}`);
    console.log(`  Sport: ${giocata.sport?.join(', ') || 'multi-sport'}`);
    console.log(`  Gambe: ${giocata.gambe?.length || 0}`);
    console.log(`  Quota: ${giocata.quota}`);
    console.log(`  Puntata: ${giocata.puntata} e`);
    console.log(`  Vincita: ${giocata.vincitaAttesa} e`);
    console.log(`  Bankroll: ${bankroll} e`);
    console.log('#'.repeat(70));

    // Notifica Telegram
    try {
      let messaggio;
      if (giocata.tipo === 'TRIPLA' && giocata.gambe.length === 3) {
        const partite = giocata.gambe.map(g => ({
          squadra1: g.partita.split(' - ')[0] || g.partita,
          squadra2: g.partita.split(' - ')[1] || '',
          ora: g.ora || '20:45',
          quota: g.quota
        }));
        messaggio = tripla(partite, giocata.puntata, bankroll);
      } else if (giocata.tipo === 'MULTIPLA') {
        const partite = giocata.gambe.map(g => ({
          squadra1: g.partita.split(' - ')[0] || g.partita,
          squadra2: g.partita.split(' - ')[1] || '',
          ora: g.ora || '20:45',
          quota: g.quota
        }));
        messaggio = multipla(partite, giocata.puntata, bankroll);
      } else {
        const g = giocata.gambe[0];
        messaggio = singola(g.partita, g.quota, g.esito || g.dice, giocata.puntata, bankroll);
      }
      await inviaFoto(messaggio.foto, messaggio.testo, messaggio.bottoni);
      console.log('[TELEGRAM] Notifica inviata!');

      // Registra la schedina suggerita come giocata "in attesa" in storico-giocate.json
      // (così la sera risultati.mjs ne verifica l'esito). Se John non la piazza o
      // piazza altro, può modificare/quagliare la voce.
      try {
        const storicoFile = path.join(DATI, 'storico-giocate.json');
        let storico = { cassaIniziale: bankroll, sito: '888Sport', giocate: [] };
        if (fs.existsSync(storicoFile)) {
          storico = JSON.parse(fs.readFileSync(storicoFile, 'utf8'));
        }
        const giorno = giocata.giorno || new Date().toISOString().slice(0, 10);
        const giaPresente = (storico.giocate || []).some(g =>
          g.tipo === giocata.tipo &&
          g.data === giorno &&
          !g.risultato
        );
        if (!giaPresente) {
          storico.giocate.push({
            data: giorno,
            tipo: giocata.tipo,
            puntata: giocata.puntata,
            quota: giocata.quota,
            probabilita: giocata.prob || 0,
            sito: '888Sport',
            gambe: (giocata.gambe || []).map(g => ({
              partita: g.partita,
              campionato: g.campionato,
              ora: g.ora || '20:45',
              esito: g.esito || g.dice,
              dice: g.spiega || g.dice,
              quota: g.quota,
              prob: g.prob,
              risultato: null,
            })),
            risultato: null,
            cassaDopo: null,
          });
          fs.writeFileSync(storicoFile, JSON.stringify(storico, null, 1));
          console.log('[STORICO] Schedina registrata in attesa di risultato.');
        }
      } catch (err) {
        console.error('[Storico] Errore registrazione:', err.message);
      }
    } catch (err) {
      console.error('[TELEGRAM] Errore invio:', err.message);
    }
  }
}
