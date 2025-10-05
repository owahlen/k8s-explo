import { defineConfig } from "drizzle-kit";

/**
 * This is used at build-time to run the commands:
 * npx drizzle-kit generate
 * npx drizzle-kit push
 * npx drizzle-kit migrate
 */
export default defineConfig({
    schema: "./src/db/schema.ts", // where your pgTable definitions live
    out: "./drizzle",             // folder where migrations are generated
    dialect: "postgresql",        // database driver
    dbCredentials: {
        url: process.env.POSTGRES_URL!,
    },
});
