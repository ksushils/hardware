// PM2 process file. Port defaults to 3100 so it won't clash with other sites on the VPS.
module.exports = {
  apps: [{
    name: "techrevive",
    cwd: __dirname + "/..",
    script: "node_modules/next/dist/bin/next",
    args: `start -p ${process.env.PORT || 3100} -H 127.0.0.1`,
    env: { NODE_ENV: "production" },
    max_memory_restart: "800M",
    autorestart: true,
  }],
};
