import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';

const app = express();

const corsOptions = {
  origin: 'https://celeaxy.github.io/NMS_Trade-frontend/',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  optionsSuccessStatus: 200 // For legacy browsers
};


app.use(cors(corsOptions));
app.use(express.json());

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_DATABASE_TOKEN = process.env.TURSO_DATABASE_TOKEN;

if (!TURSO_URL || !TURSO_DATABASE_TOKEN) {
  console.error('TURSO_DATABASE_URL and TURSO_DATABASE_TOKEN must be set in environment variables');
  process.exit(1);
}

const tursoClient = createClient({
  url: TURSO_URL,
  authToken: TURSO_DATABASE_TOKEN,
});

app.post('/api/migrate', async (req: Request, res: Response) => {
  const { items, stations, userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  try {
    await tursoClient.execute(`CREATE TABLE IF NOT EXISTS items (
      id INTEGER,
      name TEXT,
      value REAL,
      userToken TEXT,
      PRIMARY KEY (id, userToken)
    )`);
    await tursoClient.execute(`CREATE TABLE IF NOT EXISTS stations (
      id INTEGER,
      name TEXT,
      userToken TEXT,
      PRIMARY KEY (id, userToken)
    )`);
    await tursoClient.execute(`CREATE TABLE IF NOT EXISTS demands (
      station_id INTEGER,
      item_id INTEGER,
      demand REAL,
      userToken TEXT,
      PRIMARY KEY (station_id, item_id, userToken),
      FOREIGN KEY (station_id, userToken) REFERENCES stations(id, userToken) ON DELETE CASCADE,
      FOREIGN KEY (item_id, userToken) REFERENCES items(id, userToken) ON DELETE CASCADE
    )`);
    for (const item of items) {
      await tursoClient.execute(
        `INSERT OR REPLACE INTO items (id, name, value, userToken) VALUES (?, ?, ?, ?)`,
        [item.id, item.name, item.value, userToken]
      );
    }
    for (const station of stations) {
      await tursoClient.execute(
        `INSERT OR REPLACE INTO stations (id, name, userToken) VALUES (?, ?, ?)`,
        [station.id, station.name, userToken]
      );
      if (Array.isArray(station.items)) {
        for (const tradeItem of station.items) {
          await tursoClient.execute(
            `INSERT OR REPLACE INTO demands (station_id, item_id, demand, userToken) VALUES (?, ?, ?, ?)`,
            [station.id, tradeItem.item.id, tradeItem.demand, userToken]
          );
        }
      }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/items', async (req: Request, res: Response) => {
  const userToken = req.query.userToken as string;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  try {
    const result = await tursoClient.execute(
      'SELECT id, name, value FROM items WHERE userToken = ?',
      [userToken]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stations', async (req: Request, res: Response) => {
  const userToken = req.query.userToken as string;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  try {
    const result = await tursoClient.execute(
      'SELECT id, name FROM stations WHERE userToken = ?',
      [userToken]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/demands', async (req: Request, res: Response) => {
  const userToken = req.query.userToken as string;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  try {
    const result = await tursoClient.execute(
      'SELECT station_id, item_id, demand FROM demands WHERE userToken = ?',
      [userToken]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
});
