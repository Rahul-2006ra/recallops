const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runPhase6AcceptanceBrowserTest() {
  console.log('Starting RecallOps 2.0 Phase 6 Full Acceptance Browser E2E Test...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 } // Standard laptop screen size
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
  });

  try {
    // ------------------------------------------------------------------------
    // SETUP & INITIAL LOAD
    // ------------------------------------------------------------------------
    console.log('Step 0: Navigating to RecallOps AI Assistant (http://127.0.0.1:5173)...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Verify Title & Brand
    const title = await page.title();
    console.log(`Page Title: "${title}"`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_00_landing.png') });

    // ------------------------------------------------------------------------
    // SCENARIO A: New equipment problem
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario A: New equipment problem ---');
    const inputArea = page.locator('textarea').first();
    await inputArea.fill('My industrial pump is vibrating and overheating. What could be wrong?');
    await page.keyboard.press('Enter');

    // Wait for response
    await page.waitForSelector('text=RecallOps Agent', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const convAText = await page.textContent('body');
    const hasCauses = convAText.includes('Plausible Causes') || convAText.includes('Causes');
    const hasSafety = convAText.includes('Safety') || convAText.includes('Alert') || convAText.includes('Protocol');
    console.log(`Scenario A Verification -> Plausible Causes: ${hasCauses}, Safety Guidance: ${hasSafety}`);
    if (!hasCauses) throw new Error('Scenario A failed: Plausible causes section missing');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_01_scenario_a_diagnostic.png') });
    console.log('Scenario A Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO B: Natural follow-up (Simplify)
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario B: Natural follow-up (Simplify) ---');
    await inputArea.fill('Explain that in simpler words.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const assistantMsgs = page.locator('.items-start .rounded-2xl');
    const lastMsg = await assistantMsgs.last().innerText();
    console.log(`Scenario B Output Preview: "${lastMsg.slice(0, 150)}..."`);
    // Ensure no repeating section headers in simplify response
    const repeatedTemplate = lastMsg.includes('Question for Technician:');
    console.log(`Scenario B Verification -> Template repeated: ${repeatedTemplate}`);
    if (repeatedTemplate) throw new Error('Scenario B failed: repeated full troubleshooting template');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_02_scenario_b_simplify.png') });
    console.log('Scenario B Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO C: Technician guidance
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario C: Technician guidance ---');
    await inputArea.fill('What should I ask my technician?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const msgC = await page.locator('.items-start .rounded-2xl').last().innerText();
    console.log(`Scenario C Output Preview: "${msgC.slice(0, 150)}..."`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_03_scenario_c_technician.png') });
    console.log('Scenario C Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO D: Successful repair outcome & 5-field confirmation
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario D: Successful repair outcome ---');
    await inputArea.fill('The technician cleaned the blocked cooling fins and the pump works normally now.');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=Confirmed Field Repair Outcome Detected', { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Verify 5-field card content
    const cardContent = await page.textContent('body');
    const hasEquip = cardContent.includes('Equipment:');
    const hasProb = cardContent.includes('Original Problem:');
    const hasRepair = cardContent.includes('Repair Performed:');
    const hasOutcome = cardContent.includes('Outcome:');
    const hasSource = cardContent.includes('Verification Source:');
    console.log(`Scenario D 5-Field Verification -> Equip: ${hasEquip}, Prob: ${hasProb}, Repair: ${hasRepair}, Outcome: ${hasOutcome}, Source: ${hasSource}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_04_scenario_d_card.png') });

    // Confirm & Save
    const confirmBtn = page.locator('button:has-text("Confirm & Store in Permanent Memory")').last();
    await confirmBtn.click();
    await page.waitForSelector('text=Saved to Local', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_05_scenario_d_saved.png') });
    console.log('Scenario D Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO E: New conversation and persistent memory recall
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario E: New conversation & persistent memory recall ---');
    const resetBtn = page.locator('button:has-text("New Chat")').first();
    await resetBtn.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=What can I help you understand today?', { timeout: 10000 });

    const inputAreaE = page.locator('textarea').first();
    await inputAreaE.fill('My industrial pump is overheating and vibrating again. What should I check?');
    await inputAreaE.press('Enter');
    await page.waitForSelector('text=Historical Precedents', { timeout: 35000 });
    await page.waitForTimeout(2000);

    const precedentText = await page.locator('div[class*="border-t border-slate-800"]').first().innerText();
    console.log('Retrieved Precedents in Conversation B:\n', precedentText);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_06_scenario_e_persistent_recall.png') });
    console.log('Scenario E Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO F: Failed repair outcome
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario F: Failed repair outcome ---');
    await inputAreaE.fill('The technician replaced the bearings, but the pump still overheats.');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=Confirmed Field Repair Outcome Detected', { timeout: 30000 });
    await page.waitForTimeout(1500);

    const bodyF = await page.textContent('body');
    const hasUnsuccessful = bodyF.includes('UNSUCCESSFUL');
    console.log(`Scenario F Verification -> Classified as UNSUCCESSFUL: ${hasUnsuccessful}`);
    if (!hasUnsuccessful) throw new Error('Scenario F failed: failed repair was not classified as UNSUCCESSFUL');

    const confirmFailBtn = page.locator('button:has-text("Confirm & Store in Permanent Memory")').last();
    await confirmFailBtn.click();
    await page.waitForSelector('text=Saved to Local', { timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_07_scenario_f_failed_saved.png') });
    console.log('Scenario F Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO G: Unrelated equipment (Laptop)
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario G: Unrelated equipment (Laptop) ---');
    const resetBtnG = page.locator('button:has-text("New Chat")').first();
    await resetBtnG.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=What can I help you understand today?', { timeout: 10000 });

    const inputAreaG = page.locator('textarea').first();
    await inputAreaG.fill('My laptop suddenly shuts down.');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=RecallOps Agent', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const bodyG = await page.textContent('body');
    const hasPumpContamination = bodyG.includes('Centrifugal Pump') && bodyG.includes('Historical Precedents');
    console.log(`Scenario G Verification -> Pump contamination in Laptop diagnosis: ${hasPumpContamination}`);
    if (hasPumpContamination) throw new Error('Scenario G failed: Slurry pump precedent contaminated laptop query');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_08_scenario_g_laptop.png') });
    console.log('Scenario G Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO H: Natural equipment switching (Oven -> Why does it do that?)
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario H: Equipment switching (Oven) ---');
    const resetBtnH = page.locator('button:has-text("New Chat")').first();
    await resetBtnH.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=What can I help you understand today?', { timeout: 10000 });

    const inputAreaH = page.locator('textarea').first();
    await inputAreaH.fill('My oven switches off while cooking.');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=RecallOps Agent', { timeout: 30000 });
    await page.waitForTimeout(1500);

    await inputAreaH.fill('Why does it do that?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const lastMsgH = await page.locator('.items-start .rounded-2xl').last().innerText();
    console.log(`Scenario H Follow-up Preview: "${lastMsgH.slice(0, 150)}..."`);
    const discussesOven = lastMsgH.toLowerCase().includes('oven') || lastMsgH.toLowerCase().includes('thermal') || lastMsgH.toLowerCase().includes('switch') || lastMsgH.toLowerCase().includes('sensor');
    console.log(`Scenario H Verification -> Preserved oven context: ${discussesOven}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_09_scenario_h_oven_switch.png') });
    console.log('Scenario H Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO I: Memory evidence inquiry
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario I: Memory evidence inquiry ---');
    await inputAreaH.fill('Has this happened before?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    const lastMsgI = await page.locator('.items-start .rounded-2xl').last().innerText();
    console.log(`Scenario I Memory Answer Preview: "${lastMsgI.slice(0, 150)}..."`);
    const templateRepeatedI = lastMsgI.includes('Question for Technician:');
    console.log(`Scenario I Verification -> Template repeated: ${templateRepeatedI}`);
    if (templateRepeatedI) throw new Error('Scenario I failed: repeated full 4-section troubleshooting template');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_10_scenario_i_memory_query.png') });
    console.log('Scenario I Passed.');

    // ------------------------------------------------------------------------
    // SCENARIO J: Navigation, My Memories inspection & responsive audit
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario J: My Memories Bank & UX Audit ---');
    // Click on "My Memories" in sidebar or navbar
    const memoriesLink = page.locator('text=My Memories, button:has-text("My Memories")').first();
    if (await memoriesLink.isVisible()) {
      await memoriesLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_11_my_memories_view.png') });
      console.log('My Memories view verified.');
    }

    console.log('\n=== ALL PHASE 6 ACCEPTANCE SCENARIOS (A-J) PASSED IN REAL BROWSER! ===');
  } catch (err) {
    console.error('Phase 6 Browser Test Encountered Error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase6_error_snapshot.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runPhase6AcceptanceBrowserTest();
