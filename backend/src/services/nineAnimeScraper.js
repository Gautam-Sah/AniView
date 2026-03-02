import browserManager from "./browserManager.js"
import cache from "../utils/cache.js"

const BASE = "https://9anime.org.lv"

/**
 * Search 9anime via their AJAX API.
 * Returns array of { title, slug, link, type, episodes, sub, image, genres }
 */
async function search9anime(page, query) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 })

  const results = await page.evaluate(async (q) => {
    const res = await fetch("/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `action=ts_ac_do_search&ts_ac_query=${encodeURIComponent(q)}`,
    })
    const json = await res.json()
    const items = json?.anime?.[0]?.all || []
    return items.map((item) => ({
      title: item.post_title,
      link: item.post_link,
      type: item.post_type,
      episodes: item.post_latest,
      sub: item.post_sub,
      image: item.post_image,
      genres: item.post_genres,
    }))
  }, query)

  return results
}

/**
 * Extract video server iframe URLs from a 9anime episode page.
 * Decodes the base64 select.mirror option values to get iframe src URLs.
 */
async function extractMirrors(page) {
  return page.evaluate(() => {
    const select = document.querySelector("select.mirror")
    if (!select) return []

    return Array.from(select.options)
      .filter((o) => o.value)
      .map((o) => {
        const decoded = atob(o.value)
        const srcMatch = decoded.match(/src="([^"]+)"/)
        const src = srcMatch ? srcMatch[1] : ""

        // Extract m3u8 if present
        let m3u8 = ""
        let subtitle = ""
        if (src.includes("m3u8=")) {
          const m3u8Match = src.match(/m3u8=([^&]+)/)
          if (m3u8Match) m3u8 = decodeURIComponent(m3u8Match[1])
          const subMatch = src.match(/subtitle=([^&]+)/)
          if (subMatch) subtitle = decodeURIComponent(subMatch[1])
        }

        return {
          server: o.textContent?.trim(),
          iframe: src,
          m3u8,
          subtitle,
        }
      })
  })
}

/**
 * Normalize a string for comparison: lowercase, remove punctuation, collapse whitespace.
 * Also strips trailing "(Dub)" / "(Sub)" tags to avoid double-matching.
 */
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/\s*\((?:dub|sub)\)\s*/gi, " ")
    .replace(/[''":!?,.\-()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Score how well a search result matches the query + audio type.
 * Higher score = better match.
 */
function scoreResult(result, queryNorm, audioType) {
  const titleNorm = normalize(result.title)
  let score = 0

  // Audio type match (most important)
  const wantsDub = audioType === "dub"
  const isDub = result.sub === "Dub"
  if (wantsDub === isDub) score += 100

  // Exact title match
  if (titleNorm === queryNorm) score += 50

  // Title starts with query
  if (titleNorm.startsWith(queryNorm)) score += 30

  // Title contains query
  if (titleNorm.includes(queryNorm)) score += 20

  // Word overlap: count how many query words appear in the title
  const queryWords = queryNorm.split(" ").filter(Boolean)
  const titleWords = titleNorm.split(" ")
  const matched = queryWords.filter((w) => titleWords.includes(w)).length
  score += (matched / queryWords.length) * 15

  // Penalize titles with extra qualifiers (season arcs, movies, specials)
  const extras = ["movie", "special", "ova", "ona", "recap", "summary"]
  for (const e of extras) {
    if (titleWords.includes(e) && !queryWords.includes(e)) score -= 10
  }

  // Prefer TV over Movie/OVA unless query specifies
  if (result.type === "TV") score += 5

  // Penalize "(Dub)" appearing in title when we want sub (avoids wrong version)
  if (!wantsDub && titleNorm.includes("dub")) score -= 20
  if (wantsDub && !titleNorm.includes("dub") && !isDub) score -= 20

  // Prefer shorter titles (closer match to query, fewer extra words like "Season 3")
  // The more extra words beyond the query, the more penalty
  const titleLen = titleNorm.split(" ").filter(Boolean).length
  const queryLen = queryNorm.split(" ").filter(Boolean).length
  const extraWords = Math.max(0, titleLen - queryLen)
  score -= extraWords * 5

  return score
}

/**
 * Pick the best matching result from search results.
 */
function pickBestResult(results, animeName, audioType) {
  const queryNorm = normalize(animeName)

  const scored = results.map((r) => ({
    result: r,
    score: scoreResult(r, queryNorm, audioType),
  }))

  scored.sort((a, b) => b.score - a.score)

  console.log(
    `[9anime] Scored results:`,
    scored.map((s) => `${s.result.title} (${s.result.sub}) = ${s.score}`).join(", "),
  )

  return scored[0].result
}

/**
 * Get video sources from 9anime for a specific anime episode.
 *
 * @param {string} animeName - Name of the anime (e.g. "demon slayer")
 * @param {string} audioType - "sub" or "dub"
 * @param {number|string} episodeNumber - Episode number
 * @returns {{ servers: Array, episodeUrl: string, animeTitle: string }}
 */
export async function get9animeVideo(animeName, audioType, episodeNumber) {
  const cacheKey = `9anime:${animeName}:${audioType}:${episodeNumber}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const page = await browserManager.newPage()
  try {
    // Build search query: append "(Dub)" if dubbed
    const searchQuery = audioType === "dub" ? `${animeName} (Dub)` : animeName

    console.log(`[9anime] Searching: "${searchQuery}"`)
    const results = await search9anime(page, searchQuery)

    if (results.length === 0) {
      throw new Error(`No results found for "${searchQuery}"`)
    }

    console.log(
      `[9anime] Found ${results.length} results:`,
      results.map((r) => `${r.title} (${r.sub})`).join(", "),
    )

    const match = pickBestResult(results, animeName, audioType)

    console.log(`[9anime] Selected: "${match.title}" -> ${match.link}`)

    // Extract the slug from the link to build episode URL
    // Link format: https://9anime.org.lv/anime/demon-slayer-kimetsu-no-yaiba/
    const slugMatch = match.link.match(/\/anime\/([^/]+)/)
    if (!slugMatch) {
      throw new Error(`Could not extract slug from: ${match.link}`)
    }
    const slug = slugMatch[1]

    // Episode URL format: https://9anime.org.lv/{slug}-episode-{number}/
    const episodeUrl = `${BASE}/${slug}-episode-${episodeNumber}/`
    console.log(`[9anime] Loading episode: ${episodeUrl}`)

    await page.goto(episodeUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })

    // Wait for the mirror select to be available
    await page
      .waitForSelector("select.mirror", { timeout: 10000 })
      .catch(() => console.warn("[9anime] Mirror select not found"))

    // Extract all server options
    const servers = await extractMirrors(page)
    console.log(
      `[9anime] Found ${servers.length} servers:`,
      servers.map((s) => s.server).join(", "),
    )

    const result = {
      animeTitle: match.title,
      episodeUrl,
      episodeNumber: String(episodeNumber),
      audioType,
      servers,
    }

    console.log("[9anime] Result:", JSON.stringify(result, null, 2))
    cache.set(cacheKey, result)
    return result
  } finally {
    await page.close()
  }
}
