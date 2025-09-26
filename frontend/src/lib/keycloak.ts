import Keycloak from "keycloak-js";
import { getRuntimeConfig } from "./runtimeConfig";

const runtimeConfig = getRuntimeConfig();

const keycloak = new Keycloak({
  url: runtimeConfig.VITE_PUBLIC_KEYCLOAK_URL,
  realm: runtimeConfig.VITE_PUBLIC_KEYCLOAK_REALM,
  clientId: runtimeConfig.VITE_PUBLIC_KEYCLOAK_CLIENT_ID,
});

export default keycloak;