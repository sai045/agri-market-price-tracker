type HolidayRule = {
  recurrence_type: "weekly" | "annual" | "none";
  day_of_week: number | null;
  month: number | null;
  day: number | null;
  holiday_date: string | null;
};

export function isHolidayForDate(date: Date, rules: HolidayRule[]): boolean {
  const dayOfWeek = date.getDay();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const yyyyMmDd = date.toISOString().slice(0, 10);

  return rules.some((rule) => {
    if (rule.recurrence_type === "weekly" && rule.day_of_week !== null) {
      return rule.day_of_week === dayOfWeek;
    }
    if (
      rule.recurrence_type === "annual" &&
      rule.month !== null &&
      rule.day !== null
    ) {
      return rule.month === month && rule.day === day;
    }
    if (rule.recurrence_type === "none" && rule.holiday_date) {
      return rule.holiday_date === yyyyMmDd;
    }
    return false;
  });
}
