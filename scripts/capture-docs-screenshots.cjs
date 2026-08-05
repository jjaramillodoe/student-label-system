/**
 * Capture production screenshots for Mintlify docs.
 * Usage:
 *   set -a && source .env && set +a
 *   BASE_URL=https://nycadultedlabels.nyc NODE_PATH=./tmp-playwright/node_modules \
 *     node scripts/capture-docs-screenshots.cjs
 *
 * Optional env:
 *   DOCS_SCREENSHOT_EMAIL / DOCS_SCREENSHOT_PASSWORD — authenticated pages
 *   DOCS_SCREENSHOT_MFA — 6-digit code if MFA is required
 *   BASE_URL — defaults to https://nycadultedlabels.nyc
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = (process.env.BASE_URL || 'https://nycadultedlabels.nyc').replace(/\/$/, '');
const OUT = path.join(__dirname, '../docs/images/screenshots');
const EMAIL = process.env.DOCS_SCREENSHOT_EMAIL || '';
const PASSWORD = process.env.DOCS_SCREENSHOT_PASSWORD || '';
const MFA = (process.env.DOCS_SCREENSHOT_MFA || '').trim();

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({
    path: file,
    fullPage: opts.fullPage !== false,
    type: 'png',
  });
  console.log('saved', file);
}

async function signIn(page) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(500);

  const emailSel = 'input[type="email"], input[name="email"], input#email';
  const passSel = 'input[type="password"], input[name="password"], input#password';
  if (!(await page.locator(emailSel).count())) {
    throw new Error('Sign-in email field not found');
  }
  await page.fill(emailSel, EMAIL);
  await page.fill(passSel, PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // MFA step if shown
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
  fs.mkdirSync(OUT, { recursive: true });
  console.log('BASE_URL =', BASE);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // ── Public: sign-in ──────────────────────────────────────────────
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, 'sign-in', { fullPage: false });

  // ── Public: student + archive (known production Label ID) ──────
  await page.goto(`${BASE}/student/2005-IB-0000014`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  const studentNotFound = await page.getByText(/not found|Student not found/i).count();
  if (studentNotFound === 0) {
    await shot(page, 'public-student-page');
    const boxHref = await page.locator('a[href*="/archive/box/"]').first().getAttribute('href').catch(() => null);
    if (boxHref) {
      const boxUrl = boxHref.startsWith('http') ? boxHref : `${BASE}${boxHref}`;
      await page.goto(boxUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      if (!page.url().includes('/auth/signin')) {
        await shot(page, 'public-archive-box');
        const labelUrl = boxUrl.replace(/\/?$/, '') + '/label';
        await page.goto(labelUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
        await page.waitForTimeout(800);
        if (!page.url().includes('/auth/signin')) {
          await shot(page, 'archive-box-label');
        }
      } else {
        console.warn('Archive box still redirects to sign-in — skipping.');
      }
    }
  } else {
    console.warn('student page not found for 2005-IB-0000014 — trying fallbacks');
    for (const id of ['2000-06-12-000001', '1979-JJ-0000001']) {
      await page.goto(`${BASE}/student/${id}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(800);
      if ((await page.getByText(/not found/i).count()) === 0) {
        await shot(page, 'public-student-page');
        break;
      }
    }
  }

  // ── Authenticated pages (optional) ───────────────────────────────
  if (EMAIL && PASSWORD) {
    try {
      await signIn(page);
    } catch (err) {
      console.warn('Sign-in failed:', err.message);
      await browser.close();
      process.exitCode = 1;
      return;
    }

    const captures = [
      { path: '/', name: 'app-shell-sidebar', fullPage: false },
      { path: '/', name: 'dashboard', fullPage: false },
      { path: '/intake', name: 'intake-form', fullPage: true },
      { path: '/intake', name: 'intake-translate-tip', fullPage: false },
      { path: '/admin/cabinets', name: 'cabinets-page', fullPage: false },
      { path: '/admin/label-stock', name: 'label-stock', fullPage: false },
      { path: '/admin/school-year', name: 'school-year-rollover', fullPage: false },
      { path: '/admin/duplicates', name: 'duplicates-page', fullPage: false },
      { path: '/admin/enrollment', name: 'enrollment-dashboard', fullPage: false },
      { path: '/admin/validation', name: 'email-validation', fullPage: false },
      { path: '/admin/students/bulk-upload', name: 'bulk-upload', fullPage: false },
      { path: '/admin/students/all', name: 'admin-all-students', fullPage: false },
      { path: '/admin/cabinet-health', name: 'cabinet-health', fullPage: false },
      { path: '/admin/print-queue', name: 'avery-label-sheet', fullPage: false },
      { path: '/admin/schools', name: 'admin-school-settings', fullPage: false },
    ];

    for (const c of captures) {
      try {
        await page.goto(`${BASE}${c.path}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1400);
        if (page.url().includes('/auth/signin')) {
          console.warn('still on sign-in for', c.path, '— skipping');
          continue;
        }
        if (c.name === 'intake-translate-tip') {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(400);
          await page.screenshot({
            path: path.join(OUT, 'intake-translate-tip.png'),
            type: 'png',
            clip: { x: 0, y: 0, width: 1400, height: 720 },
          });
          console.log('saved', path.join(OUT, 'intake-translate-tip.png'));
          continue;
        }
        // Prefer viewport shot that shows the left sidebar for shell pages
        if (c.name === 'app-shell-sidebar' || c.name === 'dashboard') {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(300);
          await shot(page, c.name, { fullPage: false });
          continue;
        }
        await shot(page, c.name, { fullPage: c.fullPage });
      } catch (err) {
        console.warn('failed', c.path, err.message);
      }
    }

    // Add Cabinet modal — Custom capacity (docs: cabinets-and-drawers)
    try {
      await page.goto(`${BASE}/admin/cabinets`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      if (!page.url().includes('/auth/signin')) {
        const addBtn = page.getByRole('button', { name: /Add Cabinet/i }).first();
        if (await addBtn.count()) {
          await addBtn.click();
          await page.waitForTimeout(600);
          const dialog = page.getByRole('dialog');
          await dialog.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
          // Open capacity select and choose Custom…
          const capacityTrigger = dialog.locator('#drawer-capacity-0').first();
          if (await capacityTrigger.count()) {
            await capacityTrigger.click();
            await page.waitForTimeout(300);
            const customOpt = page.getByRole('option', { name: /Custom/i }).first();
            if (await customOpt.count()) {
              await customOpt.click();
              await page.waitForTimeout(400);
              const customInput = dialog.locator('#drawer-capacity-custom-0');
              if (await customInput.count()) {
                await customInput.fill('250');
                await page.waitForTimeout(300);
              }
            }
          }
          await page.screenshot({
            path: path.join(OUT, 'cabinets-add-custom-capacity.png'),
            type: 'png',
            fullPage: false,
          });
          console.log('saved', path.join(OUT, 'cabinets-add-custom-capacity.png'));
          await page.keyboard.press('Escape').catch(() => null);
        } else {
          console.warn('Add Cabinet button not found — skipping custom capacity shot');
        }
      }
    } catch (err) {
      console.warn('cabinets custom capacity capture skipped:', err.message);
    }

    // School portal sign-in badge (optional)
    try {
      await context.clearCookies();
      await page.goto('https://school1.nycadultedlabels.nyc/auth/signin', {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      await page.waitForTimeout(900);
      await shot(page, 'sign-in-school-portal', { fullPage: false });
    } catch (err) {
      console.warn('school portal sign-in capture skipped:', err.message);
    }
  } else {
    console.log('\nSkipping authenticated pages. Set DOCS_SCREENSHOT_EMAIL and DOCS_SCREENSHOT_PASSWORD.');
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
