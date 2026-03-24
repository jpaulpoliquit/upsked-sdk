# Links to the main UPSked application

This interop repo is developed alongside the UPSked monorepo. After you publish **this** repo on GitHub, these paths refer to the **main** UPSked repository (adjust org/repo names).

| Topic                                      | Path in main UPSked repo                        |
| ------------------------------------------ | ----------------------------------------------- |
| Runtime manifest (browser)                 | `apps/web/lib/catalog-release-manifest.ts`      |
| Partner / ingest Zod contract              | `apps/web/lib/catalog-ingest-contract.ts`       |
| Manifest resolution (adapters)             | `apps/web/lib/catalog-manifest-registry.ts`     |
| Catalog client (IndexedDB, manifest fetch) | `apps/web/lib/catalog-client.ts`                |
| `POST /api/getCatalogManifest`             | `apps/web/app/api/getCatalogManifest/route.ts`  |
| Multi-university architecture doc          | `docs/multi-university-catalog-architecture.md` |
| Interop strategy (monolith context)        | `docs/interop-repo-strategy.md`                 |

**Contract alignment:** Partner bundles validated here should remain compatible with `canonicalCatalogReleaseManifestSchema` in `catalog-ingest-contract.ts` when UPSked adds ingest APIs.
