/**
 * Capture newer docs screenshots (Legacy MDB tab, Security).
 * Usage:
 *   export BASE_URL=https://nycadultedlabels.nyc
 *   # load DOCS_SCREENSHOT_* from .env without printing secrets
 *   PLAYWRIGHT_BROWSERS_PATH=0 NODE_PATH=./tmp-playwright/node_modules \
 *     node scripts/capture-docs-new-screenshots.cjs
 *
 * Optional: DOCS_SCREENSHOT_MFA=123456 when MFA is required.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

const BASE = (process.env.BASE_URL || 'https://nycadultedlabels.nyc').replace(/\/$/, '');
const OUT = path.join(__dirname, '../docs/images/screenshots');
const EMAIL = process.env.DOCS_SCREENSHOT_EMAIL || '';
const PASSWORD = process.env.DOCS_SCREENSHOT_PASSWORD || '';
const MFA = (process.env.DOCS_SCREENSHOT_MFA || '').trim();

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({
    path: file,
    fullPage: opts.fullPage === true,
    type: 'png',
  });
  console.log('saved', file);
}

async function signIn(page) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(500);
  const emailSel = 'input[type="email"], input[name="email"], input#email';
  const passSel = 'input[type="password"], input[name="password"], input#password';
  await page.fill(emailSel, EMAIL);
  await page.fill(passSel, PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const mfaSel = 'input#mfaCode, input[name="mfaCode"]';
  if (await page.locator(mfaSel).count()) {
    if (!MFA) {
      throw new Error('MFA required — set DOCS_SCREENSHOT_MFA to a current 6-digit code');
    }
    await page.fill(mfaSel, MFA);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  if (page.url().includes('/auth/signin')) {
    throw new Error('Still on sign-in after credentials (check password/MFA)');
  }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set DOCS_SCREENSHOT_EMAIL and DOCS_SCREENSHOT_PASSWORD');
  }

  fs.mkdirSync(OUT, { recursive: true });
  console.log('BASE_URL =', BASE);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await signIn(page);

  // Live duplicates (refresh — should show two tabs)
  await page.goto(`${BASE}/admin/duplicates`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1600);
  if (!page.url().includes('/auth/signin')) {
    await shot(page, 'duplicates-page');
  }

  // Legacy MDB tab
  await page.goto(`${BASE}/admin/duplicates?tab=legacy`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(2200);
  if (!page.url().includes('/auth/signin')) {
    const legacyTab = page.getByRole('tab', { name: /Legacy MDB/i });
    if (await legacyTab.count()) {
      await legacyTab.click().catch(() => null);
      await page.waitForTimeout(800);
    }
    // Wait for scan or empty state
    await page.getByText(/Garbage|Roster rows|Scanning|Legacy MDB|Upload \/ replace/i)
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => null);
    await page.waitForTimeout(1200);
    await shot(page, 'duplicates-legacy-mdb');
  }

  // Admin Security
  await page.goto(`${BASE}/admin/security`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1600);
  if (!page.url().includes('/auth/signin')) {
    await shot(page, 'admin-security');
  } else {
    console.warn('Security page redirected to sign-in (need Admin role)');
  }

  // School settings — try to show legacy roster card if present
  await page.goto(`${BASE}/admin/schools`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1400);
  if (!page.url().includes('/auth/signin')) {
    const legacyHeading = page.getByText(/legacy roster|ASISTS/i).first();
    if (await legacyHeading.count()) {
      await legacyHeading.scrollIntoViewIfNeeded().catch(() => null);
      await page.waitForTimeout(400);
    }
    await shot(page, 'admin-school-settings');
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
