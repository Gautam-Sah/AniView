import browserManager from "./browserManager.js"
import cache from "../utils/cache.js"
import config from "../config/index.js"

const BASE = config.baseUrl

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the page is on the animepahe origin so fetch() sends cookies.
 */
async function ensureOnOrigin(page) {
  await browserManager.ensureCfCleared(page)
  const currentUrl = page.url()
  if (!currentUrl.startsWith(BASE)) {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 })
  }
}

/**
 * Fetch a URL via in-page fetch (inherits CF cookies). Returns text.
 */
async function pageFetch(page, url) {
  return page.evaluate(async (u) => {
    const res = await fetch(u)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  }, url)
}

/**
 * Fetch a JSON API endpoint via in-page fetch.
 */
async function pageFetchJson(page, url) {
  const raw = await pageFetch(page, url)
  try {
    return JSON.parse(raw)
  } catch {
    console.error(`[Scraper] JSON parse failed: ${raw.slice(0, 500)}`)
    throw new Error(`Failed to parse JSON from ${url}`)
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search anime by query string.
 * Uses in-page fetch to the search API (no page navigation needed).
 */
export async function searchAnime(query) {
  const cacheKey = `search:${query.toLowerCase().trim()}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const page = await browserManager.newPage()
  try {
    await ensureOnOrigin(page)

    const url = `${BASE}/api?m=search&q=${encodeURIComponent(query)}`
    console.log(`[Scraper] Searching: ${url}`)
    const data = await pageFetchJson(page, url)

    if (!data.data || data.data.length === 0) {
      console.log("[Scraper] Search returned no results")
      return []
    }

    const results = data.data.map((item) => ({
      title: item.title,
      animeId: item.session,
      thumbnail: item.poster,
      releaseYear: item.year,
      type: item.type,
      episodes: item.episodes,
      status: item.status,
    }))

    console.log(`[Scraper] Search results:`, JSON.stringify(results, null, 2))
    cache.set(cacheKey, results)
    return results
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Latest Releases (via Jikan API + animepahe search)
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 86400000

function getCurrentSeason() {
  const month = new Date().getMonth() + 1
  if (month <= 3) return "winter"
  if (month <= 6) return "spring"
  if (month <= 9) return "summer"
  return "fall"
}

/**
 * Fetch latest/current season anime from Jikan (MAL),
 * then search each on animepahe using a single shared page.
 */
export async function getFeaturedAnime() {
  const cacheKey = "featured"
  const cached = cache.get(cacheKey)
  if (cached) return cached

  console.log("[Scraper] Fetching current season anime from Jikan...")

  const year = new Date().getFullYear()
  const season = getCurrentSeason()
  const jikanUrl = `https://api.jikan.moe/v4/seasons/${year}/${season}?limit=20&order_by=score&sort=desc`

  let titles = []
  try {
    const res = await fetch(jikanUrl)
    const json = await res.json()
    titles = (json.data || [])
      .map((a) => a.title_english || a.title)
      .filter(Boolean)
      .slice(0, 20)
    console.log(`[Scraper] Got ${titles.length} titles from Jikan`)
  } catch (err) {
    console.error("[Scraper] Jikan API failed:", err.message)
    return []
  }

  // Use a single page for all searches (reuse CF cookies, no repeated page open/close)
  const page = await browserManager.newPage()
  try {
    await ensureOnOrigin(page)

    // Search titles in parallel batches of 5 for speed
    const BATCH_SIZE = 5
    const results = []
    for (let i = 0; i < titles.length; i += BATCH_SIZE) {
      const batch = titles.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (title) => {
          try {
            const url = `${BASE}/api?m=search&q=${encodeURIComponent(title)}`
            console.log(`[Scraper] Featured search: ${title}`)
            const data = await pageFetchJson(page, url)

            if (data.data && data.data.length > 0) {
              const item = data.data[0]
              return {
                title: item.title,
                animeId: item.session,
                thumbnail: item.poster,
                releaseYear: item.year,
                type: item.type,
                episodes: item.episodes,
                status: item.status,
              }
            }
          } catch (err) {
            console.warn(`[Scraper] Failed to search: "${title}"`, err.message)
          }
          return null
        }),
      )
      results.push(...batchResults.filter(Boolean))
    }

    console.log(
      `[Scraper] Featured anime result:`,
      JSON.stringify(results, null, 2),
    )
    cache.set(cacheKey, results, ONE_DAY_MS)
    return results
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Anime Details + Episodes
// ---------------------------------------------------------------------------

/**
 * Parse anime details from raw HTML (no DOM rendering needed).
 */
function decodeHtmlEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function parseAnimeHtml(html) {
  const titleRaw =
    html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)?.[1] || ""
  const title = decodeHtmlEntities(titleRaw)

  const cover =
    html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/)?.[1] || ""

  const synopsisRaw =
    html.match(/class="anime-synopsis"[^>]*>([\s\S]*?)<\/div>/)?.[1] || ""
  const synopsis = synopsisRaw
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .trim()

  const info = {}
  const infoBlock = html.match(
    /class="col-sm-4 anime-info">([\s\S]*?)<div class="anime-genre/,
  )
  if (infoBlock) {
    const pTags = [
      ...infoBlock[1].matchAll(
        /<p[^>]*>[\s\S]*?<strong>(.*?):?\s*<\/strong>([\s\S]*?)<\/p>/g,
      ),
    ]
    for (const m of pTags) {
      const key = m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/:$/, "")
        .trim()
      const val = m[2]
        .replace(/<[^>]+>/g, "")
        .replace(/,\s*$/, "")
        .trim()
      if (key && val) info[key] = val
    }
  }

  return { title, cover, synopsis, info }
}

