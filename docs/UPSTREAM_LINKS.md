# Links to the main Upsked application

**Tenancy:** The main app serves many universities from shared infrastructure; connectors and bundles remain **per-tenant**.

**If you are only building a connector**, you can ignore this file until you need to line up field names with the live app or ingest contract.

**If you are aligning contracts** between this SDK and the product monorepo, the table below lists where related code lives in the **main Upsked** repository (paths assume the standard monorepo layout; adjust org/repo names when you browse GitHub).

| Topic                                      | Path in main Upsked repo                        |
| ------------------------------------------ | ----------------------------------------------- |
| Runtime manifest (browser)                 | `apps/web/lib/catalog-release-manifest.ts`      |
| Partner / ingest Zod contract              | `apps/web/lib/catalog-ingest-contract.ts`       |
| Manifest resolution (adapters)             | `apps/web/lib/catalog-manifest-registry.ts`     |
| Catalog client (IndexedDB, manifest fetch) | `apps/web/lib/catalog-client.ts`                |
| `POST /api/getCatalogManifest`             | `apps/web/app/api/getCatalogManifest/route.ts`  |
| Multi-university architecture doc          | `docs/multi-university-catalog-architecture.md` |
| Interop strategy (monolith context)        | `docs/interop-repo-strategy.md`                 |

**Contract alignment:** Partner bundles validated in this SDK should stay compatible with `canonicalCatalogReleaseManifestSchema` in `catalog-ingest-contract.ts` when Upsked turns on stricter ingest validation.
