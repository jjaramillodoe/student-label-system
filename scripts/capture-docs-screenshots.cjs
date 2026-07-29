/**
 * Capture production screenshots for Mintlify docs.
 * Usage: node scripts/capture-docs-screenshots.mjs
 *
 * Optional env:
 *   DOCS_SCREENSHOT_EMAIL / DOCS_SCREENSHOT_PASSWORD — for authenticated pages
 *   BASE_URL — defaults to production
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'https://student-label-system.vercel.app';
const OUT = path.join(__dirname, '../docs/images/screenshots');
const EMAIL = process.env.DOCS_SCREENSHOT_EMAIL || '';
const PASSWORD = process.env.DOCS_SCREENSHOT_PASSWORD || '';

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({
    path: file,
    fullPage: opts.fullPage !== false,
    type: 'png',
  });
  console.log('saved', file);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
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
        console.warn('Archive box still redirects to sign-in — deploy AppHeaderWrapper fix first.');
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

  // ── Public: in-app docs (may require auth depending on deploy) ──
  await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  if (!page.url().includes('/auth/signin')) {
    await shot(page, 'in-app-docs', { fullPage: false });
  } else {
    console.warn('In-app /docs requires sign-in — skipping.');
  }

  // ── Authenticated pages (optional) ───────────────────────────────
  if (EMAIL && PASSWORD) {
    await page.goto(`${BASE}/auth/signin`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(500);

    // Credentials provider fields — try common selectors
    const emailSel = 'input[type="email"], input[name="email"], input#email';
    const passSel = 'input[type="password"], input[name="password"], input#password';
    if (await page.locator(emailSel).count()) {
      await page.fill(emailSel, EMAIL);
      await page.fill(passSel, PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    const captures = [
      { path: '/intake', name: 'intake-form-prod', fullPage: true },
      { path: '/admin/cabinets', name: 'cabinets-page', fullPage: false },
      { path: '/admin/school-year', name: 'school-year-rollover', fullPage: false },
      { path: '/admin/duplicates', name: 'duplicates-page', fullPage: false },
      { path: '/admin/enrollment', name: 'enrollment-dashboard', fullPage: false },
      { path: '/admin/validation', name: 'email-validation', fullPage: false },
      { path: '/admin/students/bulk-upload', name: 'bulk-upload', fullPage: false },
      { path: '/admin/cabinet-health', name: 'cabinet-health', fullPage: false },
      { path: '/admin/print-queue', name: 'avery-label-sheet', fullPage: false },
    ];

    for (const c of captures) {
      try {
        await page.goto(`${BASE}${c.path}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1200);
        if (page.url().includes('/auth/signin')) {
          console.warn('still on sign-in for', c.path, '— skipping');
          continue;
        }
        await shot(page, c.name, { fullPage: c.fullPage });
      } catch (err) {
        console.warn('failed', c.path, err.message);
      }
    }
  } else {
    console.log('\nSkipping authenticated pages. Set DOCS_SCREENSHOT_EMAIL and DOCS_SCREENSHOT_PASSWORD to capture admin/intake screens.');
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
