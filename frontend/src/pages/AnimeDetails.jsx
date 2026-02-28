import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { getAnimeDetails } from "../api/animeApi"
import EpisodeList from "../components/EpisodeList"
import AnimeDetailsSkeleton from "../components/skeletons/AnimeDetailsSkeleton"
import ErrorMessage from "../components/ErrorMessage"

function AnimeDetails() {
  const { animeId } = useParams()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)

  const fetchDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAnimeDetails(animeId)
      setAnime(data)
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load anime details.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [animeId])

  if (loading) return <AnimeDetailsSkeleton />
  if (error) return <ErrorMessage message={error} onRetry={fetchDetails} />
  if (!anime) return null

  return (
    <div className="anime-details-page">
      <div className="anime-details-header">
        {anime.cover && (
          <img
            src={anime.cover}
            alt={anime.title}
            className="anime-cover"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="anime-details-info">
          <h1>{anime.title}</h1>
          {anime.synopsis && (
            <div className="synopsis-wrapper">
              <p className={`synopsis${synopsisExpanded ? "" : " collapsed"}`}>
                {anime.synopsis}
              </p>
              <button
                className="synopsis-toggle"
                onClick={() => setSynopsisExpanded(!synopsisExpanded)}
              >
                {synopsisExpanded ? "less" : "more"}
              </button>
            </div>
          )}
          {anime.info &&
            Object.entries(anime.info)
              .filter(
                ([key]) =>
                  !["Japanese", "Studio", "External Links"].includes(key),
              )
              .map(([key, value]) => (
                <p key={key} className="info-line">
                  <strong>{key}:</strong> {value}
                </p>
              ))}
        </div>
      </div>
      <EpisodeList animeId={animeId} episodes={anime.episodes} />
    </div>
  )
}

export default AnimeDetails
