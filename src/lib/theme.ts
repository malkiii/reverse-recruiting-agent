import { cookies } from "next/headers";
import { THEME_COOKIE } from "./ui-cookies";

/** Dark unless the Admin switched to light. */
export async function isDarkTheme() {
  return (await cookies()).get(THEME_COOKIE)?.value !== "light";
}
