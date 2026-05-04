import express from "express";
import {
  getBaseConfig,
  updateBaseConfig,
} from "../controllers/baseConfigController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: express.Router = express.Router();

router.route("/").get(getBaseConfig).put(protect, admin, updateBaseConfig);

export default router;
