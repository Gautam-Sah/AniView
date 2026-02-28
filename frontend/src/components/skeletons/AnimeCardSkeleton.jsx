function AnimeCardSkeleton() {
  return (
    <div className="anime-card">
      <div className="anime-card-image skeleton" />
      <div className="anime-card-info">
        <div className="skeleton-text" style={{ width: "85%", marginBottom: 6 }} />
        <div className="skeleton-text" style={{ width: "55%" }} />
        <div className="anime-card-meta" style={{ marginTop: 8 }}>
          <div className="skeleton-text" style={{ width: 36, height: 12 }} />
          <div className="skeleton-text" style={{ width: 28, height: 12 }} />
          <div className="skeleton-text" style={{ width: 44, height: 12 }} />
        </div>
      </div>
    </div>
  )
}

export default AnimeCardSkeleton
