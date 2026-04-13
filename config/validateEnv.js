/**
 * Environment Variable Validation
 * Ensures all required environment variables are present before starting the server
 */

const required = [
  'MONGO_URI',
  'JWT_SECRET',
  'PORT',
  'NODE_ENV',
  'ALLOWED_ORIGINS'
];

const validateEnv = () => {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ FATAL ERROR: Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ FATAL ERROR: JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  // Validate NODE_ENV
  const validEnvironments = ['development', 'production', 'test'];
  if (!validEnvironments.includes(process.env.NODE_ENV)) {
    console.error(`❌ FATAL ERROR: NODE_ENV must be one of: ${validEnvironments.join(', ')}`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const activationUrl =
      (process.env.ADMIN_ACTIVATION_URL && process.env.ADMIN_ACTIVATION_URL.trim()) ||
      (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) ||
      '';

    if (!activationUrl) {
      console.error('❌ FATAL ERROR: In production, set ADMIN_ACTIVATION_URL or FRONTEND_URL');
      process.exit(1);
    }

    if (/localhost|127\.0\.0\.1/i.test(activationUrl)) {
      console.error('❌ FATAL ERROR: ADMIN_ACTIVATION_URL/FRONTEND_URL cannot point to localhost in production');
      process.exit(1);
    }
  }

  console.log('✅ Environment variables validated successfully');
};

module.exports = validateEnv;
