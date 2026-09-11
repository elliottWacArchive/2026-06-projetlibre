/** @format */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');

const config = require('./config');
const migrate = require('./db/migrate');
const authRoutes = require('./modules/auth/routes');
const authService = require('./modules/auth/service');
const apiRoutes = require('./modules/api/routes');
const world = require('./modules/world/socket');
const chat = require('./modules/chat/socket');

const roomRoutes = require('./modules/rooms/routes');
const roomSocket = require('./modules/rooms/socket');
const serverRoutes = require('./modules/server/routes');
const deskFileRoutes = require('./modules/desk-files/routes');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/', apiRoutes);
app.use('/rooms', roomRoutes);
app.use('/servers', serverRoutes);
app.use('/desks', deskFileRoutes);

// handler d'erreurs commun aux modules
app.use((err, req, res, next) => {
	const status = err.status || 500;
	if (status >= 500) console.error(err);
	res.status(status).json({
		error: err.status ? err.message : 'erreur serveur',
	});
});

const io = new Server(server, {
	cors: {
		origin: config.clientUrl,
		methods: ['GET', 'POST'],
		credentials: true,
	},
});

// recupere le user via le cookie de session, sinon invite
io.use(async (socket, next) => {
	try {
		const cookies = cookie.parse(socket.handshake.headers.cookie || '');
		socket.data.user = await authService.getSessionUser(cookies.sid);
		next();
	} catch (err) {
		console.error('socket auth:', err.message);
		socket.data.user = null;
		next();
	}
});

io.on('connection', (socket) => {
	console.log(
		`[${new Date().toISOString()}] connexion: ${socket.id} (${socket.data.user ? socket.data.user.username : 'invite'})`
	);
	roomSocket.attach(io, socket);
	world.attach(io, socket);
	chat.attach(io, socket);

	socket.on('error', (error) => {
		console.error(`socket ${socket.id}:`, error);
	});
});

async function main() {
	await migrate();
	server.listen(config.port, '0.0.0.0', () => {
		console.log(`serveur pret sur :${config.port}`);
	});
}

main().catch((err) => {
	console.error('boot fail:', err);
	process.exit(1);
});

process.on('unhandledRejection', (reason) => {
	console.error('unhandled rejection:', reason);
});
