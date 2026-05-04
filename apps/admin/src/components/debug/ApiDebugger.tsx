import { useState, useMemo, useEffect } from "react";
import { Bug, X, Trash2, Download } from "lucide-react";
import { useApiDebugStore, ApiCall } from "@/store/apiDebugStore";
import { useLocation } from "react-router-dom";
import JsonViewer from "@/components/debug/JsonViewer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ApiDebugger = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const apiCalls = useApiDebugStore((state) => state.apiCalls);
  const clearCalls = useApiDebugStore((state) => state.clearCalls);
  const getCurrentPageCalls = useApiDebugStore(
    (state) => state.getCurrentPageCalls
  );
  const initInterceptors = useApiDebugStore((state) => state.initInterceptors);

  const currentPageCalls = getCurrentPageCalls(location.pathname);

  // Initialize interceptors
  useEffect(() => {
    const cleanup = initInterceptors(location.pathname);
    return cleanup;
  }, [location.pathname, initInterceptors]);

  // Debug logs
  //   console.log("[ApiDebugger] Render - apiCalls count:", apiCalls.length);
  //   console.log(
  //     "[ApiDebugger] Render - currentPageCalls count:",
  //     currentPageCalls.length
  //   );

  const [selectedCall, setSelectedCall] = useState<ApiCall | null>(null);
  const [activeTab, setActiveTab] = useState<"current" | "all" | "route">(
    "current"
  );
  const [selectedRoute, setSelectedRoute] = useState<string>("all");

  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  // Get unique routes from all API calls
  const availableRoutes = useMemo(() => {
    const routesSet = new Set(apiCalls.map((call) => call.route));
    return Array.from(routesSet).sort();
  }, [apiCalls]);

  // Get calls based on selected route
  const routeCalls = useMemo(() => {
    if (selectedRoute === "all") {
      return apiCalls;
    }
    return apiCalls.filter((call) => call.route === selectedRoute);
  }, [apiCalls, selectedRoute]);

  // Determine display calls based on active tab
  const displayCalls = useMemo(() => {
    if (activeTab === "current") return currentPageCalls;
    if (activeTab === "route") return routeCalls;
    return apiCalls;
  }, [activeTab, currentPageCalls, routeCalls, apiCalls]);

  const getStatusColor = (status?: number) => {
    if (!status) return "bg-gray-500";
    if (status >= 200 && status < 300) return "bg-green-500";
    if (status >= 300 && status < 400) return "bg-blue-500";
    if (status >= 400 && status < 500) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-blue-500";
      case "POST":
        return "bg-green-500";
      case "PUT":
        return "bg-yellow-500";
      case "PATCH":
        return "bg-orange-500";
      case "DELETE":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const downloadCallData = (call: ApiCall) => {
    const data = JSON.stringify(call, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-call-${call.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllCalls = () => {
    const data = JSON.stringify(displayCalls, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-calls-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Floating Debug Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-linear-to-br from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center group"
        title="API Debugger"
      >
        <Bug size={24} />
        {displayCalls.length > 0 && (
          <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
            {displayCalls.length}
          </span>
        )}
      </button>

      {/* Debug Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl lg:max-w-5xl p-0 overflow-hidden flex flex-col"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Bug size={20} className="text-purple-600" />
                  API Debugger
                  <Badge variant="secondary" className="ml-2">
                    Development
                  </Badge>
                </SheetTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadAllCalls}
                    disabled={displayCalls.length === 0}
                  >
                    <Download size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCalls}
                    disabled={apiCalls.length === 0}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "current" | "all" | "route")
              }
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="px-6 pt-4 space-y-3">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="current" className="relative">
                    Current
                    {currentPageCalls.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {currentPageCalls.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="route" className="relative">
                    By Route
                    {routeCalls.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {routeCalls.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="relative">
                    All
                    {apiCalls.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {apiCalls.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Route Selector - Only show when route tab is active */}
                {activeTab === "route" && availableRoutes.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Select Route
                    </label>
                    <Select
                      value={selectedRoute}
                      onValueChange={setSelectedRoute}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a route" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          All Routes ({apiCalls.length} calls)
                        </SelectItem>
                        {availableRoutes.map((route) => {
                          const routeCallCount = apiCalls.filter(
                            (call) => call.route === route
                          ).length;
                          return (
                            <SelectItem key={route} value={route}>
                              {route} ({routeCallCount}{" "}
                              {routeCallCount === 1 ? "call" : "calls"})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <TabsContent
                value="current"
                className="flex-1 mt-0 overflow-hidden"
              >
                <CallsList
                  calls={currentPageCalls}
                  selectedCall={selectedCall}
                  onSelectCall={setSelectedCall}
                  getStatusColor={getStatusColor}
                  getMethodColor={getMethodColor}
                  downloadCallData={downloadCallData}
                />
              </TabsContent>

              <TabsContent
                value="route"
                className="flex-1 mt-0 overflow-hidden"
              >
                <CallsList
                  calls={routeCalls}
                  selectedCall={selectedCall}
                  onSelectCall={setSelectedCall}
                  getStatusColor={getStatusColor}
                  getMethodColor={getMethodColor}
                  downloadCallData={downloadCallData}
                />
              </TabsContent>

              <TabsContent value="all" className="flex-1 mt-0 overflow-hidden">
                <CallsList
                  calls={apiCalls}
                  selectedCall={selectedCall}
                  onSelectCall={setSelectedCall}
                  getStatusColor={getStatusColor}
                  getMethodColor={getMethodColor}
                  downloadCallData={downloadCallData}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

interface CallsListProps {
  calls: ApiCall[];
  selectedCall: ApiCall | null;
  onSelectCall: (call: ApiCall | null) => void;
  getStatusColor: (status?: number) => string;
  getMethodColor: (method: string) => string;
  downloadCallData: (call: ApiCall) => void;
}

const CallsList: React.FC<CallsListProps> = ({
  calls,
  selectedCall,
  onSelectCall,
  getStatusColor,
  getMethodColor,
  downloadCallData,
}) => {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Bug size={48} className="text-muted-foreground opacity-20 mb-4" />
        <p className="text-muted-foreground">No API calls recorded yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Make some requests to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Calls List */}
      <ScrollArea className="flex-1 border-r lg:max-w-md">
        <div className="p-4 space-y-2">
          {calls.map((call) => (
            <div
              key={call.id}
              onClick={() => onSelectCall(call)}
              className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedCall?.id === call.id ? "bg-muted border-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge
                    className={`${getMethodColor(call.method)} text-white shrink-0 text-[10px] px-1.5 py-0.5`}
                  >
                    {call.method}
                  </Badge>
                  <span className="text-xs font-mono truncate">
                    {call.url.replace(
                      import.meta.env.VITE_NEXT_PUBLIC_API_URL || "",
                      ""
                    )}
                  </span>
                </div>
                {call.status && (
                  <span
                    className={`h-5 w-5 rounded-full ${getStatusColor(
                      call.status
                    )} text-white text-[10px] flex items-center justify-center shrink-0 font-medium`}
                  >
                    {call.status}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">
                  {call.timestamp.toLocaleTimeString()}
                </span>
                {call.duration && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {call.duration}ms
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Call Details */}
      {selectedCall ? (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between sticky top-0 bg-background pb-2 border-b">
              <h3 className="font-semibold text-sm">Call Details</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCallData(selectedCall)}
                  className="h-8 w-8 p-0"
                >
                  <Download size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectCall(null)}
                  className="h-8 w-8 p-0"
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Method
                  </label>
                  <Badge
                    className={`${getMethodColor(selectedCall.method)} text-white`}
                  >
                    {selectedCall.method}
                  </Badge>
                </div>

                {selectedCall.status && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Status
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-6 w-6 rounded-full ${getStatusColor(
                          selectedCall.status
                        )} text-white text-xs flex items-center justify-center font-medium`}
                      >
                        {selectedCall.status}
                      </span>
                      <span className="text-sm">{selectedCall.status}</span>
                    </div>
                  </div>
                )}

                {selectedCall.duration && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Duration
                    </label>
                    <p className="text-sm font-mono">
                      {selectedCall.duration}ms
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Timestamp
                  </label>
                  <p className="text-xs font-mono">
                    {selectedCall.timestamp.toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  URL
                </label>
                <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                  {selectedCall.url}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Route
                </label>
                <p className="text-xs font-mono bg-muted p-2 rounded">
                  {selectedCall.route}
                </p>
              </div>

              {selectedCall.requestData && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Request Data
                  </label>
                  <JsonViewer
                    data={selectedCall.requestData}
                    className="max-h-64"
                  />
                </div>
              )}

              {selectedCall.responseData && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Response Data
                  </label>
                  <JsonViewer
                    data={selectedCall.responseData}
                    className="max-h-96"
                  />
                </div>
              )}

              {selectedCall.error && (
                <div>
                  <label className="text-xs font-medium text-destructive block mb-2">
                    Error
                  </label>
                  <JsonViewer
                    data={selectedCall.error}
                    className="max-h-64 bg-red-950 border border-red-500"
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Select a call to view details
          </p>
        </div>
      )}
    </div>
  );
};

export default ApiDebugger;
