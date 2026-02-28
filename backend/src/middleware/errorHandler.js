/**
 * Global error handler — catches unhandled errors from controllers/services.
 */
export default function errorHandler(err, _req, res, _next) {
  console.error("[ERROR]", err.message);

  // Puppeteer timeout
  if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
    return res.status(504).json({
      error: "Scraping timed out. The source site may be slow or unavailable.",
    });
  }

  // Navigation errors (site down, DNS failure, etc.)
  if (err.message?.includes("net::ERR_")) {
    return res.status(502).json({
      error: "Could not reach the source site. Please try again later.",
    });
  }

  res.status(500).json({
    error: "Internal server error",
  });
}
