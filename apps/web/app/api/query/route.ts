import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { prompt } = await request.json();

  // Placeholder response until Supabase search + LLM orchestration is wired.
  const answer = `80HD understood your question:\n\n> ${prompt}\n\nReal-time querying will stream summaries from the vector index once connected.`;

  return NextResponse.json({ answer });
}

