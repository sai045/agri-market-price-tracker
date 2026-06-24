import { useEffect, useMemo, useState } from "react";
import { Calendar, Leaf, LineChart as LineChartIcon, LogOut, Settings } from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "./api";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Textarea } from "./components/ui/textarea";

type City = { id: string; name: string; name_te: string };
type Unit = { id: string; name: string; name_te: string; abbreviation: string; is_active: boolean };
type Item = { id: string; name: string; name_te: string; default_unit_id: string };
type Price = {
  id: string;
  entry_date: string;
  max_price: number;
  notes: string | null;
  item_name: string;
  item_name_te: string;
  abbreviation: string;
};
type Season = { id: string; item_id: string; item_name: string; start_month: number; end_month: number };
type Holiday = {
  id: string;
  city_id: string;
  city_name: string;
  name: string;
  recurrence_type: "weekly" | "annual" | "none";
  holiday_date: string | null;
};
type MastersPayload = {
  cities: City[];
  units: Unit[];
  items: Item[];
  seasons: Season[];
  holidays: Holiday[];
};

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const links = [
    ["/", "Today"],
    ["/history", "History"],
    ["/seasons", "Seasons"],
    ["/holidays", "Holidays"],
    ["/admin", "Admin"],
  ] as const;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm text-muted-foreground">Agriculture Dashboard</p>
            <h1 className="text-lg font-semibold">Market Price Tracker</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className={`rounded-md px-3 py-1.5 text-sm ${location.pathname === to ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

function useCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  useEffect(() => {
    void api.get<City[]>("/api/cities").then((r) => {
      setCities(r.data);
      setCityId((prev) => prev || r.data[0]?.id || "");
    });
  }, []);
  return { cities, cityId, setCityId };
}

function CityFilter({
  cities,
  cityId,
  setCityId,
}: {
  cities: City[];
  cityId: string;
  setCityId: (value: string) => void;
}) {
  return (
    <div className="w-full md:w-72">
      <Label>City</Label>
      <Select value={cityId} onChange={(e) => setCityId(e.target.value)}>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.name} ({city.name_te})
          </option>
        ))}
      </Select>
    </div>
  );
}

function TodayPage() {
  const { cities, cityId, setCityId } = useCities();
  const [rows, setRows] = useState<Price[]>([]);
  useEffect(() => {
    if (!cityId) return;
    void api.get<Price[]>("/api/prices/latest", { params: { cityId } }).then((r) => setRows(r.data));
  }, [cityId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5" />Today&apos;s Market Board</CardTitle>
          <CardDescription>Latest max prices from selected mandi city</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CityFilter cities={cities} cityId={cityId} setCityId={setCityId} />
          <PriceTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryPage() {
  const { cities, cityId, setCityId } = useCities();
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState<Price[]>([]);
  const [trend, setTrend] = useState<Array<{ entry_date: string; max_price: number }>>([]);

  useEffect(() => {
    void api.get<Item[]>("/api/items").then((r) => {
      setItems(r.data);
      setItemId((prev) => prev || r.data[0]?.id || "");
    });
  }, []);
  useEffect(() => {
    if (!cityId) return;
    void api.get<Price[]>("/api/prices", { params: { cityId, itemId: itemId || undefined } }).then((r) => setRows(r.data));
  }, [cityId, itemId]);
  useEffect(() => {
    if (!cityId || !itemId) return;
    void api
      .get<Array<{ entry_date: string; max_price: number }>>("/api/prices/trends", { params: { cityId, itemId, days } })
      .then((r) => setTrend(r.data));
  }, [cityId, itemId, days]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LineChartIcon className="h-5 w-5" />Price Trends</CardTitle>
          <CardDescription>Track max price movements over time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <CityFilter cities={cities} cityId={cityId} setCityId={setCityId} />
            <div>
              <Label>Item</Label>
              <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.name_te})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Days</Label>
              <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
              </Select>
            </div>
          </div>
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <XAxis dataKey="entry_date" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="max_price" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <PriceTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function SeasonsPage() {
  const [rows, setRows] = useState<Array<{ item_id: string; name: string; name_te: string; start_month: number; end_month: number; inSeasonNow: boolean }>>([]);
  useEffect(() => {
    void api.get("/api/seasons").then((r) => setRows(r.data));
  }, []);
  const inSeasonRows = rows.filter((r) => r.inSeasonNow);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Leaf className="h-5 w-5" />On-Season Items</CardTitle>
        <CardDescription>Items currently in configured season</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Season Window</TableHead></TableRow></TableHeader>
          <TableBody>
            {inSeasonRows.map((row) => (
              <TableRow key={row.item_id}>
                <TableCell>{row.name} ({row.name_te})</TableCell>
                <TableCell>{row.start_month} - {row.end_month}</TableCell>
              </TableRow>
            ))}
            {inSeasonRows.length === 0 && <TableRow><TableCell colSpan={2}>No items are in season this month.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HolidaysPage() {
  const { cities, cityId, setCityId } = useCities();
  const [rows, setRows] = useState<Array<{ date: string; name: string; name_te: string; type: string }>>([]);
  useEffect(() => {
    if (!cityId) return;
    void api.get("/api/holidays", { params: { cityId, year: new Date().getFullYear() } }).then((r) => setRows(r.data));
  }, [cityId]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Holiday Calendar</CardTitle>
        <CardDescription>Recurring and one-off market off-days by city</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CityFilter cities={cities} cityId={cityId} setCityId={setCityId} />
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.date}-${row.name}`}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.name} ({row.name_te})</TableCell>
                <TableCell><Badge variant="secondary">{row.type}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/auth/login", { email, password });
      onSuccess();
      navigate("/admin");
    } catch {
      setError("Invalid credentials");
    }
  };
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader><CardTitle>Admin Sign In</CardTitle><CardDescription>Use your admin account</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" type="submit">Sign In</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function useMasters(isAuthed: boolean) {
  const [masters, setMasters] = useState<MastersPayload | null>(null);
  const refresh = () => api.get<MastersPayload>("/api/admin/masters").then((r) => setMasters(r.data));
  useEffect(() => {
    if (isAuthed) void refresh();
  }, [isAuthed]);
  return { masters, refresh };
}

