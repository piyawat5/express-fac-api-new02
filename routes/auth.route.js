import express from "express";
import { register } from "../controllers/authCookie.controller.js";
import { registerSchema, loginSchema, validate } from "../utils/validator.js";
import {
  getApproveListById,
  getApproveLists,
  createApproveList,
  updateApproveList,
  deleteApproveList,
  getApproveListsByUserId,
  createStatusApprove,
  cronjobNotifyPendingApprove,
  cronjobNotifyMockupFAC,
} from "../controllers/approve.controller.js";

import {
  createConfig,
  createConfigsType,
  deleteConfig,
  getConfigById,
  getConfigs,
  getConfigTypes,
  updateConfig,
} from "../controllers/config.controller.js";

import { login, authen } from "../controllers/authCookie.controller.js";
import verifyToken from "../config/verify.js";
import { ocr } from "../controllers/finance.controller.js";
import upload from "../config/multer.js";

const router = express.Router();

// ------------- auth --------------
router.post("/auth/register", validate(registerSchema), register);
router.get("/approve", verifyToken, getApproveLists);
router.get("/approve/:id", verifyToken, getApproveListById);
router.post("/approve/create", createApproveList);
router.put("/approve/update/:id", verifyToken, updateApproveList);
router.delete("/approve/delete/:id", verifyToken, deleteApproveList);
router.get("/user/:userId", verifyToken, getApproveListsByUserId);

router.post("/approve/statusApprove", createStatusApprove);
router.get("/approve/cronjob/daily-notify", cronjobNotifyPendingApprove);
router.get("/approve/cronjob/daily-notify-fac", cronjobNotifyMockupFAC);
router.post("/ocr", ocr);

// ------------- config --------------
router.get("/config/type", verifyToken, getConfigTypes); //
router.post("/config/create", verifyToken, createConfig); //
router.put("/config/update/:id", verifyToken, updateConfig); //
router.delete("/config/delete/:id", verifyToken, deleteConfig); //
router.get("/config/:id", verifyToken, getConfigById); //
router.get("/config", verifyToken, getConfigs); //
router.post("/config/type/create", verifyToken, createConfigsType); //

router.post("/auth/login", login);
router.post("/auth/verify", authen);
router.post("/upload", ocr);

// router.post("/upload", upload.array("images", 10), uploadFile);
// TODO: validate

export default router;
