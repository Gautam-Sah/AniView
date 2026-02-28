import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchAnime } from "../api/animeApi";
import SearchBar from "../components/SearchBar";
import AnimeCard from "../components/AnimeCard";
import AnimeCardSkeleton from "../components/skeletons/AnimeCardSkeleton";
import ErrorMessage from "../components/ErrorMessage";

function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResults = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchAnime(query);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch search results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [query]);

  return (
    <div className="search-results-page">
      <SearchBar initialQuery={query} />

      {error && <ErrorMessage message={error} onRetry={fetchResults} />}

      {!error && (
        <>
          <h2>Results for &quot;{query}&quot;</h2>
          {loading ? (
            <div className="anime-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <AnimeCardSkeleton key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="empty-text">No results found.</p>
          ) : (
            <div className="anime-grid">
              {results.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SearchResults;
