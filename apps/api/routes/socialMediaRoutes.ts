import express, { Router } from "express";
import {
  getSocialMediaLinks,
  getSocialMediaAdmin,
  getSocialMediaById,
  createSocialMedia,
  updateSocialMedia,
  deleteSocialMedia,
} from "../controllers/socialMediaController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

router
  .route("/")
  .get(getSocialMediaLinks)
  .post(protect, admin, createSocialMedia);
router.route("/admin").get(protect, admin, getSocialMediaAdmin);

router
  .route("/:id")
  .get(protect, admin, getSocialMediaById)
  .put(protect, admin, updateSocialMedia)
  .delete(protect, admin, deleteSocialMedia);

export default router;
