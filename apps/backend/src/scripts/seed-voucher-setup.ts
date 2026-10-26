import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createCustomersWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { createVoucherProductWorkflow } from "@khumkha/medusa-voucher/workflows"

// Recreates what @khumkha/medusa-voucher needs on a fresh database, after the
// initial seed. Re-running it skips anything that already exists:
// npx medusa exec ./src/scripts/seed-voucher-setup.ts
// Put the "Email delivery" id it logs in VOUCHER_SHIPPING_OPTION_ID.
export default async function seedVoucherSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const { data: [region] } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: "Thailand" },
  })
  const { data: [salesChannel] } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    filters: { name: "Default Sales Channel" },
  })
  const { data: [shippingProfile] } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { type: "default" },
  })
  if (!region || !salesChannel || !shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Run the initial data seed (npx medusa db:migrate) first."
    )
  }

  // ---- "Digital vouchers" stock location and "Email delivery" -------------

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { name: "Email delivery" },
  })
  let shippingOptionId = existingOptions[0]?.id as string | undefined

  if (!shippingOptionId) {
    const { result: [stockLocation] } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Digital vouchers",
            address: { city: "Bangkok", country_code: "TH", address_1: "" },
          },
        ],
      },
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })

    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Digital vouchers delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Thailand (digital vouchers)",
          geo_zones: [{ country_code: "th", type: "country" }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })

    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })

    const { result: [shippingOption] } = await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Email delivery",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Email",
            description: "Vouchers are emailed once they are allocated.",
            code: "email",
          },
          prices: [
            { currency_code: "thb", amount: 0 },
            { region_id: region.id, amount: 0 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    shippingOptionId = shippingOption.id
    logger.info("Created \"Digital vouchers\" and \"Email delivery\".")
  }

  // ---- "Central Gift Voucher" with a 500 THB Voucher product ----------------

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { handle: "central-gift-voucher" },
  })

  if (!existingProducts.length) {
    const { result: [product] } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Central Gift Voucher",
            handle: "central-gift-voucher",
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Face value", values: ["500 THB"] }],
            variants: [
              {
                title: "500 THB",
                manage_inventory: false,
                options: { "Face value": "500 THB" },
                prices: [{ amount: 500, currency_code: "thb" }],
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })

    const { result: voucherProduct } = await createVoucherProductWorkflow(container).run({
      input: {
        variant_id: product.variants[0].id,
        face_value: 500,
        currency_code: "thb",
      },
    })
    logger.info(`Created "Central Gift Voucher" (Voucher product ${voucherProduct.id}).`)
  }

  // ---- Test customer ------------------------------------------------------

  const { data: existingCustomers } = await query.graph({
    entity: "customer",
    fields: ["id"],
    filters: { email: "somchai@example.test" },
  })

  if (!existingCustomers.length) {
    await createCustomersWorkflow(container).run({
      input: { customersData: [{ email: "somchai@example.test", first_name: "Somchai" }] },
    })
    logger.info("Created test customer somchai@example.test.")
  }

  logger.info(`VOUCHER_SHIPPING_OPTION_ID=${shippingOptionId}`)
}
