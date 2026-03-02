import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getEpisodeVideo, getAnimeDetails, get9animeVideo, getAnimeDaoVideo } from "../api/animeApi";
import VideoPlayerSkeleton from "../components/skeletons/VideoPlayerSkeleton";
import ErrorMessage from "../components/ErrorMessage";

function VideoPlayer() {
  const { animeId, episodeNumber } = useParams();
  const [videoData, setVideoData] = useState(null);
  const [animeTitle, setAnimeTitle] = useState("");
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [activeServer, setActiveServer] = useState("animepahe");
  const [audioType, setAudioType] = useState("sub");
  const [serverLoading, setServerLoading] = useState(false);
  // 9anime servers cached per audio type: { sub: [...], dub: [...] }
  const [nineAnimeCache, setNineAnimeCache] = useState({});
  // animedao cached: { sub: [...], dub: [...] } or null
  const [animeDaoCache, setAnimeDaoCache] = useState(null);

  // Load animepahe data (default)
  const fetchVideo = useCallback(async () => {
    setVideoData(null);
    setSelectedUrl(null);
    setActiveServer("animepahe");
    setAudioType("sub");
    setNineAnimeCache({});
    setAnimeDaoCache(null);
    setLoading(true);
    setError(null);
    try {
      const [data, details] = await Promise.all([
        getEpisodeVideo(animeId, episodeNumber),
        getAnimeDetails(animeId),
      ]);
      setVideoData(data);
      setAnimeTitle(details.title || "");
      setEpisodes(details.episodes || []);

      const bestUrl = pickBestUrl(data.sub) || pickBestUrl(data.dub);
      if (bestUrl) setSelectedUrl(bestUrl);
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to load episode. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }, [animeId, episodeNumber]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  // Fetch 9anime servers for a specific audio type, cache result
  const fetch9animeServers = useCallback(
    async (type) => {
      if (!animeTitle) return null;
      if (nineAnimeCache[type]) return nineAnimeCache[type];

      const result = await get9animeVideo(animeTitle, type, episodeNumber);
      setNineAnimeCache((prev) => ({ ...prev, [type]: result.servers }));
      return result.servers;
    },
    [animeTitle, episodeNumber, nineAnimeCache]
  );

  // Prefetch 9anime and animedao servers in background once animeTitle is available
  useEffect(() => {
    if (!animeTitle) return;
    get9animeVideo(animeTitle, "sub", episodeNumber)
      .then((result) => {
        console.log(`[9anime] Prefetched sub: ${result.servers?.length || 0} servers`);
        setNineAnimeCache((prev) => ({ ...prev, sub: result.servers }));
      })
      .catch((err) => console.warn("[9anime] Background prefetch (sub) failed:", err));
    get9animeVideo(animeTitle, "dub", episodeNumber)
      .then((result) => {
        console.log(`[9anime] Prefetched dub: ${result.servers?.length || 0} servers`);
        setNineAnimeCache((prev) => ({ ...prev, dub: result.servers }));
      })
      .catch((err) => console.warn("[9anime] Background prefetch (dub) failed:", err));
    getAnimeDaoVideo(animeTitle, episodeNumber)
      .then((result) => {
        const sub = result.sub || [];
        const dub = result.dub || [];
        console.log(`[animedao] Prefetched: ${sub.length} sub, ${dub.length} dub`);
        setAnimeDaoCache({ sub, dub });
      })
      .catch((err) => console.warn("[animedao] Background prefetch failed:", err));
  }, [animeTitle, episodeNumber]);

  // Switch to a 9anime server
  const load9animeServer = useCallback(
    async (serverId, type) => {
      const serverIndex = parseInt(serverId.replace("9anime-", ""), 10);

      setServerLoading(true);
      setActiveServer(serverId);
      setSelectedUrl(null);

      try {
        const servers = await fetch9animeServers(type);
        if (servers && servers[serverIndex]) {
          setSelectedUrl(servers[serverIndex].iframe);
        }
      } catch (err) {
        console.error("[9anime] Failed to load server:", err);
        setSelectedUrl(null);
      } finally {
        setServerLoading(false);
      }
    },
    [fetch9animeServers]
  );

  const handleServerClick = (serverId) => {
    if (serverId === activeServer) return;

    if (serverId === "animepahe") {
      setActiveServer("animepahe");
      if (videoData) {
        const bestUrl =
          audioType === "dub"
            ? pickBestUrl(videoData.dub) || pickBestUrl(videoData.sub)
            : pickBestUrl(videoData.sub) || pickBestUrl(videoData.dub);
        setSelectedUrl(bestUrl);
      }
      return;
    }

    if (serverId.startsWith("animedao-")) {
      const idx = parseInt(serverId.replace("animedao-", ""), 10);
      setActiveServer(serverId);
      if (animeDaoCache) {
        const urls = audioType === "dub" ? animeDaoCache.dub : animeDaoCache.sub;
        const url = urls[idx] || null;
        console.log(`[animedao] Loading server ${idx} (${audioType}):`, url ? "found" : "no source");
        setSelectedUrl(url);
      }
      return;
    }

    load9animeServer(serverId, audioType);
  };

  const handleAudioToggle = (type) => {
    if (type === audioType) return;
    setAudioType(type);

    if (activeServer === "animepahe") {
      // For animepahe, just switch the selected URL
      if (videoData) {
        const bestUrl =
          type === "dub"
            ? pickBestUrl(videoData.dub) || pickBestUrl(videoData.sub)
            : pickBestUrl(videoData.sub) || pickBestUrl(videoData.dub);
        setSelectedUrl(bestUrl);
      }
    } else if (activeServer.startsWith("animedao-")) {
      // For animedao, switch sub/dub from cache
      if (animeDaoCache) {
        const idx = parseInt(activeServer.replace("animedao-", ""), 10);
        const urls = type === "dub" ? animeDaoCache.dub : animeDaoCache.sub;
        const url = urls[idx] || null;
        console.log(`[animedao] Switching to ${type} server ${idx}:`, url ? "found" : "no source");
        setSelectedUrl(url);
      }
    } else {
      // For 9anime, re-fetch with new audio type
      load9animeServer(activeServer, type);
    }
  };

  if (loading) return <VideoPlayerSkeleton />;
  if (error) return <ErrorMessage message={error} onRetry={fetchVideo} />;
  if (!videoData) return null;

  const hasSub = videoData.sub && Object.keys(videoData.sub).length > 0;
  const hasDub = videoData.dub && Object.keys(videoData.dub).length > 0;
  const hasAnySources = hasSub || hasDub;
  const isAnimepahe = activeServer === "animepahe";

  const currentEp = Number(episodeNumber);
  const prevEp = currentEp > 1 ? currentEp - 1 : null;
  const nextEp = currentEp + 1;

  // Build server list: animepahe (Fast) + 9anime (Standard) + animedao (Backup)
  const currentServers = nineAnimeCache[audioType];
  const serverButtons = [{ id: "animepahe", label: "Fast" }];
  if (currentServers) {
    currentServers.forEach((_, i) => {
      serverButtons.push({ id: `9anime-${i}`, label: `Standard ${i + 1}` });
    });
  } else {
    serverButtons.push({ id: "9anime-0", label: "Standard 1" });
  }
  // Add animedao servers
  const animeDaoUrls = animeDaoCache
    ? (audioType === "dub" ? animeDaoCache.dub : animeDaoCache.sub)
    : [];
  animeDaoUrls.forEach((_, i) => {
    serverButtons.push({ id: `animedao-${i}`, label: `Backup ${i + 1}` });
  });

  return (
    <div className="video-player-page">
      {animeTitle && <h2><Link to={`/anime/${animeId}`}>{animeTitle}</Link></h2>}
      <h3>Episode {episodeNumber}</h3>

      {/* Audio type toggle + Server selector */}
      <div className="player-controls">
        <div className="audio-toggle">
          <button
            className={`audio-btn${audioType === "sub" ? " active" : ""}`}
            onClick={() => handleAudioToggle("sub")}
            disabled={serverLoading}
          >
            Sub
          </button>
          <button
            className={`audio-btn${audioType === "dub" ? " active" : ""}`}
            onClick={() => handleAudioToggle("dub")}
            disabled={serverLoading}
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
              disabled={serverLoading}
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

      {/* Quality buttons only for animepahe */}
      {isAnimepahe && hasAnySources && (
        <div className="source-options">
          {audioType === "sub" && hasSub && (
            <div className="source-group">
              <h3>Sub (Japanese)</h3>
              <div className="quality-buttons">
                {sortedQualities(videoData.sub).map(([res, url]) => (
                  <button
                    key={`sub-${res}`}
                    className={`quality-btn${selectedUrl === url ? " active" : ""}`}
                    onClick={() => setSelectedUrl(url)}
                  >
                    {res}p
                  </button>
                ))}
              </div>
            </div>
          )}
          {audioType === "dub" && hasDub && (
            <div className="source-group">
              <h3>Dub (English)</h3>
              <div className="quality-buttons">
                {sortedQualities(videoData.dub).map(([res, url]) => (
                  <button
                    key={`dub-${res}`}
                    className={`quality-btn${selectedUrl === url ? " active" : ""}`}
                    onClick={() => setSelectedUrl(url)}
                  >
                    {res}p
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="episode-nav">
        {prevEp && (
          <Link to={`/watch/${animeId}/${prevEp}`} className="nav-btn">
            &larr; Episode {prevEp}
          </Link>
        )}
        <Link to={`/anime/${animeId}`} className="nav-btn">
          Back to Episodes
        </Link>
        <Link to={`/watch/${animeId}/${nextEp}`} className="nav-btn">
          Episode {nextEp} &rarr;
        </Link>
      </div>

      {episodes.length > 0 && (
        <div className="episode-selector">
          <h3>Episodes</h3>
          <div className="episode-selector-grid">
            {episodes.map((ep) => (
              <Link
                key={ep.episodeNumber}
                to={`/watch/${animeId}/${ep.episodeNumber}`}
                className={`episode-selector-item${String(ep.episodeNumber) === String(episodeNumber) ? " current" : ""}`}
              >
                {ep.episodeNumber}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function pickBestUrl(qualityMap) {
  if (!qualityMap) return null;
  const resolutions = Object.keys(qualityMap)
    .map(Number)
    .sort((a, b) => b - a);
  return resolutions.length > 0 ? qualityMap[String(resolutions[0])] : null;
}

function sortedQualities(qualityMap) {
  return Object.entries(qualityMap).sort(
    ([a], [b]) => Number(a) - Number(b)
  );
}

export default VideoPlayer;
