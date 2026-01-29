import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function HelpPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <Image
        src="/good-morning.png"
        alt="Help"
        width={400}
        height={500}
        className="rounded-lg"
        priority
      />
    </div>
  );
}
