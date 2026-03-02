import { Router } from "express";
import { featured, search, animeDetails, episode, nineAnimeVideo, animeDaoVideo } from "../controllers/animeController.js";

const router = Router();

router.get("/featured", featured);
router.get("/search", search);
router.get("/anime/:animeId", animeDetails);
router.get("/episode/:animeId/:episodeNumber", episode);
router.get("/9anime/video", nineAnimeVideo);
router.get("/animedao/video", animeDaoVideo);

export default router;
