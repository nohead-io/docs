// Copies each SDK's samples.json (one code sample per API operation, written
// by the SDK from the calls its contract test checks) to
// sdk-samples/<language>.json, from the SDK's main branch on GitHub.
// NOHEAD_<LANGUAGE>_DIR reads a local checkout instead.
//
//   npm run samples   # then openapi.json is regenerated
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { LANGUAGES } from "./languages.mjs"

for (const { file } of LANGUAGES) {
  const local = process.env[`NOHEAD_${file.toUpperCase()}_DIR`]
  const repository = `nohead-io/nohead-${file}`
  const text = local
    ? await readFile(join(local, "samples.json"), "utf8")
    : await fetch(`https://raw.githubusercontent.com/${repository}/main/samples.json`).then(
        (response) => {
          if (!response.ok) throw new Error(`${repository}: samples.json ${response.status}`)
          return response.text()
        }
      )
  const samples = JSON.parse(text)
  await writeFile(
    new URL(`../sdk-samples/${file}.json`, import.meta.url),
    JSON.stringify(samples, null, 2) + "\n"
  )
  console.log(`${file}: ${Object.keys(samples).length} samples`)
}
