const Service = require("../Models/Service");
const HowItWork = require("../Models/HowItWork");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

// Get all services
const getAllServices = catchAsync(async (req, res) => {
  const services = await Service.find({ isDeleted: false, isActive: true })
    .sort({ order: 1 })
    .select('-isDeleted -createdBy -updatedBy');
  
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
  const serviceData = {
    ...req.body,
    createdBy: req.admin._id,
  };

  const service = await Service.create(serviceData);

  res.status(201).json({
    success: true,
    message: "Service created successfully",
    service,
  });
});

// Update service (Admin only)
const updateService = catchAsync(async (req, res) => {
  const service = await Service.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    {
      ...req.body,
      updatedBy: req.admin._id,
    },
    { new: true, runValidators: true }
  );

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    service,
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

  res.status(200).json({
    success: true,
    message: "Service deleted successfully",
  });
});

// Get all how it works steps
const getAllHowItWorks = catchAsync(async (req, res) => {
  const steps = await HowItWork.find({ isDeleted: false, isActive: true })
    .sort({ order: 1, stepNumber: 1 })
    .select('-isDeleted -createdBy -updatedBy');
  
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
  const stepData = {
    ...req.body,
    createdBy: req.admin._id,
  };

  const step = await HowItWork.create(stepData);

  res.status(201).json({
    success: true,
    message: "Step created successfully",
    step,
  });
});

// Update how it works step (Admin only)
const updateHowItWork = catchAsync(async (req, res) => {
  const step = await HowItWork.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    {
      ...req.body,
      updatedBy: req.admin._id,
    },
    { new: true, runValidators: true }
  );

  if (!step) {
    throw new AppError("Step not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Step updated successfully",
    step,
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
