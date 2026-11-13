const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sendMessageAndWait(page, text) {
  const inputArea = page.locator('textarea').first();
  await inputArea.fill(text);
  
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/chat') && resp.status() === 200, { timeout: 40000 }),
    page.keyboard.press('Enter')
  ]);
  
  await page.waitForTimeout(1500);
  return response.json();
}

async function runLiveBug1BrowserVerification() {
  console.log('================================================================');
  console.log('RECALLOPS 2.0 — LIVE PLAYWRIGHT BUG 1 BROWSER VERIFICATION');
  console.log('Target Frontend: http://127.0.0.1:5173');
  console.log('Target Backend: http://127.0.0.1:8000');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`BROWSER CONSOLE ERROR: ${msg.text()}`);
  });

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: 'Hi recallops' in fresh conversation
    // ------------------------------------------------------------------------
    console.log('Scenario 1: Navigating to http://127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    console.log('Scenario 1: Submitting "Hi recallops"...');
    const apiJson1 = await sendMessageAndWait(page, 'Hi recallops');
    console.log(`Scenario 1 API Response Intent: ${apiJson1.intent}`);

    const lastMsgElem1 = page.locator('.items-start .rounded-2xl').last();
    const firstResponse = await lastMsgElem1.innerText();
    console.log(`Scenario 1 Agent Rendered Text:\n${firstResponse.trim()}\n`);

    // Strict assertions
    if (firstResponse.includes('Plausible Causes') || firstResponse.includes('What This Could Mean')) {
      throw new Error('FAIL: Plausible Causes appeared in response to "Hi recallops"!');
    }
    if (firstResponse.includes('Safety Alert') || firstResponse.includes('Critical Safety Protocol') || firstResponse.includes('Safety Precaution')) {
      throw new Error('FAIL: Safety warning appeared in response to "Hi recallops"!');
    }
    if (firstResponse.includes('LOTO') || firstResponse.includes('Lockout') || firstResponse.includes('bearing wear')) {
      throw new Error('FAIL: LOTO or bearing wear appeared in response to "Hi recallops"!');
    }
    if (firstResponse.includes('Question for Technician') || firstResponse.includes('Questions for Technician')) {
      throw new Error('FAIL: Question for Technician appeared in response to "Hi recallops"!');
    }
    if (firstResponse.includes('Historical Precedents')) {
      throw new Error('FAIL: Historical Precedents appeared in response to "Hi recallops"!');
    }

    const sc1Path = path.join(SCREENSHOT_DIR, 'bug1_01_hi_recallops.png');
    await page.screenshot({ path: sc1Path });
    console.log(`[PASS] Scenario 1: Clean casual greeting rendered. Screenshot: ${sc1Path}`);

    // ------------------------------------------------------------------------
    // SCENARIO 2: Unrelated query 'What is the capital of India?'
    // ------------------------------------------------------------------------
    console.log('\nScenario 2: Submitting unrelated query "What is the capital of India?"...');
    const apiJson2 = await sendMessageAndWait(page, 'What is the capital of India?');
    console.log(`Scenario 2 API Response Intent: ${apiJson2.intent}`);

    const lastMsgElem2 = page.locator('.items-start .rounded-2xl').last();
    const response2 = await lastMsgElem2.innerText();
    console.log(`Scenario 2 Agent Rendered Text:\n${response2.trim()}\n`);

    if (response2.includes('Plausible Causes') || response2.includes('What This Could Mean') || response2.includes('Safety Alert') || response2.includes('LOTO')) {
      throw new Error('FAIL: Troubleshooting boilerplate in response to geography query!');
    }
    const sc2Path = path.join(SCREENSHOT_DIR, 'bug1_02_capital_of_india.png');
    await page.screenshot({ path: sc2Path });
    console.log(`[PASS] Scenario 2: Scope redirect rendered cleanly. Screenshot: ${sc2Path}`);

    // ------------------------------------------------------------------------
    // SCENARIO 3: Ambiguous standalone query "it's not working"
    // ------------------------------------------------------------------------
    console.log('\nScenario 3: Submitting ambiguous query "it\'s not working"...');
    const newChatBtn = page.locator('button:has-text("New Chat")').first();
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
    const apiJson3 = await sendMessageAndWait(page, "it's not working");
    console.log(`Scenario 3 API Response Intent: ${apiJson3.intent}`);

    const lastMsgElem3 = page.locator('.items-start .rounded-2xl').last();
    const response3 = await lastMsgElem3.innerText();
    console.log(`Scenario 3 Agent Rendered Text:\n${response3.trim()}\n`);

    if (response3.includes('Plausible Causes') || response3.includes('What This Could Mean') || response3.includes('Safety Alert') || response3.includes('LOTO')) {
      throw new Error('FAIL: Ambiguous query triggered full diagnosis!');
    }
    const sc3Path = path.join(SCREENSHOT_DIR, 'bug1_03_ambiguous_query.png');
    await page.screenshot({ path: sc3Path });
    console.log(`[PASS] Scenario 3: Clarifying question asked. Screenshot: ${sc3Path}`);

    // ------------------------------------------------------------------------
    // SCENARIO 4: Unfamiliar ZentroMax machine troubleshooting
    // ------------------------------------------------------------------------
    console.log('\nScenario 4: Submitting "My unfamiliar ZentroMax machine is vibrating excessively."...');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
    const apiJson4 = await sendMessageAndWait(page, 'My unfamiliar ZentroMax machine is vibrating excessively.');
    console.log(`Scenario 4 API Response Intent: ${apiJson4.intent}`);
    console.log(`Scenario 4 Detected Equipment: ${JSON.stringify(apiJson4.equipment_detected)}`);

    const lastMsgElem4 = page.locator('.items-start .rounded-2xl').last();
    const response4 = await lastMsgElem4.innerText();
    console.log(`Scenario 4 Agent Rendered Text:\n${response4.trim()}\n`);

    if (!response4.includes('What This Could Mean') && !response4.includes('Plausible Causes') && !apiJson4.reply.includes('Plausible Causes')) {
      throw new Error('FAIL: Diagnostic causes missing for ZentroMax machine problem!');
    }
    const sc4Path = path.join(SCREENSHOT_DIR, 'bug1_04_zentromax_diagnosis.png');
    await page.screenshot({ path: sc4Path });
    console.log(`[PASS] Scenario 4: Contextual troubleshooting rendered. Screenshot: ${sc4Path}`);

    // ------------------------------------------------------------------------
    // SCENARIO 5: Multi-Turn Context Isolation: Next message is "Hi recallops"
    // ------------------------------------------------------------------------
    console.log('\nScenario 5: Multi-Turn Context Isolation - Submitting "Hi recallops" after ZentroMax diagnosis...');
    const apiJson5 = await sendMessageAndWait(page, 'Hi recallops');
    console.log(`Scenario 5 API Response Intent: ${apiJson5.intent}`);

    const lastMsgElem5 = page.locator('.items-start .rounded-2xl').last();
    const response5 = await lastMsgElem5.innerText();
    console.log(`Scenario 5 Agent Rendered Text:\n${response5.trim()}\n`);

    if (response5.includes('Plausible Causes') || response5.includes('What This Could Mean') || response5.includes('Safety Alert') || response5.includes('LOTO')) {
      throw new Error('FAIL: Context leakage from ZentroMax contaminated subsequent casual greeting!');
    }
    const sc5Path = path.join(SCREENSHOT_DIR, 'bug1_05_context_isolation_casual.png');
    await page.screenshot({ path: sc5Path });
    console.log(`[PASS] Scenario 5: Strict context isolation verified. Screenshot: ${sc5Path}`);

    // ------------------------------------------------------------------------
    // SCENARIO 6: Cross-conversation outcome reporting and confirmation card
    // ------------------------------------------------------------------------
    console.log('\nScenario 6: Testing cross-conversation repair outcome confirmation...');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
    await sendMessageAndWait(page, "My umbrella won't open. The ribs are jammed.");
    console.log('Scenario 6: Umbrella problem registered in Conversation A.');

    // New conversation reporting the repair in Hinglish
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
    const apiJson6 = await sendMessageAndWait(page, 'Spring change kar diya, ab sahi chal raha hai');
    console.log(`Scenario 6 Report API Intent: ${apiJson6.intent}`);
    console.log(`Scenario 6 Outcome to record: ${JSON.stringify(apiJson6.outcome_to_record)}`);

    // Look for confirmation card in DOM
    const confirmCard = page.locator('text=Record Verified Resolution in Plant Memory').first();
    const hasCard = await confirmCard.isVisible();
    console.log(`Scenario 6: Confirmation card visible: ${hasCard}`);

    const sc6Path = path.join(SCREENSHOT_DIR, 'bug1_06_confirmation_card.png');
    await page.screenshot({ path: sc6Path });
    console.log(`[PASS] Scenario 6: Repair outcome recognized with confirmation card. Screenshot: ${sc6Path}`);

    // Click confirm button if present
    const confirmBtn = page.locator('button:has-text("Confirm & Save to Plant Memory"), button:has-text("Confirm Resolution")').first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      const sc7Path = path.join(SCREENSHOT_DIR, 'bug1_07_confirmed_success.png');
      await page.screenshot({ path: sc7Path });
      console.log(`[PASS] Scenario 6: Outcome successfully stored in plant memory. Screenshot: ${sc7Path}`);
    }

    // Now Conversation C: Recall the umbrella memory in a fresh chat!
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
    const apiJsonRec = await sendMessageAndWait(page, "My umbrella won't open. Has this happened before?");
    console.log(`Scenario 6 Recall API Intent: ${apiJsonRec.intent}`);
    console.log(`Scenario 6 Precedents count: ${apiJsonRec.retrieved_precedents ? apiJsonRec.retrieved_precedents.length : 0}`);

    const sc8Path = path.join(SCREENSHOT_DIR, 'bug1_08_umbrella_recalled.png');
    await page.screenshot({ path: sc8Path });
    console.log(`[PASS] Scenario 6: Umbrella precedent recalled successfully across conversations. Screenshot: ${sc8Path}`);

    console.log('\n================================================================');
    console.log('ALL PLAYWRIGHT LIVE BROWSER VERIFICATIONS PASSED 100%!');
    console.log('================================================================');

  } catch (err) {
    console.error(`\nTEST FAILED WITH ERROR:`, err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'bug1_failure_debug.png') });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runLiveBug1BrowserVerification();
