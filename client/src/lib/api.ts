/** @format */

import { SOCKET_URL } from './config';

export interface User {
	id: number;
	username: string;
	email: string;
}

export interface Room {
	id: number;
	slug: string;
	name: string;
	ownerId: number | null;
	capacity: number;
	visibility: 'public' | 'private';
	connectedPlayers: number;
}

export type DeskNoteColor = 'yellow' | 'pink' | 'blue' | 'green';

export interface DeskNote {
        id: number;
        deskId: number;
        authorId: number;
        authorUsername: string;
        content: string;
        color: DeskNoteColor;
        createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(SOCKET_URL + path, {
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		...options,
	});

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		throw new Error(data.error || 'erreur reseau');
	}

	return data;
}

export const api = {
	register: (body: { username: string; email: string; password: string }) =>
		request<{ user: User }>('/auth/register', {
			method: 'POST',
			body: JSON.stringify(body),
		}),

	login: (body: { email: string; password: string }) =>
		request<{ user: User }>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(body),
		}),

	logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

	me: () => request<{ user: User | null }>('/auth/me'),

	rooms: () => request<{ rooms: Room[] }>('/rooms'),

        deskNotes: (deskId: number) =>
                request<{ notes: DeskNote[] }>(`/desks/${deskId}/notes`),

        createDeskNote: (
                deskId: number,
                body: { content: string; color: DeskNoteColor }
        ) =>
                request<{ ok: boolean; note: DeskNote }>(
                        `/desks/${deskId}/notes`,
                        {
                                method: 'POST',
                                body: JSON.stringify(body),
                        }
                ),

        deleteDeskNote: (deskId: number, noteId: number) =>
                request<{ ok: boolean; note: { id: number; deskId: number } }>(
                        `/desks/${deskId}/notes/${noteId}`,
                        {
                                method: 'DELETE',
                        }
                ),
};