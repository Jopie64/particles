import React from 'react';
import * as THREE from 'three';
import { useKeyEvent } from '../utils/useEvent';
import { useThreeScene } from '../utils/useThree';

function Particles() {

  const addKeyHandler = useKeyEvent();


  const node = useThreeScene(({ scene, mouseRay }) => {
    // create the particle variables
    const particles: number[] = [];
    const dParticles: number[] = [];
    const particleColors: number[] = [];

    const speed = 0.1;
    const geometry = new THREE.BufferGeometry();

    const reset = () => {
      const color = new THREE.Color();
      const zAxis = new THREE.Vector3(0, 0, 1);
      const xAxis = new THREE.Vector3(1, 0, 0);
      const particleCount = 100000;

      particles.length = 0;
      dParticles.length = 0;
      particleColors.length = 0;
      for ( let i = 0; i < particleCount; i ++ ) {

        const perc = i / particleCount;

        // const x = THREE.MathU tils.randFloatSpread( 2000 );
        // const y = THREE.MathUtils.randFloatSpread( 2000 );
        // const z = THREE.MathUtils.randFloatSpread( 2000 );
        const x = 0;
        const y = 0;
        const z = 0;

        particles.push( x, y, z );

        //const dp = new THREE.Vector3(perc * speed, 0, 0);
        const dp = new THREE.Vector3(((perc * 3 | 0) / 3 + .1) * speed, 0, 0);

        // dp.applyAxisAngle(zAxis, perc * Math.PI * 40);
        // dp.applyAxisAngle(xAxis, perc * Math.PI * 2);
        dp.applyAxisAngle(zAxis, THREE.MathUtils.randFloatSpread(Math.PI * 2));
        // dp.applyAxisAngle(xAxis, THREE.MathUtils.randFloatSpread(Math.PI * 2));

        dParticles.push(dp.x, dp.y, dp.z);

        color.setHSL(perc, 1.0, 0.5);
        particleColors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( particles, 3 ) );
      geometry.setAttribute( 'color', new THREE.Float32BufferAttribute(particleColors, 3));
    };

    reset();


    const material = new THREE.PointsMaterial( { size: 1, vertexColors: true } );
    //const material = new THREE.PointsMaterial( { color: 0xD08010, size: 1 } );

    const points = new THREE.Points( geometry, material );

    scene.add( points );

    // Me
    const createMe = (mass: number) => {
      const geometry = new THREE.SphereGeometry(Math.pow(mass, 1/3), 32, 32);
      const material = new THREE.MeshBasicMaterial( { color: 0xffffff } );
      const mesh = new THREE.Mesh( geometry, material );
      mesh.material.color.setRGB(1,1,1);
      return {
        geometry,
        material,
        mesh
      };
    };
    let mass = 1;
    let me = createMe(mass);

    scene.add(me.mesh);

    // Keyboard handling
    let push = true;
    addKeyHandler(' ', _ => push = !push);
    addKeyHandler('r', reset);
    const multMass = (factor: number) => () => {
      mass *= factor;
      scene.remove(me.mesh);
      me = createMe(mass);
      scene.add(me.mesh);
    };
    addKeyHandler('=', multMass(1.5));
    addKeyHandler('+', multMass(1.5));
    addKeyHandler('-', multMass(0.75));

    const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Animate
    const bound = 500;
    return timeDiff => {

      const mePos = mouseRay.ray.intersectPlane(mousePlane, me.mesh.position);

      const particleCount = particles.length;

      const resistance = Math.pow(.9999, timeDiff);

      if (mePos) {
        const particlePos = new THREE.Vector3();
        const particleDist = new THREE.Vector3();
        const particleSpeed = new THREE.Vector3();
        for (let i = 0; i < particleCount; i += 3) {
          particlePos.set(particles[i], particles[i + 1], particles[i + 2]);
          particleSpeed.set(dParticles[i], dParticles[i + 1], dParticles[i + 2]);
          particleDist.subVectors(particlePos, mePos);
          const dist = particleDist.lengthSq();
          if (dist === 0) {
            continue;
          }
          const strength = mass / dist;
          const force = particleDist
            .normalize()
            .multiplyScalar(strength);
          if (push) {
            particleSpeed.add(force);
          } else {
            particleSpeed.sub(force);
          }
          particleSpeed.multiplyScalar(resistance);
          dParticles[i]     = particleSpeed.x;
          dParticles[i + 1] = particleSpeed.y;
          dParticles[i + 2] = particleSpeed.z;
        }
      }

      for (let i = 0; i < particleCount; i += 1) {
        if (particles[i] > bound && dParticles[i] > 0) {
          dParticles[i] = -dParticles[i];
        } else if (particles[i] < -bound && dParticles[i] < 0) {
          dParticles[i] = -dParticles[i];
        }
      }
      for (let i = 0; i < particleCount; i += 1) {
        particles[i] += dParticles[i] * timeDiff;
      }
      geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( particles, 3 ) );
    };
  });

  return (
    <div ref={node}>
    </div>
  );
}

export default Particles;
