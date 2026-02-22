import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

// Trust proxy (needed for Render and other hosting platforms)
app.set('trust proxy', 1);

// Configure session management
// Use PostgreSQL store in production, MemoryStore in development
let sessionStore: session.Store;
if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
  // Manually create session table if it doesn't exist
  // This avoids issues with connect-pg-simple's SQL file not being accessible after bundling
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        )
        WITH (OIDS=FALSE);
      `);
      
      // Add primary key constraint (ignore if already exists)
      try {
        await pool.query(`
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        `);
      } catch (err: any) {
        // Constraint might already exist, that's okay
        if (!err.message?.includes("already exists") && !err.message?.includes("duplicate")) {
          throw err;
        }
      }
      
      // Create index (ignore if already exists)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
      `);
    } catch (err: any) {
      // Table might already exist, that's okay
      if (!err.message?.includes("already exists") && !err.message?.includes("duplicate")) {
        console.error("Error creating session table:", err);
      }
    }
  })();

  const PgStore = connectPgSimple(session);
  sessionStore = new PgStore({
    pool: pool as any,
    tableName: "session",
    createTableIfMissing: false, // We create it manually above
  });
} else {
  const SessionStore = MemoryStore(session);
  sessionStore = new SessionStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  });
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax", // Same-origin, so lax is fine
    },
  })
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // reusePort is only supported on Linux, so we conditionally use it
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };
  
  // Only use reusePort on Linux (for production deployments)
  if (process.platform === "linux" && process.env.NODE_ENV === "production") {
    listenOptions.reusePort = true;
  }
  
  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
