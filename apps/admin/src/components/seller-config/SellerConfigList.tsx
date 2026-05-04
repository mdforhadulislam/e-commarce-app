import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Store,
  Mail,
  Phone,
  MapPin,
  Eye,
  Building2,
  User,
  Plus,
  Pencil,
} from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";

interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Seller {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  storeName: string;
  description: string;
  logo?: string;
  status: "pending" | "approved" | "rejected";
  contactEmail: string;
  contactPhone?: string;
  address?: Address;
  createdAt: string;
  updatedAt: string;
}

const SellerConfigList = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [editSellerOpen, setEditSellerOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sellerForm, setSellerForm] = useState({
    userId: "",
    storeName: "",
    description: "",
    logo: "",
    contactEmail: "",
    contactPhone: "",
    address: {
      street: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    },
    status: "approved",
    role: "seller",
  });
  const { token } = useAuthStore();
  const { can } = usePermissions();
  const { toast } = useToast();

  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    if (addSellerOpen && users.length === 0) {
      fetchUsers(1);
    }
  }, [addSellerOpen]);

  const fetchSellers = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const response = await axios.get(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/sellers/requests`,
        config
      );
      setSellers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load sellers",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page: number = 1, search: string = "") => {
    if (loadingUsers) return;

    try {
      setLoadingUsers(true);
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const response = await axios.get(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/users?page=${page}&perPage=20${searchParam}`,
        config
      );
      // Handle response with pagination data
      const usersData = response.data.users || [];
      const hasNext = response.data.hasNextPage || false;

      if (page === 1) {
        setUsers(usersData);
      } else {
        setUsers((prev) => [...prev, ...usersData]);
      }

      setUsersPage(page);
      setHasMoreUsers(hasNext);
    } catch (error) {
      console.error("Error fetching users:", error);
      if (page === 1) {
        setUsers([]); // Set empty array on error for first page
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMoreUsers = () => {
    if (hasMoreUsers && !loadingUsers) {
      fetchUsers(usersPage + 1, userSearch);
    }
  };

  const isUserAlreadySeller = (userId: string) => {
    return sellers.some((seller) => seller.userId._id === userId);
  };

  const handleUserSearch = (value: string) => {
    setUserSearch(value);
    setUsersPage(1);
    fetchUsers(1, value);
  };

  const handleUserSelect = (userId: string) => {
    const selectedUser = users.find((u) => u._id === userId);
    if (selectedUser) {
      setSellerForm({
        ...sellerForm,
        userId,
        storeName: selectedUser.name + "'s Store",
        contactEmail: selectedUser.email,
      });
    }
  };

  const openEditSeller = (seller: Seller) => {
    setEditingSeller(seller);
    setSellerForm({
      userId: seller.userId._id,
      storeName: seller.storeName,
      description: seller.description,
      logo: seller.logo || "",
      contactEmail: seller.contactEmail,
      contactPhone: seller.contactPhone || "",
      address: {
        street: seller.address?.street || "",
        city: seller.address?.city || "",
        state: seller.address?.state || "",
        country: seller.address?.country || "",
        postalCode: seller.address?.postalCode || "",
      },
      status: seller.status,
      role: seller.userId?.role || "seller",
    });
    setEditSellerOpen(true);
  };

  const handleCreateSeller = async () => {
    if (
      !sellerForm.userId ||
      !sellerForm.storeName ||
      !sellerForm.description ||
      !sellerForm.contactEmail
    ) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      setCreating(true);
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.post(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/sellers/create`,
        sellerForm,
        config
      );
      toast({
        title: "Success",
        description: "Seller created successfully",
      });
      setAddSellerOpen(false);
      setSellerForm({
        userId: "",
        storeName: "",
        description: "",
        logo: "",
        contactEmail: "",
        contactPhone: "",
        address: {
          street: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
        },
        status: "approved",
        role: "seller",
      });
      fetchSellers();
    } catch (error: any) {
      console.error("Error creating seller:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to create seller",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateSeller = async () => {
    if (
      !sellerForm.storeName ||
      !sellerForm.description ||
      !sellerForm.contactEmail
    ) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    if (!editingSeller) return;

    try {
      setUpdating(true);
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.put(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/sellers/${editingSeller._id}`,
        {
          storeName: sellerForm.storeName,
          description: sellerForm.description,
          logo: sellerForm.logo,
          contactEmail: sellerForm.contactEmail,
          contactPhone: sellerForm.contactPhone,
          address: sellerForm.address,
          status: sellerForm.status,
          role: sellerForm.role,
        },
        config
      );
      toast({
        title: "Success",
        description: "Seller updated successfully",
      });
      setEditSellerOpen(false);
      setEditingSeller(null);
      setSellerForm({
        userId: "",
        storeName: "",
        description: "",
        logo: "",
        contactEmail: "",
        contactPhone: "",
        address: {
          street: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
        },
        status: "approved",
        role: "seller",
      });
      fetchSellers();
    } catch (error: any) {
      console.error("Error updating seller:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to update seller",
      });
    } finally {
      setUpdating(false);
    }
  };

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    if (!can("manage_sellers")) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You don't have permission to update seller status",
      });
      return;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.put(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/sellers/${id}/status`,
        { status },
        config
      );

      toast({
        title: "Success",
        description: `Seller ${status} successfully`,
      });
      setDetailsOpen(false);
      fetchSellers();
    } catch (error) {
      console.error("Error updating seller status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status",
      });
    }
  };

  const viewDetails = (seller: Seller) => {
    setSelectedSeller(seller);
    setDetailsOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "pending":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* Add Seller Button */}
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setAddSellerOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          Add Seller
        </Button>
      </div>

      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-50">Store Name</TableHead>
                <TableHead className="min-w-37.5">Owner</TableHead>
                <TableHead className="min-w-50 hidden md:table-cell">
                  Email
                </TableHead>
                <TableHead className="min-w-37.5 hidden lg:table-cell">
                  Phone
                </TableHead>
                <TableHead className="min-w-30">Status</TableHead>
                <TableHead className="min-w-30 hidden sm:table-cell">
                  Created Date
                </TableHead>
                <TableHead className="text-right min-w-25">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Store size={48} className="opacity-20" />
                      <p>No sellers found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((seller) => (
                  <TableRow
                    key={seller._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => viewDetails(seller)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {seller.logo ? (
                          <img
                            src={seller.logo}
                            alt={seller.storeName}
                            className="h-10 w-10 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                            <Store size={20} className="text-slate-400" />
                          </div>
                        )}
                        <span className="truncate">{seller.storeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="truncate">
                      {seller.userId?.name || "N/A"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Mail
                          size={14}
                          className="text-muted-foreground shrink-0"
                        />
                        <span className="text-sm truncate">
                          {seller.contactEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {seller.contactPhone ? (
                        <div className="flex items-center gap-2">
                          <Phone
                            size={14}
                            className="text-muted-foreground shrink-0"
                          />
                          <span className="text-sm truncate">
                            {seller.contactPhone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(seller.status)}>
                        {seller.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {new Date(seller.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewDetails(seller)}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSeller(seller)}
                          title="Edit Seller"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Seller Sidebar */}
      <Sheet open={addSellerOpen} onOpenChange={setAddSellerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Seller</SheetTitle>
            <SheetDescription>
              Select a user and fill in seller details to create a new seller
              account
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="userId">Select User *</Label>
              <Select
                value={sellerForm.userId}
                onValueChange={handleUserSelect}
                disabled={creating}
              >
                <SelectTrigger id="userId">
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {/* Search Input */}
                  <div className="px-2 pb-2 pt-1 sticky top-0 bg-white z-10 border-b">
                    <Input
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      className="h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>

                  {users.map((user) => {
                    const isSeller = isUserAlreadySeller(user._id);
                    return (
                      <SelectItem
                        key={user._id}
                        value={user._id}
                        disabled={isSeller}
                      >
                        <div className="flex items-center gap-2">
                          <User size={14} />
                          <span
                            className={isSeller ? "text-muted-foreground" : ""}
                          >
                            {user.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({user.email})
                          </span>
                          {isSeller && (
                            <span className="text-xs font-medium text-orange-600">
                              • Already Seller
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                  {hasMoreUsers && (
                    <div
                      className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        loadMoreUsers();
                      }}
                    >
                      <div className="flex items-center gap-2 text-blue-600">
                        {loadingUsers ? (
                          <span className="text-xs">Loading...</span>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span className="text-xs font-medium">
                              Load More Users
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {users.length} user(s) loaded
                {hasMoreUsers ? " • More available" : ""}
              </p>
            </div>

            {/* User Role */}
            <div className="space-y-2">
              <Label htmlFor="role">User Role</Label>
              <Select
                value={sellerForm.role}
                onValueChange={(value) =>
                  setSellerForm({ ...sellerForm, role: value })
                }
                disabled={true}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Role will be automatically set to "seller" when creating a
                seller account
              </p>
            </div>

            {/* Store Name */}
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                value={sellerForm.storeName}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, storeName: e.target.value })
                }
                placeholder="Enter store name"
                disabled={creating}
              />
            </div>

            {/* Contact Email */}
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                value={sellerForm.contactEmail}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, contactEmail: e.target.value })
                }
                placeholder="store@example.com"
                disabled={creating}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={sellerForm.description}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, description: e.target.value })
                }
                placeholder="Describe the seller's business"
                rows={4}
                disabled={creating}
              />
            </div>

            {/* Contact Phone */}
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={sellerForm.contactPhone}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, contactPhone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
                disabled={creating}
              />
            </div>

            {/* Store/Seller Logo Image */}
            <div className="space-y-2">
              <Label htmlFor="logo">Store Logo/Image</Label>
              <ImageUpload
                value={sellerForm.logo}
                onChange={(base64) =>
                  setSellerForm({ ...sellerForm, logo: base64 })
                }
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Upload a logo or image for the seller's store (max 4MB)
              </p>
            </div>

            {/* Address Section */}
            <Separator />
            <h4 className="font-semibold text-sm text-muted-foreground uppercase flex items-center gap-2">
              <MapPin size={16} />
              Address (Optional)
            </h4>

            <div className="space-y-2">
              <Label htmlFor="street">Street</Label>
              <Input
                id="street"
                value={sellerForm.address.street}
                onChange={(e) =>
                  setSellerForm({
                    ...sellerForm,
                    address: { ...sellerForm.address, street: e.target.value },
                  })
                }
                placeholder="123 Main St"
                disabled={creating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={sellerForm.address.city}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: { ...sellerForm.address, city: e.target.value },
                    })
                  }
                  placeholder="New York"
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={sellerForm.address.state}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: { ...sellerForm.address, state: e.target.value },
                    })
                  }
                  placeholder="NY"
                  disabled={creating}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={sellerForm.address.country}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: {
                        ...sellerForm.address,
                        country: e.target.value,
                      },
                    })
                  }
                  placeholder="USA"
                  disabled={creating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={sellerForm.address.postalCode}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: {
                        ...sellerForm.address,
                        postalCode: e.target.value,
                      },
                    })
                  }
                  placeholder="10001"
                  disabled={creating}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select
                value={sellerForm.status}
                onValueChange={(value) =>
                  setSellerForm({ ...sellerForm, status: value })
                }
                disabled={creating}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <Separator />
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddSellerOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateSeller}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create Seller"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Seller Sidebar */}
      <Sheet open={editSellerOpen} onOpenChange={setEditSellerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Seller</SheetTitle>
            <SheetDescription>
              Update seller details and save changes
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {/* Display Current User (Read-only) */}
            <div className="space-y-2">
              <Label>Seller Owner</Label>
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                <User size={16} className="text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {editingSeller?.userId?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {editingSeller?.userId?.email}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Seller owner cannot be changed
              </p>
            </div>

            {/* User Role */}
            <div className="space-y-2">
              <Label htmlFor="edit-role">User Role</Label>
              <Select
                value={sellerForm.role}
                onValueChange={(value) =>
                  setSellerForm({ ...sellerForm, role: value })
                }
                disabled={updating}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                </SelectContent>
              </Select>
              {sellerForm.role !== "seller" && (
                <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                  ⚠️ It's recommended to set the role to "Seller" for proper
                  seller access
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Change the user's role. Recommended: "Seller" for seller
                accounts
              </p>
            </div>

            {/* Store Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-storeName">Store Name *</Label>
              <Input
                id="edit-storeName"
                value={sellerForm.storeName}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, storeName: e.target.value })
                }
                placeholder="Enter store name"
                disabled={updating}
              />
            </div>

            {/* Contact Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-contactEmail">Contact Email *</Label>
              <Input
                id="edit-contactEmail"
                type="email"
                value={sellerForm.contactEmail}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, contactEmail: e.target.value })
                }
                placeholder="store@example.com"
                disabled={updating}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={sellerForm.description}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, description: e.target.value })
                }
                placeholder="Describe the seller's business"
                rows={4}
                disabled={updating}
              />
            </div>

            {/* Contact Phone */}
            <div className="space-y-2">
              <Label htmlFor="edit-contactPhone">Contact Phone</Label>
              <Input
                id="edit-contactPhone"
                type="tel"
                value={sellerForm.contactPhone}
                onChange={(e) =>
                  setSellerForm({ ...sellerForm, contactPhone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
                disabled={updating}
              />
            </div>

            {/* Store/Seller Logo Image */}
            <div className="space-y-2">
              <Label htmlFor="edit-logo">Store Logo/Image</Label>
              <ImageUpload
                value={sellerForm.logo}
                onChange={(base64) =>
                  setSellerForm({ ...sellerForm, logo: base64 })
                }
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">
                Upload a logo or image for the seller's store (max 4MB)
              </p>
            </div>

            {/* Address Section */}
            <Separator />
            <h4 className="font-semibold text-sm text-muted-foreground uppercase flex items-center gap-2">
              <MapPin size={16} />
              Address (Optional)
            </h4>

            <div className="space-y-2">
              <Label htmlFor="edit-street">Street</Label>
              <Input
                id="edit-street"
                value={sellerForm.address.street}
                onChange={(e) =>
                  setSellerForm({
                    ...sellerForm,
                    address: { ...sellerForm.address, street: e.target.value },
                  })
                }
                placeholder="123 Main St"
                disabled={updating}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={sellerForm.address.city}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: { ...sellerForm.address, city: e.target.value },
                    })
                  }
                  placeholder="New York"
                  disabled={updating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-state">State/Province</Label>
                <Input
                  id="edit-state"
                  value={sellerForm.address.state}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: { ...sellerForm.address, state: e.target.value },
                    })
                  }
                  placeholder="NY"
                  disabled={updating}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-country">Country</Label>
                <Input
                  id="edit-country"
                  value={sellerForm.address.country}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: {
                        ...sellerForm.address,
                        country: e.target.value,
                      },
                    })
                  }
                  placeholder="USA"
                  disabled={updating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-postalCode">Postal Code</Label>
                <Input
                  id="edit-postalCode"
                  value={sellerForm.address.postalCode}
                  onChange={(e) =>
                    setSellerForm({
                      ...sellerForm,
                      address: {
                        ...sellerForm.address,
                        postalCode: e.target.value,
                      },
                    })
                  }
                  placeholder="10001"
                  disabled={updating}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={sellerForm.status}
                onValueChange={(value) =>
                  setSellerForm({ ...sellerForm, status: value })
                }
                disabled={updating}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <Separator />
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditSellerOpen(false);
                  setEditingSeller(null);
                }}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpdateSeller}
                disabled={updating}
              >
                {updating ? "Updating..." : "Update Seller"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Seller Details</SheetTitle>
            <SheetDescription>
              Complete information and actions for this seller
            </SheetDescription>
          </SheetHeader>
          {selectedSeller && (
            <div className="space-y-6 mt-6">
              {/* Seller Header */}
              <div className="flex items-start gap-4">
                {selectedSeller.logo ? (
                  <img
                    src={selectedSeller.logo}
                    alt={selectedSeller.storeName}
                    className="h-20 w-20 rounded-lg object-cover border shadow-sm shrink-0"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-slate-100 flex items-center justify-center border shrink-0">
                    <Store size={32} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold truncate">
                    {selectedSeller.storeName}
                  </h3>
                  <Badge
                    variant={getStatusBadgeVariant(selectedSeller.status)}
                    className="mt-2"
                  >
                    {selectedSeller.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                  Actions
                </h4>
                <div className="flex flex-col gap-2">
                  {selectedSeller.status === "pending" && (
                    <>
                      <Button
                        onClick={() =>
                          updateStatus(selectedSeller._id, "approved")
                        }
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check size={16} className="mr-2" />
                        Approve Seller
                      </Button>
                      <Button
                        onClick={() =>
                          updateStatus(selectedSeller._id, "rejected")
                        }
                        variant="destructive"
                        className="w-full"
                      >
                        <X size={16} className="mr-2" />
                        Reject Seller
                      </Button>
                    </>
                  )}
                  {selectedSeller.status === "approved" && (
                    <Button
                      onClick={() =>
                        updateStatus(selectedSeller._id, "rejected")
                      }
                      variant="destructive"
                      className="w-full"
                    >
                      <X size={16} className="mr-2" />
                      Revoke Approval
                    </Button>
                  )}
                  {selectedSeller.status === "rejected" && (
                    <Button
                      onClick={() =>
                        updateStatus(selectedSeller._id, "approved")
                      }
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check size={16} className="mr-2" />
                      Approve Seller
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Store Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase flex items-center gap-2">
                  <Building2 size={16} />
                  Store Information
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Description
                    </label>
                    <p className="mt-1 text-sm">{selectedSeller.description}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Mail size={12} /> Contact Email
                      </label>
                      <p className="mt-1 text-sm break-all">
                        {selectedSeller.contactEmail}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Phone size={12} /> Contact Phone
                      </label>
                      <p className="mt-1 text-sm">
                        {selectedSeller.contactPhone || "Not provided"}
                      </p>
                    </div>
                  </div>

                  {selectedSeller.address && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin size={12} /> Address
                      </label>
                      <div className="mt-1 text-sm space-y-0.5">
                        {selectedSeller.address.street && (
                          <p>{selectedSeller.address.street}</p>
                        )}
                        <p>
                          {[
                            selectedSeller.address.city,
                            selectedSeller.address.state,
                            selectedSeller.address.postalCode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {selectedSeller.address.country && (
                          <p>{selectedSeller.address.country}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Owner Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase flex items-center gap-2">
                  <User size={16} />
                  Owner Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Owner Name
                    </label>
                    <p className="mt-1 text-sm">
                      {selectedSeller.userId?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Owner Email
                    </label>
                    <p className="mt-1 text-sm break-all">
                      {selectedSeller.userId?.email || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Metadata */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                  Metadata
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Created At
                    </label>
                    <p className="mt-1 text-sm">
                      {new Date(selectedSeller.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Last Updated
                    </label>
                    <p className="mt-1 text-sm">
                      {new Date(selectedSeller.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default SellerConfigList;
