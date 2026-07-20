import { CronJob } from "cron";

const PING_TIMEOUT_MS = 10_000;
const DEFAULT_SCHEDULE = "*/5 * * * *";

let pingInFlight = false;

async function pingHealth(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    // Drain the body so the connection can be reused / closed cleanly.
    await response.arrayBuffer().catch(() => {});

    if (response.ok) {
      console.log(`[keep-alive] ${url} OK`);
      return true;
    }

    console.warn(`[keep-alive] ${url} failed with status ${response.status}`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function runKeepAlive() {
  if (pingInFlight) return;
  pingInFlight = true;

  try {
    const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
    if (!base) return;

    await pingHealth(new URL("/health", base).href);
  } catch (error) {
    if (error?.name === "AbortError") {
      console.warn("[keep-alive] ping timed out");
    } else {
      console.error("[keep-alive] ping error:", error?.message ?? error);
    }
  } finally {
    pingInFlight = false;
  }
}

const schedule = process.env.KEEP_ALIVE_CRON || DEFAULT_SCHEDULE;

// runOnInit: ping once on startup so cold hosts wake immediately.
const job = new CronJob(schedule, runKeepAlive, null, false, null, null, true);

export default job;
