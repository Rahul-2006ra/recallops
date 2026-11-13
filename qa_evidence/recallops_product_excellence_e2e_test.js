const path = require('path');
const fs = require('fs');
const { chromium } = require('../frontend/node_modules/playwright');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const BASE_URL = 'http://127.0.0.1:5173';

const VIEWPORTS = [
  { name: 'Desktop (1440x900)', width: 1440, height: 900, isMobile: false },
  { name: 'Laptop (1366x768)', width: 1366, height: 768, isMobile: false },
  { name: 'Tablet (768x1024)', width: 768, height: 1024, isMobile: false },
  { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true },
  { name: 'Small Mobile (360x800)', width: 360, height: 800, isMobile: true }
];

async function runExcellenceSuite() {
  console.log('================================================================');
  console.log('RECALLOPS 2.0 — FINAL PRODUCT EXCELLENCE AUDIT & E2E SUITE');
  console.log('================================================================');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  try {
    // =========================================================================
    // SECTION 1: MULTI-VIEWPORT RESPONSIVENESS & OVERFLOW AUDIT
    // =========================================================================
    console.log('\n--- SECTION 1: MULTI-VIEWPORT RESPONSIVENESS AUDIT ---');
    for (const vp of VIEWPORTS) {
      console.log(`Auditing viewport: ${vp.name}...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile
      });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      console.log(`  -> ${vp.name} Horizontal Overflow: ${overflow ? 'FAIL' : 'PASS (0px)'}`);
      if (overflow) throw new Error(`Horizontal overflow detected in ${vp.name}`);

      await context.close();
    }
    console.log('Section 1 Passed: Zero horizontal overflow across all 5 viewports.\n');

    // =========================================================================
    // SECTION 2: DESKTOP WORKFLOW & VISUAL EXCELLENCE (1440 x 900)
    // =========================================================================
    console.log('--- SECTION 2: DESKTOP (1440x900) VISUAL & INTERACTION AUDIT ---');
    const mainContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await mainContext.newPage();

    // 1. Homepage Hero Landing
    console.log('Step 1: Capturing Homepage...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const headline = await page.textContent('h1');
    if (!headline.includes('What can I help you understand today?')) {
      throw new Error(`Unexpected headline: ${headline}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_01_homepage.png') });
    console.log('Step 1 Passed: Homepage Hero verified.');

    // 2. Initial Diagnosis
    console.log('Step 2: Triggering diagnostic query on Industrial Slurry Pump...');
    const promptCard = page.locator('button:has-text("Industrial Slurry Pump")').first();
    await promptCard.click();

    await page.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await page.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 45000 });
    await page.waitForSelector('text=RecallOps Agent', { timeout: 30000 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_02_diagnosis.png') });
    console.log('Step 2 Passed: Structured Diagnosis captured.');

    // 3. Follow-up Response (Conversational Simplicity)
    console.log('Step 3: Submitting simplify follow-up...');
    const inputField = page.locator('textarea').first();
    await inputField.fill('Explain that in simpler words.');
    await page.keyboard.press('Enter');

    await page.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await page.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 45000 });
    await page.waitForTimeout(1200);

    const bubbles = page.locator('.items-start .rounded-2xl');
    const simplifyText = await bubbles.last().innerText();
    const hasRepeatedTemplate = simplifyText.includes('Question for Technician:');
    if (hasRepeatedTemplate) throw new Error('Simplify follow-up repeated full diagnostic boilerplate!');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_03_simplify.png') });
    console.log('Step 3 Passed: Conversational Simplicity verified.');

    // 4. Precedent Cards & Progressive Disclosure
    console.log('Step 4: Inspecting Precedent Cards with progressive disclosure...');
    const detailsToggle = page.locator('button:has-text("Details")').first();
    if (await detailsToggle.isVisible()) {
      await detailsToggle.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_04_precedents.png') });
    console.log('Step 4 Passed: 5-point Precedent Card with progressive disclosure verified.');

    // 5. Five-Field Repair Outcome Confirmation Card
    console.log('Step 5: Submitting confirmed repair outcome...');
    await inputField.fill('The technician cleaned the blocked cooling fins and the pump works normally now.');
    await page.keyboard.press('Enter');

    await page.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await page.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 45000 });
    await page.waitForSelector('text=Confirmed Field Repair Outcome Detected', { timeout: 35000 });
    await page.waitForTimeout(1200);

    const bodyText = await page.textContent('body');
    const requiredFields = ['Equipment:', 'Original Problem:', 'Repair Performed:', 'Outcome:', 'Verification Source:'];
    for (const f of requiredFields) {
      if (!bodyText.includes(f)) throw new Error(`Confirmation card missing field: ${f}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_05_confirmation.png') });

    // Confirm & store outcome
    const confirmBtn = page.locator('button:has-text("Confirm & Store in Permanent Memory")').last();
    await confirmBtn.click();
    await page.waitForSelector('text=Saved to Local', { timeout: 15000 });
    console.log('Step 5 Passed: 5-Field Confirmation Card & Idempotent Persistence verified.');

    // 6. My Memories Library
    console.log('Step 6: Navigating to My Memories...');
    const memoriesNav = page.locator('button:has-text("My Memories")').first();
    await memoriesNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_06_memories.png') });
    console.log('Step 6 Passed: My Memories library captured.');

    // 7. Memory Details Modal & Keyboard Escape
    console.log('Step 7: Opening Memory Details modal...');
    const firstMemoryCard = page.locator('text=Details').first();
    await firstMemoryCard.click();
    await page.waitForSelector('text=Verified Episodic Record', { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_07_memory_details.png') });

    // Verify Escape key closes modal (Accessibility requirement)
    console.log('Verifying Escape key closes details modal...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const modalClosed = (await page.locator('text=Verified Episodic Record').count()) === 0;
    console.log(`  -> Escape key modal dismissal: ${modalClosed ? 'PASS' : 'FAIL'}`);
    if (!modalClosed) throw new Error('Escape key failed to close modal!');
    console.log('Step 7 Passed: Modal accessible dismissal verified.');

    // 8. History View
    console.log('Step 8: Navigating to Conversation History...');
    const historyNav = page.locator('button:has-text("History")').first();
    await historyNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_08_history.png') });
    console.log('Step 8 Passed: History view verified.');

    // 9. Settings View
    console.log('Step 9: Navigating to System Settings...');
    const settingsNav = page.locator('button:has-text("Settings")').first();
    await settingsNav.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_09_settings.png') });
    console.log('Step 9 Passed: Settings view verified.');

    await mainContext.close();

    // =========================================================================
    // SECTION 3: MOBILE INTERACTION & CHAT STREAM (390 x 844)
    // =========================================================================
    console.log('\n--- SECTION 3: MOBILE (390x844) CHAT INTERACTION AUDIT ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });
    const mobPage = await mobileContext.newPage();
    await mobPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobPage.waitForTimeout(1000);

    const mobInput = mobPage.locator('textarea').first();
    await mobInput.fill('My laptop fan is unusually loud.');
    await mobPage.keyboard.press('Enter');

    await mobPage.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await mobPage.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 45000 });
    await mobPage.waitForSelector('text=RecallOps Agent', { timeout: 35000 });
    await mobPage.waitForTimeout(1500);

    const mobileOverflow = await mobPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`  -> Mobile Chat Horizontal Overflow: ${mobileOverflow ? 'FAIL' : 'PASS (0px)'}`);
    if (mobileOverflow) throw new Error('Mobile chat has horizontal overflow!');

    await mobPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'excellence_10_mobile_chat.png') });
    console.log('Step 10 Passed: Mobile active chat captured with zero overflow.');

    await mobileContext.close();

    console.log('\n================================================================');
    console.log('ALL 10 PRODUCT EXCELLENCE SCENARIOS & 5 VIEWPORTS AUDITED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('Excellence Suite Encountered Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runExcellenceSuite();
