import { Suspense } from "react";
import { CreditsPage } from "@/components/credits/credits-page";

export const metadata = { title: "Credits" };

export default function Page() {
  return (
    <Suspense>
      <CreditsPage />
    </Suspense>
  );
}
