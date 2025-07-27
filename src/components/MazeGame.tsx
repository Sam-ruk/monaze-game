import { useEffect, useRef, useContext } from 'react';
import * as THREE from 'three';
import { SocketContext } from '../contexts/SocketContext';

declare global {
  interface Window {
    resetGame: () => void;
  }
}

interface MazeGameProps {
  gameId: string;
  setCharacter: (character: THREE.Mesh | null) => void;
}

const MazeGame = ({ gameId, setCharacter }: MazeGameProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const socket = useContext(SocketContext);

  useEffect(() => {
    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
    let character: THREE.Mesh, fireEffect: THREE.Mesh, goal: THREE.Mesh, fireParticles: THREE.Points;
    let tiltX = 0, tiltZ = 0;
    const characterVelocity = new THREE.Vector3();
    let startTime = Date.now();
    let gameWon = false;
    let walls: THREE.Mesh[] = [];
    let goalPosition: THREE.Vector3;
    let floor: THREE.Mesh;
    let maze: THREE.Group;
    const particleCount = 50;
    const WALL_HEIGHT = 3;
    const WALL_SIZE = 4;
    const BALL_HEIGHT = WALL_HEIGHT + 0.5;
    const BALL_RADIUS = 1;
    const FLOOR_Y = 0;
    const MAZE_HALF_SIZE = (15 * WALL_SIZE) / 2;

    // Maze layouts (same as original)
    const mazeLayouts = [
      // ... (Copy the mazeLayouts array from the original code)
      {
        layout: [
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
          [1,0,0,0,1,0,0,0,1,0,1,0,0,0,1],
          [1,1,1,0,1,1,1,0,1,0,1,1,1,0,1],
          [1,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
          [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1],
          [1,0,1,0,0,0,1,0,0,0,1,0,1,0,1],
          [1,0,1,1,1,1,1,1,1,0,1,0,1,0,1],
          [1,0,0,0,0,0,0,0,1,0,1,0,0,0,1],
          [1,1,1,1,1,1,1,0,1,0,1,1,1,0,1],
          [1,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
          [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1],
          [1,0,1,0,0,0,1,0,0,0,1,0,1,0,1],
          [1,0,1,1,1,1,1,0,1,0,1,0,1,0,1],
          [1,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
          [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ],
        start: { x: 1, z: 1 },
        goal: { x: 13, z: 13 }
      },
      // ... (Include other maze layouts as in the original)
    ];

    let currentMaze = mazeLayouts[Math.floor(Math.random() * mazeLayouts.length)];

    function init() {
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x330066, 5, 60);

      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
      camera.position.set(0, 30, 30);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x1a0033);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (mountRef.current) {
        mountRef.current.appendChild(renderer.domElement);
      }

      const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
      scene.add(ambientLight);

      const neonLight = new THREE.PointLight(0xd400ff, 1.2, 60);
      neonLight.position.set(-15, 15, -15);
      scene.add(neonLight);

      const violetLight = new THREE.PointLight(0xcc99ff, 1.2, 60);
      violetLight.position.set(15, 15, 15);
      scene.add(violetLight);

      createMaze();
      createCharacter();
      createGoal();

      socket.connect();
      socket.emit('join-game', gameId);
      socket.on('tilt-update', ({ tiltX: newTiltX, tiltZ: newTiltZ }) => {
        tiltX = newTiltX;
        tiltZ = newTiltZ;
      });

      animate();

      return () => {
        socket.disconnect();
        if (mountRef.current && renderer) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    }

    function createMaze() {
      if (maze) scene.remove(maze);
      maze = new THREE.Group();
      walls = [];

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xd400ff,
        emissive: 0xd400ff,
        emissiveIntensity: 1.0,
        metalness: 0.6,
        roughness: 0.2
      });

      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x00f7ff,
        emissive: 0x00f7ff,
        emissiveIntensity: 1.1,
        metalness: 0.5,
        roughness: 0.3,
        transparent: true,
        opacity: 0.9
      });

      for (let x = 0; x < currentMaze.layout.length; x++) {
        for (let z = 0; z < currentMaze.layout[x].length; z++) {
          if (currentMaze.layout[x][z] === 1) {
            const wallGeometry = new THREE.BoxGeometry(WALL_SIZE, WALL_HEIGHT, WALL_SIZE);
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(
              (x - currentMaze.layout.length / 2) * WALL_SIZE,
              WALL_HEIGHT / 2,
              (z - currentMaze.layout[x].length / 2) * WALL_SIZE
            );
            wall.castShadow = true;
            wall.receiveShadow = true;
            maze.add(wall);
            walls.push(wall);
          }
        }
      }

      const floorGeometry = new THREE.PlaneGeometry(
        currentMaze.layout.length * WALL_SIZE,
        currentMaze.layout[0].length * WALL_SIZE
      );
      floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = FLOOR_Y;
      floor.receiveShadow = true;
      floor.userData = { isFloor: true };
      maze.add(floor);

      scene.add(maze);
    }

    function createCharacter() {
      const characterGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
      const characterMaterial = new THREE.MeshStandardMaterial({
        color: 0xd400ff,
        emissive: 0xd400ff,
        emissiveIntensity: 0.8,
        metalness: 0.7,
        roughness: 0.3
      });

      character = new THREE.Mesh(characterGeometry, characterMaterial);
      character.position.set(
        (currentMaze.start.x - currentMaze.layout.length / 2) * WALL_SIZE,
        BALL_HEIGHT,
        (currentMaze.start.z - currentMaze.layout[0].length / 2) * WALL_SIZE
      );
      character.castShadow = true;
      scene.add(character);
      setCharacter(character);

      const fireGeometry = new THREE.ConeGeometry(0.5, 1, 16);
      const fireMaterial = new THREE.MeshBasicMaterial({
        color: 0xd400ff,
        transparent: true,
        opacity: 0.7
      });
      fireEffect = new THREE.Mesh(fireGeometry, fireMaterial);
      fireEffect.position.set(
        character.position.x,
        BALL_HEIGHT - 0.7,
        character.position.z
      );
      fireEffect.rotation.x = Math.PI;
      scene.add(fireEffect);

      const particles = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        velocities[i * 3] = (Math.random() - 0.5) * 0.2;
        velocities[i * 3 + 1] = -Math.random() * 0.5;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
      }
      particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0xd400ff,
        size: 0.1,
        transparent: true,
        opacity: 0.6
      });
      fireParticles = new THREE.Points(particles, particleMaterial);
      scene.add(fireParticles);
    }

    function createGoal() {
      const goalGeometry = new THREE.PlaneGeometry(3, 3);
      const goalMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      goal = new THREE.Mesh(goalGeometry, goalMaterial);
      goal.position.set(
        (currentMaze.goal.x - currentMaze.layout.length / 2) * WALL_SIZE,
        WALL_HEIGHT + 1.0,
        (currentMaze.goal.z - currentMaze.layout[0].length / 2) * WALL_SIZE
      );
      goal.rotation.x = -Math.PI / 2;
      goal.userData = { isGoal: true };
      maze.add(goal);
      goalPosition = goal.position.clone();
    }

    function checkWallCollisions(position: THREE.Vector3) {
      const collisions: any[] = [];
      for (const wall of walls) {
        const wallBox = new THREE.Box3().setFromObject(wall);
        const wallCenter = wallBox.getCenter(new THREE.Vector3());
        const wallSize = wallBox.getSize(new THREE.Vector3());

        const dx = Math.abs(position.x - wallCenter.x);
        const dz = Math.abs(position.z - wallCenter.z);

        if (dx < (wallSize.x / 2 + BALL_RADIUS) && dz < (wallSize.z / 2 + BALL_RADIUS)) {
          const penetrationX = (wallSize.x / 2 + BALL_RADIUS) - dx;
          const penetrationZ = (wallSize.z / 2 + BALL_RADIUS) - dz;

          if (penetrationX < penetrationZ) {
            const normal = position.x > wallCenter.x ? 1 : -1;
            collisions.push({
              axis: 'x',
              normal: normal,
              penetration: penetrationX,
              correctedPos: wallCenter.x + normal * (wallSize.x / 2 + BALL_RADIUS + 0.01)
            });
          } else {
            const normal = position.z > wallCenter.z ? 1 : -1;
            collisions.push({
              axis: 'z',
              normal: normal,
              penetration: penetrationZ,
              correctedPos: wallCenter.z + normal * (wallSize.z / 2 + BALL_RADIUS + 0.01)
            });
          }
        }
      }
      return collisions;
    }

    function resolveCollisions(position: THREE.Vector3, velocity: THREE.Vector3) {
      const collisions = checkWallCollisions(position);
      const correctedPos = position.clone();
      const correctedVel = velocity.clone();

      for (const collision of collisions) {
        if (collision.axis === 'x') {
          correctedPos.x = collision.correctedPos;
          correctedVel.x = 0;
        } else if (collision.axis === 'z') {
          correctedPos.z = collision.correctedPos;
          correctedVel.z = 0;
        }
      }

      return { position: correctedPos, velocity: correctedVel };
    }

    function updateCharacterPhysics() {
      if (gameWon) return;

      const gravity = 0.06;
      const tiltForceX = -tiltZ * gravity;
      const tiltForceZ = -tiltX * gravity;

      characterVelocity.x += tiltForceX;
      characterVelocity.z += tiltForceZ;

      characterVelocity.multiplyScalar(0.99);

      const newPosition = character.position.clone().add(characterVelocity);
      const resolved = resolveCollisions(newPosition, characterVelocity);

      character.position.copy(resolved.position);
      characterVelocity.copy(resolved.velocity);

      const maxX = MAZE_HALF_SIZE - BALL_RADIUS - 0.1;
      const maxZ = MAZE_HALF_SIZE - BALL_RADIUS - 0.1;

      if (character.position.x > maxX) {
        character.position.x = maxX;
        characterVelocity.x = 0;
      } else if (character.position.x < -maxX) {
        character.position.x = -maxX;
        characterVelocity.x = 0;
      }

      if (character.position.z > maxZ) {
        character.position.z = maxZ;
        characterVelocity.z = 0;
      } else if (character.position.z < -maxZ) {
        character.position.z = -maxZ;
        characterVelocity.z = 0;
      }

      character.position.y = BALL_HEIGHT;

      fireEffect.position.set(
        character.position.x,
        BALL_HEIGHT - 0.7,
        character.position.z
      );

      const positions = fireParticles.geometry.attributes.position.array;
      const velocities = fireParticles.geometry.attributes.velocity.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        if (positions[i * 3 + 1] < BALL_HEIGHT - 1.5) {
          positions[i * 3] = character.position.x;
          positions[i * 3 + 1] = BALL_HEIGHT - 0.7;
          positions[i * 3 + 2] = character.position.z;
          velocities[i * 3] = (Math.random() - 0.5) * 0.2;
          velocities[i * 3 + 1] = -Math.random() * 0.5;
          velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        }
      }
      fireParticles.geometry.attributes.position.needsUpdate = true;

      if (goalPosition && character.position.distanceTo(goalPosition) < 3.0) {
        winGame();
      }
    }

    function winGame() {
      if (gameWon) return;
      gameWon = true;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const victoryTimeEl = document.getElementById('victoryTime');
      const victoryEl = document.getElementById('victory');
      
      if (victoryTimeEl) {
        victoryTimeEl.textContent = elapsed.toString();
      }
      if (victoryEl) {
        victoryEl.style.display = 'block';
      }
    }

    function resetGame() {
      currentMaze = mazeLayouts[Math.floor(Math.random() * mazeLayouts.length)];
      createMaze();
      character.position.set(
        (currentMaze.start.x - currentMaze.layout.length / 2) * WALL_SIZE,
        BALL_HEIGHT,
        (currentMaze.start.z - currentMaze.layout[0].length / 2) * WALL_SIZE
      );
      fireEffect.position.set(
        character.position.x,
        BALL_HEIGHT - 0.7,
        character.position.z
      );
      scene.remove(goal);
      createGoal();
      const positions = fireParticles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = character.position.x;
        positions[i * 3 + 1] = BALL_HEIGHT - 0.7;
        positions[i * 3 + 2] = character.position.z;
      }
      fireParticles.geometry.attributes.position.needsUpdate = true;
      characterVelocity.set(0, 0, 0);
      tiltX = 0;
      tiltZ = 0;
      startTime = Date.now();
      gameWon = false;
      const victoryEl = document.getElementById('victory');
      if (victoryEl) {
        victoryEl.style.display = 'none';
      }
    }

    function animate() {
      requestAnimationFrame(animate);
      updateCharacterPhysics();
      maze.rotation.x = tiltX;
      maze.rotation.z = tiltZ;
      fireEffect.scale.y = 1 + Math.sin(Date.now() * 0.005) * 0.2;
      const time = Date.now() * 0.001;
      goal.position.y = WALL_HEIGHT + 1.0 + Math.sin(time) * 0.3;
      goal.rotation.z = Math.sin(time * 0.5) * 0.1;
      goal.rotation.y = Math.cos(time * 0.5) * 0.1;
      const targetPosition = character.position.clone().add(new THREE.Vector3(0, 16, 16));
      camera.position.lerp(targetPosition, 0.1);
      camera.lookAt(character.position);
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    init();
    window.resetGame = resetGame;

    return () => {
      window.removeEventListener('resize', () => {});
    };
  }, [gameId, socket]);

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
};

export default MazeGame;