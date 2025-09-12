import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { KeycloakProvider } from './context/keycloak-context.tsx';

createRoot(document.getElementById("root")!).render(
    <KeycloakProvider><App /></KeycloakProvider>
);
