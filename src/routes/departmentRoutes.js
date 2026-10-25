const express = require('express');
const router = express.Router();
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartmentStatus
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

// Public routes for viewing departments
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);

// Admin-only management routes
router.post('/', protect, authorize('admin'), createDepartment);
router.put('/:id', protect, authorize('admin'), updateDepartment);
router.patch('/:id/toggle-status', protect, authorize('admin'), toggleDepartmentStatus);
router.delete('/:id', protect, authorize('admin'), deleteDepartment);

module.exports = router;
