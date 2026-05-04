import express, { Router } from "express";
import {
  getEmployees,
  createEmployee,
  updateEmployeeRole,
  updateUserMainRole,
  getAllUsersWithRoles,
  getEmployeesByRole,
  deactivateEmployee,
} from "../controllers/userRoleController.js";
import {
  protect,
  admin,
  canManageRoles,
  canAssignEmployeeRoles,
} from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All routes require authentication
router.use(protect);

// Employee management routes
router.get("/employees", canAssignEmployeeRoles, getEmployees);
router.post("/employees", canAssignEmployeeRoles, createEmployee);
router.put("/employees/:id/role", canAssignEmployeeRoles, updateEmployeeRole);
router.put("/employees/:id/deactivate", admin, deactivateEmployee);

// Get employees by specific role for assignments
router.get(
  "/employees/by-role/:employee_role",
  canAssignEmployeeRoles,
  getEmployeesByRole
);

// Main role management (admin only)
router.get("/with-roles", admin, getAllUsersWithRoles);
router.put("/:id/main-role", canManageRoles, updateUserMainRole);

export default router;
