import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FeaturesView } from "./features-view";

export default async function FeaturesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <FeaturesView />;
}
