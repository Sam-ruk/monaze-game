import { useEffect, useState, useRef } from 'react';
import * as React from 'react';
import QRCode from 'qrcode';

interface UIProps {
  gamePhase: 'joining' | 'playing' | 'ended';
  timeLeft: number;
  leaderboard: Array<{ playerId: string; info: string }>;
  playerCount?: number; // Add this new prop
}

const UI: React.FC<UIProps> = ({ gamePhase, timeLeft, leaderboard, playerCount = 0 }) => {
  const [elapsed, setElapsed] = useState(0);
  const [showQR, setShowQR] = useState(true);
const [qrDismissed, setQrDismissed] = useState(false);
const [localPlayerId] = useState(() => crypto.randomUUID().slice(-6).toUpperCase());
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Reset start time when game phase changes to playing
    if (gamePhase === 'playing') {
      startTime.current = Date.now();
      setElapsed(0);
    }
  }, [gamePhase]);

  useEffect(() => {
  if (gamePhase === 'joining') {
    setQrDismissed(false);
    setShowQR(true);
  }
}, [gamePhase]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getPhaseMessage = (): string => {
    switch (gamePhase) {
      case 'joining':
        return `⏳ Joining Phase - ${timeLeft}s remaining`;
      case 'playing':
        return `🎮 Game Active - ${formatTime(timeLeft)} remaining`;
      case 'ended':
        return `🏁 Game Over - Next game in ${timeLeft}s`;
      default:
        return '🔄 Loading...';
    }
  };

  const getPhaseColor = (): string => {
    switch (gamePhase) {
      case 'joining':
        return '#ffff00';
      case 'playing':
        return '#00ff00';
      case 'ended':
        return '#ff6600';
      default:
        return '#d400ff';
    }
  };

  // Simple QR Code component using canvas
  const QRCodeCanvas: React.FC<{ value: string; size: number }> = ({ value, size }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const generateQR = async () => {
        try {
          await QRCode.toCanvas(canvas, value, {
            width: size,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
        } catch (error) {
          console.error('Error generating QR code:', error);
          // Fallback to placeholder if QR generation fails
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#000000';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('QR ERROR', size / 2, size / 2);
          }
        }
      };

      generateQR();
    }, [value, size]);

    return <canvas ref={canvasRef} width={size} height={size} />;
  };

  return (
    <>
      {/* Main Game UI */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '15px', 
          left: '15px', 
          color: '#d400ff', 
          fontFamily: 'Orbitron, monospace',
          background: 'rgba(26, 0, 51, 0.8)',
          padding: '20px',
          borderRadius: '15px',
          border: '2px solid #d400ff',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 20px rgba(212, 0, 255, 0.3)',
          minWidth: '280px',
        }}
      >
        <h2 style={{ 
          margin: '0 0 15px 0',
          fontSize: '2em',
          textShadow: '0 0 10px #d400ff',
          background: 'linear-gradient(45deg, #d400ff, #00f7ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          🌌 MONAZE
        </h2>
        
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            color: '#00f7ff', 
            fontSize: '1.1em',
            marginBottom: '5px',
          }}>
            ⏱️ Game Time: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{elapsed}s</span>
          </div>
          
          <div style={{ 
            color: getPhaseColor(),
            fontSize: '1em',
            fontWeight: 'bold',
            textShadow: `0 0 5px ${getPhaseColor()}`,
          }}>
            {getPhaseMessage()}
          </div>
        </div>

       {/* Player Count */}
<div style={{ 
  marginBottom: '15px',
  color: '#cc99ff',
  fontSize: '0.9em',
}}>
  👥 Ready Players: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
    {playerCount} {/* This should now show actual ready players */}
  </span>
