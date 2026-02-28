import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import AnimeDetails from "./pages/AnimeDetails";
import VideoPlayer from "./pages/VideoPlayer";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <a href="/" className="logo">
          AniView
        </a>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/anime/:animeId" element={<AnimeDetails />} />
          <Route
            path="/watch/:animeId/:episodeNumber"
            element={<VideoPlayer />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
