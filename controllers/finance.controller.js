import axios from "axios";
import createError from "../utils/createError.js";
import FormData from "form-data";

async function scanReceiptApi(imageBuffer, originalFilename) {
  const form = new FormData();

  // สร้าง Readable Stream จาก Buffer ใน RAM
  // แนบ Buffer และตั้งชื่อไฟล์เพื่อให้ Cloudmersive ทราบชนิดของไฟล์
  form.append("imageFile", imageBuffer, {
    filename: originalFilename,
    contentType: "application/octet-stream", // หรือ mime-type ที่ถูกต้อง
  });

  const headers = {
    ...form.getHeaders(),
    Apikey: process.env.CLOUDMERSIVE_API_KEY,
  };

  const url = "https://api.cloudmersive.com/receipts/scan/receipt/scan";

  try {
    const response = await axios.post(url, form, { headers: headers });
    return response.data;
  } catch (error) {
    // ... จัดการ Error เหมือนเดิม
    if (error.response && error.response.status === 401) {
      throw new Error(
        "Cloudmersive API Error: Invalid API Key or Quota Exceeded."
      );
    } else if (error.response) {
      throw new Error(
        `Cloudmersive API Error: ${
          error.response.data.Message || "Unknown error"
        }`
      );
    }
    throw new Error("Failed to connect to the Cloudmersive API.");
  }
  // ไม่ต้องมี finally { fs.unlink... } เพราะเราไม่ได้สร้างไฟล์ใน Disk แล้ว
}

export const ocr = async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return next(createError(500, "Missing or invalid file data: receiptImage"));
  }

  const imageBuffer = req.file.buffer; // ข้อมูลไฟล์อยู่ใน Buffer (RAM)
  const originalFilename = req.file.originalname;

  try {
    // ส่ง Buffer และชื่อไฟล์เดิมไปสแกน
    const scanResult = await scanReceiptApi(imageBuffer, originalFilename);

    // ส่งผลลัพธ์ JSON กลับไป
    return res.json({
      success: true,
      data: scanResult,
    });
  } catch (error) {
    console.error("❌ ข้อผิดพลาดในการประมวลผล:", error.message);
    return next(createError(500, error.message));
  }
};
