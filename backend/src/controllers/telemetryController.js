const Reading = require('../models/Reading');
const Alert = require('../models/Alert');

const getLatestReadings = (req, res) => {
    try {
        const readings = Reading.findAll();
        // Return latest reading for each node
        const latestPerNode = readings.reduce((acc, curr) => {
            if (!acc[curr.node_id] || new Date(curr.created_at) > new Date(acc[curr.node_id].created_at)) {
                acc[curr.node_id] = curr;
            }
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: Object.values(latestPerNode)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const getRecentAlerts = (req, res) => {
    try {
        const alerts = Alert.findRecent(20);
        res.status(200).json({
            success: true,
            data: alerts
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    getLatestReadings,
    getRecentAlerts
};
