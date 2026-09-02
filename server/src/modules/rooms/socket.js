/** @format */

const roomService = require('./service');

function attach(io, socket) {
	// Rejoindre une room
	socket.on(
		'joinRoom',
		async ({ slug = 'lobby', inviteCode } = {}, callback) => {
			try {
				const result = await roomService.joinRoom({
					slug,
					userId: socket.data.user?.id || null,
					socketId: socket.id,
					inviteCode,
				});

				const room = result.room;

				// Quitte les anciennes rooms Socket.io.
				for (const roomName of socket.rooms) {
					if (roomName !== socket.id) {
						socket.leave(roomName);
					}
				}

				socket.join(room.slug);

				socket.data.roomId = room.id;
				socket.data.roomSlug = room.slug;

				if (socket.data.player) {
					socket.data.player.roomId = room.id;
				}

				respond(callback, {
					ok: true,
					code: result.alreadyConnected
						? 'ALREADY_JOINED'
						: 'ROOM_JOINED',
					message: result.alreadyConnected
						? 'Vous êtes déjà dans ce serveur.'
						: 'Vous avez rejoint le serveur.',
					room: {
						id: room.id,
						slug: room.slug,
						name: room.name,
						capacity: room.capacity,
						visibility: room.visibility,
					},
				});
			} catch (err) {
				console.error('room join:', err.message);

				respond(callback, {
					ok: false,
					code: err.code || 'ROOM_JOIN_ERROR',
					message:
						err.message || 'Impossible de rejoindre le serveur.',
				});
			}
		}
	);

	socket.on('disconnect', async () => {
		try {
			await roomService.leaveRoom(socket.id);
		} catch (err) {
			console.error('room leave:', err.message);
		}
	});
}

function respond(callback, data) {
	if (typeof callback === 'function') {
		callback(data);
	}
}

module.exports = {
	attach,
};
