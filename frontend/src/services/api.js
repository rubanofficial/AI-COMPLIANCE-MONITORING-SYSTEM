const API_BASE_URL = 'http://localhost:8006';

export function evaluateProductStream(query, callbacks) {
    const url = `${API_BASE_URL}/evaluate/stream?product_name=${encodeURIComponent(query)}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onStatus?.(data.message, data.phase);
    });

    eventSource.addEventListener('products_found', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onProductsFound?.(data.products, data.phase1_time);
    });

    eventSource.addEventListener('product_evaluating', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onProductEvaluating?.(data.index, data.product_name, data.step);
    });

    eventSource.addEventListener('product_step', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onProductStep?.(data.index, data.step, data.message);
    });

    eventSource.addEventListener('product_evaluated', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onProductEvaluated?.(data);
    });

    eventSource.addEventListener('product_error', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onProductError?.(data.index, data.product_name, data.error);
    });

    eventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        callbacks.onComplete?.(data.total, data.time);
        eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
        try {
            const data = JSON.parse(e.data);
            callbacks.onError?.(data.message);
        } catch {
            callbacks.onError?.('Connection lost. Please try again.');
        }
        eventSource.close();
    });

    return () => {
        eventSource.close();
    };
}

// Keep legacy endpoint for backwards compatibility
export async function evaluateProduct(query) {
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

export async function getProductDetails(productUrl, platform) {
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

export async function getRecentScans(limit = 10) {
    const response = await fetch(`${API_BASE_URL}/dashboard/recent-scans?limit=${limit}`);

    if (!response.ok) {
        throw new Error('Failed to fetch recent scans');
    }

    return response.json();
}

export async function getTrendData(days = 7) {
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
