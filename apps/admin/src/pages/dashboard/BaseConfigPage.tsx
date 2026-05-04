import { useState, useEffect } from "react";
import { Settings, Save, Loader2, AlertTriangle, Undo2, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";
import useAuthStore from "@/store/useAuthStore";
import { isEqual } from "lodash";

interface BaseConfig {
  sidebar: boolean;
  banner: boolean;
  showAds: boolean;
  showCategoryMenu: boolean;
  search: {
    enabled: boolean;
    voice: boolean;
    image: boolean;
  };
  revalidationTime: number;
  bottomHeader: {
    enabled: boolean;
    categoryMenu: boolean;
    navList: boolean;
  };
}

const REVALIDATION_PRESETS = [
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
  { label: "30 min", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
];

export default function BaseConfigPage() {
  const [config, setConfig] = useState<BaseConfig>({
    sidebar: true,
    banner: true,
    showAds: true,
    showCategoryMenu: true,
    search: {
      enabled: true,
      voice: true,
      image: true,
    },
    revalidationTime: 60,
    bottomHeader: {
      enabled: true,
      categoryMenu: true,
      navList: true,
    },
  });
  const [originalConfig, setOriginalConfig] = useState<BaseConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { token } = useAuthStore();
  const { toast } = useToast();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/base-config`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data?.data) {
        const data = response.data.data;
        // Ensure all fields exist
        const normalizedConfig = {
          sidebar: data.sidebar ?? true,
          banner: data.banner ?? true,
          showAds: data.showAds ?? true,
          showCategoryMenu: data.showCategoryMenu ?? true,
          search: {
            enabled: data.search?.enabled ?? true,
            voice: data.search?.voice ?? true,
            image: data.search?.image ?? true,
          },
          revalidationTime: data.revalidationTime ?? 60,
          bottomHeader: {
            enabled: data.bottomHeader?.enabled ?? true,
            categoryMenu: data.bottomHeader?.categoryMenu ?? true,
            navList: data.bottomHeader?.navList ?? true,
          },
        };
        setConfig(normalizedConfig);
        setOriginalConfig(normalizedConfig);
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch base configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/base-config`,
        config,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setOriginalConfig(config);
      toast({
        title: "Success",
        description: "Configuration saved successfully",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalConfig) {
      setConfig(originalConfig);
    }
  };

  const handleToggle = (key: keyof BaseConfig) => {
    if (saving) return;
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSearchToggle = (key: keyof BaseConfig["search"]) => {
    if (saving) return;
    setConfig((prev) => ({
      ...prev,
      search: {
        ...prev.search,
        [key]: !prev.search[key],
      },
    }));
  };

  const handleRevalidationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (saving) return;
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Convert minutes to seconds for storage
      const seconds = Math.round(value * 60);
      setConfig((prev) => ({
        ...prev,
        revalidationTime: seconds,
      }));
    }
  };



  const handleBottomHeaderToggle = (key: keyof BaseConfig["bottomHeader"]) => {
    if (saving) return;
    setConfig((prev) => ({
      ...prev,
      bottomHeader: {
        ...prev.bottomHeader,
        [key]: !prev.bottomHeader[key],
      },
    }));
  };

  const hasChanges = !isEqual(config, originalConfig);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="text-purple-600" size={32} />
            Base Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage global website settings and component visibility
          </p>
        </div>

      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-purple-600" />
              Global Layout Settings
            </CardTitle>
            <CardDescription>
              Toggle the visibility of major website components. Changes affect
              all users immediately after saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between space-x-4 rounded-lg border p-4"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[150px]" />
                      <Skeleton className="h-3 w-[250px]" />
                    </div>
                    <Skeleton className="h-6 w-10 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Sidebar Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Sidebar</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable the sidebar navigation across the website.
                      </p>
                    </div>
                    <Switch
                      checked={config.sidebar}
                      onCheckedChange={() => handleToggle("sidebar")}
                      disabled={saving}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  {config.sidebar !== originalConfig?.sidebar && (
                    <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        Attention
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {config.sidebar
                          ? "Enabling the sidebar will display the navigation menu on the left side of all supported pages."
                          : "Disabling the sidebar will hide navigation menus and expand the main content area to full width."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Banner Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Main Banner</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable the main promotional banner section.
                      </p>
                    </div>
                    <Switch
                      checked={config.banner}
                      onCheckedChange={() => handleToggle("banner")}
                      disabled={saving}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  {config.banner !== originalConfig?.banner && (
                    <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        Attention
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {config.banner
                          ? "The main banner section will be visible at the top of the home page."
                          : "The main banner section will be hidden from the home page layout."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Ads Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">
                        Advertisement Sections
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable all advertisement blocks globally.
                      </p>
                    </div>
                    <Switch
                      checked={config.showAds}
                      onCheckedChange={() => handleToggle("showAds")}
                      disabled={saving}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  {config.showAds !== originalConfig?.showAds && (
                    <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        Attention
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {config.showAds
                          ? "Ad spaces will be active and display content based on your ad configurations."
                          : "All advertisement spaces will be collapsed and hidden from users."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Category Menu Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Category Menu</Label>
                      <p className="text-sm text-muted-foreground">
                        Show product categories as a dedicated menu or dropdown.
                      </p>
                    </div>
                    <Switch
                      checked={config.showCategoryMenu}
                      onCheckedChange={() => handleToggle("showCategoryMenu")}
                      disabled={saving}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  {config.showCategoryMenu !== originalConfig?.showCategoryMenu && (
                    <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        Attention
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {config.showCategoryMenu
                          ? "A category menu will be displayed, allowing users to browse products by category easily."
                          : "The category menu will be hidden. Users will need to use other navigation methods to find categories."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                {/* Search Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Search Features</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable global search and extended search capabilities like
                        voice and image search.
                      </p>
                    </div>
                    <Switch
                      checked={config.search.enabled}
                      onCheckedChange={() => handleSearchToggle("enabled")}
                      disabled={saving}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  
                  {config.search.enabled && (
                    <div className="mt-4 pl-6 space-y-4 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                       {/* Voice Search */}
                       <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Voice Search</Label>
                          <p className="text-xs text-muted-foreground">
                            Allow users to search using voice commands.
                          </p>
                        </div>
                        <Switch
                          checked={config.search.voice}
                          onCheckedChange={() => handleSearchToggle("voice")}
                          disabled={saving}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>

                       {/* Image Search */}
                       <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Image Search</Label>
                          <p className="text-xs text-muted-foreground">
                            Allow users to search by uploading images.
                          </p>
                        </div>
                        <Switch
                          checked={config.search.image}
                          onCheckedChange={() => handleSearchToggle("image")}
                          disabled={saving}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>
                    </div>
                  )}

                  {config.search.enabled !== originalConfig?.search?.enabled && (
                    <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        Attention
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {config.search.enabled
                          ? "Search functionality will be enabled across the platform."
                          : "The search bar will be hidden from all users."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Revalidation Time Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-0.5 max-w-sm">
                      <Label className="text-base font-medium">Revalidation Time</Label>
                      <p className="text-sm text-muted-foreground">
                        Set how often the global data is revalidated. Choose a preset or enter a custom time in minutes.
                      </p>
                    </div>
                    
                    <div className="flex-1 w-full max-w-md space-y-4">
                      {/* Presets */}
                      <div className="flex flex-wrap gap-2">
                        {REVALIDATION_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              if (!saving) {
                                setConfig((prev) => ({
                                  ...prev,
                                  revalidationTime: preset.value,
                                }));
                              }
                            }}
                            disabled={saving}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                              config.revalidationTime === preset.value
                                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom Input */}
                      <div className="relative">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          Custom Time (Minutes)
                        </Label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={config.revalidationTime / 60} // Display in minutes
                            onChange={handleRevalidationChange}
                            disabled={saving}
                            className="flex h-10 w-full rounded-md border border-input bg-background pl-3 pr-16 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-muted-foreground">
                            <span className="text-xs font-medium bg-slate-100 px-1.5 py-0.5 rounded">min</span>
                            <span className="text-xs">≈ {(config.revalidationTime).toFixed(0)}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {config.revalidationTime !== originalConfig?.revalidationTime && (
                    <Alert className="mt-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50">
                      <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertTitle className="text-blue-800 dark:text-blue-300">
                        Update Pending
                      </AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-400">
                        Revalidation time will update from{" "}
                        <strong>{originalConfig?.revalidationTime ? (originalConfig.revalidationTime / 60).toFixed(2) : "1.00"} min</strong>{" "}
                        to{" "}
                        <strong>{(config.revalidationTime / 60).toFixed(2)} min</strong>
                        .
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Bottom Header Config */}
                <div className="rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Bottom Header</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable the bottom header section containing category menu and navigation.
                      </p>
                    </div>
                    <Switch
                      checked={config.bottomHeader.enabled}
                      onCheckedChange={() => handleBottomHeaderToggle("enabled")}
                      disabled={saving}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                  
                  {config.bottomHeader.enabled && (
                    <div className="mt-4 pl-6 space-y-4 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                       {/* Category Menu */}
                       <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Category Menu</Label>
                          <p className="text-xs text-muted-foreground">
                            Show the category menu dropdown.
                          </p>
                        </div>
                        <Switch
                          checked={config.bottomHeader.categoryMenu}
                          onCheckedChange={() => handleBottomHeaderToggle("categoryMenu")}
                          disabled={saving}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>

                       {/* Nav List */}
                       <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Navigation List</Label>
                          <p className="text-xs text-muted-foreground">
                            Show the main navigation links.
                          </p>
                        </div>
                        <Switch
                          checked={config.bottomHeader.navList}
                          onCheckedChange={() => handleBottomHeaderToggle("navList")}
                          disabled={saving}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>
                    </div>
                  )}

                  {config.bottomHeader.enabled !== originalConfig?.bottomHeader?.enabled && (
                    <Alert className="mt-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        Attention
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {config.bottomHeader.enabled
                          ? "The bottom header section will be displayed."
                          : "The bottom header section will be hidden."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bottom Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={!hasChanges || saving}
            className="flex-1 md:flex-none"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex-1 md:flex-none min-w-[140px] bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
