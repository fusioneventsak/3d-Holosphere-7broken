import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as THREE from 'three';

interface Photo {
  id: string;
  url: string;
  collage_id: string;
  created_at: string;
}

interface CollageSettings {
  gridSize: number;
  floorSize: number;
  gridColor: string;
  photoSize: number;
  floorColor: string;
  photoCount: number;
  wallHeight: number;
  gridEnabled: boolean;
  gridOpacity: number;
  cameraHeight: number;
  floorEnabled: boolean;
  floorOpacity: number;
  photoSpacing: number;
  cameraEnabled: boolean;
  gridDivisions: number;
  animationSpeed: number;
  cameraDistance: number;
  emptySlotColor: string;
  floorMetalness: number;
  floorRoughness: number;
  spotlightAngle: number;
  spotlightColor: string;
  spotlightCount: number;
  spotlightWidth: number;
  backgroundColor: string;
  gridAspectRatio: number;
  spotlightHeight: number;
  animationEnabled: boolean;
  animationPattern: string;
  photoRotation?: boolean;
  floorReflectivity: number;
  spotlightDistance: number;
  spotlightPenumbra: number;
  backgroundGradient: boolean;
  spotlightIntensity: number;
  cameraRotationSpeed: number;
  ambientLightIntensity: number;
  backgroundGradientEnd: string;
  cameraRotationEnabled: boolean;
  backgroundGradientAngle: number;
  backgroundGradientStart: string;
  useStockPhotos: boolean;
  patterns?: {
    grid?: {
      enabled: boolean;
      animationSpeed: number;
      spacing: number;
      aspectRatio: number;
      wallHeight: number;
    };
    float?: {
      enabled: boolean;
      animationSpeed: number;
      spacing: number;
      height: number;
      spread: number;
    };
    wave?: {
      enabled: boolean;
      animationSpeed: number;
      spacing: number;
      amplitude: number;
      frequency: number;
    };
    spiral?: {
      enabled: boolean;
      animationSpeed: number;
      spacing: number;
      radius: number;
      heightStep: number;
    };
  };
}

interface CollageSceneProps {
  photos: Photo[];
  stockPhotos: Photo[];
  settings: CollageSettings;
  containerRef: React.RefObject<HTMLDivElement>;
  onSceneReady?: () => void;
  onPhotoClick?: (photo: Photo) => void;
}

interface PhotoMesh extends THREE.Mesh {
  userData: {
    photo: Photo;
    originalPosition: THREE.Vector3;
    targetPosition: THREE.Vector3;
    isLoaded: boolean;
  };
}

interface EmptySlotMesh extends THREE.Mesh {
  userData: {
    slotIndex: number;
    originalPosition: THREE.Vector3;
  };
}

