import { useEffect, useState } from "react"
import SearchBar from "../components/SearchBar"
import AnimeCard from "../components/AnimeCard"
import AnimeCardSkeleton from "../components/skeletons/AnimeCardSkeleton"
import { getFeaturedAnime } from "../api/animeApi"

function Home() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFeaturedAnime()
      .then(setFeatured)
      .catch((err) => console.error("Failed to load featured anime:", err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="home-page">
      <div className="hero">
        <h1>AniView</h1>
        <p>stream your favorite anime</p>
        <SearchBar />
      </div>

      <div className="featured-section">
        <h2>Latest Releases</h2>
        {loading ? (
          <div className="anime-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </div>
        ) : featured.length > 0 ? (
          <div className="anime-grid">
            {featured.map((anime) => (
              <AnimeCard key={anime.animeId} anime={anime} />
            ))}
          </div>
        ) : (
          <p className="empty-text">Could not load featured anime.</p>
        )}
      </div>
    </div>
  )
}

export default Home
