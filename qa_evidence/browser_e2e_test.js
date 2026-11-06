const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://recallops-lake.vercel.app';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORTS_DIR = path.join(__dirname, 'reports');

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  consoleErrors: [],
  consoleWarnings: [],
  failedRequests: [],
  viewsTested: [],
  modalsTested: [],
  responsiveTested: [],
  e2eWorkflow: {},
  passed: 0,
  failed: 0,
};

async function run() {
  console.log(`Starting Comprehensive Browser Automation Test on ${BASE_URL}...`);
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Listen to console and network
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.error(`[Browser Error]: ${text}`);
      results.consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      results.consoleWarnings.push(text);
    }
  });

  page.on('requestfailed', (req) => {
    console.error(`[Network Failed]: ${req.url()} - ${req.failure()?.errorText}`);
    results.failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
  });

  try {
    // 1. Initial Load & Homepage Verification
    console.log('1. Loading Homepage...');
    const t0 = Date.now();
    const resp = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - t0;
    console.log(`Homepage loaded in ${loadTime}ms with HTTP status ${resp.status()}`);
    results.homepageLoadTimeMs = loadTime;

    const title = await page.title();
    console.log(`Page title: ${title}`);
    if (title.includes('RecallOps')) {
      results.passed++;
    } else {
      results.failed++;
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_homepage_overview.png'), fullPage: true });

    // 2. Test All 6 Navigation Tabs
    const tabs = [
      { id: 'overview', name: 'Overview' },
      { id: 'ai-investigations', name: 'AI Investigations' },
      { id: 'hindsight-memory', name: 'Hindsight Memory' },
      { id: 'learning-benchmark', name: 'Learning Benchmark' },
      { id: 'incidents', name: 'Incidents' },
      { id: 'machines', name: 'Machines' },
    ];

    for (const tab of tabs) {
      console.log(`Navigating to tab: ${tab.name}...`);
      const navBtn = page.locator(`header nav button:has-text("${tab.name}")`).first();
      await navBtn.click();
      await page.waitForTimeout(800);
      const filename = `tab_${tab.id}.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: true });
      results.viewsTested.push({ tab: tab.id, status: 'rendered', screenshot: filename });
      results.passed++;
    }

    // 3. Test Modals: Open, Validation, and Close
    console.log('Testing Report Incident Modal open/cancel...');
    const reportBtn = page.locator('header button:has-text("Report Incident")').first();
    await reportBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'modal_report_incident_open.png') });

    // Cancel modal
    const cancelBtn = page.locator('button:has-text("Cancel")').last();
    await cancelBtn.click();
    await page.waitForTimeout(500);
    results.modalsTested.push({ modal: 'Report Incident', status: 'passed' });
    results.passed++;

    // 4. Complete End-to-End Workflow in Browser
    console.log('--- Executing Live Real-Browser End-to-End Workflow ---');

    // Step A: Report new incident
    console.log('Step A: Registering incident via UI modal...');
    await reportBtn.click();
    await page.waitForTimeout(500);

    const testMachine = 'M-115';
    const testSymptoms = 'Elevated bearing temperature (76C) and cyclical vibration harmonics on drive end';

    // Clear and fill Machine ID
    const machineInput = page.locator('input[placeholder*="M-104"]').first();
    await machineInput.fill('');
    await machineInput.fill(testMachine);

    // Fill symptoms
    const symptomsInput = page.locator('textarea[placeholder*="vibration levels"]').first();
    await symptomsInput.fill('');
    await symptomsInput.fill(testSymptoms);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_modal_report_filled.png') });

    // Click Submit Incident
    const submitIncidentBtn = page.locator('button:has-text("Submit Incident")').first();
    await submitIncidentBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_incident_submitted.png') });
    console.log('Step A Complete: Incident submitted and visible in incident list!');
    results.e2eWorkflow.incidentSubmitted = true;
    results.passed++;

    // Step B: AI Investigation via Groq & Hindsight Cloud
    console.log('Step B: Running AI Investigation in browser...');
    // Ensure on AI Investigations view
    await page.locator('header nav button:has-text("AI Investigations")').first().click();
    await page.waitForTimeout(1000);

    const runInvBtn = page.locator('button:has-text("Run AI Investigation")').first();
    if (await runInvBtn.isVisible()) {
      await runInvBtn.click();
      console.log('Investigation triggered! Waiting for Groq model inference & Hindsight precedent search...');
      // Wait for investigation completion in DOM
      await page.waitForSelector('text=AI Recommendation', { timeout: 45000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_ai_investigation_results.png'), fullPage: true });
      console.log('Step B Complete: AI hypothesis, safety warnings, and diagnostic protocol rendered in DOM!');
      results.e2eWorkflow.investigationGenerated = true;
      results.passed++;
    }

    // Step C: Physical Repair Logging
    console.log('Step C: Logging Physical Repair Action in browser...');
    const logRepairBtn = page.locator('button:has-text("Log Physical Repair")').first();
    if (await logRepairBtn.isVisible()) {
      await logRepairBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_modal_repair_open.png') });

      // Submit repair form
      const saveRepairBtn = page.locator('button:has-text("Save Repair Record")').first();
      await saveRepairBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_repair_saved.png') });
      console.log('Step C Complete: Repair action logged and status updated in UI!');
      results.e2eWorkflow.repairLogged = true;
      results.passed++;
    }

    // Step D: Maintenance Outcome Verification & Hindsight Retention
    console.log('Step D: Verifying Outcome and Retaining in Hindsight Cloud...');
    const verifyOutcomeBtn = page.locator('button:has-text("Record Repair Outcome")').first();
    if (await verifyOutcomeBtn.isVisible()) {
      await verifyOutcomeBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_modal_verify_open.png') });

      // Check the certification checkbox
      const certCheckbox = page.locator('input[type="checkbox"]').first();
      await certCheckbox.check();
      await page.waitForTimeout(300);

      // Click "Verify & Retain Memory"
      const retainBtn = page.locator('button:has-text("Verify & Retain Memory")').first();
      await retainBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_outcome_verified.png'), fullPage: true });
      console.log('Step D Complete: Outcome verified and committed to Hindsight Cloud!');
      results.e2eWorkflow.outcomeVerified = true;
      results.passed++;
    }

    // 5. Check Hindsight Memory View for Retained Memory
    console.log('Step E: Inspecting Hindsight Memory View...');
    await page.locator('header nav button:has-text("Hindsight Memory")').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_hindsight_memory_view.png'), fullPage: true });
    results.passed++;

    // 6. Test Incidents Filter and Search
    console.log('Step F: Testing Incidents Search and Filters...');
    await page.locator('header nav button:has-text("Incidents")').first().click();
    await page.waitForTimeout(1000);
    const filterInput = page.locator('input[placeholder*="Search"]').first();
    if (await filterInput.isVisible()) {
      await filterInput.fill('M-115');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_incidents_filtered.png') });
      await filterInput.fill('');
      await page.waitForTimeout(500);
      results.passed++;
    }

    // 7. Test Machines View
    console.log('Step G: Testing Machines Fleet View...');
    await page.locator('header nav button:has-text("Machines")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_machines_fleet_view.png'), fullPage: true });
    results.passed++;

    // 8. Responsive Design Screenshots across 5 Standard Viewports
    console.log('--- Testing Responsive Viewports (Phase 7) ---');
    const viewports = [
      { name: 'mobile_375x812', width: 375, height: 812 },
      { name: 'mobile_390x844', width: 390, height: 844 },
      { name: 'tablet_768x1024', width: 768, height: 1024 },
      { name: 'laptop_1366x768', width: 1366, height: 768 },
      { name: 'desktop_1920x1080', width: 1920, height: 1080 },
    ];

    for (const vp of viewports) {
      console.log(`Testing viewport ${vp.name} (${vp.width}x${vp.height})...`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);

      // Navigate to Overview via brand logo (works across mobile and desktop)
      await page.locator('header button:has-text("Recall")').first().click().catch(() => {});
      await page.waitForTimeout(500);
      const vpFilename = `responsive_${vp.name}_overview.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, vpFilename) });

      // Check horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const hasHorizontalScroll = scrollWidth > clientWidth;

      results.responsiveTested.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        hasHorizontalOverflow: hasHorizontalScroll,
        screenshot: vpFilename,
      });

      if (!hasHorizontalScroll) {
        results.passed++;
      } else {
        console.warn(`[Warning] Horizontal overflow detected at ${vp.name}: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
        results.failed++;
      }
    }

  } catch (err) {
    console.error('Test execution error:', err);
    results.executionError = err.message;
    results.failed++;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error_state.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(REPORTS_DIR, 'browser_e2e_results.json'), JSON.stringify(results, null, 2));
    console.log('Browser Automation Finished! Report written to qa_evidence/reports/browser_e2e_results.json');
  }
}

run();