</div>

        {/* Player ID Display */}
        <div style={{ 
          marginBottom: '15px',
          color: '#cc99ff',
          fontSize: '0.8em',
        }}>
          🎮 Your Player ID: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
            {localPlayerId.slice(-4)}
          </span>
        </div>

        {/* QR Code Section */}
{showQR && !qrDismissed && (gamePhase === 'joining' || gamePhase === 'ended') && (          <div style={{ marginTop: '15px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px',
            }}>
              <h4 style={{ 
                color: '#00f7ff', 
                margin: '0',
                fontSize: '1em',
              }}>
                📱 Join with Phone
              </h4>
              <button
                onClick={() => {
  setShowQR(!showQR);
  if (showQR) setQrDismissed(true);
}}
                style={{
                  background: 'transparent',
                  border: '1px solid #d400ff',
                  color: '#d400ff',
                  borderRadius: '15px',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  fontSize: '0.8em',
                }}
              >
                {showQR ? 'Hide' : 'Show'}
              </button>
            </div>
            
            <div style={{ 
              backgroundColor: 'white', 
              padding: '10px', 
              borderRadius: '10px', 
              display: 'inline-block',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
            }}>
              <QRCodeCanvas 
  value={`https://monaze-controller.vercel.app/?playerId=${localPlayerId.slice(-6)}`} 
  size={120} 
/>
            </div>
            
            <p style={{ 
              color: '#cc99ff', 
              fontSize: '0.8em',
              margin: '8px 0 0 0',
              maxWidth: '150px',
            }}>
              Scan to control using phone
            </p>
          </div>
        )}

        {/* Game Instructions */}
        {gamePhase === 'playing' && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            background: 'rgba(0, 247, 255, 0.1)',
            border: '1px solid #00f7ff',
            borderRadius: '8px',
            fontSize: '0.85em',
            color: '#00f7ff',
          }}>
            🎯 Navigate the neon maze to reach the white goal!<br />
            💫 First to finish wins!<br />
            👻 Other players appear as shadows
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div 
          style={{ 
            position: 'absolute', 
            top: '15px',
            right: '15px', 
            color: '#d400ff', 
            fontFamily: 'Orbitron, monospace',
            background: 'rgba(26, 0, 51, 0.8)',
            padding: '20px',
            borderRadius: '15px',
            border: '2px solid #d400ff',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(212, 0, 255, 0.3)',
            minWidth: '250px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ 
            margin: '0 0 15px 0',
            color: '#00f7ff',
            textShadow: '0 0 5px #00f7ff',
            fontSize: '1.3em',
          }}>
            {gamePhase === 'ended' ? '🏆 Final Results' : '📊 Live Standings'}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((entry, index) => {
              const isFinished = entry.info.includes('Finished');
              const isWinner = index === 0 && isFinished;
              const isLocalPlayer = entry.playerId === localPlayerId;
              
              return (
                <div
                  key={`${entry.playerId}-${index}`}
                  style={{
                    padding: '10px',
                    background: isLocalPlayer
                      ? 'linear-gradient(45deg, rgba(212, 0, 255, 0.3), rgba(212, 0, 255, 0.2))'
                      : isWinner 
                        ? 'linear-gradient(45deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2))'
                        : isFinished 
                          ? 'rgba(0, 255, 0, 0.1)' 
                          : 'rgba(212, 0, 255, 0.1)',
                    border: isLocalPlayer
                      ? '2px solid #d400ff'
                      : isWinner 
                        ? '2px solid #ffd700'
                        : isFinished 
                          ? '1px solid #00ff00' 
                          : '1px solid #d400ff',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      color: isWinner ? '#ffd700' : isFinished ? '#00ff00' : '#ffffff',
                      fontWeight: 'bold',
                      fontSize: '1.1em',
                    }}>
                      {isWinner ? '👑' : `${index + 1}.`}
                    </span>
                    <span style={{ 
                      color: isLocalPlayer ? '#d400ff' : isWinner ? '#ffd700' : '#ffffff',
                      fontWeight: isLocalPlayer || isWinner ? 'bold' : 'normal',
                    }}>
                      {isLocalPlayer ? 'You' : `P${entry.playerId.slice(-4)}`}
                    </span>
                  </div>
                  
                  <span style={{ 
                    color: isFinished ? '#00ff00' : '#cc99ff',
                    fontSize: '0.9em',
                    fontWeight: isFinished ? 'bold' : 'normal',
                  }}>
                    {entry.info}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div style={{
        position: 'absolute',
        bottom: '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(26, 0, 51, 0.9)',
        padding: '10px 20px',
        borderRadius: '25px',
        border: '1px solid #d400ff',
        color: '#d400ff',
        fontFamily: 'Orbitron, monospace',
        fontSize: '0.9em',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 15px rgba(212, 0, 255, 0.2)',
      }}>
        {gamePhase !== 'playing' && (
          <span style={{ color: '#00ff00' }}>
            CONNECTING..
          </span>
        )}
        {gamePhase === 'playing' && (
          <span style={{ color: '#00ff00' }}>
            🔴 LIVE
          </span>
        )}
      </div>

      {/* Celebration Effect for Game End */}
      {gamePhase === 'ended' && leaderboard.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '30px',
          borderRadius: '20px',
          border: '3px solid #ffd700',
          color: '#ffd700',
          fontFamily: 'Orbitron, monospace',
          textAlign: 'center',
          boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
          animation: 'pulse 2s infinite',
        }}>
          <h2 style={{ 
            margin: '0 0 15px 0',
            fontSize: '2.5em',
            textShadow: '0 0 20px #ffd700',
          }}>
            🎉 GAME COMPLETE! 🎉
          </h2>
          <p style={{ 
            margin: '0',
            fontSize: '1.2em',
            color: '#ffffff',
          }}>
            Winner: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>
              {leaderboard[0]?.playerId === localPlayerId ? 'You!' : `Player ${leaderboard[0]?.playerId.slice(-4)}`}
            </span>
          </p>
          <p style={{ 
            margin: '10px 0 0 0',
            fontSize: '0.9em',
            color: '#cc99ff',
          }}>
            {leaderboard[0]?.info}
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.05); }
        }
      `}</style>
    </>
  );
};

export default UI;