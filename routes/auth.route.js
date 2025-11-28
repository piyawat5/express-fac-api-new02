import express from "express";
import { register } from "../controllers/authCookie.controller.js";
import { registerSchema, loginSchema, validate } from "../utils/validator.js";

import {
  createConfig,
  createConfigsType,
  deleteConfig,
  getConfigById,
  getConfigs,
  getConfigTypes,
  updateConfig,
} from "../controllers/config.controller.js";
import {
  getAllHistoryNetAmount,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
  getAllTransactions,
  approveTransaction,
  createStatusApproveId,
} from "../controllers/finance.controller.js";

import { login, authen } from "../controllers/authCookie.controller.js";
import {
  uploadImage,
  uploadMultipleImages,
} from "../controllers/attachFile.controller.js";
import verifyToken from "../config/verify.js";
import multer from "multer";

// ใช้ memory storage สำหรับ multer (เก็บไว้ใน memory ก่อนส่งไป Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // จำกัด 5MB
  },
  fileFilter: (req, file, cb) => {
    // ยอมรับเฉพาะไฟล์รูปภาพ
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น"));
    }
  },
});

const router = express.Router();

// ------------- auth --------------
router.post("/auth/register", validate(registerSchema), register);
router.post("/auth/login", login);
router.post("/auth/verify", authen);

// ------------- upload --------------
router.post("/single", upload.single("image"), uploadImage);
router.post("/multiple", upload.array("images", 10), uploadMultipleImages);

// ------------- config --------------
router.get("/config/type", getConfigTypes); //
router.post("/config/create", createConfig); //
router.put("/config/update/:id", updateConfig); //
router.delete("/config/delete/:id", deleteConfig); //
router.get("/config/:id", getConfigById); //
router.get("/config", getConfigs); //
router.post("/config/type/create", createConfigsType); //
router.post("/transaction/statusApprove", createStatusApproveId); //

// ------------- transaction --------------
router.post("/transaction/create", createTransaction);
router.put("/transaction/edit/:id", updateTransaction);
router.delete("/transaction/delete/:id", deleteTransaction);
router.get("/transaction/:id", getTransactionById);
router.get("/transaction", getAllTransactions);
router.patch("/transaction/approve/:id", approveTransaction);
router.get("/history", getAllHistoryNetAmount);
router.post("/transaction/statusApprove", createStatusApproveId); //

export default router;
