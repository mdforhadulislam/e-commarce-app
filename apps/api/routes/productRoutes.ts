import express, { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  rateProduct,
  trackProductView,
  approveProduct,
  bulkCreateProducts,
  bulkDeleteProducts,
  getPendingProducts,
  getSellerProducts,
  searchProductsByImage,
} from "../controllers/productController.js";
import {
  protect,
  admin,
  adminOrSeller,
  seller,
} from "../middleware/authMiddleware.js";
import { preventReadOnlyActions } from "../middleware/readOnlyMiddleware.js";
import upload, { handleMulterError } from "../middleware/uploadMiddleware.js";

const router: Router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filter by brand
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search products by name or description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of products per page
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     total:
 *                       type: integer
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - category
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               brand:
 *                 type: string
 *               stock:
 *                 type: integer
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router
  .route("/")
  .get(getProducts)
  .post(protect, adminOrSeller, preventReadOnlyActions, createProduct);

/**
 * @swagger
 * /api/products/search-by-image:
 *   post:
 *     summary: Search products by uploading an image
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to search for similar products
 *     responses:
 *       200:
 *         description: Similar products found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 total:
 *                   type: integer
 *                 message:
 *                   type: string
 *       400:
 *         description: No image uploaded or invalid file
 *       500:
 *         description: Image search failed
 */
router.post(
  "/search-by-image",
  upload.single("image"),
  handleMulterError,
  searchProductsByImage
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   put:
 *     summary: Update product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               brand:
 *                 type: string
 *               stock:
 *                 type: integer
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Product not found
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Product not found
 */

// Get pending products (Admin only) - Must be before /:id
router.route("/pending/all").get(protect, admin, getPendingProducts);

// Get seller products (Admin only - for approval) - Must be before /:id
router.route("/seller").get(protect, admin, getSellerProducts);

// Get seller's own products (Seller only) - Must be before /:id
router.route("/seller/me").get(protect, seller, getSellerProducts);

// Bulk create products (Admin only) - Must be before /:id
router.route("/bulk").post(protect, admin, bulkCreateProducts);

// Bulk delete products (Admin only) - Must be before /:id
router.route("/bulk-delete").post(protect, admin, preventReadOnlyActions, bulkDeleteProducts);

router
  .route("/:id")
  .get(getProductById)
  .put(protect, admin, preventReadOnlyActions, updateProduct)
  .delete(protect, admin, preventReadOnlyActions, deleteProduct);

/**
 * @swagger
 * /api/products/{id}/rate:
 *   post:
 *     summary: Rate a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product rated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.route("/:id/rate").post(protect, rateProduct);

// Track product view
router.route("/:id/view").post(trackProductView);

// Add product review (Premium feature)
// router.route("/:id/review").post(protect, addProductReview);

// Get pending reviews (Admin only) (Premium feature)
// router.route("/reviews/pending").get(protect, admin, getPendingReviews);
// router.route("/reviews/approved").get(protect, admin, getApprovedReviews);

// Approve/Reject review (Admin only) (Premium feature)
// router.route("/:productId/review/:reviewId").put(protect, admin, approveReview);

// Approve/Reject product (Admin only)
router
  .route("/:id/approve")
  .put(protect, admin, preventReadOnlyActions, approveProduct);
router
  .route("/:id/approval")
  .put(protect, admin, preventReadOnlyActions, approveProduct);

export default router;
