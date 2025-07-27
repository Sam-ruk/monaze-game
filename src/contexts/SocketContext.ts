"use client";
import { createContext } from 'react';
import io, { Socket } from 'socket.io-client';

interface TiltData {
  gameId: string;
  tiltX: number;
  tiltZ: number;
}

interface SocketEvents {
  'tilt-data': (data: TiltData) => void;
  'join-game': (gameId: string) => void;
  'tilt-update': (data: { tiltX: number; tiltZ: number }) => void;
  'joined-game': (data: { gameId: string; message: string }) => void;
}

// Use HTTPS and no port - nginx handles the proxy
export const socket: Socket<SocketEvents> = io('https://samkdev.xyz', { 
  autoConnect: false,
  transports: ['websocket', 'polling'] // Allow both transports for reliability
});

export const SocketContext = createContext(socket);