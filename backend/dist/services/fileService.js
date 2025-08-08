"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.getFileUrl = exports.saveAudioRecording = exports.saveBase64Screenshot = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const uuid_1 = require("uuid");
const imageKitService_1 = require("./imageKitService");
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
const screenshotsDir = path_1.default.join(uploadsDir, 'screenshots');
const recordingsDir = path_1.default.join(uploadsDir, 'recordings');
const ensureDirectoryExists = async (dir) => {
    try {
        await fs_1.promises.access(dir);
    }
    catch {
        await fs_1.promises.mkdir(dir, { recursive: true });
    }
};
// Initialize directories
ensureDirectoryExists(uploadsDir);
ensureDirectoryExists(screenshotsDir);
ensureDirectoryExists(recordingsDir);
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'screenshot') {
            cb(null, screenshotsDir);
        }
        else if (file.fieldname === 'recording') {
            cb(null, recordingsDir);
        }
        else {
            cb(null, uploadsDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}-${Date.now()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'screenshot') {
        // Accept only image files for screenshots
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed for screenshots'));
        }
    }
    else if (file.fieldname === 'recording') {
        // Accept video and audio files for recordings
        if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only video and audio files are allowed for recordings'));
        }
    }
    else {
        cb(null, true);
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
});
const saveBase64Screenshot = async (base64Data, interviewId) => {
    try {
        // Upload to ImageKit instead of local disk
        const fileName = `${interviewId}-${Date.now()}.png`;
        const upload = await (0, imageKitService_1.uploadBase64Image)({
            base64Data,
            fileName,
            folder: '/aptiview/screenshots'
        });
        return upload.url;
    }
    catch (error) {
        console.error('Error saving screenshot:', error);
        throw error;
    }
};
exports.saveBase64Screenshot = saveBase64Screenshot;
const saveAudioRecording = async (audioBuffer, mimeType, interviewId) => {
    try {
        // Determine file extension based on mime type
        let extension = '.wav'; // default
        if (mimeType?.includes('mp3'))
            extension = '.mp3';
        else if (mimeType?.includes('m4a'))
            extension = '.m4a';
        else if (mimeType?.includes('ogg'))
            extension = '.ogg';
        else if (mimeType?.includes('webm'))
            extension = '.webm';
        const fileName = `${interviewId}-${Date.now()}${extension}`;
        const upload = await (0, imageKitService_1.uploadBuffer)({
            buffer: audioBuffer,
            fileName,
            folder: '/aptiview/recordings',
            mimeType
        });
        return upload.url;
    }
    catch (error) {
        console.error('Error saving audio recording:', error);
        throw error;
    }
};
exports.saveAudioRecording = saveAudioRecording;
const getFileUrl = (relativePath) => {
    // When using ImageKit, URLs are absolute already
    if (relativePath.startsWith('http'))
        return relativePath;
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return `${baseUrl}${relativePath}`;
};
exports.getFileUrl = getFileUrl;
const deleteFile = async (relativePath) => {
    try {
        // No-op for ImageKit (could implement delete via imagekit.deleteFile if fileId stored)
        const fullPath = path_1.default.join(__dirname, '../../', relativePath);
        await fs_1.promises.unlink(fullPath).catch(() => { });
    }
    catch (error) {
        console.error('Error deleting file:', error);
        // Don't throw error for file deletion failures
    }
};
exports.deleteFile = deleteFile;
