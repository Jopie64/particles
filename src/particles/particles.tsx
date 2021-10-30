import React from 'react';
import * as THREE from "three";

const renderScene = (node: HTMLElement | null) => {
    if (!node) {
        return;
    }

    // Init three
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    node.appendChild( renderer.domElement );
    camera.position.z = 5;


    // Add cube
    var geometry = new THREE.BoxGeometry( 1, 1, 1 );
    var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    var cube = new THREE.Mesh( geometry, material );
    scene.add( cube );


    // Animate
    var animate = function () {
      requestAnimationFrame( animate );
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render( scene, camera );
    };
    animate();
};

function Particles() {
  return (
    <div ref={renderScene}>
    </div>
  );
}

export default Particles;
