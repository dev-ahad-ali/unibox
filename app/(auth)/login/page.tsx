import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const next = typeof params.next === "string" ? params.next : "/inbox";

  return <LoginForm next={next} />;
}
