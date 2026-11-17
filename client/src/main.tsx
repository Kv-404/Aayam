import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { domAnimation, LazyMotion } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Focus and reconnect refetch only data older than a minute. The API is a free Worker: every request counts.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
      staleTime: 60 * 1000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* `m` components with only the DOM animation features: a smaller motion bundle than `motion.*`. */}
      <LazyMotion features={domAnimation} strict>
        <App />
      </LazyMotion>
    </QueryClientProvider>
  </StrictMode>,
);
