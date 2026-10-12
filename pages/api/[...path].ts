import type { NextApiRequest, NextApiResponse } from "next";
import { createApp } from "../../server/app.mjs";

// Keep Express validation, authentication and transactions in the same Node
// runtime as Next.js, including hosts that do not start a second process.
const app = createApp();
export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 60,
};
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return app(req, res);
}
