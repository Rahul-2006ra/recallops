/**
 * Automated Verification for IncidentDecisionTimeline Component
 * Tests 6 distinct incident lifecycle states and viewports using Playwright.
 */
const { chromium } = require('../frontend/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FIXTURES = {
  // Case 1: Incident with only a report
  reportedOnly: {
    incident: {
      id: "INC-TEST-001",
      machine_id: "M-101",
      equipment_type: "Centrifugal Slurry Pump",
      symptoms: "Minor bearing housing thermal drift (58°C)",
      severity: "LOW",
      reported_observations: "Operator noticed warm bearing cap during routine walk-through.",
      status: "REPORTED",
      is_demo: true,
      created_at: "2026-11-08T04:15:00Z",
      timestamp: "2026-11-08T04:15:00Z",
    },
    investigations: [],
    repairs: [],
    verifications: [],
  },

  // Case 2: Investigated incident
  investigated: {
    incident: {
      id: "INC-TEST-002",
      machine_id: "M-102",
      equipment_type: "Industrial Air Compressor",
      symptoms: "Cyclic pressure drop below 90 PSI accompanied by high-frequency harmonic whine",
      severity: "HIGH",
      reported_observations: "Stage-2 discharge pressure oscillating under peak demand.",
      status: "INVESTIGATED",
      is_demo: true,
      created_at: "2026-11-08T05:00:00Z",
      timestamp: "2026-11-08T05:00:00Z",
    },
    investigations: [
      {
        id: "INV-TEST-002",
        incident_id: "INC-TEST-002",
        diagnosis_hypothesis: "Hypothesis: Discharge check valve seat degradation causing reverse flow during cycle transition.",
        confidence: 0.84,
        recommended_diagnostic_steps: [
          "Apply Lockout/Tagout to main 480V compressor feeder.",
          "Perform ultrasonic leak detection on stage-2 non-return check valve.",
          "Check differential pressure gauge across discharge manifold.",
        ],
        relevant_historical_incidents: ["COMP-204", "COMP-208"],
        supporting_evidence: [
          "Historical precedent COMP-204 experienced identical 90 PSI drop resolved by check valve rebuild.",
        ],
        unsuccessful_previous_repairs: [
          "Replacing pressure transducer on COMP-208 failed to resolve oscillation.",
        ],
        safety_warnings: ["Bleed residual receiver pressure to 0 PSI before loosening manifold bolts."],
        created_at: "2026-11-08T05:05:00Z",
      },
    ],
    repairs: [],
    verifications: [],
  },

  // Case 3: Incident with repair recorded
  repaired: {
    incident: {
      id: "INC-TEST-003",
      machine_id: "M-103",
      equipment_type: "Cooling Tower Fan Drive",
      symptoms: "High radial vibration amplitude (6.8 mm/s) at reduction gearbox",
      severity: "HIGH",
      reported_observations: "Gearbox housing vibrating visibly during full-fan speed.",
      status: "REPAIRED",
      is_demo: true,
      created_at: "2026-11-08T06:00:00Z",
      timestamp: "2026-11-08T06:00:00Z",
    },
    investigations: [
      {
        id: "INV-TEST-003",
        incident_id: "INC-TEST-003",
        diagnosis_hypothesis: "Hypothesis: Intermediate shaft coupling misalignment and flexible element wear.",
        confidence: 0.88,
        recommended_diagnostic_steps: ["Check laser alignment across drive shaft."],
        relevant_historical_incidents: ["FAN-104"],
        supporting_evidence: ["FAN-104 resolved identical 6.8 mm/s vibration with coupling realignment."],
        unsuccessful_previous_repairs: [],
        safety_warnings: ["Lockout drive motor at MCC panel."],
        created_at: "2026-11-08T06:04:00Z",
      },
    ],
    repairs: [
      {
        id: "REP-TEST-003",
        incident_id: "INC-TEST-003",
        technician_id: "TECH-512",
        action_taken: "Replaced elastomeric spider insert and laser realigned motor-to-gearbox shaft to within 0.03mm radial tolerance.",
        parts_replaced: "Lovejoy SO-95 Elastomer Insert",
        notes: "Old insert was brittle and had 2mm backlash. Re-torqued flange bolts to 85 Nm.",
        performed_at: "2026-11-08T07:30:00Z",
      },
    ],
    verifications: [],
  },

  // Case 4: Successfully verified repair with confirmed Hindsight Cloud retention
  verifiedSuccess: {
    incident: {
      id: "INC-TEST-004",
      machine_id: "M-112",
      equipment_type: "Centrifugal Slurry Pump",
      symptoms: "Abnormal high-frequency vibration spike at 7.4 mm/s and casing temperature rise to 86°C",
      severity: "CRITICAL",
      reported_observations: "Vibration amplitude exceeded 7.2 mm/s during maximum duty cycle.",
      status: "VERIFIED_SUCCESSFUL",
      is_demo: true,
      created_at: "2026-11-08T08:00:00Z",
      timestamp: "2026-11-08T08:00:00Z",
    },
    investigations: [
      {
        id: "INV-TEST-004",
        incident_id: "INC-TEST-004",
        diagnosis_hypothesis: "Hypothesis: Motor-pump shaft coupling misalignment and impeller unbalance.",
        confidence: 0.92,
        recommended_diagnostic_steps: ["Laser align coupling and dynamically balance impeller."],
        relevant_historical_incidents: ["M-104", "M-108"],
        supporting_evidence: ["M-104 ventilation cleaning proved insufficient for vibration."],
        unsuccessful_previous_repairs: ["M-108 bearing replacement failed to resolve root cause."],
        safety_warnings: ["Depressurize slurry line and lockout 4160V motor."],
        created_at: "2026-11-08T08:05:00Z",
      },
    ],
    repairs: [
      {
        id: "REP-TEST-004",
        incident_id: "INC-TEST-004",
        technician_id: "TECH-941",
        action_taken: "Laser aligned motor coupling, corrected 0.12mm offset, and dynamically balanced pump impeller in-situ.",
        parts_replaced: "None",
        notes: "Residual vibration dropped immediately upon run-up.",
        performed_at: "2026-11-08T09:15:00Z",
      },
    ],
    verifications: [
      {
        id: "VER-TEST-004",
        incident_id: "INC-TEST-004",
        verified_by: "LEAD-ENG-007",
        outcome_status: "SUCCESSFUL",
        inspection_notes: "Post-repair 2-hour full duty test: vibration dropped to 1.1 mm/s (OEM baseline is 1.5). Casing temperature stabilized at 47°C. Certified resolution.",
        follow_up_metrics: { vibration_amplitude_mms: 1.1, operating_temp_c: 47 },
        hindsight_retained: true,
        hindsight_document_id: "OUTCOME-INC-TEST-004",
        verified_at: "2026-11-08T10:00:00Z",
      },
    ],
  },

  // Case 5: Unsuccessfully verified repair (anti-pattern)
  verifiedFailure: {
    incident: {
      id: "INC-TEST-005",
      machine_id: "M-108",
      equipment_type: "Drive Motor & Bearing Housing",
      symptoms: "Overheating to 89.4°C and cyclical mechanical noise after 30 minutes of continuous duty",
      severity: "HIGH",
      reported_observations: "Technician suspected drive bearing friction was generating excessive heat.",
      status: "VERIFIED_UNSUCCESSFUL",
      is_demo: true,
      created_at: "2026-11-08T08:30:00Z",
      timestamp: "2026-11-08T08:30:00Z",
    },
    investigations: [
      {
        id: "INV-TEST-005",
        incident_id: "INC-TEST-005",
        diagnosis_hypothesis: "Hypothesis: Drive-end bearing friction due to grease degradation.",
        confidence: 0.65,
        recommended_diagnostic_steps: ["Replace drive bearings."],
        relevant_historical_incidents: [],
        supporting_evidence: [],
        unsuccessful_previous_repairs: [],
        safety_warnings: ["LOTO motor."],
        created_at: "2026-11-08T08:35:00Z",
      },
    ],
    repairs: [
      {
        id: "REP-TEST-005",
        incident_id: "INC-TEST-005",
        technician_id: "TECH-088",
        action_taken: "Replaced drive-end bearings with new SKF-6205-2RSH.",
        parts_replaced: "SKF-6205-2RSH bearings",
        notes: "Old bearings had discolored grease.",
        performed_at: "2026-11-08T09:00:00Z",
      },
    ],
    verifications: [
      {
        id: "VER-TEST-005",
        incident_id: "INC-TEST-005",
        verified_by: "LEAD-ENG-007",
        outcome_status: "UNSUCCESSFUL",
        inspection_notes: "Overheating recurred after 28 minutes (89.4°C). Bearing replacement failed to resolve underlying thermal trip. Root cause remains unaddressed.",
        follow_up_metrics: { temp_celsius: 89.4 },
        hindsight_retained: true,
        hindsight_document_id: "OUTCOME-INC-TEST-005",
        verified_at: "2026-11-08T09:45:00Z",
      },
    ],
  },

  // Case 6: Missing / incomplete event data
  incompleteData: {
    incident: {
      id: "INC-TEST-006",
      machine_id: "M-999",
      equipment_type: "Auxiliary Sump Pump",
      symptoms: "Unspecified motor chatter",
      severity: "LOW",
      reported_observations: "",
      status: "REPORTED",
      is_demo: false,
      created_at: null,
      timestamp: null,
    },
    investigations: [],
    repairs: [],
    verifications: [],
  },
};

