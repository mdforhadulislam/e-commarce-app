/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from "react";
import { useAxiosPrivate } from "@/hooks/useAxiosPrivate";
import { useToast } from "@/hooks/use-toast";
import useAuthStore from "@/store/useAuthStore";
import { usePermissions } from "@/hooks/usePermissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { productTypeSchema } from "@/lib/validation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Edit,
  Trash,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  X,
  Tag,
  ImageIcon,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

type ProductType = {
  _id: string;
  name: string;
  type: string;
  description?: string;
  bannerImages?: string[];
  icon?: string;
  isActive: boolean;
  displayOrder: number;
  color?: string;
  createdAt: string;
};

type FormData = z.infer<typeof productTypeSchema>;

type ProductTypeResponse = {
  productTypes: ProductType[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export default function ProductTypesPage() {
  // Data state
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  // Sheet state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProductType, setSelectedProductType] =
    useState<ProductType | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const axiosPrivate = useAxiosPrivate();
  const { toast } = useToast();
  const { checkIsAdmin } = useAuthStore();
  const { canPerformCRUD, isReadOnly } = usePermissions();
  const isAdmin = checkIsAdmin();

  // Single form for both add and edit
  const form = useForm<FormData>({
    resolver: zodResolver(productTypeSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      bannerImages: [],
      icon: "",
      isActive: true,
      displayOrder: 0,
      color: "#6B7280",
    },
  });

  // Enhanced fetch function with pagination and filters
  const fetchProductTypes = async (page = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(activeFilter !== "all" && { isActive: activeFilter }),
      });

      const response = await axiosPrivate.get<ProductTypeResponse>(
        `/product-types/admin?${params}`,
      );
      const {
        productTypes: fetchedProductTypes,
        total,
        totalPages,
      } = response.data;

      setProductTypes(fetchedProductTypes);
      setTotal(total);
      setTotalPages(totalPages);
      setCurrentPage(page);

      if (isRefresh) {
        toast({
          title: "Success",
          description: "Product types refreshed successfully",
        });
      }
    } catch (error) {
      console.error("Failed to load product types", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load product types",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Debounced search
  const debouncedSearchTerm = useMemo(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== null) {
        setCurrentPage(1);
        fetchProductTypes(1);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, sortOrder, perPage, activeFilter]);

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setSortOrder("desc");
    setActiveFilter("all");
    setCurrentPage(1);
    setPerPage(10);
  };

  const handleRefresh = () => {
    fetchProductTypes(currentPage, true);
  };

  useEffect(() => {
    fetchProductTypes(1);
  }, []);

  useEffect(() => {
    return debouncedSearchTerm;
  }, [debouncedSearchTerm]);

  const handleEdit = (productType: ProductType) => {
    setSelectedProductType(productType);
    setIsEditMode(true);
    form.reset({
      name: productType.name,
      type: productType.type,
      description: productType.description || "",
      bannerImages: productType.bannerImages || [],
      icon: productType.icon || "",
      isActive: productType.isActive,
      displayOrder: productType.displayOrder,
      color: productType.color || "#6B7280",
    });
    setIsSidebarOpen(true);
  };

  const handleAdd = () => {
    setSelectedProductType(null);
    setIsEditMode(false);
    form.reset({
      name: "",
      type: "",
      description: "",
      bannerImages: [],
      icon: "",
      isActive: true,
      displayOrder: 0,
      color: "#6B7280",
    });
    setIsSidebarOpen(true);
  };

  const handleDelete = (productType: ProductType) => {
    setSelectedProductType(productType);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (data: FormData) => {
    setFormLoading(true);
    try {
      if (isEditMode && selectedProductType) {
        // Update existing product type
        await axiosPrivate.put(
          `/product-types/${selectedProductType._id}`,
          data,
        );
        toast({
          title: "Success",
          description: "Product type updated successfully",
        });
        fetchProductTypes(currentPage); // Stay on current page
      } else {
        // Create new product type
        await axiosPrivate.post("/product-types", data);
        toast({
          title: "Success",
          description: "Product type created successfully",
        });
        fetchProductTypes(1); // Reset to first page
      }
      form.reset();
      setIsSidebarOpen(false);
    } catch (error) {
      console.error("Failed to save product type", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${isEditMode ? "update" : "create"} product type`,
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProductType = async () => {
    if (!selectedProductType) return;

    try {
      await axiosPrivate.delete(`/product-types/${selectedProductType._id}`);
      toast({
        title: "Success",
        description: "Product type deleted successfully",
      });
      setIsDeleteModalOpen(false);

      // Smart pagination after delete
      const newTotal = total - 1;
      const newTotalPages = Math.ceil(newTotal / perPage);
      const targetPage =
        currentPage > newTotalPages ? Math.max(1, newTotalPages) : currentPage;

      fetchProductTypes(targetPage);
    } catch (error) {
      console.error("Failed to delete product type", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product type",
      });
    }
  };

  // Skeleton loading component
  const SkeletonRow = () => (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-10 w-10 rounded" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Product Types</h1>
          <p className="text-muted-foreground">
            Manage product classification types
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {isAdmin && canPerformCRUD && (
            <Button onClick={handleAdd} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Product Type
            </Button>
          )}
          {isAdmin && isReadOnly && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <span className="text-xs text-amber-700 dark:text-amber-400">
                👁️ Read-only mode
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Product Types
            </CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                productTypes.filter((pt) => pt.isActive).length
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                `${currentPage} of ${totalPages}`
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Per Page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : perPage}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Search & Filters</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, type, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                clearFilters();
                setActiveFilter("all");
              }}
              disabled={
                !searchTerm && sortOrder === "desc" && activeFilter === "all"
              }
              size="sm"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t"
            >
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Sort Order
                </label>
                <Select
                  value={sortOrder}
                  onValueChange={(value: "asc" | "desc") => setSortOrder(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Items Per Page
                </label>
                <Select
                  value={perPage.toString()}
                  onValueChange={(value) => setPerPage(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select items per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 per page</SelectItem>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {productTypes.length} of {total} product types
            {searchTerm && ` for "${searchTerm}"`}
          </span>
          {(searchTerm || sortOrder !== "desc" || activeFilter) && (
            <Badge variant="secondary" className="ml-2">
              {[
                searchTerm && "Filtered",
                sortOrder === "asc" && "Sorted",
                activeFilter && "Status Filtered",
              ]
                .filter(Boolean)
                .join(" & ")}
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="rounded-md border-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-20">Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead className="w-25">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Skeleton loading
                Array.from({ length: perPage }).map((_, index) => (
                  <SkeletonRow key={`skeleton-${index}`} />
                ))
              ) : productTypes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 9 : 8}
                    className="text-center py-8"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Tag className="h-8 w-8" />
                      <span>No product types found</span>
                      {searchTerm && (
                        <Button
                          variant="link"
                          onClick={() => setSearchTerm("")}
                          size="sm"
                        >
                          Clear search to see all product types
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                productTypes.map((productType, index) => (
                  <motion.tr
                    key={productType._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      {(currentPage - 1) * perPage + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {productType.icon ? (
                          <img
                            src={productType.icon}
                            alt={productType.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {productType.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{productType.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={productType.isActive ? "default" : "secondary"}
                      >
                        {productType.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border-2 border-muted-foreground/20"
                          style={{
                            backgroundColor: productType.color || "#6B7280",
                          }}
                          title={productType.color || "#6B7280"}
                        />
                        <span className="text-xs text-muted-foreground font-mono">
                          {productType.color || "#6B7280"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{productType.displayOrder}</TableCell>
                    <TableCell>
                      {new Date(productType.createdAt).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {canPerformCRUD && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(productType)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(productType)}
                                className="hover:text-red-500 hoverEffect"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {isReadOnly && (
                            <span className="text-xs text-muted-foreground">
                              View only
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} total product types)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProductTypes(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProductTypes(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum =
                  Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => fetchProductTypes(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProductTypes(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProductTypes(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Product Type Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {isEditMode ? "Edit Product Type" : "Add Product Type"}
            </SheetTitle>
            <SheetDescription>
              {isEditMode
                ? "Update product type information"
                : "Create a new product classification type"}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6 py-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Featured Products"
                        disabled={formLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for this product type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., featured"
                        disabled={formLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier (lowercase, no spaces)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe this product type..."
                        disabled={formLoading}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon (Optional)</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={formLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          {...field}
                          type="color"
                          className="w-20 h-10 cursor-pointer"
                          disabled={formLoading}
                        />
                        <Input
                          {...field}
                          type="text"
                          placeholder="#6B7280"
                          className="flex-1"
                          disabled={formLoading}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Color for the product type badge display
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                        disabled={formLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Order in which this type appears (0 = first)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Make this product type available for use
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={formLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <SheetFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSidebarOpen(false)}
                  disabled={formLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : isEditMode ? (
                    "Update Product Type"
                  ) : (
                    "Create Product Type"
                  )}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Delete Product Type Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product type? This action
              cannot be undone and the product type{" "}
              <span className="font-semibold">{selectedProductType?.name}</span>{" "}
              will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProductType}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete Product Type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