function AdminPage({ isAuthed, onLogout }: { isAuthed: boolean; onLogout: () => Promise<void> }) {
  const navigate = useNavigate();
  const { masters } = useMasters(isAuthed);
  const [form, setForm] = useState({ city_id: "", item_id: "", unit_id: "", entry_date: new Date().toISOString().slice(0, 10), max_price: "", notes: "" });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!masters) return;
    setForm((prev) => ({
      ...prev,
      city_id: prev.city_id || masters.cities[0]?.id || "",
      item_id: prev.item_id || masters.items[0]?.id || "",
      unit_id: prev.unit_id || masters.units[0]?.id || "",
    }));
  }, [masters]);

  const selectedItem = useMemo(() => masters?.items.find((i) => i.id === form.item_id), [masters, form.item_id]);
  useEffect(() => {
    if (selectedItem) setForm((prev) => ({ ...prev, unit_id: selectedItem.default_unit_id }));
  }, [selectedItem]);

  if (!isAuthed) return <Navigate to="/admin/login" replace />;
  if (!masters) return <Card><CardContent className="pt-6">Loading admin data...</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">Daily price entry first, masters on separate screen</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/masters")}><Settings className="h-4 w-4" />Manage Masters</Button>
          <Button variant="secondary" onClick={onLogout}><LogOut className="h-4 w-4" />Logout</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Price Entry</CardTitle><CardDescription>Enter daily max price for selected city and item</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field label="City"><Select value={form.city_id} onChange={(e) => setForm((p) => ({ ...p, city_id: e.target.value }))}>{masters.cities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.name_te})</option>)}</Select></Field>
            <Field label="Date"><Input type="date" value={form.entry_date} onChange={(e) => setForm((p) => ({ ...p, entry_date: e.target.value }))} /></Field>
            <Field label="Item"><Select value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>{masters.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.name_te})</option>)}</Select></Field>
            <Field label="Unit"><Select value={form.unit_id} onChange={(e) => setForm((p) => ({ ...p, unit_id: e.target.value }))}>{masters.units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}</Select></Field>
            <Field label="Max Price"><Input type="number" value={form.max_price} onChange={(e) => setForm((p) => ({ ...p, max_price: e.target.value }))} /></Field>
          </div>
          <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
          <Button
            onClick={async () => {
              const res = await api.post("/api/admin/prices", { ...form, max_price: Number(form.max_price), notes: form.notes || null });
              setWarnings(res.data.warnings ?? []);
              setMessage("Price saved successfully.");
            }}
          >
            Save Price
          </Button>
          {warnings.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-600">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          {message && <p className="text-sm text-green-700">{message}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard title="Cities" value={masters.cities.length} />
        <StatCard title="Items" value={masters.items.length} />
        <StatCard title="Units" value={masters.units.length} />
        <StatCard title="Holidays" value={masters.holidays.length} />
      </div>
    </div>
  );
}

