// Texture caching system to prevent unnecessary reloads
import * as THREE from 'three';

class TextureCache {
  private cache = new Map<string, THREE.Texture>();
  private loadingPromises = new Map<string, Promise<THREE.Texture>>();
  
  getTexture(url: string): Promise<THREE.Texture> {
    // Return cached texture if available
    if (this.cache.has(url)) {
      return Promise.resolve(this.cache.get(url)!);
    }
    
    // Return in-progress loading promise if exists
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }
    
    // Create new loading promise
    const loadPromise = new Promise<THREE.Texture>((resolve, reject) => {
      console.log('🖼️ CACHE: Loading texture:', url.slice(-20));
      
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => {
          // Configure texture
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.format = THREE.RGBAFormat;
          texture.generateMipmaps = false;
          
          // Cache the texture
          this.cache.set(url, texture);
          this.loadingPromises.delete(url);
          
          console.log('✅ CACHE: Texture loaded:', url.slice(-20));
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error('❌ CACHE: Texture load error:', url.slice(-20), error);
          this.loadingPromises.delete(url);
          reject(error);
        }
      );
    });
    
    // Store the loading promise
    this.loadingPromises.set(url, loadPromise);
    return loadPromise;
  }
  
  dispose(url: string) {
    const texture = this.cache.get(url);
    if (texture) {
      texture.dispose();
      this.cache.delete(url);
    }
  }
  
  clear() {
    this.cache.forEach(texture => texture.dispose());
    this.cache.clear();
    this.loadingPromises.clear();
  }
  
  // Debug method to get cache stats
  getStats() {
    return {
      cacheSize: this.cache.size,
      loadingCount: this.loadingPromises.size,
      cachedUrls: Array.from(this.cache.keys()).map(url => url.slice(-20))
    };
  }
}

// Export singleton instance
export const textureCache = new TextureCache();