import { getCookie } from "cookies-next";

export const getCurrentUserToken = (): string | null =>
  getCookie("token") as string | null;
export const getCurrentUserRole = (): string | null =>
  getCookie("role") as string | null;

type JwtParts = {
  payload: {
    fullName: string;
    email: string;
  };
};

export function getDecodedToken(): JwtParts | null {
  const token = getCurrentUserToken();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");

  const toBytes = (s: string) => {
    let b = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const bin =
      typeof window !== "undefined"
        ? atob(b)
        : Buffer.from(b, "base64").toString("binary");
    return new Uint8Array([...bin].map((ch) => ch.charCodeAt(0)));
  };

  const payload = JSON.parse(new TextDecoder().decode(toBytes(parts[1])));
  return {
    payload: {
      fullName: payload.fullName,
      email: payload.email,
    },
  };
}
