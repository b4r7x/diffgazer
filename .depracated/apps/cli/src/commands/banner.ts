import figlet from "figlet";
import chalk from "chalk";

export function displayBanner(serverAddress: string, projectPath: string): void {
  const banner = figlet.textSync("stargazer", {
    font: "Standard",
    horizontalLayout: "default",
  });

  console.log(chalk.cyan(banner));
  console.log();
  console.log(chalk.green(`  Server running at: ${serverAddress}`));
  console.log(chalk.blue(`  Project: ${projectPath}`));
  console.log();
  console.log(chalk.gray("  Press Ctrl+C to stop"));
  console.log();
}
