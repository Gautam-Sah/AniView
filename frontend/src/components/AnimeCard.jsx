import { Link } from "react-router-dom";

function AnimeCard({ anime }) {
  return (
    <Link to={`/anime/${anime.animeId}`} className="anime-card">
      <div className="anime-card-image">
        <img src={anime.thumbnail} alt={anime.title} loading="lazy" referrerPolicy="no-referrer" />
      </div>
      <div className="anime-card-info">
        <h3>{anime.title}</h3>
        <div className="anime-card-meta">
          {anime.releaseYear && <span>{anime.releaseYear}</span>}
          {anime.type && <span>{anime.type}</span>}
          {anime.episodes != null && <span>{anime.episodes} eps</span>}
        </div>
      </div>
    </Link>
  );
}

export default AnimeCard;
