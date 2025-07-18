import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const screenshotsDir = path.join(uploadsDir, 'screenshots');
const recordingsDir = path.join(uploadsDir, 'recordings');

const ensureDirectoryExists = async (dir: string) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

// Initialize directories
ensureDirectoryExists(uploadsDir);
ensureDirectoryExists(screenshotsDir);
ensureDirectoryExists(recordingsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'screenshot') {
      cb(null, screenshotsDir);
    } else if (file.fieldname === 'recording') {
      cb(null, recordingsDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'screenshot') {
    // Accept only image files for screenshots
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for screenshots'));
    }
  } else if (file.fieldname === 'recording') {
    // Accept video and audio files for recordings
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files are allowed for recordings'));
    }
  } else {
    cb(null, true);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

export const saveBase64Screenshot = async (
  base64Data: string,
  interviewId: string
): Promise<string> => {
  try {
    await ensureDirectoryExists(screenshotsDir);
    
    // Remove data URL prefix if present
    const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const filename = `${interviewId}-${Date.now()}.png`;
    const filepath = path.join(screenshotsDir, filename);
    
    await fs.writeFile(filepath, base64Image, 'base64');
    
    // Return relative path for storage in database
    return `/uploads/screenshots/${filename}`;
  } catch (error) {
    console.error('Error saving screenshot:', error);
    throw error;
  }
};

export const saveAudioRecording = async (
  audioBuffer: Buffer,
  mimeType: string,
  interviewId: string
): Promise<string> => {
  try {
    await ensureDirectoryExists(recordingsDir);
    
    // Determine file extension based on mime type
    let extension = '.wav'; // default
    if (mimeType.includes('mp3')) extension = '.mp3';
    else if (mimeType.includes('m4a')) extension = '.m4a';
    else if (mimeType.includes('ogg')) extension = '.ogg';
    else if (mimeType.includes('webm')) extension = '.webm';
    
    const filename = `${interviewId}-${Date.now()}${extension}`;
    const filepath = path.join(recordingsDir, filename);
    
    await fs.writeFile(filepath, audioBuffer);
    
    // Return relative path for storage in database
    return `/uploads/recordings/${filename}`;
  } catch (error) {
    console.error('Error saving audio recording:', error);
    throw error;
  }
};

export const getFileUrl = (relativePath: string): string => {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  return `${baseUrl}${relativePath}`;
};

export const deleteFile = async (relativePath: string): Promise<void> => {
  try {
    const fullPath = path.join(__dirname, '../../', relativePath);
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw error for file deletion failures
  }
};
