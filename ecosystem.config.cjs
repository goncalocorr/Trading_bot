module.exports = {
  apps: [
    {
      name: "trading-bot-backend",
      cwd: "./backend",
      script: "server.js",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
