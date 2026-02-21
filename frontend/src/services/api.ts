const API_BASE_URL = 'http://localhost:8006';

// Types for SSE events
export interface SSEProduct {
    index: number;
    product: {
        name: string;
        price: string;
        mrp: string;
        discount: string;
        weight: string;
        platform: string;
        store_name: string;
        product_image: string;
        product_url: string;
        ingredients?: string;
        fssai_number?: string;
        manufacturer_name?: string;
        manufacturer_address?: string;
        expiry_date?: string;
    };
    compliance: any | null;
    status: string;
}

export interface SSECallbacks {
    onStatus?: (message: string, phase: string) => void;
    onProductsFound?: (products: SSEProduct[], phase1Time: number) => void;
    onProductEvaluating?: (index: number, productName: string, step: string) => void;
    onProductStep?: (index: number, step: string, message: string) => void;
    onProductEvaluated?: (data: {
        index: number;
        product: any;
        compliance: any;
        ai_analysis: any;
        time: number;
    }) => void;
    onProductError?: (index: number, productName: string, error: string) => void;
    onComplete?: (total: number, time: number) => void;
    onError?: (message: string) => void;
}

export function evaluateProductStream(query: string, callbacks: SSECallbacks): () => void {
    const url = `${API_BASE_URL}/evaluate/stream?product_name=${encodeURIComponent(query)}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('status', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onStatus?.(data.message, data.phase);
    });

    eventSource.addEventListener('products_found', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onProductsFound?.(data.products, data.phase1_time);
    });

    eventSource.addEventListener('product_evaluating', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onProductEvaluating?.(data.index, data.product_name, data.step);
    });

    eventSource.addEventListener('product_step', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onProductStep?.(data.index, data.step, data.message);
    });

    eventSource.addEventListener('product_evaluated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onProductEvaluated?.(data);
    });

    eventSource.addEventListener('product_error', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onProductError?.(data.index, data.product_name, data.error);
    });

    eventSource.addEventListener('complete', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        callbacks.onComplete?.(data.total, data.time);
        eventSource.close();
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
        try {
            const data = JSON.parse((e as any).data);
            callbacks.onError?.(data.message);
        } catch {
            // Connection error
            callbacks.onError?.('Connection lost. Please try again.');
        }
        eventSource.close();
    });

    // Return cleanup function
    return () => {
        eventSource.close();
    };
}

// Keep legacy endpoint for backwards compatibility
export async function evaluateProduct(query: string) {
    const response = await fetch(`${API_BASE_URL}/evaluate?product_name=${encodeURIComponent(query)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to evaluate product');
    }

    return response.json();
}

export async function getProductDetails(productUrl: string, platform: string) {
    const params = new URLSearchParams({ product_url: productUrl, platform });
    const response = await fetch(`${API_BASE_URL}/product/details?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch product details');
    }

    return response.json();
}

export async function getDashboardStats() {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`);

    if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
    }

    return response.json();
}

export async function getRecentScans(limit: number = 10) {
    const response = await fetch(`${API_BASE_URL}/dashboard/recent-scans?limit=${limit}`);

    if (!response.ok) {
        throw new Error('Failed to fetch recent scans');
    }

    return response.json();
}

export async function getTrendData(days: number = 7) {
    const response = await fetch(`${API_BASE_URL}/dashboard/trends?days=${days}`);

    if (!response.ok) {
        throw new Error('Failed to fetch trend data');
    }

    return response.json();
}

export async function getLiveDashboardData() {
    const response = await fetch(`${API_BASE_URL}/dashboard/live-data`);

    if (!response.ok) {
        throw new Error('Failed to fetch live dashboard data');
    }

    return response.json();
}

export async function getEvaluatedProducts() {
    const response = await fetch(`${API_BASE_URL}/dashboard/evaluated-products`);

    if (!response.ok) {
        throw new Error('Failed to fetch evaluated products');
    }

    return response.json();
}
