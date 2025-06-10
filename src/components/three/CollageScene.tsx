import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { useCollageStore } from '../../store/collageStore';
import { usePhotoPositions, type Photo } from '../../hooks/usePhotoPositions';
import PhotoMesh from './PhotoMesh';

type CollageSceneProps = {
  settings: SceneSettings;
  onSettingsChange?: (settings: Partial<SceneSettings>, debounce?: boolean) => void;
};

// VolumetricSpotlight component
const VolumetricSpotlight: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  angle: number;
  color: string;
  intensity: number;
  distance: number;
  penumbra: number;
}> = ({ position, target, angle, color, intensity, distance, penumbra }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const coneGeometry = useMemo(() => {
    const height = distance * 1.5;
    const radius = Math.tan(angle) * height;
    return new THREE.ConeGeometry(radius, height, 32, 1, true);
  }, [angle, distance]);

  const material = useMemo(() => {
    const scaledIntensity = intensity * 0.0002;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        intensity: { value: scaledIntensity },
        penumbra: { value: penumbra },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        uniform float penumbra;
        varying vec3 vPosition;
        
        void main() {
          float gradient = 1.0 - (vPosition.y + 0.5);
          gradient = pow(gradient, 1.5 + penumbra);
          
          float radialFade = 1.0 - length(vPosition.xz) * (1.8 + penumbra * 0.4);
          radialFade = clamp(radialFade, 0.0, 1.0);
          radialFade = pow(radialFade, 1.0 + penumbra);
          
          float alpha = gradient * radialFade * intensity;
          alpha = clamp(alpha, 0.0, 0.4);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, intensity, penumbra]);

  useFrame(() => {
    if (!meshRef.current) return;
    
    meshRef.current.position.set(...position);
    
    const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...position));
    meshRef.current.lookAt(new THREE.Vector3(...position).add(direction));
    meshRef.current.rotateX(-Math.PI / 2);
  });

  return <mesh ref={meshRef} geometry={coneGeometry} material={material} />;
};

// SceneLighting component
const SceneLighting: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const groupRef = useRef<THREE.Group>(null);

  const spotlights = useMemo(() => {
    const lights = [];
    const count = Math.min(settings.spotlightCount || 3, 4);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distanceVariation = 0.9 + Math.random() * 0.2;
      const heightVariation = 0.95 + Math.random() * 0.1;
      
      const x = Math.cos(angle) * (settings.spotlightDistance || 50) * distanceVariation;
      const z = Math.sin(angle) * (settings.spotlightDistance || 50) * distanceVariation;
      const y = (settings.spotlightHeight || 30) * heightVariation;
      
      lights.push({
        key: `spotlight-${i}`,
        position: [x, y, z] as [number, number, number],
        target: [0, (settings.wallHeight || 0) / 2, 0] as [number, number, number],
        angleVariation: 0.95 + Math.random() * 0.1,
        intensityVariation: 0.9 + Math.random() * 0.2,
      });
    }
    return lights;
  }, [settings.spotlightCount, settings.spotlightDistance, settings.spotlightHeight, settings.wallHeight]);

  return (
    <group ref={groupRef}>
      <ambientLight 
        intensity={(settings.ambientLightIntensity || 0.4) * 0.8} 
        color="#ffffff" 
      />
      
      <fog attach="fog" args={['#000000', 30, 250]} />
      
      <directionalLight
        position={[20, 30, 20]}
        intensity={0.2}
        color="#ffffff"
        castShadow
      />
      
      {spotlights.map((light) => {
        const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
        targetRef.current.position.set(...light.target);
        
        const adjustedAngle = (settings.spotlightWidth || 0.3) * light.angleVariation;
        const baseIntensity = (settings.spotlightIntensity || 1) * 0.2;
        const adjustedIntensity = baseIntensity * light.intensityVariation;
        
        return (
          <group key={light.key}>
            <spotLight
              position={light.position}
              target={targetRef.current}
              angle={Math.max(0.1, adjustedAngle)}
              penumbra={settings.spotlightPenumbra || 0.5}
              intensity={adjustedIntensity * 5}
              color={settings.spotlightColor || '#ffffff'}
              distance={(settings.spotlightDistance || 50) * 2}
              decay={1.5}
              castShadow
            />
            <VolumetricSpotlight
              position={light.position}
              target={light.target}
              angle={adjustedAngle}
              color={settings.spotlightColor || '#ffffff'}
              intensity={(settings.spotlightIntensity || 1) * light.intensityVariation}
              distance={settings.spotlightDistance || 50}
              penumbra={settings.spotlightPenumbra || 0.5}
            />
            <primitive object={targetRef.current} />
          </group>
        );
      })}
    </group>
  );
};

// Floor component
const Floor: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.floorEnabled) return null;

  const floorMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: settings.floorColor,
      transparent: settings.floorOpacity < 1,
      opacity: settings.floorOpacity,
      metalness: Math.min(settings.floorMetalness || 0.5, 0.9),
      roughness: Math.max(settings.floorRoughness || 0.5, 0.1),
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
  }, [settings.floorColor, settings.floorOpacity, settings.floorMetalness, settings.floorRoughness]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={floorMaterial}>
      <planeGeometry args={[settings.floorSize, settings.floorSize, 32, 32]} />
    </mesh>
  );
};

// Grid component
const Grid: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  if (!settings.gridEnabled) return null;

  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(
      settings.gridSize,
      settings.gridDivisions,
      settings.gridColor,
      settings.gridColor
    );
    
    const material = helper.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = Math.min(settings.gridOpacity, 0.8);
    material.color = new THREE.Color(settings.gridColor);
    
    helper.position.y = 0.01;
    
    return helper;
  }, [settings.gridSize, settings.gridDivisions, settings.gridColor, settings.gridOpacity]);

  return <primitive object={gridHelper} />;
};

