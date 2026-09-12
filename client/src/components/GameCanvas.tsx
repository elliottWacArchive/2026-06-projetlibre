/** @format */

'use client';

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/game/engine';
import { NetworkClient } from '@/game/network';
import { InteractionManager } from '@/game/interactions';
import type { ChatMessage } from '@/game/types';
import { SOCKET_URL } from '@/lib/config';
import ChatBox from './ChatBox';
import DeskOverlay from './desk/DeskOverlay';

const MAX_MESSAGES = 50;

export default function GameCanvas() {
	const containerRef = useRef<HTMLDivElement>(null);
	const joyContainerRef = useRef<HTMLDivElement>(null);
	const joyBaseRef = useRef<HTMLDivElement>(null);
	const joyStickRef = useRef<HTMLDivElement>(null);
	const networkRef = useRef<NetworkClient | null>(null);

	const [connected, setConnected] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [openDeskId, setOpenDeskId] = useState<number | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const engine = new GameEngine(containerRef.current, {
			joyBase: joyBaseRef.current,
			joyStick: joyStickRef.current,
		});

		const network = new NetworkClient(engine, {
			url: SOCKET_URL,
			onStatus: setConnected,
			onChat: (msg) =>
				setMessages((prev) => [...prev.slice(-MAX_MESSAGES + 1), msg]),
		});
		networkRef.current = network;

		engine.network = network;
		const interactions = new InteractionManager(engine);
		engine.interactions = interactions;

		// joystick visible si tactile
		const joyContainer = joyContainerRef.current;
		if (
			('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
			joyContainer
		) {
			joyContainer.classList.add('touch-enabled');
		}

		return () => {
			interactions.destroy();
			network.destroy();
			engine.destroy();
		};
	}, []);

	const sendChat = (msg: string) => {
		networkRef.current?.sendChatMessage(msg);
	};

	useEffect(() => {
		const handleDeskOpen = (event: Event) => {
			const customEvent = event as CustomEvent<{ deskId?: number }>;
			const deskId = customEvent.detail?.deskId;

			if (typeof deskId === 'number') {
				setOpenDeskId(deskId);
			}
		};

		window.addEventListener('desk:open', handleDeskOpen);

		return () => {
			window.removeEventListener('desk:open', handleDeskOpen);
		};
	}, []);

	return (
		<>
			<div id="container" ref={containerRef} />

			<div className="hint">
				Fleches / WASD pour deplacer
				<br />E pour interagir, joystick sur mobile
			</div>

			<div
				id="connection-status"
				className={connected ? 'is-on' : 'is-off'}>
				{connected ? 'Connecte' : 'Deconnecte'}
			</div>

			<ChatBox messages={messages} onSend={sendChat} />

			{openDeskId !== null && (
				<DeskOverlay
					deskId={openDeskId}
					onClose={() => setOpenDeskId(null)}
				/>
			)}

			<div id="joystick-container" ref={joyContainerRef}>
				<div id="joystick-base" ref={joyBaseRef}>
					<div id="joystick-stick" ref={joyStickRef} />
				</div>
			</div>
		</>
	);
}
