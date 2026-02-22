import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivyProvider } from "@privy-io/react-auth";

// Pages
import Game from "@/pages/Game";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Game} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
  
  // Show error if Privy App ID is not configured
  if (!privyAppId) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-500">Configuration Error</h1>
          <p className="text-gray-300">
            Missing <code className="bg-gray-800 px-2 py-1 rounded">VITE_PRIVY_APP_ID</code> environment variable.
          </p>
          <div className="text-left bg-gray-900 p-4 rounded text-sm text-gray-400">
            <p className="mb-2">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to <a href="https://dashboard.privy.io" className="text-blue-400 underline" target="_blank">dashboard.privy.io</a></li>
              <li>Create an app and copy your App ID</li>
              <li>Create a <code>.env</code> file in the project root</li>
              <li>Add: <code>VITE_PRIVY_APP_ID=your-app-id</code></li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "wallet", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#3b82f6",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export default App;
