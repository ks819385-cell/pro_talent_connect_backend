const Enquiry = require("../Models/Enquiry");
const ProfileRequest = require("../Models/ProfileRequest");
const { calculateScoutReport } = require("./scoutReportCalculator");
const Player = require("../Models/Players");
const { AppError, catchAsync } = require("../Middleware/errorHandler");

// Submit enquiry form
const submitEnquiry = catchAsync(async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      throw new AppError("Please provide all required fields", 400);
    }

    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      subject,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully. We'll get back to you soon!",
      enquiry,
    });
});

// Submit profile creation request
const submitProfileRequest = catchAsync(async (req, res) => {
    const {
      fullName,
      email,
      phone,
      dateOfBirth,
      nationality,
      city,
      playingPosition,
      preferredFoot,
      height,
      weight,
      currentClub,
      yearsOfExperience,
      achievements,
      videoLink,
    } = req.body;

    // Validate required fields
    if (
      !fullName ||
      !email ||
      !phone ||
      !dateOfBirth ||
      !nationality ||
      !city ||
      !playingPosition ||
      !preferredFoot ||
      !height ||
      !weight ||
      !yearsOfExperience
    ) {
      throw new AppError("Please provide all required fields", 400);
    }

    const profileRequest = await ProfileRequest.create({
      fullName,
      email,
      phone,
      dateOfBirth,
      nationality,
      city,
      playingPosition,
      preferredFoot,
      height,
      weight,
      currentClub,
      yearsOfExperience,
      achievements,
      videoLink,
    });

    res.status(201).json({
      success: true,
      message:
        "Profile creation request submitted successfully! Our team will review your information and contact you within 2-3 business days.",
      profileRequest,
    });
});

// Get all enquiries (Admin only)
const getAllEnquiries = catchAsync(async (req, res) => {
    const filter = { isDeleted: false };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const enquiries = await Enquiry.find(filter).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: enquiries.length,
      enquiries,
    });
});

// Get all profile requests (Admin only)
const getAllProfileRequests = catchAsync(async (req, res) => {
    const filter = { isDeleted: false };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const requests = await ProfileRequest.find(filter).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
});

// Update enquiry status (Admin only)
const updateEnquiryStatus = catchAsync(async (req, res) => {
    const { status } = req.body;

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      throw new AppError("Enquiry not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Enquiry status updated",
      enquiry,
    });
});

// Update profile request status (Admin only)
// If approved, automatically create a Player record
const updateProfileRequestStatus = catchAsync(async (req, res) => {
    const { status, adminNotes } = req.body;

    const updateData = { status };
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    const request = await ProfileRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!request) {
      throw new AppError("Profile request not found", 404);
    }

    // If approved, create a Player record from the profile request data
    let createdPlayer = null;
    if (status === "approved") {
      try {
        // Check if player with this email already exists
        const existingPlayer = await Player.findOne({ email: request.email, isDeleted: false });
        if (!existingPlayer) {
          // Calculate age from dateOfBirth
          const dob = new Date(request.dateOfBirth);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
          }

          // Determine age group
          let age_group = "Senior";
          if (age < 13) age_group = "U13";
          else if (age < 15) age_group = "U15";
          else if (age < 17) age_group = "U17";
          else if (age < 19) age_group = "U19";

          // Generate a unique player ID
          const playerId = `PTC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

          // Build player data
          const playerData = {
            name: request.fullName,
            age,
            age_group,
            playingPosition: request.playingPosition.toUpperCase(),
            preferredFoot: request.preferredFoot,
            playerId,
            dateOfBirth: request.dateOfBirth,
            nationality: request.nationality,
            weight: request.weight,
            height: request.height,
            gender: "Male", // Default, can be updated later
            city: request.city,
            mobileNumber: request.phone,
            email: request.email,
            career_history: request.currentClub ? `Current Club: ${request.currentClub}` : "",
            scouting_notes: request.achievements || "",
            media_links: request.videoLink ? [request.videoLink] : [],
          };

          // Auto-calculate scout report scores
          try {
            playerData.scoutReport = calculateScoutReport({
              age,
              height: request.height,
              weight: request.weight,
              playingPosition: request.playingPosition,
            });
          } catch (scoreErr) {
            console.error("Error calculating scout report for approved profile:", scoreErr.message);
          }

          createdPlayer = await Player.create(playerData);
        }
      } catch (playerErr) {
        console.error("Error creating player from approved request:", playerErr.message);
        // Don't fail the status update if player creation fails
      }
    }

    res.status(200).json({
      success: true,
      message: status === "approved" && createdPlayer
        ? "Profile request approved and player created successfully"
        : "Profile request updated",
      request,
      ...(createdPlayer && { player: createdPlayer }),
    });
});

module.exports = {
  submitEnquiry,
  submitProfileRequest,
  getAllEnquiries,
  getAllProfileRequests,
  updateEnquiryStatus,
  updateProfileRequestStatus,
};
