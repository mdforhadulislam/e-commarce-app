import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { adminApi } from "@/lib/config";
import { useLocation } from "react-router-dom";

export interface ApiCall {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  requestData?: any;
  responseData?: any;
  error?: any;
  route: string;
}

interface ApiDebugContextType {
  apiCalls: ApiCall[];
  currentPageCalls: ApiCall[];
  clearCalls: () => void;
}

const ApiDebugContext = createContext<ApiDebugContextType | undefined>(
  undefined
);

export const ApiDebugProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const location = useLocation();

  const clearCalls = useCallback(() => {
    setApiCalls([]);
  }, []);

  const currentPageCalls = apiCalls.filter(
    (call) => call.route === location.pathname
  );

  useEffect(() => {
    // Only run in development mode
    if (!import.meta.env.DEV) return;

    // console.log("[ApiDebugContext] Interceptors registering...");

    // Request interceptor
    const requestInterceptor = adminApi.interceptors.request.use(
      (config) => {
        // console.log("[ApiDebugContext] Request intercepted:", config.url);
        const callId = `${Date.now()}-${Math.random()}`;
        (config as any).__callId = callId;
        (config as any).__startTime = Date.now();

        const newCall: ApiCall = {
          id: callId,
          timestamp: new Date(),
          method: config.method?.toUpperCase() || "GET",
          url: config.url || "",
          requestData: config.data,
          route: location.pathname,
        };

        setApiCalls((prev) => [...prev, newCall]);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    const responseInterceptor = adminApi.interceptors.response.use(
      (response) => {
        console.log(
          "[ApiDebugContext] Response intercepted:",
          response.config.url
        );
        const callId = (response.config as any).__callId;
        const startTime = (response.config as any).__startTime;
        const duration = startTime ? Date.now() - startTime : undefined;

        setApiCalls((prev) =>
          prev.map((call) =>
            call.id === callId
              ? {
                  ...call,
                  status: response.status,
                  duration,
                  responseData: response.data,
                }
              : call
          )
        );

        return response;
      },
      (error) => {
        const callId = (error.config as any)?.__callId;
        const startTime = (error.config as any)?.__startTime;
        const duration = startTime ? Date.now() - startTime : undefined;

        setApiCalls((prev) =>
          prev.map((call) =>
            call.id === callId
              ? {
                  ...call,
                  status: error.response?.status,
                  duration,
                  error: error.response?.data || error.message,
                }
              : call
          )
        );

        return Promise.reject(error);
      }
    );

    // Cleanup
    return () => {
      adminApi.interceptors.request.eject(requestInterceptor);
      adminApi.interceptors.response.eject(responseInterceptor);
    };
  }, [location.pathname]);

  return (
    <ApiDebugContext.Provider
      value={{ apiCalls, currentPageCalls, clearCalls }}
    >
      {children}
    </ApiDebugContext.Provider>
  );
};

export const useApiDebug = () => {
  const context = useContext(ApiDebugContext);
  if (!context) {
    throw new Error("useApiDebug must be used within ApiDebugProvider");
  }
  return context;
};
