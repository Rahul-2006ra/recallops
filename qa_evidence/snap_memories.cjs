const { chromium } = require('c:/Users/rahul/OneDrive/Desktop/Recallops/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://recallops-lake.vercel.app', { waitUntil: 'networkidle' });
  const btn = page.locator("button:has-text('Memories')").first();
  await btn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Users/rahul/.gemini/antigravity/brain/dd429447-7c6d-4e90-b57f-086b1630e107/screenshots/prod_live/prod_07_memories_populated.png' });
  await browser.close();
  console.log('Successfully captured prod_07_memories_populated.png');
})();
