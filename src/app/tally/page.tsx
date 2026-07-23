import { redirect } from "next/navigation";

export default function TallyRedirectPage() {
  redirect("/vote");
}
