import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";

export async function getConfigs(req, res, next) {
  try {
    const {
      page = "1",
      size = "10",
      name,
      type,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const sizeNum = parseInt(size);
    const skip = (pageNum - 1) * sizeNum;

    // Build filter conditions
    const where = {};

    if (name) {
      where.name = {
        contains: name,
      };
    }

    if (type) {
      where.configTypeId = type;
    }

    // Get total count for pagination
    const total = await prisma.config.count({ where });

    // Get configs with technicials relation
    const configs = await prisma.config.findMany({
      where,
      include: {
        configType: true,
      },
      skip,
      take: sizeNum,
      orderBy: {
        [sortBy]: sortOrder === "asc" ? "asc" : "desc",
      },
    });

    return res.json({
      success: true,
      data: configs,
      pagination: {
        page: pageNum,
        size: sizeNum,
        total,
        totalPages: Math.ceil(total / sizeNum),
      },
    });
  } catch (error) {
    next(createError(500, error));
  }
}

export async function getConfigById(req, res, next) {
  try {
    const { id } = req.params;

    const config = await prisma.config.findUnique({
      where: { id },
    });

    if (!config) {
      return next(createError(404, "ไม่พบ config"));
    }

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(createError(500, error));
  }
}

export async function createConfig(req, res, next) {
  try {
    const { name, configTypeId } = req.body;

    // Validate required fields
    if (!name) {
      return next(createError(409, "กรุณากรอกชื่อ config"));
    }

    if (!configTypeId) {
      return next(createError(409, "กรุณาเลือก configType"));
    }

    const config = await prisma.config.create({
      data: {
        name,
        configTypeId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "สร้าง config สำเร็จ",
      data: config,
    });
  } catch (error) {
    next(createError(500, error));
  }
}

export async function getConfigTypes(req, res, next) {
  try {
    const configTypes = await prisma.configType.findMany();
    return res.json({
      success: true,
      data: configTypes,
    });
  } catch (error) {
    next(createError(500, error));
  }
}

export async function createConfigsType(req, res, next) {
  try {
    const { name } = req.body;

    if (!name) {
      return next(createError(409, "กรุณากรอกชื่อประเภท"));
    }

    const configType = await prisma.configType.create({
      data: { name },
    });
    return res.status(201).json({
      success: true,
      message: "สร้าง config type สำเร็จ",
      data: configType,
    });
  } catch (error) {
    next(createError(500, error));
  }
}

export async function updateConfig(req, res, next) {
  try {
    const { id } = req.params;
    const { name, configTypeId } = req.body;

    // Check if config exists
    const existingConfig = await prisma.config.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return next(createError(404, "ไม่พบ config"));
    }

    // Update config
    const config = await prisma.config.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(configTypeId && { configTypeId }),
      },
    });

    return res.json({
      success: true,
      message: "อัพเดท config สำเร็จ",
      data: config,
    });
  } catch (error) {
    next(createError(500, error));
  }
}

export async function deleteConfig(req, res, next) {
  try {
    const { id } = req.params;

    // Check if config exists
    const existingConfig = await prisma.config.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return next(createError(404, "ไม่พบ config"));
    }

    // Delete config
    await prisma.config.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "ลบ config สำเร็จ",
    });
  } catch (error) {
    next(createError(500, error));
  }
}
