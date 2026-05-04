import express, { Router } from "express";
import {
  getCallCenterQueue,
  confirmOrderAddress,
  confirmOrder,
  getPackerQueue,
  assignPacker,
  packOrder,
  getDeliveryQueue,
  assignDeliveryman,
  getMyDeliveries,
  startDelivery,
  collectCOD,
  deliverOrder,
  returnCOD,
  completeOrder,
  getCODPendingOrders,
  getCompletionQueue,
  getWorkflowStats,
} from "../controllers/orderWorkflowController.js";
import {
  protect,
  packer,
  deliveryman,
  accounts,
  callCenter,
  incharge,
  employee,
  canCollectCash,
} from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All routes require authentication
router.use(protect);

// Call Center routes
router.get("/call-center/queue", callCenter, getCallCenterQueue);
router.put("/:id/confirm-address", callCenter, confirmOrderAddress);
router.put("/:id/confirm-order", callCenter, confirmOrder);

// Packer routes
router.get("/packer/queue", packer, getPackerQueue);
router.put("/:id/pack", packer, packOrder);

// Delivery management routes (incharge only)
router.get("/delivery/queue", incharge, getDeliveryQueue);
router.put("/:id/assign-packer", incharge, assignPacker);
router.put("/:id/assign-deliveryman", incharge, assignDeliveryman);

// Deliveryman routes
router.get("/my-deliveries", deliveryman, getMyDeliveries);
router.put("/:id/start-delivery", deliveryman, startDelivery);
router.put("/:id/collect-cod", canCollectCash, collectCOD);
router.put("/:id/deliver", deliveryman, deliverOrder);
router.put("/:id/return-cod", deliveryman, returnCOD);

// Accounts routes
router.get("/accounts/cod-pending", accounts, getCODPendingOrders);
router.get("/accounts/completion-queue", accounts, getCompletionQueue);
router.put("/:id/complete", accounts, completeOrder);

// General employee routes
router.get("/workflow/stats", employee, getWorkflowStats);

export default router;
