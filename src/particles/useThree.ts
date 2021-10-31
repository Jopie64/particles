import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type ThreeScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

type Animate = () => void;
type InitThree = (scene: ThreeScene) => Animate;

export function useThreeScene(init: InitThree): React.MutableRefObject<HTMLDivElement | null> {
  const threeNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Init three
    const currentNode = threeNode.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    currentNode?.appendChild(renderer.domElement);
    camera.position.z = 500;

    const animate = init({scene, camera, renderer});

    // Animate
    let stopAnimation = false;

    const innerAnimate = () => {
      if (stopAnimation) {
        return;
      }
      requestAnimationFrame( innerAnimate );
      animate();
      renderer.render( scene, camera );
    };

    innerAnimate();
    return () => {
      stopAnimation = true;
      currentNode?.removeChild(renderer.domElement);
    };
  });

  return threeNode
}