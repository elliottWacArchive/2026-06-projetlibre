/** @format */

const service = require('./service');

const COLORS = [
	0x66ccff, 0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da,
	0xfcbad3,
];

function randomColor() {
	return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// cache memoire de la salle, la db reste la source de verite pour les comptes
const players = new Map();

function attach(io, socket) {
	const user = socket.data.user;

	const init = async () => {
		const saved = user ? await service.loadPlayer(user.id) : null;

		const player = {
			id: socket.id,
			userId: user ? user.id : null,
			username: user
				? user.username
				: `Guest_${Math.floor(Math.random() * 1000)}`,
			roomId: socket.data.roomId || null,
			x: saved ? saved.x : 0,
			y: saved ? saved.y : 5,
			z: saved ? saved.z : 0,
			color: saved && saved.color ? saved.color : randomColor(),
			connected: Date.now(),
		};
		players.set(socket.id, player);
		socket.data.player = player;

		socket.emit('init', { playerId: socket.id, player });
		socket.emit('currentPlayers', Array.from(players.values()));
		socket.broadcast.emit('playerJoined', player);

		if (user) await service.savePlayer(user.id, player);
	};

	init().catch((err) => console.error('world init:', err.message));

	socket.on('playerMove', (data) => {
		const player = players.get(socket.id);
		if (!player || typeof data !== 'object') return;

		player.x = Number(data.x) || 0;
		player.y = Number(data.y) || 0;
		player.z = Number(data.z) || 0;

		socket.broadcast.emit('playerMoved', {
			id: socket.id,
			x: player.x,
			y: player.y,
			z: player.z,
		});

		if (player.userId) {
			service.savePlayer(player.userId, player).catch((err) => {
				console.error('world save:', err.message);
			});
		}
	});

	socket.on('disconnect', () => {
		players.delete(socket.id);
		socket.broadcast.emit('playerLeft', socket.id);
	});
}

module.exports = { attach, players };
