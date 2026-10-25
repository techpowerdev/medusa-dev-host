import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  // Emails go to Mailpit (docker compose in this folder), as the plugin's README configures them.
  modules: [
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@perseidesjs/notification-nodemailer/providers/nodemailer",
            id: "nodemailer",
            options: {
              channels: ["email"],
              from: process.env.SMTP_FROM,
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT),
              secure: process.env.SMTP_PORT === "465",
              auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
            },
          },
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            options: { name: "Local Notification Provider", channels: ["feed"] },
          },
        ],
      },
    },
  ],
  plugins: [
    {
      resolve: "@khumkha/medusa-voucher",
      options: {
        encryptionKey: process.env.VOUCHER_ENCRYPTION_KEY,
        timezone: "Asia/Bangkok",
        // The "Email delivery" shipping option records the fulfillment of Voucher lines.
        delivery: { fulfillment: { shippingOptionId: process.env.VOUCHER_SHIPPING_OPTION_ID } },
      },
    },
  ],
})
