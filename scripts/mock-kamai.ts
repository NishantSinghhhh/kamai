/**
 * Mock of kamai's free routes for frontend iteration without keys.
 * Serves /stats, /jobs, /quote, /health on :3000 with plausible demo data.
 * Run: npx tsx scripts/mock-kamai.ts
 */
import http from "node:http";

const jobs = Array.from({ length: 14 }, (_, i) => {
  const price = 0.03 + Math.random() * 0.04;
  const cost = price * (0.35 + Math.random() * 0.25);
  const minute = 17 - i * 1.2;
  return {
    id: `job-${i}`,
    customer: `0.0.90${(i % 3) + 1}12${i}`,
    txId: `0.0.429274@17500000${(1000 + i * 7).toString()}.${i * 137}`,
    priceUsd: price,
    costUsd: cost,
    status: "done",
    ogChatId: `chat_${(i + 1) * 31}`,
    hcsSequence: i + 1,
    hederaPaymentTxId: `0.0.90112@1750000099.${i}`,
    paymentUrl: `https://hashscan.io/testnet/transaction/1750000099.${i}`,
    createdAt: new Date(Date.now() - minute * 60_000).toISOString(),
  };
});

const revenue = jobs.reduce((s, j) => s + j.priceUsd, 0);
const cost = jobs.reduce((s, j) => s + (j.costUsd ?? 0), 0);

const stats = {
  jobs: jobs.length,
  revenueUsd: revenue,
  computeCostUsd: cost,
  marginUsd: revenue - cost,
  allowanceUsd: 0.25 + revenue - cost,
  todayComputeUsd: cost,
  status: "working",
  policy: { priceFloorUsd: 0.03, maxDailyComputeUsd: 0.25, minMarginBps: 5000 },
  ensName: "kamai.nishant.eth",
  hcsTopicId: "0.0.6000000",
  hcsTopicUrl: "https://hashscan.io/testnet/topic/0.0.6000000",
  usdcTokenId: "0.0.429274",
  ogProviderAddress: "0x5fC43768d9ExAmPlE000000000000000000000001",
};

http
  .createServer((req, res) => {
    const url = req.url ?? "";
    const send = (body: unknown) => {
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify(body));
    };
    if (url.startsWith("/stats")) send(stats);
    else if (url.startsWith("/jobs")) send(jobs);
    else if (url.startsWith("/quote")) send({ status: "working", priceUsd: 0.045, estimatedCostUsd: 0.003 });
    else if (url.startsWith("/health")) send({ ok: true });
    else {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(3000, () => console.log("mock kamai on :3000"));
