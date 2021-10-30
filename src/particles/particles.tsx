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
    const vertices = [];

    for ( let i = 0; i < 100000; i ++ ) {

        const x = THREE.MathUtils.randFloatSpread( 2000 );
        const y = THREE.MathUtils.randFloatSpread( 2000 );
        const z = THREE.MathUtils.randFloatSpread( 2000 );

        vertices.push( x, y, z );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );

    const material = new THREE.PointsMaterial( { color: 0x888888 } );

    const points = new THREE.Points( geometry, material );

    scene.add( points );

    // Animate
    let stopAnimation = false;

    const animate = () => {
      if (stopAnimation) {
        return;
      }
      requestAnimationFrame( animate );
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
