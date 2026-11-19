import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    update: mocks.update,
    select: mocks.select,
    insert: mocks.insert,
    transaction: mocks.transaction,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...parts: unknown[]) => ({ op: "and", parts })),
  asc: vi.fn((col: unknown) => ({ op: "asc", col })),
  desc: vi.fn((col: unknown) => ({ op: "desc", col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
  lt: vi.fn((left: unknown, right: unknown) => ({ op: "lt", left, right })),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings,
    values,
  }),
}));

import {
  claimRenderJob,
  completeRenderJob,
  recoverStaleJobs,
  retryRenderJob,
} from "@/lib/jobs/queue";

const ID = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const REVISION = "33333333-3333-4333-8333-333333333333";

const baseRow = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  projectId: PROJECT,
  revisionId: REVISION,
  status: "queued",
  stage: null,
  progress: 0,
  attempt: 0,
  priority: 0,
  sandboxId: null,
  commandId: null,
  errorCode: null,
  errorMessage: null,
  workerId: null,
  claimedAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

type SqlCondition = {
  op?: string;
  parts?: SqlCondition[];
  vals?: unknown[];
  left?: SqlCondition;
  right?: SqlCondition;
};
type CallLog = { methods: string[]; set?: unknown; where: SqlCondition; values?: unknown };

type ChainObject = Record<string, unknown> & {
  then: (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

function chain(result: unknown, log: CallLog): ChainObject {
  const obj: Record<string, unknown> = {};
  for (const method of ["set", "where", "values", "returning", "orderBy", "limit", "for", "from"]) {
    obj[method] = (...args: unknown[]) => {
      log.methods.push(method);
      if (method === "set") log.set = args[0];
      if (method === "where") log.where = args[0] as SqlCondition;
      if (method === "values") log.values = args[0];
      return obj;
    };
  }
  const thenable = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  obj.then = thenable;
  return obj as ChainObject;
}

function setup(updateResult: unknown, selectResult: unknown[] = []) {
  const updateLog: CallLog = { methods: [], where: {} };
  const selectLog: CallLog = { methods: [], where: {} };
  mocks.update.mockReturnValue(chain(updateResult, updateLog));
  mocks.select.mockReturnValue(chain(selectResult, selectLog));
  return { updateLog, selectLog };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimRenderJob", () => {
  it("mengambil job queued, menaikkan attempt, dan menandai worker", async () => {
    const now = new Date();
    const { updateLog, selectLog } = setup([
      baseRow({
        status: "preparing",
        stage: "preparing",
        attempt: 1,
        workerId: "worker-1",
        claimedAt: now,
        startedAt: now,
      }),
    ]);

    const job = await claimRenderJob("worker-1");

    expect(job).not.toBeNull();
    expect(job?.status).toBe("preparing");
    expect(job?.attempt).toBe(1);
    expect(job?.workerId).toBe("worker-1");
    expect(job?.claimedAt).toBeInstanceOf(Date);
    expect(job?.startedAt).toBeInstanceOf(Date);
    expect(updateLog.set).toMatchObject({ status: "preparing", workerId: "worker-1" });
    expect(updateLog.where.op).toBe("and");
    expect(selectLog.methods).toContain("for");
    expect(selectLog.methods).toContain("limit");
  });

  it("mengembalikan null bila tidak ada job yang bisa diklaim", async () => {
    setup([]);
    expect(await claimRenderJob("worker-2")).toBeNull();
  });

  it("menolak workerId kosong", async () => {
    await expect(claimRenderJob("  ")).rejects.toThrow("workerId");
  });
});

describe("recoverStaleJobs", () => {
  it("menggagalkan job aktif yang kedaluwarsa dan mengembalikan jumlahnya", async () => {
    const { updateLog } = setup([{ id: ID }, { id: ID }]);

    const count = await recoverStaleJobs(60_000);

    expect(count).toBe(2);
    expect(updateLog.set).toMatchObject({
      status: "failed",
      errorCode: "SANDBOX_EXPIRED",
    });
    const conditions = updateLog.where.parts ?? [];
    expect(conditions[0]?.op).toBe("inArray");
    expect(conditions[0].vals).toEqual([
      "preparing",
      "bundling",
      "rendering",
      "encoding",
      "uploading",
    ]);
    expect(conditions[1]?.op).toBe("lt");
    expect(conditions[1]?.left?.op).toBe("sql");
    expect(conditions[1]?.right).toBeInstanceOf(Date);
  });

  it("tidak menganggap job queued sebagai running", async () => {
    setup([]);
    await recoverStaleJobs();
    // Kumpulan status aktif tidak pernah memuat "queued".
    expect(mocks.update.mock.calls.length).toBe(1);
  });

  it("menolak nilai staleMs non-positif", async () => {
    await expect(recoverStaleJobs(0)).rejects.toThrow("staleMs");
  });
});

describe("retryRenderJob", () => {
  it("hanya mengulang job failed/cancelled/expired", async () => {
    setup([baseRow({ status: "queued", progress: 0 })], [
      baseRow({ status: "failed", errorCode: "REMOTION_RENDER_FAILED" }),
    ]);

    const job = await retryRenderJob(ID);

    expect(job.status).toBe("queued");
    expect(job.progress).toBe(0);
    expect(mocks.update).toHaveBeenCalled();
  });

  it("menolak job yang masih completed", async () => {
    setup([], [baseRow({ status: "completed" })]);
    await expect(retryRenderJob(ID)).rejects.toThrow("tidak bisa diulang");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("completeRenderJob", () => {
  it("menulis status completed dan artifacts dalam satu transaksi", async () => {
    const txUpdate = vi.fn(() => chain([], { methods: [], where: {} }));
    const txInsert = vi.fn(() => chain([], { methods: [], where: {} }));
    mocks.transaction.mockImplementation(
      async (cb: (tx: { update: typeof txUpdate; insert: typeof txInsert }) => unknown) =>
        cb({ update: txUpdate, insert: txInsert }),
    );

    await completeRenderJob(ID, [
      {
        artifactType: "mp4",
        storageKey: "renders/a.mp4",
        url: "https://example.test/a.mp4",
        mimeType: "video/mp4",
        fileSize: 123,
      },
    ]);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(txInsert).toHaveBeenCalledTimes(1);
  });
});

describe("validasi input", () => {
  it("menolak UUID tidak valid sebelum query dibuat", async () => {
    await expect(retryRenderJob("bukan-uuid")).rejects.toThrow("UUID");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
