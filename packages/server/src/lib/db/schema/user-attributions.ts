import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Immutable first-touch acquisition data. One row is allowed per user. */
export const userAttributions = pgTable(
  "user_attributions",
  {
    userId: text("user_id")
      .primaryKey()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstSourceHost: text("first_source_host"),
    firstReferrerHost: text("first_referrer_host"),
    firstLandingPath: text("first_landing_path"),
    firstUtmSource: text("first_utm_source"),
    firstUtmMedium: text("first_utm_medium"),
    firstUtmCampaign: text("first_utm_campaign"),
    firstUtmTerm: text("first_utm_term"),
    firstUtmContent: text("first_utm_content"),
    countryCode: text("country_code"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("user_attributions_country").on(table.countryCode)],
);
