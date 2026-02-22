import { z } from 'zod';
import { insertUserSchema, insertAgentSchema, users, aircraftAgents } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        privyId: z.string(),
        walletAddress: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  agents: {
    list: {
      method: 'GET' as const,
      path: '/api/agents' as const,
      input: z.object({
        status: z.string().optional(),
        bounds: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof aircraftAgents.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/agents/:id' as const,
      responses: {
        200: z.custom<typeof aircraftAgents.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    spawn: {
      method: 'POST' as const,
      path: '/api/agents/spawn' as const,
      input: z.object({ count: z.number().min(1).max(50).optional() }).optional(),
      responses: {
        201: z.array(z.custom<typeof aircraftAgents.$inferSelect>()),
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type LoginInput = z.infer<typeof api.auth.login.input>;
export type AgentsListResponse = z.infer<typeof api.agents.list.responses[200]>;
