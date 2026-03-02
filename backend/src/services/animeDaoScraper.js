import browserManager from "./browserManager.js"
import cache from "../utils/cache.js"

const BASE = "https://animedao.ac"

/**
 * Search AnimeDao via server-rendered search page.
 * Returns array of { title, slug }
 */
async function searchAnimeDao(page, query) {
  const searchUrl = `${BASE}/search.html?keyword=${encodeURIComponent(query)}`
  console.log(`[animedao] Searching: ${searchUrl}`)

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 })

  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/anime/"]'))
    const seen = new Set()
    const results = []

    for (const a of links) {
      const href = a.getAttribute("href") || ""
      const match = href.match(/\/anime\/([^/]+)/)
      if (!match) continue

      const slug = match[1]
      if (seen.has(slug)) continue
      seen.add(slug)

      // Derive a clean title from the slug (most reliable on AnimeDao)
      // Slug is like "solo-leveling" or "jujutsu-kaisen-the-culling-game-part-1"
      const title = slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())

      results.push({ title, slug })
    }

    return results
  })
}

/**
 * Normalize a string for comparison: lowercase, remove punctuation, collapse whitespace.
 * Strips trailing "(Dub)" / "(Sub)" tags.
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
 * Score how well a search result matches the query.
 * Higher score = better match.
 */
function scoreResult(result, queryNorm) {
  const titleNorm = normalize(result.title)
  let score = 0

  if (titleNorm === queryNorm) score += 50
  if (titleNorm.startsWith(queryNorm)) score += 30
  if (titleNorm.includes(queryNorm)) score += 20

  const queryWords = queryNorm.split(" ").filter(Boolean)
  const titleWords = titleNorm.split(" ")
  const matched = queryWords.filter((w) => titleWords.includes(w)).length
  score += (matched / queryWords.length) * 15

  const extras = ["movie", "special", "ova", "ona", "recap", "summary"]
  for (const e of extras) {
    if (titleWords.includes(e) && !queryWords.includes(e)) score -= 10
  }

  const extraWords = Math.max(0, titleWords.length - queryWords.length)
  score -= extraWords * 5

  return score
}

/**
 * Pick the best matching result from search results.
 */
function pickBestResult(results, animeName) {
  const queryNorm = normalize(animeName)

  const scored = results.map((r) => ({
    result: r,
    score: scoreResult(r, queryNorm),
  }))

  scored.sort((a, b) => b.score - a.score)

  console.log(
    `[animedao] Scored results:`,
    scored.map((s) => `${s.result.title} = ${s.score}`).join(", "),
  )

  return scored[0].result
}

/**
 * Get video sources from AnimeDao for a specific anime episode.
 * Returns { animeTitle, episodeUrl, episodeNumber, sub: [...], dub: [...] }
 *
 * @param {string} animeName - Name of the anime
 * @param {number|string} episodeNumber - Episode number
 */
export async function getAnimeDaoVideo(animeName, episodeNumber) {
  const cacheKey = `animedao:${animeName}:${episodeNumber}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const page = await browserManager.newPage()
  try {
    // 1. Search
    const results = await searchAnimeDao(page, animeName)
    if (results.length === 0) {
      throw new Error(`No results found for "${animeName}"`)
    }

    console.log(
      `[animedao] Found ${results.length} results:`,
      results.map((r) => r.title).join(", "),
    )

    // 2. Pick best match
    const match = pickBestResult(results, animeName)
    console.log(`[animedao] Selected: "${match.title}" (slug: ${match.slug})`)

    // 3. Navigate to anime page, find episode link
    const animeUrl = `${BASE}/anime/${match.slug}`
    console.log(`[animedao] Loading anime page: ${animeUrl}`)
    await page.goto(animeUrl, { waitUntil: "domcontentloaded", timeout: 30000 })

    const episodeSlug = await page.evaluate((epNum) => {
      const links = Array.from(document.querySelectorAll('a[href*="/watch-online/"]'))
      const seen = new Set()
      for (const a of links) {
        const href = a.getAttribute("href") || ""
        if (seen.has(href)) continue
        seen.add(href)

        // Match episode number at end of URL: -episode-{num}
        const match = href.match(/episode-(\d+)(?:[/?#]|$)/)
        if (match && match[1] === String(epNum)) {
          // Extract the full path
          const pathMatch = href.match(/\/watch-online\/(.+?)(?:[/?#]|$)/)
          return pathMatch ? pathMatch[1] : null
        }
      }
      return null
    }, episodeNumber)

    if (!episodeSlug) {
      throw new Error(`Episode ${episodeNumber} not found for "${match.title}"`)
    }

    // 4. Navigate to episode page
    const episodeUrl = `${BASE}/watch-online/${episodeSlug}`
    console.log(`[animedao] Loading episode: ${episodeUrl}`)
    await page.goto(episodeUrl, { waitUntil: "domcontentloaded", timeout: 30000 })

    // 5. Extract server links with data-video attributes
    const servers = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("li.server > a[data-video]"))
      return items.map((a) => ({
        name: a.textContent.trim(),
        url: a.getAttribute("data-video"),
      }))
    })

    console.log(
      `[animedao] Found ${servers.length} servers:`,
      servers.map((s) => s.name).join(", "),
    )

    // 6. Classify into sub/dub, skip HSUB
    const sub = []
    const dub = []
    for (const server of servers) {
      const name = server.name.toUpperCase()
      if (name.includes("(HSUB)")) continue
      if (name.includes("(DUB)")) {
        dub.push(server.url)
      } else if (name.includes("(SUB)")) {
        sub.push(server.url)
      }
    }

    const result = {
      animeTitle: match.title,
      episodeUrl,
      episodeNumber: String(episodeNumber),
      sub,
      dub,
    }

    console.log("[animedao] Result:", JSON.stringify(result, null, 2))
    cache.set(cacheKey, result)
    return result
  } finally {
    await page.close()
  }
}
