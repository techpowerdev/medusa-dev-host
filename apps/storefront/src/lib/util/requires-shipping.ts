import { HttpTypes } from "@medusajs/types"

// A cart needs a shipping method only when one of its items requires
// shipping. Items whose product has no shipping profile, such as Vouchers,
// don't, so a cart of only those skips the delivery step.
export default function requiresShipping(cart?: HttpTypes.StoreCart | null) {
  return !!cart?.items?.some((item) => item.requires_shipping)
}

// True when the cart has a shipping method or doesn't need one.
export function isDeliveryReady(cart?: HttpTypes.StoreCart | null) {
  return (cart?.shipping_methods?.length ?? 0) > 0 || !requiresShipping(cart)
}
