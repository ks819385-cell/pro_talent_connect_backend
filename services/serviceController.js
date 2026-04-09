const Service = require("../Models/Service");
const HowItWork = require("../Models/HowItWork");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

const SERVICE_ACTIVE_FILTER = { isDeleted: false, isActive: true };
const HOW_IT_WORKS_ACTIVE_FILTER = { isDeleted: false, isActive: true };

const normalizePositiveInteger = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const resequenceServices = async () => {
  const ordered = await Service.find(SERVICE_ACTIVE_FILTER)
    .sort({ order: 1, updatedAt: -1, createdAt: 1, _id: 1 })
    .select("_id order");

  if (ordered.length === 0) return [];

  const ops = [];
  ordered.forEach((service, index) => {
    const nextOrder = index + 1;
    if (service.order !== nextOrder) {
      ops.push({
        updateOne: {
          filter: { _id: service._id },
          update: { $set: { order: nextOrder } },
        },
      });
    }
  });

  if (ops.length > 0) {
    await Service.bulkWrite(ops);
  }

  return Service.find(SERVICE_ACTIVE_FILTER)
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .select("-isDeleted -createdBy -updatedBy");
};

const resequenceHowItWorks = async () => {
  const ordered = await HowItWork.find(HOW_IT_WORKS_ACTIVE_FILTER)
    .sort({ order: 1, stepNumber: 1, updatedAt: -1, createdAt: 1, _id: 1 })
    .select("_id order stepNumber");

  if (ordered.length === 0) return [];

  const ops = [];
  ordered.forEach((step, index) => {
    const next = index + 1;
    if (step.order !== next || step.stepNumber !== next) {
      ops.push({
        updateOne: {
          filter: { _id: step._id },
          update: { $set: { order: next, stepNumber: next } },
        },
      });
    }
  });

  if (ops.length > 0) {
    await HowItWork.bulkWrite(ops);
  }

  return HowItWork.find(HOW_IT_WORKS_ACTIVE_FILTER)
    .sort({ order: 1, stepNumber: 1, createdAt: 1, _id: 1 })
    .select("-isDeleted -createdBy -updatedBy");
};

// Get all services
const getAllServices = catchAsync(async (req, res) => {
  const services = await resequenceServices();
  
  res.status(200).json({
    success: true,
    count: services.length,
    services,
  });
});

// Get single service
const getServiceById = catchAsync(async (req, res) => {
  const service = await Service.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  res.status(200).json({
    success: true,
    service,
  });
});

// Create service (Admin only)
const createService = catchAsync(async (req, res) => {
  const highest = await Service.findOne(SERVICE_ACTIVE_FILTER)
    .sort({ order: -1 })
    .select("order");

  const nextOrder = normalizePositiveInteger(
    req.body.order,
    (highest?.order || 0) + 1
  );

  const serviceData = {
    ...req.body,
    order: nextOrder,
    createdBy: req.admin._id,
  };

  const created = await Service.create(serviceData);
  await resequenceServices();

  const service = await Service.findOne({ _id: created._id, isDeleted: false })
    .select("-isDeleted -createdBy -updatedBy");

  res.status(201).json({
    success: true,
    message: "Service created successfully",
    service,
  });
});

// Update service (Admin only)
const updateService = catchAsync(async (req, res) => {
  const updateData = {
    ...req.body,
    updatedBy: req.admin._id,
  };

  if (updateData.order !== undefined) {
    updateData.order = normalizePositiveInteger(updateData.order, 1);
  }

  const service = await Service.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    updateData,
    { new: true, runValidators: true }
  );

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  await resequenceServices();

  const refreshedService = await Service.findOne({ _id: service._id, isDeleted: false })
    .select("-isDeleted -createdBy -updatedBy");

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    service: refreshedService,
  });
});

// Delete service (Admin only)
const deleteService = catchAsync(async (req, res) => {
  const service = await Service.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { isDeleted: true, updatedBy: req.admin._id },
    { new: true }
  );

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  await resequenceServices();

  res.status(200).json({
    success: true,
    message: "Service deleted successfully",
  });
});

// Get all how it works steps
const getAllHowItWorks = catchAsync(async (req, res) => {
  const steps = await resequenceHowItWorks();
  
  res.status(200).json({
    success: true,
    count: steps.length,
    steps,
  });
});

// Get single how it works step
const getHowItWorkById = catchAsync(async (req, res) => {
  const step = await HowItWork.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!step) {
    throw new AppError("Step not found", 404);
  }

  res.status(200).json({
    success: true,
    step,
  });
});

// Create how it works step (Admin only)
const createHowItWork = catchAsync(async (req, res) => {
  const highest = await HowItWork.findOne(HOW_IT_WORKS_ACTIVE_FILTER)
    .sort({ order: -1 })
    .select("order");

  const requested =
    req.body.order !== undefined ? req.body.order : req.body.stepNumber;
  const nextOrder = normalizePositiveInteger(
    requested,
    (highest?.order || 0) + 1
  );

  const stepData = {
    ...req.body,
    order: nextOrder,
    stepNumber: normalizePositiveInteger(req.body.stepNumber, nextOrder),
    createdBy: req.admin._id,
  };

  const created = await HowItWork.create(stepData);
  await resequenceHowItWorks();

  const step = await HowItWork.findOne({ _id: created._id, isDeleted: false })
    .select("-isDeleted -createdBy -updatedBy");

  res.status(201).json({
    success: true,
    message: "Step created successfully",
    step,
  });
});

// Update how it works step (Admin only)
const updateHowItWork = catchAsync(async (req, res) => {
  const updateData = {
    ...req.body,
    updatedBy: req.admin._id,
  };

  if (updateData.order !== undefined) {
    updateData.order = normalizePositiveInteger(updateData.order, 1);
  }
  if (updateData.stepNumber !== undefined) {
    updateData.stepNumber = normalizePositiveInteger(updateData.stepNumber, 1);
  }

  const step = await HowItWork.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    updateData,
    { new: true, runValidators: true }
  );

  if (!step) {
    throw new AppError("Step not found", 404);
  }

  await resequenceHowItWorks();

  const refreshedStep = await HowItWork.findOne({ _id: step._id, isDeleted: false })
    .select("-isDeleted -createdBy -updatedBy");

  res.status(200).json({
    success: true,
    message: "Step updated successfully",
    step: refreshedStep,
  });
});

// Delete how it works step (Admin only)
const deleteHowItWork = catchAsync(async (req, res) => {
  const step = await HowItWork.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { isDeleted: true, updatedBy: req.admin._id },
    { new: true }
  );

  if (!step) {
    throw new AppError("Step not found", 404);
  }

  await resequenceHowItWorks();

  res.status(200).json({
    success: true,
    message: "Step deleted successfully",
  });
});

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getAllHowItWorks,
  getHowItWorkById,
  createHowItWork,
  updateHowItWork,
  deleteHowItWork,
};
