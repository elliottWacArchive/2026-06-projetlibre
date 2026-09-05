 /** @format */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Visibility = 'public' | 'private';

interface CreatedRoom {
	name: string;
	visibility: Visibility;
	capacity: number;
	inviteCode?: string;
}

const MOCK_EXISTING_ROOM = true;

export default function CreateServerPage() {
	const router = useRouter();

	const [name, setName] = useState('');
	const [visibility, setVisibility] =
		useState<Visibility>('public');
	const [capacity, setCapacity] = useState(10);

	const [errors, setErrors] = useState<string[]>([]);
	const [createdRoom, setCreatedRoom] =
		useState<CreatedRoom | null>(null);

	const validate = () => {
		const validationErrors: string[] = [];

		if (!name.trim()) {
			validationErrors.push(
				'Le nom du salon est obligatoire.'
			);
		}

		if (name.trim().length > 50) {
			validationErrors.push(
				'Le nom du salon ne peut pas dépasser 50 caractères.'
			);
		}

		if (capacity < 2 || capacity > 50) {
			validationErrors.push(
				'La capacité doit être comprise entre 2 et 50 places.'
			);
		}

		return validationErrors;
	};

	const handleCreate = (event: React.FormEvent) => {
		event.preventDefault();

		const validationErrors = validate();

		if (validationErrors.length > 0) {
			setErrors(validationErrors);
			return;
		}

		setErrors([]);

		const room: CreatedRoom = {
			name: name.trim(),
			visibility,
			capacity,
			inviteCode:
				visibility === 'private'
					? generateInviteCode()
					: undefined,
		};

		setCreatedRoom(room);
	};

	const copyInviteCode = async () => {
		if (!createdRoom?.inviteCode) return;

		await navigator.clipboard.writeText(
			createdRoom.inviteCode
		);
	};

	if (MOCK_EXISTING_ROOM) {
		return (
			<main className="servers-page">
				<div className="servers-container">
					<section className="server-empty">
						<h1>Un salon existe déjà</h1>

						<p>
							Un serveur est déjà disponible. Vous pouvez le
							rejoindre plutôt que d'en créer un nouveau.
						</p>

						<div className="server-existing">
							<strong>Lobby</strong>
							<span>Public · 3 / 10 places</span>
						</div>

						<button
							className="btn"
							onClick={() => router.push('/servers')}>
							Rejoindre le salon
						</button>
					</section>
				</div>
			</main>
		);
	}

	if (createdRoom) {
		return (
			<main className="servers-page">
				<div className="servers-container">
					<section className="server-empty">
						<h1>Salon créé</h1>

						<p>
							Le salon <strong>{createdRoom.name}</strong> a
							été créé avec succès.
						</p>

						<div className="server-created-details">
							<div>
								<span>Visibilité</span>
								<strong>
									{createdRoom.visibility === 'private'
										? 'Privé'
										: 'Public'}
								</strong>
							</div>

							<div>
								<span>Capacité</span>
								<strong>
									{createdRoom.capacity} places
								</strong>
							</div>
						</div>

						{createdRoom.inviteCode ? (
							<div className="server-invite-result">
								<label htmlFor="created-invite-code">
									Code d'invitation
								</label>

								<div className="server-invite-copy">
									<input
										id="created-invite-code"
										type="text"
										value={createdRoom.inviteCode}
										readOnly
									/>

									<button
										type="button"
										className="btn btn-ghost"
										onClick={copyInviteCode}>
										Copier
									</button>
								</div>
							</div>
						) : null}

						<button
							className="btn"
							onClick={() => router.push('/servers')}>
							Retour aux serveurs
						</button>
					</section>
				</div>
			</main>
		);
	}

	return (
		<main className="servers-page">
			<div className="servers-container">
				<header className="servers-header">
					<h1>Créer un serveur</h1>
					<p>
						Configure ton espace communautaire avant de
						commencer.
					</p>
				</header>

				<form className="server-form" onSubmit={handleCreate}>
					<div className="server-form-field">
						<label htmlFor="server-name">
							Nom du salon
						</label>

						<input
							id="server-name"
							type="text"
							value={name}
							onChange={(event) =>
								setName(event.target.value)
							}
							placeholder="Ex. Mon espace"
							maxLength={50}
						/>
					</div>

					<div className="server-form-field">
						<label htmlFor="server-visibility">
							Visibilité
						</label>

						<select
							id="server-visibility"
							value={visibility}
							onChange={(event) =>
								setVisibility(
									event.target.value as Visibility
								)
							}>
							<option value="public">Public</option>
							<option value="private">Privé</option>
						</select>

						<p className="server-form-help">
							{visibility === 'public'
								? 'Tout le monde peut rejoindre ce salon.'
								: 'Un code d’invitation sera nécessaire pour rejoindre ce salon.'}
						</p>
					</div>

					<div className="server-form-field">
						<label htmlFor="server-capacity">
							Nombre de places
						</label>

						<input
							id="server-capacity"
							type="number"
							min={2}
							max={50}
							value={capacity}
							onChange={(event) =>
								setCapacity(Number(event.target.value))
							}
						/>

						<p className="server-form-help">
							Entre 2 et 50 places.
						</p>
					</div>

					{errors.length > 0 ? (
						<div className="server-message server-message-error">
							<ul>
								{errors.map((error) => (
									<li key={error}>{error}</li>
								))}
							</ul>
						</div>
					) : null}

					<div className="server-form-actions">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => router.push('/servers')}>
							Annuler
						</button>

						<button type="submit" className="btn">
							Créer le serveur
						</button>
					</div>
				</form>
			</div>
		</main>
	);
}

function generateInviteCode() {
	return Math.random()
		.toString(36)
		.substring(2, 8)
		.toUpperCase();
}