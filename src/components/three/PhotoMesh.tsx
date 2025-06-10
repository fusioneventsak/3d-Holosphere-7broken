import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { textureCache } from '../../lib/textureCache';

export type PhotoWithPosition = {
  id: string;
  url: string;
  targetPosition: [number, number, number];
  targetRotation: [number, number, number];
  slotIndex: number;
  collage_id?: string;
  created_at?: string;
};

interface PhotoMeshProps {
  photo: PhotoWithPosition;
  size: number;
  emptySlotColor: string;
  pattern: string;
  shouldFaceCamera: boolean;
  brightness: number;
}

// Smoothing values for animations
const POSITION_SMOOTHING = 0.1;
const ROTATION_SMOOTHING = 0.1;
const TELEPORT_THRESHOLD = 30;
const SCALE_SMOOTHING = 0.15;

// Memoized PhotoMesh component with custom comparison
const PhotoMesh = React.memo<PhotoMeshProps>(({ 
  photo, 
  size, 
  emptySlotColor, 
  pattern, 
  shouldFaceCamera, 
  brightness 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.Material | null>(null);
  const { camera } = useThree();
  
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Refs for animation state
  const isInitializedRef = useRef(false);
  const lastPositionRef = useRef<[number, number, number]>([0, 0, 0]);
  const currentPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const currentRotation = useRef<THREE.Euler>(new THREE.Euler());
  const currentScale = useRef<number>(0);
  const targetScale = useRef<number>(photo.url ? 1 : 0);

  // Load texture using cache when photo URL changes
  useEffect(() => {
    if (!photo.url || isLoading) return;
    
    setIsLoading(true);
    setHasError(false);
    
    // Update target scale based on whether we have a URL
    targetScale.current = photo.url ? 1 : 0;

    // Use texture cache to load
    textureCache.getTexture(photo.url)
      .then(loadedTexture => {
        setTexture(loadedTexture);
        setIsLoading(false);
        
        // Update material if it exists
        if (materialRef.current) {
          (materialRef.current as THREE.MeshStandardMaterial).map = loadedTexture;
          materialRef.current.needsUpdate = true;
        }
      })
      .catch(error => {
        console.error('Failed to load texture:', error);
        setHasError(true);
        setIsLoading(false);
        targetScale.current = 0; // Hide on error
      });
      
    // No cleanup needed - textures are managed by the cache
  }, [photo.url]);

  // Camera facing logic
  useFrame(() => {
    if (!meshRef.current || !shouldFaceCamera) return;

    const mesh = meshRef.current;
    const currentPositionArray = mesh.position.toArray() as [number, number, number];
    
    // Only update if position changed significantly
    const positionChanged = currentPositionArray.some((coord, index) => 
      Math.abs(coord - lastPositionRef.current[index]) > 0.01
    );

    if (positionChanged || !isInitializedRef.current) {
      mesh.lookAt(camera.position);
      lastPositionRef.current = currentPositionArray;
      isInitializedRef.current = true;
    }
  });

  // Smooth animation frame
  useFrame(() => {
    if (!meshRef.current) return;

    const targetPosition = new THREE.Vector3(...photo.targetPosition);
    const targetRotation = new THREE.Euler(...photo.targetRotation);

    // Check if this is a teleport (large distance change)
    const distance = currentPosition.current.distanceTo(targetPosition);
    const isTeleport = distance > TELEPORT_THRESHOLD;

    if (isTeleport) {
      // Instantly teleport to new position
      currentPosition.current.copy(targetPosition);
      currentRotation.current.copy(targetRotation);
    } else {
      // Smooth interpolation for normal movement
      currentPosition.current.lerp(targetPosition, POSITION_SMOOTHING);
      currentRotation.current.x += (targetRotation.x - currentRotation.current.x) * ROTATION_SMOOTHING;
      currentRotation.current.y += (targetRotation.y - currentRotation.current.y) * ROTATION_SMOOTHING;
      currentRotation.current.z += (targetRotation.z - currentRotation.current.z) * ROTATION_SMOOTHING;
    }

    // Smooth scale animation
    currentScale.current += (targetScale.current - currentScale.current) * SCALE_SMOOTHING;
    
    // Apply transformations
    meshRef.current.position.copy(currentPosition.current);
    if (!shouldFaceCamera) {
      meshRef.current.rotation.copy(currentRotation.current);
    }
    meshRef.current.scale.set(
      currentScale.current * size * (9/16), 
      currentScale.current * size, 
      currentScale.current * size
    );
  });

  // Create material with brightness control
  const material = useMemo(() => {
    if (texture) {
      const brightnessMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      
      // Apply brightness by modifying the material color
      brightnessMaterial.color.setScalar(brightness || 1.0);
      
      return brightnessMaterial;
    } else {
      // Empty slot material
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Fill with background color
      ctx.fillStyle = emptySlotColor || '#1A1A1A';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add pattern
      if (pattern === 'grid') {
        ctx.strokeStyle = '#ffffff20';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 512; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 512);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(512, i);
          ctx.stroke();
        }
      }
      
      const emptyTexture = new THREE.CanvasTexture(canvas);
      return new THREE.MeshStandardMaterial({
        map: emptyTexture,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
        color: 0xffffff,
      });
    }
  }, [texture, emptySlotColor, pattern, brightness]);

  // Store material ref for updates
  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  return (
    <mesh
      ref={meshRef}
      material={material}
      castShadow
      receiveShadow
      position={[0, 0, 0]} // Will be updated in animation frame
      scale={[0, 0, 0]} // Start invisible, will animate in
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props changed
  return (
    prevProps.photo.id === nextProps.photo.id &&
    prevProps.photo.url === nextProps.photo.url &&
    prevProps.size === nextProps.size &&
    prevProps.brightness === nextProps.brightness &&
    prevProps.emptySlotColor === nextProps.emptySlotColor &&
    prevProps.pattern === nextProps.pattern &&
    prevProps.shouldFaceCamera === nextProps.shouldFaceCamera &&
    // Only check position if it's a significant change
    Math.abs(prevProps.photo.targetPosition[0] - nextProps.photo.targetPosition[0]) < 0.1 &&
    Math.abs(prevProps.photo.targetPosition[1] - nextProps.photo.targetPosition[1]) < 0.1 &&
    Math.abs(prevProps.photo.targetPosition[2] - nextProps.photo.targetPosition[2]) < 0.1
  );
});

export default PhotoMesh;