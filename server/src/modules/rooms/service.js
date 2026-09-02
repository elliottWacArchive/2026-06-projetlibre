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

async function getRoom(slug) {
	const { rows } = await db.query(
		`
		SELECT
			id,
			slug,
			name,
			owner_id,
			capacity,
			visibility,
			invite_code_hash,
			created_at
		FROM rooms
		WHERE slug = $1
		`,
		[slug]
	);

	return rows[0] || null;
}

async function listRooms() {
	const { rows } = await db.query(`
		SELECT
			r.id,
			r.slug,
			r.name,
			r.owner_id,
			r.capacity,
			r.visibility,
			COUNT(rc.socket_id)::INTEGER AS connected_players
		FROM rooms r
		LEFT JOIN room_connections rc
			ON rc.room_id = r.id
		GROUP BY r.id
		ORDER BY r.created_at ASC
	`);

	return rows;
}

async function createRoom({
	name,
	capacity = 20,
	visibility = 'public',
	ownerId,
}) {
	const cleanName = String(name || '').trim();

	if (!cleanName) {
		throw httpError(
			400,
			'INVALID_ROOM_NAME',
			'Le nom du serveur est obligatoire.'
		);
	}

	if (cleanName.length > 128) {
		throw httpError(
			400,
			'INVALID_ROOM_NAME',
			'Le nom du serveur ne peut pas dépasser 128 caractères.'
		);
	}

	const numericCapacity = Number(capacity);

	if (
		!Number.isInteger(numericCapacity) ||
		numericCapacity < 1 ||
		numericCapacity > 100
	) {
		throw httpError(
			400,
			'INVALID_CAPACITY',
			'La capacité doit être comprise entre 1 et 100.'
		);
	}

	const cleanVisibility = normalizeVisibility(visibility);

	// Génère un slug unique à partir du nom.
	const baseSlug =
		cleanName
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50) || 'room';

	const client = await db.pool.connect();

	try {
		await client.query('BEGIN');

		let slug = baseSlug;

		for (let i = 1; i <= 100; i++) {
			const candidate = i === 1 ? baseSlug : `${baseSlug}-${i}`;

			const existing = await client.query(
				'SELECT 1 FROM rooms WHERE slug = $1',
				[candidate]
			);

			if (existing.rowCount === 0) {
				slug = candidate;
				break;
			}

			if (i === 100) {
				throw httpError(
					500,
					'SLUG_GENERATION_FAILED',
					'Impossible de générer un identifiant de serveur.'
				);
			}
		}

		const { rows } = await client.query(
			`
			INSERT INTO rooms (
				slug,
				name,
				owner_id,
				capacity,
				visibility
			)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING
				id,
				slug,
				name,
				owner_id,
				capacity,
				visibility
			`,
			[slug, cleanName, ownerId || null, numericCapacity, cleanVisibility]
		);

		const room = rows[0];

		let inviteCode = null;

		if (cleanVisibility === 'private') {
			inviteCode = generateInviteCode();

			await client.query(
				`
				UPDATE rooms
				SET invite_code_hash = $1
				WHERE id = $2
				`,
				[hashInviteCode(inviteCode), room.id]
			);
		}

		// Ajoute le propriétaire comme membre.
		if (ownerId) {
			await client.query(
				`
				INSERT INTO room_members (room_id, user_id)
				VALUES ($1, $2)
				ON CONFLICT (room_id, user_id) DO NOTHING
				`,
				[room.id, ownerId]
			);
		}

		await client.query('COMMIT');

		return {
			...room,
			inviteCode,
		};
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

// Verrouille la room pendant la vérification de la capacité.
async function joinRoom({ slug, userId, socketId, inviteCode }) {
	const client = await db.pool.connect();

	try {
		await client.query('BEGIN');

		const roomResult = await client.query(
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
			WHERE slug = $1
			FOR UPDATE
			`,
			[slug]
		);

		const room = roomResult.rows[0];

		if (!room) {
			throw httpError(
				404,
				'ROOM_NOT_FOUND',
				'Le serveur demandé est introuvable.'
			);
		}

		// Le socket est déjà dans cette room.
		const existingConnection = await client.query(
			`
			SELECT room_id
			FROM room_connections
			WHERE socket_id = $1
			`,
			[socketId]
		);

		if (
			existingConnection.rows[0] &&
			existingConnection.rows[0].room_id === room.id
		) {
			await client.query('COMMIT');

			return {
				room,
				alreadyConnected: true,
			};
		}

		// Vérifie le code si la room est privée.
		if (room.visibility === 'private') {
			if (!inviteCode) {
				throw httpError(
					403,
					'INVITE_CODE_REQUIRED',
					'Un code d’invitation est requis pour rejoindre ce serveur.'
				);
			}

			if (
				!room.invite_code_hash ||
				hashInviteCode(String(inviteCode).trim().toUpperCase()) !==
					room.invite_code_hash
			) {
				throw httpError(
					403,
					'INVALID_INVITE_CODE',
					'Le code d’invitation est invalide.'
				);
			}
		}

		// Le membre existe déjà, pas besoin de recréer son inscription.
		if (userId) {
			const membership = await client.query(
				`
				SELECT 1
				FROM room_members
				WHERE room_id = $1
				AND user_id = $2
				`,
				[room.id, userId]
			);

			if (membership.rowCount === 0) {
				await client.query(
					`
					SELECT room_id
					FROM room_connections
					WHERE socket_id = $1
					FOR UPDATE
					`,
					[socketId]
				);

				const countResult = await client.query(
					`
					SELECT COUNT(*)::INTEGER AS count
					FROM room_connections
					WHERE room_id = $1
					`,
					[room.id]
				);

				const connectedCount = countResult.rows[0].count;

				if (connectedCount >= room.capacity) {
					throw httpError(
						409,
						'ROOM_FULL',
						`Le serveur est complet (${room.capacity} places maximum).`
					);
				}

				await client.query(
					`
					INSERT INTO room_members (room_id, user_id)
					VALUES ($1, $2)
					ON CONFLICT (room_id, user_id) DO NOTHING
					`,
					[room.id, userId]
				);
			}
		}

		// Vérifie qu'il reste une place.
		const connectionCount = await client.query(
			`
			SELECT COUNT(*)::INTEGER AS count
			FROM room_connections
			WHERE room_id = $1
			`,
			[room.id]
		);

		if (connectionCount.rows[0].count >= room.capacity) {
			throw httpError(
				409,
				'ROOM_FULL',
				`Le serveur est complet (${room.capacity} places maximum).`
			);
		}

		// Retire le socket de son ancienne room.
		await client.query(
			`
			DELETE FROM room_connections
			WHERE socket_id = $1
			`,
			[socketId]
		);

		await client.query(
			`
			INSERT INTO room_connections (
				room_id,
				socket_id,
				user_id
			)
			VALUES ($1, $2, $3)
			`,
			[room.id, socketId, userId || null]
		);

		await client.query('COMMIT');

		return {
			room,
			alreadyConnected: false,
		};
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function leaveRoom(socketId) {
	await db.query(
		`
		DELETE FROM room_connections
		WHERE socket_id = $1
		`,
		[socketId]
	);
}

async function regenerateInviteCode(roomSlug, ownerId) {
	const room = await getRoom(roomSlug);

	if (!room) {
		throw httpError(
			404,
			'ROOM_NOT_FOUND',
			'Le serveur demandé est introuvable.'
		);
	}

	if (room.owner_id !== ownerId) {
		throw httpError(
			403,
			'ROOM_OWNER_REQUIRED',
			'Seul le propriétaire peut régénérer le code d’invitation.'
		);
	}

	if (room.visibility !== 'private') {
		throw httpError(
			400,
			'ROOM_NOT_PRIVATE',
			'Un serveur public n’a pas besoin de code d’invitation.'
		);
	}

	const inviteCode = generateInviteCode();

	await db.query(
		`
		UPDATE rooms
		SET invite_code_hash = $1
		WHERE id = $2
		`,
		[hashInviteCode(inviteCode), room.id]
	);

	return {
		slug: room.slug,
		inviteCode,
	};
}

module.exports = {
	getRoom,
	listRooms,
	createRoom,
	joinRoom,
	leaveRoom,
	regenerateInviteCode,
};