export const CollageScene: React.FC<CollageSceneProps> = ({
  photos,
  stockPhotos,
  settings,
  containerRef,
  onSceneReady,
  onPhotoClick
}) => {
  const [sceneInitialized, setSceneInitialized] = useState(false);
  const [loadedTextureCount, setLoadedTextureCount] = useState(0);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  
  const photoMeshesRef = useRef<Map<string, PhotoMesh>>(new Map());
  const emptySlotMeshesRef = useRef<EmptySlotMesh[]>([]);
  const lightsRef = useRef<THREE.Light[]>([]);
  const floorRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  
  const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());
  const loadedTexturesRef = useRef<Map<string, THREE.Texture>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Performance monitoring
  const performanceRef = useRef({
    frameCount: 0,
    lastFPSCheck: 0,
    fps: 60
  });

  // Calculate photo positions based on selected pattern
  const photoPositions = useMemo(() => {
    const positions: Array<{ 
      x: number; 
      y: number; 
      z: number; 
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    }> = [];
    
    const { photoCount, gridAspectRatio, photoSpacing, animationPattern } = settings;
    const pattern = settings.patterns?.[animationPattern as keyof typeof settings.patterns];
    
    switch (animationPattern) {
      case 'grid':
        const cols = Math.ceil(Math.sqrt(photoCount * gridAspectRatio));
        const rows = Math.ceil(photoCount / cols);
        
        for (let i = 0; i < photoCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          
          const x = (col - (cols - 1) / 2) * (settings.photoSize + photoSpacing);
          const y = pattern?.wallHeight || 0;
          const z = (row - (rows - 1) / 2) * (settings.photoSize + photoSpacing);
          
          positions.push({
            x, y, z,
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          });
        }
        break;
        
      case 'spiral':
        const spiralPattern = settings.patterns?.spiral;
        for (let i = 0; i < photoCount; i++) {
          const angle = i * 0.5;
          const radius = (spiralPattern?.radius || 15) * Math.sqrt(i / photoCount);
          const x = radius * Math.cos(angle);
          const z = radius * Math.sin(angle);
          const y = i * (spiralPattern?.heightStep || 0.5);
          
          positions.push({
            x, y, z,
            rotation: { x: 0, y: angle, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          });
        }
        break;
        
      case 'wave':
        const wavePattern = settings.patterns?.wave;
        const waveFreq = wavePattern?.frequency || 0.5;
        const waveAmp = wavePattern?.amplitude || 5;
        
        for (let i = 0; i < photoCount; i++) {
          const t = i / photoCount;
          const x = (t - 0.5) * 40;
          const y = Math.sin(t * Math.PI * 2 * waveFreq) * waveAmp;
          const z = Math.cos(t * Math.PI * 2 * waveFreq) * waveAmp * 0.5;
          
          positions.push({
            x, y, z,
            rotation: { x: 0, y: t * Math.PI, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          });
        }
        break;
        
      case 'float':
        const floatPattern = settings.patterns?.float;
        const spread = floatPattern?.spread || 25;
        const height = floatPattern?.height || 30;
        
        for (let i = 0; i < photoCount; i++) {
          const x = (Math.random() - 0.5) * spread;
          const y = Math.random() * height;
          const z = (Math.random() - 0.5) * spread;
          
          positions.push({
            x, y, z,
            rotation: { 
              x: (Math.random() - 0.5) * 0.5, 
              y: Math.random() * Math.PI * 2, 
              z: (Math.random() - 0.5) * 0.5 
            },
            scale: { 
              x: 0.8 + Math.random() * 0.4, 
              y: 0.8 + Math.random() * 0.4, 
              z: 1 
            }
          });
        }
        break;
        
      default:
        // Fallback to grid
        const defaultCols = Math.ceil(Math.sqrt(photoCount * gridAspectRatio));
        const defaultRows = Math.ceil(photoCount / defaultCols);
        
        for (let i = 0; i < photoCount; i++) {
          const col = i % defaultCols;
          const row = Math.floor(i / defaultCols);
          
          const x = (col - (defaultCols - 1) / 2) * (settings.photoSize + photoSpacing);
          const y = 0;
          const z = (row - (defaultRows - 1) / 2) * (settings.photoSize + photoSpacing);
          
          positions.push({
            x, y, z,
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          });
        }
    }
    
    return positions;
  }, [settings]);

  // Combine photos and stock photos
  const allPhotos = useMemo(() => {
    if (settings.useStockPhotos === false) {
      return photos.slice(0, settings.photoCount);
    }
    return [...photos, ...stockPhotos].slice(0, settings.photoCount);
  }, [photos, stockPhotos, settings.photoCount, settings.useStockPhotos]);

  // Mouse event handlers
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  const handleMouseClick = useCallback((event: MouseEvent) => {
    if (!sceneRef.current || !cameraRef.current || !onPhotoClick) return;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(
      Array.from(photoMeshesRef.current.values())
    );
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object as PhotoMesh;
      if (mesh.userData.photo) {
        onPhotoClick(mesh.userData.photo);
      }
    }
  }, [onPhotoClick]);

  // Initialize scene
  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    // Clean up existing scene
    if (sceneRef.current) {
      sceneRef.current.clear();
    }

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Set background
    if (settings.backgroundGradient) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d')!;
      
      const gradient = context.createLinearGradient(
        0, 0, 
        Math.cos((settings.backgroundGradientAngle * Math.PI) / 180) * canvas.width,
        Math.sin((settings.backgroundGradientAngle * Math.PI) / 180) * canvas.height
      );
      gradient.addColorStop(0, settings.backgroundGradientStart);
      gradient.addColorStop(1, settings.backgroundGradientEnd);
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      const texture = new THREE.CanvasTexture(canvas);
      scene.background = texture;
    } else {
      scene.background = new THREE.Color(settings.backgroundColor);
    }

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, settings.cameraHeight, settings.cameraDistance);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // Clear container and add canvas
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Add event listeners
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleMouseClick);

    // Clear lights array
    lightsRef.current = [];

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, settings.ambientLightIntensity);
    scene.add(ambientLight);
    lightsRef.current.push(ambientLight);

    // Add directional light for better depth perception
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    lightsRef.current.push(directionalLight);

    // Add spotlights
    for (let i = 0; i < settings.spotlightCount; i++) {
      const spotlight = new THREE.SpotLight(
        new THREE.Color(settings.spotlightColor),
        settings.spotlightIntensity / 100,
        settings.spotlightDistance,
        settings.spotlightAngle,
        settings.spotlightPenumbra
      );
      
      const angle = (i / settings.spotlightCount) * Math.PI * 2;
      spotlight.position.set(
        Math.cos(angle) * settings.spotlightWidth * 10,
        settings.spotlightHeight,
        Math.sin(angle) * settings.spotlightWidth * 10
      );
      spotlight.target.position.set(0, 0, 0);
      spotlight.castShadow = true;
      spotlight.shadow.mapSize.width = 1024;
      spotlight.shadow.mapSize.height = 1024;
      
      scene.add(spotlight);
      scene.add(spotlight.target);
      lightsRef.current.push(spotlight);
    }

    // Add floor
    if (settings.floorEnabled) {
      const floorGeometry = new THREE.PlaneGeometry(settings.floorSize, settings.floorSize);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(settings.floorColor),
        transparent: settings.floorOpacity < 1,
        opacity: settings.floorOpacity,
        metalness: settings.floorMetalness,
        roughness: settings.floorRoughness,
        reflectivity: settings.floorReflectivity
      });
      
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.1;
      floor.receiveShadow = true;
      scene.add(floor);
      floorRef.current = floor;
    }

    // Add grid
    if (settings.gridEnabled) {
      const gridHelper = new THREE.GridHelper(
        settings.gridSize,
        settings.gridDivisions,
        new THREE.Color(settings.gridColor),
        new THREE.Color(settings.gridColor)
      );
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = settings.gridOpacity;
      scene.add(gridHelper);
      gridRef.current = gridHelper;
    }

    setSceneInitialized(true);
    if (onSceneReady) {
      onSceneReady();
    }
  }, [settings, containerRef, handleMouseMove, handleMouseClick, onSceneReady]);

  // Create photo mesh with enhanced features
  const createPhotoMesh = useCallback((photo: Photo, position: any) => {
    const geometry = new THREE.PlaneGeometry(settings.photoSize, settings.photoSize);
    
    // Create material with loading state
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material) as PhotoMesh;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(position.rotation.x, position.rotation.y, position.rotation.z);
    mesh.scale.set(position.scale.x, position.scale.y, position.scale.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Set user data
    mesh.userData = {
      photo,
      originalPosition: new THREE.Vector3(position.x, position.y, position.z),
      targetPosition: new THREE.Vector3(position.x, position.y, position.z),
      isLoaded: false
    };
    
    // Load texture asynchronously
    if (!loadedTexturesRef.current.has(photo.url)) {
      textureLoaderRef.current.load(
        photo.url,
        (texture) => {
          loadedTexturesRef.current.set(photo.url, texture);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          material.map = texture;
          material.color.setHex(0xffffff);
          material.opacity = 1.0;
          material.needsUpdate = true;
          mesh.userData.isLoaded = true;
          
          setLoadedTextureCount(prev => prev + 1);
        },
        (progress) => {
          // Optional: Handle loading progress
          const percent = (progress.loaded / progress.total) * 100;
          material.opacity = 0.3 + (percent / 100) * 0.7;
        },
        (error) => {
          console.error('Error loading texture:', error);
          // Set error state material
          material.color.setHex(0xff6b6b);
          material.opacity = 0.5;
        }
      );
    } else {
      // Use cached texture
      const texture = loadedTexturesRef.current.get(photo.url)!;
      material.map = texture;
      material.color.setHex(0xffffff);
      material.opacity = 1.0;
      mesh.userData.isLoaded = true;
    }
    
    return mesh;
  }, [settings.photoSize]);

  // Create empty slot mesh with better visual feedback
  const createEmptySlotMesh = useCallback((position: any, index: number) => {
    const geometry = new THREE.PlaneGeometry(settings.photoSize * 0.9, settings.photoSize * 0.9);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(settings.emptySlotColor),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      wireframe: false
    });
    
    // Add border
    const borderGeometry = new THREE.EdgesGeometry(geometry);
    const borderMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(settings.emptySlotColor),
      transparent: true,
      opacity: 0.3
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    
    const mesh = new THREE.Mesh(geometry, material) as EmptySlotMesh;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(position.rotation.x, position.rotation.y, position.rotation.z);
    mesh.scale.set(position.scale.x, position.scale.y, position.scale.z);
    mesh.add(border);
    
    mesh.userData = {
      slotIndex: index,
      originalPosition: new THREE.Vector3(position.x, position.y, position.z)
    };
    
    return mesh;
  }, [settings.photoSize, settings.emptySlotColor]);

  // Update photos without re-rendering entire scene
  const updatePhotos = useCallback(() => {
    if (!sceneRef.current) return;

    // Remove existing photo meshes
    photoMeshesRef.current.forEach((mesh) => {
      sceneRef.current!.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });
    photoMeshesRef.current.clear();

    // Remove existing empty slot meshes
    emptySlotMeshesRef.current.forEach((mesh) => {
      sceneRef.current!.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });
    emptySlotMeshesRef.current.length = 0;

    // Add photo meshes
    allPhotos.forEach((photo, index) => {
      if (index < photoPositions.length) {
        const mesh = createPhotoMesh(photo, photoPositions[index]);
        sceneRef.current!.add(mesh);
        photoMeshesRef.current.set(photo.id, mesh);
      }
    });

    // Add empty slot meshes for remaining positions
    for (let i = allPhotos.length; i < photoPositions.length; i++) {
      const mesh = createEmptySlotMesh(photoPositions[i], i);
      sceneRef.current!.add(mesh);
      emptySlotMeshesRef.current.push(mesh);
    }
  }, [allPhotos, photoPositions, createPhotoMesh, createEmptySlotMesh]);

  // Animation loop with performance monitoring
  const animate = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;

    const clock = clockRef.current;
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Performance monitoring
    const perf = performanceRef.current;
    perf.frameCount++;
    if (elapsed - perf.lastFPSCheck >= 1.0) {
      perf.fps = perf.frameCount / (elapsed - perf.lastFPSCheck);
      perf.frameCount = 0;
      perf.lastFPSCheck = elapsed;
    }

    // Camera rotation
    if (settings.cameraRotationEnabled) {
      const rotationSpeed = settings.cameraRotationSpeed * delta;
      cameraRef.current.position.x = Math.cos(elapsed * rotationSpeed) * settings.cameraDistance;
      cameraRef.current.position.z = Math.sin(elapsed * rotationSpeed) * settings.cameraDistance;
      cameraRef.current.lookAt(0, 0, 0);
    }

    // Photo animations
    if (settings.animationEnabled) {
      const animSpeed = settings.animationSpeed / 100;
      
      photoMeshesRef.current.forEach((mesh) => {
        if (settings.photoRotation) {
          mesh.rotation.y = Math.sin(elapsed * animSpeed + mesh.userData.photo.id.length) * 0.1;
          mesh.rotation.x = Math.cos(elapsed * animSpeed * 0.7 + mesh.userData.photo.id.length) * 0.05;
        }
        
        // Gentle floating animation
        const floatOffset = Math.sin(elapsed * animSpeed * 0.5 + mesh.userData.photo.id.length) * 0.1;
        mesh.position.y = mesh.userData.originalPosition.y + floatOffset;
        
        // Breathing scale effect
        const scaleOffset = 1 + Math.sin(elapsed * animSpeed * 0.3 + mesh.userData.photo.id.length) * 0.02;
        mesh.scale.setScalar(scaleOffset);
      });
      
      // Empty slot subtle animation
      emptySlotMeshesRef.current.forEach((mesh, index) => {
        const pulseOffset = Math.sin(elapsed * animSpeed + index) * 0.1 + 0.15;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.opacity = pulseOffset;
        }
      });
    }

    // Pattern-specific animations
    if (settings.animationEnabled && settings.patterns) {
      const pattern = settings.patterns[settings.animationPattern as keyof typeof settings.patterns];
      
      if (pattern?.enabled && settings.animationPattern === 'wave') {
        const waveSpeed = (pattern.animationSpeed || 1) * delta;
        photoMeshesRef.current.forEach((mesh, index) => {
          const waveY = Math.sin(elapsed * waveSpeed + index * 0.5) * 2;
          mesh.position.y = mesh.userData.originalPosition.y + waveY;
        });
      }
    }

    // Update lights based on time
    lightsRef.current.forEach((light, index) => {
      if (light instanceof THREE.SpotLight) {
        const lightSpeed = settings.cameraRotationSpeed * 0.5;
        const angle = elapsed * lightSpeed + (index / settings.spotlightCount) * Math.PI * 2;
        light.position.x = Math.cos(angle) * settings.spotlightWidth * 10;
        light.position.z = Math.sin(angle) * settings.spotlightWidth * 10;
      }
    });

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [settings]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  // Initialize scene on mount
  useEffect(() => {
    initScene();
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      
      // Clean up event listeners
      if (rendererRef.current?.domElement) {
        rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove);
        rendererRef.current.domElement.removeEventListener('click', handleMouseClick);
      }
      
      // Clean up WebGL resources
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      loadedTexturesRef.current.forEach(texture => texture.dispose());
      loadedTexturesRef.current.clear();
      
      photoMeshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
      photoMeshesRef.current.clear();
      
      emptySlotMeshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
      emptySlotMeshesRef.current.length = 0;
    };
  }, [initScene, handleResize, handleMouseMove, handleMouseClick]);

  // Update photos when they change
  useEffect(() => {
    if (sceneInitialized) {
      updatePhotos();
    }
  }, [updatePhotos, sceneInitialized]);

  // Start animation
  useEffect(() => {
    if (sceneInitialized) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animate();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate, sceneInitialized]);

  // Performance info for debugging
  const performanceInfo = {
    fps: performanceRef.current.fps,
    photoCount: allPhotos.length,
    emptySlots: photoPositions.length - allPhotos.length,
    loadedTextures: loadedTextureCount,
    totalTextures: allPhotos.length
  };

  // Expose performance info to parent component
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).performanceInfo = performanceInfo;
    }
  }, [performanceInfo]);

  return null; // The scene is rendered directly to the container
};