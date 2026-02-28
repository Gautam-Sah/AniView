function AnimeDetailsSkeleton() {
  return (
    <div className="anime-details-page">
      <div className="anime-details-header">
        {/* Cover image placeholder */}
        <div className="anime-cover skeleton" />

        <div className="anime-details-info" style={{ flex: 1 }}>
          {/* Title */}
          <div className="skeleton-text" style={{ width: "70%", height: 28, marginBottom: 20 }} />

          {/* Synopsis lines */}
          <div className="skeleton-text" style={{ width: "100%", marginBottom: 8 }} />
          <div className="skeleton-text" style={{ width: "100%", marginBottom: 8 }} />
          <div className="skeleton-text" style={{ width: "85%", marginBottom: 8 }} />

          {/* "more" link placeholder */}
          <div className="skeleton-text" style={{ width: 40, marginBottom: 20 }} />

          {/* Info lines: label + value */}
          {[140, 160, 200, 130, 150].map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div className="skeleton-text" style={{ width: 80, height: 14 }} />
              <div className="skeleton-text" style={{ width: w, height: 14 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Episodes section */}
      <div style={{ marginTop: 32 }}>
        <div className="skeleton-text" style={{ width: 120, height: 22, marginBottom: 16 }} />
        <div className="episode-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="episode-item">
              <div className="episode-thumb skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AnimeDetailsSkeleton
