"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();

  async function handleConfirm() {
    const supabase = createClient();
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) throw new Error("המחיקה נכשלה: " + error.message);
    router.refresh();
  }

  return (
    <ConfirmDeleteButton
      title="מחיקת לקוח"
      message={`האם אתה בטוח שברצונך למחוק את "${clientName}"? פעולה זו תמחק גם את כל החשבונות, התנועות, הביאורים ופקודות היומן של הלקוח, ולא ניתנת לביטול.`}
      onConfirm={handleConfirm}
    />
  );
}
