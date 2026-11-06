import { getCurrentUserToken } from "@/utils/helpers/getCurrentUser";
import axios, { AxiosResponse, InternalAxiosRequestConfig } from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5002";

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  function (config: InternalAxiosRequestConfig) {
    // const id_token = 'token token';
    const id_token = getCurrentUserToken();

    try {
      if (!!id_token) {
        config.headers["Authorization"] = `Bearer ${id_token}`;
      }
      return config;
    } catch (err) {
      console.log("error in axios", err);
    }

    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosInstance.interceptors.response.use(
  function (response: AxiosResponse) {
    return response?.data;
  },
  function (error) {
    const status = error?.response?.status;
    const errorMsg =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "An unexpected error occurred.";

    if (status === 401) {
      // If it's a protected route (not login) and token is expired/invalid, clear token
      if (typeof window !== "undefined" && !error?.config?.url?.includes("/api/auth/login")) {
        // Token might be invalid or expired
      }
    }

    return Promise.reject(errorMsg);
  }
);

export default axiosInstance;
