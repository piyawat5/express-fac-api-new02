import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { sendLineMessage } from "../utils/lineNotify.js";

// ดึง HistoryNetAmount ทั้งหมด พร้อม pagination และ filter
export const getAllHistoryNetAmount = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "10",
      netAmountId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // สร้าง filter object
    const where = {};

    if (netAmountId) where.netAmountId = netAmountId;

    // Filter ตาม amount
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }

    // Filter ตามวันที่
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [histories, total] = await Promise.all([
      prisma.historyNetAmount.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          netAmount: true,
          transactions: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              config: true,
            },
          },
        },
      }),
      prisma.historyNetAmount.count({ where }),
    ]);

    res.json({
      data: histories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all history net amount error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล History Net Amount",
      error: error.message,
    });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const {
      title,
      description,
      configId,
      items, // [{ description: string, amount: number }]
      fileUrls, // [string] - URLs จาก Cloudinary ที่ upload แล้ว
    } = req.body;

    const userId = req.user.id; // จาก auth middleware

    // 1. Validate items และคำนวณ amount รวม
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "ต้องมีอย่างน้อย 1 item" });
    }

    const totalAmount = items.reduce((sum, item) => {
      if (!item.amount || typeof item.amount !== "number") {
        throw new Error("amount ของแต่ละ item ต้องเป็นตัวเลข");
      }
      return sum + item.amount;
    }, 0);

    // 2. ดึง NetAmount ล่าสุด
    const currentNetAmount = await prisma.netAmount.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!currentNetAmount) {
      return res.status(500).json({ message: "ไม่พบข้อมูล NetAmount ในระบบ" });
    }

    // 3. คำนวณ NetAmount ใหม่
    const newNetAmountValue = currentNetAmount.amount - totalAmount;

    // 4. สร้าง Transaction พร้อม items, files และ HistoryNetAmount ใน transaction เดียว
    const transaction = await prisma.$transaction(async (tx) => {
      // สร้าง HistoryNetAmount
      const historyNetAmount = await tx.historyNetAmount.create({
        data: {
          netAmountId: currentNetAmount.id,
          amount: newNetAmountValue,
        },
      });

      // อัพเดท NetAmount
      await tx.netAmount.update({
        where: { id: currentNetAmount.id },
        data: { amount: newNetAmountValue },
      });

      // สร้าง Transaction
      const newTransaction = await tx.transaction.create({
        data: {
          title,
          amount: totalAmount,
          description,
          configId,
          ownerId: userId,
          historyNetAmountId: historyNetAmount.id,
          items: {
            create: items.map((item) => ({
              description: item.description,
              amount: item.amount,
            })),
          },
          files:
            fileUrls && fileUrls.length > 0
              ? {
                  create: fileUrls.map((url) => ({
                    fileUrl: url,
                  })),
                }
              : undefined,
        },
        include: {
          items: true,
          files: true,
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          config: true,
          historyNetAmount: true,
        },
      });

      return newTransaction;
    });

    res.status(201).json({
      message: "สร้าง Transaction สำเร็จ",
      data: transaction,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการสร้าง Transaction",
      error: error.message,
    });
  }
};

