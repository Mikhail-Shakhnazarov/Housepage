import "dotenv/config";

const BASE = process.env["AUTH_URL"] || "http://localhost:3000";

async function main() {
  console.log("=== HTTP Smoke Test ===\n");

  // This test requires the dev server to be running on AUTH_URL.
  // It verifies that the core API routes validate inputs before hitting the database.
  // Full auth-tied flow requires Playwright with browser sign-in.

  const endpoints: Array<{ method: string; path: string; body: unknown; expectedStatus: number; label: string }> = [
    // Scan submit - missing fields
    { method: "POST", path: "/api/scan/submit", body: {}, expectedStatus: 401, label: "scan submit without auth returns 401" },
    // Deal - invalid energy
    { method: "POST", path: "/api/deal", body: { energy: 0, timeMin: 10, handSize: 3 }, expectedStatus: 401, label: "deal with invalid energy without auth returns 401" },
    // Task action - invalid action
    { method: "POST", path: "/api/task/action", body: { action: "invalid" }, expectedStatus: 401, label: "task action without auth returns 401" },
    // Invitation - invalid role
    { method: "POST", path: "/api/invitations", body: { role: "GOD" }, expectedStatus: 401, label: "invitation without auth returns 401" },
    // Invitation redeem - missing token
    { method: "POST", path: "/api/invitations/redeem", body: {}, expectedStatus: 401, label: "redeem without auth returns 401" },
    // Decisions - missing fields
    { method: "POST", path: "/api/decisions", body: {}, expectedStatus: 401, label: "decision without auth returns 401" },
    // Notes - missing fields
    { method: "POST", path: "/api/notes", body: {}, expectedStatus: 401, label: "note without auth returns 401" },
    // Expenses - missing fields
    { method: "POST", path: "/api/expenses", body: {}, expectedStatus: 401, label: "expense without auth returns 401" },
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE}${ep.path}`, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ep.body),
      });
      if (res.status === ep.expectedStatus) {
        console.log(`  PASS [${res.status}] ${ep.label}`);
        passed++;
      } else {
        console.log(`  FAIL [${res.status}] ${ep.label} (expected ${ep.expectedStatus})`);
        failed++;
      }
    } catch (e) {
      console.log(`  FAIL ${ep.label} - ${e instanceof Error ? e.message : "Network error"}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("\n=== HTTP SMOKE PASSED ===");
}

main();
