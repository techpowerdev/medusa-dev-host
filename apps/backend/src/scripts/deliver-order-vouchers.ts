import { ExecArgs } from "@medusajs/framework/types"
import { deliverOrderVouchersWorkflow } from "@khumkha/medusa-voucher/workflows"

// Sends an order's Vouchers until the plugin starts delivery on its own:
// npx medusa exec ./src/scripts/deliver-order-vouchers.ts <order_id>
export default async function deliverOrderVouchers({ container, args }: ExecArgs) {
  const [orderId] = args
  const { result } = await deliverOrderVouchersWorkflow(container).run({ input: { order_id: orderId } })

  container.resolve("logger").info(`Delivery: ${JSON.stringify(result)}`)
}
