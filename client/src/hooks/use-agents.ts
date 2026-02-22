import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useAgents() {
  return useQuery({
    queryKey: [api.agents.list.path],
    queryFn: async () => {
      const res = await fetch(api.agents.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json(); // Expected to match AgentsListResponse
    },
    // Poll every 2 seconds for real-time radar updates
    refetchInterval: 2000,
  });
}

export function useAgent(id: number) {
  return useQuery({
    queryKey: [api.agents.get.path, id],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch agent");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useSpawnAgents() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (count: number = 5) => {
      const res = await fetch(api.agents.spawn.path, {
        method: api.agents.spawn.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to spawn agents");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.agents.list.path] });
    },
  });
}
