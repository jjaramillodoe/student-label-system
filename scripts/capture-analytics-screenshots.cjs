/**
 * Capture Analytics + MotherDuck screenshots for Mintlify docs.
 * Reads DOCS_SCREENSHOT_* from .env without shell-sourcing the whole file.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function loadEnvKeys(file, keys) {
  const out = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    if (!keys.includes(k)) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const envPath = path.join(__dirname, '../.env');
const env = loadEnvKeys(envPath, [
  'DOCS_SCREENSHOT_EMAIL',
  'DOCS_SCREENSHOT_PASSWORD',
  'DOCS_SCREENSHOT_MFA',
  'BASE_URL',
]);

const BASE = (process.env.BASE_URL || env.BASE_URL || 'https://nycadultedlabels.nyc').replace(
  /\/$/,
  '',
);
const OUT = path.join(__dirname, '../docs/images/screenshots');
const EMAIL = env.DOCS_SCREENSHOT_EMAIL || '';
const PASSWORD = env.DOCS_SCREENSHOT_PASSWORD || '';
const MFA = (env.DOCS_SCREENSHOT_MFA || process.env.DOCS_SCREENSHOT_MFA || '').trim();

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Missing DOCS_SCREENSHOT_EMAIL or DOCS_SCREENSHOT_PASSWORD in .env');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  console.log('BASE_URL =', BASE);
  console.log('email configured =', Boolean(EMAIL));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"], input[name="email"], input#email', EMAIL);
  await page.fill('input[type="password"], input[name="password"], input#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const mfaSel = 'input#mfaCode, input[name="mfaCode"]';
  if (await page.locator(mfaSel).count()) {
    if (!MFA) {
      console.error('MFA_REQUIRED — set DOCS_SCREENSHOT_MFA to a current 6-digit code');
      await browser.close();
      process.exit(2);
    }
    await page.fill(mfaSel, MFA);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  if (page.url().includes('/auth/signin')) {
    console.error('SIGNIN_FAILED');
    await browser.close();
    process.exit(1);
  }
  console.log('signed in');

  for (const c of [
    { path: '/admin/analytics', name: 'analytics-dashboard' },
    { path: '/admin/motherduck-analytics', name: 'motherduck-analytics' },
  ]) {
    await page.goto(`${BASE}${c.path}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2200);
    if (page.url().includes('/auth/signin')) {
      console.warn('skip', c.path, '(redirected to sign-in)');
      continue;
    }
    const file = path.join(OUT, `${c.name}.png`);
    await page.screenshot({ path: file, fullPage: true, type: 'png' });
    console.log('saved', file);
  }

  await browser.close();
  console.log('done');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
