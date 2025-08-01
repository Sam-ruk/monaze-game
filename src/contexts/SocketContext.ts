"use client";
import { createContext } from 'react';
import io, { Socket } from 'socket.io-client';

interface TiltData {
  playerId: string;
  tiltX: number;
  tiltZ: number;
  timestamp?: number;
}

interface PlayerJoinData {
  playerId: string;
  deviceType: 'controller' | 'display';
}

interface PlayerConnectedData {
  playerId: string;
  deviceType: 'controller' | 'display';
  totalPlayers: number;
  hasController: boolean;
  hasDisplay: boolean;
}

interface DeviceDisconnectedData {
  playerId: string;
  deviceType: string;
  hasController: boolean;
  hasDisplay: boolean;
}

interface QRCodeData {
  playerId: string;
  url: string;
}

interface SocketEvents {
  'tilt-data': (data: TiltData) => void;
  'join-player': (data: PlayerJoinData) => void;
  'joined-player': (data: { playerId: string; deviceType: string; message: string }) => void;
  'player-connected': (data: PlayerConnectedData) => void;
  'player-disconnected': (data: { playerId: string; totalPlayers: number }) => void;
  'device-disconnected': (data: DeviceDisconnectedData) => void;
  'multisynq-join': (playerId: string) => void;
  'multisynq-ready': (data: { success: boolean; playerId: string }) => void;
  'request-qr': (data: { playerId: string }) => void;
  'qr-code': (data: QRCodeData) => void;
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
  reconnectionAttempts: 5,
  forceNew: true
});

export const SocketContext = createContext(socket);