import "@fontsource-variable/manrope";
import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";

import { App } from "./App.js";
import { config } from "./wagmi.js";

const queryClient = new QueryClient();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ accentColor: "#f5b83d", accentColorForeground: "#17130a", borderRadius: "large", fontStack: "system" })}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
