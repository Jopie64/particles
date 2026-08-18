import React, { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer, Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { useKeyEvent } from '../utils/useEvent';
import { useThreeScene } from '../utils/useThree';
import './particles.css';

const BOUNDARY_MODES = [
  { label: 'Vrij (Geen)', desc: 'Oneindige ruimte', cssClass: 'none' },
  { label: 'Stuiteren (Bounce)', desc: 'Weerkaatsing op -500..500', cssClass: 'bounce' },
  { label: 'Herstarten (Center)', desc: 'Reset buiten bereik', cssClass: 'respawn' }
];

export interface Preset {
  label: string;
  value: number;
  width: number;
  height: number;
  key: string;
}

const PARTICLE_PRESETS: Preset[] = [
  { label: '500k', value: 524288, width: 1024, height: 512, key: '1' },
  { label: '1M', value: 1048576, width: 1024, height: 1024, key: '2' },
  { label: '2M', value: 2097152, width: 2048, height: 1024, key: '3' },
  { label: '4M', value: 4194304, width: 2048, height: 2048, key: '4' },
  { label: '8M', value: 8388608, width: 4096, height: 2048, key: '5' },
  { label: '16M', value: 16777216, width: 4096, height: 4096, key: '6' }
];

const computeFragmentShaderPos = `
  uniform float dt;
  uniform int boundMode;
  uniform float bound;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D( texturePosition, uv );
    vec4 vel = texture2D( textureVelocity, uv );

    pos.xyz += vel.xyz * dt;

    if ( boundMode == 2 ) {
      if ( abs( pos.x ) > bound || abs( pos.y ) > bound || abs( pos.z ) > bound ) {
        pos.xyz = vec3( 0.0 );
      }
    }

    gl_FragColor = pos;
  }
`;

const computeFragmentShaderVel = `
  uniform float dt;
  uniform vec3 mousePos;
  uniform bool hasMouse;
  uniform float mass;
  uniform bool isPush;
  uniform int boundMode;
  uniform float bound;
  uniform float resistance;
  uniform float softeningSq;
  uniform bool freeze;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D( texturePosition, uv );
    vec4 vel = texture2D( textureVelocity, uv );

    if ( freeze ) {
      gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
      return;
    }

    vec3 p = pos.xyz;
    vec3 v = vel.xyz;

    if ( hasMouse ) {
      vec3 diff = p - mousePos;
      float distSq = dot( diff, diff ) + softeningSq;
      if ( distSq > 0.001 ) {
        float dist = sqrt( distSq );
        float forceMag = ( isPush ? mass : -mass ) / ( distSq * dist );
        v = ( v + diff * forceMag ) * resistance;
      }
    }

    if ( boundMode == 1 ) { // Bounce
      if ( ( p.x > bound && v.x > 0.0 ) || ( p.x < -bound && v.x < 0.0 ) ) v.x = -v.x;
      if ( ( p.y > bound && v.y > 0.0 ) || ( p.y < -bound && v.y < 0.0 ) ) v.y = -v.y;
      if ( ( p.z > bound && v.z > 0.0 ) || ( p.z < -bound && v.z < 0.0 ) ) v.z = -v.z;
    }

    gl_FragColor = vec4( v, 1.0 );
  }
`;

const particleVertexShader = `
  uniform sampler2D texturePosition;
  attribute vec2 reference;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 pos = texture2D( texturePosition, reference );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( pos.xyz, 1.0 );
    gl_PointSize = 1.0;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4( vColor, 1.0 );
  }
`;

function Particles() {
  const [engine, setEngine] = useState<'gpu' | 'cpu'>('gpu');
  const [gravityMode, setGravityMode] = useState<'orbit' | 'slingshot'>('orbit');
  const [push, setPush] = useState(true);
  const [mass, setMass] = useState(1);
  const [boundMode, setBoundMode] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activePresetIdx, setActivePresetIdx] = useState(3); // Default 4M
  const [fps, setFps] = useState(60);
  const [simTime, setSimTime] = useState(0);

  // References for live 60fps loop access without re-renders
  const engineRef = useRef<'gpu' | 'cpu'>('gpu');
  const gravityModeRef = useRef<'orbit' | 'slingshot'>('orbit');
  const pushRef = useRef(true);
  const massRef = useRef(1);
  const boundModeRef = useRef(1);
  const activePresetIdxRef = useRef(3);
  const resetFnRef = useRef<(presetIdx?: number, engine?: 'gpu' | 'cpu') => void>(() => {});
  const stopFnRef = useRef<() => void>(() => {});
  const multMassFnRef = useRef<(factor: number) => void>(() => {});

  const toggleEngine = useCallback(() => {
    const nextEngine = engineRef.current === 'gpu' ? 'cpu' : 'gpu';
    engineRef.current = nextEngine;
    setEngine(nextEngine);
    resetFnRef.current(activePresetIdxRef.current, nextEngine);
  }, []);

  const toggleGravityMode = useCallback(() => {
    const nextMode = gravityModeRef.current === 'orbit' ? 'slingshot' : 'orbit';
    gravityModeRef.current = nextMode;
    setGravityMode(nextMode);
  }, []);

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

  const handleSelectPreset = useCallback((presetIdx: number) => {
    activePresetIdxRef.current = presetIdx;
    setActivePresetIdx(presetIdx);
    resetFnRef.current(presetIdx, engineRef.current);
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
  addKeyHandler('g', toggleEngine);
  addKeyHandler('o', toggleGravityMode);
  addKeyHandler('r', handleReset);
  addKeyHandler('=', () => handleMultMass(1.5));
  addKeyHandler('+', () => handleMultMass(1.5));
  addKeyHandler('-', () => handleMultMass(0.75));
  addKeyHandler('b', cycleBoundMode);
  addKeyHandler('s', handleStop);
  addKeyHandler('h', () => setIsCollapsed(prev => !prev));

  // Particle count shortcuts 1-6
  PARTICLE_PRESETS.forEach((preset, idx) => {
    addKeyHandler(preset.key, () => handleSelectPreset(idx));
  });

  const node = useThreeScene(({ scene, renderer, mouseRay }) => {
    let currentPoints: THREE.Points | null = null;
    let gpuCompute: GPUComputationRenderer | null = null;
    let posVar: Variable | null = null;
    let velVar: Variable | null = null;
    let gpuMaterial: THREE.ShaderMaterial | null = null;

    let cpuPositions = new Float32Array(0);
    let cpuVelocities = new Float32Array(0);
    let cpuPosAttr: THREE.BufferAttribute | null = null;

    const reset = (presetIndex = activePresetIdxRef.current, currentEngine = engineRef.current) => {
      activePresetIdxRef.current = presetIndex;
      engineRef.current = currentEngine;
      const preset = PARTICLE_PRESETS[presetIndex];
      const count = preset.value;
      const speed = 0.1;
      const zAxis = new THREE.Vector3(0, 0, 1);
      const dp = new THREE.Vector3();
      const color = new THREE.Color();

      // Clean up previous scene objects
      if (currentPoints) {
        scene.remove(currentPoints);
        currentPoints.geometry.dispose();
        if (Array.isArray(currentPoints.material)) {
          currentPoints.material.forEach(m => m.dispose());
        } else {
          currentPoints.material.dispose();
        }
        currentPoints = null;
      }
      if (gpuCompute) {
        gpuCompute.dispose();
        gpuCompute = null;
      }

      if (currentEngine === 'gpu') {
        const texWidth = preset.width;
        const texHeight = preset.height;
        gpuCompute = new GPUComputationRenderer(texWidth, texHeight, renderer);

        if (renderer.capabilities.isWebGL2 === false) {
          gpuCompute.setDataType(THREE.HalfFloatType);
        }

        const pos0 = gpuCompute.createTexture();
        const vel0 = gpuCompute.createTexture();
        const posData = pos0.image.data;
        const velData = vel0.image.data;
        if (!posData || !velData) return;

        const references = new Float32Array(count * 2);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
          const i4 = i * 4;
          const i3 = i * 3;
          const i2 = i * 2;
          const perc = i / count;

          posData[i4] = 0;
          posData[i4 + 1] = 0;
          posData[i4 + 2] = 0;
          posData[i4 + 3] = 1;

          dp.set(((perc * 3 | 0) / 3 + 0.1) * speed, 0, 0);
          dp.applyAxisAngle(zAxis, THREE.MathUtils.randFloatSpread(Math.PI * 2));
          velData[i4] = dp.x;
          velData[i4 + 1] = dp.y;
          velData[i4 + 2] = dp.z;
          velData[i4 + 3] = 1;

          const x = i % texWidth;
          const y = Math.floor(i / texWidth);
          references[i2] = (x + 0.5) / texWidth;
          references[i2 + 1] = (y + 0.5) / texHeight;

          color.setHSL(0, perc, 0.5);
          colors[i3] = color.r;
          colors[i3 + 1] = color.g;
          colors[i3 + 2] = color.b;
        }

        posVar = gpuCompute.addVariable('texturePosition', computeFragmentShaderPos, pos0);
        velVar = gpuCompute.addVariable('textureVelocity', computeFragmentShaderVel, vel0);

        gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
        gpuCompute.setVariableDependencies(velVar, [posVar, velVar]);

        posVar.material.uniforms.dt = { value: 0 };
        posVar.material.uniforms.boundMode = { value: 1 };
        posVar.material.uniforms.bound = { value: 500 };

        velVar.material.uniforms.dt = { value: 0 };
        velVar.material.uniforms.mousePos = { value: new THREE.Vector3() };
        velVar.material.uniforms.hasMouse = { value: false };
        velVar.material.uniforms.mass = { value: 1 };
        velVar.material.uniforms.isPush = { value: true };
        velVar.material.uniforms.boundMode = { value: 1 };
        velVar.material.uniforms.bound = { value: 500 };
        velVar.material.uniforms.resistance = { value: 0.9999 };
        velVar.material.uniforms.softeningSq = { value: 625.0 };
        velVar.material.uniforms.freeze = { value: false };

        const error = gpuCompute.init();
        if (error !== null) {
          console.error('GPUComputationRenderer init error:', error);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        gpuMaterial = new THREE.ShaderMaterial({
          uniforms: {
            texturePosition: { value: null }
          },
          vertexShader: particleVertexShader,
          fragmentShader: particleFragmentShader
        });

        currentPoints = new THREE.Points(geometry, gpuMaterial);
        currentPoints.frustumCulled = false;
        scene.add(currentPoints);
      } else {
        // CPU Mode (Level 1 optimized)
        cpuPositions = new Float32Array(count * 3);
        cpuVelocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const perc = i / count;

          cpuPositions[i3] = 0;
          cpuPositions[i3 + 1] = 0;
          cpuPositions[i3 + 2] = 0;

          dp.set(((perc * 3 | 0) / 3 + 0.1) * speed, 0, 0);
          dp.applyAxisAngle(zAxis, THREE.MathUtils.randFloatSpread(Math.PI * 2));
          cpuVelocities[i3] = dp.x;
          cpuVelocities[i3 + 1] = dp.y;
          cpuVelocities[i3 + 2] = dp.z;

          color.setHSL(0, perc, 0.5);
          colors[i3] = color.r;
          colors[i3 + 1] = color.g;
          colors[i3 + 2] = color.b;
        }

        const geometry = new THREE.BufferGeometry();
        cpuPosAttr = new THREE.BufferAttribute(cpuPositions, 3);
        cpuPosAttr.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('position', cpuPosAttr);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const cpuMaterial = new THREE.PointsMaterial({ size: 1, vertexColors: true });
        currentPoints = new THREE.Points(geometry, cpuMaterial);
        scene.add(currentPoints);
      }
    };

    resetFnRef.current = (presetIdx?: number, eng?: 'gpu' | 'cpu') => reset(presetIdx, eng);
    reset();

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
      if (engineRef.current === 'gpu') {
        if (velVar) {
          velVar.material.uniforms.freeze.value = true;
        }
      } else {
        cpuVelocities.fill(0);
      }
    };

    const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const bound = 500;

    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    let simTimeAccum = 0;
    let simFrames = 0;

    return timeDiff => {
      frameCount++;
      const t0 = performance.now();

      const dt = Math.min(timeDiff, 100);
      const mePos = mouseRay.ray.intersectPlane(mousePlane, me.mesh.position);
      const hasMouse = mePos !== null;
      const currentMass = massRef.current;
      const isPush = pushRef.current;
      const currentBoundMode = boundModeRef.current;
      const resistance = Math.pow(0.9999, dt);
      const softeningSq = gravityModeRef.current === 'orbit' ? 625.0 : 0.25;

      if (engineRef.current === 'gpu' && gpuCompute && posVar && velVar && gpuMaterial) {
        posVar.material.uniforms.dt.value = dt;
        posVar.material.uniforms.boundMode.value = currentBoundMode;
        posVar.material.uniforms.bound.value = bound;

        velVar.material.uniforms.dt.value = dt;
        velVar.material.uniforms.hasMouse.value = hasMouse;
        if (hasMouse && mePos) {
          velVar.material.uniforms.mousePos.value.copy(mePos);
        }
        velVar.material.uniforms.mass.value = currentMass;
        velVar.material.uniforms.isPush.value = isPush;
        velVar.material.uniforms.boundMode.value = currentBoundMode;
        velVar.material.uniforms.bound.value = bound;
        velVar.material.uniforms.resistance.value = resistance;
        velVar.material.uniforms.softeningSq.value = softeningSq;

        gpuCompute.compute();

        if (velVar.material.uniforms.freeze.value) {
          velVar.material.uniforms.freeze.value = false;
        }

        gpuMaterial.uniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(posVar).texture;
      } else if (cpuPosAttr) {
        // CPU loop
        const mx = hasMouse && mePos ? mePos.x : 0;
        const my = hasMouse && mePos ? mePos.y : 0;
        const mz = hasMouse && mePos ? mePos.z : 0;
        const massFactor = isPush ? currentMass : -currentMass;
        const totalCoords = cpuPositions.length;

        for (let i = 0; i < totalCoords; i += 3) {
          let px = cpuPositions[i];
          let py = cpuPositions[i + 1];
          let pz = cpuPositions[i + 2];
          let vx = cpuVelocities[i];
          let vy = cpuVelocities[i + 1];
          let vz = cpuVelocities[i + 2];

          if (hasMouse) {
            const dx = px - mx;
            const dy = py - my;
            const dz = pz - mz;
            const distSq = dx * dx + dy * dy + dz * dz + softeningSq;

            if (distSq > 0.001) {
              const dist = Math.sqrt(distSq);
              const forceMag = massFactor / (distSq * dist);
              vx = (vx + dx * forceMag) * resistance;
              vy = (vy + dy * forceMag) * resistance;
              vz = (vz + dz * forceMag) * resistance;
            }
          }

          if (currentBoundMode === 1) { // Bounce
            if ((px > bound && vx > 0) || (px < -bound && vx < 0)) vx = -vx;
            if ((py > bound && vy > 0) || (py < -bound && vy < 0)) vy = -vy;
            if ((pz > bound && vz > 0) || (pz < -bound && vz < 0)) vz = -vz;
          } else if (currentBoundMode === 2) { // Respawn / Center
            if (px > bound || px < -bound || py > bound || py < -bound || pz > bound || pz < -bound) {
              px = 0; py = 0; pz = 0;
            }
          }

          cpuPositions[i] = px + vx * dt;
          cpuPositions[i + 1] = py + vy * dt;
          cpuPositions[i + 2] = pz + vz * dt;
          cpuVelocities[i] = vx;
          cpuVelocities[i + 1] = vy;
          cpuVelocities[i + 2] = vz;
        }

        cpuPosAttr.needsUpdate = true;
      }

      const t1 = performance.now();
      simTimeAccum += (t1 - t0);
      simFrames++;

      const now = performance.now();
      if (now - lastFpsUpdate >= 500) {
        const measuredFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
        const avgSimTime = Number((simTimeAccum / simFrames).toFixed(2));
        setFps(measuredFps);
        setSimTime(avgSimTime);
        frameCount = 0;
        simTimeAccum = 0;
        simFrames = 0;
        lastFpsUpdate = now;
      }
    };
  });

  const activeBound = BOUNDARY_MODES[boundMode];
  const currentPreset = PARTICLE_PRESETS[activePresetIdx];

  return (
    <div className="particles-container">
      {/* Interactive HUD & Legend Overlay */}
      <div className="particles-hud">
        <div className="particles-hud-header" onClick={() => setIsCollapsed(prev => !prev)}>
          <div className="particles-hud-title">
            <span>✨ 3D Particles</span>
            <span className="particles-hud-badge">
              {currentPreset.label} deeltjes
            </span>
            <span className={`particles-engine-badge ${engine}`}>
              {engine === 'gpu' ? '🚀 GPU' : '⚡ CPU'}
            </span>
            <span className={`particles-fps-badge ${fps >= 55 ? 'fps-good' : fps >= 30 ? 'fps-warning' : 'fps-bad'}`}>
              {fps} FPS
            </span>
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
            {/* Engine Switcher */}
            <div className="engine-switcher-section">
              <span className="section-label">Engine (G)</span>
              <div className="engine-switcher-buttons">
                <button
                  type="button"
                  className={`engine-toggle-btn ${engine === 'gpu' ? 'active gpu' : ''}`}
                  onClick={toggleEngine}
                >
                  🚀 GPU (GPGPU Shaders)
                </button>
                <button
                  type="button"
                  className={`engine-toggle-btn ${engine === 'cpu' ? 'active cpu' : ''}`}
                  onClick={toggleEngine}
                >
                  ⚡ CPU (Level 1)
                </button>
              </div>
            </div>

            {/* Particle Count Preset Selector */}
            <div className="particles-count-section">
              <div className="particles-section-header">
                <span className="section-label">Aantal Deeltjes (1-6)</span>
                <span className="section-val">{currentPreset.value.toLocaleString('nl-NL')}</span>
              </div>
              <div className="particles-preset-group">
                {PARTICLE_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`preset-btn ${activePresetIdx === idx ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(idx)}
                    title={`${preset.value.toLocaleString('nl-NL')} deeltjes (Toets ${preset.key})`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Status Indicators */}
            <div className="particles-status-grid">
              <div className="status-pill" onClick={toggleEngine} style={{ cursor: 'pointer' }} title="Klik om engine te wisselen">
                <span className="status-pill-label">Engine (G)</span>
                <span className="status-pill-val">
                  <span className={`status-indicator ${engine === 'gpu' ? 'fps-good' : 'respawn'}`}></span>
                  {engine === 'gpu' ? '🚀 GPU Shaders' : '⚡ CPU L1'}
                </span>
              </div>

              <div className="status-pill" onClick={toggleGravityMode} style={{ cursor: 'pointer' }} title="Klik om zwaartekrachtmodus te wisselen">
                <span className="status-pill-label">Zwaartekracht (O)</span>
                <span className="status-pill-val">
                  <span className={`status-indicator ${gravityMode === 'orbit' ? 'fps-good' : 'respawn'}`}></span>
                  {gravityMode === 'orbit' ? '🌀 Orbit (Soft)' : '🚀 Slingshot (Punt)'}
                </span>
              </div>

              <div className="status-pill">
                <span className="status-pill-label">Framerate</span>
                <span className="status-pill-val">
                  <span className={`status-indicator ${fps >= 55 ? 'fps-good' : fps >= 30 ? 'fps-warning' : 'fps-bad'}`}></span>
                  {fps} FPS
                </span>
              </div>

              <div className="status-pill">
                <span className="status-pill-label">Rekentijd / Dispatch</span>
                <span className="status-pill-val">
                  <span className={`status-indicator ${simTime < 5 ? 'fps-good' : simTime < 16.6 ? 'fps-warning' : 'fps-bad'}`}></span>
                  ⏱️ {simTime}ms <span className="frame-time-text">/ 16.6ms</span>
                </span>
              </div>

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
                <div className="legend-keys"><span className="key-badge">G</span></div>
                <div className="legend-action">Wissel Engine (GPU / CPU)</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">O</span></div>
                <div className="legend-action">Wissel Zwaartekracht (Orbit / Slingshot)</div>
              </div>
              <div className="legend-row">
                <div className="legend-keys"><span className="key-badge">1</span>..<span className="key-badge">6</span></div>
                <div className="legend-action">Kies aantal deeltjes (500k..16M)</div>
              </div>
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
