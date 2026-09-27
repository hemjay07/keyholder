// /proof now lives on /policy (design/REVAMP-PAGES.md: one page for the vault builder).
import { redirect } from "next/navigation";

export default function ProofPage() {
  redirect("/policy#proof");
}
