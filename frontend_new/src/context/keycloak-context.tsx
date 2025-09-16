"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import keycloakInstance from "@/lib/keycloak";
// import Loader from "@/components/Loader";

type KeycloakContextType = {
    authenticated: boolean;
    token: string | null;
    loading: boolean;
};

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined);

export const KeycloakProvider = ({ children }: { children: React.ReactNode }) => {
    const [authenticated, setAuthenticated] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const setCookie = (name: string, value: string, maxAgeSeconds?: number) => {
        if (typeof document === "undefined") return;
        let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
        if (typeof maxAgeSeconds === "number" && maxAgeSeconds > 0) {
            cookie += `; Max-Age=${Math.floor(maxAgeSeconds)}`;
        }
        try {
            // Add Secure flag when served over HTTPS
            if (typeof window !== "undefined" && window.location.protocol === "https:") {
                cookie += "; Secure";
            }
        } catch {
            // no-op
        }
        document.cookie = cookie;
    };

    const deleteCookie = (name: string) => {
        if (typeof document === "undefined") return;
        document.cookie = `${encodeURIComponent(name)}=; path=/; Max-Age=0; SameSite=Lax`;
    };

    const syncTokenCookie = (kcToken: string | null) => {
        if (!kcToken) {
            deleteCookie("token");
            return;
        }
        const tokenParsed: any = (keycloakInstance as any).tokenParsed;
        const currentTimeSeconds = Math.floor(Date.now() / 1000);
        const expiresAtSeconds: number | undefined = tokenParsed?.exp;
        const maxAgeSeconds = typeof expiresAtSeconds === "number" ? Math.max(expiresAtSeconds - currentTimeSeconds, 1) : undefined;
        setCookie("token", kcToken, maxAgeSeconds);
    };

    useEffect(() => {
        if (import.meta.env.VITE_PUBLIC_KEYCLOAK_ENABLED === "true") {
            // Initialize Keycloak
            initializeKeycloak();
        } else {
            setLoading(false);
        }
    }, []);

    const initializeKeycloak = async () => {
        try {
            const authenticated = await keycloakInstance.init({
                onLoad: "login-required",
                checkLoginIframe: false,
            });
            console.log("Authenticated:", authenticated);
            setAuthenticated(authenticated);

            if (authenticated) {
                const token = keycloakInstance.token || null;
                setToken(token);
                syncTokenCookie(token);
                // console.log("keycloak instance::", keycloakInstance)
                // console.log("Authenticated with token:", token);

                const refreshInterval = setInterval(() => {
                    keycloakInstance
                        .updateToken(1000)
                        .then((refreshed) => {
                            if (refreshed) {
                                const newToken = keycloakInstance.token || null;
                                setToken(newToken);
                                syncTokenCookie(newToken);
                                console.log("Token refreshed successfully.");
                            }
                        })
                        .catch(() => {
                            console.error("Token refresh failed. Logging out.");
                            deleteCookie("token");
                            keycloakInstance.logout();
                        });
                }, 60000);

                return () => clearInterval(refreshInterval);
            } else {
                console.log("User not authenticated. Redirecting to login...");
                deleteCookie("token");
                keycloakInstance.login();
            }
        } catch (error) {
            console.error("Keycloak initialization failed:", error);
            setAuthenticated(false);
            deleteCookie("token");
        } finally {
            setLoading(false);
            console.log("Keycloak initialized.");
        }
    };

    if (loading) {
        // return <Loader />;
    }

    return (
        <KeycloakContext.Provider value={{ authenticated, token, loading }}>
            {children}
        </KeycloakContext.Provider>
    );
};

export const useKeycloak = () => {
    const context = useContext(KeycloakContext);
    if (!context) {
        throw new Error("useKeycloak must be used within a KeycloakProvider");
    }
    return context;
};

