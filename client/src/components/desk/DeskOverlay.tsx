/** @format */

'use client';

import { useEffect, useState } from 'react';
import { api, type DeskNote, type DeskNoteColor } from '@/lib/api';

interface DeskOverlayProps {
	deskId: number;
	onClose: () => void;
}

const COLORS: Array<{ value: DeskNoteColor; label: string }> = [
	{ value: 'yellow', label: 'Jaune' },
	{ value: 'pink', label: 'Rose' },
	{ value: 'blue', label: 'Bleu' },
	{ value: 'green', label: 'Vert' },
];

function formatDate(date: string) {
	return new Date(date).toLocaleString('fr-FR', {
		dateStyle: 'short',
		timeStyle: 'short',
	});
}

export default function DeskOverlay({ deskId, onClose }: DeskOverlayProps) {
	const [notes, setNotes] = useState<DeskNote[]>([]);
	const [content, setContent] = useState('');
	const [color, setColor] = useState<DeskNoteColor>('yellow');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;

		async function loadNotes() {
			setLoading(true);
			setError('');

			try {
				const data = await api.deskNotes(deskId);

				if (!cancelled) {
					setNotes(data.notes);
				}
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error
							? err.message
							: 'Impossible de charger les post-its'
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadNotes();

		return () => {
			cancelled = true;
		};
	}, [deskId]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();

		const trimmed = content.trim();

		if (!trimmed || saving) return;

		setSaving(true);
		setError('');

		try {
			const data = await api.createDeskNote(deskId, {
				content: trimmed,
				color,
			});

			setNotes((prev) => [...prev, data.note]);
			setContent('');
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de créer le post-it'
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(noteId: number) {
		try {
			await api.deleteDeskNote(deskId, noteId);

			setNotes((prev) => prev.filter((note) => note.id !== noteId));
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de supprimer le post-it'
			);
		}
	}

	return (
		<div className="desk-overlay">
			<div className="desk-overlay-panel">
				<div className="desk-overlay-header">
					<h2>Post-its</h2>

					<button
						type="button"
						className="desk-overlay-close"
						onClick={onClose}
						aria-label="Fermer">
						×
					</button>
				</div>

				<div className="desk-notes-list">
					{loading && (
						<p className="desk-notes-empty">Chargement...</p>
					)}

					{!loading && notes.length === 0 && (
						<p className="desk-notes-empty">
							Aucun post-it sur ce bureau.
						</p>
					)}

					{!loading &&
						notes.map((note) => (
							<article
								key={note.id}
								className={`desk-note desk-note-${note.color}`}>
								<div className="desk-note-content">
									{note.content}
								</div>

								<div className="desk-note-meta">
									<span>{note.authorUsername}</span>

									<span>{formatDate(note.createdAt)}</span>

									<button
										type="button"
										onClick={() => handleDelete(note.id)}>
										Supprimer
									</button>
								</div>
							</article>
						))}
				</div>

				<form className="desk-note-form" onSubmit={handleSubmit}>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						maxLength={500}
						placeholder="Écrire un post-it..."
						rows={4}
					/>

					<div className="desk-note-form-footer">
						<div className="desk-note-colors">
							{COLORS.map((item) => (
								<label key={item.value}>
									<input
										type="radio"
										name="desk-note-color"
										value={item.value}
										checked={color === item.value}
										onChange={() => setColor(item.value)}
									/>
									{item.label}
								</label>
							))}
						</div>

						<button
							type="submit"
							disabled={saving || !content.trim()}>
							{saving ? 'Publication...' : 'Poser le post-it'}
						</button>
					</div>

					<div className="desk-note-counter">
						{content.length}/500
					</div>
				</form>

				{error && <p className="desk-overlay-error">{error}</p>}
			</div>
		</div>
	);
}
