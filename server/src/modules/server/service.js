/** @format */

const crypto = require('crypto');
const db = require('../../db/pool');

function httpError(status, code, message) {
	const error = new Error(message);
	error.status = status;
	error.code = code;
	return error;
}

function generateInviteCode() {
	return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function hashInviteCode(code) {
	return crypto.createHash('sha256').update(code).digest('hex');
}

function normalizeVisibility(visibility) {
	if (visibility === 'private') return 'private';
	return 'public';
}

async function getCurrentServer() {
	const { rows } = await db.query(`
		SELECT
			id,
			slug,
			name,
			owner_id,
			capacity,
			visibility,
			created_at
		FROM rooms
		WHERE is_system = false
		ORDER BY created_at ASC
		LIMIT 1
	`);

	if (!rows[0]) return null;

	const server = rows[0];

	const membersResult = await db.query(
		`
		SELECT
			u.id,
			u.username,
			rm.joined_at
		FROM room_members rm
		JOIN users u ON u.id = rm.user_id
		WHERE rm.room_id = $1
		ORDER BY rm.joined_at ASC
		`,
		[server.id]
	);

	return {
		...server,
		members: membersResult.rows,
	};
}

async function createServer({
	name,
	capacity = 20,
	visibility = 'public',
	ownerId,
}) {
	const cleanName = String(name || '').trim();

	if (!cleanName) {
		throw httpError(
			400,
			'INVALID_SERVER_NAME',
			'Le nom du serveur est obligatoire.'
		);
	}

	if (cleanName.length > 128) {
		throw httpError(
			400,
			'INVALID_SERVER_NAME',
			'Le nom du serveur ne peut pas dépasser 128 caractères.'
		);
	}

	const numericCapacity = Number(capacity);

	if (
		!Number.isInteger(numericCapacity) ||
		numericCapacity < 2 ||
		numericCapacity > 50
	) {
		throw httpError(
			400,
			'INVALID_CAPACITY',
			'La capacité doit être comprise entre 2 et 50.'
		);
	}

	const cleanVisibility = normalizeVisibility(visibility);

	const client = await db.pool.connect();

	try {
		await client.query('BEGIN');

		// Une seule création de serveur à la fois.
		await client.query('SELECT pg_advisory_xact_lock(741258)');

		const existing = await client.query(
			`
			SELECT id
			FROM rooms
			WHERE is_system = false
			LIMIT 1
			`
		);

		if (existing.rowCount > 0) {
			throw httpError(
				409,
				'SERVER_ALREADY_EXISTS',
				'Un serveur existe déjà.'
			);
		}

		const baseSlug =
			cleanName
				.toLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
				.slice(0, 50) || 'server';

		const { rows } = await client.query(
			`
			INSERT INTO rooms (
				slug,
				name,
				owner_id,
				capacity,
				visibility,
				is_system
			)
			VALUES ($1, $2, $3, $4, $5, false)
			RETURNING
				id,
				slug,
				name,
				owner_id,
				capacity,
				visibility
			`,
			[baseSlug, cleanName, ownerId, numericCapacity, cleanVisibility]
		);

		const server = rows[0];

		let inviteCode = null;

		if (cleanVisibility === 'private') {
			inviteCode = generateInviteCode();

			await client.query(
				`
				UPDATE rooms
				SET invite_code_hash = $1
				WHERE id = $2
				`,
				[hashInviteCode(inviteCode), server.id]
			);
		}

		await client.query(
			`
			INSERT INTO room_members (room_id, user_id)
			VALUES ($1, $2)
			`,
			[server.id, ownerId]
		);

		await client.query('COMMIT');

		return {
			...server,
			inviteCode,
		};
	} catch (error) {
		await client.query('ROLLBACK');

		if (error.code === '23505') {
			throw httpError(
				409,
				'SERVER_ALREADY_EXISTS',
				'Un serveur existe déjà.'
			);
		}

		throw error;
	} finally {
		client.release();
	}
}

async function deleteServer(serverId, userId) {
	const serverResult = await db.query(
		`
		SELECT id, owner_id
		FROM rooms
		WHERE id = $1
		AND is_system = false
		`,
		[serverId]
	);

	const server = serverResult.rows[0];

	if (!server) {
		throw httpError(
			404,
			'SERVER_NOT_FOUND',
			'Le serveur demandé est introuvable.'
		);
	}

	if (server.owner_id !== userId) {
		throw httpError(
			403,
			'SERVER_OWNER_REQUIRED',
			'Seul le propriétaire peut supprimer le serveur.'
		);
	}

	await db.query('DELETE FROM rooms WHERE id = $1 AND is_system = false', [
		serverId,
	]);
}

async function joinServer(serverId, userId, inviteCode) {
	const client = await db.pool.connect();

	try {
		await client.query('BEGIN');

		const serverResult = await client.query(
			`
			SELECT
				id,
				slug,
				name,
				owner_id,
				capacity,
				visibility,
				invite_code_hash
			FROM rooms
			WHERE id = $1
			AND is_system = false
			FOR UPDATE
			`,
			[serverId]
		);

		const server = serverResult.rows[0];

		if (!server) {
			throw httpError(
				404,
				'SERVER_NOT_FOUND',
				'Le serveur demandé est introuvable.'
			);
		}

		const membership = await client.query(
			`
			SELECT 1
			FROM room_members
			WHERE room_id = $1
			AND user_id = $2
			`,
			[serverId, userId]
		);

		if (membership.rowCount > 0) {
			await client.query('COMMIT');

			return {
				alreadyMember: true,
				server,
			};
		}

		if (server.visibility === 'private') {
			if (!inviteCode) {
				throw httpError(
					403,
					'INVITE_CODE_REQUIRED',
					'Un code d’invitation est requis.'
				);
			}

			if (
				!server.invite_code_hash ||
				hashInviteCode(String(inviteCode).trim().toUpperCase()) !==
					server.invite_code_hash
			) {
				throw httpError(
					403,
					'INVALID_INVITE_CODE',
					'Le code d’invitation est invalide.'
				);
			}
		}

		const countResult = await client.query(
			`
			SELECT COUNT(*)::INTEGER AS count
			FROM room_members
			WHERE room_id = $1
			`,
			[serverId]
		);

		const memberCount = countResult.rows[0].count;

		if (memberCount >= server.capacity) {
			throw httpError(
				409,
				'SERVER_FULL',
				`Le serveur est complet (${server.capacity} places maximum).`
			);
		}

		await client.query(
			`
			INSERT INTO room_members (room_id, user_id)
			VALUES ($1, $2)
			`,
			[serverId, userId]
		);

		await client.query('COMMIT');

		return {
			alreadyMember: false,
			server,
		};
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function leaveServer(serverId, userId) {
	const serverResult = await db.query(
		`
		SELECT id, owner_id
		FROM rooms
		WHERE id = $1
		AND is_system = false
		`,
		[serverId]
	);

	const server = serverResult.rows[0];

	if (!server) {
		throw httpError(
			404,
			'SERVER_NOT_FOUND',
			'Le serveur demandé est introuvable.'
		);
	}

	if (server.owner_id === userId) {
		throw httpError(
			400,
			'OWNER_CANNOT_LEAVE',
			'Le propriétaire ne peut pas quitter son serveur.'
		);
	}

	const result = await db.query(
		`
		DELETE FROM room_members
		WHERE room_id = $1
		AND user_id = $2
		`,
		[serverId, userId]
	);

	if (result.rowCount === 0) {
		throw httpError(
			404,
			'NOT_A_MEMBER',
			'Vous ne faites pas partie de ce serveur.'
		);
	}
}

module.exports = {
	getCurrentServer,
	createServer,
	deleteServer,
	joinServer,
	leaveServer,
};
