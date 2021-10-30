import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function Particles() {

  const node = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Init three
    const currentNode = node.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    currentNode?.appendChild(renderer.domElement);
    camera.position.z = 5;

    // create the particle variables
    const particles: number[] = [];
    const dParticles: number[] = [];
    const particleColors: number[] = [];
    const color = new THREE.Color();

    const particleCount = 100000;

    for ( let i = 0; i < particleCount; i ++ ) {

      const perc = i / particleCount;

      // const x = THREE.MathUtils.randFloatSpread( 2000 );
      // const y = THREE.MathUtils.randFloatSpread( 2000 );
      // const z = THREE.MathUtils.randFloatSpread( 2000 );
      const x = 0;
      const y = 0;
      const z = -500;

      particles.push( x, y, z );

      const dx = THREE.MathUtils.randFloatSpread( perc + 0.5 );
      const dy = THREE.MathUtils.randFloatSpread( perc + 0.5);
      const dz = THREE.MathUtils.randFloatSpread( perc + 0.5);

      dParticles.push( dx, dy, dz );

      color.setHSL(perc, 1.0, 0.5);
      particleColors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( particles, 3 ) );
    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute(particleColors, 3));

    const material = new THREE.PointsMaterial( { size: 1, vertexColors: true } );
    //const material = new THREE.PointsMaterial( { color: 0xD08010, size: 1 } );

    const points = new THREE.Points( geometry, material );

    scene.add( points );

    // Animate
    let stopAnimation = false;

    const animate = () => {
      if (stopAnimation) {
        return;
      }
      requestAnimationFrame( animate );

      const particleCount = particles.length;
      for (let i = 0; i < particleCount; i += 1) {
        particles[i] += dParticles[i];
      }
      geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( particles, 3 ) );
      renderer.render( scene, camera );
    };

    animate();
    return () => {
      stopAnimation = true;
      currentNode?.removeChild(renderer.domElement);
    };
  });

  return (
    <div ref={node}>
    </div>
  );
}

export default Particles;
