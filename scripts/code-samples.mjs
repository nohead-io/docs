// Adds the SDKs' code samples (sdk-samples/<language>.json) to each
// operation's x-codeSamples in openapi.json, replacing any already there.
// Mintlify shows them beside each endpoint, for the languages listed in
// docs.json under api.examples.languages.
//
//   npm run generate
//
// Runs after every contract update (the API repository copies the published
// contract over openapi.json) and after samples sync (npm run samples).
import { readFileSync, writeFileSync } from "node:fs"

import { LANGUAGES } from "./languages.mjs"

const METHODS = ["get", "put", "post", "patch", "delete"]

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
const contract = read("../openapi.json")
const samples = LANGUAGES.map(({ file, lang, label }) => ({
  lang,
  label,
  byOperation: read(`../sdk-samples/${file}.json`),
}))

const operations = new Set()
let count = 0
for (const item of Object.values(contract.paths)) {
  for (const method of METHODS) {
    const operation = item[method]
    if (!operation?.operationId) continue
    operations.add(operation.operationId)
    delete operation["x-codeSamples"]
    const found = samples.flatMap(({ lang, label, byOperation }) => {
      const source = byOperation[operation.operationId]
      return source ? [{ lang, label, source }] : []
    })
    if (found.length > 0) {
      operation["x-codeSamples"] = found
      count++
    }
  }
}

// Samples for operations the contract no longer has: the SDKs catch up after
// a contract change, and the next samples sync brings their new samples.
for (const { label, byOperation } of samples) {
  const unknown = Object.keys(byOperation).filter((id) => !operations.has(id))
  if (unknown.length > 0) {
    console.warn(`${label} samples for operations not in the contract: ${unknown.join(", ")}`)
  }
}

writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(contract, null, 2) + "\n")
console.log(`openapi.json: code samples on ${count} operations`)
