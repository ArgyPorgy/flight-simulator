import { users, aircraftAgents } from "@shared/schema";
import type { User, InsertUser, AircraftAgent, InsertAircraftAgent, UpdateAgentRequest } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByPrivy(privyId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAgents(): Promise<AircraftAgent[]>;
  getAgent(id: number): Promise<AircraftAgent | undefined>;
  createAgent(agent: InsertAircraftAgent): Promise<AircraftAgent>;
  updateAgent(id: number, agent: UpdateAgentRequest): Promise<AircraftAgent>;
  clearAgents(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPrivy(privyId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.privyId, privyId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAgents(): Promise<AircraftAgent[]> {
    return await db.select().from(aircraftAgents);
  }

  async getAgent(id: number): Promise<AircraftAgent | undefined> {
    const [agent] = await db.select().from(aircraftAgents).where(eq(aircraftAgents.id, id));
    return agent;
  }

  async createAgent(agent: InsertAircraftAgent): Promise<AircraftAgent> {
    const [newAgent] = await db.insert(aircraftAgents).values(agent).returning();
    return newAgent;
  }

  async updateAgent(id: number, updates: UpdateAgentRequest): Promise<AircraftAgent> {
    const [updated] = await db.update(aircraftAgents)
      .set({...updates, lastUpdated: new Date()})
      .where(eq(aircraftAgents.id, id))
      .returning();
    return updated;
  }
  
  async clearAgents(): Promise<void> {
    await db.delete(aircraftAgents);
  }
}

export const storage = new DatabaseStorage();
