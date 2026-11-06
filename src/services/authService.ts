import axiosInstance from "@/config/axios";
import { setCookie, deleteCookie, getCookie } from "cookies-next";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  role: string;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface MeResponse {
  organization: OrganizationProfile;
}

export const authService = {
  /**
   * POST /api/auth/login
   * Authenticates the organization and sets signed 7-day token cookie.
   */
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const res = (await axiosInstance.post("/api/auth/login", payload)) as unknown as LoginResponse;

    if (res && res.token) {
      // Set cookies for 7 days
      setCookie("token", res.token, { maxAge: 60 * 60 * 24 * 7, path: "/" });
      if (res.role) {
        setCookie("role", res.role, { maxAge: 60 * 60 * 24 * 7, path: "/" });
      }
    }

    return res;
  },

  /**
   * GET /api/auth/me (Protected)
   * Retrieves profile of current organization.
   */
  async getMe(): Promise<MeResponse> {
    const res = (await axiosInstance.get("/api/auth/me")) as unknown as MeResponse;
    return res;
  },

  /**
   * Clears cookies to log out.
   */
  logout() {
    deleteCookie("token", { path: "/" });
    deleteCookie("role", { path: "/" });
  },

  /**
   * Check if user is authenticated locally.
   */
  isAuthenticated(): boolean {
    return Boolean(getCookie("token"));
  },
};
