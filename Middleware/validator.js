/**
 * Input Validation Schemas
 * Using Joi for request validation to prevent injection attacks
 */

const Joi = require('joi');

const PLAYER_ID_PATTERN = /^(PL\d{10}|Player Has No ID)$/;

// Authentication Schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(8).required(),
});

const registerAdminSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
      'string.min': 'Password must be at least 8 characters long',
    }),
  role: Joi.string().valid('Admin', 'Super Admin').default('Admin'),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).required(),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
      'string.min': 'Password must be at least 8 characters long',
    }),
});

const forgotPasswordResetSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
      'string.min': 'Password must be at least 8 characters long',
    }),
});

const emailSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
});

const verifyOtpWithEmailSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const verifyOtpSchema = Joi.object({
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

// Player Schemas
const createPlayerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim(),
  age: Joi.number().integer().min(5).max(100).allow(null, ''),
  age_group: Joi.string().valid('U13', 'U15', 'U17', 'U19', 'Senior').required(),
  playingPosition: Joi.string().required().trim(),
  alternativePosition: Joi.string().allow('', null).trim(),
  preferredFoot: Joi.string().valid('Left', 'Right', 'Both').required(),
  transferMarketLink: Joi.string().uri().allow('', null).trim(),
  playerId: Joi.string().required().trim().pattern(PLAYER_ID_PATTERN).messages({
    'string.pattern.base': 'Player ID must look like PL0000000040, or use Player Has No ID when the player does not have an assigned ID',
  }),
  dateOfBirth: Joi.date().required(),
  nationality: Joi.string().required().trim(),
  weight: Joi.number().min(30).max(150).allow(null, ''),
  height: Joi.number().min(100).max(250).allow(null, ''),
  gender: Joi.string().valid('Male', 'Female', 'Other').required(),
  jersey_no: Joi.number().integer().min(0).max(99).allow(null, ''),
  size: Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL').allow('', null),
  state: Joi.string().allow('', null).trim(),
  address: Joi.string().max(500).allow('', null).trim(),
  mobileNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).required(),
  email: Joi.string().email().required().trim().lowercase(),
  profileImage: Joi.string().allow('', null).trim(),
  scouting_notes: Joi.string().max(2000).allow('', null).trim(),
  career_history: Joi.string().max(2000).allow('', null).trim(),
  media_links: Joi.array().items(Joi.string().uri()),
  youtubeVideoUrl: Joi.string().uri().allow('', null).trim(),
  videoThumbnail: Joi.string().uri().allow('', null).trim(),
  videoTitle: Joi.string().max(120).allow('', null).trim(),
  videoDescription: Joi.string().max(300).allow('', null).trim(),
  competitions: Joi.array().items(
    Joi.object({
      name: Joi.string().required().trim(),
      type: Joi.string().max(100).allow('', null).trim(),
      year: Joi.number().integer().min(1900).max(2100).allow(null, ''),
      result: Joi.string().valid('Champion', 'Runner-up', 'Third', 'Participant', '').allow('', null),
    })
  ),
  stateLeague: Joi.string().max(200).allow('', null).trim(),
  currentLeague: Joi.string().max(200).allow('', null).trim(),
  clubTier: Joi.string().valid('', 'Tier 1', 'Tier 2', 'Tier 3').allow('', null),
  sprint30m: Joi.number().min(0).max(10).allow(null, ''),
  sprint50m: Joi.number().min(0).max(15).allow(null, ''),
  mentalityScore: Joi.number().valid(0, 1, 2).allow(null),
  clubsPlayed: Joi.array().items(
    Joi.object({
      clubName: Joi.string().required().trim(),
      clubLogo: Joi.string().allow('', null).trim(),
      duration: Joi.string().allow('', null).trim(),
    })
  ),
  featured: Joi.boolean(),
});

const updatePlayerSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  age: Joi.number().integer().min(5).max(100).allow(null, ''),
  age_group: Joi.string().valid('U13', 'U15', 'U17', 'U19', 'Senior').allow('', null),
  playingPosition: Joi.string().trim(),
  alternativePosition: Joi.string().allow('', null).trim(),
  preferredFoot: Joi.string().valid('Left', 'Right', 'Both').allow('', null),
  transferMarketLink: Joi.string().uri().allow('', null).trim(),
  playerId: Joi.string().trim().pattern(PLAYER_ID_PATTERN).messages({
    'string.pattern.base': 'Player ID must look like PL0000000040, or use Player Has No ID when the player does not have an assigned ID',
  }),
  dateOfBirth: Joi.date(),
  nationality: Joi.string().allow('', null).trim(),
  weight: Joi.number().min(30).max(150).allow(null, ''),
  height: Joi.number().min(100).max(250).allow(null, ''),
  gender: Joi.string().valid('Male', 'Female', 'Other').allow('', null),
  jersey_no: Joi.number().integer().min(0).max(99).allow(null, ''),
  size: Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL').allow('', null),
  state: Joi.string().allow('', null).trim(),
  address: Joi.string().max(500).allow('', null).trim(),
  mobileNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow('', null),
  email: Joi.string().email().trim().lowercase(),
  profileImage: Joi.string().allow('', null).trim(),
  scouting_notes: Joi.string().max(2000).allow('', null).trim(),
  career_history: Joi.string().max(2000).allow('', null).trim(),
  media_links: Joi.array().items(Joi.string().uri()),
  youtubeVideoUrl: Joi.string().uri().allow('', null).trim(),
  videoThumbnail: Joi.string().uri().allow('', null).trim(),
  videoTitle: Joi.string().max(120).allow('', null).trim(),
  videoDescription: Joi.string().max(300).allow('', null).trim(),
  competitions: Joi.array().items(
    Joi.object({
      name: Joi.string().required().trim(),
      type: Joi.string().max(100).allow('', null).trim(),
      year: Joi.number().integer().min(1900).max(2100).allow(null, ''),
      result: Joi.string().valid('Champion', 'Runner-up', 'Third', 'Participant', '').allow('', null),
    })
  ),
  stateLeague: Joi.string().max(200).allow('', null).trim(),
  currentLeague: Joi.string().max(200).allow('', null).trim(),
  clubTier: Joi.string().valid('', 'Tier 1', 'Tier 2', 'Tier 3').allow('', null),
  sprint30m: Joi.number().min(0).max(10).allow(null, ''),
  sprint50m: Joi.number().min(0).max(15).allow(null, ''),
  mentalityScore: Joi.number().valid(0, 1, 2).allow(null),
  clubsPlayed: Joi.array().items(
    Joi.object({
      clubName: Joi.string().required().trim(),
      clubLogo: Joi.string().allow('', null).trim(),
      duration: Joi.string().allow('', null).trim(),
    })
  ),
  featured: Joi.boolean(),
}).min(1);

// Contact Schemas
const enquirySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().required().trim().lowercase(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow('', null),
  subject: Joi.string().min(3).max(200).allow('', null).trim(),
  message: Joi.string().min(10).max(2000).required().trim(),
});

const profileRequestSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required().trim(),
  email: Joi.string().email().required().trim().lowercase(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow('', null),
  dateOfBirth: Joi.date().required(),
  nationality: Joi.string().required().trim(),
  city: Joi.string().required().trim(),
  playingPosition: Joi.string().required().trim(),
  preferredFoot: Joi.string().valid('Left', 'Right', 'Both').required(),
  height: Joi.number().min(100).max(250).required(),
  weight: Joi.number().min(30).max(150).required(),
  currentClub: Joi.string().allow('', null).trim(),
  yearsOfExperience: Joi.number().integer().min(0).max(50).required(),
  achievements: Joi.string().max(1000).allow('', null).trim(),
  videoLink: Joi.string().uri().allow('', null).trim(),
});

// Blog Schemas
const blogSchema = Joi.object({
  title: Joi.string().min(5).max(200).required().trim(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).allow('', null),
  excerpt: Joi.string().min(20).max(500).required().trim(),
  content: Joi.string().min(100).required().trim(),
  author: Joi.string().trim().allow('', null),
  category: Joi.string().required().trim(),
  tags: Joi.array().items(Joi.string().trim()),
  featured_image: Joi.string().allow('').trim(),
  published: Joi.boolean(),
});

const updateBlogSchema = Joi.object({
  title: Joi.string().min(5).max(200).trim(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).allow('', null),
  excerpt: Joi.string().min(20).max(500).trim(),
  content: Joi.string().min(100).trim(),
  category: Joi.string().trim(),
  tags: Joi.array().items(Joi.string().trim()),
  cover_image: Joi.string().allow('', null).trim(),
  image: Joi.string().allow('', null).trim(),
  readTime: Joi.number().integer().min(1).max(120),
  status: Joi.string().valid('DRAFT', 'PUBLISHED'),
}).min(1);

const enquiryStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'in-progress', 'resolved', 'closed').required(),
});

const profileRequestStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewing', 'approved', 'rejected').required(),
  adminNotes: Joi.string().max(2000).allow('', null).trim(),
});

// Validation middleware generator
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    // Replace req.body with sanitized value
    req.body = value;
    next();
  };
};

module.exports = {
  validate,
  loginSchema,
  registerAdminSchema,
  changePasswordSchema,
  forgotPasswordResetSchema,
  emailSchema,
  verifyOtpWithEmailSchema,
  verifyOtpSchema,
  createPlayerSchema,
  updatePlayerSchema,
  enquirySchema,
  profileRequestSchema,
  blogSchema,
  updateBlogSchema,
  enquiryStatusSchema,
  profileRequestStatusSchema,
};
