/** @format */

const express = require('express');

const authService = require('../auth/service');
const noteService = require('./service');

const router = express.Router();

async function requireUser(req, res, next) {
	try {
		const user = await authService.getSessionUser(req.cookies?.sid);

		if (!user) {
			return res.status(401).json({
				error: 'authentification requise',
			});
		}

		req.user = user;
		next();
	} catch (err) {
		next(err);
	}
}

router.get('/:deskId/notes', requireUser, async (req, res, next) => {
	try {
		const desk = await noteService.getDesk(req.params.deskId);

		if (!desk) {
			return res.status(404).json({
				error: 'bureau introuvable',
			});
		}

		const isMember = await noteService.isServerMember(
			desk.server_id,
			req.user.id
		);

		if (!isMember) {
			return res.status(403).json({
				error: 'accès refusé',
			});
		}

		const notes = await noteService.listNotes(desk.id);

		res.json({ notes });
	} catch (err) {
		next(err);
	}
});

router.post('/:deskId/notes', requireUser, async (req, res, next) => {
	try {
		const desk = await noteService.getDesk(req.params.deskId);

		if (!desk) {
			return res.status(404).json({
				error: 'bureau introuvable',
			});
		}

		const isMember = await noteService.isServerMember(
			desk.server_id,
			req.user.id
		);

		if (!isMember) {
			return res.status(403).json({
				error: 'accès refusé',
			});
		}

		const { content, color } = req.body || {};

		const note = await noteService.createNote({
			deskId: desk.id,
			authorId: req.user.id,
			content: typeof content === 'string' ? content : '',
			color,
		});

		res.status(201).json({
			ok: true,
			note,
		});
	} catch (err) {
		next(err);
	}
});

router.delete(
	'/:deskId/notes/:noteId',
	requireUser,
	async (req, res, next) => {
		try {
			const note = await noteService.getNote(req.params.noteId);

			if (
				!note ||
				note.desk_id !== Number(req.params.deskId)
			) {
				return res.status(404).json({
					error: 'post-it introuvable',
				});
			}

			const isAuthor = note.author_id === req.user.id;
			const isOwner = note.owner_id === req.user.id;

			if (!isAuthor && !isOwner) {
				return res.status(403).json({
					error: 'accès refusé',
				});
			}

			const deletedNote = await noteService.deleteNote(note.id);

			res.json({
				ok: true,
				note: deletedNote,
			});
		} catch (err) {
			next(err);
		}
	}
);

module.exports = router;