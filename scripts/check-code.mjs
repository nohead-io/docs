// Checks the code blocks in the guides (quickstart.mdx, guides/, sdks/ and
// adapters/) against the published SDKs, so an example never calls what an
// SDK doesn't have: TypeScript blocks are type-checked with @nohead/sdk
// (tsc), Python blocks with nohead (pyright), and Ruby blocks are
// syntax-checked (ruby -c). The CLI's lines in shell blocks (`nohead …`, in
// those pages, index.mdx and cli/overview.mdx) must name its commands and
// their options, as cli/commands.json lists them. Each block stands alone; the names the guides
// take as given (`nohead`, `id`…) are declared in a prelude, and Astro's
// modules as `any`, so an Astro example checks the SDK's calls without
// installing Astro.
//
//   npm run check:code   # needs Python 3.11+ (PYTHON, default python3) and Ruby
//
// Each block is a file named after its guide and the line of its opening
// fence: an error at line L of `sdks.mdx-71.ts` is at line 71 + L of
// guides/sdks.mdx.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

const FILES = [
  "quickstart.mdx",
  ...["guides", "sdks", "adapters"].flatMap((folder) =>
    readdirSync(folder)
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => `${folder}/${file}`)
  ),
]
const EXTENSIONS = { ts: "ts", typescript: "ts", python: "py", ruby: "rb" }

// What the examples take as given, by language.
const PRELUDES = {
  "globals.d.ts": `
declare const nohead: import("@nohead/sdk").Nohead
declare const id: string
declare const title: string
declare const data: { [apiKey: string]: unknown }
declare const row: { id: string }
declare module "astro:content" {
  export const defineCollection: any
  export const reference: any
}
declare module "astro/zod" {
  export const z: any
}
interface ImportMeta {
  env: { [name: string]: string | undefined }
}
`,
  "prelude.py": `
from typing import Any

from nohead import Nohead

nohead = Nohead()
record_id = ""
title = ""
data: dict[str, Any] = {}
row: Any = None
request: Any = None
`,
}

