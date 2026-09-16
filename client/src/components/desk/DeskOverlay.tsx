/** @format */

'use client';

import {
	type DragEvent,
	type SyntheticEvent,
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	api,
	getDeskFileDownloadUrl,
	type DeskFile,
	type DeskNote,
	type DeskNoteColor,
} from '@/lib/api';

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
	/* Post-its */
	const [notes, setNotes] = useState<DeskNote[]>([]);
	const [content, setContent] = useState('');
	const [color, setColor] = useState<DeskNoteColor>('yellow');
	const [notesLoading, setNotesLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	/* Documents */
	const [files, setFiles] = useState<DeskFile[]>([]);
	const [filesLoading, setFilesLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [dragging, setDragging] = useState(false);

	const [error, setError] = useState('');

	const fileInputRef = useRef<HTMLInputElement>(null);

	/* Chargement des post-its et documents */
	useEffect(() => {
		let cancelled = false;

		async function loadDesk() {
			setNotesLoading(true);
			setFilesLoading(true);
			setError('');

			try {
				const [notesData, filesData] = await Promise.all([
					api.deskNotes(deskId),
					api.deskFiles(deskId),
				]);

				if (!cancelled) {
					setNotes(notesData.notes);
					setFiles(filesData.files);
				}
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error
							? err.message
							: 'Impossible de charger le bureau'
					);
				}
			} finally {
				if (!cancelled) {
					setNotesLoading(false);
					setFilesLoading(false);
				}
			}
		}

		loadDesk();

		return () => {
			cancelled = true;
		};
	}, [deskId]);

	/* Fermeture avec Échap */
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
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

	async function handleDeleteNote(noteId: number) {
		setError('');

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

	async function uploadFile(file: File) {
		if (uploading) return;

		setUploading(true);
		setError('');

		try {
			const data = await api.uploadDeskFile(deskId, file);

			setFiles((prev) => [...prev, data.file]);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Impossible d'uploader le document"
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];

		if (!file) return;

		await uploadFile(file);

		event.target.value = '';
	}

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragging(true);
	}

	function handleDragLeave(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragging(false);
	}

	async function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragging(false);

		const file = event.dataTransfer.files?.[0];

		if (!file) return;

		await uploadFile(file);
	}

	async function handleVisibility(file: DeskFile) {
		setError('');

		try {
			const data = await api.setDeskFileVisibility(
				deskId,
				file.id,
				!file.is_hidden
			);

			setFiles((prev) =>
				prev.map((currentFile) =>
					currentFile.id === file.id ? data.file : currentFile
				)
			);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de modifier la visibilité'
			);
		}
	}

	async function handleDeleteFile(fileId: number) {
		setError('');

		try {
			await api.deleteDeskFile(deskId, fileId);

			setFiles((prev) => prev.filter((file) => file.id !== fileId));
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Impossible de supprimer le document'
			);
		}
	}

	return (
		<div className="desk-overlay">
			<div className="desk-overlay-panel">
				<div className="desk-overlay-header">
					<h2>Bureau</h2>

					<button
						type="button"
						className="desk-overlay-close"
						onClick={onClose}
						aria-label="Fermer">
						×
					</button>
				</div>

				<section className="desk-files-section">
					<h3>Documents</h3>

					{filesLoading && (
						<p className="desk-files-empty">
							Chargement des documents...
						</p>
					)}

					{!filesLoading && files.length === 0 && (
						<p className="desk-files-empty">
							Aucun document sur ce bureau.
						</p>
					)}

					{!filesLoading && files.length > 0 && (
						<div className="desk-file-stack">
							{files.map((file, index) => (
								<article
									key={file.id}
									className={`desk-file-sheet ${
										file.is_hidden ? 'desk-file-hidden' : ''
									}`}
									style={
										{
											'--sheet-index': index,
										} as React.CSSProperties
									}>
									<div className="desk-file-icon">📄</div>

									<div className="desk-file-info">
										<strong>{file.original_name}</strong>

										{file.is_hidden && (
											<span className="desk-file-private">
												Masqué
											</span>
										)}
									</div>

									<div className="desk-file-actions">
										<a
											href={getDeskFileDownloadUrl(
												deskId,
												file.id
											)}
											target="_blank"
											rel="noreferrer">
											Télécharger
										</a>

										<button
											type="button"
											onClick={() =>
												handleVisibility(file)
											}>
											{file.is_hidden
												? 'Afficher'
												: 'Masquer'}
										</button>

										<button
											type="button"
											onClick={() =>
												handleDeleteFile(file.id)
											}>
											Supprimer
										</button>
									</div>
								</article>
							))}
						</div>
					)}

					<div
						className={`desk-file-dropzone ${
							dragging ? 'is-dragging' : ''
						}`}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}>
						<input
							ref={fileInputRef}
							type="file"
							hidden
							onChange={handleFileInput}
						/>

						<p>Glissez un document ici ou choisissez un fichier.</p>

						<button
							type="button"
							disabled={uploading}
							onClick={() => fileInputRef.current?.click()}>
							{uploading
								? 'Upload en cours...'
								: 'Ajouter un document'}
						</button>
					</div>
				</section>

				<section className="desk-postits-section">
					<h3>Post-its</h3>

					<div className="desk-notes-list">
						{notesLoading && (
							<p className="desk-notes-empty">Chargement...</p>
						)}

						{!notesLoading && notes.length === 0 && (
							<p className="desk-notes-empty">
								Aucun post-it sur ce bureau.
							</p>
						)}

						{!notesLoading &&
							notes.map((note) => (
								<article
									key={note.id}
									className={`desk-note desk-note-${note.color}`}>
									<div className="desk-note-content">
										{note.content}
									</div>

									<div className="desk-note-meta">
										<span>{note.authorUsername}</span>

										<span>
											{formatDate(note.createdAt)}
										</span>

										<button
											type="button"
											onClick={() =>
												handleDeleteNote(note.id)
											}>
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
											onChange={() =>
												setColor(item.value)
											}
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
				</section>

				{error && <p className="desk-overlay-error">{error}</p>}
			</div>
		</div>
	);
}
