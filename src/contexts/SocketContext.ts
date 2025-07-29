"use client";
import { createContext } from 'react';
import io, { Socket } from 'socket.io-client';

interface TiltData {
  playerId: string;
  tiltX: number;
  tiltZ: number;
  timestamp?: number;
}

interface GameJoinData {
  playerId: string;
  deviceType: 'controller' | 'display';
  gameId: string;
}

interface PlayerConnectedData {
  playerId: string;
  deviceType: 'controller' | 'display';
  totalPlayers: number;
}

interface GamePhaseData {
  phase: 'joining' | 'playing' | 'ended';
  timeLeft: number;
  gameId: string;
}

interface SocketEvents {
  'tilt-data': (data: TiltData) => void;
  'tilt-update': (data: { tiltX: number; tiltZ: number; playerId: string }) => void;
  'join-game': (data: GameJoinData) => void;
  'joined-game': (data: { playerId: string; message: string; gameId: string }) => void;
  'player-connected': (data: PlayerConnectedData) => void;
  'player-disconnected': (data: { playerId: string; totalPlayers: number }) => void;
  'game-phase': (data: GamePhaseData) => void;
  'game-reset': (data: { gameId: string }) => void;
  'multisynq-join': (playerId: string) => void;
  'multisynq-ready': (data: { success: boolean; playerId: string }) => void;
  'connection-error': (error: { message: string; code?: string }) => void;
  'game-error': (error: { message: string; playerId: string }) => void;
}

export const socket: Socket<SocketEvents> = io('https://samkdev.xyz', { 
  autoConnect: false,
  transports: ['websocket', 'polling'],
  timeout: 20000,
  retries: 3,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5, // Changed from maxReconnectionAttempts
  forceNew: true
});

export const SocketContext = createContext(socket);