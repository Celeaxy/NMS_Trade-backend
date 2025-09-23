import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createClient } from "@libsql/client";

const app = express();

const corsOptions = {
  origin: [
    "https://celeaxy.github.io/NMS_Trade-frontend",
    "https://upgraded-space-potato-xp95jr75jqrh6pw7-5173.app.github.dev",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200, // For legacy browsers
};

app.options("*", cors(corsOptions)); // Enable pre-flight for all routes
app.use(cors(corsOptions));
app.use(express.json());

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_DATABASE_TOKEN = process.env.TURSO_DATABASE_TOKEN;

if (!TURSO_URL || !TURSO_DATABASE_TOKEN) {
  console.error(
    "TURSO_DATABASE_URL and TURSO_DATABASE_TOKEN must be set in environment variables",
  );
  process.exit(1);
}

const tursoClient = createClient({
  url: TURSO_URL,
  authToken: TURSO_DATABASE_TOKEN,
});

export function requireToken(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : null;

  if (!token) {
    return res.status(400).json({ error: "Missing userToken" });
  }
  req.userToken = token;
  next();
}

app.get("/api/items", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  try {
    const result = await tursoClient.execute(
      "SELECT * FROM Items WHERE userToken = ?",
      [userToken],
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/item", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;
  const { name, value } = req.body;

  try {
    const result = await tursoClient.execute(
      `INSERT OR REPLACE INTO Items (name, value, userToken) VALUES (?, ?, ?)`,
      [name, value, userToken],
    );
    // Fetch the created item
    if (typeof result.lastInsertRowid === "undefined") {
      return res.status(500).json({ error: "Failed to retrieve inserted item ID" });
    }
    const item = await tursoClient.execute(
      `SELECT * FROM Items WHERE id = ? AND userToken = ?`,
      [Number(result.lastInsertRowid), userToken],
    );
    res.json(item.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/item/:id", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  const itemId = req.params.id;
  const { name, value } = req.body as Partial<{ name: string; value: number }>;
  if (name === undefined && value === undefined) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const fields = [];
  const params = [];
  if (name !== undefined) {
    fields.push("Name = ?");
    params.push(name);
  }
  if (value !== undefined) {
    fields.push("Value = ?");
    params.push(value);
  }
  params.push(itemId, userToken);

  const sql = `UPDATE Items SET ${fields.join(", ")} WHERE Id = ? AND UserToken = ?`;

  try {
    await tursoClient.execute(sql, params);
    // Fetch the updated item
    const updated = await tursoClient.execute(
      `SELECT * FROM Items WHERE id = ? AND userToken = ?`,
      [itemId, userToken],
    );
    res.json(updated.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete(
  "/api/item/:id",
  requireToken,
  async (req: Request, res: Response) => {
    const userToken = req.userToken!;
    const itemId = req.params.id;

    try {
      await tursoClient.execute(
        "DELETE FROM Items WHERE Id = ? AND UserToken = ?",
        [itemId, userToken],
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.get("/api/stations", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  try {
    const result = await tursoClient.execute(
      "SELECT Id, Name FROM Stations WHERE UserToken = ?",
      [userToken],
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/station", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  const { name } = req.body;

  try {
    const result = await tursoClient.execute(
      `INSERT OR REPLACE INTO Stations (name, userToken) VALUES (?, ?)`,
      [name, userToken],
    );

    if (typeof result.lastInsertRowid === "undefined") {
      return res.status(500).json({ error: "Failed to retrieve inserted item ID" });
    }
    // Fetch the created station
    const station = await tursoClient.execute(
      `SELECT * FROM Stations WHERE id = ? AND userToken = ?`,
      [Number(result.lastInsertRowid), userToken],
    );
    res.json(station.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put(
  "/api/station/:id",
  requireToken,
  async (req: Request, res: Response) => {
    const userToken = req.userToken!;

    const stationId = req.params.id;
    const { name } = req.body as Partial<{ name: string }>;

    if (name === undefined) {
      return res.status(400).json({ error: "No fields to update" });
    }

    try {
      await tursoClient.execute(
        `UPDATE Stations SET Name = ? WHERE Id = ? AND UserToken = ?`,
        [name, stationId, userToken],
      );
      // Fetch the updated station
      const station = await tursoClient.execute(
        `SELECT * FROM Stations WHERE Id = ? AND UserToken = ?`,
        [stationId, userToken],
      );
      res.json(station.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete(
  "/api/station/:id",
  requireToken,
  async (req: Request, res: Response) => {
    const userToken = req.userToken!;

    const stationId = req.params.id;
    try {
      await tursoClient.execute(
        "DELETE FROM Stations WHERE Id = ? AND UserToken = ?",
        [stationId, userToken],
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.get("/api/demands", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  try {
    const result = await tursoClient.execute(
      "SELECT StationId, ItemId, DemandLevel FROM Demands WHERE UserToken = ?",
      [userToken],
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/demand", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  const { stationId, itemId, demandLevel } = req.body;
  if (
    stationId === undefined ||
    itemId === undefined ||
    demandLevel === undefined
  ) {
    return res.status(400).json({ error: "Missing demand data" });
  }
  try {
    await tursoClient.execute(
      `INSERT OR REPLACE INTO Demands (StationId, ItemId, DemandLevel, UserToken) VALUES (?, ?, ?, ?)`,
      [stationId, itemId, demandLevel, userToken],
    );
    // Fetch the created demand
    const demand = await tursoClient.execute(
      `SELECT StationId, ItemId, DemandLevel FROM Demands WHERE StationId = ? AND ItemId = ? AND UserToken = ?`,
      [stationId, itemId, userToken],
    );
    res.json(demand.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/demand", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  const { stationId, itemId } = req.query;
  if (stationId === undefined || itemId === undefined) {
    return res.status(400).json({ error: "Missing demand data" });
  }

  const stationIdNum = Number(stationId);
  const itemIdNum = Number(itemId);
  if (isNaN(stationIdNum) || isNaN(itemIdNum)) {
    return res.status(400).json({ error: "Invalid stationId or itemId" });
  }

  const { demandLevel } = req.body;

  try {
    await tursoClient.execute(
      "UPDATE Demands SET DemandLevel = ? WHERE StationId = ? AND ItemId = ? AND UserToken = ?",
      [demandLevel, stationIdNum, itemIdNum, userToken],
    );
    // Fetch the updated demand
    const demand = await tursoClient.execute(
      `SELECT * FROM Demands WHERE StationId = ? AND ItemId = ? AND UserToken = ?`,
      [stationIdNum, itemIdNum, userToken],
    );
    res.json(demand.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/demand", requireToken, async (req: Request, res: Response) => {
  const userToken = req.userToken!;

  const stationIdRaw = req.query.stationId;
  const itemIdRaw = req.query.itemId;

  if (stationIdRaw === undefined || itemIdRaw === undefined) {
    return res.status(400).json({ error: "Missing demand data" });
  }

  const stationId = Number(stationIdRaw);
  const itemId = Number(itemIdRaw);

  if (isNaN(stationId) || isNaN(itemId)) {
    return res.status(400).json({ error: "Invalid stationId or itemId" });
  }

  try {
    await tursoClient.execute(
      "DELETE FROM Demands WHERE StationId = ? AND ItemId = ? AND UserToken = ?",
      [stationId, itemId, userToken],
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});
