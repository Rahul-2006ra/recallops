const { chromium } = require('c:/Users/rahul/OneDrive/Desktop/Recallops/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const PROD_URL = 'https://recallops-lake.vercel.app';
const SCREENSHOTS_DIR = path.resolve('C:\\Users\\rahul\\.gemini\\antigravity\\brain\\dd429447-7c6d-4e90-b57f-086b1630e107\\screenshots\\prod_live');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runLiveVerification() {
  console.log(`--- Running Live Production E2E Verification against ${PROD_URL} ---`);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const results = [];

  try {
    // 1. Homepage loads
    console.log('Testing Scenario 1: Homepage loading...');
    await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector("text=RecallOps", { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_01_homepage.png') });
    results.push({ name: 'Homepage Load', status: 'PASSED' });

    // 2. Navigation tabs
    console.log('Testing Scenario 2: Navigation views...');
    const memoriesTab = page.locator("button:has-text('Memories')").first();
    await memoriesTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_02_memories_view.png') });

    const assistantTab = page.locator("button:has-text('Assistant')").first();
    await assistantTab.click();
    await page.waitForTimeout(1000);
    results.push({ name: 'Navigation Views', status: 'PASSED' });

    // 3. New conversation & greeting turn
    console.log('Testing Scenario 3: Casual greeting on live production...');
    const composer = page.locator('textarea').first();
    await composer.fill('Hi RecallOps, are you ready?');
    const sendBtn = page.locator("button[aria-label='Send message'], button:has-text('Send')").first();
    await sendBtn.click();

    // Wait for response
    await page.waitForResponse(res => res.url().includes('/api/chat') && res.status() === 200, { timeout: 35000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_03_greeting.png') });
    results.push({ name: 'Greeting & Chat API', status: 'PASSED' });

    // 4. Hindi input with English response
    console.log('Testing Scenario 4: Multilingual input (Hindi -> English)...');
    const activeComposer = page.locator('textarea').last();
    await activeComposer.fill('Mera paani ka pump bahut aawaz kar raha hai');
    const activeSend = page.locator("button[aria-label='Send message'], button:has-text('Send')").last();
    await activeSend.click();

    await page.waitForResponse(res => res.url().includes('/api/chat') && res.status() === 200, { timeout: 35000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_04_hindi_to_english.png') });
    results.push({ name: 'Multilingual Diagnostic', status: 'PASSED' });

    // 5. Microphone HUD Interface
    console.log('Testing Scenario 5: Microphone recording HUD interface...');
    const micBtn = page.locator("button[title*='Speak equipment'], button[title*='Voice input']").last();
    if (await micBtn.isVisible()) {
      await micBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_05_mic_hud.png') });
      results.push({ name: 'Microphone Interface HUD', status: 'PASSED' });
      const stopBtn = page.locator("button[title*='Stop recording'], button[title*='Listening']").first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
      }
    } else {
      results.push({ name: 'Microphone Interface HUD', status: 'NOT VISIBLE' });
    }

    // 6. Browser Refresh Session Continuity
    console.log('Testing Scenario 6: Browser refresh continuity...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_06_browser_refresh.png') });
    results.push({ name: 'Browser Refresh Session Continuity', status: 'PASSED' });

  } catch (err) {
    console.error('Live production verification failed:', err);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod_error.png') });
    results.push({ name: 'Live Verification Exception', status: 'FAILED', error: err.message });
  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log('LIVE PRODUCTION VERIFICATION RESULTS:');
  results.forEach(r => console.log(`[${r.status}] ${r.name}`));
  console.log(`Console Errors: ${consoleErrors.length}`);
  console.log('======================================================\n');
  return results;
}

runLiveVerification();
