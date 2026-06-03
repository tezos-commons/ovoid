// The AuthProvider/useAuth implementation lives in lib/api/agent.tsx so that
// the auth context and the agent bundle share a single source of session truth.
// This module re-exports them at the contract path @/lib/auth/AuthProvider.
export {
  AuthProvider,
  useAuth,
  type AuthState,
  type AuthContextValue,
} from '../api/agent'
