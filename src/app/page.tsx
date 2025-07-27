'use client';

import { useState } from 'react';
import MazeGame from '../components/MazeGame';
import UI from '../components/UI';
import * as THREE from 'three';

export default function Home() {
  const [gameId] = useState<string>(Math.random().toString(36).substring(2, 15));
  const [character, setCharacter] = useState<THREE.Mesh | null>(null);

  return (
    <div id="container">
      <MazeGame gameId={gameId} setCharacter={setCharacter} />
      <UI gameId={gameId} character={character} />
    </div>
  );
}