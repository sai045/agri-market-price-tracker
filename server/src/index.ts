import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "./config.js";
import { pool, query } from "./db.js";
import { signAdminToken, verifyAdminToken } from "./utils/auth.js";
import { isHolidayForDate } from "./utils/holiday.js";

type AuthedRequest = Request & {
  admin?: { userId: string; email: string };
};

const app = express();

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

const citySchema = z.object({
  name: z.string().min(1),
  name_te: z.string().min(1),
  region: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const unitSchema = z.object({
  name: z.string().min(1),
  name_te: z.string().min(1),
  abbreviation: z.string().min(1),
  is_active: z.boolean().optional(),
});

const itemSchema = z.object({
  name: z.string().min(1),
  name_te: z.string().min(1),
  default_unit_id: z.string().uuid(),
  is_active: z.boolean().optional(),
});

const seasonSchema = z.object({
  item_id: z.string().uuid(),
  start_month: z.number().int().min(1).max(12),
  end_month: z.number().int().min(1).max(12),
});

const holidaySchema = z
  .object({
    city_id: z.string().uuid(),
    name: z.string().min(1),
    name_te: z.string().min(1),
    recurrence_type: z.enum(["weekly", "annual", "none"]),
    day_of_week: z.number().int().min(0).max(6).nullable().optional(),
    month: z.number().int().min(1).max(12).nullable().optional(),
    day: z.number().int().min(1).max(31).nullable().optional(),
    holiday_date: z.string().date().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.recurrence_type === "weekly" && input.day_of_week == null) {
      ctx.addIssue({ code: "custom", path: ["day_of_week"], message: "day_of_week required" });
    }
    if (input.recurrence_type === "annual" && (input.month == null || input.day == null)) {
      ctx.addIssue({ code: "custom", path: ["month"], message: "month/day required" });
    }
    if (input.recurrence_type === "none" && !input.holiday_date) {
      ctx.addIssue({ code: "custom", path: ["holiday_date"], message: "holiday_date required" });
    }
  });

const priceSchema = z.object({
  city_id: z.string().uuid(),
  item_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  entry_date: z.string().date(),
  max_price: z.number().positive(),
  notes: z.string().max(500).nullable().optional(),
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email: z.string().email(), password: z.string().min(6) })
      .parse(req.body);
    const users = await query<{ id: string; email: string; password_hash: string }>(
      "select id, email, password_hash from users where email = $1 and is_active = true limit 1",
      [body.email],
    );
    const user = users[0];
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const token = signAdminToken({ userId: user.id, email: user.email });
    res.cookie("admin_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, email: user.email });
  }),
);

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("admin_token");
  res.json({ ok: true });
});

app.get(
  "/api/cities",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      "select id, name, name_te, region, is_active from cities where is_active = true order by name",
    );
    res.json(rows);
  }),
);

app.get(
  "/api/items",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `select i.id, i.name, i.name_te, i.default_unit_id, u.name as unit_name, u.abbreviation,
              s.start_month, s.end_month
       from items i
       join units u on u.id = i.default_unit_id
       left join item_seasons s on s.item_id = i.id
       where i.is_active = true
       order by i.name`,
    );
    res.json(rows);
  }),
);

app.get(
  "/api/seasons",
  asyncHandler(async (_req, res) => {
    const month = new Date().getMonth() + 1;
    const rows = await query<{
      id: string;
      item_id: string;
      name: string;
      name_te: string;
      start_month: number;
      end_month: number;
    }>(
      `select s.id, s.item_id, i.name, i.name_te, s.start_month, s.end_month
       from item_seasons s
       join items i on i.id = s.item_id
       where i.is_active = true
       order by i.name`,
    );
    res.json(
      rows.map((r) => ({
        ...r,
        inSeasonNow:
          r.start_month <= r.end_month
            ? month >= r.start_month && month <= r.end_month
            : month >= r.start_month || month <= r.end_month,
      })),
    );
  }),
);

