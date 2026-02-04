const proc = Bun.spawn({
  cmd: [
    "bunx",
    "eslint",
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts",
    "tests/**/*.tsx",
  ],
  stdio: ["inherit", "inherit", "inherit"],
})

const exitCode = await proc.exited
if (exitCode !== 0) {
  process.exit(exitCode)
}

export {}
