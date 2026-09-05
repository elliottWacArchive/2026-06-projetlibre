/** @format */

import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/lib/config';

export interface JoinRoomResponse {
	ok: boolean;
	code: string;
	message: string;
	room?: {
		id: number;
		slug: string;
		name: string;
		capacity: number;
		visibility: 'public' | 'private';
	};
}

let socket: Socket | null = null;

function getSocket() {
	if (!socket) {
		socket = io(SOCKET_URL, {
			transports: ['websocket', 'polling'],
			withCredentials: true,
		});
	}

	return socket;
}

export function joinRoom(
	slug: string,
	inviteCode?: string
): Promise<JoinRoomResponse> {
	return new Promise((resolve, reject) => {
		const client = getSocket();

		const sendJoin = () => {
			client.emit(
				'joinRoom',
				{
					slug,
					inviteCode: inviteCode || undefined,
				},
				(response: JoinRoomResponse) => {
					resolve(response);
				}
			);
		};

		if (client.connected) {
			sendJoin();
			return;
		}

		const handleConnect = () => {
			client.off('connect', handleConnect);
			sendJoin();
		};

		const handleError = (error: Error) => {
			client.off('connect', handleConnect);
			reject(error);
		};

		client.once('connect', handleConnect);
		client.once('connect_error', handleError);
	});
}

export function closeRoomConnection() {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
}