import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const datasourceUrl =
  process.env.NODE_ENV === "development"
    ? process.env.DIRECT_URL ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;

export const prisma: PrismaClient =
  global.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    ...(datasourceUrl
      ? {
          datasources: {
            db: {
              url: datasourceUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
