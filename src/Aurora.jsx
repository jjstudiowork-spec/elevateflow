import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float alpha = 0.0;
    
    for(float i = 1.0; i < 4.0; i++) {
      p.x += 0.3 / i * sin(i * 3.0 * p.y + uTime * 0.5);
      p.y += 0.3 / i * cos(i * 3.0 * p.x + uTime * 0.5);
      alpha += abs(0.05 / p.y);
    }
    
    vec3 color = mix(uColor1, uColor2, vUv.y);
    color = mix(color, uColor3, alpha * 0.2);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function AuroraContent({ color1, color2, color3 }) {
  const meshRef = useRef();
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(color1) },
    uColor2: { value: new THREE.Color(color2) },
    uColor3: { value: new THREE.Color(color3) }
  }), [color1, color2, color3]);

  useFrame((state) => {
    meshRef.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function Aurora({ color1 = "#a96800", color2 = "#444444", color3 = "#aa7942" }) {
  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      zIndex: -1,           // Keep it behind everything
      pointerEvents: 'none',
      background: '#000'    // Fallback if shader takes a second to load
    }}>
      <Canvas 
        gl={{ antialias: false }} 
        camera={{ position: [0, 0, 1] }}
        style={{ width: '100%', height: '100%' }}
      >
        <AuroraContent color1={color1} color2={color2} color3={color3} />
      </Canvas>
    </div>
  );
}