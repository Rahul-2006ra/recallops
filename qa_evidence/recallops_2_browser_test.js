const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  console.log(`Starting RecallOps 2.0 Playwright E2E Test on ${BASE_URL}...`);
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const testResults = {
    stepsPassed: 0,
    stepsTotal: 6,
    screenshots: [],
  };

  try {
    // 1. Load Homepage / AI Assistant
    console.log('Step 1: Loading AI Assistant...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const screenInit = path.join(SCREENSHOT_DIR, 'debug_initial.png');
    await page.screenshot({ path: screenInit });
    console.log('Current URL:', page.url());
    console.log('Page Title:', await page.title());

    // Check if New Chat button exists or wait for header
    const newChatBtn = page.locator('button:has-text("New Chat")');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(500);
    }

    await page.waitForSelector('text=What can I help you understand today?', { timeout: 15000 });
    const screen1 = path.join(SCREENSHOT_DIR, '2.0_01_assistant_landing.png');
    await page.screenshot({ path: screen1 });
    testResults.screenshots.push(screen1);
    testResults.stepsPassed++;
    console.log('Step 1 Passed: AI Assistant landing page verified.');

    // 2. Click an example prompt
    console.log('Step 2: Submitting troubleshooting prompt...');
    const exampleButton = page.locator('text=Industrial Slurry Pump').first();
    await exampleButton.click();

    // Wait for response bubble
    await page.waitForSelector('text=Historical Precedents', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify markdown rendered properly without raw '**' in assistant text
    const assistantText = await page.locator('div[class*="bg-slate-900"]').first().innerText();
    if (assistantText.includes('**')) {
      throw new Error(`Raw Markdown asterisks detected in assistant message: ${assistantText}`);
    }

    const screen2 = path.join(SCREENSHOT_DIR, '2.0_02_assistant_response.png');
    await page.screenshot({ path: screen2 });
    testResults.screenshots.push(screen2);
    testResults.stepsPassed++;
    console.log('Step 2 Passed: Structured troubleshooting response generated without raw asterisks.');

    // 3. Navigate to My Memories
    console.log('Step 3: Navigating to My Memories...');
    await page.click('button:has-text("My Memories")');
    await page.waitForSelector('text=Episodic Memory Bank', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const screen3 = path.join(SCREENSHOT_DIR, '2.0_03_memories_view.png');
    await page.screenshot({ path: screen3 });
    testResults.screenshots.push(screen3);
    testResults.stepsPassed++;
    console.log('Step 3 Passed: My Memories bank loaded successfully.');

    // 4. Inspect a memory record
    console.log('Step 4: Inspecting memory record details...');
    const firstCard = page.locator('div[class*="rounded-xl bg-slate-900"]').first();
    await firstCard.click();
    await page.waitForSelector('text=Verified Episodic Record', { timeout: 5000 });
    const screen4 = path.join(SCREENSHOT_DIR, '2.0_04_memory_modal.png');
    await page.screenshot({ path: screen4 });
    testResults.screenshots.push(screen4);
    await page.click('button:has-text("Close")');
    testResults.stepsPassed++;
    console.log('Step 4 Passed: Memory inspection modal verified.');

    // 5. Navigate to History
    console.log('Step 5: Checking History...');
    await page.click('button:has-text("History")');
    await page.waitForSelector('text=Troubleshooting History', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const screen5 = path.join(SCREENSHOT_DIR, '2.0_05_history_view.png');
    await page.screenshot({ path: screen5 });
    testResults.screenshots.push(screen5);
    testResults.stepsPassed++;
    console.log('Step 5 Passed: Conversation history rendered properly.');

    // 6. Navigate to Settings
    console.log('Step 6: Checking Settings...');
    await page.click('button:has-text("Settings")');
    await page.waitForSelector('text=Hindsight Cloud Credit Conservation', { timeout: 10000 });
    const screen6 = path.join(SCREENSHOT_DIR, '2.0_06_settings_view.png');
    await page.screenshot({ path: screen6 });
    testResults.screenshots.push(screen6);
    testResults.stepsPassed++;
    console.log('Step 6 Passed: System settings and credit conservation active.');

    console.log('\n=== ALL 6 BROWSER TESTS PASSED SUCCESSFULLY! ===');
    console.log(`Passed: ${testResults.stepsPassed}/${testResults.stepsTotal}`);
  } catch (err) {
    console.error('Playwright Test Failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
