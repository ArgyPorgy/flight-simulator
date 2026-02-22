import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background scanlines">
      <div className="glass-panel p-8 max-w-md w-full text-center space-y-6 rounded-lg border-destructive/50">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto animate-pulse" />
        
        <div>
          <h1 className="text-4xl font-display font-bold text-destructive mb-2">404 ERROR</h1>
          <p className="font-mono text-sm text-muted-foreground">
            TARGET COORDINATES NOT FOUND IN DATABASE.
          </p>
        </div>

        <div className="p-4 bg-black/50 border border-destructive/20 font-mono text-xs text-left text-destructive/70">
          &gt; TRACE_ROUTE_FAILED<br/>
          &gt; PACKET_DROPPED<br/>
          &gt; RECOMMEND_RETURN_TO_BASE
        </div>

        <Link href="/" className="inline-block w-full py-3 bg-secondary border border-border hover:border-primary text-primary font-display tracking-widest uppercase transition-all hover:bg-primary/10">
          Return to Radar
        </Link>
      </div>
    </div>
  );
}
