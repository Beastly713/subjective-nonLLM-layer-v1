ALTER TABLE "regional_routing_profile_versions" ADD CONSTRAINT "regional_routing_profile_versions_region_key_check" CHECK (
  "country_code" ~ '^[A-Z]{2}$'
  AND ("region_code" IS NULL OR "region_code" ~ '^[A-Z0-9_-]{1,64}$')
  AND "region_key" = "country_code" || ':' || COALESCE("region_code", '*')
);
