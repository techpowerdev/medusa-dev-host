import { ExecArgs } from "@medusajs/framework/types"
import { retryVoucherDeliveriesWorkflow } from "@khumkha/medusa-voucher/workflows"

// Runs what the retry-voucher-deliveries job runs every 15 minutes, without waiting for it:
// npx medusa exec ./src/scripts/retry-voucher-deliveries.ts
export default async function retryVoucherDeliveries({ container }: ExecArgs) {
  const { result } = await retryVoucherDeliveriesWorkflow(container).run({ input: {} })

  container.resolve("logger").info(`Retry: ${JSON.stringify(result)}`)
}
