/**
 * Capture intake duplicate / ASISTS screenshots for Mintlify docs.
 * Reads DOCS_SCREENSHOT_* from .env (no shell source — passwords may contain &/#).
 *
 * Usage:
 *   BASE_URL=https://nycadultedlabels.nyc \
 *   NODE_PATH=./tmp-playwright/node_modules \
 *   node scripts/capture-intake-duplicate-screenshots.cjs
 *
 * Optional:
 *   DOCS_SCREENSHOT_MFA=123456
 *   DOCS_SCREENSHOT_DOB=1979-05-22   (ISO; must match at least one student)
 *   DOCS_SCREENSHOT_FIRST=Javier
 *   DOCS_SCREENSHOT_LAST=DemoSibling
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function loadEnvKeys(file, keys) {
  const out = {};
  if (!fs.existsSync(file)) return out;
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
  'DOCS_SCREENSHOT_DOB',
  'DOCS_SCREENSHOT_FIRST',
  'DOCS_SCREENSHOT_LAST',
  'BASE_URL',
]);

const BASE = (process.env.BASE_URL || env.BASE_URL || 'https://nycadultedlabels.nyc').replace(
  /\/$/,
  '',
);
const OUT = path.join(__dirname, '../docs/images/screenshots');
const EMAIL = process.env.DOCS_SCREENSHOT_EMAIL || env.DOCS_SCREENSHOT_EMAIL || '';
const PASSWORD = process.env.DOCS_SCREENSHOT_PASSWORD || env.DOCS_SCREENSHOT_PASSWORD || '';
const MFA = (process.env.DOCS_SCREENSHOT_MFA || env.DOCS_SCREENSHOT_MFA || '').trim();
const DOB = process.env.DOCS_SCREENSHOT_DOB || env.DOCS_SCREENSHOT_DOB || '1979-05-22';
const FIRST = process.env.DOCS_SCREENSHOT_FIRST || env.DOCS_SCREENSHOT_FIRST || 'Javier';
const LAST = process.env.DOCS_SCREENSHOT_LAST || env.DOCS_SCREENSHOT_LAST || 'DemoSibling';

function isoToUs(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

async function signIn(page) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const emailSel = 'input[type="email"], input[name="email"], input#email';
  await page.waitForSelector(emailSel, { timeout: 20000 });
  await page.fill(emailSel, EMAIL);
  await page.fill('input[type="password"], input[name="password"], input#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const mfaSel = 'input#mfaCode, input[name="mfaCode"]';
  if (await page.locator(mfaSel).count()) {
    if (!MFA) {
      throw new Error('MFA_REQUIRED — set DOCS_SCREENSHOT_MFA to a current 6-digit code');
    }
    await page.fill(mfaSel, MFA);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  if (page.url().includes('/auth/signin')) {
    throw new Error('SIGNIN_FAILED');
  }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Missing DOCS_SCREENSHOT_EMAIL or DOCS_SCREENSHOT_PASSWORD in .env');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  console.log('BASE_URL =', BASE);
  console.log('DOB =', DOB, 'name =', FIRST, LAST);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await signIn(page);

  // ── Admin duplicates page ─────────────────────────────────────────
  try {
    await page.goto(`${BASE}/admin/duplicates`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1500);
    if (!page.url().includes('/auth/signin')) {
      await page.screenshot({
        path: path.join(OUT, 'duplicates-page.png'),
        type: 'png',
        fullPage: false,
      });
      console.log('saved duplicates-page.png');
    }
  } catch (err) {
    console.warn('duplicates-page skipped:', err.message);
  }

  // ── Intake: ASISTS DOB search → match gate ────────────────────────
  await page.goto(`${BASE}/intake`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);

  // Ensure NEW status
  const statusTrigger = page.locator('button[role="combobox"]').first();
  if (await statusTrigger.count()) {
    const label = await statusTrigger.innerText().catch(() => '');
    if (!/NEW/i.test(label)) {
      await statusTrigger.click();
      await page.waitForTimeout(300);
      const opt = page.getByRole('option', { name: /NEW/i }).first();
      if (await opt.count()) await opt.click();
      await page.waitForTimeout(500);
    }
  }

  const assistsInput = page.getByPlaceholder(/Name, DOB|ASISTS|school records/i).first();
  await assistsInput.waitFor({ state: 'visible', timeout: 15000 });
  await assistsInput.fill('');
  await assistsInput.fill(isoToUs(DOB));
  await page.waitForTimeout(800);
  const checkBtn = page.getByRole('button', { name: /Check ASISTS/i }).first();
  if (await checkBtn.count()) await checkBtn.click();
  await page.waitForTimeout(2500);

  // Wait for match UI or not-found
  const matchHeading = page.getByText(/Possible match/i).first();
  const notFound = page.getByText(/No ASISTS|not found/i).first();
  await Promise.race([
    matchHeading.waitFor({ state: 'visible', timeout: 12000 }).catch(() => null),
    notFound.waitFor({ state: 'visible', timeout: 12000 }).catch(() => null),
  ]);

  if (await matchHeading.count()) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const gateCard = page.locator('text=Possible match').locator('xpath=ancestor::div[contains(@class,"border")]').first();
    if (await gateCard.count()) {
      await gateCard.screenshot({ path: path.join(OUT, 'intake-assists-match.png'), type: 'png' });
      console.log('saved intake-assists-match.png');
    } else {
      await page.screenshot({
        path: path.join(OUT, 'intake-assists-match.png'),
        type: 'png',
        fullPage: false,
      });
      console.log('saved intake-assists-match.png (viewport)');
    }

    const different = page.getByLabel(/Not the same person sitting here/i).first();
    if (await different.count()) {
      await different.check({ force: true }).catch(async () => {
        await page.locator('#assistsDifferentPerson').check({ force: true });
      });
      await page.waitForTimeout(1000);
    }
  } else {
    console.warn('No ASISTS match for DOB — trying not-found unlock path');
    const ack = page.getByLabel(/I checked ASISTS/i).first();
    if (await ack.count()) {
      await ack.check({ force: true });
      await page.waitForTimeout(800);
    }
  }

  // Personal info should be unlocked — fill identity to surface duplicate panel
  const first = page.locator('#firstName');
  const last = page.locator('#lastName');
  const dob = page.locator('#dob');
  await first.waitFor({ state: 'visible', timeout: 15000 });
  await first.fill(FIRST);
  await last.fill(LAST);
  await dob.fill(DOB);
  await page.waitForTimeout(2000);

  // Ensure sibling flag checked if panel present
  const sibling = page.locator('#siblingFlag');
  if (await sibling.count()) {
    const checked = await sibling.isChecked().catch(() => false);
    if (!checked) await sibling.check({ force: true }).catch(() => null);
    await page.waitForTimeout(400);
  }

  // Prefer cropping the duplicate panel; fall back to personal-info region
  const panel = page.locator('text=/Flagged as different person|Possible existing student/i').first();
  if (await panel.count()) {
    await panel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const box = page
      .locator('text=/Flagged as different person|Possible existing student/i')
      .locator('xpath=ancestor::div[contains(@class,"border-2") or contains(@class,"rounded-lg")]')
      .first();
    if (await box.count()) {
      await box.screenshot({ path: path.join(OUT, 'intake-duplicates.png'), type: 'png' });
      console.log('saved intake-duplicates.png (panel)');
    } else {
      await page.screenshot({
        path: path.join(OUT, 'intake-duplicates.png'),
        type: 'png',
        fullPage: false,
      });
      console.log('saved intake-duplicates.png (viewport)');
    }
  } else {
    console.warn('Duplicate panel not visible — saving Personal Information region');
    const personal = page.getByText('Personal Information').first();
    if (await personal.count()) {
      await personal.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.screenshot({
      path: path.join(OUT, 'intake-duplicates.png'),
      type: 'png',
      fullPage: false,
    });
    console.log('saved intake-duplicates.png (fallback)');
  }

  // Full intake form after unlock (refresh main form shot)
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, 'intake-form.png'),
      type: 'png',
      fullPage: true,
    });
    console.log('saved intake-form.png');
  } catch (err) {
    console.warn('intake-form skipped:', err.message);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
