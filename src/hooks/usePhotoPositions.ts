import { useState, useEffect, useMemo, useCallback } from 'react';
import { PatternFactory } from '../components/three/patterns/PatternFactory';
import { type SceneSettings } from '../store/sceneStore';

export type Photo = {
  id: string;
  url: string;
  collage_id?: string;
  created_at?: string;
};

export type PhotoPosition = {
  targetPosition: [number, number, number];
  targetRotation: [number, number, number];
  slotIndex: number;
};

export type PhotoWithPosition = Photo & PhotoPosition;

// Stable slot assignment system
class SlotManager {
  private slotAssignments = new Map<string, number>(); // photoId -> slotIndex
  private occupiedSlots = new Set<number>();
  private availableSlots: number[] = [];
  private totalSlots = 0;

  constructor(totalSlots: number) {
    this.updateSlotCount(totalSlots);
  }

  updateSlotCount(newTotal: number) {
    if (newTotal === this.totalSlots) return;
    
    this.totalSlots = newTotal;
    
    // Clear slots that are beyond the new limit
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (slotIndex >= newTotal) {
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }
    
    // Rebuild available slots
    this.rebuildAvailableSlots();
  }

  private rebuildAvailableSlots() {
    this.availableSlots = [];
    for (let i = 0; i < this.totalSlots; i++) {
      if (!this.occupiedSlots.has(i)) {
        this.availableSlots.push(i);
      }
    }
    // Shuffle for better distribution
    this.shuffleArray(this.availableSlots);
  }

  private shuffleArray(array: number[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  assignSlots(photos: Photo[]): Map<string, number> {
    // Safety check for photos array
    const safePhotos = Array.isArray(photos) ? photos.filter(p => p && p.id) : [];

    // Remove assignments for photos that no longer exist
    const currentPhotoIds = new Set(safePhotos.map(p => p.id));
    
    for (const [photoId, slotIndex] of this.slotAssignments.entries()) {
      if (!currentPhotoIds.has(photoId)) {
        this.slotAssignments.delete(photoId);
        this.occupiedSlots.delete(slotIndex);
      }
    }

    this.rebuildAvailableSlots();

    // Assign slots to new photos in order of creation (oldest first for stability)
    const sortedPhotos = [...safePhotos].sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return a.id.localeCompare(b.id);
    });

    for (const photo of sortedPhotos) {
      if (!this.slotAssignments.has(photo.id) && this.availableSlots.length > 0) {
        const slotIndex = this.availableSlots.shift()!;
        this.slotAssignments.set(photo.id, slotIndex);
        this.occupiedSlots.add(slotIndex);
      }
    }

    return new Map(this.slotAssignments);
  }
}

export const usePhotoPositions = (photos: Photo[], settings: SceneSettings, time: number = 0) => {
  const [photosWithPositions, setPhotosWithPositions] = useState<PhotoWithPosition[]>([]);
  const slotManagerRef = useMemo(() => new SlotManager(settings.photoCount || 100), []);
  
  // Update slot manager when photo count changes
  useEffect(() => {
    slotManagerRef.updateSlotCount(settings.photoCount || 100);
  }, [settings.photoCount, slotManagerRef]);
  
  // Memoize the pattern generator based on animation pattern
  const patternGenerator = useMemo(() => {
    return PatternFactory.createPattern(
      settings.animationPattern || 'grid', 
      settings, 
      photos
    );
  }, [settings.animationPattern, settings, photos]);
  
  // Calculate positions for all photos
  const calculatePositions = useCallback(() => {
    try {
      // Safety check for photos
      const safePhotos = Array.isArray(photos) ? photos.filter(p => p && p.id) : [];
      
      // Get slot assignments
      const slotAssignments = slotManagerRef.assignSlots(safePhotos);
      
      // Generate pattern positions
      const patternState = patternGenerator.generatePositions(time);
      
      const newPhotosWithPositions: PhotoWithPosition[] = [];
      
      // Create photos with assigned slots
      for (const photo of safePhotos) {
        const slotIndex = slotAssignments.get(photo.id);
        if (slotIndex !== undefined && slotIndex < (settings.photoCount || 100)) {
          newPhotosWithPositions.push({
            ...photo,
            targetPosition: patternState.positions[slotIndex] || [0, 0, 0],
            targetRotation: patternState.rotations?.[slotIndex] || [0, 0, 0],
            slotIndex,
          });
        }
      }
      
      // Add empty slots for remaining positions
      for (let i = 0; i < (settings.photoCount || 100); i++) {
        const hasPhoto = newPhotosWithPositions.some(p => p.slotIndex === i);
        if (!hasPhoto) {
          newPhotosWithPositions.push({
            id: `placeholder-${i}`,
            url: '',
            targetPosition: patternState.positions[i] || [0, 0, 0],
            targetRotation: patternState.rotations?.[i] || [0, 0, 0],
            slotIndex: i,
          });
        }
      }
      
      // Sort by slot index
      newPhotosWithPositions.sort((a, b) => a.slotIndex - b.slotIndex);
      
      setPhotosWithPositions(newPhotosWithPositions);
    } catch (error) {
      console.error('Error calculating positions:', error);
    }
  }, [photos, settings, time, patternGenerator, slotManagerRef]);
  
  // Calculate positions when dependencies change
  useEffect(() => {
    calculatePositions();
  }, [calculatePositions]);
  
  return {
    photosWithPositions,
    recalculate: calculatePositions
  };
};