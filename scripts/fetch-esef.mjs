// Fetches latest ESEF filings (official EU XBRL reports) per company from
// filings.xbrl.org (XBRL International) with LEIs resolved via GLEIF (official LEI registry).
import fs from 'node:fs';

const COMPANIES = [
  { key: 'ASML.AS', name: 'ASML Holding', display: 'ASML', country: 'הולנד' },
  { key: 'SAP.DE', name: 'SAP SE', display: 'SAP', country: 'גרמניה' },
  { key: 'MC.PA', name: 'LVMH', display: 'LVMH', country: 'צרפת' },
  { key: 'SAN.PA', name: 'Sanofi', display: 'סנופי', country: 'צרפת' },
  { key: 'NESN.SW', name: 'Nestlé', display: 'נסטלה', country: 'שוויץ' },
  { key: 'SHEL.L', name: 'Shell plc', display: 'של', country: 'בריטניה' },
  { key: 'AZN.L', name: 'AstraZeneca', display: 'אסטרהזנקה', country: 'בריטניה' },
  { key: 'ENEL.MI', name: 'Enel', display: 'אנל', country: 'איטליה' },
];

async function j(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'hedge-os-app (educational; contact: github hedge-os-app)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

const out = { at: Date.now(), source: 'ESEF (filings.xbrl.org) + GLEIF', companies: {} };
for (const c of COMPANIES) {
  try {
    const g = await j(`https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalName%5D=${encodeURIComponent(c.name)}&page%5Bsize%5D=1`);
    const lei = g?.data?.[0]?.id || null;
    let f = null;
    if (lei) {
      try { f = await j(`https://filings.xbrl.org/api/entities/${lei}/filings?page%5Bsize%5D=6`); } catch { f = null; }
    }
    const seen = new Set();
    const filings = (f?.data || []).map((x) => x.attributes)
      .filter((a) => a.package_url)
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || '') || (b.date_added || '').localeCompare(a.date_added || ''))
      .filter((a) => { if (seen.has(a.period_end)) return false; seen.add(a.period_end); return true; })
      .slice(0, 4)
      .map((a) => ({ period: a.period_end, published: a.published, country: a.country, url: `https://filings.xbrl.org${a.package_url}`, viewer: a.viewer_url || null }));
    out.companies[c.key] = { display: c.display, country: c.country, lei, filings };
    console.log('OK', c.display, lei, filings.length, 'filings, latest', filings[0]?.period);
  } catch (e) { console.error('FAIL', c.name, e.message); out.companies[c.key] = { display: c.display, country: c.country, lei: null, filings: [] }; }
  await new Promise((r) => setTimeout(r, 300));
}
fs.writeFileSync(new URL('../data/esef.json', import.meta.url), JSON.stringify(out));
console.log('wrote data/esef.json');