app.get(
  "/api/holidays",
  asyncHandler(async (req, res) => {
    const cityId = z.string().uuid().parse(req.query.cityId);
    const year = Number(req.query.year ?? new Date().getFullYear());
    const rows = await query<{
      id: string;
      name: string;
      name_te: string;
      recurrence_type: "weekly" | "annual" | "none";
      day_of_week: number | null;
      month: number | null;
      day: number | null;
      holiday_date: string | null;
    }>(
      `select id, name, name_te, recurrence_type, day_of_week, month, day, holiday_date
       from market_holidays
       where city_id = $1 and is_active = true
       order by name`,
      [cityId],
    );

    const resolved: Array<{ date: string; name: string; name_te: string; type: string }> = [];
    for (const rule of rows) {
      if (rule.recurrence_type === "none" && rule.holiday_date?.startsWith(String(year))) {
        resolved.push({
          date: rule.holiday_date,
          name: rule.name,
          name_te: rule.name_te,
          type: "one-off",
        });
      }
      if (rule.recurrence_type === "annual" && rule.month && rule.day) {
        const date = `${year}-${String(rule.month).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`;
        resolved.push({ date, name: rule.name, name_te: rule.name_te, type: "annual" });
      }
      if (rule.recurrence_type === "weekly" && rule.day_of_week != null) {
        for (let m = 0; m < 12; m += 1) {
          const current = new Date(year, m, 1);
          while (current.getMonth() === m) {
            if (current.getDay() === rule.day_of_week) {
              resolved.push({
                date: current.toISOString().slice(0, 10),
                name: rule.name,
                name_te: rule.name_te,
                type: "weekly",
              });
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    }
    resolved.sort((a, b) => a.date.localeCompare(b.date));
    res.json(resolved);
  }),
);

app.get(
  "/api/prices/latest",
  asyncHandler(async (req, res) => {
    const cityId = z.string().uuid().parse(req.query.cityId);
    const rows = await query(
      `with latest as (
         select item_id, max(entry_date) as max_date
         from price_entries
         where city_id = $1
         group by item_id
       )
       select p.id, p.entry_date, p.max_price, p.notes,
              i.id as item_id, i.name as item_name, i.name_te as item_name_te,
              u.name as unit_name, u.abbreviation
       from latest l
       join price_entries p on p.item_id = l.item_id and p.entry_date = l.max_date and p.city_id = $1
       join items i on i.id = p.item_id
       join units u on u.id = p.unit_id
       order by i.name`,
      [cityId],
    );
    res.json(rows);
  }),
);

app.get(
  "/api/prices",
  asyncHandler(async (req, res) => {
    const cityId = z.string().uuid().parse(req.query.cityId);
    const itemId = req.query.itemId ? z.string().uuid().parse(req.query.itemId) : null;
    const from = (req.query.from as string) ?? "1900-01-01";
    const to = (req.query.to as string) ?? "2999-12-31";
    const rows = await query(
      `select p.id, p.entry_date, p.max_price, p.notes,
              i.name as item_name, i.name_te as item_name_te,
              u.name as unit_name, u.abbreviation
       from price_entries p
       join items i on i.id = p.item_id
       join units u on u.id = p.unit_id
       where p.city_id = $1
         and p.entry_date between $2 and $3
         and ($4::uuid is null or p.item_id = $4::uuid)
       order by p.entry_date desc, i.name`,
      [cityId, from, to, itemId],
    );
    res.json(rows);
  }),
);

app.get(
  "/api/prices/trends",
  asyncHandler(async (req, res) => {
    const cityId = z.string().uuid().parse(req.query.cityId);
    const itemId = z.string().uuid().parse(req.query.itemId);
    const days = Number(req.query.days ?? 90);
    const rows = await query(
      `select entry_date, max_price
       from price_entries
       where city_id = $1
         and item_id = $2
         and entry_date >= (current_date - ($3::int || ' days')::interval)
       order by entry_date`,
      [cityId, itemId, days],
    );
    res.json(rows);
  }),
);

app.get(
  "/api/admin/me",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json((req as AuthedRequest).admin);
  }),
);

app.get(
  "/api/admin/masters",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [cities, units, items, seasons, holidays] = await Promise.all([
      query("select * from cities order by name"),
      query("select * from units order by name"),
      query(
        `select i.*, u.name as unit_name, u.abbreviation
         from items i join units u on u.id = i.default_unit_id
         order by i.name`,
      ),
      query(
        `select s.*, i.name as item_name, i.name_te as item_name_te
         from item_seasons s join items i on i.id = s.item_id
         order by i.name`,
      ),
      query(
        `select h.*, c.name as city_name, c.name_te as city_name_te
         from market_holidays h join cities c on c.id = h.city_id
         order by c.name, h.name`,
      ),
    ]);
    res.json({ cities, units, items, seasons, holidays });
  }),
);

