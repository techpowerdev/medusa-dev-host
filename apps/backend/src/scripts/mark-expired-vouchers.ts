import { ExecArgs } from "@medusajs/framework/types"
import { markExpiredVouchersWorkflow } from "@khumkha/medusa-voucher/workflows"

// Marks the Available Vouchers past their Validity period as Expired without waiting for the job:
// npx medusa exec ./src/scripts/mark-expired-vouchers.ts
export default async function markExpiredVouchers({ container }: ExecArgs) {
  const { result } = await markExpiredVouchersWorkflow(container).run({ input: {} })

  container.resolve("logger").info(`Mark expired: ${JSON.stringify(result)}`)
}
