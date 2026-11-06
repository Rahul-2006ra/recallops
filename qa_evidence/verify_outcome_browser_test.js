const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://recallops-lake.vercel.app';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

async function testOutcomeVerification() {
  console.log('Testing Outcome Verification in Browser...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Navigate to AI Investigations
  await page.locator('header nav button:has-text("AI Investigations")').first().click();
  await page.waitForTimeout(1500);

  // Look for either "Record Repair Outcome" or "Log Physical Repair"
  const outcomeBtn = page.locator('button:has-text("Record Repair Outcome")').first();
  const repairBtn = page.locator('button:has-text("Log Physical Repair")').first();

  if (await outcomeBtn.isVisible()) {
    console.log('Found "Record Repair Outcome" button, clicking...');
    await outcomeBtn.click();
  } else if (await repairBtn.isVisible()) {
    console.log('Found "Log Physical Repair" button, completing repair first...');
    await repairBtn.click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Save Repair Record")').click();
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Record Repair Outcome")').first().click();
  }

  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_modal_verify_open.png') });

  // Check the certification checkbox
  console.log('Checking certification checkbox...');
  const certCheckbox = page.locator('input[type="checkbox"]').first();
  await certCheckbox.check();
  await page.waitForTimeout(400);

  // Click Verify & Retain Memory
  console.log('Submitting verification...');
  const retainBtn = page.locator('button:has-text("Verify & Retain Memory")').first();
  await retainBtn.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_outcome_verified.png'), fullPage: true });
  console.log('Verification completed and screenshot 08_outcome_verified.png saved!');

  await browser.close();
}

testOutcomeVerification().catch((err) => {
  console.error('Error during outcome verification test:', err);
  process.exit(1);
});
