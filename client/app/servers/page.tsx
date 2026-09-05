/** @format */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Room } from '@/lib/api';
import { joinRoom } from '@/game/rooms';

export default function ServersPage() {
	const router = useRouter();

	const [rooms, setRooms] = useState<Room[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [joining, setJoining] = useState<string | null>(null);
	const [joinError, setJoinError] = useState('');
	const [inviteCodes, setInviteCodes] = useState<
		Record<string, string>
	>({});

	useEffect(() => {
		api.rooms()
			.then((data) => setRooms(data.rooms))
			.catch((err) => {
				setError(err.message);
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	const handleJoin = async (room: Room) => {
		setJoinError('');

		const isFull = room.connectedPlayers >= room.capacity;

		if (isFull) {
			setJoinError('Ce serveur est complet.');
			return;
		}

		const inviteCode = inviteCodes[room.slug]?.trim();

		if (room.visibility === 'private' && !inviteCode) {
			setJoinError("Le code d'invitation est requis.");
			return;
		}

		setJoining(room.slug);

		try {
			const response = await joinRoom(room.slug, inviteCode);

			if (!response.ok) {
				throw new Error(response.message);
			}

			router.push('/play');
		} catch (err) {
			setJoinError(
				err instanceof Error
					? err.message
					: 'Impossible de rejoindre le serveur.'
			);
		} finally {
			setJoining(null);
		}
	};

	const handleInviteCodeChange = (slug: string, value: string) => {
		setInviteCodes((current) => ({
			...current,
			[slug]: value,
		}));
	};

	if (loading) {
		return (
			<main className="servers-page">
				<div className="servers-container">
					<p>Chargement des serveurs...</p>
				</div>
			</main>
		);
	}

	if (error) {
		return (
			<main className="servers-page">
				<div className="servers-container">
					<div className="server-message server-message-error">
						{error}
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className="servers-page">
			<div className="servers-container">
				<header className="servers-header">
					<h1>Choisir un serveur</h1>
					<p>
						Rejoins un espace communautaire pour commencer à
						jouer.
					</p>
				</header>

				{rooms.length === 0 ? (
					<section className="server-empty">
						<h2>Aucun serveur disponible</h2>

						<p>
							Il n'y a actuellement aucun serveur à rejoindre.
						</p>

						<button
							className="btn"
							onClick={() => router.push('/servers/create')}>
							Créer un serveur
						</button>
					</section>
				) : (
					<section className="server-list">
						{rooms.map((room) => {
							const isFull =
								room.connectedPlayers >= room.capacity;
							const isJoining = joining === room.slug;

							return (
								<article
									className="server-card"
									key={room.id}>
									<div>
										<h2>{room.name}</h2>

										<div className="server-details">
											<span>
												{room.visibility === 'private'
													? 'Privé'
													: 'Public'}
											</span>

											<span>
												{room.connectedPlayers} /{' '}
												{room.capacity} places
											</span>
										</div>
									</div>

									{room.visibility === 'private' ? (
										<div className="server-invite">
											<label
												htmlFor={`invite-${room.slug}`}>
												Code d'invitation
											</label>

											<input
												id={`invite-${room.slug}`}
												type="text"
												value={
													inviteCodes[
														room.slug
													] || ''
												}
												onChange={(event) =>
													handleInviteCodeChange(
														room.slug,
														event.target.value
													)
												}
												placeholder="Entrer le code"
												disabled={isFull}
											/>
										</div>
									) : null}

									{isFull ? (
										<p className="server-full">
											Serveur complet — aucune place
											disponible.
										</p>
									) : null}

									<button
										className="btn"
										disabled={isFull || isJoining}
										onClick={() =>
											handleJoin(room)
										}>
										{isJoining
											? 'Connexion...'
											: 'Rejoindre'}
									</button>
								</article>
							);
						})}
					</section>
				)}

				{joinError ? (
					<div className="server-message server-message-error">
						{joinError}
					</div>
				) : null}
			</div>
		</main>
	);
}