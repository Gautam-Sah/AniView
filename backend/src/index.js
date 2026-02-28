import express from "express"
import cors from "cors"
import config from "./config/index.js"
import animeRoutes from "./routes/animeRoutes.js"
import rateLimiter from "./middleware/rateLimiter.js"
import errorHandler from "./middleware/errorHandler.js"
import browserManager from "./services/browserManager.js"
import "dotenv/config"
const app = express()

// --- Middleware ---
app.use(
  cors({
    origin: config.frontendUrl,
    methods: ["GET"],
  }),
)
app.use(express.json())
app.use("/api", rateLimiter)

// --- Routes ---
app.use("/api", animeRoutes)

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }))

// --- Error handling ---
app.use(errorHandler)

// --- Start server ---
app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`)
})

// Graceful shutdown — close the shared Puppeteer browser
const shutdown = async () => {
  console.log("Shutting down...")
  await browserManager.close()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
