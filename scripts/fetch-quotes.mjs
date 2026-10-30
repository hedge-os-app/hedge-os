// Fetches TASE + European local-exchange quotes from Yahoo Finance (v8 chart endpoint)
// and writes data/quotes.json. Run by GitHub Actions cron; also runnable locally.
import fs from 'node:fs';

const UNIVERSE = {
  'TEVA.TA': { name: 'טבע', exchange: 'TASE' },
  'LUMI.TA': { name: 'בנק לאומי', exchange: 'TASE' },
  'POLI.TA': { name: 'בנק הפועלים', exchange: 'TASE' },
  'BEZQ.TA': { name: 'בזק', exchange: 'TASE' },
  'NICE.TA': { name: 'נייס', exchange: 'TASE' },
  'ICL.TA': { name: 'כימיקלים לישראל', exchange: 'TASE' },
  'DSCT.TA': { name: 'דיסקאונט', exchange: 'TASE' },
  'PHOE.TA': { name: 'הפניקס', exchange: 'TASE' },
  'ASML.AS': { name: 'ASML', exchange: 'אמסטרדם' },
  'SAP.DE': { name: 'SAP', exchange: 'פרנקפורט (Xetra)' },
  'MC.PA': { name: 'LVMH', exchange: 'פריז' },
  'SAN.PA': { name: 'סנופי', exchange: 'פריז' },
  'NESN.SW': { name: 'נסטלה', exchange: 'ציריך (SIX)' },
  'SHEL.L': { name: 'של', exchange: 'לונדון' },
  'AZN.L': { name: 'אסטרהזנקה', exchange: 'לונדון' },
  'ENEL.MI': { name: 'אנל', exchange: 'מילאנו' },
  'AAPL': { name: 'אפל', exchange: 'NASDAQ' },
  'MSFT': { name: 'מיקרוסופט', exchange: 'NASDAQ' },
  'NVDA': { name: 'אנבידיה', exchange: 'NASDAQ' },
  'AMZN': { name: 'אמזון', exchange: 'NASDAQ' },
  'GOOGL': { name: 'אלפבית (גוגל)', exchange: 'NASDAQ' },
  'META': { name: 'מטא', exchange: 'NASDAQ' },
  'TSLA': { name: 'טסלה', exchange: 'NASDAQ' },
  'JPM': { name: 'JP מורגן', exchange: 'NYSE' },
  'TM': { name: 'טויוטה (ADR)', exchange: 'NYSE' },
  'SONY': { name: 'סוני (ADR)', exchange: 'NYSE' },
  'MUFG': { name: 'מיצובישי UFJ (ADR)', exchange: 'NYSE' },
  'SMFG': { name: 'סומיטומו מיצואי (ADR)', exchange: 'NYSE' },
  'HMC': { name: 'הונדה (ADR)', exchange: 'NYSE' },
  'NMR': { name: 'נומורה (ADR)', exchange: 'NYSE' },
  'MFG': { name: 'מיזוהו (ADR)', exchange: 'NYSE' },
  'IX': { name: 'ORIX (ADR)', exchange: 'NYSE' },
  'SPY': { name: 'S&P 500 ETF', exchange: 'NYSE' },
  'QQQ': { name: 'נאסד״ק 100 ETF', exchange: 'NASDAQ' },
  'EIS': { name: 'MSCI Israel ETF', exchange: 'NYSE' },
  'EWJ': { name: 'MSCI Japan ETF', exchange: 'NYSE' },
  'FXI': { name: 'FTSE China 50 ETF', exchange: 'NYSE' },
  'EWY': { name: 'MSCI Korea ETF', exchange: 'NYSE' },
  'EWI': { name: 'MSCI Italy ETF', exchange: 'NYSE' },
  'EWU': { name: 'MSCI UK ETF', exchange: 'NYSE' },
  'EWZ': { name: 'MSCI Brazil ETF', exchange: 'NYSE' },
  'ARGT': { name: 'MSCI Argentina ETF', exchange: 'NYSE' },
  'BTC-USD': { name: 'ביטקוין', exchange: 'קריפטו' },
  'ETH-USD': { name: 'את׳ריום', exchange: 'קריפטו' },
  'SOL-USD': { name: 'סולאנה', exchange: 'קריפטו' },
  'XRP-USD': { name: 'ריפל', exchange: 'קריפטו' },
  'ADA-USD': { name: 'קארדנו', exchange: 'קריפטו' },
  'DOGE-USD': { name: 'דוג׳', exchange: 'קריפטו' },
  'AVAX-USD': { name: 'אוולנץ׳', exchange: 'קריפטו' },
  'LINK-USD': { name: 'צ׳יינלינק', exchange: 'קריפטו' },
};

