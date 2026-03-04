const db = require('../utils/db');

const getNodes = async (req, res) => {
  try {
    const nodesRef = db.collection('nodes');
    const snapshot = await nodesRef.orderBy('name', 'asc').get();

    let active = 0;
    let offline = 0;
    const formattedNodes = [];

    snapshot.forEach(doc => {
      const n = doc.data();
      if (n.status === 'active') active++;
      else offline++;

      formattedNodes.push({
        id: doc.id,
        name: n.name,
        type: n.type,
        status: n.status,
        battery: n.battery || 100, // Optional tracking mapping
        lastPing: n.lastPing ? n.lastPing.toDate() : new Date()
      });
    });

    if (formattedNodes.length === 0) {
      return res.json({
        success: true,
        data: {
          nodes: [],
          network: { totalNodes: 0, activeNodes: 0, offlineNodes: 0, uptime: 100, lastSync: new Date() }
        }
      });
    }

    const uptime = parseFloat(((active / formattedNodes.length) * 100).toFixed(1));

    const network = {
      totalNodes: formattedNodes.length,
      activeNodes: active,
      offlineNodes: offline,
      uptime: uptime,
      lastSync: new Date()
    };

    return res.json({ success: true, data: { nodes: formattedNodes, network } });
  } catch (e) {
    console.error("Network Fetch Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

module.exports = { getNodes };
