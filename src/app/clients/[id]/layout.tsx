import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientNav } from "./client-nav";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client, error } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (error || !client) notFound();

  return (
    <div className="print-flow flex flex-1 flex-col" style={{ background: "var(--background)" }}>
      <ClientNav clientId={id} clientName={client.name} />
      {children}
    </div>
  );
}
