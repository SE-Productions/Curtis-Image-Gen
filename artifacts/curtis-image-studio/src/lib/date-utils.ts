import { startOfWeek, format } from "date-fns";

export function getCurrentWeekStart() {
  const date = startOfWeek(new Date(), { weekStartsOn: 1 }); // 1 = Monday
  return format(date, "yyyy-MM-dd");
}
