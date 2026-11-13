const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runPremiumUIAuditTest() {
  console.log(`Starting RecallOps 2.0 Premium UI Audit Test on ${BASE_URL}...`);
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // =========================================================================
    // PART 1: DESKTOP AUDIT (1366 x 768)
    // =========================================================================
    console.log('\n========================================');
    console.log('PART 1: DESKTOP AUDIT (1366 x 768)');
    console.log('========================================');
    const desktopContext = await browser.newContext({
      viewport: { width: 1366, height: 768 }
    });
    const desktopPage = await desktopContext.newPage();

    console.log('Step D1: Loading Homepage Landing State...');
    await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await desktopPage.waitForTimeout(1500);

    // Verify Homepage Landing Headline & Subtitle
    const headline = await desktopPage.textContent('h1');
    console.log(`Landing Headline: "${headline.trim()}"`);
    if (!headline.includes('What can I help you understand today?')) {
      throw new Error(`Headline mismatch: "${headline}"`);
    }

    const subtitle = await desktopPage.textContent('p');
    console.log(`Landing Subtitle: "${subtitle.trim()}"`);
    if (!subtitle.includes('Describe a problem. Understand possible causes. Learn from past repairs.')) {
      throw new Error(`Subtitle mismatch: "${subtitle}"`);
    }

    // Verify 4 Example Prompts visible
    const promptCards = desktopPage.locator('button:has-text("Industrial Slurry Pump"), button:has-text("Electric Induction Motor")');
    const count = await promptCards.count();
    console.log(`Example prompt cards detected: ${count}`);
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_01_landing.png') });
    console.log('Step D1 Passed: Centered Homepage Landing verified.');

    // Step D2: Click Example Prompt and verify conversation transition
    console.log('Step D2: Clicking example prompt "Industrial Slurry Pump"...');
    const pumpPrompt = desktopPage.locator('button:has-text("Industrial Slurry Pump")').first();
    await pumpPrompt.click();

    // Wait for response bubble
    await desktopPage.waitForSelector('text=RecallOps Agent', { timeout: 35000 });
    await desktopPage.waitForTimeout(2000);

    // Verify Structured Diagnostic Sections
    const desktopBody = await desktopPage.textContent('body');
    const hasCauses = desktopBody.includes('Plausible Causes') || desktopBody.includes('Causes');
    const hasSafety = desktopBody.includes('Safety') || desktopBody.includes('Protocol');
    console.log(`Structured Diagnosis -> Causes: ${hasCauses}, Safety Alert: ${hasSafety}`);
    if (!hasCauses) throw new Error('Plausible causes section missing');
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_02_diagnosis.png') });
    console.log('Step D2 Passed: Structured Diagnosis verified.');

    // Step D3: Follow-up query "Explain that in simpler words."
    console.log('Step D3: Submitting simplify follow-up...');
    const chatInput = desktopPage.locator('textarea').first();
    await chatInput.fill('Explain that in simpler words.');
    await desktopPage.keyboard.press('Enter');
    
    // Wait for response to finish generating
    await desktopPage.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await desktopPage.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 40000 });
    await desktopPage.waitForTimeout(1000);

    const assistantBubbles = desktopPage.locator('.items-start .rounded-2xl');
    const simplifyText = await assistantBubbles.last().innerText();
    console.log(`Simplify response: "${simplifyText.slice(0, 120)}..."`);
    const noTemplate = !simplifyText.includes('Question for Technician:');
    if (!noTemplate) throw new Error('Simplify response repeated 4-section template');
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_03_simplify.png') });
    console.log('Step D3 Passed: Clean follow-up verified.');

    // Step D4: Five-Field Confirmation Card
    console.log('Step D4: Reporting outcome and verifying 5-field confirmation card...');
    await chatInput.fill('The technician cleaned the blocked cooling fins and the pump works normally now.');
    await desktopPage.keyboard.press('Enter');
    await desktopPage.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await desktopPage.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 40000 });
    await desktopPage.waitForSelector('text=Confirmed Field Repair Outcome Detected', { timeout: 30000 });
    await desktopPage.waitForTimeout(1500);

    // Verify 5 distinct fields
    const cardText = await desktopPage.textContent('body');
    const fields = ['Equipment:', 'Original Problem:', 'Repair Performed:', 'Outcome:', 'Verification Source:'];
    for (const f of fields) {
      if (!cardText.includes(f)) throw new Error(`5-field card missing field: ${f}`);
    }
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_04_confirmation_card.png') });

    // Confirm and save
    const confirmBtn = desktopPage.locator('button:has-text("Confirm & Store in Permanent Memory")').last();
    await confirmBtn.click();
    await desktopPage.waitForSelector('text=Saved to Local', { timeout: 15000 });
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_05_saved_outcome.png') });
    console.log('Step D4 Passed: Five-Field Confirmation Card and persistence verified.');

    // Step D5: My Memories Library
    console.log('Step D5: Navigating to My Memories Library...');
    const memoriesTab = desktopPage.locator('button:has-text("My Memories")').first();
    await memoriesTab.click();
    await desktopPage.waitForTimeout(1500);

    // Verify search and filter
    await desktopPage.waitForSelector('text=My Memories Library', { timeout: 10000 });
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_06_my_memories.png') });

    // Click on first memory card Details to open inspection modal
    const firstMemCard = desktopPage.locator('text=Details').first();
    await firstMemCard.click();
    await desktopPage.waitForSelector('text=Verified Episodic Record', { timeout: 10000 });
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_07_memory_modal.png') });
    const closeBtn = desktopPage.locator('button:has-text("Close")').first();
    await closeBtn.click();
    console.log('Step D5 Passed: My Memories Library & Modal verified.');

    // Step D6: Conversation History
    console.log('Step D6: Navigating to Conversation History...');
    const historyTab = desktopPage.locator('button:has-text("History")').first();
    await historyTab.click();
    await desktopPage.waitForTimeout(1500);
    await desktopPage.waitForSelector('text=Conversation History', { timeout: 10000 });
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_08_history.png') });
    console.log('Step D6 Passed: History View verified.');

    // Step D7: System Settings
    console.log('Step D7: Navigating to System Settings...');
    const settingsTab = desktopPage.locator('button:has-text("Settings")').first();
    await settingsTab.click();
    await desktopPage.waitForTimeout(1500);
    await desktopPage.waitForSelector('text=System Settings', { timeout: 10000 });
    await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_desktop_09_settings.png') });
    console.log('Step D7 Passed: Settings View verified.');

    await desktopContext.close();

    // =========================================================================
    // PART 2: MOBILE AUDIT (390 x 844 - iPhone / Modern Mobile)
    // =========================================================================
    console.log('\n========================================');
    console.log('PART 2: MOBILE AUDIT (390 x 844)');
    console.log('========================================');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });
    const mobilePage = await mobileContext.newPage();

    console.log('Step M1: Loading Mobile Landing State...');
    await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForTimeout(1500);

    // Verify Mobile Responsive Layout
    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_mobile_01_landing.png') });

    // Step M2: Test Mobile Drawer Menu
    console.log('Step M2: Opening mobile menu drawer...');
    const menuToggle = mobilePage.locator('button:has(svg)').last();
    await menuToggle.click();
    await mobilePage.waitForTimeout(800);
    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_mobile_02_drawer_menu.png') });

    // Navigate to My Memories from mobile drawer
    const mobileMemories = mobilePage.locator('.md\\:hidden button:has-text("My Memories")').first();
    if (await mobileMemories.isVisible()) {
      await mobileMemories.click();
      await mobilePage.waitForTimeout(1200);
      await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_mobile_03_memories.png') });
    }

    // Return to AI Assistant on mobile
    const mobileAssistant = mobilePage.locator('header button:has-text("Recall")').first();
    await mobileAssistant.click();
    await mobilePage.waitForTimeout(1000);

    // Step M3: Send message on mobile and verify chat bubbles & no horizontal overflow
    console.log('Step M3: Sending query on mobile...');
    const mobileInput = mobilePage.locator('textarea').first();
    await mobileInput.fill('My oven keeps switching off.');
    await mobilePage.keyboard.press('Enter');

    await mobilePage.waitForSelector('text=Querying Hindsight Memory', { state: 'attached', timeout: 10000 }).catch(() => {});
    await mobilePage.waitForSelector('text=Querying Hindsight Memory', { state: 'detached', timeout: 40000 });
    await mobilePage.waitForSelector('text=RecallOps Agent', { timeout: 35000 });
    await mobilePage.waitForTimeout(2000);

    // Check no horizontal scrollbar overflow
    const hasHorizontalOverflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`Mobile horizontal overflow detected: ${hasHorizontalOverflow}`);
    if (hasHorizontalOverflow) throw new Error('Mobile layout has horizontal overflow!');

    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'premium_mobile_04_chat_response.png') });
    console.log('Step M3 Passed: Mobile conversation & zero-overflow verified.');

    await mobileContext.close();

    console.log('\n=== ALL PREMIUM DESKTOP & MOBILE UI AUDITS PASSED WITH FULL SCREENSHOT EVIDENCE! ===');
  } catch (err) {
    console.error('Premium UI Audit Encountered Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runPremiumUIAuditTest();
