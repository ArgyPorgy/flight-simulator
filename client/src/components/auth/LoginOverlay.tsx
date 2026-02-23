import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useLogin } from "@/hooks/use-auth";
import { Wallet, ShieldAlert } from "lucide-react";

export function LoginOverlay() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const loginMutation = useLogin();
  const syncAttemptedRef = useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract wallet address in a stable way
  const walletAddress = useMemo(() => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    return embeddedWallet?.address || wallets[0]?.address || "";
  }, [wallets]);

  // Sync with backend
  const syncWithBackend = useCallback(() => {
    if (!user || !walletAddress) {
      console.log("[Auth] Cannot sync - missing user or wallet", { user: !!user, walletAddress: !!walletAddress });
      return false;
    }
    
    if (loginMutation.isPending) {
      console.log("[Auth] Sync already in progress");
      return true;
    }

    console.log("[Auth] Syncing with backend...", { privyId: user.id, walletAddress });
    loginMutation.mutate({
      privyId: user.id,
      walletAddress: walletAddress,
    });
    return true;
  }, [user, walletAddress, loginMutation]);

  // Auto-sync when Privy is authenticated and we have wallet
  useEffect(() => {
    if (!ready) return;
    
    // If authenticated with Privy and have wallet, sync with backend
    if (authenticated && user && walletAddress && !syncAttemptedRef.current && !loginMutation.isPending) {
      console.log("[Auth] Auto-syncing authenticated user");
      syncAttemptedRef.current = true;
      syncWithBackend();
    }
  }, [ready, authenticated, user, walletAddress, loginMutation.isPending, syncWithBackend]);

  // Reset sync flag when user logs out
  useEffect(() => {
    if (!authenticated) {
      syncAttemptedRef.current = false;
      setError(null);
    }
  }, [authenticated]);

  // Handle mutation results
  useEffect(() => {
    if (loginMutation.isSuccess) {
      setIsConnecting(false);
      setError(null);
    }
    if (loginMutation.isError) {
      setIsConnecting(false);
      setError("Failed to sync with server. Please try again.");
    }
  }, [loginMutation.isSuccess, loginMutation.isError]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Case 1: Already authenticated with Privy - just sync with backend
      if (authenticated && user) {
        console.log("[Auth] User already authenticated with Privy, syncing backend");
        
        if (walletAddress) {
          // Have wallet, sync with backend
          syncAttemptedRef.current = false; // Allow re-sync
          const synced = syncWithBackend();
          if (!synced) {
            setError("Unable to sync. Please refresh the page.");
            setIsConnecting(false);
          }
        } else {
          // No wallet yet - this shouldn't happen with Privy embedded wallet
          // Wait a bit for wallet to load
          console.log("[Auth] Waiting for wallet to load...");
          setTimeout(() => {
            if (walletAddress) {
              syncAttemptedRef.current = false;
              syncWithBackend();
            } else {
              setError("Wallet not found. Please refresh and try again.");
              setIsConnecting(false);
            }
          }, 2000);
        }
        return;
      }

      // Case 2: Not authenticated - do normal Privy login
      console.log("[Auth] Starting Privy login");
      await login();
      // After login, the useEffect will handle syncing
      
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      
      // Handle "already logged in" error from Privy
      if (err?.message?.includes("already logged in") || err?.message?.includes("link")) {
        console.log("[Auth] Privy says already logged in, attempting sync");
        // User is logged in with Privy but we didn't detect it
        // This can happen if `authenticated` state hasn't updated yet
        setTimeout(() => {
          if (user && walletAddress) {
            syncAttemptedRef.current = false;
            syncWithBackend();
          } else {
            // Force a page refresh to reset Privy state
            setError("Session conflict detected. Refreshing...");
            setTimeout(() => window.location.reload(), 1500);
          }
        }, 500);
      } else {
        setError(err?.message || "Login failed. Please try again.");
        setIsConnecting(false);
      }
    }
  };

  // Handle logout (for error recovery)
  const handleLogout = async () => {
    try {
      await logout();
      syncAttemptedRef.current = false;
      setError(null);
      setIsConnecting(false);
    } catch (err) {
      console.error("[Auth] Logout error:", err);
      // Force refresh
      window.location.reload();
    }
  };

  const showConnecting = !ready || loginMutation.isPending || isConnecting;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center scanlines bg-background/80 backdrop-blur-sm">
      <div className="relative glass-panel w-full max-w-md p-8 overflow-hidden rounded-xl">
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary opacity-50" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary opacity-50" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary opacity-50" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary opacity-50" />

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <img 
              src="/skynet.png" 
              alt="SKYNET" 
              className="w-20 h-20 object-contain rounded-lg relative z-10"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              SKYNET
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              UNAUTHORIZED ACCESS PROHIBITED. <br/>
              PLEASE AUTHENTICATE TO CONTINUE.
            </p>
          </div>

          <div className="w-full bg-black/40 border border-border/50 p-4 rounded text-left font-mono text-xs text-primary/70 space-y-1">
            <div className="flex justify-between">
              <span>SYSTEM STATUS:</span>
              <span className="text-accent animate-pulse">LOCKED</span>
            </div>
            <div className="flex justify-between">
              <span>ENCRYPTION:</span>
              <span>AES-256</span>
            </div>
            <div className="flex justify-between">
              <span>NETWORK:</span>
              <span>GLOBAL NODE 04</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="w-full bg-red-500/20 border border-red-500/50 p-3 rounded text-red-400 text-sm font-mono">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={showConnecting}
            className="w-full relative group overflow-hidden bg-primary/10 border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 px-6 py-4 rounded-lg font-display font-bold text-lg tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showConnecting ? (
              <>
                <ShieldAlert className="w-5 h-5 animate-pulse" />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>CONNECT WALLET / PRIVY</span>
              </>
            )}
            
            {/* Button hover sweep effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </button>

          {/* Reset button - shown when there's an error or user is stuck */}
          {(error || (authenticated && !loginMutation.isPending && !loginMutation.isSuccess)) && (
            <button
              onClick={handleLogout}
              className="w-full text-sm text-muted-foreground hover:text-red-400 transition-colors font-mono"
            >
              Having trouble? Click here to reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
