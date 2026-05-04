import { create } from "zustand";
import { adminApi } from "@/lib/config";

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

interface ApiDebugStore {
  apiCalls: ApiCall[];
  addCall: (call: ApiCall) => void;
  updateCall: (id: string, updates: Partial<ApiCall>) => void;
  clearCalls: () => void;
  getCurrentPageCalls: (pathname: string) => ApiCall[];
  initInterceptors: (pathname: string) => () => void;
}

export const useApiDebugStore = create<ApiDebugStore>((set, get) => ({
  apiCalls: [],

  addCall: (call) =>
    set((state) => ({
      apiCalls: [...state.apiCalls, call],
    })),

  updateCall: (id, updates) =>
    set((state) => ({
      apiCalls: state.apiCalls.map((call) =>
        call.id === id ? { ...call, ...updates } : call
      ),
    })),

  clearCalls: () => set({ apiCalls: [] }),

  getCurrentPageCalls: (pathname) => {
    return get().apiCalls.filter((call) => call.route === pathname);
  },

  initInterceptors: (pathname) => {
    // Only run in development mode
    if (!import.meta.env.DEV) {
      return () => {};
    }

    // console.log("[ApiDebugStore] Initializing interceptors...");

    // Request interceptor
    const requestInterceptor = adminApi.interceptors.request.use(
      (config) => {
        // console.log("[ApiDebugStore] Request intercepted:", config.url);
        const callId = `${Date.now()}-${Math.random()}`;
        (config as any).__callId = callId;
        (config as any).__startTime = Date.now();

        const newCall: ApiCall = {
          id: callId,
          timestamp: new Date(),
          method: config.method?.toUpperCase() || "GET",
          url: config.url || "",
          requestData: config.data,
          route: pathname,
        };

        get().addCall(newCall);
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
          "[ApiDebugStore] Response intercepted:",
          response.config.url
        );
        const callId = (response.config as any).__callId;
        const startTime = (response.config as any).__startTime;
        const duration = startTime ? Date.now() - startTime : undefined;

        get().updateCall(callId, {
          status: response.status,
          duration,
          responseData: response.data,
        });

        return response;
      },
      (error) => {
        const callId = (error.config as any)?.__callId;
        const startTime = (error.config as any)?.__startTime;
        const duration = startTime ? Date.now() - startTime : undefined;

        get().updateCall(callId, {
          status: error.response?.status,
          duration,
          error: error.response?.data || error.message,
        });

        return Promise.reject(error);
      }
    );

    // Return cleanup function
    return () => {
      adminApi.interceptors.request.eject(requestInterceptor);
      adminApi.interceptors.response.eject(responseInterceptor);
    };
  },
}));
