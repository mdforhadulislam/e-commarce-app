// Re-export the configured admin API instance
export { default as api } from "./config";
export {
  adminApi,
  ADMIN_API_ENDPOINTS,
  buildAdminQueryParams,
  getAdminApiConfig,
} from "./config";

// Export default for backward compatibility
export { default } from "./config";
