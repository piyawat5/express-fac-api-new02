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
  createNetAmount,
  updateNetAmount,
  getAllNetAmounts,
  getNetAmountById,
  withDraw,
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
    console.log("01");
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
router.post("/single", verifyToken, upload.single("image"), uploadImage);
router.post(
  "/multiple",
  verifyToken,
  upload.array("images", 10),
  uploadMultipleImages
);

// ------------- config --------------
router.get("/config/type", verifyToken, getConfigTypes); //
router.post("/config/create", verifyToken, createConfig); //
router.put("/config/update/:id", verifyToken, updateConfig); //
router.delete("/config/delete/:id", verifyToken, deleteConfig); //
router.get("/config/:id", verifyToken, getConfigById); //
router.get("/config", verifyToken, getConfigs); //
router.post("/config/type/create", verifyToken, createConfigsType); //
router.post("/transaction/statusApprove", createStatusApproveId); //

// ------------- transaction --------------
router.post("/transaction/create", verifyToken, createTransaction);
router.put("/transaction/edit/:id", verifyToken, updateTransaction);
router.delete("/transaction/delete/:id", verifyToken, deleteTransaction);
router.get("/transaction/:id", verifyToken, getTransactionById);
router.get("/transaction", verifyToken, getAllTransactions);

router.put("/transaction/approve/:id", approveTransaction); //ใช้บนระบบ Approve เพื่อยิงมาที่ fac
router.post("/transaction/withdraw", verifyToken, withDraw); //ใช้บน fac เพื่อส่งรายการไปยัง Approve
router.get("/history", verifyToken, getAllHistoryNetAmount);

router.post("/netAmount/create", verifyToken, createNetAmount);
router.put("/netAmount/update", verifyToken, updateNetAmount);
router.get("/netAmount/:id", verifyToken, getNetAmountById);
router.get("/netAmount", verifyToken, getAllNetAmounts);

export default router;
