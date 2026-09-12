/** @format */

const db = require('../../db/pool');

const MAX_NOTE_LENGTH = 500;
const ALLOWED_COLORS = new Set(['yellow', 'pink', 'blue', 'green']);

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

async function createNote({ deskId, authorId, content, color }) {
	const trimmedContent = content.trim();

	if (!trimmedContent) {
		const error = new Error('texte requis');
		error.status = 400;
		throw error;
	}

	if (trimmedContent.length > MAX_NOTE_LENGTH) {
		const error = new Error(
			`texte trop long (${MAX_NOTE_LENGTH} caracteres maximum)`
		);
		error.status = 400;
		throw error;
	}

	if (!ALLOWED_COLORS.has(color)) {
		const error = new Error('couleur invalide');
		error.status = 400;
		throw error;
	}

	const { rows } = await db.query(
		`INSERT INTO desk_notes (
			desk_id,
			author_id,
			content,
			color
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
            id,
            desk_id AS "deskId",
            author_id AS "authorId",
            content,
            color,
            created_at AS "createdAt"`,
		[deskId, authorId, trimmedContent, color]
	);

	return rows[0];
}

async function listNotes(deskId) {
	const { rows } = await db.query(
		`SELECT
			n.id,
            n.desk_id AS "deskId",
            n.author_id AS "authorId",
            u.username AS "authorUsername",
            n.content,
            n.color,
            n.created_at AS "createdAt"
		 FROM desk_notes n
		 JOIN users u ON u.id = n.author_id
		 WHERE n.desk_id = $1
		 ORDER BY n.created_at ASC`,
		[deskId]
	);

	return rows;
}

async function getNote(noteId) {
	const { rows } = await db.query(
		`SELECT
			n.id,
			n.desk_id,
			n.author_id,
			n.content,
			n.color,
			n.created_at,
			d.owner_id,
			d.server_id
		 FROM desk_notes n
		 JOIN desks d ON d.id = n.desk_id
		 WHERE n.id = $1`,
		[noteId]
	);

	return rows[0] || null;
}

async function deleteNote(noteId) {
	const { rows } = await db.query(
		`DELETE FROM desk_notes
		 WHERE id = $1
		 RETURNING id, desk_id`,
		[noteId]
	);

	return rows[0] || null;
}

module.exports = {
	getDesk,
	isServerMember,
	createNote,
	listNotes,
	getNote,
	deleteNote,
	MAX_NOTE_LENGTH,
	ALLOWED_COLORS,
};