/**
 * Get anime details and episode list.
 * Uses in-page fetch for both HTML details and episode API (fast).
 */
export async function getAnimeDetails(animeId) {
  const cacheKey = `anime:${animeId}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const page = await browserManager.newPage()
  try {
    await ensureOnOrigin(page)

    // Fetch HTML for metadata
    const animeUrl = `${BASE}/anime/${animeId}`
    console.log(`[Scraper] Fetching anime details (fast): ${animeUrl}`)
    const html = await pageFetch(page, animeUrl)
    const details = parseAnimeHtml(html)
    console.log(`[Scraper] Got details for: "${details.title}"`)

    // Fetch all episode pages via in-page fetch
    const episodes = await fetchAllEpisodes(page, animeId)
    console.log(`[Scraper] Found ${episodes.length} episodes`)

    const result = {
      title: details.title,
      cover: details.cover,
      synopsis: details.synopsis,
      info: details.info,
      animeId,
      episodes,
    }

    console.log(
      `[Scraper] Anime details result:`,
      JSON.stringify(result, null, 2),
    )
    cache.set(cacheKey, result)
    return result
  } finally {
    await page.close()
  }
}

/**
 * Paginate through the episode release API using in-page fetch.
 */
async function fetchAllEpisodes(page, animeId) {
  const parseEpisodes = (data) =>
    (data.data || []).map((ep) => ({
      episodeNumber: ep.episode,
      session: ep.session,
      title: `Episode ${ep.episode}`,
      snapshot: ep.snapshot,
      duration: ep.duration,
      createdAt: ep.created_at,
    }))

  // Fetch page 1 to learn lastPage
  const url1 = `${BASE}/api?m=release&id=${animeId}&sort=episode_asc&page=1`
  console.log(`[Scraper] Fetching episodes page 1: ${url1}`)

  let firstData
  try {
    firstData = await pageFetchJson(page, url1)
  } catch {
    console.warn("[Scraper] Could not parse episode page 1, stopping")
    return []
  }

  const episodes = parseEpisodes(firstData)
  const lastPage = firstData.last_page || 1

  if (lastPage > 1) {
    // Fetch all remaining pages in parallel
    const remaining = Array.from({ length: lastPage - 1 }, (_, i) => i + 2)
    console.log(`[Scraper] Fetching episode pages 2-${lastPage} in parallel`)

    const pageResults = await Promise.all(
      remaining.map(async (p) => {
        const url = `${BASE}/api?m=release&id=${animeId}&sort=episode_asc&page=${p}`
        try {
          const data = await pageFetchJson(page, url)
          return parseEpisodes(data)
        } catch {
          console.warn(`[Scraper] Could not parse episode page ${p}`)
          return []
        }
      }),
    )
    for (const eps of pageResults) episodes.push(...eps)
  }

  return episodes
}

// ---------------------------------------------------------------------------
// Episode Video
// ---------------------------------------------------------------------------

/**
 * Get video source URLs for a specific episode.
 * This still needs real page navigation (DOM interaction required).
 *
 * Flow:
 *   1. Navigate to /play/{anime_session}/{episode_session}
 *   2. Click the "Click to load" refresh button if present
 *   3. Extract all Vodes button entries from the dropdown
 *   4. Classify each by quality (360p/720p/1080p) and type (sub/dub)
 */
export async function getEpisodeVideo(animeId, episodeSession) {
  const cacheKey = `episode:${animeId}:${episodeSession}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const page = await browserManager.newPage()
  try {
    await browserManager.ensureCfCleared(page)

    const watchUrl = `${BASE}/play/${animeId}/${episodeSession}`
    console.log(`[Scraper] Fetching episode video: ${watchUrl}`)

    await page.goto(watchUrl, { waitUntil: "domcontentloaded", timeout: 45000 })

    // Click the "Click to load" refresh button if present
    const reloadBtn = await page.$(".click-to-load, .reload")
    if (reloadBtn) {
      console.log("[Scraper] Clicking reload button...")
      await reloadBtn.click()
    }

    // Wait for the dropdown buttons to appear
    await page
      .waitForSelector("button.dropdown-item[data-src]", { timeout: 15000 })
      .catch(() =>
        console.warn("[Scraper] Timed out waiting for Vodes buttons"),
      )

    // Extract all Vodes embed URLs classified by sub/dub and quality
    const sources = await page.evaluate(() => {
      const sub = {}
      const dub = {}

      const buttons = document.querySelectorAll(
        "button.dropdown-item[data-src]",
      )
      buttons.forEach((btn) => {
        const url = btn.getAttribute("data-src") || ""
        const resolution = btn.getAttribute("data-resolution") || ""
        const audio = btn.getAttribute("data-audio") || ""
        if (!url || !resolution) return

        const isDub = audio === "eng"
        const target = isDub ? dub : sub
        target[resolution] = url
      })

      return { sub, dub }
    })

    const result = {
      episodeSession,
      sub: sources.sub,
      dub: sources.dub,
      watchUrl,
    }

    console.log(
      "[Scraper] Episode video result:",
      JSON.stringify(result, null, 2),
    )
    cache.set(cacheKey, result)
    return result
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Episode Session Resolver
// ---------------------------------------------------------------------------

/**
 * Look up the episode session UUID by episode number.
 */
export async function resolveEpisodeSession(animeId, episodeNumber) {
  const details = await getAnimeDetails(animeId)
  const ep = details.episodes.find(
    (e) => String(e.episodeNumber) === String(episodeNumber),
  )
  return ep?.session || null
}
