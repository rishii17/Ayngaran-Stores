import { createApp } from "./app.mjs";
const port = Number(process.env.API_PORT || 4000);
createApp().listen(port, "127.0.0.1", () =>
  console.log(`Ayngaran Express API: http://127.0.0.1:${port}`),
);
