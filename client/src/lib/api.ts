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

export interface DeskFile {
	id: number;
	desk_id: number;
	uploader_id: number;
	uploader_username: string;
	original_name: string;
	size: string;
	mime_type: string;
	is_hidden: boolean;
	created_at: string;
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

export function getDeskFileDownloadUrl(
	deskId: number,
	fileId: number
) {
	return `${SOCKET_URL}/desks/${deskId}/files/${fileId}`;
}

async function uploadDeskFile(
	deskId: number,
	file: File
): Promise<{ ok: boolean; file: DeskFile }> {
	const formData = new FormData();
	formData.append('file', file);

	const res = await fetch(
		`${SOCKET_URL}/desks/${deskId}/files`,
		{
			method: 'POST',
			credentials: 'include',
			body: formData,
		}
	);

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		throw new Error(data.error || 'erreur lors de l’upload');
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
		request<{ ok: boolean; note: DeskNote }>(`/desks/${deskId}/notes`, {
			method: 'POST',
			body: JSON.stringify(body),
		}),

	deleteDeskNote: (deskId: number, noteId: number) =>
		request<{ ok: boolean; note: { id: number; deskId: number } }>(
			`/desks/${deskId}/notes/${noteId}`,
			{
				method: 'DELETE',
			}
		),
	deskFiles: (deskId: number) =>
		request<{ files: DeskFile[] }>(`/desks/${deskId}/files`),

	uploadDeskFile,

	setDeskFileVisibility: (
		deskId: number,
		fileId: number,
		isHidden: boolean
	) =>
		request<{ ok: boolean; file: DeskFile }>(
			`/desks/${deskId}/files/${fileId}/visibility`,
			{
				method: 'PATCH',
				body: JSON.stringify({ isHidden }),
			}
		),

	deleteDeskFile: (deskId: number, fileId: number) =>
		request<{ ok: boolean }>(`/desks/${deskId}/files/${fileId}`, {
			method: 'DELETE',
		}),
};
