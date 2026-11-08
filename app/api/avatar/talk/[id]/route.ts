import { didFetch } from "@/lib/did";

export async function GET(_req: Request, ctx: RouteContext<"/api/avatar/talk/[id]">) {
  const { id } = await ctx.params;
  if (!/^[\w-]+$/.test(id)) {
    return Response.json({ error: "Bad id" }, { status: 400 });
  }
  try {
    const data = await didFetch(`/talks/${id}`);
    return Response.json({
      status: data.status as string, // created | started | done | error | rejected
      url: data.result_url as string | undefined,
      error: data.error?.description as string | undefined,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
