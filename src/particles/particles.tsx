import React, { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useKeyEvent } from '../utils/useEvent';
import { useThreeScene } from '../utils/useThree';
import './particles.css';

const BOUNDARY_MODES = [
  { label: 'Vrij (Geen)', desc: 'Oneindige ruimte', cssClass: 'none' },
  { label: 'Stuiteren (Bounce)', desc: 'Weerkaatsing op -500..500', cssClass: 'bounce' },
  { label: 'Herstarten (Center)', desc: 'Reset buiten bereik', cssClass: 'respawn' }
];

function Particles() {
  const [push, setPush] = useState(true);
  const [mass, setMass] = useState(1);
  const [boundMode, setBoundMode] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // References for live 60fps loop access without re-renders
  const pushRef = useRef(true);
  const massRef = useRef(1);
  const boundModeRef = useRef(1);
  const resetFnRef = useRef<() => void>(() => {});
  const stopFnRef = useRef<() => void>(() => {});
  const multMassFnRef = useRef<(factor: number) => void>(() => {});

  const togglePush = useCallback(() => {
    pushRef.current = !pushRef.current;
    setPush(pushRef.current);
  }, []);

  const handleMultMass = useCallback((factor: number) => {
    multMassFnRef.current(factor);
  }, []);

  const cycleBoundMode = useCallback(() => {
    boundModeRef.current = (boundModeRef.current + 1) % 3;
    setBoundMode(boundModeRef.current);
  }, []);

  const handleReset = useCallback(() => {
    resetFnRef.current();
  }, []);

  const handleStop = useCallback(() => {
    stopFnRef.current();
  }, []);

  const addKeyHandler = useKeyEvent();

  // Register keyboard shortcuts
  addKeyHandler(' ', togglePush);
  addKeyHandler('r', handleReset);
  addKeyHandler('=', () => handleMultMass(1.5));
  addKeyHandler('+', () => handleMultMass(1.5));
  addKeyHandler('-', () => handleMultMass(0.75));
  addKeyHandler('b', cycleBoundMode);
  addKeyHandler('s', handleStop);
  addKeyHandler('h', () => setIsCollapsed(prev => !prev));

  const node = useThreeScene(({ scene, mouseRay }) => {
    const particles: number[] = [];
    const dParticles: number[] = [];
    const particleColors: number[] = [];

    const speed = 0.1;
    const geometry = new THREE.BufferGeometry();

    const reset = () => {
      const color = new THREE.Color();
      const zAxis = new THREE.Vector3(0, 0, 1);
      const particleCount = 100000;

      particles.length = 0;
      dParticles.length = 0;
      particleColors.length = 0;

      for (let i = 0; i < particleCount; i++) {
        const perc = i / particleCount;
        const x = 0;
        const y = 0;
        const z = 0;

        particles.push(x, y, z);
        const dp = new THREE.Vector3(((perc * 3 | 0) / 3 + 0.1) * speed, 0, 0);
        dp.applyAxisAngle(zAxis, THREE.MathUtils.randFloatSpread(Math.PI * 2));
        dParticles.push(dp.x, dp.y, dp.z);

        color.setHSL(0, perc, 0.5);
        particleColors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(particleColors, 3));
    };

    resetFnRef.current = reset;
    reset();

    const material = new THREE.PointsMaterial({ size: 1, vertexColors: true });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Player interaction sphere
    const createMe = (currentMass: number) => {
      const sphereGeo = new THREE.SphereGeometry(Math.pow(currentMass, 1 / 3), 32, 32);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.material.color.setRGB(1, 1, 1);
      return {
        geometry: sphereGeo,
        material: sphereMat,
        mesh
      };
    };

    let me = createMe(massRef.current);
    scene.add(me.mesh);

    multMassFnRef.current = (factor: number) => {
      massRef.current *= factor;
      setMass(massRef.current);
      scene.remove(me.mesh);
      me.geometry.dispose();
      me.material.dispose();
      me = createMe(massRef.current);
      scene.add(me.mesh);
    };

    stopFnRef.current = () => {
      for (let i = 0; i < dParticles.length; ++i) {
        dParticles[i] = 0;
      }
    };

    const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const bound = 500;
    const isOutOfBound = (x: number) => x > bound || x < -bound;

    return timeDiff => {
      const mePos = mouseRay.ray.intersectPlane(mousePlane, me.mesh.position);
      const particleCount = particles.length;
      const resistance = Math.pow(0.9999, timeDiff);

      if (mePos) {
        const particlePos = new THREE.Vector3();
        const particleDist = new THREE.Vector3();
        const particleSpeed = new THREE.Vector3();
        const currentMass = massRef.current;
        const isPush = pushRef.current;

        for (let i = 0; i < particleCount; i += 3) {
          particlePos.set(particles[i], particles[i + 1], particles[i + 2]);
          particleSpeed.set(dParticles[i], dParticles[i + 1], dParticles[i + 2]);
          particleDist.subVectors(particlePos, mePos);
          const dist = particleDist.lengthSq();
          if (dist === 0) {
            continue;
          }
          const strength = currentMass / dist;
          const force = particleDist.normalize().multiplyScalar(strength);
          if (isPush) {
            particleSpeed.add(force);
          } else {
            particleSpeed.sub(force);
          }
          particleSpeed.multiplyScalar(resistance);
          dParticles[i] = particleSpeed.x;
          dParticles[i + 1] = particleSpeed.y;
          dParticles[i + 2] = particleSpeed.z;
        }
      }

      const currentBoundMode = boundModeRef.current;

      if (currentBoundMode === 1) {
        for (let i = 0; i < particleCount; i += 1) {
          if (particles[i] > bound && dParticles[i] > 0) {
            dParticles[i] = -dParticles[i];
          } else if (particles[i] < -bound && dParticles[i] < 0) {
            dParticles[i] = -dParticles[i];
          }
        }
      }
      if (currentBoundMode === 2) {
        for (let i = 0; i < particleCount; i += 3) {
          if (isOutOfBound(particles[i]) || isOutOfBound(particles[i + 1]) || isOutOfBound(particles[i + 2])) {
            particles[i] = 0;
            particles[i + 1] = 0;
            particles[i + 2] = 0;
          }
        }
      }
      for (let i = 0; i < particleCount; i += 1) {
        particles[i] += dParticles[i] * timeDiff;
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));
    };
  });

  const activeBound = BOUNDARY_MODES[boundMode];

  return (
    <div className="particles-container">
      {/* Interactive HUD & Legend Overlay */}
      <div className="particles-hud">
        <div className="particles-hud-header" onClick={() => setIsCollapsed(prev => !prev)}>
          <div className="particles-hud-title">
            <span>✨ 3D Particles</span>
            <span className="particles-hud-badge">100k deeltjes</span>
          </div>
          <button
            className="particles-hud-toggle"
            aria-label="Toggle legenda"
            title="Legenda in/uitklappen (H)"
          >
            {isCollapsed ? '+' : '−'}
          </button>
        </div>

        {!isCollapsed && (
          <div className="particles-hud-body">
            {/* Live Status Indicators */}
            <div className="particles-status-grid">
              <div className="status-pill" onClick={togglePush} style={{ cursor: 'pointer' }} title="Klik om te wisselen">
                <span className="status-pill-label">Interactie (Spatie)</span>
                <span className="status-pill-val">
                  <span className={`status-indicator ${push ? 'push' : 'pull'}`}></span>
                  {push ? 'Afstoten (Push)' : 'Aantrekken (Pull)'}
                </span>
              </div>

              <div className="status-pill">
                <span className="status-pill-label">Zwaartekracht Massa (+ / −)</span>
                <span className="status-pill-val">
                  ⚖️ {mass < 0.1 ? mass.toFixed(3) : mass < 10 ? mass.toFixed(2) : mass.toFixed(1)}x
                </span>
              </div>

              <div className="status-pill" onClick={cycleBoundMode} style={{ cursor: 'pointer' }} title="Klik om te wisselen">
                <span className="status-pill-label">Randmodus (B)</span>
                <span className="status-pill-val">
                  <span className={`status-indicator ${activeBound.cssClass}`}></span>
                  {activeBound.label}
                </span>
              </div>

              <div className="status-pill" onClick={handleReset} style={{ cursor: 'pointer' }} title="Klik om te resetten">
                <span className="status-pill-label">Reset (R)</span>
                <span className="status-pill-val">🔄 Herstart</span>
              </div>
            </div>

            {/* Keyboard Shortcuts Legend Table */}
            <div className="particles-legend-table">
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">Spatie</span></div>
                <div className="legend-action">Wissel afstoten / aantrekken</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">+</span><span className="key-badge">−</span></div>
                <div className="legend-action">Verhoog / verlaag bolmassa</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">B</span></div>
                <div className="legend-action">Wissel randmodus (Bounce / Respawn / Vrij)</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">S</span></div>
                <div className="legend-action">Bevries deeltjes (Stop)</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">R</span></div>
                <div className="legend-action">Herinitialiseer alle deeltjes</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">H</span></div>
                <div className="legend-action">Legenda in-/uitklappen</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">Muis</span></div>
                <div className="legend-action">Beweeg zwaartekrachtbol</div>
              </div>
            </div>

            <div className="particles-hud-footer">
              Beweeg je cursor over het scherm om de deeltjes te sturen.
            </div>
          </div>
        )}
      </div>

      {/* Three.js Canvas Container */}
      <div ref={node} className="particles-canvas" />
    </div>
  );
}

export default Particles;
