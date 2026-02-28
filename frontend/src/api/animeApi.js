import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 60000, // scraping can be slow
});

export async function getFeaturedAnime() {
  const { data } = await api.get("/featured");
  return data.results;
}

export async function searchAnime(query) {
  const { data } = await api.get("/search", { params: { q: query } });
  return data.results;
}

export async function getAnimeDetails(animeId) {
  const { data } = await api.get(`/anime/${animeId}`);
  return data;
}

export async function getEpisodeVideo(animeId, episodeNumber) {
  const { data } = await api.get(`/episode/${animeId}/${episodeNumber}`);
  return data;
}