const CUR = { ILA: { div: 100, sym: '₪' }, GBp: { div: 100, sym: '£' }, EUR: { div: 1, sym: '€' }, CHF: { div: 1, sym: 'CHF ' }, USD: { div: 1, sym: '$' } };

function pctChg(last, ref) { return ref ? (last / ref - 1) * 100 : null; }

async function fetchOne(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const res = j.chart?.result?.[0];
  if (!res) throw new Error('no result');
  const m = res.meta;
  const q = res.indicators?.quote?.[0] || {};
  const closes = (q.close || []).filter((x) => x != null);
  const highs = (q.high || []).filter((x) => x != null);
  const lows = (q.low || []).filter((x) => x != null);
  const vols = (q.volume || []).filter((x) => x != null);
  const c = CUR[m.currency] || { div: 1, sym: (m.currency || '') + ' ' };
  const last = closes[closes.length - 1] ?? m.regularMarketPrice;
  return {
    name: UNIVERSE[sym].name, exchange: UNIVERSE[sym].exchange, currency: m.currency, cur: c.sym,
    price: last / c.div,
    pct: m.regularMarketChangePercent ?? pctChg(last, closes[closes.length - 2]),
    open: q.open?.[q.open.length - 1] != null ? q.open[q.open.length - 1] / c.div : null,
    high: q.high?.[q.high.length - 1] != null ? q.high[q.high.length - 1] / c.div : null,
    low: q.low?.[q.low.length - 1] != null ? q.low[q.low.length - 1] / c.div : null,
    prevClose: closes.length > 1 ? closes[closes.length - 2] / c.div : null,
    w52h: highs.length ? Math.max(...highs) / c.div : null,
    w52l: lows.length ? Math.min(...lows) / c.div : null,
    vol: vols[vols.length - 1] ?? null,
    avgVol: vols.length ? vols.slice(-60).reduce((a, b) => a + b, 0) / Math.min(vols.length, 60) : null,
    chg1w: pctChg(last, closes[closes.length - 6]),
    chg1m: pctChg(last, closes[closes.length - 22]),
    chg3m: pctChg(last, closes[closes.length - 64]),
    chg12m: pctChg(last, closes[0]),
    at: (m.regularMarketTime || Date.now() / 1000) * 1000,
  };
}

const out = { at: Date.now(), source: 'Yahoo Finance', quotes: {} };
for (const sym of Object.keys(UNIVERSE)) {
  try {
    out.quotes[sym] = await fetchOne(sym);
    console.log('OK', sym, out.quotes[sym].price, out.quotes[sym].cur);
  } catch (e) {
    console.error('FAIL', sym, e.message);
  }
  await new Promise((r) => setTimeout(r, 400));
}
// --- TD intraday FX snapshot (one batched quote call = 5 credits) ---
const TD_KEY = '4c1cab83ac4f4ee190d19c8e11d68859';
const FX_PAIRS = ['USD/ILS', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF'];
try {
  const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(FX_PAIRS.join(','))}&apikey=${TD_KEY}`);
  const j = await r.json();
  const fx = { at: Date.now(), source: 'Twelve Data', quotes: {} };
  for (const sym of FX_PAIRS) {
    const q = j[sym];
    if (q && q.close != null) {
      fx.quotes[sym] = {
        price: parseFloat(q.close),
        prevClose: q.previous_close != null ? parseFloat(q.previous_close) : null,
        pct: q.percent_change != null ? parseFloat(q.percent_change) : null,
        at: ((q.last_quote_at || q.timestamp) ? (q.last_quote_at || q.timestamp) * 1000 : Date.now()),
      };
      console.log('FX OK', sym, fx.quotes[sym].price);
    } else console.error('FX FAIL', sym, JSON.stringify(q).slice(0, 120));
  }
  fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../data/fx.json', import.meta.url), JSON.stringify(fx));
} catch (e) { console.error('FX snapshot failed:', e.message); }

fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../data/quotes.json', import.meta.url), JSON.stringify(out));
console.log('wrote data/quotes.json with', Object.keys(out.quotes).length, 'quotes');