async function runTimelineAudit() {
  const screenshotsDir = path.resolve("qa_evidence/screenshots/timeline");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Start Vite Preview Server
  console.log("Starting local Vite preview server on port 4173...");
  const previewProcess = spawn("npx.cmd", ["vite", "preview", "--port", "4173"], {
    cwd: path.resolve("frontend"),
    shell: true,
    stdio: "pipe",
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  const results = {
    testCases: [],
    responsive: [],
    allPassed: true,
  };

  try {
    for (const [caseKey, fixture] of Object.entries(FIXTURES)) {
      console.log(`\nTesting Case: ${caseKey}...`);
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      // Intercept API calls to supply controlled test fixture
      await page.route("**/api/incidents*", async (route) => {
        const url = route.request().url();
        if (url.includes(`/api/incidents/${fixture.incident.id}`) || url.match(/\/api\/incidents\/INC-TEST/)) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixture),
          });
        }
        if (route.request().method() === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([fixture.incident]),
          });
        }
        return route.continue();
      });

      await page.route("**/health*", async (route) => {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "healthy", service: "recallops-backend" }),
        });
      });

      await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      // Navigate to AI Investigations tab
      const invTabBtn = page.locator('button:has-text("AI Investigations")');
      if (await invTabBtn.isVisible()) {
        await invTabBtn.click();
        await page.waitForTimeout(800);
      }

      // Check Timeline component presence in DOM
      const timelineHeader = page.locator('text=Incident Decision Timeline');
      const timelineVisible = await timelineHeader.isVisible({ timeout: 5000 }).catch(() => false);

      const stage1 = await page.locator('text=STAGE 1 // REPORTED').isVisible().catch(() => false);
      const stage2 = await page.locator('text=STAGE 2 // AI INVESTIGATION').isVisible().catch(() => false);
      const stage3 = await page.locator('text=STAGE 3 // FIELD EXECUTION').isVisible().catch(() => false);
      const stage4 = await page.locator('text=STAGE 4 // OUTCOME VERIFICATION').isVisible().catch(() => false);
      const stage5 = await page.locator('text=STAGE 5 // MEMORY RETENTION').isVisible().catch(() => false);

      const screenshotFile = `timeline_${caseKey}.png`;
      await page.screenshot({
        path: path.join(screenshotsDir, screenshotFile),
        fullPage: true,
      });

      const passed = timelineVisible && stage1 && stage2 && stage3 && stage4 && stage5;
      if (!passed) results.allPassed = false;

      results.testCases.push({
        case: caseKey,
        timelineVisible,
        stages: { stage1, stage2, stage3, stage4, stage5 },
        screenshot: screenshotFile,
        passed,
      });

      console.log(`  -> Timeline visible: ${timelineVisible}`);
      console.log(`  -> Stages rendered: 1:${stage1}, 2:${stage2}, 3:${stage3}, 4:${stage4}, 5:${stage5}`);
      console.log(`  -> Result: ${passed ? "PASSED" : "FAILED"}`);

      await context.close();
    }

    // Responsive Viewports Audit
    console.log("\nTesting Responsive Viewports on Verified Success Case...");
    const viewports = [
      { name: "mobile_375x812", width: 375, height: 812 },
      { name: "tablet_768x1024", width: 768, height: 1024 },
      { name: "desktop_1920x1080", width: 1920, height: 1080 },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      const fixture = FIXTURES.verifiedSuccess;
      await page.route("**/api/incidents*", async (route) => {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fixture),
        });
      });
      await page.route("**/health*", async (route) => {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "healthy", service: "recallops-backend" }),
        });
      });

      await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);

      const invTabBtn = page.locator('button:has-text("AI Investigations")');
      if (await invTabBtn.isVisible()) {
        await invTabBtn.click();
        await page.waitForTimeout(800);
      }

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      const vpScreenshot = `responsive_${vp.name}_timeline.png`;
      await page.screenshot({
        path: path.join(screenshotsDir, vpScreenshot),
        fullPage: true,
      });

      results.responsive.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        hasHorizontalOverflow: overflow,
        passed: !overflow,
        screenshot: vpScreenshot,
      });

      console.log(`  -> ${vp.name}: Overflow=${overflow} (${!overflow ? "PASSED" : "FAILED"})`);
      await context.close();
    }

  } finally {
    await browser.close();
    previewProcess.kill();
  }

  // Save Results Report
  const reportPath = path.resolve("qa_evidence/reports/timeline_test_results.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nTimeline Audit Complete! Report saved to ${reportPath}`);
}

runTimelineAudit().catch((err) => {
  console.error("Timeline audit error:", err);
  process.exit(1);
});
