/** @format */

const db = require('../../db/pool');
const config = require('../../config');

async function getDesk(deskId) {
	const { rows } = await db.query(
		`SELECT id, server_id, owner_id
		 FROM desks
		 WHERE id = $1`,
		[deskId]
	);

	return rows[0] || null;
}

async function isServerMember(serverId, userId) {
	const { rows } = await db.query(
		`SELECT 1
		 FROM room_members
		 WHERE room_id = $1 AND user_id = $2`,
		[serverId, userId]
	);

	return rows.length > 0;
}

async function getFile(fileId) {
	const { rows } = await db.query(
		`SELECT
			f.id,
			f.desk_id,
			f.uploader_id,
			f.original_name,
			f.stored_name,
			f.size,
			f.mime_type,
			f.is_hidden,
			f.created_at,
			d.owner_id,
			d.server_id
		 FROM desk_files f
		 JOIN desks d ON d.id = f.desk_id
		 WHERE f.id = $1`,
		[fileId]
	);

	return rows[0] || null;
}

async function canUploadToDesk(deskId) {
	const { rows } = await db.query(
		`SELECT COUNT(*)::int AS count
		 FROM desk_files
		 WHERE desk_id = $1`,
		[deskId]
	);

	return rows[0].count < config.maxFilesPerDesk;
}

async function createFile({
	deskId,
	uploaderId,
	originalName,
	storedName,
	size,
	mimeType,
}) {
	const { rows } = await db.query(
		`INSERT INTO desk_files (
			desk_id,
			uploader_id,
			original_name,
			stored_name,
			size,
			mime_type
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING
			id,
			desk_id,
			uploader_id,
			original_name,
			size,
			mime_type,
			is_hidden,
			created_at`,
		[deskId, uploaderId, originalName, storedName, size, mimeType]
	);

	return rows[0];
}

async function listFiles(deskId, userId, isOwner) {
	const { rows } = await db.query(
		`SELECT
			f.id,
			f.desk_id,
			f.uploader_id,
			u.username AS uploader_username,
			f.original_name,
			f.size,
			f.mime_type,
			f.is_hidden,
			f.created_at
		 FROM desk_files f
		 JOIN users u ON u.id = f.uploader_id
		 WHERE f.desk_id = $1
		   AND (
				f.is_hidden = false
				OR $2 = true
				OR f.uploader_id = $3
		   )
		 ORDER BY f.created_at DESC`,
		[deskId, isOwner, userId]
	);

	return rows;
}

async function setFileHidden(fileId, isHidden) {
	const { rows } = await db.query(
		`UPDATE desk_files
		 SET is_hidden = $2
		 WHERE id = $1
		 RETURNING
			id,
			desk_id,
			uploader_id,
			original_name,
			size,
			mime_type,
			is_hidden,
			created_at`,
		[fileId, isHidden]
	);

	return rows[0] || null;
}

async function deleteFile(fileId) {
	const { rows } = await db.query(
		`DELETE FROM desk_files
		 WHERE id = $1
		 RETURNING id, stored_name`,
		[fileId]
	);

	return rows[0] || null;
}

module.exports = {
	getDesk,
	isServerMember,
	getFile,
	canUploadToDesk,
	createFile,
	listFiles,
	setFileHidden,
	deleteFile,
};
