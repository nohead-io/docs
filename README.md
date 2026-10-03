# Nohead docs

The guides and API reference at [docs.nohead.io](https://docs.nohead.io), hosted by [Mintlify](https://mintlify.com) on its free plan. Corrections and suggestions are welcome as issues or pull requests.

- `docs.json`: site settings and navigation. New pages must be listed here.
- `*.mdx`, `guides/*.mdx`: the guides. Plain Markdown where possible; use Mintlify components (`<Note>`, `<Steps>`, `<CodeGroup>`) sparingly, so moving to another tool stays cheap.
- `openapi.json`: the API reference source, generated (do not edit). It is the API's published contract plus code samples from the SDKs.
- `sdk-samples/`: each SDK's `samples.json`, one sample per operation.

```bash
npm run dev     # preview at http://localhost:3333
npm run check   # mint validate + broken-links, as CI runs it
```

The Mintlify CLI is pinned in `package.json` and run with `npx`, with telemetry off. Dependabot doesn't see it, so bump the version by hand now and then.

## How the reference stays current

- **The contract:** when it changes, the Nohead API repository copies it over `openapi.json`, runs `npm run generate` and pushes the result to `contract/update`. `contract-pr.yml` then opens the pull request.
- **The code samples:** each SDK writes `samples.json` from the calls its contract test checks, so a sample always calls a real method correctly.
  - `npm run samples` fetches them from the SDKs' `main` branches (`NOHEAD_<LANGUAGE>_DIR` reads a local checkout instead) and regenerates `openapi.json`.
  - `samples.yml` does this every day and opens a pull request when anything changed.
- **Code samples for a new SDK:**
  - add it to `scripts/languages.mjs`
  - add its language to `api.examples.languages` in `docs.json`: Mintlify only shows samples in the languages listed there

## Writing guides

- Describe only shipped behavior, and check names against the web app (button and field labels) and the API reference.
- Examples use `$NOHEAD_API_URL` and `$NOHEAD_API_KEY`.
- Link to the reference instead of repeating every parameter.

## Deploying

Mintlify deploys `main` through its GitHub app, set up in the Mintlify dashboard for this repository. The free plan has no preview deployments: preview locally.
