import { useState } from "react";
import { useLogin } from "@/hooks/use-auth";
import { Wallet, ShieldAlert, Fingerprint, Hexagon } from "lucide-react";

export function LoginOverlay() {
  const loginMutation = useLogin();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate web3 wallet connection delay
    setTimeout(() => {
      loginMutation.mutate({
        privyId: `privy_did_${Math.random().toString(36).substring(7)}`,
        walletAddress: `0x${Math.random().toString(16).substring(2, 42)}`,
      });
    }, 1500);
  };

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
            disabled={isConnecting || loginMutation.isPending}
            className="w-full relative group overflow-hidden bg-primary/10 border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 px-6 py-4 rounded-lg font-display font-bold text-lg tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting || loginMutation.isPending ? (
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
