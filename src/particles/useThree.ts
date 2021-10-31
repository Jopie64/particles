import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type ThreeScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

type Animate = (timeDiff: number) => void;
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
    let prevTime: number;

    const innerAnimate = (timeStamp: number) => {
      if (stopAnimation) {
        return;
      }
      if (prevTime === undefined) {
        prevTime = timeStamp;
      }
      requestAnimationFrame( innerAnimate );
      animate(timeStamp - prevTime);
      renderer.render( scene, camera );
      prevTime = timeStamp;
    };

    requestAnimationFrame( innerAnimate );
    return () => {
      stopAnimation = true;
      currentNode?.removeChild(renderer.domElement);
    };
  });

  return threeNode
}