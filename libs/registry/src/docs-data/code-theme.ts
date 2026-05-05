export const DOCS_CODE_THEME_NAME = "tui-theme"

function v(name: string): string {
  return `var(--code-${name})`
}

export const docsCodeTheme = {
  name: "tui-theme",
  type: "dark" as const,
  colors: {
    "editor.foreground": v("variable"),
    "editor.background": "var(--background)",
  },
  tokenColors: [
    {
      scope: [
        "keyword.operator.accessor",
        "meta.group.braces.round.function.arguments",
        "meta.template.expression",
        "markup.fenced_code meta.embedded.block",
      ],
      settings: { foreground: v("variable") },
    },
    {
      scope: ["string", "markup.fenced_code", "markup.inline"],
      settings: { foreground: v("string") },
    },
    {
      scope: ["comment", "string.quoted.docstring.multi"],
      settings: { foreground: v("comment") },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.other.placeholder",
        "constant.character.format.placeholder",
        "variable.language.this",
        "variable.other.object",
        "variable.other.class",
        "variable.other.constant",
        "meta.property-name",
        "meta.property-value",
        "support",
      ],
      settings: { foreground: v("number") },
    },
    {
      scope: [
        "keyword",
        "storage.modifier",
        "storage.type",
        "storage.control.clojure",
        "entity.name.function.clojure",
        "entity.name.tag.yaml",
        "support.function.node",
        "support.type.property-name.json",
        "punctuation.separator.key-value",
        "punctuation.definition.template-expression",
      ],
      settings: { foreground: v("keyword") },
    },
    {
      scope: "variable.parameter.function",
      settings: { foreground: v("parameter") },
    },
    {
      scope: [
        "support.function",
        "entity.name.type",
        "entity.other.inherited-class",
        "meta.function-call",
        "meta.instance.constructor",
        "entity.other.attribute-name",
        "entity.name.function",
        "constant.keyword.clojure",
      ],
      settings: { foreground: v("function") },
    },
    {
      scope: [
        "entity.name.tag",
        "string.quoted",
        "string.regexp",
        "string.interpolated",
        "string.template",
        "string.unquoted.plain.out.yaml",
        "keyword.other.template",
      ],
      settings: { foreground: v("tag") },
    },
    {
      scope: [
        "keyword.operator",
        "punctuation",
      ],
      settings: { foreground: v("operator") },
    },
    {
      scope: ["variable", "variable.other"],
      settings: { foreground: v("variable") },
    },
    {
      scope: "meta.link.inline.markdown",
      settings: { foreground: v("string") },
    },
    {
      scope: ["beginning.punctuation.definition.list.markdown"],
      settings: { foreground: v("string") },
    },
    {
      scope: [
        "punctuation.definition.string.begin.markdown",
        "punctuation.definition.string.end.markdown",
        "string.other.link.title.markdown",
        "string.other.link.description.markdown",
      ],
      settings: { foreground: v("keyword") },
    },
    {
      scope: [
        "markup.inserted",
        "meta.diff.header.to-file",
        "punctuation.definition.inserted",
      ],
      settings: { foreground: v("function") },
    },
    {
      scope: [
        "markup.deleted",
        "meta.diff.header.from-file",
        "punctuation.definition.deleted",
      ],
      settings: { foreground: v("operator") },
    },
  ],
}
