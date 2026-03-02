import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import {
  getEpisodeVideo,
  getAnimeDetails,
  get9animeVideo,
  getAnimeDaoVideo,
} from "../api/animeApi"
import VideoPlayerSkeleton from "../components/skeletons/VideoPlayerSkeleton"
import ErrorMessage from "../components/ErrorMessage"

function VideoPlayer() {
  const { animeId, episodeNumber } = useParams()

  const [videoData, setVideoData] = useState(null)
  const [animeTitle, setAnimeTitle] = useState("")
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [activeServer, setActiveServer] = useState("animepahe")
  const [audioType, setAudioType] = useState("sub")
  const [serverLoading, setServerLoading] = useState(false)

  const [nineAnimeCache, setNineAnimeCache] = useState({})
  const [animeDaoCache, setAnimeDaoCache] = useState(null)

  // -------------------------
  // Load default (animepahe)
  // -------------------------
  const fetchVideo = useCallback(async () => {
    setVideoData(null)
    setActiveServer("animepahe")
    setAudioType("sub")
    setNineAnimeCache({})
    setAnimeDaoCache(null)
    setLoading(true)
    setError(null)

    try {
      const [data, details] = await Promise.all([
        getEpisodeVideo(animeId, episodeNumber),
        getAnimeDetails(animeId),
      ])

      setVideoData(data)
      setAnimeTitle(details.title || "")
      setEpisodes(details.episodes || [])

      const bestUrl = pickBestUrl(data.sub) || pickBestUrl(data.dub)

      if (bestUrl) setSelectedUrl(bestUrl)
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to load episode. Please retry.",
      )
    } finally {
      setLoading(false)
    }
  }, [animeId, episodeNumber])

  useEffect(() => {
    fetchVideo()
  }, [fetchVideo])

  // -------------------------
  // Fetch 9anime servers (fixed dependency issue)
  // -------------------------
  const fetch9animeServers = useCallback(
    async (type) => {
      if (!animeTitle) return null

      if (nineAnimeCache[type]) return nineAnimeCache[type]

      const result = await get9animeVideo(animeTitle, type, episodeNumber)

      setNineAnimeCache((prev) => ({
        ...prev,
        [type]: result.servers,
      }))

      return result.servers
    },
    [animeTitle, episodeNumber, nineAnimeCache],
  )

  // -------------------------
  // Background prefetch (safe unmount)
  // -------------------------
  useEffect(() => {
    if (!animeTitle) return

    let isMounted = true

    const prefetch = async () => {
      try {
        const subResult = await get9animeVideo(animeTitle, "sub", episodeNumber)
        if (isMounted) {
          setNineAnimeCache((prev) => ({
            ...prev,
            sub: subResult.servers,
          }))
        }
      } catch (err) {}

      try {
        const dubResult = await get9animeVideo(animeTitle, "dub", episodeNumber)
        if (isMounted) {
          setNineAnimeCache((prev) => ({
            ...prev,
            dub: dubResult.servers,
          }))
        }
      } catch (err) {}

      try {
        const daoResult = await getAnimeDaoVideo(animeTitle, episodeNumber)
        if (isMounted) {
          setAnimeDaoCache({
            sub: daoResult.sub || [],
            dub: daoResult.dub || [],
          })
        }
      } catch (err) {}
    }

    prefetch()

    return () => {
      isMounted = false
    }
  }, [animeTitle, episodeNumber])

  // -------------------------
  // Load 9anime server (no blank flash)
  // -------------------------
  const load9animeServer = useCallback(
    async (serverId, type) => {
      const serverIndex = parseInt(serverId.replace("9anime-", ""), 10)

      setServerLoading(true)
      setActiveServer(serverId)

      try {
        const servers = await fetch9animeServers(type)
        if (servers && servers[serverIndex]) {
          setSelectedUrl(servers[serverIndex].iframe)
        }
      } catch (err) {
        console.error("[9anime] Failed to load server:", err)
      } finally {
        setServerLoading(false)
      }
    },
    [fetch9animeServers],
  )

  const handleServerClick = (serverId) => {
    if (serverId === activeServer) return

    if (serverId === "animepahe") {
      setActiveServer("animepahe")
      if (videoData) {
        const bestUrl =
          audioType === "dub"
            ? pickBestUrl(videoData.dub) || pickBestUrl(videoData.sub)
            : pickBestUrl(videoData.sub) || pickBestUrl(videoData.dub)
        setSelectedUrl(bestUrl)
      }
      return
    }

    if (serverId.startsWith("animedao-")) {
      const idx = parseInt(serverId.replace("animedao-", ""), 10)
      setActiveServer(serverId)

      if (animeDaoCache) {
        const urls = audioType === "dub" ? animeDaoCache.dub : animeDaoCache.sub

        setSelectedUrl(urls[idx] || null)
      }
      return
    }

    load9animeServer(serverId, audioType)
  }

  const handleAudioToggle = (type) => {
    if (type === audioType) return
    setAudioType(type)

    if (activeServer === "animepahe") {
      if (videoData) {
        const bestUrl =
          type === "dub"
            ? pickBestUrl(videoData.dub) || pickBestUrl(videoData.sub)
            : pickBestUrl(videoData.sub) || pickBestUrl(videoData.dub)
        setSelectedUrl(bestUrl)
      }
    } else if (activeServer.startsWith("animedao-")) {
      if (animeDaoCache) {
        const idx = parseInt(activeServer.replace("animedao-", ""), 10)
        const urls = type === "dub" ? animeDaoCache.dub : animeDaoCache.sub

        setSelectedUrl(urls[idx] || null)
      }
    } else {
      load9animeServer(activeServer, type)
    }
  }

  if (loading) return <VideoPlayerSkeleton />
  if (error) return <ErrorMessage message={error} onRetry={fetchVideo} />
  if (!videoData) return null

  const hasSub = videoData.sub && Object.keys(videoData.sub).length > 0

  const hasDub = videoData.dub && Object.keys(videoData.dub).length > 0

  const hasAnySources = hasSub || hasDub
  const isAnimepahe = activeServer === "animepahe"

  const currentEp = Number(episodeNumber)
  const prevEp = currentEp > 1 ? currentEp - 1 : null
  const nextEp = currentEp + 1

  const currentServers = nineAnimeCache[audioType]
  const serverButtons = [{ id: "animepahe", label: "Fast" }]

  if (currentServers) {
    currentServers.forEach((_, i) => {
      serverButtons.push({
        id: `9anime-${i}`,
        label: `Standard ${i + 1}`,
      })
    })
  } else {
    serverButtons.push({
      id: "9anime-0",
      label: "Standard 1",
    })
  }

  const animeDaoUrls = animeDaoCache
    ? audioType === "dub"
      ? animeDaoCache.dub
      : animeDaoCache.sub
    : []

  animeDaoUrls.forEach((_, i) => {
    serverButtons.push({
      id: `animedao-${i}`,
      label: `Backup ${i + 1}`,
    })
  })

  return (
    <div className="video-player-page">
      {animeTitle && (
        <h2>
          <Link to={`/anime/${animeId}`}>{animeTitle}</Link>
        </h2>
      )}

      <h3>Episode {episodeNumber}</h3>

      <div className="player-controls">
        <div className="audio-toggle">
          <button
            className={`audio-btn${audioType === "sub" ? " active" : ""}`}
            onClick={() => handleAudioToggle("sub")}
          >
            Sub
          </button>
          <button
            className={`audio-btn${audioType === "dub" ? " active" : ""}`}
            onClick={() => handleAudioToggle("dub")}
          >
            Dub
          </button>
        </div>

        <div className="server-selector">
          {serverButtons.map((s) => (
            <button
              key={s.id}
              className={`server-btn${activeServer === s.id ? " active" : ""}`}
              onClick={() => handleServerClick(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="player-container">
        {serverLoading ? (
          <div className="no-video">
            <p>Loading server...</p>
          </div>
        ) : selectedUrl ? (
          <iframe
            src={selectedUrl}
            className="video-iframe"
            allowFullScreen
            frameBorder="0"
            title={`Episode ${episodeNumber}`}
          />
        ) : (
          <div className="no-video">
            <p>
              {isAnimepahe && hasAnySources
                ? "Select a quality option below to start watching."
                : "No video sources found for this server."}
            </p>
          </div>
        )}
      </div>

      {episodes.length > 0 && (
        <div className="episode-selector">
          <h3>Episodes</h3>
          <div className="episode-selector-grid">
            {episodes.map((ep) => (
              <Link
                key={`${animeId}-${ep.episodeNumber}`}
                to={`/watch/${animeId}/${ep.episodeNumber}`}
                className={`episode-selector-item${
                  String(ep.episodeNumber) === String(episodeNumber)
                    ? " current"
                    : ""
                }`}
              >
                {ep.episodeNumber}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function pickBestUrl(qualityMap) {
  if (!qualityMap) return null

  const resolutions = Object.keys(qualityMap)
    .map(Number)
    .sort((a, b) => b - a)

  return resolutions.length > 0 ? qualityMap[String(resolutions[0])] : null
}

export default VideoPlayer
