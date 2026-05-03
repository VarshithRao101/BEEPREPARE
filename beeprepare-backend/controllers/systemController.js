const SystemConfig = require('../models/SystemConfig');
const { connectDB } = require('../config/db');
const { success, error } = require('../utils/responseHelper');

// GET /api/system/maintenance
const getMaintenanceStatus = async (req, res) => {
  try {
    await connectDB();
    const config = await SystemConfig.findOne({ key: 'maintenance_mode' }).lean();
    return success(res, 'Maintenance status fetched', { 
      isMaintenance: config ? config.value : false 
    });
  } catch (err) {
    return error(res, 'Failed to fetch status', 'SERVER_ERROR', 500);
  }
};

// POST /api/admin/maintenance (Admin only)
const toggleMaintenance = async (req, res) => {
  try {
    await connectDB();
    const { status } = req.body; // true/false
    
    // Check if admin (role-based security)
    if (req.user.role !== 'admin') {
      return error(res, 'Unauthorized - Admin access required', 'FORBIDDEN', 403);
    }

    let config = await SystemConfig.findOne({ key: 'maintenance_mode' });
    if (!config) {
      config = await SystemConfig.create({ 
        key: 'maintenance_mode', 
        value: status,
        updatedBy: req.user.googleUid 
      });
    } else {
      config.value = status;
      config.updatedBy = req.user.googleUid;
      await config.save();
    }

    return success(res, `Maintenance mode set to ${status}`, { isMaintenance: status });
  } catch (err) {
    return error(res, 'Failed to toggle maintenance', 'SERVER_ERROR', 500);
  }
};

module.exports = { getMaintenanceStatus, toggleMaintenance };
