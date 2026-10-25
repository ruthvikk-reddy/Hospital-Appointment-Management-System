const Department = require('../models/Department');
const Doctor = require('../models/Doctor');

/**
 * Get all departments with doctor counts
 * GET /api/departments
 */
const getAllDepartments = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const filter = includeInactive === 'true' ? {} : { isActive: true };

    // MongoDB Aggregation: Join departments with doctor count
    const departments = await Department.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'doctors'
        }
      },
      {
        $project: {
          _id: 1,
          departmentName: 1,
          description: 1,
          icon: 1,
          isActive: 1,
          createdAt: 1,
          doctorCount: {
            $size: {
              $filter: {
                input: '$doctors',
                as: 'doc',
                cond: { $eq: ['$$doc.availability', 'active'] }
              }
            }
          }
        }
      },
      { $sort: { departmentName: 1 } }
    ]);

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get department by ID with associated doctors
 * GET /api/departments/:id
 */
const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const doctors = await Doctor.find({
      departmentId: department._id,
      availability: 'active'
    }).select('-passwordHash');

    res.status(200).json({
      success: true,
      data: {
        ...department.toObject(),
        doctors
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new department (Admin only)
 * POST /api/departments
 */
const createDepartment = async (req, res, next) => {
  try {
    const { departmentName, description, icon } = req.body;

    if (!departmentName || !description) {
      return res.status(400).json({
        success: false,
        message: 'Department name and description are required.'
      });
    }

    // Check duplicate
    const existing = await Department.findOne({
      departmentName: { $regex: new RegExp(`^${departmentName.trim()}$`, 'i') }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Department '${departmentName}' already exists.`
      });
    }

    const department = await Department.create({
      departmentName: departmentName.trim(),
      description: description.trim(),
      icon: icon || 'stethoscope'
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      data: department
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update department (Admin only)
 * PUT /api/departments/:id
 */
const updateDepartment = async (req, res, next) => {
  try {
    const { departmentName, description, icon, isActive } = req.body;

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    if (departmentName && departmentName.trim().toLowerCase() !== department.departmentName.toLowerCase()) {
      const duplicate = await Department.findOne({
        departmentName: { $regex: new RegExp(`^${departmentName.trim()}$`, 'i') },
        _id: { $ne: department._id }
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Department '${departmentName}' already exists.`
        });
      }
      department.departmentName = departmentName.trim();
    }

    if (description) department.description = description.trim();
    if (icon) department.icon = icon.trim();
    if (typeof isActive === 'boolean') department.isActive = isActive;

    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department updated successfully.',
      data: department
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete or deactivate department (Admin only)
 * DELETE /api/departments/:id
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if any doctors reference this department
    const doctorCount = await Doctor.countDocuments({ departmentId: department._id });
    if (doctorCount > 0) {
      // Soft-delete / deactivate to preserve referential integrity
      department.isActive = false;
      await department.save();

      return res.status(200).json({
        success: true,
        message: `Department has ${doctorCount} assigned doctor(s). It has been deactivated to preserve records instead of being deleted.`,
        deactivated: true
      });
    }

    await department.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Department removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle department active status (Admin only)
 * PATCH /api/departments/:id/toggle-status
 * Body (optional): { isActive: true | false }
 */
const toggleDepartmentStatus = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found.'
      });
    }

    if (typeof req.body?.isActive === 'boolean') {
      department.isActive = req.body.isActive;
    } else {
      department.isActive = !department.isActive;
    }

    await department.save();

    res.status(200).json({
      success: true,
      message: `Department '${department.departmentName}' is now ${department.isActive ? 'active' : 'inactive'}.`,
      isActive: department.isActive,
      data: department
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartmentStatus
};
