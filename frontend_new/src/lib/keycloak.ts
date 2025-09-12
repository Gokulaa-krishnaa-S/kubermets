import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_PUBLIC_KEYCLOAK_URL,
  realm: import.meta.env.VITE_PUBLIC_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_PUBLIC_KEYCLOAK_CLIENT_ID,
});

export default keycloak;