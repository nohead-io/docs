# Nohead docs

The guides and API reference at [docs.nohead.io](https://docs.nohead.io), hosted by [Mintlify](https://mintlify.com) on its free plan. Corrections and suggestions are welcome as issues or pull requests.

- `docs.json`: site settings and navigation. New pages must be listed here. The API reference's endpoint groups in it are generated from `openapi.json`'s tags, with an icon each (`scripts/api-navigation.mjs`, which fails if a tag has no icon): don't edit them.
- `*.mdx`, `guides/*.mdx`: the guides. Plain Markdown where possible; use Mintlify components (`<CodeGroup>`, `<Steps>`, `<Card>`, `<GitHub.Repo>`) sparingly, so moving to another tool stays cheap. Callouts (`<Warning>`, `<Note>`, `<Tip>`) are for what can't be undone or would cost a reader if missed, not for emphasis.
- `openapi.json`: the API reference source, generated (do not edit). It is the API's published contract plus code samples from the SDKs.
- `sdk-samples/`: each SDK's `samples.json`, one sample per operation.
- `icons/`, `style.css`: the SDK pages' language logos ([Simple Icons](https://simpleicons.org), CC0), drawn in the sidebar's icon colours. A new icon file needs its line in `style.css`.
- `cli/`: the CLI's overview (written here) and command reference (`cli/commands/`, generated from `cli/commands.json`, the CLI's own description of its commands: do not edit).

```bash
npm run dev          # preview at http://localhost:3333
npm run check        # mint validate + broken-links, as CI runs it
npm run check:code   # the guides' code blocks against the published SDKs (needs Ruby and Python 3.11+: set PYTHON, e.g. PYTHON=python3.11, if python3 is older)
```

The Mintlify CLI is pinned in `package.json` and run with `npx`, with telemetry off. Dependabot doesn't see it, so bump the version by hand now and then.

## How the reference stays current

- **The contract:** when it changes, the Nohead API repository copies it over `openapi.json`, runs `npm run generate` and pushes the result to `contract/update`. `contract-pr.yml` then opens the pull request.
- **The code samples:** each SDK writes `samples.json` from the calls its contract test checks, so a sample always calls a real method correctly.
  - `npm run samples` fetches them from the SDKs' `main` branches (`NOHEAD_<LANGUAGE>_DIR` reads a local checkout instead) and regenerates `openapi.json`.
  - `samples.yml` does this every day and opens a pull request when anything changed.
- **The CLI reference:** the CLI writes `commands.json` from its command definitions. `npm run samples` also fetches it (`NOHEAD_CLI_DIR` reads a local checkout) into `cli/commands.json`, and `npm run generate` writes a page per command group from it (`scripts/cli-reference.mjs`, which fails if a new command has no page or a page isn't in `docs.json`).
- **Code samples for a new SDK:**
  - add it to `scripts/languages.mjs`
  - add its language to `api.examples.languages` in `docs.json`: Mintlify only shows samples in the languages listed there

## Writing guides

- Describe only shipped behavior, and check names against the web app (button and field labels) and the API reference.
- Examples call `https://api.nohead.io` with `$NOHEAD_API_KEY`.
- Link to the reference instead of repeating every parameter.

## Deploying

Mintlify deploys `main` through its GitHub app, set up in the Mintlify dashboard for this repository. The free plan has no preview deployments: preview locally.
