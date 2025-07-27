import { useContext, useEffect, useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import * as THREE from 'three';

interface UIProps {
  gameId: string;
  character: THREE.Mesh | null;
}

const UI = ({ gameId, character }: UIProps) => {
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div id="ui">
        <h3>🌌 Neon Maze</h3>
        <div>Time: <span id="timer">{elapsed}</span>s</div>
        <div>
          Position: <span id="position">
            {character ? `${character.position.x.toFixed(1)}, ${character.position.y.toFixed(1)}, ${character.position.z.toFixed(1)}` : '0, 0, 0'}
          </span>
        </div>
        <div style={{ marginTop: '10px' }}>
          <QRCode value={`http://monaze-controller.vercel.app?gameId=${gameId}`} size={100} />
          <p style={{ color: '#d400ff', fontSize: '0.8em' }}>Scan to control from phone</p>
        </div>
      </div>
      <div id="victory">
        <h2>✨ Neon Triumph! ✨</h2>
        <div className="victory-stats">
          <div>⏱️ Time: <span id="victoryTime">--</span>s</div>
        </div>
        <p>You surfed the neon skies!</p>
        <div className="control-button" onClick={() => window.resetGame()}>
          🔄 Replay
        </div>
      </div>
    </>
  );
};

export default UI;