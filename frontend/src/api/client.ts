import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
  AuthResponse,
  LicenseRequest,
  Project,
  Role,
  User,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'innovchain_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function unwrapError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ message?: string; error?: string }>;
    const message =
      e.response?.data?.message ??
      e.response?.data?.error ??
      e.message ??
      'Request failed';
    return new ApiError(message, e.response?.status);
  }
  return new ApiError('Unexpected error');
}

// ---- Auth ----

export interface RegisterInput {
  email: string;
  password: string;
  role: Role;
  name: string;
  walletAddress: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const { data } = await http.post<AuthResponse>('/auth/register', input);
      return data;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    try {
      const { data } = await http.post<AuthResponse>('/auth/login', input);
      return data;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async me(): Promise<{ user: User }> {
    try {
      const { data } = await http.get<{ user: User }>('/auth/me');
      return data;
    } catch (err) {
      throw unwrapError(err);
    }
  },
};

// ---- Projects ----

export interface UploadProjectInput {
  file: File;
  title: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private';
}

export interface ProjectListParams {
  tag?: string;
  q?: string;
}

export const projectsApi = {
  async list(params: ProjectListParams = {}): Promise<Project[]> {
    try {
      const { data } = await http.get<{ projects: Project[] }>('/projects', {
        params,
      });
      return data.projects;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async getById(id: string): Promise<Project> {
    try {
      const { data } = await http.get<{ project: Project }>(
        `/projects/${id}`,
      );
      return data.project;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async mine(): Promise<Project[]> {
    try {
      const { data } = await http.get<{ projects: Project[] }>(
        '/projects/mine',
      );
      return data.projects;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async upload(input: UploadProjectInput): Promise<Project> {
    try {
      const form = new FormData();
      form.append('file', input.file);
      form.append('title', input.title);
      form.append('description', input.description);
      input.tags.forEach((tag) => form.append('tags[]', tag));
      form.append('visibility', input.visibility);

      const { data } = await http.post<{ project: Project }>(
        '/projects',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data.project;
    } catch (err) {
      throw unwrapError(err);
    }
  },
};

// ---- License requests ----

export interface CreateLicenseRequestInput {
  durationMonths: number;
  commercialUse: boolean;
  priceEth: string;
}

export const licenseRequestsApi = {
  async create(
    projectId: string,
    input: CreateLicenseRequestInput,
  ): Promise<LicenseRequest> {
    try {
      const { data } = await http.post<{ licenseRequest: LicenseRequest }>(
        `/projects/${projectId}/license-requests`,
        input,
      );
      return data.licenseRequest;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async mine(): Promise<LicenseRequest[]> {
    try {
      const { data } = await http.get<{ licenseRequests: LicenseRequest[] }>(
        '/license-requests/mine',
      );
      return data.licenseRequests;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async getById(id: string): Promise<LicenseRequest> {
    try {
      const { data } = await http.get<{ licenseRequest: LicenseRequest }>(
        `/license-requests/${id}`,
      );
      return data.licenseRequest;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async accept(id: string): Promise<LicenseRequest> {
    try {
      const { data } = await http.post<{ licenseRequest: LicenseRequest }>(
        `/license-requests/${id}/accept`,
      );
      return data.licenseRequest;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async reject(id: string): Promise<LicenseRequest> {
    try {
      const { data } = await http.post<{ licenseRequest: LicenseRequest }>(
        `/license-requests/${id}/reject`,
      );
      return data.licenseRequest;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async fund(id: string): Promise<LicenseRequest> {
    try {
      const { data } = await http.post<{ licenseRequest: LicenseRequest }>(
        `/license-requests/${id}/fund`,
      );
      return data.licenseRequest;
    } catch (err) {
      throw unwrapError(err);
    }
  },

  async release(id: string): Promise<LicenseRequest> {
    try {
      const { data } = await http.post<{ licenseRequest: LicenseRequest }>(
        `/license-requests/${id}/release`,
      );
      return data.licenseRequest;
    } catch (err) {
      throw unwrapError(err);
    }
  },
};

export default http;
