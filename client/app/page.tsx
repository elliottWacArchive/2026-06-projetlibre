/** @format */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type User } from '@/lib/api';

export default function HomePage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		api.me()
			.then((data) => setUser(data.user))
			.catch(() => {})
			.finally(() => setChecked(true));
	}, []);

	const logout = async () => {
		await api.logout().catch(() => {});
		setUser(null);
	};

	return (
		<main className="landing">
			<h1>AH_ME</h1>
			<p>Espace communautaire 3D multijoueur</p>

			{!checked ? null : user ? (
				<div className="landing-actions">
					<p>
						Connecte en tant que <strong>{user.username}</strong>
					</p>
					<button
						className="btn"
						onClick={() => router.push('/servers')}>
						Jouer
					</button>
					<button className="btn btn-ghost" onClick={logout}>
						Deconnexion
					</button>
				</div>
			) : (
				<div className="landing-actions">
					<button
						className="btn"
						onClick={() => router.push('/servers')}>
						Jouer en invite
					</button>
					<Link className="btn btn-ghost" href="/login">
						Connexion
					</Link>
					<Link className="btn btn-ghost" href="/register">
						Inscription
					</Link>
				</div>
			)}
		</main>
	);
}
