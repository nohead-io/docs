// Writes the CLI reference, cli/commands/<page>.mdx, from cli/commands.json
// (the CLI's own description of its commands). One page per group below; a
// command no page lists, or a page docs.json doesn't list, fails the run, so
// a new command can't go missing from the docs.
//
//   npm run generate
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs"

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
const program = read("../cli/commands.json")
const docs = read("../docs.json")

// Top-level commands, grouped into pages in the navigation's order.
export const PAGES = [
  { slug: "setup", title: "Sign-in and setup", icon: "key-round", commands: ["login", "logout", "whoami", "health", "flags"] },
  { slug: "collections", title: "Collections", icon: "database", commands: ["collections"] },
  { slug: "fields", title: "Fields", icon: "list", commands: ["fields"] },
  { slug: "migrations", title: "Field migrations", icon: "arrow-right-left", commands: ["migrations"] },
  { slug: "schema", title: "Schema as code", icon: "file-code", commands: ["schema"] },
  { slug: "records", title: "Records", icon: "file-text", commands: ["records"] },
  { slug: "drafts", title: "Drafts", icon: "file-pen", commands: ["drafts"] },
  { slug: "assets", title: "Assets", icon: "image", commands: ["assets"] },
  { slug: "search", title: "Search", icon: "search", commands: ["search"] },
  { slug: "webhooks", title: "Webhooks", icon: "webhook", commands: ["webhooks"] },
  { slug: "audit", title: "Activity log", icon: "history", commands: ["audit"] },
  { slug: "export-import", title: "Export and import", icon: "package", commands: ["export", "import"] },
]

const byName = new Map(program.commands.map((command) => [command.name, command]))
const listed = PAGES.flatMap((page) => page.commands)
const unlisted = [...byName.keys()].filter((name) => !listed.includes(name))
const unknown = listed.filter((name) => !byName.has(name))
if (unlisted.length || unknown.length) {
  throw new Error(
    `cli-reference.mjs PAGES: add ${unlisted.join(", ") || "-"}; remove ${unknown.join(", ") || "-"}`
  )
}
const navigation = JSON.stringify(docs.navigation)
const missing = [...PAGES, { slug: "global-options" }].filter(
  (page) => !navigation.includes(`"cli/commands/${page.slug}"`)
)
if (missing.length) {
  throw new Error(`docs.json: list ${missing.map((page) => `cli/commands/${page.slug}`).join(", ")}`)
}

// Text in MDX: < and { would start a tag or an expression, | ends a table cell.
const text = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
const code = (value) => `\`${String(value).replaceAll("|", "\\|")}\``
const sentence = (value) => {
  const trimmed = text(value).trim()
  if (!trimmed) return ""
  // A leading plain word is capitalized; an identifier (created_at, e.g.) isn't.
  const capital = /^[a-z]+[\s,;]/.test(trimmed)
    ? trimmed[0].toUpperCase() + trimmed.slice(1)
    : trimmed
  return /[.!?:)]$/.test(capital) ? capital : `${capital}.`
}

const choices = (item) =>
  item.choices ? ` One of ${item.choices.map(code).join(", ")}.` : ""

function section(command, path) {
  // A group's own description is the page's; its commands get the headings.
  if (command.commands.length)
    return command.commands.flatMap((sub) => section(sub, `${path} ${sub.name}`))
  const lines = [`## ${code(path)}`, "", sentence(command.description), ""]
  {
    lines.push("```bash", `${path} ${command.usage}`.trim(), "```", "")
    if (command.arguments.length) {
      lines.push("| Argument | |", "|---|---|")
      for (const argument of command.arguments) {
        const name = `${argument.name}${argument.variadic ? "..." : ""}`
        lines.push(`| ${code(argument.required ? `<${name}>` : `[${name}]`)} | ${sentence(argument.description)}${choices(argument)} |`)
      }
      lines.push("")
    }
    if (command.options.length) {
      lines.push("| Option | |", "|---|---|")
      for (const option of command.options) {
        const fallback = option.default === undefined || option.default === false
          ? ""
          : ` Default: ${code(JSON.stringify(option.default))}.`
        lines.push(`| ${code(option.flags)} | ${sentence(option.description)}${choices(option)}${fallback} |`)
      }
      lines.push("")
    }
  }
  return [lines.join("\n")]
}

const directory = new URL("../cli/commands/", import.meta.url)
mkdirSync(directory, { recursive: true })
for (const file of readdirSync(directory)) rmSync(new URL(file, directory))
for (const page of PAGES) {
  const commands = page.commands.map((name) => byName.get(name))
  const description =
    commands.length === 1 && commands[0].commands.length
      ? sentence(commands[0].description)
      : `${commands.map((command) => code(`nohead ${command.name}`)).join(", ")}.`
  const body = [
    "---",
    `title: ${page.title}`,
    `icon: ${page.icon}`,
    `description: ${JSON.stringify(description.replaceAll("`", ""))}`,
    "---",
    "",
    "{/* Generated by scripts/cli-reference.mjs from cli/commands.json. Do not edit. */}",
    "",
    "Every command also takes the [global options](/cli/commands/global-options), such as `--json`.",
    "",
    ...commands.flatMap((command) => section(command, `nohead ${command.name}`)),
  ].join("\n")
  writeFileSync(new URL(`${page.slug}.mdx`, directory), body.trimEnd() + "\n")
}
// The options every command takes, before or after the command's name.
const global = [
  "---",
  "title: Global options",
  "icon: settings",
  'description: "Options every nohead command takes, such as --json and --project."',
  "---",
  "",
  "{/* Generated by scripts/cli-reference.mjs from cli/commands.json. Do not edit. */}",
  "",
  "Every command takes these, for example `nohead --json records list posts`. The [overview](/cli/overview#configuration) has how they combine with environment variables and saved profiles.",
  "",
  "| Option | |",
  "|---|---|",
  ...program.options.map((option) => `| ${code(option.flags)} | ${sentence(option.description)}${choices(option)} |`),
].join("\n")
writeFileSync(new URL("global-options.mdx", directory), global + "\n")
console.log(`cli: ${PAGES.length + 1} reference pages`)
