/** @format */

const { Router } = require('express');

const authService = require('../auth/service');
const serverService = require('./service');

const router = Router();

async function getAuthenticatedUser(req) {
	return authService.getSessionUser(req.cookies?.sid);
}

async function requireUser(req, res) {
	const user = await getAuthenticatedUser(req);

	if (!user) {
		res.status(401).json({
			code: 'AUTH_REQUIRED',
			message: 'Vous devez être connecté.',
		});

		return null;
	}

	return user;
}

router.get('/current', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const server = await serverService.getCurrentServer();

		if (!server) {
			return res.json({
				server: null,
			});
		}

		res.json({
			server: {
				id: server.id,
				slug: server.slug,
				name: server.name,
				ownerId: server.owner_id,
				capacity: server.capacity,
				visibility: server.visibility,
				members: server.members,
			},
		});
	} catch (err) {
		next(err);
	}
});

router.post('/', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const server = await serverService.createServer({
			name: req.body?.name,
			capacity: req.body?.capacity,
			visibility: req.body?.visibility,
			ownerId: user.id,
		});

		res.status(201).json({
			server: {
				id: server.id,
				slug: server.slug,
				name: server.name,
				ownerId: server.owner_id,
				capacity: server.capacity,
				visibility: server.visibility,
			},
			inviteCode: server.inviteCode,
		});
	} catch (err) {
		next(err);
	}
});

router.delete('/:id', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		await serverService.deleteServer(serverId, user.id);

		res.json({
			ok: true,
		});
	} catch (err) {
		next(err);
	}
});

router.post('/:id/join', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		const result = await serverService.joinServer(
			serverId,
			user.id,
			req.body?.inviteCode
		);

		res.json({
			ok: true,
			code: result.alreadyMember
				? 'ALREADY_MEMBER'
				: 'SERVER_JOINED',
			server: {
				id: result.server.id,
				slug: result.server.slug,
				name: result.server.name,
				ownerId: result.server.owner_id,
				capacity: result.server.capacity,
				visibility: result.server.visibility,
			},
		});
	} catch (err) {
		next(err);
	}
});

router.post('/:id/leave', async (req, res, next) => {
	try {
		const user = await requireUser(req, res);

		if (!user) return;

		const serverId = Number(req.params.id);

		if (!Number.isInteger(serverId)) {
			return res.status(400).json({
				code: 'INVALID_SERVER_ID',
				message: 'Identifiant de serveur invalide.',
			});
		}

		await serverService.leaveServer(serverId, user.id);

		res.json({
			ok: true,
		});
	} catch (err) {
		next(err);
	}
});

module.exports = router;