import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

function generateFlightRoute(startLat: number, startLon: number) {
  // Generate a random destination 5-10 degrees away
  const destLat = startLat + (Math.random() * 10 - 5);
  const destLon = startLon + (Math.random() * 10 - 5);
  return [
    { lat: startLat, lon: startLon },
    { lat: destLat, lon: destLon }
  ];
}

// Generate a random Ethereum wallet address
function generateWalletAddress(): string {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

async function spawnAgents(count: number) {
  const models = ["B737", "A320", "C172", "G650", "A350"];
  const types = ["commercial", "commercial", "private", "private", "commercial"];
  
  const created = [];
  for (let i = 0; i < count; i++) {
    // Random global coordinates (mostly land/populated areas approx)
    const lat = (Math.random() * 120) - 60; 
    const lon = (Math.random() * 360) - 180;
    
    const route = generateFlightRoute(lat, lon);
    const destination = `APT-${Math.floor(Math.random() * 1000)}`;
    const origin = `APT-${Math.floor(Math.random() * 1000)}`;
    const heading = Math.random() * 360;
    
    const agent = await storage.createAgent({
      callsign: `FLT${Math.floor(Math.random() * 9000) + 1000}`,
      model: models[Math.floor(Math.random() * models.length)],
      type: types[Math.floor(Math.random() * types.length)],
      status: "cruise",
      lat,
      lon,
      altitude: 30000 + Math.random() * 10000,
      heading,
      speed: 400 + Math.random() * 150,
      origin,
      destination,
      route,
      currentWaypointIndex: 1,
      walletAddress: generateWalletAddress() // Generate wallet address for each agent
    });
    created.push(agent);
  }
  return created;
}

// Simple simulation loop (1 tick per 2 seconds)
let simInterval: NodeJS.Timeout | null = null;

function startSimulationLoop() {
  if (simInterval) return;
  simInterval = setInterval(async () => {
    try {
      const agents = await storage.getAgents();
      for (const agent of agents) {
        if (agent.status === "cruise" && agent.route && agent.route.length > 0) {
          const waypointIndex = agent.currentWaypointIndex ?? 0;
          const dest = agent.route[waypointIndex];
          if (!dest) continue;
          
          // Calculate heading towards destination
          const dLon = (dest.lon - agent.lon) * Math.PI / 180;
          const lat1 = agent.lat * Math.PI / 180;
          const lat2 = dest.lat * Math.PI / 180;
          
          const y = Math.sin(dLon) * Math.cos(lat2);
          const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
          let targetHeading = Math.atan2(y, x) * 180 / Math.PI;
          targetHeading = (targetHeading + 360) % 360;
          
          // Smooth turn
          let headingDiff = targetHeading - agent.heading;
          if (headingDiff > 180) headingDiff -= 360;
          if (headingDiff < -180) headingDiff += 360;
          
          const heading = agent.heading + (headingDiff * 0.1);
          
          // Move forward based on speed (rough approximation for map degrees)
          // 400 knots is ~ 0.003 degrees per second
          const speedDegPerSec = (agent.speed / 3600) * 0.02; // Very rough
          const distanceToMove = speedDegPerSec * 2; // 2 seconds
          
          const newLat = agent.lat + distanceToMove * Math.cos(heading * Math.PI / 180);
          const newLon = agent.lon + distanceToMove * Math.sin(heading * Math.PI / 180);
          
          await storage.updateAgent(agent.id, {
            lat: newLat,
            lon: newLon,
            heading: heading
          });
        }
      }
    } catch (e) {
      console.error("Simulation tick error", e);
    }
  }, 2000);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      console.log(`[AUTH] Login attempt for privyId: ${input.privyId.substring(0, 20)}...`);
      
      let user = await storage.getUserByPrivy(input.privyId);
      if (!user) {
        user = await storage.createUser({
          privyId: input.privyId,
          walletAddress: input.walletAddress,
          username: `Pilot_${input.walletAddress.substring(0, 6)}`
        });
        console.log(`[AUTH] Created new user: ${user.id}`);
      } else {
        console.log(`[AUTH] Found existing user: ${user.id}`);
      }
      
      // Regenerate session to prevent session fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            console.error('[AUTH] Session regenerate error:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Store user ID in session
      req.session.userId = user.id;
      
      // Explicitly save session to ensure it persists
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[AUTH] Session save error:', err);
            reject(err);
          } else {
            console.log(`[AUTH] Session saved for user ${user!.id}, sessionId: ${req.session.id?.substring(0, 10)}...`);
            resolve();
          }
        });
      });
      
      res.status(200).json(user);
    } catch (err) {
      console.error('[AUTH] Login error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    try {
      const userId = req.session?.userId;
      console.log(`[AUTH] /me check - sessionId: ${req.session?.id?.substring(0, 10) || 'none'}..., userId: ${userId || 'none'}`);
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        // Session has invalid user ID, clear it
        console.log(`[AUTH] User ${userId} not found in database, clearing session`);
        if (req.session) {
          req.session.userId = undefined;
        }
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      res.status(200).json(user);
    } catch (err) {
      console.error('[AUTH] /me error:', err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    return new Promise<void>((resolve) => {
      if (req.session) {
        const sessionId = req.session.id;
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
            res.status(500).json({ message: "Error logging out" });
            resolve();
            return;
          }
          res.status(200).json({ message: "Logged out successfully" });
          resolve();
        });
      } else {
        res.status(200).json({ message: "Logged out successfully" });
        resolve();
      }
    });
  });

  app.get(api.agents.list.path, async (req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.get(api.agents.get.path, async (req, res) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  });

  app.post(api.agents.spawn.path, async (req, res) => {
    const count = req.body?.count || 25;
    // For demo purposes, clear existing and respawn
    await storage.clearAgents();
    const agents = await spawnAgents(count);
    res.status(201).json(agents);
  });

  // Seed data if none exists
  const existingAgents = await storage.getAgents();
  if (existingAgents.length === 0) {
    await spawnAgents(35); // Populate world initially
  }

  startSimulationLoop();

  return httpServer;
}
