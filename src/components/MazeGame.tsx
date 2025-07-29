import { useEffect, useRef, useState, useContext } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as Multisynq from '@multisynq/client';
import { SocketContext } from '../contexts/SocketContext';

declare global {
  interface Window {
    resetGame?: () => void;
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
}

interface MazeModelData {
  players: Record<string, Omit<Player, 'character'>>;
  phase: 'joining' | 'playing' | 'ended';
  timeLeft: number;
  leaderboard: Array<{ playerId: string; info: string }>;
}

interface MultisynqSession {
  model: MazeModel;
  send: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  leave: () => void;
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
  public players: Record<string, Omit<Player, 'character'>>;
  public phase: 'joining' | 'playing' | 'ended';
  public timeLeft: number;
  public leaderboard: Array<{ playerId: string; info: string }>;
  private _session: MultisynqSession;
  private _setPlayers: React.Dispatch<React.SetStateAction<Record<string, Player>>>;
  private _setGamePhase: React.Dispatch<React.SetStateAction<'joining' | 'playing' | 'ended'>>;
  private _setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  private _setLeaderboard: React.Dispatch<React.SetStateAction<Array<{ playerId: string; info: string }>>>;
  private _onGamePhaseChange: (phase: 'joining' | 'playing' | 'ended') => void;
  private _onTimeLeftChange: (timeLeft: number) => void;
  private _onLeaderboardChange: (leaderboard: Array<{ playerId: string; info: string }>) => void;
  private _createCharacter: (playerId: string, isLocal: boolean) => THREE.Mesh;
  private _calculateDistanceToGoal: (position: THREE.Vector3) => number;

  constructor(
    session: MultisynqSession,
    setPlayers: React.Dispatch<React.SetStateAction<Record<string, Player>>>,
    setGamePhase: React.Dispatch<React.SetStateAction<'joining' | 'playing' | 'ended'>>,
    setTimeLeft: React.Dispatch<React.SetStateAction<number>>,
    setLeaderboard: React.Dispatch<React.SetStateAction<Array<{ playerId: string; info: string }>>>,
    onGamePhaseChange: (phase: 'joining' | 'playing' | 'ended') => void,
    onTimeLeftChange: (timeLeft: number) => void,
    onLeaderboardChange: (leaderboard: Array<{ playerId: string; info: string }>) => void,
    createCharacter: (playerId: string, isLocal: boolean) => THREE.Mesh,
    calculateDistanceToGoal: (position: THREE.Vector3) => number,
  ) {
    super();
    this._session = session;
    this.players = {};
    this.phase = 'joining';
    this.timeLeft = 30;
    this.leaderboard = [];
    this._setPlayers = setPlayers;
    this._setGamePhase = setGamePhase;
    this._setTimeLeft = setTimeLeft;
    this._setLeaderboard = setLeaderboard;
    this._onGamePhaseChange = onGamePhaseChange;
    this._onTimeLeftChange = onTimeLeftChange;
    this._onLeaderboardChange = onLeaderboardChange;
    this._createCharacter = createCharacter;
    this._calculateDistanceToGoal = calculateDistanceToGoal;
  }

  init(session: MultisynqSession) {
    this._session = session;
  }

  send(event: string, ...args: any[]) {
    this._session.send(event, ...args);
  }

  subscribe(localPlayerId: string) {
    this._session.on('join', (playerId: string) => {
      if (!this.players[playerId]) {
        const isLocal = playerId === localPlayerId;
        this.players[playerId] = {
          position: new THREE.Vector3(
            (mazeLayouts[0].start.x - mazeLayouts[0].layout.length / 2) * WALL_SIZE,
            BALL_HEIGHT,
            (mazeLayouts[0].start.z - mazeLayouts[0].layout[0].length / 2) * WALL_SIZE,
          ),
          velocity: new THREE.Vector3(0, 0, 0),
          finishTime: null,
          isLocal,
        };

        this._setPlayers((prev) => ({
          ...prev,
          [playerId]: {
            ...this.players[playerId],
            character: this._createCharacter(playerId, isLocal),
          },
        }));
      }
    });

    this._session.on(
      'updatePosition',
      (
        playerId: string,
        position: { x: number; y: number; z: number },
        velocity: { x: number; y: number; z: number },
        finishTime: number | null,
      ) => {
        if (this.players[playerId]) {
          this.players[playerId].position.set(position.x, position.y, position.z);
          this.players[playerId].velocity.set(velocity.x, velocity.y, velocity.z);
          this.players[playerId].finishTime = finishTime;

          this._setPlayers((prev) => ({
            ...prev,
            [playerId]: {
              ...prev[playerId],
              position: new THREE.Vector3(position.x, position.y, position.z),
              velocity: new THREE.Vector3(velocity.x, velocity.y, velocity.z),
              finishTime,
            },
          }));
        }
      },
    );

    this._session.on(
      'phaseUpdate',
      (
        newPhase: 'joining' | 'playing' | 'ended',
        newTimeLeft: number,
        newLeaderboard: Array<{ playerId: string; info: string }>,
      ) => {
        this.phase = newPhase;
        this.timeLeft = newTimeLeft;
        this.leaderboard = newLeaderboard || [];

        this._setGamePhase(newPhase);
        this._setTimeLeft(newTimeLeft);
        this._setLeaderboard(newLeaderboard || []);

        this._onGamePhaseChange(newPhase);
        this._onTimeLeftChange(newTimeLeft);
        this._onLeaderboardChange(newLeaderboard || []);
      },
    );
  }

  updateLeaderboard() {
    const finishedPlayers = Object.entries(this.players)
      .filter(([_, p]) => p.finishTime !== null)
      .sort((a, b) => (a[1].finishTime || 0) - (b[1].finishTime || 0));

    const unfinishedPlayers = Object.entries(this.players)
      .filter(([_, p]) => p.finishTime === null)
      .map(([id, p]) => [id, this._calculateDistanceToGoal(p.position)] as [string, number])
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

    this._setLeaderboard(this.leaderboard);
    this._onLeaderboardChange(this.leaderboard);
    this._session.send('phaseUpdate', this.phase, this.timeLeft, this.leaderboard);
  }
}

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
  const sessionRef = useRef<MultisynqSession | null>(null);
  const modelRef = useRef<MazeModel | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [gamePhase, setGamePhase] = useState<'joining' | 'playing' | 'ended'>('joining');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [leaderboard, setLeaderboard] = useState<Array<{ playerId: string; info: string }>>([]);
  const startTime = useRef(Date.now());
  const localPlayerId = useRef<string>(crypto.randomUUID());

  const createCharacter = (playerId: string, isLocal: boolean): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const color = colors[colorIndex % colors.length];
    setColorIndex((prev) => prev + 1);

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
    if (!modelRef.current || !players[playerId] || players[playerId].finishTime) return;

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
      modelRef.current.updateLeaderboard();
    }

    setPlayers((prev) => ({
      ...prev,
      [playerId]: { ...player },
    }));

    modelRef.current.send('updatePosition', playerId, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
    }, {
      x: player.velocity.x,
      y: player.velocity.y,
      z: player.velocity.z,
    }, player.finishTime);
  };

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
        const session: any = await Multisynq.Session.join({
          apiKey: process.env.NEXT_PUBLIC_MULTISYNQ_API_KEY || '',
          appId: process.env.NEXT_PUBLIC_MULTISYNQ_APP_ID || 'com.monaze.game',
          name: gameId,
          password: gameId,
          model: MazeModel,
        });
        sessionRef.current = session;

        const model = new MazeModel(
          session,
          setPlayers,
          setGamePhase,
          setTimeLeft,
          setLeaderboard,
          onGamePhaseChange,
          onTimeLeftChange,
          onLeaderboardChange,
          createCharacter,
          calculateDistanceToGoal,
        );
        modelRef.current = model;
        model.subscribe(localPlayerId.current);

        // Add local player immediately upon joining
        model.players[localPlayerId.current] = {
          position: new THREE.Vector3(
            (mazeLayouts[0].start.x - mazeLayouts[0].layout.length / 2) * WALL_SIZE,
            BALL_HEIGHT,
            (mazeLayouts[0].start.z - mazeLayouts[0].layout[0].length / 2) * WALL_SIZE,
          ),
          velocity: new THREE.Vector3(0, 0, 0),
          finishTime: null,
          isLocal: true,
        };
        setPlayers((prev) => ({
          ...prev,
          [localPlayerId.current]: {
            ...model.players[localPlayerId.current],
            character: createCharacter(localPlayerId.current, true),
          },
        }));
        session.send('join', localPlayerId.current);
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
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let newTime = prev - 1;
        let newPhase = gamePhase;
        let newLeaderboard = leaderboard;

        if (gamePhase === 'joining' && newTime <= 0) {
          newPhase = 'playing';
          newTime = 600;
        } else if (gamePhase === 'playing' && newTime <= 0) {
          newPhase = 'ended';
          newTime = 10;
          if (modelRef.current) {
            modelRef.current.updateLeaderboard();
            newLeaderboard = modelRef.current.leaderboard;
          }
        } else if (gamePhase === 'ended' && newTime <= 0) {
          resetGame();
          newPhase = 'joining';
          newTime = 30;
          newLeaderboard = [];
        }

        setGamePhase(newPhase);
        onGamePhaseChange(newPhase);
        onTimeLeftChange(newTime);
        setLeaderboard(newLeaderboard);
        onLeaderboardChange(newLeaderboard);

        if (modelRef.current) {
          modelRef.current.phase = newPhase;
          modelRef.current.timeLeft = newTime;
          modelRef.current.leaderboard = newLeaderboard;
          modelRef.current.send('phaseUpdate', newPhase, newTime, newLeaderboard);
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, leaderboard, onGamePhaseChange, onTimeLeftChange, onLeaderboardChange]);

  useEffect(() => {
    socket.on('tilt-data', (data: TiltData) => {
      const { playerId, tiltX, tiltZ } = data;
      if (players[playerId] && gamePhase === 'playing') {
        updateCharacterPhysics(playerId, tiltX, tiltZ);
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
      scene.add(neonLight);

      const violetLight = new THREE.PointLight(0xcc99ff, 1.2, 60);
      violetLight.position.set(15, 15, 15);
      scene.add(violetLight);
    }, [scene, camera]);

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
                color={colors[colorIndex % colors.length]}
                emissive={colors[colorIndex % colors.length]}
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