// CameraController component
const CameraController: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>();
  const userInteractingRef = useRef(false);
  
  useEffect(() => {
    if (camera && controlsRef.current) {
      const initialDistance = settings.cameraDistance;
      const initialHeight = settings.cameraHeight;
      const initialPosition = new THREE.Vector3(
        initialDistance,
        initialHeight,
        initialDistance
      );
      camera.position.copy(initialPosition);
      
      const target = new THREE.Vector3(0, settings.cameraHeight * 0.3, 0);
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  }, [camera, settings.cameraDistance, settings.cameraHeight]);

  useEffect(() => {
    if (!controlsRef.current) return;

    const handleStart = () => {
      userInteractingRef.current = true;
    };

    const handleEnd = () => {
      setTimeout(() => {
        userInteractingRef.current = false;
      }, 500);
    };

    const controls = controlsRef.current;
    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
    };
  }, []);

  useFrame((state, delta) => {
    if (!settings.cameraEnabled || !controlsRef.current) return;

    if (settings.cameraRotationEnabled && !userInteractingRef.current) {
      const offset = new THREE.Vector3().copy(camera.position).sub(controlsRef.current.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      
      spherical.theta += (settings.cameraRotationSpeed || 0.5) * delta;
      
      const newPosition = new THREE.Vector3().setFromSpherical(spherical).add(controlsRef.current.target);
      camera.position.copy(newPosition);
      controlsRef.current.update();
    }
  });

  return settings.cameraEnabled ? (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={5}
      maxDistance={200}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI - Math.PI / 6}
      enableDamping={true}
      dampingFactor={0.05}
    />
  ) : null;
};

// BackgroundRenderer component
const BackgroundRenderer: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  const { scene, gl } = useThree();
  
  useEffect(() => {
    try {
      if (settings.backgroundGradient) {
        scene.background = null;
        gl.setClearColor('#000000', 0);
      } else {
        scene.background = new THREE.Color(settings.backgroundColor || '#000000');
        gl.setClearColor(settings.backgroundColor || '#000000', 1);
      }
    } catch (error) {
      console.error('Background render error:', error);
    }
  }, [
    scene, 
    gl, 
    settings.backgroundColor, 
    settings.backgroundGradient
  ]);

  return null;
};

// AnimationController component
const AnimationController: React.FC<{
  settings: SceneSettings;
  onTimeUpdate: (time: number) => void;
}> = ({ settings, onTimeUpdate }) => {
  // Animation time state
  const timeRef = useRef(0);
  
  // Animation frame
  useFrame((state) => {
    try {
      if (settings.animationEnabled) {
        // Calculate animation time based on speed
        timeRef.current = state.clock.elapsedTime * ((settings.animationSpeed || 50) / 50);
        // Update parent with new time
        onTimeUpdate(timeRef.current);
      }
    } catch (error) {
      console.error('Animation error:', error);
    }
  });

  return null;
};

// SceneContent component
const SceneContent: React.FC<{ settings: SceneSettings }> = ({ settings }) => {
  // Get photos directly from store for real-time updates
  const photos = useCollageStore(state => state.photos);
  const [animationTime, setAnimationTime] = useState(0);
  
  // Use custom hook for position calculation
  const { photosWithPositions } = usePhotoPositions(photos, settings, animationTime);
  
  // Update animation time
  const handleTimeUpdate = (time: number) => {
    setAnimationTime(time);
  };
  
  return (
    <>
      <BackgroundRenderer settings={settings} />
      <CameraController settings={settings} />
      <SceneLighting settings={settings} />
      <Floor settings={settings} />
      <Grid settings={settings} />
      
      <AnimationController
        settings={settings}
        onTimeUpdate={handleTimeUpdate}
      />
      
      {/* Render photos with stable keys */}
      {photosWithPositions.map((photo) => (
        <PhotoMesh
          key={photo.id} // Stable key based only on photo ID
          photo={photo}
          size={settings.photoSize || 4.0}
          emptySlotColor={settings.emptySlotColor || '#1A1A1A'}
          pattern={settings.animationPattern || 'grid'}
          shouldFaceCamera={settings.photoRotation || false}
          brightness={settings.photoBrightness || 1.0}
        />
      ))}
    </>
  );
};

// Main CollageScene component
const CollageScene: React.FC<CollageSceneProps> = ({ settings }) => {
  const backgroundStyle = useMemo(() => {
    if (settings.backgroundGradient) {
      return {
        background: `linear-gradient(${settings.backgroundGradientAngle || 45}deg, ${settings.backgroundGradientStart || '#000000'}, ${settings.backgroundGradientEnd || '#000000'})`
      };
    }
    return {
      background: settings.backgroundColor || '#000000'
    };
  }, [
    settings.backgroundGradient,
    settings.backgroundColor,
    settings.backgroundGradientStart,
    settings.backgroundGradientEnd,
    settings.backgroundGradientAngle
  ]);

  return (
    <div style={backgroundStyle} className="w-full h-full">
      <Canvas 
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
        performance={{ min: 0.8 }}
        linear={true}
      >
        <SceneContent settings={settings} />
      </Canvas>
    </div>
  );
};

export default React.memo(CollageScene, (prevProps, nextProps) => {
  // Only re-render if settings change, not when photos change
  return JSON.stringify(prevProps.settings) === JSON.stringify(nextProps.settings);
});