import { useEffect, useRef, useState, useContext } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as Multisynq from '@multisynq/client';
import { SocketContext } from '../contexts/SocketContext';

declare global {
  interface Window {
    resetGame?: () => void;
    updateCharacterPhysics?: (playerId: string, tiltX: number, tiltZ: number) => void;
  }
}

interface MazeGameProps {
  gameId: string;
  setCharacter: (character: THREE.Mesh | null) => void;
  onGamePhaseChange: (phase: 'joining' | 'playing' | 'ended') => void;
  onTimeLeftChange: (timeLeft: number) => void;
  onLeaderboardChange: (leaderboard: any[]) => void;
}

interface Player {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  finishTime: number | null;
  character: THREE.Mesh | null;
  isLocal: boolean;
  color: number;
}

interface TiltData {
  playerId: string;
  tiltX: number;
  tiltZ: number;
}

const WALL_HEIGHT = 3;
const WALL_SIZE = 4;
const BALL_HEIGHT = WALL_HEIGHT + 0.5;
const BALL_RADIUS = 1;
const FLOOR_Y = 0;
const MAZE_HALF_SIZE = (15 * WALL_SIZE) / 2;
const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

const mazeLayouts = [
  {
    layout: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
      [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    start: { x: 1, z: 1 },
    goal: { x: 13, z: 13 },
  },
];

class MazeModel extends Multisynq.Model {
  public players!: Record<string, Omit<Player, 'character'>>;
  public phase!: 'joining' | 'playing' | 'ended';
  public timeLeft!: number;
  public leaderboard!: Array<{ playerId: string; info: string }>;
  private colorIndex!: number;

  init() {
    this.players = {};
    this.phase = 'joining';
    this.timeLeft = 30;
    this.leaderboard = [];
    this.colorIndex = 0;
    
    // Subscribe to events
    this.subscribe('player', 'join', this.handlePlayerJoin);
    this.subscribe('player', 'updatePosition', this.handleUpdatePosition);
    this.subscribe('game', 'phaseUpdate', this.handlePhaseUpdate);
    this.subscribe('player', 'tilt', this.handleTiltData);
    
    // Start the joining phase timer
    this.future(1000).tick();
  }

  handlePlayerJoin(playerId: string) {
    if (!this.players[playerId]) {
      this.players[playerId] = {
        position: new THREE.Vector3(
          (mazeLayouts[0].start.x - mazeLayouts[0].layout.length / 2) * WALL_SIZE,
          BALL_HEIGHT,
          (mazeLayouts[0].start.z - mazeLayouts[0].layout[0].length / 2) * WALL_SIZE,
        ),
        velocity: new THREE.Vector3(0, 0, 0),
        finishTime: null,
        isLocal: false,
        color: colors[this.colorIndex % colors.length],
      };
      this.colorIndex++;
      
      this.publish('player', 'joined', { playerId, playerData: this.players[playerId] });
    }
  }

  handleUpdatePosition(data: { playerId: string; position: { x: number; y: number; z: number }; velocity: { x: number; y: number; z: number }; finishTime: number | null }) {
  const { playerId, position, velocity, finishTime } = data;
  if (this.players[playerId]) {
    this.players[playerId].position.set(position.x, position.y, position.z);
    this.players[playerId].velocity.set(velocity.x, velocity.y, velocity.z);
    this.players[playerId].finishTime = finishTime;
    
this.publish('player', 'positionUpdated', { playerId, playerData: this.players[playerId] });

    if (finishTime !== null) {
      this.updateLeaderboard();
    }
  }
}

handlePhaseUpdate(data: { newPhase: 'joining' | 'playing' | 'ended'; newTimeLeft: number; newLeaderboard: Array<{ playerId: string; info: string }> }) {
  const { newPhase, newTimeLeft, newLeaderboard } = data;
  this.phase = newPhase;
  this.timeLeft = newTimeLeft;
  this.leaderboard = newLeaderboard || [];
  
this.publish('game', 'phaseChanged', { phase: this.phase, timeLeft: this.timeLeft, leaderboard: this.leaderboard });

}

handleTiltData(data: { playerId: string; tiltX: number; tiltZ: number }) {
  const { playerId, tiltX, tiltZ } = data;
this.publish('player', 'tiltReceived', { playerId, tiltX, tiltZ });
}

  tick() {
    let newTime = this.timeLeft - 1;
    let newPhase = this.phase;

    if (this.phase === 'joining' && newTime <= 0) {
      newPhase = 'playing';
      newTime = 600;
    } else if (this.phase === 'playing' && newTime <= 0) {
      newPhase = 'ended';
      newTime = 10;
      this.updateLeaderboard();
    } else if (this.phase === 'ended' && newTime <= 0) {
      this.resetGame();
      newPhase = 'joining';
      newTime = 30;
    }

    this.phase = newPhase;
    this.timeLeft = newTime;
this.publish('game', 'phaseChanged', { phase: this.phase, timeLeft: this.timeLeft, leaderboard: this.leaderboard });
    
    this.future(1000).tick();
  }

  updateLeaderboard() {
    const finishedPlayers = Object.entries(this.players)
      .filter(([_, p]) => p.finishTime !== null)
      .sort((a, b) => (a[1].finishTime || 0) - (b[1].finishTime || 0));

    const unfinishedPlayers = Object.entries(this.players)
      .filter(([_, p]) => p.finishTime === null)
      .map(([id, p]) => [id, this.calculateDistanceToGoal(p.position)] as [string, number])
      .sort((a, b) => a[1] - b[1]);

    this.leaderboard = [
      ...finishedPlayers.map(([id, p]) => ({
        playerId: id,
        info: `Finished in ${((p.finishTime || 0) / 1000).toFixed(1)}s`,
      })),
      ...unfinishedPlayers.map(([id, dist]) => ({
        playerId: id,
        info: `Distance: ${dist.toFixed(2)}`,
      })),
    ];

this.publish('game', 'leaderboardUpdated', { leaderboard: this.leaderboard });
  }

  calculateDistanceToGoal(position: THREE.Vector3): number {
    const goalPos = new THREE.Vector3(
      (mazeLayouts[0].goal.x - mazeLayouts[0].layout.length / 2) * WALL_SIZE,
      WALL_HEIGHT + 1.0,
      (mazeLayouts[0].goal.z - mazeLayouts[0].layout[0].length / 2) * WALL_SIZE,
    );
    return position.distanceTo(goalPos);
  }

  resetGame() {
    Object.keys(this.players).forEach(playerId => {
      this.players[playerId] = {
        ...this.players[playerId],
        position: new THREE.Vector3(
          (mazeLayouts[0].start.x - mazeLayouts[0].layout.length / 2) * WALL_SIZE,
          BALL_HEIGHT,
          (mazeLayouts[0].start.z - mazeLayouts[0].layout[0].length / 2) * WALL_SIZE,
        ),
        velocity: new THREE.Vector3(0, 0, 0),
        finishTime: null,
      };
    });
    this.leaderboard = [];
this.publish('game', 'gameReset', {});
  }
}

// Register the model class
MazeModel.register('MazeModel');

class MazeView extends Multisynq.View {
  private setPlayers: React.Dispatch<React.SetStateAction<Record<string, Player>>>;
  private setGamePhase: React.Dispatch<React.SetStateAction<'joining' | 'playing' | 'ended'>>;
  private setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  private setLeaderboard: React.Dispatch<React.SetStateAction<Array<{ playerId: string; info: string }>>>;
  private onGamePhaseChange: (phase: 'joining' | 'playing' | 'ended') => void;
  private onTimeLeftChange: (timeLeft: number) => void;
  private onLeaderboardChange: (leaderboard: Array<{ playerId: string; info: string }>) => void;
  private createCharacter: (playerId: string, isLocal: boolean, color: number) => THREE.Mesh;
  private localPlayerId: string;
  private colorIndex: number;

  constructor(
    model: MazeModel,
    setPlayers: React.Dispatch<React.SetStateAction<Record<string, Player>>>,
    setGamePhase: React.Dispatch<React.SetStateAction<'joining' | 'playing' | 'ended'>>,
    setTimeLeft: React.Dispatch<React.SetStateAction<number>>,
    setLeaderboard: React.Dispatch<React.SetStateAction<Array<{ playerId: string; info: string }>>>,
    onGamePhaseChange: (phase: 'joining' | 'playing' | 'ended') => void,
    onTimeLeftChange: (timeLeft: number) => void,
    onLeaderboardChange: (leaderboard: Array<{ playerId: string; info: string }>) => void,
    createCharacter: (playerId: string, isLocal: boolean, color: number) => THREE.Mesh,
    localPlayerId: string,
  ) {
    super(model);
    // this.model = model;
    this.setPlayers = setPlayers;
    this.setGamePhase = setGamePhase;
    this.setTimeLeft = setTimeLeft;
    this.setLeaderboard = setLeaderboard;
    this.onGamePhaseChange = onGamePhaseChange;
    this.onTimeLeftChange = onTimeLeftChange;
    this.onLeaderboardChange = onLeaderboardChange;
    this.createCharacter = createCharacter;
    this.localPlayerId = localPlayerId;
    this.colorIndex = 0;

    // Subscribe to model events
    this.subscribe('player', 'joined', this.handlePlayerJoined);
    this.subscribe('player', 'positionUpdated', this.handlePositionUpdated);
    this.subscribe('game', 'phaseChanged', this.handlePhaseChanged);
    this.subscribe('game', 'leaderboardUpdated', this.handleLeaderboardUpdated);
    this.subscribe('game', 'gameReset', this.handleGameReset);
    this.subscribe('player', 'tiltReceived', this.handleTiltReceived);
  }

  handlePlayerJoined = (data: { playerId: string; playerData: Omit<Player, 'character'> }) => {
  const { playerId, playerData } = data;
  const isLocal = playerId === this.localPlayerId;
  this.setPlayers((prev) => ({
    ...prev,
    [playerId]: {
      ...playerData,
      character: this.createCharacter(playerId, isLocal, playerData.color),
    },
  }));
};

  handlePositionUpdated = (data: { playerId: string; playerData: Omit<Player, 'character'> }) => {
  const { playerId, playerData } = data;
  this.setPlayers((prev) => ({
    ...prev,
    [playerId]: {
      ...prev[playerId],
      position: new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
      velocity: new THREE.Vector3(playerData.velocity.x, playerData.velocity.y, playerData.velocity.z),
      finishTime: playerData.finishTime,
    },
  }));
};

  handlePhaseChanged = (data: { phase: 'joining' | 'playing' | 'ended'; timeLeft: number; leaderboard: Array<{ playerId: string; info: string }> }) => {
  const { phase, timeLeft, leaderboard } = data;
  this.setGamePhase(phase);
  this.setTimeLeft(timeLeft);
  this.setLeaderboard(leaderboard);
  this.onGamePhaseChange(phase);
  this.onTimeLeftChange(timeLeft);
  this.onLeaderboardChange(leaderboard);
};

handleLeaderboardUpdated = (data: { leaderboard: Array<{ playerId: string; info: string }> }) => {
  const { leaderboard } = data;
  this.setLeaderboard(leaderboard);
  this.onLeaderboardChange(leaderboard);
};

  handleGameReset = () => {
    this.setPlayers((prev) => {
      const updatedPlayers = Object.keys(prev).reduce((acc, playerId) => {
        acc[playerId] = {
          ...prev[playerId],
          position: new THREE.Vector3(
            (mazeLayouts[0].start.x - mazeLayouts[0].layout.length / 2) * WALL_SIZE,
            BALL_HEIGHT,
            (mazeLayouts[0].start.z - mazeLayouts[0].layout[0].length / 2) * WALL_SIZE,
          ),
          velocity: new THREE.Vector3(0, 0, 0),
          finishTime: null,
        };
        return acc;
      }, {} as Record<string, Player>);
      return updatedPlayers;
    });
    this.setLeaderboard([]);
    this.onLeaderboardChange([]);
  };

  handleTiltReceived = (data: { playerId: string; tiltX: number; tiltZ: number }) => {
  const { playerId, tiltX, tiltZ } = data;
  if (window.updateCharacterPhysics) {
    window.updateCharacterPhysics(playerId, tiltX, tiltZ);
  }
};

  // Methods to send data to model
  joinPlayer(playerId: string) {
this.publish('player', 'join', { playerId });
  }

  updatePosition(playerId: string, position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }, finishTime: number | null) {
this.publish('player', 'updatePosition', { playerId, position, velocity, finishTime });
  }

  sendTiltData(playerId: string, tiltX: number, tiltZ: number) {
this.publish('player', 'tilt', { playerId, tiltX, tiltZ });
}
};

