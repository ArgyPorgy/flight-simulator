import { useEffect, useRef, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useLogin } from "@/hooks/use-auth";
import { Wallet, ShieldAlert } from "lucide-react";

export function LoginOverlay() {
  const { ready, authenticated, login, user, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const loginMutation = useLogin();
  const syncedUserIdRef = useRef<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Extract wallet address in a stable way
  const walletAddress = useMemo(() => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    return embeddedWallet?.address || wallets[0]?.address || "";
  }, [wallets]);

  // When Privy user is authenticated, sync with backend (only once per user)
  useEffect(() => {
    if (!ready || !authenticated || !user) {
      setIsConnecting(false);
      return;
    }

    // Skip if we've already synced this user
    if (syncedUserIdRef.current === user.id) {
      setIsConnecting(false);
      return;
    }

    // Skip if mutation is already in progress
    if (loginMutation.isPending) {
      return;
    }

    if (walletAddress) {
      syncedUserIdRef.current = user.id;
      loginMutation.mutate({
        privyId: user.id,
        walletAddress: walletAddress,
      });
    }
  }, [ready, authenticated, user?.id, walletAddress, loginMutation.isPending, loginMutation.mutate]);

  // Reset the ref if user logs out
  useEffect(() => {
    if (!authenticated) {
      syncedUserIdRef.current = null;
    }
  }, [authenticated]);

  // Handle mutation success/error
  useEffect(() => {
    if (loginMutation.isSuccess || loginMutation.isError) {
      setIsConnecting(false);
    }
  }, [loginMutation.isSuccess, loginMutation.isError]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // If user is already authenticated with Privy but backend session failed,
      // just trigger the backend sync again
      if (authenticated && user && walletAddress) {
        syncedUserIdRef.current = null; // Reset to allow re-sync
        loginMutation.mutate({
          privyId: user.id,
          walletAddress: walletAddress,
        });
      } else {
        // Normal login flow
        await login();
      }
    } catch (error: any) {
      console.error("Privy login error:", error);
      // If user is already logged in, try to connect wallet instead
      if (error?.message?.includes("already logged in") || authenticated) {
        try {
          // User is already authenticated, just need to sync with backend
          if (user && walletAddress) {
            syncedUserIdRef.current = null;
            loginMutation.mutate({
              privyId: user.id,
              walletAddress: walletAddress,
            });
          } else if (authenticated) {
            // Try connecting a wallet
            await connectWallet();
          }
        } catch (innerError) {
          console.error("Fallback connection error:", innerError);
          setIsConnecting(false);
        }
      } else {
        setIsConnecting(false);
      }
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
        </div>
      </div>
    </div>
  );
}
