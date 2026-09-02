/** @format */

const { Router } = require('express');

const authService = require('../auth/service');
const roomService = require('./service');

const router = Router();

async function getAuthenticatedUser(req) {
	return authService.getSessionUser(req.cookies?.sid);
}

router.get('/', async (req, res, next) => {
	try {
		const rooms = await roomService.listRooms();

		res.json({
			rooms: rooms.map((room) => ({
				id: room.id,
				slug: room.slug,
				name: room.name,
				ownerId: room.owner_id,
				capacity: room.capacity,
				visibility: room.visibility,
				connectedPlayers: room.connected_players,
			})),
		});
	} catch (err) {
		next(err);
	}
});

// GET /rooms/:slug
router.get('/:slug', async (req, res, next) => {
	try {
		const room = await roomService.getRoom(req.params.slug);

		if (!room) {
			return res.status(404).json({
				code: 'ROOM_NOT_FOUND',
				message: 'Le serveur demandé est introuvable.',
			});
		}

		res.json({
			room: {
				id: room.id,
				slug: room.slug,
				name: room.name,
				ownerId: room.owner_id,
				capacity: room.capacity,
				visibility: room.visibility,
			},
		});
	} catch (err) {
		next(err);
	}
});

router.post('/', async (req, res, next) => {
	try {
		const user = await getAuthenticatedUser(req);

		if (!user) {
			return res.status(401).json({
				code: 'AUTH_REQUIRED',
				message: 'Vous devez être connecté pour créer un serveur.',
			});
		}

		const room = await roomService.createRoom({
			name: req.body?.name,
			capacity: req.body?.capacity,
			visibility: req.body?.visibility,
			ownerId: user.id,
		});

		res.status(201).json({
			room: {
				id: room.id,
				slug: room.slug,
				name: room.name,
				ownerId: room.owner_id,
				capacity: room.capacity,
				visibility: room.visibility,
			},
			inviteCode: room.inviteCode,
		});
	} catch (err) {
		next(err);
	}
});

router.post('/:slug/invite-code/regenerate', async (req, res, next) => {
	try {
		const user = await getAuthenticatedUser(req);

		if (!user) {
			return res.status(401).json({
				code: 'AUTH_REQUIRED',
				message: 'Vous devez être connecté.',
			});
		}

		const result = await roomService.regenerateInviteCode(
			req.params.slug,
			user.id
		);

		res.status(201).json(result);
	} catch (err) {
		next(err);
	}
});

module.exports = router;