const MazeGame = ({
  gameId,
  setCharacter,
  onGamePhaseChange,
  onTimeLeftChange,
  onLeaderboardChange,
}: MazeGameProps) => {
  const socket = useContext(SocketContext);
  const [currentMaze, setCurrentMaze] = useState(mazeLayouts[Math.floor(Math.random() * mazeLayouts.length)]);
  const goalPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const walls = useRef<THREE.Mesh[]>([]);
  const [colorIndex, setColorIndex] = useState(0);
  const sessionRef = useRef<any>(null);
  const viewRef = useRef<MazeView | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [gamePhase, setGamePhase] = useState<'joining' | 'playing' | 'ended'>('joining');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [leaderboard, setLeaderboard] = useState<Array<{ playerId: string; info: string }>>([]);
  const startTime = useRef(Date.now());
  const localPlayerId = useRef<string>(crypto.randomUUID());

  const createCharacter = (playerId: string, isLocal: boolean, color: number): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: isLocal ? 0.8 : 0.4,
      metalness: 0.7,
      roughness: 0.3,
      transparent: true,
      opacity: isLocal ? 1.0 : 0.5,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (currentMaze.start.x - currentMaze.layout.length / 2) * WALL_SIZE,
      BALL_HEIGHT,
      (currentMaze.start.z - currentMaze.layout[0].length / 2) * WALL_SIZE,
    );
    mesh.castShadow = true;

    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.color = '#ffffff';
    label.style.fontFamily = 'Orbitron, sans-serif';
    label.textContent = `Player ${playerId.slice(-4)}`;
    document.body.appendChild(label);
    mesh.userData.label = label;

    if (isLocal) setCharacter(mesh);
    return mesh;
  };

  const checkWallCollisions = (position: THREE.Vector3) => {
    const collisions: { axis: string; normal: number; penetration: number; correctedPos: number }[] = [];

    for (const wall of walls.current) {
      const wallBox = new THREE.Box3().setFromObject(wall);
      const wallCenter = wallBox.getCenter(new THREE.Vector3());
      const wallSize = wallBox.getSize(new THREE.Vector3());

      const dx = Math.abs(position.x - wallCenter.x);
      const dz = Math.abs(position.z - wallCenter.z);

      if (dx < wallSize.x / 2 + BALL_RADIUS && dz < wallSize.z / 2 + BALL_RADIUS) {
        const penetrationX = wallSize.x / 2 + BALL_RADIUS - dx;
        const penetrationZ = wallSize.z / 2 + BALL_RADIUS - dz;

        if (penetrationX < penetrationZ) {
          const normal = position.x > wallCenter.x ? 1 : -1;
          collisions.push({
            axis: 'x',
            normal,
            penetration: penetrationX,
            correctedPos: wallCenter.x + normal * (wallSize.x / 2 + BALL_RADIUS + 0.01),
          });
        } else {
          const normal = position.z > wallCenter.z ? 1 : -1;
          collisions.push({
            axis: 'z',
            normal,
            penetration: penetrationZ,
            correctedPos: wallCenter.z + normal * (wallSize.z / 2 + BALL_RADIUS + 0.01),
          });
        }
      }
    }
    return collisions;
  };

  const resolveCollisions = (position: THREE.Vector3, velocity: THREE.Vector3) => {
    const collisions = checkWallCollisions(position);
    let correctedPos = position.clone();
    let correctedVel = velocity.clone();

    if (collisions.length > 0) {
      for (const collision of collisions) {
        if (collision.axis === 'x') {
          correctedPos.x = collision.correctedPos;
          correctedVel.x *= -0.3;
        } else if (collision.axis === 'z') {
          correctedPos.z = collision.correctedPos;
          correctedVel.z *= -0.3;
        }
      }
    }

    const maxSpeed = 0.8;
    if (correctedVel.length() > maxSpeed) {
      correctedVel.normalize().multiplyScalar(maxSpeed);
    }

    return { position: correctedPos, velocity: correctedVel };
  };

  const calculateDistanceToGoal = (position: THREE.Vector3): number => {
    return position.distanceTo(goalPosition.current);
  };

  const updateCharacterPhysics = (playerId: string, tiltX: number, tiltZ: number) => {
    if (!players[playerId] || players[playerId].finishTime || gamePhase !== 'playing') return;

    const player = players[playerId];
    const speed = 0.6;
    const damping = 0.9;
    const targetVelocity = new THREE.Vector3(tiltX * speed, 0, tiltZ * speed);

    player.velocity.lerp(targetVelocity, 0.3);
    player.velocity.multiplyScalar(damping);

    if (player.velocity.length() < 0.01 && Math.abs(tiltX) < 0.01 && Math.abs(tiltZ) < 0.01) {
      player.velocity.set(0, 0, 0);
    }

    const newPosition = player.position.clone().add(player.velocity);
    const resolved = resolveCollisions(newPosition, player.velocity);

    player.position.copy(resolved.position);
    player.velocity.copy(resolved.velocity);

    const maxX = MAZE_HALF_SIZE - BALL_RADIUS;
    const maxZ = MAZE_HALF_SIZE - BALL_RADIUS;
    player.position.x = Math.max(-maxX, Math.min(maxX, player.position.x));
    player.position.z = Math.max(-maxZ, Math.min(maxZ, player.position.z));
    player.position.y = BALL_HEIGHT;

    if (!player.finishTime && player.position.distanceTo(goalPosition.current) < 3.0) {
      player.finishTime = Date.now() - startTime.current;
    }

    setPlayers((prev) => ({
      ...prev,
      [playerId]: { ...player },
    }));

    if (viewRef.current && playerId === localPlayerId.current) {
      viewRef.current.updatePosition(playerId, {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      }, {
        x: player.velocity.x,
        y: player.velocity.y,
        z: player.velocity.z,
      }, player.finishTime);
    }
  };

  // Make updateCharacterPhysics available globally for the view
  useEffect(() => {
    (window as any).updateCharacterPhysics = updateCharacterPhysics;
    return () => {
      delete (window as any).updateCharacterPhysics;
    };
  }, [players, gamePhase]);

  const resetGame = () => {
    setCurrentMaze(mazeLayouts[Math.floor(Math.random() * mazeLayouts.length)]);
    setPlayers((prev) => {
      const updatedPlayers = Object.keys(prev).reduce((acc, playerId) => {
        acc[playerId] = {
          ...prev[playerId],
          position: new THREE.Vector3(
            (currentMaze.start.x - currentMaze.layout.length / 2) * WALL_SIZE,
            BALL_HEIGHT,
            (currentMaze.start.z - currentMaze.layout[0].length / 2) * WALL_SIZE,
          ),
          velocity: new THREE.Vector3(0, 0, 0),
          finishTime: null,
        };
        return acc;
      }, {} as Record<string, Player>);
      return updatedPlayers;
    });
    setLeaderboard([]);
    onLeaderboardChange([]);
    startTime.current = Date.now();
  };

  useEffect(() => {
    const initMultisynq = async () => {
      try {
        const session = await Multisynq.Session.join({
          apiKey: process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY || 'your_api_key_here',
          appId: process.env.NEXT_PUBLIC_MULTISYNQ_APP_ID || 'com.monaze.game',
          name: gameId,
          password: gameId,
          model: MazeModel,
          view: MazeView,
          viewOptions: [
            setPlayers,
            setGamePhase,
            setTimeLeft,
            setLeaderboard,
            onGamePhaseChange,
            onTimeLeftChange,
            onLeaderboardChange,
            createCharacter,
            localPlayerId.current,
          ],
        });
        
        sessionRef.current = session;
        viewRef.current = session.view;

        // Join the local player
        session.view.joinPlayer(localPlayerId.current);
        
      } catch (error) {
        console.error('Failed to initialize Multisynq session:', error);
      }
    };

    socket.connect();
    socket.emit('join-game', {
      playerId: localPlayerId.current,
      deviceType: 'display',
      gameId: gameId,
    });
    socket.emit('multisynq-join', localPlayerId.current);

    initMultisynq();

    return () => {
      if (sessionRef.current) {
        sessionRef.current.leave();
        sessionRef.current = null;
      }
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [gameId, onGamePhaseChange, onTimeLeftChange, onLeaderboardChange, socket]);

  useEffect(() => {
    socket.on('tilt-data', (data: TiltData) => {
      const { playerId, tiltX, tiltZ } = data;
      if (players[playerId] && gamePhase === 'playing') {
        updateCharacterPhysics(playerId, tiltX, tiltZ);
        if (viewRef.current) {
          viewRef.current.sendTiltData(playerId, tiltX, tiltZ);
        }
      }
    });

    return () => {
      socket.off('tilt-data');
      Object.values(players).forEach((player) => {
        if (player.character?.userData?.label) {
          document.body.removeChild(player.character.userData.label);
        }
      });
    };
  }, [socket, gamePhase, players, currentMaze]);

  useEffect(() => {
    window.resetGame = resetGame;
    return () => {
      window.resetGame = undefined;
    };
  }, []);

  const Scene = () => {
    const { camera, scene } = useThree();
    const goalRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
      scene.fog = new THREE.Fog(0x330066, 5, 60);
      camera.position.set(0, 30, 30);
      camera.lookAt(0, 0, 0);

      const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
      scene.add(ambientLight);

      const neonLight = new THREE.PointLight(0xd400ff, 1.2, 60);
      neonLight.position.set(-15, 15, -15);
      neonLight.castShadow = true;
      neonLight.shadow.mapSize.width = 1024;
      neonLight.shadow.mapSize.height = 1024;
      scene.add(neonLight);

      const violetLight = new THREE.PointLight(0xcc99ff, 1.2, 60);
      violetLight.position.set(15, 15, 15);
      violetLight.castShadow = true;
      violetLight.shadow.mapSize.width = 1024;
      violetLight.shadow.mapSize.height = 1024;
      scene.add(violetLight);

      // Add colored lights for each player to create colored shadows
      Object.entries(players).forEach(([playerId, player], index) => {
        if (player.character) {
          const playerLight = new THREE.PointLight(player.color, 0.8, 20);
          playerLight.position.copy(player.character.position);
          playerLight.position.y += 5;
          playerLight.castShadow = true;
          playerLight.shadow.mapSize.width = 512;
          playerLight.shadow.mapSize.height = 512;
          scene.add(playerLight);
          player.character.userData.light = playerLight;
        }
      });
    }, [scene, camera, players]);

    useFrame(() => {
      const localPlayerIdKey = Object.keys(players).find((id) => players[id].isLocal);
      const targetPosition = localPlayerIdKey
        ? players[localPlayerIdKey].character!.position.clone().add(new THREE.Vector3(0, 16, 16))
        : new THREE.Vector3(0, 16, 16);

      camera.position.lerp(targetPosition, 0.05);
      camera.lookAt(localPlayerIdKey ? players[localPlayerIdKey].character!.position : new THREE.Vector3(0, 0, 0));

      const time = Date.now() * 0.001;
      if (goalRef.current) {
        goalRef.current.position.y = WALL_HEIGHT + 1.0 + Math.sin(time) * 0.3;
        goalRef.current.rotation.z = Math.sin(time * 0.5) * 0.1;
        goalRef.current.rotation.y = Math.cos(time * 0.5) * 0.1;
      }

      Object.values(players).forEach((p) => {
        if (p.character && p.position) {
          p.character.position.copy(p.position);
          
          // Update player light position
          if (p.character.userData.light) {
            p.character.userData.light.position.copy(p.character.position);
            p.character.userData.light.position.y += 5;
          }
          
          const screenPos = p.character.position.clone().project(camera);
          const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
          if (p.character.userData.label) {
            p.character.userData.label.style.left = `${x}px`;
            p.character.userData.label.style.top = `${y}px`;
          }
        }
      });
    });

    const maze = (
      <group>
        {currentMaze.layout.map((row, x) =>
          row.map((cell, z) => {
            if (cell === 1) {
              return (
                <mesh
                  key={`${x}-${z}`}
                  position={[
                    (x - currentMaze.layout.length / 2) * WALL_SIZE,
                    WALL_HEIGHT / 2,
                    (z - currentMaze.layout[0].length / 2) * WALL_SIZE,
                  ]}
                  castShadow
                  receiveShadow
                  ref={(ref) => {
                    if (ref && !walls.current.includes(ref)) walls.current.push(ref);
                  }}
                >
                  <boxGeometry args={[WALL_SIZE, WALL_HEIGHT, WALL_SIZE]} />
                  <meshStandardMaterial
                    color={0xd400ff}
                    emissive={0xd400ff}
                    emissiveIntensity={1.0}
                    metalness={0.6}
                    roughness={0.2}
                  />
                </mesh>
              );
            }
            return null;
          }),
        )}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
          <planeGeometry args={[currentMaze.layout.length * WALL_SIZE, currentMaze.layout[0].length * WALL_SIZE]} />
          <meshStandardMaterial
            color={0x00f7ff}
            emissive={0x00f7ff}
            emissiveIntensity={1.1}
            metalness={0.5}
            roughness={0.3}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh
          ref={goalRef}
          position={[
            (currentMaze.goal.x - currentMaze.layout.length / 2) * WALL_SIZE,
            WALL_HEIGHT + 1.0,
            (currentMaze.goal.z - currentMaze.layout[0].length / 2) * WALL_SIZE,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ isGoal: true }}
        >
          <planeGeometry args={[3, 3]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );

    useEffect(() => {
      goalPosition.current.set(
        (currentMaze.goal.x - currentMaze.layout.length / 2) * WALL_SIZE,
        WALL_HEIGHT + 1.0,
        (currentMaze.goal.z - currentMaze.layout[0].length / 2) * WALL_SIZE,
      );
    }, [currentMaze]);

    return (
      <>
        {maze}
        {Object.entries(players).map(([playerId, player]) => (
          player.character && (
            <mesh key={playerId} ref={(ref) => (player.character = ref)} position={player.position}>
              <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
              <meshStandardMaterial
                color={player.color}
                emissive={player.color}
                emissiveIntensity={player.isLocal ? 0.8 : 0.4}
                metalness={0.7}
                roughness={0.3}
                transparent
                opacity={player.isLocal ? 1.0 : 0.5}
              />
            </mesh>
          )
        ))}
      </>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{ position: [0, 30, 30], fov: 75, near: 0.05, far: 1000 }}
        shadows
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          gl.setClearColor(0x1a0033);
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};

export default MazeGame;