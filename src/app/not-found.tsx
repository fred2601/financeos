import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <Compass className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">This page does not exist in FinanceOS.</p>
      <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
        Go to the executive dashboard
      </Link>
    </div>
  );
}
