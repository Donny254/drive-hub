import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeToExtension = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeToExtension.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
  },
});

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const MAX_DIMENSION = 1800;

const buildWatermarkSvg = () => {
  return `
    <svg width="320" height="54" viewBox="0 0 320 54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wm" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(0, 229, 184, 0.85)" />
          <stop offset="100%" stop-color="rgba(255, 167, 38, 0.85)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" rx="18" ry="18" width="320" height="54" fill="rgba(5, 10, 12, 0.56)" />
      <text x="18" y="34" fill="url(#wm)" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.5">
        WHEELSNATIONKE
      </text>
    </svg>
  `;
};

router.post("/", requireAuth, upload.single("image"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const image = sharp(req.file.buffer, { animated: false }).rotate();
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return res.status(400).json({
        error: `Image too small. Minimum size is ${MIN_WIDTH}x${MIN_HEIGHT}px`,
      });
    }

    if (width / height > 3 || height / width > 3) {
      return res.status(400).json({
        error: "Image aspect ratio is too extreme for marketplace listings",
      });
    }

    const filename = `${crypto.randomUUID()}.webp`;
    const outputPath = path.join(uploadDir, filename);
    const resizedImage = image.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
    const watermarkSvg = buildWatermarkSvg();

    await resizedImage
      .composite([{ input: Buffer.from(watermarkSvg), gravity: "southeast" }])
      .webp({ quality: 84 })
      .toFile(outputPath);

    const relativeUrl = `/uploads/${filename}`;
    return res.status(201).json({ url: relativeUrl });
  } catch (error) {
    return next(error);
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 5MB)" });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error?.message === "Unsupported file type") {
    return res.status(400).json({ error: "Only JPEG, PNG, and WEBP images are allowed" });
  }

  return next(error);
});

export default router;
