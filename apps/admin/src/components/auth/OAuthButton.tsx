"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  oauthService,
  type OAuthUserData,
  type BackendUserData,
} from "@/lib/oauthService";
import useAuthStore from "@/store/useAuthStore";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface OAuthError extends Error {
  statusCode?: number;
  data?: unknown;
}

interface OAuthButtonProps {
  provider: "google" | "github";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: (userData: BackendUserData) => void;
  onError?: (error: string) => void;
}

export function OAuthButton({
  provider,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: OAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { setAuthData } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleOAuthSignIn = async () => {
    setIsLoading(true);

    try {
      let oauthUserData: OAuthUserData | null = null;

      // Sign in with the specified provider
      if (provider === "google") {
        oauthUserData = await oauthService.signInWithGoogle();
      } else if (provider === "github") {
        oauthUserData = await oauthService.signInWithGitHub();
      }

      console.log(
        "📊 OAuth data received:",
        oauthUserData ? "✅ Success" : "❌ Failed",
      );

      if (!oauthUserData) {
        console.error("❌ OAuth service returned null data");
        onError?.("OAuth sign in failed");
        return;
      }

      // Convert to backend format
      const backendUserData = oauthService.convertToBackendUser(oauthUserData);

      // Send user data to backend for verification/registration
      const response = await fetch(
        `${import.meta.env.VITE_NEXT_PUBLIC_API_URL}/api/auth/oauth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(backendUserData),
        },
      );

      console.log(
        "📡 Response received - Status:",
        response.status,
        "OK:",
        response.ok,
      );

      if (!response.ok) {
        console.error("❌ Response not OK - investigating...");
        const contentType = response.headers.get("content-type");
        let errorData;

        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          console.error("📄 Non-JSON error response:", text.substring(0, 500));
          errorData = { message: "Backend returned invalid response format" };
        }

        // Create a custom error with status code for better handling
        const error = new Error(
          errorData.message || `OAuth verification failed`,
        ) as OAuthError;
        error.statusCode = response.status;
        error.data = errorData;
        throw error;
      }

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error(
          "❌ Failed to parse success response as JSON:",
          parseError,
        );
        throw new Error(
          "Backend returned invalid JSON format in success response",
        );
      }

      if (responseData.success && responseData.data) {
        const { accessToken, refreshToken, ...userData } = responseData.data;

        // Update user store - IMPORTANT: Set token first, then user data
        if (!accessToken) {
          throw new Error("No token received from server");
        }

        // Set token and user data (OAuth might not give a refresh token initially, so we reuse token or empty str)
        setAuthData(accessToken, refreshToken || accessToken, userData);

        // Success callback
        onSuccess?.(backendUserData);

        toast({
          title: "Sign in successful",
          description: `Successfully signed in with ${provider}`,
        });

        // Wait for state to update, then navigate
        await new Promise((resolve) => setTimeout(resolve, 200));

        navigate("/");
      } else {
        throw new Error(responseData.message || "OAuth verification failed");
      }
    } catch (error) {
      console.error(`${provider} OAuth error:`, error);

      let errorTitle = "Sign in failed";
      let errorMessage = `Failed to sign in with ${provider}`;
      let toastDuration = 7000;

      if (error instanceof Error) {
        errorMessage = error.message;
        const statusCode = (error as OAuthError).statusCode;

        // Handle specific error cases with helpful messages
        if (statusCode === 409) {
          // Conflict - account already exists
          if (
            errorMessage.includes("already registered using") ||
            errorMessage.includes("already exists using")
          ) {
            // Different OAuth provider
            errorTitle = "Account Already Exists";
            const otherProvider =
              errorMessage.match(/(Google|GitHub)/i)?.[0] || "another provider";
            errorMessage = `This email is already registered with ${otherProvider}. Please use ${otherProvider} to sign in.`;
            toastDuration = 10000;
          } else if (errorMessage.includes("sign in with your password")) {
            // Regular password account exists
            errorTitle = "Email Already Registered";
            const providerName =
              provider.charAt(0).toUpperCase() + provider.slice(1);
            errorMessage = `This email already has an account. Please sign in using your email and password, not ${providerName}.`;
            toastDuration = 10000;
          } else if (errorMessage.includes("Authentication mismatch")) {
            errorTitle = "Authentication Error";
            errorMessage =
              "There's an issue with your account. Please contact support for assistance.";
            toastDuration = 10000;
          }
        }
      }

      onError?.(errorMessage);

      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorMessage,
        duration: toastDuration,
      });

      // Sign out from Firebase if backend verification failed
      await oauthService.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full ${className}`}
      disabled={disabled || isLoading}
      onClick={handleOAuthSignIn}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <svg
            className="animate-spin h-4 w-4 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Signing in...
        </div>
      ) : (
        children
      )}
    </Button>
  );
}
