// Copies the CLI's commands.json (every command with its arguments and
// options, written by the CLI from its own definitions) to cli/commands.json,
// from the CLI's main branch on GitHub. NOHEAD_CLI_DIR reads a local checkout
// instead.
//
//   npm run samples   # then the CLI reference pages are regenerated
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const repository = "nohead-io/nohead-cli"
const local = process.env.NOHEAD_CLI_DIR
const text = local
  ? await readFile(join(local, "commands.json"), "utf8")
  : await fetch(`https://raw.githubusercontent.com/${repository}/main/commands.json`).then(
      (response) => {
        if (!response.ok) throw new Error(`${repository}: commands.json ${response.status}`)
        return response.text()
      }
    )
const program = JSON.parse(text)
await writeFile(
  new URL("../cli/commands.json", import.meta.url),
  JSON.stringify(program, null, 2) + "\n"
)
console.log(`cli: ${program.commands.length} commands`)
