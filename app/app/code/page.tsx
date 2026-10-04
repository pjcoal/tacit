import { Suspense } from "react";
import { CodeAgent } from "@/components/code/code-agent";

export const metadata = { title: "Code" };

export default function Page() {
  return (
    <Suspense>
      <CodeAgent />
    </Suspense>
  );
}
