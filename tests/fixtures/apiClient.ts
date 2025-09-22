interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  baseURL?: string;
}

interface ResponseData<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public response?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private interceptors: {
    request: ((config: RequestConfig) => RequestConfig | Promise<RequestConfig>)[];
    response: ((response: ResponseData) => ResponseData | Promise<ResponseData>)[];
  };

  constructor(baseURL: string = '', defaultHeaders: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
    this.interceptors = {
      request: [],
      response: [],
    };
  }

  // Interceptor methods
  addRequestInterceptor(
    interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>,
  ) {
    this.interceptors.request.push(interceptor);
  }

  addResponseInterceptor(
    interceptor: (response: ResponseData) => ResponseData | Promise<ResponseData>,
  ) {
    this.interceptors.response.push(interceptor);
  }

  // Main request method
  async request<T = any>(url: string, config: RequestConfig = {}): Promise<ResponseData<T>> {
    let requestConfig: RequestConfig = {
      method: 'GET',
      timeout: 10000,
      retries: 0,
      ...config,
      headers: {
        ...this.defaultHeaders,
        ...config.headers,
      },
    };

    // Apply request interceptors
    for (const interceptor of this.interceptors.request) {
      requestConfig = await interceptor(requestConfig);
    }

    const fullUrl = this.buildUrl(url, requestConfig.baseURL);

    let lastError: Error;
    const maxAttempts = (requestConfig.retries || 0) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.executeRequest<T>(fullUrl, requestConfig);

        // Apply response interceptors
        let finalResponse = response;
        for (const interceptor of this.interceptors.response) {
          finalResponse = await interceptor(finalResponse);
        }

        return finalResponse;
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError!;
  }

  private async executeRequest<T>(url: string, config: RequestConfig): Promise<ResponseData<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const fetchOptions: RequestInit = {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as any;
      }

      const result: ResponseData<T> = {
        data,
        status: response.status,
        headers: responseHeaders,
        success: response.ok,
      };

      if (!response.ok) {
        throw new ApiError(response.status, `Request failed: ${response.statusText}`, result);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(408, 'Request timeout');
      }

      throw new ApiError(0, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private buildUrl(url: string, baseURL?: string): string {
    const base = baseURL || this.baseURL;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (!base) {
      return url;
    }

    return `${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get<T = any>(
    url: string,
    config?: Omit<RequestConfig, 'method'>,
  ): Promise<ResponseData<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<ResponseData<T>> {
    return this.request<T>(url, { ...config, method: 'POST', body: data });
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<ResponseData<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', body: data });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<ResponseData<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', body: data });
  }

  async delete<T = any>(
    url: string,
    config?: Omit<RequestConfig, 'method'>,
  ): Promise<ResponseData<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }
}

// Singleton instance with common configuration
export const apiClient = new ApiClient(process.env.API_BASE_URL || 'https://api.example.com');

// Add common interceptors
apiClient.addRequestInterceptor((config) => {
  // Add auth token if available
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

apiClient.addResponseInterceptor((response) => {
  // Log errors for debugging
  if (!response.success) {
    console.error('API Error:', response);
  }
  return response;
});

// Specialized API service classes
export class UserApiService {
  constructor(private client: ApiClient = apiClient) {}

  async getCurrentUser() {
    return this.client.get('/user/me');
  }

  async updateUser(userId: string, data: Partial<any>) {
    return this.client.put(`/users/${userId}`, data);
  }

  async getUserList(page: number = 1, limit: number = 20) {
    return this.client.get(`/users?page=${page}&limit=${limit}`);
  }

  async deleteUser(userId: string) {
    return this.client.delete(`/users/${userId}`);
  }
}

export class ProductApiService {
  constructor(private client: ApiClient = apiClient) {}

  async getProducts(filters: { category?: string; priceRange?: [number, number] } = {}) {
    const params = new URLSearchParams();

    if (filters.category) {
      params.append('category', filters.category);
    }

    if (filters.priceRange) {
      params.append('minPrice', filters.priceRange[0].toString());
      params.append('maxPrice', filters.priceRange[1].toString());
    }

    return this.client.get(`/products?${params.toString()}`);
  }

  async getProduct(productId: string) {
    return this.client.get(`/products/${productId}`);
  }

  async createProduct(productData: any) {
    return this.client.post('/products', productData);
  }

  async updateProduct(productId: string, updates: Partial<any>) {
    return this.client.patch(`/products/${productId}`, updates);
  }
}

// Export instances
export const userApi = new UserApiService();
export const productApi = new ProductApiService();
