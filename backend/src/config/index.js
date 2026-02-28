import "dotenv/config"

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 300,
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 30,
  },
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== "false",
  },
  baseUrl: "https://animepahe.si",
}

export default config
