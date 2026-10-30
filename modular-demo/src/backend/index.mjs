/**
 * Backend Architecture Module Index
 * Exports all reusable controllers, middleware, and database gateways.
 */

// Controllers
export { getStateFor, clearStateCache } from './controllers/stateController.mjs';

// Middleware
export {
  decodeJwt,
  parseCookies,
  cookieHeaders,
  clearAuthCookies,
  currentUser,
  sessionFor,
  bearer
} from './middleware/authMiddleware.mjs';

export { assertSameOrigin } from './middleware/securityMiddleware.mjs';

// Database
export { supabaseRequest, getRows } from './database/supabaseClient.mjs';
