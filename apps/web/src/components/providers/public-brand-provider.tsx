"use client";

import { createContext, useContext } from "react";

const PublicBrandContext = createContext({ supportEmail: "", siteDomain: "" });

export function PublicBrandProvider({ supportEmail, siteDomain, children }: {
  supportEmail: string;
  siteDomain: string;
  children: React.ReactNode;
}) {
  return <PublicBrandContext.Provider value={{ supportEmail, siteDomain }}>
    {children}
  </PublicBrandContext.Provider>;
}

export function usePublicBrand() {
  return useContext(PublicBrandContext);
}
