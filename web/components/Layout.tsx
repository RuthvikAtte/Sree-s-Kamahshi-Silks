import Link from "next/link";
import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header>
        <div className="brand">Sree's Kamakshi Silks</div>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/">Home</Link>
          <Link href="/cart">Cart</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </header>
      <main className="container">{children}</main>
      <footer>© {new Date().getFullYear()} Sree's Kamakshi Silks</footer>
    </>
  );
}
