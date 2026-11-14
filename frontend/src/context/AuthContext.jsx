import React, { createContext, useContext, useState, useEffect } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "../firebase";
import { setAuthTokenProvider } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // Configure API client token provider
    setAuthTokenProvider(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        return currentUser.getIdToken();
      }
      return null;
    });

    const unsubscribe = auth.onIdTokenChanged(async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.error("Google sign-in error:", err);
      const msg = err.code === "auth/popup-closed-by-user"
        ? "Sign-in cancelled."
        : err.message || "Failed to sign in with Google.";
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const loginWithEmail = async (email, password) => {
    setAuthError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    } catch (err) {
      console.error("Email login error:", err);
      let msg = "Invalid email or password.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "Invalid email or password. Please check your credentials.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many failed login attempts. Please reset your password or try again later.";
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signupWithEmail = async (email, password, displayName) => {
    setAuthError("");
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await updateProfile(result.user, { displayName: displayName.trim() });
      }
      return result.user;
    } catch (err) {
      console.error("Email signup error:", err);
      let msg = "Failed to create account.";
      if (err.code === "auth/email-already-in-use") {
        msg = "An account with this email address already exists. Please log in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password is too weak. Please use at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please provide a valid email address.";
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email) => {
    setAuthError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      console.error("Password reset error:", err);
      let msg = "Failed to send password reset email.";
      if (err.code === "auth/user-not-found") {
        msg = "No account found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    setAuthError("");
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
      setAuthError("Failed to log out. Please try again.");
    }
  };

  const getIdToken = async (forceRefresh = false) => {
    if (auth.currentUser) {
      return auth.currentUser.getIdToken(forceRefresh);
    }
    return null;
  };

  const value = {
    user,
    loading,
    authError,
    setAuthError,
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    resetPassword,
    logout,
    getIdToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
