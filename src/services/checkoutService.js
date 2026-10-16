import { supabase } from './api/supabaseClient';
async function rpc(name, args, legacyValue) {
  const { data, error } = await supabase.rpc(name, args);
  if (error?.code === 'PGRST202' && legacyValue !== undefined) return legacyValue;
  if (error) throw new Error(error.message || 'Checkout settings unavailable. Retry before ordering.');
  return data;
}
export const checkoutService = {
  gateways: () => rpc('get_payment_gateways', {}, [{ provider: 'payfast', enabled: true, ready: true, maintenance: false, notice: '' }]),
  deliverySettings: () => rpc('get_delivery_settings', {}, { enabled: false }),
  quote: (location, items, guestContact) => rpc('quote_delivery', {
    p_destination: { ...location, capturedAt: new Date(location.capturedAt).toISOString() },
    p_items: items.map(item => ({ mealId: item.mealId, qty: item.qty })),
    p_guest_contact: guestContact || null,
  }),
  saveGateway: (provider, enabled, maintenance, notice) => rpc('admin_update_payment_gateway', { p_provider: provider, p_enabled: enabled, p_maintenance: maintenance, p_notice: notice }),
  saveDelivery: value => rpc('admin_update_delivery_settings', {
    p_enabled: value.enabled, p_latitude: Number(value.latitude), p_longitude: Number(value.longitude),
    p_free_radius_km: Number(value.free_radius_km), p_max_radius_km: Number(value.max_radius_km), p_paid_fee: Number(value.paid_fee),
  }),
  saveHub: (settings, reason) => rpc('admin_save_delivery_hub', { p_settings: settings, p_reason: reason }),
  origin: vendorId => rpc('get_vendor_delivery_origin', { p_vendor_id: vendorId }),
  originQueue: () => rpc('admin_delivery_origin_queue', {}),
  requestOrigin: (vendorId, value) => rpc('request_vendor_delivery_origin', {
    p_vendor_id: vendorId, p_address: value.address, p_latitude: Number(value.latitude), p_longitude: Number(value.longitude),
  }),
  decideOrigin: (vendorId, revision, action, reason, radius) => rpc('admin_decide_delivery_origin', {
    p_vendor_id: vendorId, p_revision: revision, p_action: action, p_reason: reason,
    p_radius_km: radius === '' || radius == null ? null : Number(radius),
  }),
};
