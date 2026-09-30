import type { ReactNode } from "react";
import { PassportHeader, PassportNav } from "@/components/passport/PassportChrome";

/** Shared chrome for every Passport screen: owner header, actions and section tabs. */
export default function PassportLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <PassportHeader />
      <PassportNav />
      {children}
    </div>
  );
}
