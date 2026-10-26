import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createCustomersWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createVoucherProductWorkflow } from "@khumkha/medusa-voucher/workflows"

// Recreates what @khumkha/medusa-voucher needs on a fresh database, after the
// initial seed. Re-running it skips anything that already exists and brings
// "Email delivery" and "Central Gift Voucher" back to the settings below:
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
  const { data: [defaultProfile] } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { type: "default" },
  })
  if (!region || !salesChannel || !defaultProfile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Run the initial data seed (npx medusa db:migrate) first."
    )
  }

  // ---- "Digital" shipping profile ------------------------------------------

  // "Email delivery" is the only option on it, so it never shows up for the
  // physical products in the default profile.
  const { data: existingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    filters: { name: "Digital" },
  })
  let digitalProfileId = existingProfiles[0]?.id as string | undefined

  if (!digitalProfileId) {
    const { result: [profile] } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Digital", type: "digital" }] },
    })
    digitalProfileId = profile.id
    logger.info("Created the \"Digital\" shipping profile.")
  }

  // ---- "Digital vouchers" stock location and "Email delivery" -------------

  // The plugin records Voucher fulfillments with "Email delivery"; customers
  // never choose it, so it is not enabled in the store.
  const emailDeliveryRules = {
    enabled_in_store: "false",
    is_return: "false",
  }

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "shipping_profile_id", "rules.id", "rules.attribute", "rules.value"],
    filters: { name: "Email delivery" },
  })
  const existingOption = existingOptions[0]
  let shippingOptionId = existingOption?.id as string | undefined

  if (existingOption) {
    const rules = (existingOption.rules ?? []).filter(
      (rule): rule is NonNullable<typeof rule> => Boolean(rule)
    )
    const outdated =
      existingOption.shipping_profile_id !== digitalProfileId ||
      Object.entries(emailDeliveryRules).some(
        ([attribute, value]) =>
          !rules.some(
            (rule) =>
              rule.attribute === attribute &&
              // Stored as JSON ("\"false\""); query may return it either way.
              String(rule.value).replace(/"/g, "") === value
          )
      )

    if (outdated) {
      await updateShippingOptionsWorkflow(container).run({
        input: [
          {
            id: existingOption.id,
            shipping_profile_id: digitalProfileId,
            rules: Object.entries(emailDeliveryRules).map(([attribute, value]) => {
              const current = rules.find((rule) => rule.attribute === attribute)
              return current
                ? { id: current.id, attribute, operator: "eq" as const, value }
                : { attribute, operator: "eq" as const, value }
            }),
          },
        ],
      })
      logger.info("Moved \"Email delivery\" to \"Digital\" and hid it from the store.")
    }
  }

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
          shipping_profile_id: digitalProfileId,
          type: {
            label: "Email",
            description: "Vouchers are emailed once they are allocated.",
            code: "email",
          },
          prices: [
            { currency_code: "thb", amount: 0 },
            { region_id: region.id, amount: 0 },
          ],
          rules: Object.entries(emailDeliveryRules).map(([attribute, value]) => ({
            attribute,
            operator: "eq" as const,
            value,
          })),
        },
      ],
    })
    shippingOptionId = shippingOption.id
    logger.info("Created \"Digital vouchers\" and \"Email delivery\".")
  }

  // ---- "Central Gift Voucher" with a 500 THB Voucher product ----------------

  // As the plugin recommends: no shipping profile and inventory management
  // off, so its line items don't require shipping and a cart of only Vouchers
  // completes without a shipping method.
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "shipping_profile.id", "variants.id", "variants.manage_inventory"],
    filters: { handle: "central-gift-voucher" },
  })
  const existingProduct = existingProducts[0]

  if (existingProduct) {
    if (existingProduct.shipping_profile?.id) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: existingProduct.id }, update: { shipping_profile_id: null } },
      })
      logger.info("Removed the shipping profile from \"Central Gift Voucher\".")
    }

    const managed = (existingProduct.variants ?? [])
      .filter((variant) => variant?.manage_inventory)
      .map((variant) => variant!.id)
    if (managed.length) {
      await updateProductVariantsWorkflow(container).run({
        input: { selector: { id: managed }, update: { manage_inventory: false } },
      })
      logger.info("Turned off inventory management for \"Central Gift Voucher\".")
    }
  } else {
    const { result: [product] } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Central Gift Voucher",
            handle: "central-gift-voucher",
            status: ProductStatus.PUBLISHED,
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
