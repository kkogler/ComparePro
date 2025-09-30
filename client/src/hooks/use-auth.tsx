import { createContext, ReactNode, useContext, useMemo, useRef, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  organizationSlug: string | null;
};

type LoginData = Pick<InsertUser, "username" | "password"> & { isFFLMode?: boolean };

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  // Try to get organization slug from URL params first, fallback to location parsing
  const params = useParams();
  
  // Use useMemo to compute slug and path type from location
  const { organizationSlug, isAdminPath } = useMemo(() => {
    if (location && location.startsWith('/admin')) {
      return { organizationSlug: null, isAdminPath: true };
    } else if (location && location.startsWith('/org/')) {
      // Use params.slug if available, otherwise fallback to location parsing
      const slug = params.slug || location.split('/')[2];
      return { organizationSlug: slug, isAdminPath: false };
    } else {
      return { organizationSlug: null, isAdminPath: false };
    }
  }, [location, params.slug]);

  // Memoize query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => {
    if (isAdminPath) {
      return ['/api/admin/user'];
    } else if (organizationSlug) {
      return [`/org/${organizationSlug}/api/user`];
    } else {
      return ['no-user'];
    }
  }, [isAdminPath, organizationSlug]);

  // Simple query without complex dependencies - admin path takes priority
  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: (isAdminPath || organizationSlug)
      ? getQueryFn({ on401: "returnNull" }) 
      : () => Promise.resolve(null),
    enabled: !!(isAdminPath || organizationSlug),
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Use different endpoints based on context
      let endpoint: string;
      if (organizationSlug) {
        // Organization-specific login
        endpoint = `/org/${organizationSlug}/api/login`;
      } else if (location.startsWith('/admin') && !credentials.isFFLMode) {
        // Administrator login only if not in FFL mode
        endpoint = '/api/admin/login';
      } else {
        // Universal login - determines organization automatically (includes FFL mode)
        endpoint = '/api/login';
      }
      
      // Remove isFFLMode from credentials before sending to server
      const { isFFLMode, ...serverCredentials } = credentials;
      const res = await apiRequest(endpoint, "POST", serverCredentials);
      
      if (!res.ok) {
        let errorMessage = "Login failed. Please try again later.";
        
        try {
          const errorData = await res.json();
          if (res.status === 401) {
            errorMessage = "Incorrect username or password. Please try again.";
          } else if (res.status === 404) {
            errorMessage = "Organization not found. Please check the URL.";
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If JSON parsing fails, use status-based messages
          if (res.status === 401) {
            errorMessage = "Incorrect username or password. Please try again.";
          } else if (res.status === 404) {
            errorMessage = "Organization not found. Please check the URL.";
          }
        }
        
        const error = new Error(errorMessage);
        // Mark as user-friendly error to prevent runtime error display
        (error as any).isUserFriendly = true;
        throw error;
      }
      
      return await res.json();
    },
    onSuccess: (user: SelectUser & { organizationSlug?: string }) => {
      // Handle different login scenarios
      if (user.organizationSlug) {
        // Universal login - redirect to user's organization search page
        queryClient.setQueryData([`/org/${user.organizationSlug}/api/user`], user);
        navigate(`/org/${user.organizationSlug}/search`);
      } else if (organizationSlug) {
        // Organization-specific login - redirect to search page
        queryClient.setQueryData([`/org/${organizationSlug}/api/user`], user);
        navigate(`/org/${organizationSlug}/search`);
      } else {
        // DevOps admin login
        queryClient.setQueryData(['/api/admin/user'], user);
        navigate('/admin/');
      }
    },
    onError: (error: Error) => {
      // Error is handled by the form's inline error display
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      if (!organizationSlug) {
        const error = new Error("Organization not found");
        (error as any).isUserFriendly = true;
        throw error;
      }
      const res = await apiRequest(`/org/${organizationSlug}/api/register`, "POST", credentials);
      
      if (!res.ok) {
        let errorMessage = "Registration failed. Please try again later.";
        
        try {
          const errorData = await res.json();
          if (res.status === 400) {
            if (errorData.message && errorData.message.includes("Username already exists")) {
              errorMessage = "Username already exists. Please choose a different username.";
            } else {
              errorMessage = "Registration failed. Please check your information and try again.";
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If JSON parsing fails, use status-based messages
          if (res.status === 400) {
            const errorText = await res.text();
            if (errorText.includes("Username already exists")) {
              errorMessage = "Username already exists. Please choose a different username.";
            } else {
              errorMessage = "Registration failed. Please check your information and try again.";
            }
          }
        }
        
        const error = new Error(errorMessage);
        // Mark as user-friendly error to prevent runtime error display
        (error as any).isUserFriendly = true;
        throw error;
      }
      
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData([`/org/${organizationSlug}/api/user`], user);
      
      // Redirect after successful registration
      if (organizationSlug) {
        navigate(`/org/${organizationSlug}/`);
      }
    },
    onError: (error: Error) => {
      // Error is handled by the form's inline error display
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const endpoint = organizationSlug ? `/org/${organizationSlug}/api/logout` : '/api/admin/logout';
      await apiRequest(endpoint, "POST");
    },
    onSuccess: () => {
      const queryKey = organizationSlug ? `/org/${organizationSlug}/api/user` : '/api/admin/user';
      queryClient.setQueryData([queryKey], null);
      
      // Clear all cached data
      queryClient.clear();
      
      // Navigate to appropriate login page after logout
      if (organizationSlug) {
        navigate(`/org/${organizationSlug}/auth`);
      } else {
        navigate('/admin/auth');
      }
    },
    onError: (error: Error) => {
      // Don't show toast for logout errors as they're typically navigation-related
      console.warn('Logout error (non-critical):', error.message);
      
      // Even if logout fails on server, clear client state and redirect
      const queryKey = organizationSlug ? `/org/${organizationSlug}/api/user` : '/api/admin/user';
      queryClient.setQueryData([queryKey], null);
      queryClient.clear();
      
      if (organizationSlug) {
        navigate(`/org/${organizationSlug}/auth`);
      } else {
        navigate('/admin/auth');
      }
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        organizationSlug,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    const error = new Error("useAuth must be used within an AuthProvider");
    (error as any).isUserFriendly = true;
    throw error;
  }
  return context;
}