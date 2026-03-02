import {
  searchAnime,
  getAnimeDetails,
  getEpisodeVideo,
  resolveEpisodeSession,
  getFeaturedAnime,
} from "../services/scraperService.js"
import { get9animeVideo } from "../services/nineAnimeScraper.js"
import { getAnimeDaoVideo } from "../services/animeDaoScraper.js"

/**
 * GET /api/featured
 */
export async function featured(req, res, next) {
  try {
    const results = await getFeaturedAnime()
    res.json({ results })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/search?q=naruto
 */
export async function search(req, res, next) {
  try {
    const query = req.query.q
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter 'q' is required" })
    }

    // Basic input length guard
    if (query.length > 200) {
      return res.status(400).json({ error: "Query too long" })
    }

    const results = await searchAnime(query.trim())
    res.json({ results })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/anime/:animeId
 */
export async function animeDetails(req, res, next) {
  try {
    const { animeId } = req.params
    if (!animeId || !/^[a-zA-Z0-9_-]+$/.test(animeId)) {
      return res.status(400).json({ error: "Invalid anime ID" })
    }

    const details = await getAnimeDetails(animeId)
    res.json(details)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/episode/:animeId/:episodeNumber
 */
export async function episode(req, res, next) {
  try {
    const { animeId, episodeNumber } = req.params

    if (!animeId || !/^[a-zA-Z0-9_-]+$/.test(animeId)) {
      return res.status(400).json({ error: "Invalid anime ID" })
    }
    if (!episodeNumber || !/^\d+(\.\d+)?$/.test(episodeNumber)) {
      return res.status(400).json({ error: "Invalid episode number" })
    }

    // Resolve the episode session from the episode number
    const session = await resolveEpisodeSession(animeId, episodeNumber)
    if (!session) {
      return res.status(404).json({ error: "Episode not found" })
    }

    const video = await getEpisodeVideo(animeId, session)
    res.json({ episodeNumber, ...video })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/9anime/video?anime=demon slayer&type=sub&episode=1
 */
export async function nineAnimeVideo(req, res, next) {
  try {
    const { anime, type, episode } = req.query

    if (!anime || typeof anime !== "string" || anime.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter 'anime' is required" })
    }
    if (!episode || !/^\d+$/.test(episode)) {
      return res.status(400).json({ error: "Query parameter 'episode' must be a number" })
    }

    if (!type || (type !== "sub" && type !== "dub")) {
      return res.status(400).json({ error: "Query parameter 'type' must be 'sub' or 'dub'" })
    }
    const audioType = type
    const result = await get9animeVideo(anime.trim(), audioType, episode)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/animedao/video?anime=solo leveling&episode=1
 */
export async function animeDaoVideo(req, res, next) {
  try {
    const { anime, episode } = req.query

    if (!anime || typeof anime !== "string" || anime.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter 'anime' is required" })
    }
    if (!episode || !/^\d+$/.test(episode)) {
      return res.status(400).json({ error: "Query parameter 'episode' must be a number" })
    }

    const result = await getAnimeDaoVideo(anime.trim(), episode)
    res.json(result)
  } catch (err) {
    next(err)
  }
}
