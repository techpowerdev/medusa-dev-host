import { HttpTypes } from "@medusajs/types"
import { isDeliveryReady } from "./requires-shipping"

// Medusa gives a new cart in a single-country region a shipping address with
// only its country code, and no billing address. Such a cart has an address
// object but nothing to ship to, so check the fields the address form requires.
function isFilled(address?: HttpTypes.StoreCartAddress | null) {
  return !!(address?.first_name && address.address_1 && address.country_code)
}

// True when the address step is complete: a filled shipping address, a
// billing address and an email.
export function isAddressReady(cart?: HttpTypes.StoreCart | null) {
  return (
    isFilled(cart?.shipping_address) &&
    isFilled(cart?.billing_address) &&
    !!cart?.email
  )
}

// What still stops the cart from being placed, for telling the customer why
// the Place order button is disabled. Empty when nothing is missing.
export function missingForOrder(cart?: HttpTypes.StoreCart | null) {
  const missing: string[] = []

  if (!isAddressReady(cart)) {
    missing.push("address and email")
  }

  if (!isDeliveryReady(cart)) {
    missing.push("delivery method")
  }

  return missing
}