function MastersPage({ isAuthed }: { isAuthed: boolean }) {
  const { masters, refresh } = useMasters(isAuthed);
  if (!isAuthed) return <Navigate to="/admin/login" replace />;
  if (!masters) return <Card><CardContent className="pt-6">Loading masters...</CardContent></Card>;
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-semibold">Master Data Management</h2><p className="text-sm text-muted-foreground">Manage cities, units, items, seasons, and holidays here</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MasterCard title="Cities"><CityMasterForm onDone={refresh} /><SimpleList items={masters.cities.map((c) => `${c.name} (${c.name_te})`)} /></MasterCard>
        <MasterCard title="Units"><UnitMasterForm onDone={refresh} /><SimpleList items={masters.units.map((u) => `${u.name} (${u.abbreviation})`)} /></MasterCard>
        <MasterCard title="Items"><ItemMasterForm units={masters.units} onDone={refresh} /><SimpleList items={masters.items.map((i) => `${i.name} (${i.name_te})`)} /></MasterCard>
        <MasterCard title="Seasons"><SeasonMasterForm items={masters.items} onDone={refresh} /><SimpleList items={masters.seasons.map((s) => `${s.item_name}: ${s.start_month}-${s.end_month}`)} /></MasterCard>
        <MasterCard title="Holidays"><HolidayMasterForm cities={masters.cities} onDone={refresh} /><SimpleList items={masters.holidays.map((h) => `${h.city_name}: ${h.name} (${h.recurrence_type})`)} /></MasterCard>
      </div>
    </div>
  );
}

function MasterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3">{children}</CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

function StatCard({ title, value }: { title: string; value: number }) {
  return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>;
}

function SimpleList({ items }: { items: string[] }) {
  return <ul className="max-h-44 space-y-1 overflow-auto rounded-md border border-border p-2 text-sm">{items.map((item) => <li key={item} className="rounded-sm px-2 py-1 hover:bg-accent">{item}</li>)}</ul>;
}

function CityMasterForm({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState(""); const [nameTe, setNameTe] = useState(""); const [region, setRegion] = useState("");
  return <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!name || !nameTe) return; await api.post("/api/admin/cities", { name, name_te: nameTe, region: region || null }); setName(""); setNameTe(""); setRegion(""); await onDone(); }}>
    <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Telugu Name"><Input value={nameTe} onChange={(e) => setNameTe(e.target.value)} /></Field>
    <Field label="Region"><Input value={region} onChange={(e) => setRegion(e.target.value)} /></Field>
    <Button type="submit" size="sm">Add City</Button>
  </form>;
}

function UnitMasterForm({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState(""); const [nameTe, setNameTe] = useState(""); const [abbr, setAbbr] = useState("");
  return <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!name || !nameTe || !abbr) return; await api.post("/api/admin/units", { name, name_te: nameTe, abbreviation: abbr }); setName(""); setNameTe(""); setAbbr(""); await onDone(); }}>
    <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Telugu Name"><Input value={nameTe} onChange={(e) => setNameTe(e.target.value)} /></Field>
    <Field label="Abbreviation"><Input value={abbr} onChange={(e) => setAbbr(e.target.value)} /></Field>
    <Button type="submit" size="sm">Add Unit</Button>
  </form>;
}

function ItemMasterForm({ units, onDone }: { units: Unit[]; onDone: () => Promise<void> }) {
  const [name, setName] = useState(""); const [nameTe, setNameTe] = useState(""); const [unitId, setUnitId] = useState("");
  useEffect(() => { if (!unitId && units[0]) setUnitId(units[0].id); }, [units, unitId]);
  return <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!name || !nameTe || !unitId) return; await api.post("/api/admin/items", { name, name_te: nameTe, default_unit_id: unitId }); setName(""); setNameTe(""); await onDone(); }}>
    <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Telugu Name"><Input value={nameTe} onChange={(e) => setNameTe(e.target.value)} /></Field>
    <Field label="Default Unit"><Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}</Select></Field>
    <Button type="submit" size="sm">Add Item</Button>
  </form>;
}

