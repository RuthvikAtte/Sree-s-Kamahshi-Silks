import { useRouter } from "next/router";
import useSWR from "swr";
import Layout from "../../components/Layout";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ProductDetail() {
  const router = useRouter();
  const id = router.query.id as string;
  const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
  const { data } = useSWR(id ? base + "/products" : null, fetcher);
  const product = (data?.products || []).find((p: any) => p.id === id);

  async function buy() {
    const res = await fetch(base + "/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: id,
        successUrl: window.location.origin + `/success`,
        cancelUrl: window.location.href,
        currency: "inr",
      }),
    });
    const json = await res.json();
    if (json?.url) window.location.href = json.url;
  }

  if (!product)
    return (
      <Layout>
        <p>Loading...</p>
      </Layout>
    );
  return (
    <Layout>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <img
          src={product.image_url}
          alt={product.name}
          style={{
            width: "100%",
            borderRadius: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.1)",
          }}
        />
        <div>
          <h1>{product.name}</h1>
          <div className="price" style={{ fontSize: 24 }}>
            ₹{(product.price / 100).toFixed(0)}
          </div>
          <p style={{ lineHeight: 1.6 }}>{product.description}</p>
          <button className="btn" onClick={buy} disabled={!product.available}>
            {product.available ? "Buy Now" : "Sold"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
