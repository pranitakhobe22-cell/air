import { useMemo } from 'react';
import useAerisStore from '@/store/aerisStore';
import useNodeStore from '@/store/useNodeStore';

/**
 * Hook that returns the active node's sensor data based on global node selection.
 * All pages use this to display per-node or aggregated data.
 *
 * Returns:
 *   sensors     - { pm25, co, o3, voc_index, pm10, nox }
 *   environment - { temperature, humidity, oxygen, pressure }
 *   derived     - { aqi, rri, risk_level, risk_color, ... }
 *   history     - array of history points
 *   nodeId      - active node ID or null
 *   nodeName    - display name
 *   isNodeView  - true if viewing a specific node (not aggregated)
 */
const useActiveNode = () => {
  const data = useAerisStore((s) => s.data);
  const resolveNode = useNodeStore((s) => s.resolveNode);

  return useMemo(() => {
    if (!data?.sensors || !data?.derived) {
      return { ready: false };
    }

    const perNode = data.perNode || {};
    const sectors = data.sectors || [];
    const resolved = resolveNode(perNode, sectors);

    // No specific node selected or no nodes available - use global/aggregated data
    if (!resolved || !resolved.nodeData) {
      return {
        ready: true,
        sensors: data.sensors,
        environment: data.environment,
        derived: data.derived,
        history: data.history || [],
        nodeId: null,
        nodeName: data.meta?.location || 'All Stations',
        isNodeView: false,
        isAutoSelected: false,
      };
    }

    // Specific node selected
    const { nodeId, nodeData, isAutoSelected } = resolved;
    const latest = nodeData.latest || {};

    return {
      ready: true,
      sensors: {
        pm25: latest.pm25 || 0,
        pm10: latest.pm10 || Math.round((latest.pm25 || 0) * 1.2),
        co: latest.co || 0,
        o3: latest.o3 || 0,
        nox: latest.nox || latest.no2 || 0,
        voc_index: latest.voc_index || latest.voc || 0,
      },
      environment: {
        temperature: latest.temperature || 0,
        humidity: latest.humidity || 0,
        oxygen: data.environment?.oxygen ?? 20.9,
        pressure: data.environment?.pressure ?? 1013,
      },
      derived: {
        ...data.derived,
        aqi: latest.aqi || 0,
        rri: latest.rri || 0,
      },
      history: (nodeData.history || []).map(h => ({
        timestamp: h.timestamp,
        aqi: h.aqi || 0,
        rri: h.rri || 0,
        pm25: h.pm25 || 0,
        co: h.co || 0,
        o3: h.o3 || 0,
        pm10: h.pm10 || Math.round((h.pm25 || 0) * 1.2),
        nox: h.nox || h.no2 || 0,
        voc_index: h.voc_index || h.voc || 0,
        temperature: h.temperature || 0,
        humidity: h.humidity || 0,
      })),
      nodeId,
      nodeName: nodeData.location || nodeId,
      isNodeView: true,
      isAutoSelected,
    };
  }, [data, resolveNode]);
};

export default useActiveNode;
