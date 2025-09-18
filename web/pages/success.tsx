import Link from "next/link";
import Layout from "../components/Layout";

export default function Success() {
  return (
    <Layout>
      <h1>Thank you for your purchase!</h1>
      <p>Your order has been placed. We will contact you shortly.</p>
      <Link href="/">Back to Home</Link>
    </Layout>
  );
}
