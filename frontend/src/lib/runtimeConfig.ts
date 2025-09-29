// src/lib/runtimeConfig.ts
// Reads runtime env variables injected at container start


interface RuntimeConfig {
  VITE_PUBLIC_KEYCLOAK_URL?: string;
  VITE_PUBLIC_KEYCLOAK_REALM?: string;
  VITE_PUBLIC_KEYCLOAK_CLIENT_ID?: string;
  VITE_PUBLIC_KEYCLOAK_ENABLED?: string;
  VITE_API_BASE_URL?: string;
  VITE_BACKEND_API_BASE_URL?: string;
  VITE_PUBLIC_CLUSTER_CREATION_METHOD?: string;
  VITE_API_VERIFY_URL?: string;
  [key: string]: string | undefined;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
    return (window as any).__RUNTIME_CONFIG__;
  }
  // Fallback: use import.meta.env (Vite injects .env.local here)
  const env: RuntimeConfig = {
    VITE_PUBLIC_KEYCLOAK_URL: import.meta.env.VITE_PUBLIC_KEYCLOAK_URL,
    VITE_PUBLIC_KEYCLOAK_REALM: import.meta.env.VITE_PUBLIC_KEYCLOAK_REALM,
    VITE_PUBLIC_KEYCLOAK_CLIENT_ID: import.meta.env.VITE_PUBLIC_KEYCLOAK_CLIENT_ID,
    VITE_PUBLIC_KEYCLOAK_ENABLED: import.meta.env.VITE_PUBLIC_KEYCLOAK_ENABLED,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_BACKEND_API_BASE_URL: import.meta.env.VITE_BACKEND_API_BASE_URL,
    VITE_PUBLIC_CLUSTER_CREATION_METHOD: import.meta.env.VITE_PUBLIC_CLUSTER_CREATION_METHOD,
    VITE_API_VERIFY_URL: import.meta.env.VITE_API_VERIFY_URL,
  };
  return env;
}
