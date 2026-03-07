import { create } from 'zustand';

/**
 * Global node selection store.
 * - Tracks which ESP32 node the user is viewing.
 * - Auto-selects nearest node based on browser geolocation.
 * - 'auto' = nearest node, or specific nodeId for manual selection.
 */

const useNodeStore = create((set, get) => ({
  selectedNode: 'auto', // 'auto' | 'all' | 'ESP32_01' etc.
  userLocation: null,    // { lat, lng } from browser geolocation
  geoError: null,

  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),

  // Request browser geolocation once
  detectLocation: () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({
          userLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          geoError: null,
        });
      },
      (err) => {
        set({ geoError: err.message });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  },

  /**
   * Resolve which node to display based on selection + user location.
   * Returns { nodeId, nodeData, isAutoSelected } or null if 'all'.
   */
  resolveNode: (perNode, sectors) => {
    const { selectedNode, userLocation } = get();
    const nodeIds = Object.keys(perNode || {});
    if (nodeIds.length === 0) return null;

    // Manual selection
    if (selectedNode !== 'auto' && selectedNode !== 'all') {
      if (perNode[selectedNode]) {
        return { nodeId: selectedNode, nodeData: perNode[selectedNode], isAutoSelected: false };
      }
      return null;
    }

    // 'all' = show aggregated data
    if (selectedNode === 'all') return null;

    // 'auto' = find nearest node
    if (userLocation && sectors?.length > 0) {
      const espSectors = sectors.filter(s => nodeIds.includes(s.id));
      if (espSectors.length > 0) {
        let nearest = espSectors[0];
        let minDist = Infinity;
        for (const s of espSectors) {
          const d = haversine(userLocation.lat, userLocation.lng, s.lat, s.lng);
          if (d < minDist) { minDist = d; nearest = s; }
        }
        return { nodeId: nearest.id, nodeData: perNode[nearest.id], isAutoSelected: true };
      }
    }

    // Fallback: first available node
    const firstId = nodeIds[0];
    return { nodeId: firstId, nodeData: perNode[firstId], isAutoSelected: true };
  },
}));

// Simple haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default useNodeStore;
