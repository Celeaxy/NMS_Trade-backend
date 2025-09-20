import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';

const app = express();

const corsOptions = {
  origin: ['https://celeaxy.github.io/NMS_Trade-frontend/',
  'https://upgraded-space-potato-xp95jr75jqrh6pw7-5173.app.github.dev'],
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

app.post('/api/item', async (req: Request, res: Response) => {
  const { id, name, value, userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  if (id === undefined || !name || value === undefined) {
    return res.status(400).json({ error: 'Missing item data' });
  }
  try {
    await tursoClient.execute(
      `INSERT OR REPLACE INTO items (id, name, value, userToken) VALUES (?, ?, ?, ?)`,
      [id, name, value, userToken]
    );
    res.json({ success: true });
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

app.post('/api/station', async (req: Request, res: Response) => {
  const { id, name, items, userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  if (id === undefined || !name) {
    return res.status(400).json({ error: 'Missing station data' });
  }
  try {
    await tursoClient.execute(
      `INSERT OR REPLACE INTO stations (id, name, userToken) VALUES (?, ?, ?)`,
      [id, name, userToken]
    );
    if (Array.isArray(items)) {
      for (const tradeItem of items) {
        await tursoClient.execute(
          `INSERT OR REPLACE INTO demands (station_id, item_id, demand, userToken) VALUES (?, ?, ?, ?)`,
          [id, tradeItem.item.id, tradeItem.demand, userToken]
        );
      }
    }
    res.json({ success: true });
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

app.post('/api/demand', async (req: Request, res: Response) => {
  const { station_id, item_id, demand, userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: 'Missing userToken' });
  if (station_id === undefined || item_id === undefined || demand === undefined) {
    return res.status(400).json({ error: 'Missing demand data' });
  }
  try {
    await tursoClient.execute(
      `INSERT OR REPLACE INTO demands (station_id, item_id, demand, userToken) VALUES (?, ?, ?, ?)`,
      [station_id, item_id, demand, userToken]
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