// The CLI: each `nohead …` (or `npx nohead …`) in a shell block names a
// command the CLI has, and only options that command or the CLI takes.
const cli = JSON.parse(readFileSync("cli/commands.json", "utf8"))
const SHELL = new Set(["bash", "sh", "shell"])
const optionsOf = (command) =>
  new Map(
    [...(command.options ?? []), { flags: "-h, --help" }].flatMap(({ flags }) =>
      flags.match(/--?[\w-]+/g).map((flag) => [flag, /[<[]/.test(flags)])
    )
  )
const cliErrors = []
let cliLines = 0
function checkCli(words, where) {
  cliLines++
  let command = cli
  const path = ["nohead"]
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (word.startsWith("#")) break
    if (/^--?[a-zA-Z]/.test(word)) {
      const [flag] = word.split("=")
      const takesValue = optionsOf(command).get(flag) ?? optionsOf(cli).get(flag)
      if (takesValue === undefined) cliErrors.push(`${where}: ${path.join(" ")} has no option ${flag}`)
      else if (takesValue && !word.includes("=")) i++
      continue
    }
    const sub = (command.commands ?? []).find((c) => c.name === word)
    if (sub) {
      command = sub
      path.push(word)
    } else if (command.commands?.length) {
      cliErrors.push(`${where}: no command "${word}" in ${path.join(" ")}`)
      return
    }
  }
}
for (const file of [...FILES, "index.mdx", "cli/overview.mdx"]) {
  const lines = readFileSync(file, "utf8").split("\n")
  let shell = false
  for (let n = 0; n < lines.length; n++) {
    const fence = lines[n].match(/^\s*```(\w*)/)
    if (fence) {
      shell = !shell && SHELL.has(fence[1])
      continue
    }
    if (!shell) continue
    let line = lines[n]
    while (line.endsWith("\\") && n + 1 < lines.length) line = line.slice(0, -1) + lines[++n]
    // Each command of a pipeline or list: `cat x | nohead …`, `… && nohead …`.
    for (const part of line.split(/\s(?:\|\||&&|\||;)\s/)) {
      const words = part.trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? []
      const start = words[0] === "npx" ? words.findIndex((w) => /^(nohead|@nohead\/cli)(@\S+)?$/.test(w)) : 0
      if (start >= 0 && words[start]?.match(/^(nohead|@nohead\/cli)(@\S+)?$/))
        checkCli(words.slice(start + 1), `${file}:${n + 1}`)
    }
  }
}
if (cliErrors.length) {
  console.error(cliErrors.join("\n"))
  process.exitCode = 1
} else console.log(`CLI: ${cliLines} commands match cli/commands.json`)

const dir = mkdtempSync(join(tmpdir(), "nohead-docs-code-"))
const written = { ts: [], py: [], rb: [] }
for (const file of FILES) {
  const lines = readFileSync(file, "utf8").split("\n")
  for (let start = 0; start < lines.length; start++) {
    const fence = lines[start].match(/^(\s*)```(\w+)/)
    if (!fence) continue
    const [, indent, language] = fence
    let end = start + 1
    while (!lines[end].startsWith(`${indent}\`\`\``)) end++
    const ext = EXTENSIONS[language]
    if (ext) {
      const code = lines.slice(start + 1, end).map((line) => line.slice(indent.length))
      // Python's prelude import takes a line, so its name is a line earlier.
      const name = `${basename(file)}-${start + (ext === "py" ? 0 : 1)}.${ext}`
      const source = {
        ts: [...code, "export {}"],
        py: ["from prelude import *  # noqa", ...code],
        rb: code,
      }[ext]
      writeFileSync(join(dir, name), source.join("\n") + "\n")
      written[ext].push(name)
    }
    start = end
  }
}
for (const [name, content] of Object.entries(PRELUDES)) {
  writeFileSync(join(dir, name), content.trimStart())
}
console.log(`${Object.values(written).flat().length} code blocks in ${dir}`)

// Runs a command in `dir`, showing its output. A failure fails the check at the
// end, so every language is checked.
let failed = false
function run(command, args, { quiet = false } = {}) {
  try {
    execFileSync(command, args, { cwd: dir, stdio: quiet ? "pipe" : "inherit" })
    return true
  } catch (error) {
    if (quiet) process.stderr.write(error.stderr)
    failed = true
    return false
  }
}

// TypeScript, with the published @nohead/sdk.
writeFileSync(join(dir, "package.json"), JSON.stringify({ private: true, type: "module" }))
writeFileSync(
  join(dir, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "es2022",
      module: "nodenext",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: ["node"],
    },
    include: ["*.ts"],
  })
)
run("npm", [
  "install",
  "--no-save",
  "--no-audit",
  "--no-fund",
  "--silent",
  "@nohead/sdk@latest",
  "@nohead/astro@latest",
  "typescript@6.0.3",
  "@types/node@26.6.4",
])
if (run("node_modules/.bin/tsc", ["-p", "."])) {
  console.log(`TypeScript: ${written.ts.length} blocks type-check`)
}

// Python, with the published nohead.
run(process.env.PYTHON ?? "python3", ["-m", "venv", "venv"])
run("venv/bin/pip", ["install", "--quiet", "--disable-pip-version-check", "nohead"])
if (run("npx", ["--yes", "pyright@1.1.414", "--pythonpath", "venv/bin/python", ...written.py])) {
  console.log(`Python: ${written.py.length} blocks type-check`)
}

// Ruby: syntax only (it has no type checker).
if (written.rb.map((name) => run("ruby", ["-c", name], { quiet: true })).every(Boolean)) {
  console.log(`Ruby: ${written.rb.length} blocks are valid Ruby`)
}
if (failed || process.exitCode) process.exit(1)
rmSync(dir, { recursive: true })