app.post(
  "/api/admin/cities",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = citySchema.parse(req.body);
    const rows = await query(
      `insert into cities (name, name_te, region, is_active)
       values ($1, $2, $3, $4)
       returning *`,
      [input.name, input.name_te, input.region ?? null, input.is_active ?? true],
    );
    res.status(201).json(rows[0]);
  }),
);

app.put(
  "/api/admin/cities/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = citySchema.parse(req.body);
    const cityId = z.string().uuid().parse(req.params.id);
    const rows = await query(
      `update cities
       set name = $1, name_te = $2, region = $3, is_active = $4, updated_at = now()
       where id = $5
       returning *`,
      [input.name, input.name_te, input.region ?? null, input.is_active ?? true, cityId],
    );
    res.json(rows[0]);
  }),
);

app.post(
  "/api/admin/units",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = unitSchema.parse(req.body);
    const rows = await query(
      `insert into units (name, name_te, abbreviation, is_active)
       values ($1, $2, $3, $4)
       returning *`,
      [input.name, input.name_te, input.abbreviation, input.is_active ?? true],
    );
    res.status(201).json(rows[0]);
  }),
);

app.put(
  "/api/admin/units/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = unitSchema.parse(req.body);
    const unitId = z.string().uuid().parse(req.params.id);
    const rows = await query(
      `update units
       set name = $1, name_te = $2, abbreviation = $3, is_active = $4, updated_at = now()
       where id = $5
       returning *`,
      [input.name, input.name_te, input.abbreviation, input.is_active ?? true, unitId],
    );
    res.json(rows[0]);
  }),
);

app.post(
  "/api/admin/items",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = itemSchema.parse(req.body);
    const rows = await query(
      `insert into items (name, name_te, default_unit_id, is_active)
       values ($1, $2, $3, $4)
       returning *`,
      [input.name, input.name_te, input.default_unit_id, input.is_active ?? true],
    );
    res.status(201).json(rows[0]);
  }),
);

app.put(
  "/api/admin/items/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = itemSchema.parse(req.body);
    const itemId = z.string().uuid().parse(req.params.id);
    const rows = await query(
      `update items
       set name = $1, name_te = $2, default_unit_id = $3, is_active = $4, updated_at = now()
       where id = $5
       returning *`,
      [input.name, input.name_te, input.default_unit_id, input.is_active ?? true, itemId],
    );
    res.json(rows[0]);
  }),
);

app.post(
  "/api/admin/seasons",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = seasonSchema.parse(req.body);
    const rows = await query(
      `insert into item_seasons (item_id, start_month, end_month)
       values ($1, $2, $3)
       on conflict (item_id) do update
         set start_month = excluded.start_month, end_month = excluded.end_month, updated_at = now()
       returning *`,
      [input.item_id, input.start_month, input.end_month],
    );
    res.status(201).json(rows[0]);
  }),
);

