import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  privyId: text("privy_id").unique(),
  walletAddress: text("wallet_address").unique(),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aircraftAgents = pgTable("aircraft_agents", {
  id: serial("id").primaryKey(),
  callsign: text("callsign").notNull(),
  model: text("model").notNull(),
  type: text("type").notNull(), // 'commercial', 'private'
  status: text("status").notNull(), // 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'landing', 'holding'
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  altitude: doublePrecision("altitude").notNull(),
  heading: doublePrecision("heading").notNull(),
  speed: doublePrecision("speed").notNull(),
  origin: text("origin"),
  destination: text("destination"),
  route: jsonb("route").$type<{lat: number, lon: number}[]>(),
  currentWaypointIndex: integer("current_waypoint_index").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertAgentSchema = createInsertSchema(aircraftAgents).omit({ id: true, lastUpdated: true });

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AircraftAgent = typeof aircraftAgents.$inferSelect;
export type InsertAircraftAgent = z.infer<typeof insertAgentSchema>;

// Request types
export type LoginRequest = { privyId: string; walletAddress: string };
export type UpdateAgentRequest = Partial<InsertAircraftAgent>;

// Response types
export type UserResponse = User;
export type AgentResponse = AircraftAgent;
export type AgentsListResponse = AircraftAgent[];

// Polling query types
export interface AgentsQueryParams {
  status?: string;
  bounds?: string; // e.g., "minLat,minLon,maxLat,maxLon"
}
