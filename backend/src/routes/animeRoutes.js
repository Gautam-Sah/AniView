import { Router } from "express";
import { featured, search, animeDetails, episode } from "../controllers/animeController.js";

const router = Router();

router.get("/featured", featured);
router.get("/search", search);
router.get("/anime/:animeId", animeDetails);
router.get("/episode/:animeId/:episodeNumber", episode);

export default router;
