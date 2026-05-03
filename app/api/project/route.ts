import { NextRequest } from "next/server";
import { readProject, writeProject, resetProject, updateProjectFromResponse } from "@/lib/project";

export async function GET() {
  const content = await readProject();
  return Response.json({ content });
}

export async function PUT(request: NextRequest) {
  const { content } = (await request.json()) as { content: string };
  await writeProject(content);
  return Response.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const { responseText, role } = (await request.json()) as {
    responseText: string;
    role: "plan" | "coder";
  };
  const updated = await updateProjectFromResponse(responseText, role);
  return Response.json({ updated });
}

export async function DELETE() {
  await resetProject();
  return Response.json({ ok: true });
}