function SeasonMasterForm({ items, onDone }: { items: Item[]; onDone: () => Promise<void> }) {
  const [itemId, setItemId] = useState(""); const [startMonth, setStartMonth] = useState(1); const [endMonth, setEndMonth] = useState(12);
  useEffect(() => { if (!itemId && items[0]) setItemId(items[0].id); }, [items, itemId]);
  return <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!itemId) return; await api.post("/api/admin/seasons", { item_id: itemId, start_month: startMonth, end_month: endMonth }); await onDone(); }}>
    <Field label="Item"><Select value={itemId} onChange={(e) => setItemId(e.target.value)}>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.name_te})</option>)}</Select></Field>
    <div className="grid grid-cols-2 gap-2">
      <Field label="Start Month"><Input type="number" min={1} max={12} value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} /></Field>
      <Field label="End Month"><Input type="number" min={1} max={12} value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} /></Field>
    </div>
    <Button type="submit" size="sm">Save Season</Button>
  </form>;
}

function HolidayMasterForm({ cities, onDone }: { cities: City[]; onDone: () => Promise<void> }) {
  const [cityId, setCityId] = useState(""); const [name, setName] = useState(""); const [nameTe, setNameTe] = useState("");
  const [recurrence, setRecurrence] = useState<"weekly" | "annual" | "none">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(0); const [month, setMonth] = useState(1); const [day, setDay] = useState(1); const [date, setDate] = useState("");
  useEffect(() => { if (!cityId && cities[0]) setCityId(cities[0].id); }, [cityId, cities]);
  return <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!cityId || !name || !nameTe) return; await api.post("/api/admin/holidays", { city_id: cityId, name, name_te: nameTe, recurrence_type: recurrence, day_of_week: recurrence === "weekly" ? dayOfWeek : null, month: recurrence === "annual" ? month : null, day: recurrence === "annual" ? day : null, holiday_date: recurrence === "none" ? date || null : null }); setName(""); setNameTe(""); await onDone(); }}>
    <Field label="City"><Select value={cityId} onChange={(e) => setCityId(e.target.value)}>{cities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.name_te})</option>)}</Select></Field>
    <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
    <Field label="Telugu Name"><Input value={nameTe} onChange={(e) => setNameTe(e.target.value)} /></Field>
    <Field label="Recurrence"><Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as "weekly" | "annual" | "none")}><option value="weekly">Weekly</option><option value="annual">Annual</option><option value="none">One-off date</option></Select></Field>
    {recurrence === "weekly" && <Field label="Day of week (0=Sun)"><Input type="number" min={0} max={6} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} /></Field>}
    {recurrence === "annual" && <div className="grid grid-cols-2 gap-2"><Field label="Month"><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} /></Field><Field label="Day"><Input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} /></Field></div>}
    {recurrence === "none" && <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
    <Button type="submit" size="sm">Add Holiday</Button>
  </form>;
}

function PriceTable({ rows }: { rows: Price[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Price</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.entry_date}</TableCell>
            <TableCell>{row.item_name} ({row.item_name_te})</TableCell>
            <TableCell>Rs {Number(row.max_price).toLocaleString()} / {row.abbreviation}</TableCell>
            <TableCell>{row.notes ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void api.get("/api/admin/me").then(() => setIsAuthed(true)).catch(() => setIsAuthed(false)).finally(() => setAuthChecked(true));
  }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    setIsAuthed(false);
    navigate("/");
  };

  if (!authChecked) return <AppShell><Card><CardContent className="pt-6">Checking login...</CardContent></Card></AppShell>;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/seasons" element={<SeasonsPage />} />
        <Route path="/holidays" element={<HolidaysPage />} />
        <Route path="/admin/login" element={<AdminLogin onSuccess={() => setIsAuthed(true)} />} />
        <Route path="/admin" element={<AdminPage isAuthed={isAuthed} onLogout={logout} />} />
        <Route path="/admin/prices/new" element={<AdminPage isAuthed={isAuthed} onLogout={logout} />} />
        <Route path="/admin/masters" element={<MastersPage isAuthed={isAuthed} />} />
      </Routes>
    </AppShell>
  );
}

export default App;
