import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { isAddressReady } from "@lib/util/checkout-ready"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string }>
}) {
  // Uncached: after an address is saved, the cached cart can still be the one
  // without it, and the check below would send the customer back.
  const cart = await retrieveCart(undefined, undefined, true)

  if (!cart) {
    return notFound()
  }

  // Later steps can't be used until the address is filled in, for example a
  // new cart whose address Medusa created with only the country code. Checked
  // here rather than in the client, which still holds the cart from before a
  // save.
  const { step } = await searchParams
  if (step !== "address" && !isAddressReady(cart)) {
    const { countryCode } = await params
    redirect(`/${countryCode}/checkout?step=address`)
  }

  const customer = await retrieveCustomer()

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
