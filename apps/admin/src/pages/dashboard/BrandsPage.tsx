/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from "react";
import { useAxiosPrivate } from "@/hooks/useAxiosPrivate";
import { useToast } from "@/hooks/use-toast";
import useAuthStore from "@/store/useAuthStore";
import { usePermissions } from "@/hooks/usePermissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { brandSchema } from "@/lib/validation";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Checkbox } from "@/components/ui/checkbox";
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
  Image as ImageIcon,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

type Brand = {
  _id: string;
  name: string;
  image?: string;
  createdAt: string;
};

type FormData = z.infer<typeof brandSchema>;

type BrandResponse = {
  brands: Brand[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export default function BrandsPage() {
  // Data state
  const [brands, setBrands] = useState<Brand[]>([]);
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

  // Sheet state (replacing Modal state)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [deletingBrandIds, setDeletingBrandIds] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const axiosPrivate = useAxiosPrivate();
  const { toast } = useToast();
  const { checkIsAdmin } = useAuthStore();
  const { canPerformCRUD, isReadOnly } = usePermissions();
  const isAdmin = checkIsAdmin();

  // Single form for both add and edit
  const form = useForm<FormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: "",
      image: "",
    },
  });

  // Enhanced fetch function with pagination and filters
  const fetchBrands = async (page = 1, isRefresh = false) => {
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
      });

      const response = await axiosPrivate.get<BrandResponse>(
        `/brands/admin?${params}`
      );
      const { brands: fetchedBrands, total, totalPages } = response.data;

      setBrands(fetchedBrands);
      setTotal(total);
      setTotalPages(totalPages);
      setCurrentPage(page);

      if (isRefresh) {
        toast({
          title: "Success",
          description: "Brands refreshed successfully",
        });
      }
    } catch (error) {
      console.error("Failed to load brands", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load brands",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Reset selection on fetch/filter change usually, but user might want to persist across pages.
      // For simplicity and safety, we clear selection on manual refresh or filter change.
      if (isRefresh) setSelectedBrands([]);
    }
  };

  // Debounced search
  const debouncedSearchTerm = useMemo(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== null) {
        setCurrentPage(1);
        fetchBrands(1);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, sortOrder, perPage]);

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setSortOrder("desc");
    setCurrentPage(1);
    setPerPage(10);
  };

  const handleRefresh = () => {
    fetchBrands(currentPage, true);
  };

  useEffect(() => {
    fetchBrands(1);
  }, []);

  useEffect(() => {
    return debouncedSearchTerm;
  }, [debouncedSearchTerm]);

  const handleEdit = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsEditMode(true);
    form.reset({
      name: brand.name,
      image: brand.image || "",
    });
    setIsSidebarOpen(true);
  };

  const handleAdd = () => {
    setSelectedBrand(null);
    setIsEditMode(false);
    form.reset({
      name: "",
      image: "",
    });
    setIsSidebarOpen(true);
  };

  const handleDelete = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (data: FormData) => {
    setFormLoading(true);
    try {
      if (isEditMode && selectedBrand) {
        // Update existing brand
        await axiosPrivate.put(`/brands/${selectedBrand._id}`, data);
        toast({
          title: "Success",
          description: "Brand updated successfully",
        });
        fetchBrands(currentPage); // Stay on current page
      } else {
        // Create new brand
        await axiosPrivate.post("/brands", data);
        toast({
          title: "Success",
          description: "Brand created successfully",
        });
        fetchBrands(1); // Reset to first page
      }
      form.reset();
      setIsSidebarOpen(false);
    } catch (error) {
      console.error("Failed to save brand", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${isEditMode ? "update" : "create"} brand`,
      });
    } finally {
      setFormLoading(false);
    }

  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = brands.map((b) => b._id);
      setSelectedBrands(allIds);
    } else {
      setSelectedBrands([]);
    }
  };

  const handleSelectBrand = (brandId: string, checked: boolean) => {
    if (checked) {
      setSelectedBrands((prev) => [...prev, brandId]);
    } else {
      setSelectedBrands((prev) => prev.filter((id) => id !== brandId));
    }
  };

  const confirmBulkDelete = async () => {
    try {
      setDeletingBrandIds((prev) => [...prev, ...selectedBrands]);
      const response = await axiosPrivate.post("/brands/bulk-delete", {
        brandIds: selectedBrands,
      });

      const { results } = response.data;
      const successCount = results.successful.length;
      const failureCount = results.failed.length;

      if (failureCount > 0) {
        const failureReasons = results.failed
          .map((f: any) => `${f.name}: ${f.reason}`)
          .join("\n");
        toast({
          variant: "destructive",
          title: "Partial Deletion Completed",
          description: (
            <div className="whitespace-pre-line">
              Deleted {successCount} brands.
              {failureCount} failed:
              {failureReasons}
            </div>
          ),
        });
      } else {
        toast({
          title: "Success",
          description: `Successfully deleted ${successCount} brands`,
        });
      }

      setSelectedBrands([]);
      setIsDeleteModalOpen(false);
      // Refresh current page
      fetchBrands(currentPage);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.message || "Failed to delete brands",
      });
    } finally {
      setDeletingBrandIds((prev) =>
        prev.filter((id) => !selectedBrands.includes(id))
      );
    }
  };

  const handleDeleteBrand = async () => {
    // Bulk Delete Logic (Triggered when selectedBrand is null)
    if (!selectedBrand && selectedBrands.length > 0) {
      await confirmBulkDelete();
      return;
    }

    if (!selectedBrand) return;

    try {
      setDeletingBrandIds((prev) => [...prev, selectedBrand._id]);
      await axiosPrivate.delete(`/brands/${selectedBrand._id}`);
      toast({
        title: "Success",
        description: "Brand deleted successfully",
      });
      setIsDeleteModalOpen(false);

      // Smart pagination after delete
      const newTotal = total - 1;
      const newTotalPages = Math.ceil(newTotal / perPage);
      const targetPage =
        currentPage > newTotalPages ? Math.max(1, newTotalPages) : currentPage;

      fetchBrands(targetPage);
    } catch (error) {
      console.error("Failed to delete brand", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete brand",
      });
    } finally {
      setDeletingBrandIds((prev) =>
        prev.filter((id) => id !== selectedBrand!._id)
      );
    }
  };

  // Skeleton loading component

  const SkeletonRow = () => (
    <TableRow>
      <TableCell className="w-[50px]">
        <Checkbox disabled />
      </TableCell>
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
          <h1 className="text-3xl font-bold">Brands</h1>
          <p className="text-muted-foreground">Manage your brand catalog</p>
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
              <Plus className="mr-2 h-4 w-4" /> Add Brand
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : total}
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
                  placeholder="Search brands..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!searchTerm && sortOrder === "desc"}
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
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t"
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
            Showing {brands.length} of {total} brands
            {searchTerm && ` for "${searchTerm}"`}
          </span>
          {(searchTerm || sortOrder !== "desc") && (
            <Badge variant="secondary" className="ml-2">
              {[searchTerm && "Filtered", sortOrder === "asc" && "Sorted"]
                .filter(Boolean)
                .join(" & ")}
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="rounded-md border-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      brands.length > 0 &&
                      selectedBrands.length === brands.length
                    }
                    onCheckedChange={(checked) =>
                      handleSelectAll(checked as boolean)
                    }
                  />
                </TableHead>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead className="w-20">Image</TableHead>
                <TableHead>
                  {selectedBrands.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedBrand(null);
                          setIsDeleteModalOpen(true);
                        }}
                        className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white"
                      >
                        Delete Selected ({selectedBrands.length})
                      </Button>
                    </div>
                  ) : (
                    "Name"
                  )}
                </TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && (
                  <TableHead className="w-[100px]">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Skeleton loading
                Array.from({ length: perPage }).map((_, index) => (
                  <SkeletonRow key={`skeleton-${index}`} />
                ))
              ) : brands.length === 0 ? (

                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 6 : 5}
                    className="text-center py-8"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                      <span>No brands found</span>
                      {searchTerm && (
                        <Button
                          variant="link"
                          onClick={() => setSearchTerm("")}
                          size="sm"
                        >
                          Clear search to see all brands
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((brand, index) => {
                  if (deletingBrandIds.includes(brand._id)) {
                    return <SkeletonRow key={brand._id} />;
                  }
                  return (
                    <motion.tr
                    key={brand._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group hover:bg-muted/50"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedBrands.includes(brand._id)}
                        onCheckedChange={(checked) =>
                          handleSelectBrand(brand._id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {(currentPage - 1) * perPage + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {brand.image ? (
                          <img
                            src={brand.image}
                            alt={brand.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      {new Date(brand.createdAt).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {canPerformCRUD && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(brand)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(brand)}
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({total} total brands)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBrands(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBrands(currentPage - 1)}
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
                    onClick={() => fetchBrands(pageNum)}
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
              onClick={() => fetchBrands(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBrands(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Brand Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditMode ? "Edit Brand" : "Add Brand"}</SheetTitle>
            <SheetDescription>
              {isEditMode
                ? "Update brand information"
                : "Create a new product brand"}
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
                      <Input {...field} disabled={formLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Image (Optional)</FormLabel>
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
                    "Update Brand"
                  ) : (
                    "Create Brand"
                  )}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Delete Brand Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedBrands.length > 0 && !selectedBrand ? (
                `This action cannot be undone. This will permanently delete ${selectedBrands.length} selected brands.`
              ) : (
                <>
                  Are you sure you want to delete this brand? This action cannot
                  be undone and the brand{" "}
                  <span className="font-semibold">{selectedBrand?.name}</span>{" "}
                  will be permanently removed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBrand}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete Brand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
