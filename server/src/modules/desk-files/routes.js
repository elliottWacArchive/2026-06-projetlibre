/** @format */

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');

const config = require('../../config');
const authService = require('../auth/service');
const upload = require('./upload');
const deskFileService = require('./service');

const router = express.Router();

async function requireUser(req, res, next) {
	try {
		const user = await authService.getSessionUser(req.cookies?.sid);

		if (!user) {
			return res.status(401).json({ error: 'authentification requise' });
		}

		req.user = user;
		next();
	} catch (err) {
		next(err);
	}
}

router.get('/:deskId/files', requireUser, async (req, res, next) => {
	try {
		const desk = await deskFileService.getDesk(req.params.deskId);

		if (!desk) {
			return res.status(404).json({ error: 'bureau introuvable' });
		}

		const isOwner = desk.owner_id === req.user.id;
		const isMember = await deskFileService.isServerMember(
			desk.server_id,
			req.user.id
		);

		if (!isMember && !isOwner) {
			return res.status(403).json({ error: 'accès refusé' });
		}

		const files = await deskFileService.listFiles(
			desk.id,
			req.user.id,
			isOwner
		);

		res.json({ files });
	} catch (err) {
		next(err);
	}
});

router.get('/:deskId/files/:fileId', requireUser, async (req, res, next) => {
	try {
		const file = await deskFileService.getFile(req.params.fileId);

		if (!file || file.desk_id !== Number(req.params.deskId)) {
			return res.status(404).json({ error: 'fichier introuvable' });
		}

		const isOwner = file.owner_id === req.user.id;
		const isUploader = file.uploader_id === req.user.id;

		if (file.is_hidden && !isOwner && !isUploader) {
			return res.status(403).json({ error: 'accès refusé' });
		}

		if (!file.is_hidden && !isOwner && !isUploader) {
			const isMember = await deskFileService.isServerMember(
				file.server_id,
				req.user.id
			);

			if (!isMember) {
				return res.status(403).json({ error: 'accès refusé' });
			}
		}

		const filePath = path.join(config.fileStoragePath, file.stored_name);

		res.download(filePath, file.original_name, (err) => {
			if (err && !res.headersSent) {
				next(err);
			}
		});
	} catch (err) {
		next(err);
	}
});

router.patch(
	'/:deskId/files/:fileId/visibility',
	requireUser,
	async (req, res, next) => {
		try {
			const file = await deskFileService.getFile(req.params.fileId);

			if (!file || file.desk_id !== Number(req.params.deskId)) {
				return res.status(404).json({ error: 'fichier introuvable' });
			}

			const isOwner = file.owner_id === req.user.id;
			const isUploader = file.uploader_id === req.user.id;

			if (!isOwner && !isUploader) {
				return res.status(403).json({ error: 'accès refusé' });
			}

			if (typeof req.body.isHidden !== 'boolean') {
				return res.status(400).json({
					error: 'isHidden doit être un booléen',
				});
			}

			const updatedFile = await deskFileService.setFileHidden(
				file.id,
				req.body.isHidden
			);

			res.json({
				ok: true,
				file: updatedFile,
			});
		} catch (err) {
			next(err);
		}
	}
);

router.delete('/:deskId/files/:fileId', requireUser, async (req, res, next) => {
	try {
		const file = await deskFileService.getFile(req.params.fileId);

		if (!file || file.desk_id !== Number(req.params.deskId)) {
			return res.status(404).json({ error: 'fichier introuvable' });
		}

		const isOwner = file.owner_id === req.user.id;
		const isUploader = file.uploader_id === req.user.id;

		if (!isOwner && !isUploader) {
			return res.status(403).json({ error: 'accès refusé' });
		}

		const deletedFile = await deskFileService.deleteFile(file.id);

		if (!deletedFile) {
			return res.status(404).json({ error: 'fichier introuvable' });
		}

		const filePath = path.join(
			config.fileStoragePath,
			deletedFile.stored_name
		);

		try {
			await fs.unlink(filePath);
		} catch (err) {
			if (err.code !== 'ENOENT') {
				console.error('suppression fichier physique:', err);
			}
		}

		res.json({
			ok: true,
			file: deletedFile,
		});
	} catch (err) {
		next(err);
	}
});

function handleUpload(req, res, next) {
	upload.single('file')(req, res, (err) => {
		if (!err) {
			return next();
		}

		if (err instanceof multer.MulterError) {
			if (err.code === 'LIMIT_FILE_SIZE') {
				return res.status(413).json({
					error: 'fichier trop volumineux',
				});
			}

			return res.status(400).json({
				error: err.message,
			});
		}

		return res.status(400).json({
			error: err.message,
		});
	});
}

router.post(
	'/:deskId/files',
	requireUser,
	handleUpload,
	async (req, res, next) => {
		try {
			if (!req.file) {
				return res.status(400).json({ error: 'fichier requis' });
			}

			const desk = await deskFileService.getDesk(req.params.deskId);

			if (!desk) {
				return res.status(404).json({ error: 'bureau introuvable' });
			}

			const isMember = await deskFileService.isServerMember(
				desk.server_id,
				req.user.id
			);

			if (!isMember) {
				return res.status(403).json({ error: 'accès refusé' });
			}

			const canUpload = await deskFileService.canUploadToDesk(desk.id);

			if (!canUpload) {
				return res.status(400).json({
					error: 'nombre maximum de fichiers atteint',
				});
			}

			const file = await deskFileService.createFile({
				deskId: desk.id,
				uploaderId: req.user.id,
				originalName: req.file.originalname,
				storedName: req.file.filename,
				size: req.file.size,
				mimeType: req.file.mimetype,
			});

			res.status(201).json({
				ok: true,
				file,
			});
		} catch (err) {
			next(err);
		}
	}
);

module.exports = router;
