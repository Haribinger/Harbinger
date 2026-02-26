if (!process.env.npm_config_user_agent?.includes("pnpm")) {
  console.error("❌ Use pnpm for this repo: pnpm install");
  process.exit(1);
}
