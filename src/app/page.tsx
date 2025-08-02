// Changes needed in your Home page:

'use client';
import { useState, useEffect } from 'react';
import MazeGame from '../components/MazeGame';
import UI from '../components/UI';
import * as THREE from 'three';

export default function Home() {
  const [character, setCharacter] = useState<THREE.Mesh | null>(null);
  const [gamePhase, setGamePhase] = useState<'joining' | 'playing' | 'ended'>('joining');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [leaderboard, setLeaderboard] = useState<Array<{ playerId: string; info: string }>>([]);
  const [playerCount, setPlayerCount] = useState<number>(0); // Add this state

  const handleGamePhaseChange = (phase: 'joining' | 'playing' | 'ended') => {
    setGamePhase(phase);
  };

  const handleTimeLeftChange = (time: number) => {
    setTimeLeft(time);
  };

  const handleLeaderboardChange = (board: Array<{ playerId: string; info: string }>) => {
    setLeaderboard(board);
  };

  // Add this new handler
  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
  };

  return (
    <div id="container" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <MazeGame 
        setCharacter={setCharacter}
        onGamePhaseChange={handleGamePhaseChange}
        onTimeLeftChange={handleTimeLeftChange}
        onLeaderboardChange={handleLeaderboardChange}
        onPlayerCountChange={handlePlayerCountChange} // Add this prop
      />
      <UI 
        gamePhase={gamePhase} 
        timeLeft={timeLeft} 
        leaderboard={leaderboard} 
        playerCount={playerCount} // Add this prop
      />
    </div>
  );
}