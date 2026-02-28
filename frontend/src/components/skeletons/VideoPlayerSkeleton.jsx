function VideoPlayerSkeleton() {
  return (
    <div className="video-player-page">
      {/* "Episode X" title */}
      <h2 style={{ visibility: "hidden" }}>.</h2>
      <div className="skeleton-text" style={{ width: 140, height: 24, position: "relative", top: -40 }} />

      {/* Big black 16:9 player box */}
      <div
        style={{
          background: "#000",
          borderRadius: 8,
          width: "100%",
          aspectRatio: "16 / 9",
          marginBottom: 16,
        }}
      />

      {/* Sub / Dub quality buttons */}
      <div className="source-options">
        {[1, 2].map((g) => (
          <div key={g} className="source-group">
            <div className="skeleton-text" style={{ width: 110, height: 16, marginBottom: 10 }} />
            <div className="quality-buttons">
              {[65, 60, 70].map((w, i) => (
                <div key={i} className="skeleton" style={{ width: w, height: 36, borderRadius: 6 }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Episode nav buttons */}
      <div className="episode-nav">
        {[130, 150, 130].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 38, borderRadius: 6 }} />
        ))}
      </div>

      {/* Episode selector grid */}
      <div className="episode-selector">
        <div className="skeleton-text" style={{ width: 80, height: 18, marginBottom: 12 }} />
        <div className="episode-selector-grid">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="skeleton" style={{ width: 42, height: 42 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default VideoPlayerSkeleton
