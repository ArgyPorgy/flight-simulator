import { useEffect, useRef, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useLogin } from "@/hooks/use-auth";
import { Wallet, ShieldAlert, Fingerprint, Hexagon } from "lucide-react";

export function LoginOverlay() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const loginMutation = useLogin();
  const syncedUserIdRef = useRef<string | null>(null);

  // Extract wallet address in a stable way
  const walletAddress = useMemo(() => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    return embeddedWallet?.address || wallets[0]?.address || "";
  }, [wallets]);

  // When Privy user is authenticated, sync with backend (only once per user)
  useEffect(() => {
    if (!ready || !authenticated || !user) {
      return;
    }

    // Skip if we've already synced this user
    if (syncedUserIdRef.current === user.id) {
      return;
    }

    // Skip if mutation is already in progress or completed
    if (loginMutation.isPending || loginMutation.isSuccess) {
      return;
    }

    if (walletAddress) {
      syncedUserIdRef.current = user.id;
      loginMutation.mutate({
        privyId: user.id,
        walletAddress: walletAddress,
      });
    }
  }, [ready, authenticated, user?.id, walletAddress, loginMutation.isPending, loginMutation.isSuccess, loginMutation.mutate]);

  // Reset the ref if user logs out
  useEffect(() => {
    if (!authenticated) {
      syncedUserIdRef.current = null;
    }
  }, [authenticated]);

  const handleConnect = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Privy login error:", error);
    }
  };

  const isConnecting = !ready || loginMutation.isPending;

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
            <Hexagon className="w-20 h-20 text-primary relative z-10 animate-[spin_10s_linear_infinite]" />
            <Fingerprint className="w-10 h-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Nexus ATC Access
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
            disabled={isConnecting}
            className="w-full relative group overflow-hidden bg-primary/10 border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 px-6 py-4 rounded-lg font-display font-bold text-lg tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
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
