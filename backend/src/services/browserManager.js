import puppeteer from "puppeteer-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import config from "../config/index.js"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Stealth plugin patches all common bot-detection vectors
puppeteer.use(StealthPlugin())

class BrowserManager {
  constructor() {
    this.browser = null
    this.launching = null
    // Track whether we've passed the CF challenge this session
    this.cfCleared = false
  }

  async getBrowser() {
    if (this.browser && this.browser.connected) {
      return this.browser
    }

    if (this.launching) {
      return this.launching
    }

    // Persistent user-data-dir keeps CF cookies, localStorage, etc. across restarts
    const userDataDir = path.resolve(__dirname, "../../.browser-data")

    console.log(config.puppeteer.headless)
    this.launching = puppeteer.launch({
      headless: config.puppeteer.headless,
      userDataDir,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
        "--lang=en-US,en",
      ],
      // Ignore default args that expose automation
      ignoreDefaultArgs: ["--enable-automation"],
    })

    try {
      this.browser = await this.launching
      this.cfCleared = false

      this.browser.on("disconnected", () => {
        this.browser = null
        this.cfCleared = false
      })

      console.log("[Browser] Launched with persistent profile")
      return this.browser
    } finally {
      this.launching = null
    }
  }

  /**
   * Get a fresh page with realistic fingerprint settings.
   */
  async newPage() {
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    await page.setViewport({ width: 1920, height: 1080 })
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    })

    page.setDefaultNavigationTimeout(45000)
    page.setDefaultTimeout(30000)

    return page
  }

  /**
   * Ensure Cloudflare challenge is passed on a given page.
   * Navigates to the site homepage and waits for challenge to clear.
   * Returns the cookies for use in subsequent requests.
   */
  async ensureCfCleared(page) {
    // If we already cleared CF this session, skip (cookies persist in the profile)
    if (this.cfCleared) {
      console.log("[CF] Already cleared this session, skipping")
      return
    }

    console.log("[CF] Navigating to homepage to clear challenge...")
    await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    })

    // Wait for the CF challenge to resolve (up to 30s)
    const cleared = await this.waitForCfClear(page, 30000)
    if (cleared) {
      this.cfCleared = true
      console.log("[CF] Challenge cleared successfully")
    } else {
      console.warn("[CF] Challenge may not have cleared — proceeding anyway")
    }
  }

  /**
   * Poll the page until the Cloudflare challenge screen disappears.
   */
  async waitForCfClear(page, timeout = 30000) {
    const start = Date.now()

    while (Date.now() - start < timeout) {
      try {
        const isChallenged = await page.evaluate(() => {
          const title = document.title || ""
          const body = document.body?.innerHTML || ""
          return (
            title.includes("Just a moment") ||
            title.includes("Checking") ||
            title.includes("Attention Required") ||
            body.includes("cf-browser-verification") ||
            body.includes("challenge-platform") ||
            body.includes("cf-turnstile") ||
            body.includes("Checking if the site connection is secure") ||
            // DDoS-Guard
            body.includes("DDoS-Guard")
          )
        })

        if (!isChallenged) return true
      } catch {
        // Page might be navigating, ignore
      }

      await new Promise((r) => setTimeout(r, 2000))
    }

    return false
  }

  /**
   * Reset CF cleared state (call when a request gets blocked).
   
   */
  resetCfState() {
    this.cfCleared = false
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.cfCleared = false
    }
  }
}

const browserManager = new BrowserManager()
export default browserManager
