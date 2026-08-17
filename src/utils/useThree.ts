import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Raycaster, Vector2 } from 'three';

type ThreeScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  mouseRay: THREE.Raycaster;
};

type Animate = (timeDiff: number) => void;
type InitThree = (scene: ThreeScene) => Animate;

export function useThreeScene(init: InitThree): React.RefObject<HTMLDivElement | null> {
  const threeNode = useRef<HTMLDivElement | null>(null);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    const currentNode = threeNode.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const mouse = new Vector2();
    const mouseRay = new Raycaster();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const onMouseMove = (e: MouseEvent) => {
      const size = renderer.getSize(new Vector2());
      if (size.x > 0 && size.y > 0) {
        mouse.x = (e.clientX / size.x) * 2 - 1;
        mouse.y = -(e.clientY / size.y) * 2 + 1;
        mouseRay.setFromCamera(mouse, camera);
      }
    };

    onResize();
    currentNode?.appendChild(renderer.domElement);

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    camera.position.z = 500;

    const animate = initRef.current({ scene, camera, renderer, mouseRay });

    let stopAnimation = false;
    let prevTime: number | undefined;

    const innerAnimate = (timeStamp: number) => {
      if (stopAnimation) {
        return;
      }
      if (prevTime === undefined) {
        prevTime = timeStamp;
      }
      requestAnimationFrame(innerAnimate);
      animate(timeStamp - prevTime);
      renderer.render(scene, camera);
      prevTime = timeStamp;
    };

    requestAnimationFrame(innerAnimate);

    return () => {
      stopAnimation = true;
      if (currentNode && renderer.domElement && currentNode.contains(renderer.domElement)) {
        currentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []); // Only initialize Three.js once on mount

  return threeNode;
}