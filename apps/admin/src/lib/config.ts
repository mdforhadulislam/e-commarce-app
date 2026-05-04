import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

/**
 * Pagination defaults — change DEFAULT_PAGE_SIZE here to update all pages at once.
 */
export const PAGINATION_CONFIG = {
  /** Default number of items per page (matches API default of 25) */
  DEFAULT_PAGE_SIZE: 25,
} as const;

/** Convenience re-export for quick import */
export const DEFAULT_PAGE_SIZE = PAGINATION_CONFIG.DEFAULT_PAGE_SIZE;

/**
 * Configuration utility for Admin API
 */
interface AdminApiConfig {
  baseURL: string;
  isProduction: boolean;
}

/**
 * Get API configuration for admin
 */
export const getAdminApiConfig = (): AdminApiConfig => {
  const apiUrl = import.meta.env.VITE_NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error(
      "VITE_NEXT_PUBLIC_API_URL environment variable is not defined",
    );
  }

  const isProduction =
    import.meta.env.VITE_APP_ENV === "production" ||
    import.meta.env.PROD === true;

  return {
    baseURL: `${apiUrl}/api`,
    isProduction,
  };
};

// Queue for 401 refresh logic
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Extend InternalAxiosRequestConfig to include _retry property
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Create configured axios instance
 */
const createApiInstance = (): AxiosInstance => {
  const { baseURL } = getAdminApiConfig();

  const instance = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
    withCredentials: true,
    timeout: 30000, // 30 seconds timeout
  });

  // Add request interceptor to include auth token
  instance.interceptors.request.use(
    (config) => {
      // Get token from localStorage (zustand persist stores it there)
      const authData = localStorage.getItem("auth-storage");
      if (authData) {
        try {
          const parsedData = JSON.parse(authData);
          const token = parsedData.state?.token;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("Error parsing auth data:", error);
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Add response interceptor for better error handling
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as CustomAxiosRequestConfig;

      if (error.code === "ERR_NETWORK") {
        // Network Error
      }

      // Handle 401 unauthorized errors
      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !originalRequest.url?.includes("/auth/login") &&
        !originalRequest.url?.includes("/auth/refresh") &&
        !originalRequest.url?.includes("/auth/register")
      ) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            addRefreshSubscriber((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(instance(originalRequest));
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Dynamically import store to avoid circular dependency
          const { default: useAuthStore } =
            await import("@/store/useAuthStore");
          const { refreshToken, setAuthData, user } = useAuthStore.getState();

          if (!refreshToken) {
            isRefreshing = false;
            useAuthStore.getState().logout();
            return Promise.reject(error);
          }

          // Try to refresh token
          const refreshResponse = await axios.post(
            `${getAdminApiConfig().baseURL}/auth/refresh`,
            { refreshToken },
          );

          const { accessToken } = refreshResponse.data;

          if (accessToken) {
            // Update store
            setAuthData(accessToken, refreshToken, user!);

            onRefreshed(accessToken);
            isRefreshing = false;

            // Update header for original request
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            // Retry original request
            return instance(originalRequest);
          } else {
            throw new Error("No access token returned");
          }
        } catch (refreshError) {
          isRefreshing = false;
          // Refresh failed - logout user
          const { default: useAuthStore } =
            await import("@/store/useAuthStore");
          useAuthStore.getState().logout();

          // Clean up any pending subscribers
          refreshSubscribers = [];

          // If specific error, handle it or redirect
          localStorage.removeItem("auth-storage");
          window.location.href = "/login";

          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );

  return instance;
};

// Create and export the configured axios instance
export const adminApi = createApiInstance();

/**
 * Admin API endpoints
 */
export const ADMIN_API_ENDPOINTS = {
  // Auth
  LOGIN: "/auth/login",
  REGISTER: "/auth/register",
  LOGOUT: "/auth/logout",

  // Users
  USERS: "/users",
  USER_BY_ID: (id: string) => `/users/${id}`,
  CREATE_USER: "/users",
  UPDATE_USER: (id: string) => `/users/${id}`,
  DELETE_USER: (id: string) => `/users/${id}`,

  // Products
  PRODUCTS: "/products",
  PRODUCT_BY_ID: (id: string) => `/products/${id}`,
  CREATE_PRODUCT: "/products",
  UPDATE_PRODUCT: (id: string) => `/products/${id}`,
  DELETE_PRODUCT: (id: string) => `/products/${id}`,

  // Categories
  CATEGORIES: "/categories",
  CATEGORY_BY_ID: (id: string) => `/categories/${id}`,
  CREATE_CATEGORY: "/categories",
  UPDATE_CATEGORY: (id: string) => `/categories/${id}`,
  DELETE_CATEGORY: (id: string) => `/categories/${id}`,

  // Brands
  BRANDS: "/brands",
  BRAND_BY_ID: (id: string) => `/brands/${id}`,
  CREATE_BRAND: "/brands",
  UPDATE_BRAND: (id: string) => `/brands/${id}`,
  DELETE_BRAND: (id: string) => `/brands/${id}`,

  // Orders
  ORDERS: "/orders",
  ORDER_BY_ID: (id: string) => `/orders/${id}`,
  UPDATE_ORDER_STATUS: (id: string) => `/orders/${id}/status`,

  // Stats & Analytics
  STATS: "/stats",
  ANALYTICS: "/analytics",
  DASHBOARD_STATS: "/stats/dashboard",

  BANNERS: "/banners",
  BANNER_BY_ID: (id: string) => `/banners/${id}`,
  CREATE_BANNER: "/banners",
  UPDATE_BANNER: (id: string) => `/banners/${id}`,
  DELETE_BANNER: (id: string) => `/banners/${id}`,

  // Product Banners
  PRODUCT_BANNERS: "/product-banners",
  PRODUCT_BANNER_BY_ID: (id: string) => `/product-banners/${id}`,
  CREATE_PRODUCT_BANNER: "/product-banners",
  UPDATE_PRODUCT_BANNER: (id: string) => `/product-banners/${id}`,
  DELETE_PRODUCT_BANNER: (id: string) => `/product-banners/${id}`,
} as const;

/**
 * Helper function to build query parameters
 */
export const buildAdminQueryParams = (
  params: Record<string, string | number | boolean | undefined>,
): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export default adminApi;
