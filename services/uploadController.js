const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const logger = require("../config/logger");

// Helper to determine mime type by magic bytes
const getMimeTypeByMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "image/jpeg";
  }
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
};

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const buffer = req.file.buffer;

    // Validate magic bytes
    const mimeType = getMimeTypeByMagicBytes(buffer);
    if (!mimeType) {
      return res.status(400).json({
        success: false,
        message: "Invalid file signature. Only JPEG, PNG, and WEBP images are allowed.",
      });
    }

    // Determine extension strictly from magic bytes
    let ext;
    if (mimeType === "image/png") ext = ".png";
    else if (mimeType === "image/jpeg") ext = ".jpg";
    else if (mimeType === "image/webp") ext = ".webp";

    // Double-check forbidden extensions
    const forbidden = [".php", ".js", ".sh", ".exe", ".cgi", ".pl", ".py", ".html", ".htm"];
    if (forbidden.includes(ext.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Forbidden file extension determined.",
      });
    }

    // Define target directories
    const publicDir = path.join(__dirname, "..", "public");
    const uploadsDir = path.join(publicDir, "uploads");
    const playersDir = path.join(uploadsDir, "players");

    // Ensure folders exist with 755 permissions
    [publicDir, uploadsDir, playersDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      } else {
        try {
          fs.chmodSync(dir, 0o755);
        } catch (e) {
          // chmodSync might fail on systems like Windows, ignore
        }
      }
    });

    // Write .htaccess file inside uploads and players directories for Apache/cPanel script blocking
    const writeHtaccess = (dirPath) => {
      const htaccessPath = path.join(dirPath, ".htaccess");
      if (!fs.existsSync(htaccessPath)) {
        const content = `Options -ExecCGI
php_flag engine off
<FilesMatch "\\.(php|php5|php7|php8|phtml|pl|py|jsp|sh|cgi|asp|aspx)$">
    Order allow,deny
    Deny from all
</FilesMatch>
`;
        fs.writeFileSync(htaccessPath, content, "utf8");
        try {
          fs.chmodSync(htaccessPath, 0o644);
        } catch (e) {}
      }
    };
    writeHtaccess(uploadsDir);
    writeHtaccess(playersDir);

    // Generate random UUID name
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(playersDir, filename);

    // Process and save with sharp
    try {
      await sharp(buffer)
        .rotate() // correct orientation based on EXIF tag
        .toFile(filePath); // sharp automatically strips metadata unless withMetadata() is explicitly called

      // Set file permissions to 644
      try {
        fs.chmodSync(filePath, 0o644);
      } catch (e) {}
    } catch (sharpError) {
      logger.error("Sharp processing error: " + sharpError.message);
      // Clean up file if it was partially written
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {}
      }
      return res.status(500).json({
        success: false,
        message: "Failed to process and save image",
      });
    }

    // Construct return URL
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const base = process.env.BASE_URL || `${protocol}://${host}`;
    const fileUrl = `${base.replace(/\/+$/, "")}/public/uploads/players/${filename}`;

    return res.status(200).json({
      success: true,
      profile_image_url: fileUrl,
    });
  } catch (error) {
    logger.error("Upload controller error: " + error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during file upload",
    });
  }
};