app.post(
  "/api/admin/holidays",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = holidaySchema.parse(req.body);
    const rows = await query(
      `insert into market_holidays
        (city_id, name, name_te, recurrence_type, day_of_week, month, day, holiday_date, is_active)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        input.city_id,
        input.name,
        input.name_te,
        input.recurrence_type,
        input.day_of_week ?? null,
        input.month ?? null,
        input.day ?? null,
        input.holiday_date ?? null,
        input.is_active ?? true,
      ],
    );
    res.status(201).json(rows[0]);
  }),
);

app.put(
  "/api/admin/holidays/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = holidaySchema.parse(req.body);
    const holidayId = z.string().uuid().parse(req.params.id);
    const rows = await query(
      `update market_holidays
       set city_id = $1, name = $2, name_te = $3, recurrence_type = $4,
           day_of_week = $5, month = $6, day = $7, holiday_date = $8, is_active = $9, updated_at = now()
       where id = $10
       returning *`,
      [
        input.city_id,
        input.name,
        input.name_te,
        input.recurrence_type,
        input.day_of_week ?? null,
        input.month ?? null,
        input.day ?? null,
        input.holiday_date ?? null,
        input.is_active ?? true,
        holidayId,
      ],
    );
    res.json(rows[0]);
  }),
);

app.post(
  "/api/admin/prices",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const input = priceSchema.parse(req.body);
    const entryDate = new Date(input.entry_date);

    const holidays = await query<{
        recurrence_type: "weekly" | "annual" | "none";
        day_of_week: number | null;
        month: number | null;
        day: number | null;
        holiday_date: string | null;
      }>(
      `select recurrence_type, day_of_week, month, day, holiday_date
       from market_holidays
       where city_id = $1 and is_active = true`,
      [input.city_id],
    );

    const warnings: string[] = [];
    if (isHolidayForDate(entryDate, holidays)) {
      warnings.push("Selected date is configured as a holiday/off-day for this city.");
    }

    const admin = (req as AuthedRequest).admin;
    const rows = await query(
      `insert into price_entries (city_id, item_id, unit_id, entry_date, max_price, notes, entered_by)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (city_id, item_id, entry_date)
       do update set
         unit_id = excluded.unit_id,
         max_price = excluded.max_price,
         notes = excluded.notes,
         entered_by = excluded.entered_by,
         updated_at = now()
       returning *`,
      [
        input.city_id,
        input.item_id,
        input.unit_id,
        input.entry_date,
        input.max_price,
        input.notes ?? null,
        admin?.userId ?? null,
      ],
    );
    res.json({ row: rows[0], warnings });
  }),
);

app.post(
  "/api/admin/prices/bulk",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = z
      .object({
        city_id: z.string().uuid(),
        entry_date: z.string().date(),
        items: z.array(
          z.object({
            item_id: z.string().uuid(),
            unit_id: z.string().uuid(),
            max_price: z.number().positive(),
            notes: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(req.body);

    const admin = (req as AuthedRequest).admin;
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const row of payload.items) {
        await client.query(
          `insert into price_entries (city_id, item_id, unit_id, entry_date, max_price, notes, entered_by)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (city_id, item_id, entry_date)
           do update set
             unit_id = excluded.unit_id,
             max_price = excluded.max_price,
             notes = excluded.notes,
             entered_by = excluded.entered_by,
             updated_at = now()`,
          [
            payload.city_id,
            row.item_id,
            row.unit_id,
            payload.entry_date,
            row.max_price,
            row.notes ?? null,
            admin?.userId ?? null,
          ],
        );
      }
      await client.query("commit");
      res.json({ ok: true, count: payload.items.length });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.delete(
  "/api/admin/prices/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await query("delete from price_entries where id = $1", [id]);
    res.status(204).send();
  }),
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ message: "Validation failed", issues: err.issues });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

async function bootstrapAdminIfMissing(): Promise<void> {
  const existing = await query<{ id: string }>(
    "select id from users where email = $1 limit 1",
    [config.adminBootstrapEmail],
  );
  if (existing.length > 0) return;
  const passwordHash = await bcrypt.hash(config.adminBootstrapPassword, 10);
  await query(
    `insert into users (email, password_hash, is_active)
     values ($1, $2, true)`,
    [config.adminBootstrapEmail, passwordHash],
  );
  console.log(`Bootstrapped admin: ${config.adminBootstrapEmail}`);
}

async function start(): Promise<void> {
  await bootstrapAdminIfMissing();
  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
}

void start();
