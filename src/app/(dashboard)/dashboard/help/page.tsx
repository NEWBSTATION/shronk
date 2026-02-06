import Image from "next/image";

export default function HelpPage() {
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
