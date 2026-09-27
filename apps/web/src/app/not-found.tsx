// 404: no such page or protocol. Points to the record, never guesses.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wallet-solo">
      <p className="kicker">Not found</p>
      <h1>No keys to count here.</h1>
      <p className="lede">This page, protocol or change is not in the record. <Link href="/">See every protocol Keyholder tracks &rarr;</Link></p>
    </main>
  );
}