// อัพเดท Transaction
export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      configId,
      items,
      fileUrls, // URLs ใหม่ทั้งหมด
      statusApproveId,
    } = req.body;

    const userId = req.user.id;

    // ตรวจสอบว่า Transaction มีอยู่จริง
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingTransaction) {
      return res.status(404).json({ message: "ไม่พบ Transaction" });
    }

    // ตรวจสอบสิทธิ์ (เฉพาะเจ้าของหรือ admin เท่านั้น)
    if (existingTransaction.ownerId !== userId && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "ไม่มีสิทธิ์แก้ไข Transaction นี้" });
    }

    // คำนวณ amount ใหม่
    let newTotalAmount = existingTransaction.amount;
    if (items && Array.isArray(items)) {
      newTotalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    }

    // ดึง NetAmount ล่าสุด
    const currentNetAmount = await prisma.netAmount.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!currentNetAmount) {
      return res.status(500).json({ message: "ไม่พบข้อมูล NetAmount" });
    }

    // คำนวณ NetAmount ใหม่ (ต้องบวกเงินเก่าคืน แล้วค่อยลบเงินใหม่)
    const amountDifference = newTotalAmount - existingTransaction.amount;
    const newNetAmountValue = currentNetAmount.amount - amountDifference;

    // อัพเดทใน transaction
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      // สร้าง HistoryNetAmount ใหม่
      const historyNetAmount = await tx.historyNetAmount.create({
        data: {
          netAmountId: currentNetAmount.id,
          amount: newNetAmountValue,
        },
      });

      // อัพเดท NetAmount
      await tx.netAmount.update({
        where: { id: currentNetAmount.id },
        data: { amount: newNetAmountValue },
      });

      // ลบ items เก่าถ้ามีการส่ง items ใหม่มา
      if (items && Array.isArray(items)) {
        await tx.transactionItem.deleteMany({
          where: { transactionId: id },
        });
      }

      // ลบ files เก่าถ้ามีการส่ง fileUrls ใหม่มา
      if (fileUrls !== undefined) {
        await tx.transactionFile.deleteMany({
          where: { transactionId: id },
        });
      }

      // อัพเดท Transaction
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          title: title ?? existingTransaction.title,
          amount: newTotalAmount,
          description: description ?? existingTransaction.description,
          configId: configId ?? existingTransaction.configId,
          statusApproveId:
            statusApproveId ?? existingTransaction.statusApproveId,
          historyNetAmountId: historyNetAmount.id,
          items: items
            ? {
                create: items.map((item) => ({
                  description: item.description,
                  amount: item.amount,
                })),
              }
            : undefined,
          files: fileUrls
            ? {
                create: fileUrls.map((url) => ({
                  fileUrl: url,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
          files: true,
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          config: true,
          historyNetAmount: true,
        },
      });

      return updated;
    });

    res.json({
      message: "อัพเดท Transaction สำเร็จ",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการอัพเดท Transaction",
      error: error.message,
    });
  }
};

// ลบ Transaction
export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return res.status(404).json({ message: "ไม่พบ Transaction" });
    }

    // ตรวจสอบสิทธิ์
    if (transaction.ownerId !== userId && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ลบ Transaction นี้" });
    }

    // ดึง NetAmount ล่าสุด
    const currentNetAmount = await prisma.netAmount.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!currentNetAmount) {
      return res.status(500).json({ message: "ไม่พบข้อมูล NetAmount" });
    }

    // คืนเงินกลับไปที่ NetAmount
    const newNetAmountValue = currentNetAmount.amount + transaction.amount;

    await prisma.$transaction(async (tx) => {
      // สร้าง HistoryNetAmount
      await tx.historyNetAmount.create({
        data: {
          netAmountId: currentNetAmount.id,
          amount: newNetAmountValue,
        },
      });

      // อัพเดท NetAmount
      await tx.netAmount.update({
        where: { id: currentNetAmount.id },
        data: { amount: newNetAmountValue },
      });

      // ลบ Transaction (จะลบ items และ files ตาม cascade)
      await tx.transaction.delete({
        where: { id },
      });
    });

    res.json({ message: "ลบ Transaction สำเร็จ" });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการลบ Transaction",
      error: error.message,
    });
  }
};

// ดึง Transaction ตาม ID
export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        items: true,
        files: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        config: true,
        statusApprove: true,
        historyNetAmount: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: "ไม่พบ Transaction" });
    }

    res.json({ data: transaction });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล Transaction",
      error: error.message,
    });
  }
};

// ดึง Transaction ทั้งหมด พร้อม pagination และ filter
export const getAllTransactions = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "10",
      ownerId,
      configId,
      statusApproveId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // สร้าง filter object
    const where = {};

    if (ownerId) where.ownerId = ownerId;
    if (configId) where.configId = configId;
    if (statusApproveId) where.statusApproveId = parseInt(statusApproveId);

    // Filter ตาม amount
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseFloat(minAmount);
      if (maxAmount) where.amount.lte = parseFloat(maxAmount);
    }

    // Filter ตามวันที่
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Search ใน title หรือ description
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          files: true,
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          approver: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          config: true,
          statusApprove: true,
          historyNetAmount: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูล Transactions",
      error: error.message,
    });
  }
};

// Approve Transaction
export const approveTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { statusApproveId } = req.body;
    const userId = req.user.id;

    // ตรวจสอบว่าเป็น admin หรือไม่
    if (req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "ไม่มีสิทธิ์ approve Transaction" });
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        statusApproveId,
        approveId: userId,
        approveDate: new Date(),
      },
      include: {
        items: true,
        files: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        statusApprove: true,
      },
    });

    res.json({
      message: "Approve Transaction สำเร็จ",
      data: transaction,
    });
  } catch (error) {
    console.error("Approve transaction error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการ approve Transaction",
      error: error.message,
    });
  }
};
