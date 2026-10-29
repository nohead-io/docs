// Writes the API reference's endpoint groups into docs.json from openapi.json:
// a group per tag, in the contract's order, with the tag's icon below and its
// endpoints in the contract's order. Mintlify builds the same groups itself
// from the tags, but only listed groups can have icons. A tag without an icon,
// or an icon without a tag, fails the run, so a new tag can't go missing.
//
//   npm run generate
import { readFileSync, writeFileSync } from "node:fs"

// Each tag's icon (Lucide), matching the CLI reference's pages where they meet.
export const ICONS = {
  records: "file-text",
  publishing: "globe",
  revisions: "file-clock",
  drafts: "file-pen",
  collections: "database",
  "schema-changes": "file-diff",
  fields: "list",
  migrations: "arrow-right-left",
  assets: "image",
  search: "search",
  webhooks: "webhook",
  deliveries: "send",
  audit: "history",
  system: "activity",
}

const METHODS = ["get", "put", "post", "patch", "delete"]

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
const contract = read("../openapi.json")
const docs = read("../docs.json")

const tags = contract.tags.map((tag) => tag.name)
const unlisted = tags.filter((tag) => !ICONS[tag])
const unknown = Object.keys(ICONS).filter((tag) => !tags.includes(tag))
if (unlisted.length || unknown.length) {
  throw new Error(`api-navigation.mjs ICONS: add ${unlisted.join(", ") || "-"}; remove ${unknown.join(", ") || "-"}`)
}

const endpoints = new Map(tags.map((tag) => [tag, []]))
for (const [path, item] of Object.entries(contract.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (!METHODS.includes(method) || !operation.operationId || operation["x-hidden"]) continue
    const tag = operation.tags?.[0]
    if (!endpoints.has(tag)) throw new Error(`${method.toUpperCase()} ${path}: tag ${tag} isn't in openapi.json's tags`)
    endpoints.get(tag).push(`${method.toUpperCase()} ${path}`)
  }
}

const groups = contract.tags
  .filter((tag) => endpoints.get(tag.name).length)
  .map((tag) => ({ group: tag["x-group"] ?? tag.name, icon: ICONS[tag.name], pages: endpoints.get(tag.name) }))

const reference = docs.navigation.tabs.find((tab) => tab.tab === "API reference")
const section = reference?.groups.find((group) => group.openapi)
if (!section) throw new Error('docs.json: no group with "openapi" in the "API reference" tab')
section.pages = groups
writeFileSync(new URL("../docs.json", import.meta.url), JSON.stringify(docs, null, 2) + "\n")
console.log(`docs.json: ${groups.length} API reference groups, ${groups.reduce((n, g) => n + g.pages.length, 0)} endpoints`)
