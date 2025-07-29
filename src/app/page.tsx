'use client';
import { useState, useEffect } from 'react';
import MazeGame from '../components/MazeGame';
import UI from '../components/UI';
import * as THREE from 'three';

export default function Home() {
  const [gameId, setGameId] = useState<string>('');
  const [character, setCharacter] = useState<THREE.Mesh | null>(null);
  const [gamePhase, setGamePhase] = useState<'joining' | 'playing' | 'ended'>('joining');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [leaderboard, setLeaderboard] = useState<Array<{ playerId: string; info: string }>>([]);

  useEffect(() => {
    // Generate a unique game ID
    setGameId(Math.random().toString(36).substring(2, 15));
  }, []);

  const handleGamePhaseChange = (phase: 'joining' | 'playing' | 'ended') => {
    setGamePhase(phase);
  };

  const handleTimeLeftChange = (time: number) => {
    setTimeLeft(time);
  };

  const handleLeaderboardChange = (board: Array<{ playerId: string; info: string }>) => {
    setLeaderboard(board);
  };

  if (!gameId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a0033 0%, #330066 50%, #1a0033 100%)',
        color: '#d400ff',
        fontFamily: 'Orbitron, monospace',
        fontSize: '1.5em',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '30px',
          border: '2px solid #d400ff',
          borderRadius: '15px',
          background: 'rgba(26, 0, 51, 0.8)',
          backdropFilter: 'blur(10px)',
        }}>
          🌌 Loading MONAZE...
        </div>
      </div>
    );
  }

  return (
    <div id="container" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <MazeGame 
        gameId={gameId} 
        setCharacter={setCharacter}
        onGamePhaseChange={handleGamePhaseChange}
        onTimeLeftChange={handleTimeLeftChange}
        onLeaderboardChange={handleLeaderboardChange}
      />
      <UI 
        gameId={gameId} 
        gamePhase={gamePhase} 
        timeLeft={timeLeft} 
        leaderboard={leaderboard} 
      />
    </div>
  );
}