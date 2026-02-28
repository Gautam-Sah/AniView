import { Link } from "react-router-dom";

function EpisodeList({ animeId, episodes }) {
  if (!episodes || episodes.length === 0) {
    return <p className="empty-text">No episodes available.</p>;
  }

  return (
    <div className="episode-list">
      <h2>Episodes</h2>
      <div className="episode-grid">
        {episodes.map((ep) => (
          <Link
            key={ep.episodeNumber}
            to={`/watch/${animeId}/${ep.episodeNumber}`}
            className="episode-item"
          >
            <div className="episode-thumb">
              {ep.snapshot ? (
                <img
                  src={ep.snapshot}
                  alt={`Episode ${ep.episodeNumber}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="episode-thumb-placeholder" />
              )}
              <span className="episode-number">{ep.episodeNumber}</span>
              {ep.duration && (
                <span className="episode-duration">{ep.duration}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default EpisodeList;
