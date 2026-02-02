const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const getApiBaseUrl = () => API_BASE_URL;

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...options, headers });
};

export const resolveImageUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

export const uploadImage = async (file: File, token?: string | null) => {
  const formData = new FormData();
  formData.append("image", file);

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const resp = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    body: formData,
    headers,
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(error.error || "Upload failed");
  }

  return resp.json() as Promise<{ url: string }>;
};
