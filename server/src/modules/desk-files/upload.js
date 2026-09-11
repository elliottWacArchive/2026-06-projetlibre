/** @format */

const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const config = require('../../config');

const refusedExtensions = new Set([
	'.exe',
	'.msi',
	'.bat',
	'.cmd',
	'.com',
	'.scr',
	'.pif',
	'.sh',
	'.bash',
	'.ps1',
	'.vbs',
	'.jar',
	'.app',
	'.dmg',
]);

const storage = multer.diskStorage({
	destination: config.fileStoragePath,

	filename: (req, file, callback) => {
		const extension = path.extname(file.originalname).toLowerCase();
		const storedName = `${crypto.randomUUID()}${extension}`;

		callback(null, storedName);
	},
});

const upload = multer({
	storage,

	limits: {
		fileSize: config.maxFileSize,
	},

	fileFilter: (req, file, callback) => {
		const extension = path.extname(file.originalname).toLowerCase();

		if (refusedExtensions.has(extension)) {
			return callback(new Error('type de fichier interdit'));
		}

		callback(null, true);
	},
});

module.exports = upload;