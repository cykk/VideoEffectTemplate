import { spawn } from "node:child_process";

const commands = [
  {
    name: "api",
    command: "pnpm exec dotenv -e .env.api.local -- next dev ./apps/api --webpack --hostname 0.0.0.0 --port 3001",
  },
  {
    name: "web",
    command: "pnpm exec dotenv -e .env.web.local -- next dev ./apps/web --webpack --hostname 0.0.0.0 --port 3000",
  },
];

const children = commands.map(({ command }) =>
  spawn(command, {
    shell: true,
    stdio: "inherit",
    env: process.env,
  })
);

const terminate = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
};

process.on("SIGINT", terminate);
process.on("SIGTERM", terminate);

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      terminate();
      process.exitCode = code;
    }
  });
}
