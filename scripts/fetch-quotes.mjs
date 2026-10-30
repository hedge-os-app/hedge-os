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
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../data/quotes.json', import.meta.url), JSON.stringify(out));
console.log('wrote data/quotes.json with', Object.keys(out.quotes).length, 'quotes');
