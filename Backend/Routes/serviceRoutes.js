const express = require("express");
const router = express.Router();
const {
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
} = require("../services/serviceController");
const { protect } = require("../Middleware/authMiddleware");
const { cacheMiddleware, invalidateCache } = require("../Middleware/cache");

// Public routes - cached for 5 min (rarely changes)
router.get("/services", cacheMiddleware(300, 'services'), getAllServices);
router.get("/services/:id", cacheMiddleware(300, 'services'), getServiceById);
router.get("/how-it-works", cacheMiddleware(300, 'howitworks'), getAllHowItWorks);
router.get("/how-it-works/:id", cacheMiddleware(300, 'howitworks'), getHowItWorkById);

// Protected routes with cache invalidation
router.post("/services", protect, invalidateCache('services'), createService);
router.put("/services/:id", protect, invalidateCache('services'), updateService);
router.delete("/services/:id", protect, invalidateCache('services'), deleteService);

router.post("/how-it-works", protect, invalidateCache('howitworks'), createHowItWork);
router.put("/how-it-works/:id", protect, invalidateCache('howitworks'), updateHowItWork);
router.delete("/how-it-works/:id", protect, invalidateCache('howitworks'), deleteHowItWork);

module.exports = router;
