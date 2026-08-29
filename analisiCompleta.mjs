// Modulo analisi completa partite: infortuni + news + tipster

// Analizza una partita con dati esterni
export function analizzaPartita(casa, trasf, datiWeb) {
  console.log(`\n🔍 Analisi: ${casa} vs ${trasf}`);
  
  const infortuni = analizzaInfortuni(datiWeb.infortuni, casa, trasf);
  const news = analizzaNews(datiWeb.news, casa, trasf);
  const tipster = analizzaTipster(datiWeb.tipster, casa, trasf);
  
  const punteggio = calcolaPunteggio(infortuni, news, tipster);
  
  return {
    partita: `${casa} vs ${trasf}`,
    infortuni,
    news,
    tipster,
    punteggio,
    raccomandazione: punteggio >= 70 ? 'BET' : punteggio >= 50 ? 'CAUTO' : 'SKIP'
  };
}

// Analizza infortuni
function analizzaInfortuni(testi, casa, trasf) {
  const keywords = ['infortunat', 'out', 'assente', 'squalificato', 'dubbio', 'non available', 'mancante'];
  
  const infortuniCasa = [];
  const infortuniTrasf = [];
  
  for (const testo of testi) {
    const t = testo.toLowerCase();
    if (t.includes(casa.toLowerCase())) {
      for (const kw of keywords) {
        if (t.includes(kw)) {
          infortuniCasa.push(testo.substring(0, 100));
          break;
        }
      }
    }
    if (t.includes(trasf.toLowerCase())) {
      for (const kw of keywords) {
        if (t.includes(kw)) {
          infortuniTrasf.push(testo.substring(0, 100));
          break;
        }
      }
    }
  }
  
  let impatto = 'basso';
  if (infortuniCasa.length > 2 || infortuniTrasf.length > 2) impatto = 'alto';
  else if (infortuniCasa.length > 0 || infortuniTrasf.length > 0) impatto = 'medio';
  
  return { casa: infortuniCasa, trasf: infortuniTrasf, impatto };
}

// Analizza news
function analizzaNews(testi, casa, trasf) {
  const newsCasa = testi.filter(t => t.toLowerCase().includes(casa.toLowerCase())).slice(0, 2);
  const newsTrasf = testi.filter(t => t.toLowerCase().includes(trasf.toLowerCase())).slice(0, 2);
  
  return { casa: newsCasa, trasf: newsTrasf };
}

// Analizza tipster
function analizzaTipster(testi, casa, trasf) {
  let favCasa = 0;
  let favTrasf = 0;
  
  for (const testo of testi) {
    const t = testo.toLowerCase();
    if (t.includes(casa.toLowerCase()) && (t.includes('vittoria') || t.includes('vince') || t.includes('favorit'))) {
      favCasa++;
    }
    if (t.includes(trasf.toLowerCase()) && (t.includes('vittoria') || t.includes('vince') || t.includes('favorit'))) {
      favTrasf++;
    }
  }
  
  const consensus = favCasa > favTrasf ? casa : favTrasf > favCasa ? trasf : 'equilibrato';
  
  return { consensus, favCasa, favTrasf };
}

// Calcola punteggio complessivo
function calcolaPunteggio(infortuni, news, tipster) {
  let punteggio = 50;
  
  // Infortuni
  if (infortuni.impatto === 'basso') punteggio += 20;
  else if (infortuni.impatto === 'medio') punteggio += 5;
  else if (infortuni.impatto === 'alto') punteggio -= 15;
  
  // Tipster
  if (tipster.consensus !== 'equilibrato') punteggio += 15;
  
  // News
  if (news.casa.length > 0) punteggio += 5;
  if (news.trasf.length > 0) punteggio += 5;
  
  return Math.min(100, Math.max(0, punteggio));
}

// Formatta per Telegram
export function formattaAnalisi(analisi) {
  const emoji = analisi.raccomandazione === 'BET' ? '✅' : 
                analisi.raccomandazione === 'CAUTO' ? '⚠️' : '❌';
  
  let testo = `${emoji} ${analisi.partita}\n`;
  testo += `Punteggio: ${analisi.punteggio}/100\n`;
  testo += `Raccomandazione: ${analisi.raccomandazione}\n\n`;
  
  if (analisi.infortuni.impatto !== 'basso') {
    testo += `Infortuni: ${analisi.infortuni.impatto}\n`;
  }
  
  if (analisi.tipster.consensus !== 'equilibrato') {
    testo += `Tipster: ${analisi.tipster.consensus} favorita\n`;
  }
  
  return testo;
}
