import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { sendLineMessage } from "../utils/lineNotify.js";
import axios from "axios";

// GET /api/approve-lists - รับรายการ ApproveList พร้อม pagination
export const getApproveLists = async (req, res, next) => {
  try {
    const {
      page = "1",
      size = "10",
      userId,
      statusApproveId,
      configId,
      search,
    } = req.query;

    const pageNum = parseInt(page);
    const sizeNum = parseInt(size);
    const skip = (pageNum - 1) * sizeNum;

    // สร้าง where condition
    const where = {};

    if (userId) where.userId = userId;
    if (statusApproveId) where.statusApproveId = statusApproveId;
    if (configId) where.configId = configId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { detail: { contains: search } },
        { url: { contains: search } },
      ];
    }

    // นับจำนวนทั้งหมด
    const total = await prisma.approveList.count({ where });

    // ดึงข้อมูลพร้อม pagination
    const approveLists = await prisma.approveList.findMany({
      where,
      skip,
      take: sizeNum,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        StatusApprove: true,
        config: {
          include: {
            configType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: approveLists,
      pagination: {
        page: pageNum,
        size: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum),
        hasNext: pageNum < Math.ceil(total / sizeNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    return next(createError(500, "เกิดข้อผิดพลาดในการดึงข้อมูล"));
  }
};

// GET /api/approve-lists/:id - รับรายละเอียด ApproveList ตาม ID
export const getApproveListById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const approveList = await prisma.approveList.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        StatusApprove: true,
        config: {
          include: {
            configType: true,
          },
        },
      },
    });

    if (!approveList) {
      return next(createError(404, "ไม่พบข้อมูล ApproveList"));
    }

    res.json({
      success: true,
      data: approveList,
    });
  } catch (error) {
    return next(createError(500, "เกิดข้อผิดพลาดในการดึงข้อมูล"));
  }
};

// POST /api/approve-lists - สร้าง ApproveList ใหม่
export const createApproveList = async (req, res, next) => {
  try {
    const {
      apiKey,
      url,
      title,
      detail,
      comment,
      idFrom,
      apiPath,
      statusApproveId,
      configId,
      userId,
    } = req.body;

    // Validation
    if (!url || !title || !detail) {
      return next(createError(400, "กรุณากรอก url, title และ detail"));
    }

    if (apiKey !== process.env.API_KEY) {
      return next(createError(400, "API KEY ไม่ถูกต้อง"));
    }

    const approveList = await prisma.approveList.create({
      data: {
        url,
        title,
        detail,
        comment,
        idFrom,
        apiPath,
        statusApproveId,
        configId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        StatusApprove: true,
        config: {
          include: {
            configType: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "สร้าง ApproveList สำเร็จ",
      data: approveList,
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

export const createStatusApprove = async (req, res, next) => {
  try {
    const { name } = req.body;
    const response = await prisma.statusApprove.create({
      data: {
        name,
      },
    });
    res.status(201).json({
      success: true,
      message: "สร้าง StatusApprove สำเร็จ",
      data: response,
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

// update ต้นทาง
export const updateApproveList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment, statusApproveId, apiPath, idFrom } = req.body;

    // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
    const existingApproveList = await prisma.approveList.findUnique({
      where: { id },
    });

    if (!existingApproveList) {
      return next(createError(404, "ไม่พบข้อมูล ApproveList"));
    }

    const approveList = await prisma.approveList.update({
      where: { id },
      data: {
        ...(comment !== undefined && { comment }),
        ...(statusApproveId !== undefined && { statusApproveId }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
          },
        },
        StatusApprove: true,
        config: {
          include: {
            configType: true,
          },
        },
      },
    });

    const response = await axios.put(`${apiPath}${idFrom}`, {
      statusApproveId,
      comment,
    });

    res.json({
      success: true,
      message: "อัพเดทสถานะสำเร็จ",
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

// DELETE /api/approve-lists/:id - ลบ ApproveList
export const deleteApproveList = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
    const existingApproveList = await prisma.approveList.findUnique({
      where: { id },
    });

    if (!existingApproveList) {
      return next(createError(404, "ไม่พบข้อมูล ApproveList"));
    }

    await prisma.approveList.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "ลบ ApproveList สำเร็จ",
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

// GET /api/approve-lists/user/:userId - รับรายการ ApproveList ของ User
export const getApproveListsByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = "1", size = "10" } = req.query;

    const pageNum = parseInt(page);
    const sizeNum = parseInt(size);
    const skip = (pageNum - 1) * sizeNum;

    const total = await prisma.approveList.count({
      where: { userId },
    });

    const approveLists = await prisma.approveList.findMany({
      where: { userId },
      skip,
      take: sizeNum,
      include: {
        StatusApprove: true,
        config: {
          include: {
            configType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: approveLists,
      pagination: {
        page: pageNum,
        size: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum),
        hasNext: pageNum < Math.ceil(total / sizeNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

export const cronjobNotifyPendingApprove = async (req, res, next) => {
  try {
    const pendingApproves = await prisma.approveList.findMany({
      where: { statusApproveId: 1 }, // 1 คือสถานะ "รอดำเนินการ"
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        config: true,
      },
    });
    if (pendingApproves.length === 0) {
      return res.json({
        success: true,
        message: "ไม่มีรายการรอดำเนินการ",
      });
    }
    let message = "แจ้งเตือนประจำวัน \n รายการที่รออนุมัติ:\n\n";
    pendingApproves.forEach((approve) => {
      message += `- ${approve.title} (${approve.user.firstName} ${approve.user.lastName})\n`;
    });
    // ส่งข้อความแจ้งเตือนผ่าน LINE Notify
    await sendLineMessage(message);
    res.json({
      success: true,
      message: "ส่งการแจ้งเตือนรายการรอดำเนินการสำเร็จ",
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

export const cronjobNotifyMockupFAC = async (req, res, next) => {
  try {
    // const pendingApproves = await prisma.approveList.findMany({
    //   where: { statusApproveId: 1 }, // 1 คือสถานะ "รอดำเนินการ"
    //   include: {
    //     user: {
    //       select: {
    //         firstName: true,
    //         lastName: true,
    //       },
    //     },
    //     config: true,
    //   },
    // });
    // if (pendingApproves.length === 0) {
    //   return res.json({
    //     success: true,
    //     message: "ไม่มีรายการรอดำเนินการ",
    //   });
    // }
    let message = "แจ้งเตือนประจำวัน \n\n";
    message += "💶ระบบ FAC : \n";
    message += "เงินกองกลางคงเหลือ 2,572.00 บาท\n\n";
    message += "✅ระบบ APP : \n";
    message += "ไม่มีรายการแจ้งเตือน\n\n";
    message += "⚙️ระบบ MA : \n";
    message += "ไม่มีรายการแจ้งเตือน\n\n";
    message += "📱ระบบ AC : \n";
    message += "ไม่มีรายการแจ้งเตือน\n\n";
    message += "👶🏻ระบบ Unique : \n";
    message += "ไม่มีรายการแจ้งเตือน";
    // pendingApproves.forEach((approve) => {
    //   message += `- ${approve.title} (${approve.user.firstName} ${approve.user.lastName})\n`;
    // });
    // ส่งข้อความแจ้งเตือนผ่าน LINE Notify
    await sendLineMessage(message);
    res.json({
      success: true,
      message: "ส่งการแจ้งเตือนรายการรอดำเนินการสำเร็จ",
    });
  } catch (error) {
    return next(createError(500, error));
  }
};
