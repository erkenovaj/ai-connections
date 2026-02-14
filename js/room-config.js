/**
 * Room service configuration.
 * For GitHub Pages: create a Supabase project (free) at supabase.com,
 * then set values below or via script before game loads:
 *   window.__SUPABASE_URL__ = 'https://xxx.supabase.co';
 *   window.__SUPABASE_ANON_KEY__ = 'eyJ...';
 *
 * Airtable: Optional. When Export to Airtable is used, you can enter credentials
 * or set them here for the admin.
 */
const ROOM_CONFIG = {
    SUPABASE_URL: 'https://ypbgvpqjnuorwqwjloif.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable__hWZt2XYzP7-0ZtjWQEBxA_DDi_FyT8',
    AIRTABLE_BASE_ID: (typeof window !== 'undefined' && window.__AIRTABLE_BASE_ID__) || '',
    AIRTABLE_API_KEY: (typeof window !== 'undefined' && window.__AIRTABLE_API_KEY__) || '',
};

export function isRoomServiceAvailable() {
    return !!(ROOM_CONFIG.SUPABASE_URL && ROOM_CONFIG.SUPABASE_ANON_KEY);
}

export function isAirtableAvailable() {
    return !!(ROOM_CONFIG.AIRTABLE_BASE_ID && ROOM_CONFIG.AIRTABLE_API_KEY);
}

export default ROOM_CONFIG;
