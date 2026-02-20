const API_BASE_URL = 'http://localhost:8006';

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
