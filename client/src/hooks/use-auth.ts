import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type LoginInput } from "@shared/routes";

export function useMe() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user session");
      // Optionally validate with schema: return api.auth.me.responses[200].parse(await res.json());
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const validated = api.auth.login.input.parse(data);
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Authentication failed");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
      if (!res.ok) {
        throw new Error("Logout failed");
      }
      return res.json();
    },
    onSuccess: () => {
      // Clear the user cache so the app shows login screen
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });
}
